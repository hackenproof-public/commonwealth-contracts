// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IWlth {
    /**
     * @notice Destroys `amount` tokens from the caller.
     * @param amount Amount to be burned
     */
    function burn(uint256 amount) external;
}
