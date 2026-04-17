// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBorrowerOperations {
    function openTrove(
        uint256 _MUSDAmount,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function adjustTrove(
        uint256 _collWithdrawal,
        uint256 _MUSDChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function closeTrove() external;

    function addColl(address _upperHint, address _lowerHint) external payable;

    function withdrawColl(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function repayMUSD(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function getBorrowingFee(uint256 _MUSDDebt) external view returns (uint256);
}
