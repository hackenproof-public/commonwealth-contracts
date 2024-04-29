// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

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
     * @notice Deploy funds to project from investment fund
     * @param amount amount of tokens transferred to project
     */
    function deployFunds(uint256 amount) external;

    /**
     * @notice Returns project details
     * @return Project details
     */
    function getDetails() external view returns (ProjectDetails memory);

    /**
     * @notice Sells amount of vested tokens to a given investment fund
     * @param _amount amount of vested tokens to be sold
     * @param _fee fee tier
     * @param _sqrtPriceLimitX96 amount of vested tokens to be sold
     * @param _amountOutMinimum minimum amount of tokens expected to get after the swap
     */
    function sellVestedToInvestmentFund(
        uint256 _amount,
        uint24 _fee,
        uint160 _sqrtPriceLimitX96,
        uint256 _amountOutMinimum
    ) external;

    /**
     * @notice Returns funds allocation for this project
     * @return amount of funds allocated to this project
     */
    function getFundsAllocation() external returns (uint256);
}
