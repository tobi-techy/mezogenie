// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IBorrowerOperations.sol";
import "./interfaces/IMUSD.sol";

/// @title SafeVault — Anti-panic-sell protocol for BTC holders
/// @notice Time-lock BTC, mint MUSD in emergencies, cooling-off protection
contract SafeVault {
    IBorrowerOperations public immutable borrowerOps;
    IMUSD public immutable musd;

    struct Lock {
        uint256 btcAmount;
        uint256 lockUntil;
        bool coolingOffEnabled;
        uint256 withdrawRequestTime; // 0 = no pending request
    }

    mapping(address => Lock) public locks;

    uint256 public constant COOLING_OFF_PERIOD = 72 hours;

    event BTCLocked(address indexed user, uint256 amount, uint256 lockUntil);
    event EmergencyMint(address indexed user, uint256 musdAmount);
    event WithdrawRequested(address indexed user, uint256 availableAt);
    event BTCWithdrawn(address indexed user, uint256 amount);

    constructor(address _borrowerOps, address _musd) {
        borrowerOps = IBorrowerOperations(_borrowerOps);
        musd = IMUSD(_musd);
    }

    /// @notice Lock BTC for a duration. Cannot withdraw until lock expires.
    /// @param _durationDays Lock period in days
    /// @param _coolingOff Enable 72h cooling-off on withdrawals
    function lockBTC(uint256 _durationDays, bool _coolingOff) external payable {
        require(msg.value > 0, "Must send BTC");
        require(_durationDays > 0, "Duration must be > 0");

        Lock storage lock = locks[msg.sender];
        lock.btcAmount += msg.value;
        lock.lockUntil = block.timestamp + (_durationDays * 1 days);
        lock.coolingOffEnabled = _coolingOff;

        emit BTCLocked(msg.sender, msg.value, lock.lockUntil);
    }

    /// @notice Emergency: mint MUSD against locked BTC without selling
    /// @dev In production, this would open/adjust a Trove. Simplified for hackathon.
    function emergencyMint(
        uint256 _musdAmount,
        address _upperHint,
        address _lowerHint
    ) external {
        Lock storage lock = locks[msg.sender];
        require(lock.btcAmount > 0, "No locked BTC");

        // Use locked BTC as collateral to mint MUSD
        uint256 collateralNeeded = (_musdAmount * 15) / 10; // 150% ratio
        require(lock.btcAmount >= collateralNeeded, "Insufficient collateral");

        borrowerOps.openTrove{value: collateralNeeded}(
            _musdAmount, _upperHint, _lowerHint
        );

        lock.btcAmount -= collateralNeeded;
        require(musd.transfer(msg.sender, _musdAmount), "MUSD transfer failed");

        emit EmergencyMint(msg.sender, _musdAmount);
    }

    /// @notice Request withdrawal (subject to lock period + cooling off)
    function requestWithdraw() external {
        Lock storage lock = locks[msg.sender];
        require(lock.btcAmount > 0, "No locked BTC");
        require(block.timestamp >= lock.lockUntil, "Lock period not expired");

        if (lock.coolingOffEnabled) {
            lock.withdrawRequestTime = block.timestamp;
            emit WithdrawRequested(msg.sender, block.timestamp + COOLING_OFF_PERIOD);
        } else {
            _executeWithdraw(msg.sender);
        }
    }

    /// @notice Execute withdrawal after cooling-off period
    function executeWithdraw() external {
        Lock storage lock = locks[msg.sender];
        require(lock.withdrawRequestTime > 0, "No pending request");
        require(
            block.timestamp >= lock.withdrawRequestTime + COOLING_OFF_PERIOD,
            "Cooling-off period not expired"
        );
        _executeWithdraw(msg.sender);
    }

    function _executeWithdraw(address _user) internal {
        Lock storage lock = locks[_user];
        uint256 amount = lock.btcAmount;
        lock.btcAmount = 0;
        lock.withdrawRequestTime = 0;

        (bool sent, ) = _user.call{value: amount}("");
        require(sent, "BTC transfer failed");

        emit BTCWithdrawn(_user, amount);
    }

    function getLock(address _user) external view returns (Lock memory) {
        return locks[_user];
    }

    receive() external payable {}
}
