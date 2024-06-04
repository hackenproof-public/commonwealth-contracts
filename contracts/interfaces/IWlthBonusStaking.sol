// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

interface IWlthBonusStaking {
    /**
     * @notice Struct to store reward info
     */
    struct RewardInfo {
        uint256 staked;
        uint256 maxReward;
        uint256 penalty;
        uint256 rewardAfterPenalty;
    }

    /**
     * @notice Struct to store staking info
     */
    struct StakingInfo {
        uint256 totalStaked;
        uint256 totalReward;
        uint256 stakingStartTimestamp;
        uint256 stakingEndTimestamp;
        uint256 stakingDuration;
    }

    /**
     * @notice Emitted when user stakes tokens
     * @param user The user address
     * @param amount The amount of tokens staked
     * @param fee The fee amount
     * @param totalUserStake The total amount of tokens staked by the user
     */
    event Staked(address indexed user, uint256 indexed amount, uint256 indexed fee, uint256 totalUserStake);

    /**
     * @notice Emitted when user unstakes tokens
     * @param user The user address
     * @param amount The amount of tokens unstaked
     */
    event Unstaked(address indexed user, uint256 indexed amount, uint256 indexed fee);

    /**
     * @notice Emitted when user claims reward
     * @param user The user address
     * @param unstakedAmount The amount of tokens unstaked
     * @param reward The amount of reward claimed
     * @param penalty The amount of penalty
     * @param rewardFee The fee amount for the reward
     * @param penaltyFee The fee amount for the penalty
     */
    event RewardsClaimed(
        address indexed user,
        uint256 unstakedAmount,
        uint256 indexed reward,
        uint256 penalty,
        uint256 rewardFee,
        uint256 penaltyFee
    );

    /**
     * @notice Emitted when staking schedule is set
     * @param stakingStartTimestamp The timestamp when staking starts
     * @param stakingEndTimestamp The timestamp when staking ends
     */
    event StakingScheduleSet(uint256 indexed stakingStartTimestamp, uint256 indexed stakingEndTimestamp);

    /**
     * @notice Stake tokens
     * @param _amount The amount of tokens to stake
     */
    function stake(uint256 _amount) external;

    /**
     * @notice Unstake all user's tokens
     */
    function unstake() external;

    /**
     * @notice Claim rewards and caluculate penalty
     */
    function claimReward() external;

    /**
     * @notice Set staking schedule
     * @param _stakingStartTimestamp The timestamp when staking starts
     * @param _stakingDuration The duration of the staking period
     */
    function setStakingSchedule(uint256 _stakingStartTimestamp, uint256 _stakingDuration) external;

    /**
     * @notice Get the address of the WLTH token
     * @return The address of the WLTH token
     */
    function wlth() external view returns (address);

    /**
     * @notice Get the address of the community fund
     * @return The address of the community fund
     */
    function communityFund() external view returns (address);

    /**
     * @notice Get staking info
     * @return Staking info
     */
    function stakingInfo() external view returns (StakingInfo memory);

    /**
     * @notice Get reward info for the user
     * @param _user The user address
     * @return Reward info
     */
    function calculateRewardInfo(address _user) external view returns (RewardInfo memory);
}
