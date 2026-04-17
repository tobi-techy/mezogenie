// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IBorrowerOperations.sol";
import "./interfaces/ITroveManager.sol";
import "./interfaces/IHintHelpers.sol";
import "./interfaces/ISortedTroves.sol";
import "./interfaces/IMUSD.sol";

/// @title RemitVault — Bitcoin-backed remittances that build wealth
/// @notice Lock BTC collateral, mint MUSD, send to recipients, save for family
contract RemitVault {
    IBorrowerOperations public immutable borrowerOps;
    ITroveManager public immutable troveManager;
    IHintHelpers public immutable hintHelpers;
    ISortedTroves public immutable sortedTroves;
    IMUSD public immutable musd;

    struct Remittance {
        address sender;
        address recipient;
        uint256 musdAmount;
        uint256 savingsAmount;
        uint256 timestamp;
        bool claimed;
    }

    // recipient => claimable MUSD
    mapping(address => uint256) public pendingClaims;
    // family vault: sender => recipient => saved MUSD
    mapping(address => mapping(address => uint256)) public familyVaults;
    // all remittances
    Remittance[] public remittances;
    // sender => remittance indices
    mapping(address => uint256[]) public senderHistory;
    // recipient => remittance indices
    mapping(address => uint256[]) public recipientHistory;

    event RemittanceSent(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 musdAmount,
        uint256 savingsAmount
    );
    event RemittanceClaimed(uint256 indexed id, address indexed recipient, uint256 amount);
    event FamilyWithdrawal(address indexed sender, address indexed recipient, uint256 amount);

    constructor(
        address _borrowerOps,
        address _troveManager,
        address _hintHelpers,
        address _sortedTroves,
        address _musd
    ) {
        borrowerOps = IBorrowerOperations(_borrowerOps);
        troveManager = ITroveManager(_troveManager);
        hintHelpers = IHintHelpers(_hintHelpers);
        sortedTroves = ISortedTroves(_sortedTroves);
        musd = IMUSD(_musd);
    }

    /// @notice Send a remittance: lock BTC, mint MUSD, allocate to recipient + family vault
    /// @param _recipient Address that can claim the MUSD
    /// @param _musdAmount Amount of MUSD to mint
    /// @param _savingsPercent Percentage (0-100) to save in family vault
    /// @param _upperHint Hint for sorted troves insertion
    /// @param _lowerHint Hint for sorted troves insertion
    function sendRemittance(
        address _recipient,
        uint256 _musdAmount,
        uint8 _savingsPercent,
        address _upperHint,
        address _lowerHint
    ) external payable {
        require(_recipient != address(0), "Invalid recipient");
        require(_musdAmount > 0, "Amount must be > 0");
        require(_savingsPercent <= 100, "Savings % must be <= 100");
        require(msg.value > 0, "Must send BTC collateral");

        // Check if sender already has a trove
        uint256 troveStatus = troveManager.getTroveStatus(address(this));

        if (troveStatus == 1) {
            // Active trove — adjust it
            borrowerOps.adjustTrove{value: msg.value}(
                0, _musdAmount, true, _upperHint, _lowerHint
            );
        } else {
            // No trove — open one
            borrowerOps.openTrove{value: msg.value}(
                _musdAmount, _upperHint, _lowerHint
            );
        }

        // Split MUSD between recipient claim and family vault
        uint256 savingsAmount = (_musdAmount * _savingsPercent) / 100;
        uint256 sendAmount = _musdAmount - savingsAmount;

        pendingClaims[_recipient] += sendAmount;
        if (savingsAmount > 0) {
            familyVaults[msg.sender][_recipient] += savingsAmount;
        }

        uint256 id = remittances.length;
        remittances.push(Remittance({
            sender: msg.sender,
            recipient: _recipient,
            musdAmount: sendAmount,
            savingsAmount: savingsAmount,
            timestamp: block.timestamp,
            claimed: false
        }));
        senderHistory[msg.sender].push(id);
        recipientHistory[_recipient].push(id);

        emit RemittanceSent(id, msg.sender, _recipient, sendAmount, savingsAmount);
    }

    /// @notice Recipient claims their pending MUSD
    function claimMUSD() external {
        uint256 amount = pendingClaims[msg.sender];
        require(amount > 0, "Nothing to claim");

        pendingClaims[msg.sender] = 0;

        // Mark all unclaimed remittances for this recipient as claimed
        uint256[] storage history = recipientHistory[msg.sender];
        for (uint256 i = 0; i < history.length; i++) {
            if (!remittances[history[i]].claimed) {
                remittances[history[i]].claimed = true;
            }
        }

        require(musd.transfer(msg.sender, amount), "MUSD transfer failed");
        emit RemittanceClaimed(history.length > 0 ? history[history.length - 1] : 0, msg.sender, amount);
    }

    /// @notice Sender withdraws from family vault for a recipient
    function withdrawFamilyVault(address _recipient, uint256 _amount) external {
        require(familyVaults[msg.sender][_recipient] >= _amount, "Insufficient savings");
        familyVaults[msg.sender][_recipient] -= _amount;
        require(musd.transfer(_recipient, _amount), "MUSD transfer failed");
        emit FamilyWithdrawal(msg.sender, _recipient, _amount);
    }

    // --- View functions ---

    function getSenderRemittanceCount(address _sender) external view returns (uint256) {
        return senderHistory[_sender].length;
    }

    function getRecipientRemittanceCount(address _recipient) external view returns (uint256) {
        return recipientHistory[_recipient].length;
    }

    function getFamilyVaultBalance(address _sender, address _recipient) external view returns (uint256) {
        return familyVaults[_sender][_recipient];
    }

    function getRemittance(uint256 _id) external view returns (Remittance memory) {
        return remittances[_id];
    }

    function getTotalRemittances() external view returns (uint256) {
        return remittances.length;
    }

    receive() external payable {}
}
