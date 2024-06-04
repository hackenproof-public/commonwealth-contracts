// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import {OwnablePausable} from "./OwnablePausable.sol";
import {IWlth} from "./interfaces/IWlth.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {IWlthBonusStaking} from "./interfaces/IWlthBonusStaking.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

error WlthBonusStaking__StakingPeriodNotActive();
error WlthBonusStaking__CannotStakeZeroTokens();
error WlthBonusStaking__NoStakedTokens();
error WlthBonusStaking__WlthZeroAddress();
error WlthBonusStaking__WrongStakingStartTimestamp();
error WlthBonusStaking__WrongTotalRewardValue();
error WlthBonusStaking__ClaimRewardPeriodNotActive();
error WlthBonusStaking__CommunityFundZeroAddress();
error WlthBonusStaking__OwnerAccountZeroAddress();
error WlthBonusStaking__WrongStakingDuration();

contract WlthBonusStaking is IWlthBonusStaking, OwnablePausable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Address of the WLTH token
     */
    address private s_wlth;

    /**
     * @notice Address of the community fund
     */
    address private s_communityFund;

    /**
     * @notice Staking start timestamp
     */
    uint256 private s_stakingStartTimestamp;

    /**
     * @notice Staking end timestamp
     */
    uint256 private s_stakingEndTimestamp;

    /**
     * @notice Staking duration
     */
    uint256 private s_stakingDuration;

    /**
     * @notice Total reward amount
     */
    uint256 private s_totalReward;

    /**
     * @notice Total staked amount
     */
    uint256 private s_totalStaked;

    /**
     * @notice Stake amount for each user
     */
    mapping(address => uint256) private s_stakes;

    /**
     * @notice Check if the staking period is active
     */
    modifier stakingActive() {
        if (
            s_stakingStartTimestamp == 0 ||
            block.timestamp < s_stakingStartTimestamp ||
            block.timestamp >= s_stakingEndTimestamp
        ) {
            revert WlthBonusStaking__StakingPeriodNotActive();
        }
        _;
    }

    /**
     * @notice Check if the claim reward period is active
     */
    modifier claimRewardActive() {
        if (s_stakingEndTimestamp == 0 || block.timestamp < s_stakingEndTimestamp) {
            revert WlthBonusStaking__ClaimRewardPeriodNotActive();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    /**
     * @notice Initialize the contract
     * @param _owner Contract owner
     * @param _wlth The address of the WLTH token
     * @param _communityFund The address of the community fund
     * @param _stakingStartTimestamp The timestamp when staking starts
     * @param _stakingDuration The duration of the staking period
     * @param _totalReward The total reward amount
     */
    function initialize(
        address _owner,
        address _wlth,
        address _communityFund,
        uint256 _stakingStartTimestamp,
        uint256 _stakingDuration,
        uint256 _totalReward
    ) public initializer {
        if (_owner == address(0)) {
            revert WlthBonusStaking__OwnerAccountZeroAddress();
        }
        if (_wlth == address(0)) {
            revert WlthBonusStaking__WlthZeroAddress();
        }
        if (_communityFund == address(0)) {
            revert WlthBonusStaking__CommunityFundZeroAddress();
        }
        if (_totalReward == 0) {
            revert WlthBonusStaking__WrongTotalRewardValue();
        }
        __Context_init();
        __OwnablePausable_init(_owner);
        s_wlth = _wlth;
        s_communityFund = _communityFund;

        if (_stakingStartTimestamp > 0) {
            if (_stakingStartTimestamp < block.timestamp) {
                revert WlthBonusStaking__WrongStakingStartTimestamp();
            }
            if (_stakingDuration == 0) {
                revert WlthBonusStaking__WrongStakingDuration();
            }
            s_stakingDuration = _stakingDuration;
            s_stakingStartTimestamp = _stakingStartTimestamp;
            s_stakingEndTimestamp = _stakingStartTimestamp + _stakingDuration;
        }
        s_totalReward = _totalReward;
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function stake(uint256 _amount) external override stakingActive {
        if (_amount == 0) {
            revert WlthBonusStaking__CannotStakeZeroTokens();
        }

        uint256 fee = _amount / 100;
        uint256 amountAfterFee = _amount - fee;

        s_stakes[msg.sender] += amountAfterFee;
        s_totalStaked += amountAfterFee;

        emit Staked(msg.sender, amountAfterFee, fee, s_stakes[msg.sender]);

        IERC20Upgradeable(s_wlth).safeTransferFrom(msg.sender, address(this), amountAfterFee);
        IERC20Upgradeable(s_wlth).safeTransferFrom(msg.sender, s_communityFund, fee);
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function unstake() external override stakingActive {
        if (s_stakes[msg.sender] == 0) {
            revert WlthBonusStaking__NoStakedTokens();
        }

        uint256 stakedAmount = s_stakes[msg.sender];
        uint256 fee = stakedAmount / 100;
        uint256 amountAfterFee = stakedAmount - fee;

        s_totalStaked -= stakedAmount;
        s_stakes[msg.sender] = 0;

        emit Unstaked(msg.sender, amountAfterFee, fee);

        IERC20Upgradeable(s_wlth).safeTransfer(msg.sender, amountAfterFee);
        IERC20Upgradeable(s_wlth).safeTransfer(s_communityFund, fee);
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function claimReward() external override claimRewardActive {
        if (s_stakes[msg.sender] == 0) {
            revert WlthBonusStaking__NoStakedTokens();
        }

        RewardInfo memory rewardInfo = calculateRewardInfo(msg.sender);
        s_stakes[msg.sender] = 0;

        uint256 penaltyFee = rewardInfo.penalty / 100;
        uint256 rewardFee = rewardInfo.rewardAfterPenalty / 100;
        uint256 fee = penaltyFee + rewardFee;

        emit RewardsClaimed(
            msg.sender,
            rewardInfo.staked,
            rewardInfo.rewardAfterPenalty - rewardFee,
            rewardInfo.penalty - penaltyFee,
            rewardFee,
            penaltyFee
        );

        IERC20Upgradeable(s_wlth).safeTransfer(msg.sender, rewardInfo.staked);

        if (rewardInfo.rewardAfterPenalty > 0) {
            IERC20Upgradeable(s_wlth).safeTransfer(msg.sender, rewardInfo.rewardAfterPenalty - rewardFee);
        }

        if (rewardInfo.penalty > 0) {
            IWlth(s_wlth).burn(rewardInfo.penalty - penaltyFee);
        }

        if (fee > 0) {
            IERC20Upgradeable(s_wlth).safeTransfer(s_communityFund, fee);
        }
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function setStakingSchedule(uint256 _stakingStartTimestamp, uint256 _stakingDuration) external override onlyOwner {
        if (_stakingStartTimestamp == 0 || _stakingStartTimestamp < block.timestamp) {
            revert WlthBonusStaking__WrongStakingStartTimestamp();
        }
        if (_stakingDuration == 0) {
            revert WlthBonusStaking__WrongStakingDuration();
        }
        s_stakingStartTimestamp = _stakingStartTimestamp;
        s_stakingDuration = _stakingDuration;
        s_stakingEndTimestamp = _stakingStartTimestamp + _stakingDuration;

        emit StakingScheduleSet(_stakingStartTimestamp, s_stakingEndTimestamp);
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function wlth() external view override returns (address) {
        return s_wlth;
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function communityFund() external view override returns (address) {
        return s_communityFund;
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function stakingInfo() external view override returns (StakingInfo memory) {
        StakingInfo memory info;
        info.totalStaked = s_totalStaked;
        info.totalReward = s_totalReward;
        info.stakingStartTimestamp = s_stakingStartTimestamp;
        info.stakingEndTimestamp = s_stakingEndTimestamp;
        info.stakingDuration = s_stakingDuration;
        return info;
    }

    /**
     * @inheritdoc IWlthBonusStaking
     */
    function calculateRewardInfo(address _user) public view override returns (RewardInfo memory) {
        uint256 stakedAmount = s_stakes[_user];

        if (stakedAmount == 0) {
            return RewardInfo(0, 0, 0, 0);
        }

        RewardInfo memory rewardInfo;
        rewardInfo.staked = stakedAmount;

        if (block.timestamp < s_stakingEndTimestamp) {
            return rewardInfo;
        }

        uint256 maxUserReward = (s_totalReward * stakedAmount) / s_totalStaked;
        rewardInfo.maxReward = maxUserReward;
        uint duration = block.timestamp - s_stakingEndTimestamp;

        if (duration < 3 * 30 days) {
            rewardInfo.penalty = maxUserReward; // 100% penalty
        } else if (duration < 6 * 30 days) {
            rewardInfo.penalty = (maxUserReward * 75) / 100; // 75% penalty
        } else if (duration < 9 * 30 days) {
            rewardInfo.penalty = (maxUserReward * 50) / 100; // 50% penalty
        } else if (duration < 12 * 30 days) {
            rewardInfo.penalty = (maxUserReward * 25) / 100; // 25% penalty
        } else {
            rewardInfo.penalty = 0; // 0% penalty
        }

        rewardInfo.rewardAfterPenalty = rewardInfo.maxReward - rewardInfo.penalty;
        return rewardInfo;
    }

    uint256[48] private __gap;
}
