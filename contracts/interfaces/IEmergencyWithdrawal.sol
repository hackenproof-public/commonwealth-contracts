// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IEmergencyWithdrawal
 * @notice An interface for contracts that allow emergency withdrawal functionality.
 */
interface IEmergencyWithdrawal {
    /**
     * @notice Emitted when a user performs an emergency withdrawal.
     * @param owner The address of the account performing the withdrawal.
     * @param amount The amount withdrawn.
     */
    event EmergencyWithdrawal(address indexed owner, uint256 amount);

    /**
     * @notice Allows an account to perform an emergency withdrawal.
     * @param _account The address of the account performing the withdrawal.
     */
    function emergencyWithdraw(address _account) external;

    /**
     * @notice Returns the timestamp at which emergency withdrawals are unlocked.
     * @return The timestamp at which emergency withdrawals are unlocked.
     */
    function emergencyWithdrawalUnlockTimestamp() external view returns (uint256);
}
