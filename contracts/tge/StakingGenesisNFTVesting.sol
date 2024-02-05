// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IStakingGenesisNFTVesting.sol";

error StakingGenesisNFTVesting__OwnerZeroAddress();
error StakingGenesisNFTVesting__WlthZeroAddress();
error StakingGenesisNFTVesting__DistributionNotStarted();
error StakingGenesisNFTVesting__NotEnoughTokens();
error StakingGenesisNFTVesting__NoRewardsForUser(address account);
error StakingGenesisNFTVesting__RewardsTooHigh(uint256 allocation, uint256 totalRewards);

contract StakingGenesisNFTVesting is IStakingGenesisNFTVesting, Ownable {
    using SafeERC20 for IERC20;

    IERC20 private immutable i_wlth;

    uint256 private immutable i_allocation;

    uint256 private immutable i_distributionStartTimestamp;

    uint256 private s_releasedAmount;

    uint256 private s_totalRewards;

    mapping(address => bool) private s_userClaimed;

    mapping(address => uint256) private s_series1Rewards;

    mapping(address => uint256) private s_series2Rewards;

    event Released(address indexed beneficiary, uint256 indexed amount);

    constructor(address _owner, address _wlth, uint256 _allocation, uint256 _distributionStartTimestamp) {
        if (_owner == address(0)) revert StakingGenesisNFTVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert StakingGenesisNFTVesting__WlthZeroAddress();

        i_wlth = IERC20(_wlth);
        i_allocation = _allocation;
        i_distributionStartTimestamp = _distributionStartTimestamp;
        _transferOwnership(_owner);
    }

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

    function emergencyWithdraw(address _account) external override onlyOwner {
        i_wlth.safeTransfer(_account, i_wlth.balanceOf(address(this)));
    }

    function releaseableAmount(address _account) public view override returns (uint256) {
        return s_userClaimed[_account] ? 0 : s_series1Rewards[_account] + s_series2Rewards[_account];
    }

    function wlth() external view override returns (address) {
        return address(i_wlth);
    }

    function allocation() external view override returns (uint256) {
        return i_allocation;
    }

    function distributionStartTimestamp() external view override returns (uint256) {
        return i_distributionStartTimestamp;
    }

    function releasedAmount() external view override returns (uint256) {
        return s_releasedAmount;
    }

    function totalRewards() external view override returns (uint256) {
        return s_totalRewards;
    }

    function userClaimed(address _account) external view override returns (bool) {
        return s_userClaimed[_account];
    }

    function series1Rewards(address _account) external view override returns (uint256) {
        return s_series1Rewards[_account];
    }

    function series2Rewards(address _account) external view override returns (uint256) {
        return s_series2Rewards[_account];
    }
}
