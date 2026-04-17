// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITroveManager {
    function getTroveDebt(address _borrower) external view returns (uint256);
    function getTroveColl(address _borrower) external view returns (uint256);
    function getTroveStatus(address _borrower) external view returns (uint256);
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
    function MUSD_GAS_COMPENSATION() external view returns (uint256);
}
