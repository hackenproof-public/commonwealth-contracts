// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title ILeftoversWithdrawal
 * @notice An interface for contracts that allow leftovers withdrawal functionality.
 */
interface ILeftoversWithdrawal {
    /**
     * @notice Event emitted when leftover tokens are withdrawn.
     */
    event LeftoversWithdrawn(address indexed account, uint256 indexed amount);

    /**
     * @notice Withdraws any leftover tokens to a specific account.
     * @param _account Address of the account to withdraw leftover tokens for.
     */
    function withdrawLeftovers(address _account) external;

    /**
     * @notice Returns the timestamp when leftover tokens can be unlocked.
     * @return Timestamp when leftover tokens can be unlocked.
     */
    function leftoversUnlockTimestamp() external view returns (uint256);
}
