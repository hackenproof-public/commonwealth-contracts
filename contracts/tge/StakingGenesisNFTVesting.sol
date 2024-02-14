// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStakingGenesisNFTVesting} from "../interfaces/IStakingGenesisNFTVesting.sol";
import {IEmergencyWithdrawal} from "../interfaces/IEmergencyWithdrawal.sol";

error StakingGenesisNFTVesting__OwnerZeroAddress();
error StakingGenesisNFTVesting__WlthZeroAddress();
error StakingGenesisNFTVesting__DistributionNotStarted();
error StakingGenesisNFTVesting__NotEnoughTokens();
error StakingGenesisNFTVesting__NoRewardsForUser(address account);
error StakingGenesisNFTVesting__RewardsTooHigh(uint256 allocation, uint256 totalRewards);
error StakingGenesisNFTVesting__EmergencyWithdrawalLocked();

/**
 * @title StakingGenesisNFTVesting
 * @notice This contract manages the vesting of rewards for Staking Genesis NFTs.
 */
contract StakingGenesisNFTVesting is IStakingGenesisNFTVesting, IEmergencyWithdrawal, Ownable {
    using SafeERC20 for IERC20;

    /**
     * @notice Instance of the WLTH token contract.
     */
    IERC20 private immutable i_wlth;

    /**
     * @notice Allocation amount for rewards.
     */
    uint256 private immutable i_allocation;

    /**
     * @notice Timestamp when reward distribution starts.
     */
    uint256 private immutable i_distributionStartTimestamp;

    /**
     * @notice Timestamp when emergency withdrawal is unlocked.
     */
    uint256 private i_emergencyWithdrawalUnlockTimestamp;

    /**
     * @notice Total amount of rewards released.
     */
    uint256 private s_releasedAmount;

    /**
     * @notice Total amount of rewards allocated.
     */
    uint256 private s_totalRewards;

    /**
     * @notice Mapping to track whether user claimed rewards.
     */
    mapping(address => bool) private s_userClaimed;

    /**
     * @notice Mapping to store Series 1 rewards allocated to users.
     */
    mapping(address => uint256) private s_series1Rewards;

    /**
     * @notice Mapping to store Series 2 rewards allocated to users.
     */
    mapping(address => uint256) private s_series2Rewards;

    /**
     * @notice Event emitted when rewards are released.
     */
    event Released(address indexed beneficiary, uint256 indexed amount);

    constructor(
        address _owner,
        address _wlth,
        uint256 _allocation,
        uint256 _distributionStartTimestamp,
        uint256 _emergencyWithdrawalUnlockTimestamp
    ) {
        if (_owner == address(0)) revert StakingGenesisNFTVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert StakingGenesisNFTVesting__WlthZeroAddress();

        i_wlth = IERC20(_wlth);
        i_allocation = _allocation;
        i_distributionStartTimestamp = _distributionStartTimestamp;
        i_emergencyWithdrawalUnlockTimestamp = _emergencyWithdrawalUnlockTimestamp;
        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function release() external override {
        if (block.timestamp < i_distributionStartTimestamp) revert StakingGenesisNFTVesting__DistributionNotStarted();

        uint256 amount = releaseableAmount(msg.sender);
        if (amount == 0) revert StakingGenesisNFTVesting__NoRewardsForUser(msg.sender);
        if (amount > i_wlth.balanceOf(address(this))) revert StakingGenesisNFTVesting__NotEnoughTokens();

        s_releasedAmount += amount;
        s_userClaimed[msg.sender] = true;

        i_wlth.safeTransfer(msg.sender, amount);

        emit Released(msg.sender, amount);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function setRewards(Rewards[] memory _rewards) external override onlyOwner {
        uint256 rewards = s_totalRewards;
        for (uint256 i; i < _rewards.length; ) {
            s_series1Rewards[_rewards[i].account] = _rewards[i].series1Rewards;
            s_series2Rewards[_rewards[i].account] = _rewards[i].series2Rewards;

            rewards += _rewards[i].series1Rewards + _rewards[i].series2Rewards;

            if (rewards > i_allocation) revert StakingGenesisNFTVesting__RewardsTooHigh(i_allocation, rewards);

            unchecked {
                i++;
            }
        }

        s_totalRewards = rewards;
    }

    /**
     * @inheritdoc IEmergencyWithdrawal
     */
    function emergencyWithdraw(address _account) external override onlyOwner {
        if (block.timestamp < i_emergencyWithdrawalUnlockTimestamp)
            revert StakingGenesisNFTVesting__EmergencyWithdrawalLocked();
        i_wlth.safeTransfer(_account, i_wlth.balanceOf(address(this)));

        emit EmergencyWithdrawal(_account, i_wlth.balanceOf(address(this)));
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function releaseableAmount(address _account) public view override returns (uint256) {
        return s_userClaimed[_account] ? 0 : s_series1Rewards[_account] + s_series2Rewards[_account];
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function wlth() external view override returns (address) {
        return address(i_wlth);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function allocation() external view override returns (uint256) {
        return i_allocation;
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function distributionStartTimestamp() external view override returns (uint256) {
        return i_distributionStartTimestamp;
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function releasedAmount() external view override returns (uint256) {
        return s_releasedAmount;
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function totalRewards() external view override returns (uint256) {
        return s_totalRewards;
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function userClaimed(address _account) external view override returns (bool) {
        return s_userClaimed[_account];
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function series1Rewards(address _account) external view override returns (uint256) {
        return s_series1Rewards[_account];
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function series2Rewards(address _account) external view override returns (uint256) {
        return s_series2Rewards[_account];
    }

    /**
     * @inheritdoc IEmergencyWithdrawal
     */
    function emergencyWithdrawalUnlockTimestamp() external view override returns (uint256) {
        return i_emergencyWithdrawalUnlockTimestamp;
    }
}
