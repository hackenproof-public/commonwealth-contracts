// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IWithdrawal
 * @notice An interface for contracts that allow withdrawal functionality.
 */
interface IWithdrawal {
    /**
     * @notice Event emitted when leftover tokens are withdrawn.
     */
    event LeftoversWithdrawn(address indexed account, uint256 indexed amount);

    /**
     * @notice Event emitted when surplus tokens are withdrawn.
     */
    event SurplusWithdrawn(address indexed account, uint256 indexed amount);

    /**
     * @notice Withdraws any leftover tokens to a specific account.
     * @param _account Address of the account to withdraw leftover tokens for.
     */
    function withdrawLeftovers(address _account) external;

    /**
     * @notice Withdraws any surplus tokens to a specific account.
     * @param _account Address of the account to withdraw surplus tokens for.
     */
    function withdrawSurplus(address _account) external;

    /**
     * @notice Returns the timestamp when leftover tokens can be unlocked.
     * @return Timestamp when leftover tokens can be unlocked.
     */
    function leftoversUnlockTimestamp() external view returns (uint256);
}
