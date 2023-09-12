// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IStakingWlth {
    struct Period {
        uint128 start;
        uint128 duration;
    }

    struct Position {
        uint256 id;
        address staker;
        address fund;
        uint128 amountInWlth;
        uint128 amountInUsdc;
        uint256 investment;
        Period period;
        bool isCRP; // whether staked in Capital Raise Period
        uint256 unstakedEnded; // unstaked tokens that were realeased due to staking end - have no impact on discount calculations
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
     * @notice Emitted when WLTH tokens are staked
     * @param caller Address of unstaking account
     * @param fund Address of investment fund that unstaking concerns
     * @param amount Amount of unstaked WLTH
     */
    event TokensUnstaked(address indexed caller, address indexed fund, uint256 amount);

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
     * @param fund Address of investment fund
     * @param amount Amount of tokens to unstake
     */
    function unstake(address fund, uint256 amount) external;

    /**
     * @notice Returns all accounts with active stakes in all registered funds
     * @return Accounts with active stakes
     */
    function getStakingAccounts() external view returns (address[] memory);

    /**
     * @notice Returns staking positions for account in fund
     * @param account Address of account
     * @param fund Address of investment fund
     * @return Staking positions for account in fund
     */
    function getStakingPositionsInFund(address account, address fund) external view returns (uint256[] memory);

    /**
     * @notice Returns staking position details
     * @param position Index of stakting position
     * @return Staking position details
     */
    function getPositionDetails(uint256 position) external view returns (Position memory);

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
     * @param period Staking period
     * @param timestamp Timestamp to return discount on
     */
    function getEstimatedDiscount(
        address account,
        address fund,
        uint256 amountInUsdc,
        Period calldata period,
        uint256 timestamp
    ) external view returns (uint256);

    /**
     * @notice Returns early-unstaking penalty that would be paid after unstaking `amount` tokens
     * @param account Address of wallet which unstakes tokens
     * @param fund Address of investment fund
     * @param amount Amount of tokens to be unstaked
     */
    function getPenalty(address account, address fund, uint256 amount) external view returns (uint256);

    /**
     * @notice Returns number of tokens staked by account in fund
     * @param account Address of account
     * @param fund Address of investment fund
     * @return Number of tokens staked by account in fund
     */
    function getStakedTokensInFund(address account, address fund) external view returns (uint256);

    /**
     * @notice Returns number of tokens staked by account in all funds
     * @param account Address of account
     * @return Number of tokens staked by account in all funds
     */
    function getStakedTokens(address account) external view returns (uint256);

    /**
     * @notice Returns number of tokens that can by claimed with no penalty
     * @param account Address of wallet
     * @param fund Address of investment fund
     */
    function getReleasedTokens(address account, address fund) external view returns (uint256);

    /**
     * @notice Returns number of tokens that can be claimed with no penalty due to position end
     * @param account Address of wallet
     * @param fund Address of investment fund
     */
    function getReleasedTokensFromEndedPositions(address account, address fund) external view returns (uint256);

    /**
     * @notice Returns number of tokens that can be claimed with no penalty due to investment size decrease
     * @param account Address of wallet
     * @param fund Address of investment fund
     */
    function getReleasedTokensFromOpenPositions(address account, address fund) external view returns (uint256);

    /**
     * @notice Returns aggregated period of all staking positions for account in fund
     * @param account Address of wallet
     * @param fund Address of investment fund
     * @return Total staking period
     */
    function getTotalStakingPeriod(address account, address fund) external view returns (Period memory);
}
