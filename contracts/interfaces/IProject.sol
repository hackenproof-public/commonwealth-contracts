// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

/**
 * @title IProject interface
 */
interface IProject {
    struct ProjectDetails {
        string name;
        bytes32 status;
        address vestingContract;
    }

    /**
     * @notice Emitted when token vesting contract changes
     * @param caller Address that sets vesting contract
     * @param oldVesting Address of old vesting contract
     * @param newVesting Address of new vesting contract
     */
    event VestingContractChanged(address indexed caller, address indexed oldVesting, address indexed newVesting);

    /**
     * @notice Sets project token vesting contract
     * @param vesting_ Address of vesting contract
     */
    function setVesting(address vesting_) external;

    /**
     * @notice Returns project details
     * @return Project details
     */
    function getDetails() external view returns (ProjectDetails memory);
}
