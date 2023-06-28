// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IStakingWlth {
    struct DiscountDistribution {
        uint64 start;
        uint64 end;
        uint120 value;
        bool isConstant;
    }

    struct StakingDetails {
        address staker;
        address fund;
        uint128 amountInWlth;
        uint128 amountInUsdc;
        DiscountDistribution discount;
    }

    /**
     * @notice Emitted when WLTH tokens are staked
     * @param caller Address of staking account
     * @param fund Address of investment fund that staking concerns
     * @param stakeId ID of stake
     * @param amount Amount of staked WLTH
     */
    event TokensStaked(address indexed caller, address indexed fund, uint256 indexed stakeId, uint256 amount);

    /**
     * @notice Emitted when fund is registered in staking contract
     * @param caller Address of staking account
     * @param fund Address of investment fund that staking concerns
     */
    event FundRegistered(address indexed caller, address indexed fund);

    /**
     * @notice Emitted when fund is unregistered from staking contract
     * @param caller Address of staking account
     * @param fund Address of investment fund that staking concerns
     */
    event FundUnregistered(address indexed caller, address indexed fund);

    /**
     * @notice Submits token for staking. Requires transfer approval for all the tokens
     * @param fund Address of investment fund
     * @param amount Amount of WLTH to stake
     * @param period Staking period in seconds
     */
    function stake(address fund, uint256 amount, uint256 period) external;

    /**
     * @notice Retrieves tokens from staking
     * @param stakeId IDs of stake
     */
    function unstake(uint256 stakeId) external;

    /**
     * @notice Returns all accounts with active stakes in all registered funds
     * @return Accounts with active stakes
     */
    function getStakingAccounts() external view returns (address[] memory);

    /**
     * @notice Registers investment fund in staking contract
     * @dev Staking contract makes external calls only to funds registered by owner to avoid calling possibly harmful entities
     * @param fund Address of investment fund
     */
    function registerFund(address fund) external;

    /**
     * @notice Unregisters investment fund from staking contract
     * @param fund Address of investment fund
     */
    function unregisterFund(address fund) external;

    /**
     * @notice Returns all funds registered in contract
     * @return Funds registered in contract
     */
    function getRegisteredFunds() external view returns (address[] memory);

    /**
     * @notice Returns discount for wallet in current timestamp
     * @param account Address of wallet for which to return discount
     * @param fund Address of investment fund
     */
    function getDiscount(address account, address fund) external view returns (uint256);

    /**
     * @notice Returns discount for wallet in specified timestamp
     * @param account Address of wallet for which to return discount
     * @param fund Address of investment fund
     * @param timestamp Timestamp to return discount on
     */
    function getDiscountInTimestamp(address account, address fund, uint256 timestamp) external view returns (uint256);

    /**
     * @notice Returns discount for wallet in specified timestamp
     * @param account Address of wallet for which to return discount
     * @param fund Address of investment fund
     * @param amountInUsdc USDC equivalent of staked amount
     * @param start Timestamp in which potential staking starts
     * @param period Staking period
     * @param timestamp Timestamp to return discount on
     */
    function getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        uint256 start,
        uint256 period,
        uint256 timestamp
    ) external view returns (uint256);
}
