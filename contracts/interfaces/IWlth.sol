// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IWlth {
    /**
     * @notice Burns the amount of tokens
     * @param amount Amount to be burned
     */
    function burn(uint256 amount) external;

    /**
     * @notice Returns the amount of tokens burned
     */
    function burned() external view returns (uint256);
}
