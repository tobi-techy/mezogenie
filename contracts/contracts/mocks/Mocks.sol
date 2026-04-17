// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock MUSD for local testing
contract MockMUSD is ERC20 {
    constructor() ERC20("Mock MUSD", "MUSD") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Mock BorrowerOperations — mints MUSD when openTrove/adjustTrove is called
contract MockBorrowerOperations {
    address public musd;
    constructor(address _musd) { musd = _musd; }

    function openTrove(uint256 _MUSDAmount, address, address) external payable {
        MockMUSD(musd).mint(msg.sender, _MUSDAmount);
    }

    function adjustTrove(uint256, uint256 _MUSDChange, bool _isDebtIncrease, address, address) external payable {
        if (_isDebtIncrease) MockMUSD(musd).mint(msg.sender, _MUSDChange);
    }

    function closeTrove() external {}
    function addColl(address, address) external payable {}
    function withdrawColl(uint256, address, address) external {}
    function repayMUSD(uint256, address, address) external {}
    function getBorrowingFee(uint256) external pure returns (uint256) { return 0; }
}

/// @dev Mock TroveManager
contract MockTroveManager {
    // 0 = nonExistent, 1 = active, 2 = closedByOwner, 3 = closedByLiquidation, 4 = closedByRedemption
    mapping(address => uint256) public statuses;

    function setStatus(address _borrower, uint256 _status) external { statuses[_borrower] = _status; }
    function getTroveStatus(address _borrower) external view returns (uint256) { return statuses[_borrower]; }
    function getTroveDebt(address) external pure returns (uint256) { return 0; }
    function getTroveColl(address) external pure returns (uint256) { return 0; }
    function getCurrentICR(address, uint256) external pure returns (uint256) { return 2e18; }
    function MUSD_GAS_COMPENSATION() external pure returns (uint256) { return 200e18; }
}

/// @dev Mock HintHelpers
contract MockHintHelpers {
    function getApproxHint(uint256, uint256, uint256) external pure returns (address, uint256, uint256) {
        return (address(0), 0, 0);
    }
}

/// @dev Mock SortedTroves
contract MockSortedTroves {
    function findInsertPosition(uint256, address, address) external pure returns (address, address) {
        return (address(0), address(0));
    }
}
