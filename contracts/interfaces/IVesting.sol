// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IVesting interface
 */
interface IVesting {
    /**
     * @notice Emitted when token released from vesting contract
     * @param beneficiary Wallet that released tokens
     * @param token Token address
     * @param amount Amount released
     */
    event Released(address indexed beneficiary, address indexed token, uint256 amount);

    /**
     * @notice Withdraws vested tokens from contract
     * @param amount Amount of tokens to withdraw
     */
    function release(uint256 amount) external;

    /**
     * @notice Returns number of tokens available to be released by beneficiary
     * @return Number of available tokens
     */
    function getReleasableAmount() external view returns (uint256);

    /**
     * @notice Returns amount of vested tokens in specified block
     * @param blockNumber Block number for which to return vested tokens amount
     * @return Number of vested tokens
     */
    function getVestedAmount(uint256 blockNumber) external view returns (uint256);
}
