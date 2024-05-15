// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStakingGenesisNFTVesting} from "../interfaces/IStakingGenesisNFTVesting.sol";
import {IWithdrawal} from "../interfaces/IWithdrawal.sol";

error StakingGenesisNFTVesting__OwnerZeroAddress();
error StakingGenesisNFTVesting__WlthZeroAddress();
error StakingGenesisNFTVesting__AddressFromZeroAddress();
error StakingGenesisNFTVesting__AddressToZeroAddress();
error StakingGenesisNFTVesting__DistributionNotStarted();
error StakingGenesisNFTVesting__NotEnoughTokens();
error StakingGenesisNFTVesting__PastDistributionStartTimestamp();
error StakingGenesisNFTVesting__NoRewardsForUser(address account);
error StakingGenesisNFTVesting__RewardsTooHigh(uint256 allocation, uint256 totalRewards);
error StakingGenesisNFTVesting__DistributionStartTimestampAlreadySet();
error StakingGenesisNFTVesting__LeftoversWithdrawalLocked();
error StakingGenesisNFTVesting__WalletLost(address wallet);
error StakingGenesisNFTVesting__WalletAlreadyLost(address wallet);
error StakingGenesisNFTVesting__WalletNotLost(address wallet);
error StakingGenesisNFTVesting__NoSurplus(uint256 balance, uint256 released, uint256 allocation);

/**
 * @title StakingGenesisNFTVesting
 * @notice This contract manages the vesting of rewards for Staking Genesis NFTs.
 */
contract StakingGenesisNFTVesting is IStakingGenesisNFTVesting, IWithdrawal, Ownable {
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
     * @notice Delay when leftover tokens can be withdrawn after the vesting is ended.
     */
    uint256 private immutable i_leftoversUnlockDelay;

    /**
     * @notice Timestamp when reward distribution starts.
     */
    uint256 private s_distributionStartTimestamp;

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
     * @notice Mapping to store whether wallet access is lost.
     */
    mapping(address => bool) private s_walletAccessLost;

    /**
     * @notice Modifier to check if the reward distribution has started.
     */
    modifier distributionStarted() {
        if (s_distributionStartTimestamp == 0 || block.timestamp < s_distributionStartTimestamp)
            revert StakingGenesisNFTVesting__DistributionNotStarted();
        _;
    }

    /**
     * @notice Contract constructor.
     * @param _owner Address of the owner of the contract.
     * @param _wlth Address of the WLTH token contract.
     * @param _allocation Allocation amount for rewards.
     * @param _distributionStartTimestamp Timestamp when reward distribution starts.
     * @param _leftoversUnlockDelay Delay when leftover tokens can be withdrawn after the distribution is started.
     */
    constructor(
        address _owner,
        address _wlth,
        uint256 _allocation,
        uint256 _distributionStartTimestamp,
        uint256 _leftoversUnlockDelay
    ) {
        if (_owner == address(0)) revert StakingGenesisNFTVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert StakingGenesisNFTVesting__WlthZeroAddress();
        if (_distributionStartTimestamp > 0 && _distributionStartTimestamp < block.timestamp)
            revert StakingGenesisNFTVesting__PastDistributionStartTimestamp();

        i_wlth = IERC20(_wlth);
        i_allocation = _allocation;
        i_leftoversUnlockDelay = _leftoversUnlockDelay;
        s_distributionStartTimestamp = _distributionStartTimestamp;
        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function release() external override {
        if (s_walletAccessLost[msg.sender]) revert StakingGenesisNFTVesting__WalletLost(msg.sender);
        _release(msg.sender, msg.sender);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function setRewards(Rewards[] calldata _rewards) external override onlyOwner {
        uint256 rewards = s_totalRewards;
        for (uint256 i; i < _rewards.length; ) {
            rewards += _rewards[i].series1Rewards + _rewards[i].series2Rewards;

            if (rewards > i_allocation) revert StakingGenesisNFTVesting__RewardsTooHigh(i_allocation, rewards);

            s_series1Rewards[_rewards[i].account] = _rewards[i].series1Rewards;
            s_series2Rewards[_rewards[i].account] = _rewards[i].series2Rewards;

            unchecked {
                i++;
            }
        }

        s_totalRewards = rewards;

        emit RewardsSet(_rewards);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function setLostWallet(address _wallet) external override onlyOwner {
        if (s_walletAccessLost[_wallet]) revert StakingGenesisNFTVesting__WalletAlreadyLost(_wallet);
        s_walletAccessLost[_wallet] = true;

        emit LostWalletSet(_wallet);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function resetLostWallet(address _wallet) external override onlyOwner {
        if (!s_walletAccessLost[_wallet]) revert StakingGenesisNFTVesting__WalletNotLost(_wallet);
        s_walletAccessLost[_wallet] = false;

        emit LostWalletReseted(_wallet);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function setDistributionStartTimestamp(uint256 _timestamp) external override onlyOwner {
        if (s_distributionStartTimestamp != 0) revert StakingGenesisNFTVesting__DistributionStartTimestampAlreadySet();
        if (_timestamp < block.timestamp) revert StakingGenesisNFTVesting__PastDistributionStartTimestamp();
        s_distributionStartTimestamp = _timestamp;

        emit DistributionStartTimestampSet(_timestamp);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function emergencyWithdraw(address _from, address _to) external override onlyOwner {
        if (!s_walletAccessLost[_from]) revert StakingGenesisNFTVesting__WalletNotLost(_from);

        emit EmergencyWithdrawalPerformed(_from, _to);

        _release(_from, _to);
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawLeftovers(address _account) external override onlyOwner distributionStarted {
        if (block.timestamp < s_distributionStartTimestamp + i_leftoversUnlockDelay)
            revert StakingGenesisNFTVesting__LeftoversWithdrawalLocked();
        emit LeftoversWithdrawn(_account, i_wlth.balanceOf(address(this)));

        i_wlth.safeTransfer(_account, i_wlth.balanceOf(address(this)));
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawSurplus(address _wallet) external override onlyOwner {
        uint256 balance = i_wlth.balanceOf(address(this));
        uint256 alreadyReleased = s_releasedAmount;

        if (balance + alreadyReleased <= i_allocation)
            revert StakingGenesisNFTVesting__NoSurplus(balance, alreadyReleased, i_allocation);

        uint256 surplus = balance + alreadyReleased - i_allocation;

        emit SurplusWithdrawn(_wallet, surplus);

        i_wlth.safeTransfer(_wallet, surplus);
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
        return s_distributionStartTimestamp;
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
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function releaseableAmount(address _account) public view override returns (uint256) {
        return s_userClaimed[_account] ? 0 : s_series1Rewards[_account] + s_series2Rewards[_account];
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function leftoversUnlockDelay() external view override returns (uint256) {
        return i_leftoversUnlockDelay;
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function lostWallet(address _wallet) external view override returns (bool) {
        return s_walletAccessLost[_wallet];
    }

    function _release(address _from, address _to) private distributionStarted {
        if (_from == address(0)) revert StakingGenesisNFTVesting__AddressFromZeroAddress();
        if (_to == address(0)) revert StakingGenesisNFTVesting__AddressToZeroAddress();
        uint256 amount = releaseableAmount(_from);

        if (amount == 0) revert StakingGenesisNFTVesting__NoRewardsForUser(_from);
        if (amount > i_wlth.balanceOf(address(this))) revert StakingGenesisNFTVesting__NotEnoughTokens();

        s_releasedAmount += amount;
        s_userClaimed[_from] = true;

        emit Released(_to, amount);

        i_wlth.safeTransfer(_to, amount);
    }
}
