// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStakingGenesisNFTVesting} from "../interfaces/IStakingGenesisNFTVesting.sol";
import {ILeftoversWithdrawal} from "../interfaces/ILeftoversWithdrawal.sol";

error StakingGenesisNFTVesting__OwnerZeroAddress();
error StakingGenesisNFTVesting__WlthZeroAddress();
error StakingGenesisNFTVesting__DistributionNotStarted();
error StakingGenesisNFTVesting__NotEnoughTokens();
error StakingGenesisNFTVesting__NoRewardsForUser(address account);
error StakingGenesisNFTVesting__RewardsTooHigh(uint256 allocation, uint256 totalRewards);
error StakingGenesisNFTVesting__LeftoversWithdrawalLocked();
error StakingGenesisNFTVesting__WalletLost(address wallet);
error StakingGenesisNFTVesting__WalletAlreadyLost(address wallet);
error StakingGenesisNFTVesting__WalletNotLost(address wallet);

/**
 * @title StakingGenesisNFTVesting
 * @notice This contract manages the vesting of rewards for Staking Genesis NFTs.
 */
contract StakingGenesisNFTVesting is IStakingGenesisNFTVesting, ILeftoversWithdrawal, Ownable {
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
     * @notice Timestamp when leftovers withdrawal is unlocked.
     */
    uint256 private i_leftoversUnlockTimestamp;

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
     * @notice Event emitted when rewards are released.
     */
    event Released(address indexed beneficiary, uint256 indexed amount);

    /**
     * @notice Event emitted when rewards are set for multiple accounts.
     */
    event RewardsSet(Rewards[] rewards);

    /**
     * @notice Event emitted when a wallet is set as lost.
     */
    event LostWalletSet(address indexed wallet);

    /**
     * @notice Event emitted when a wallet is reset from lost status.
     */
    event LostWalletReseted(address indexed wallet);

    /**
     * @notice Event emitted when emergency withdrawal is performed.
     */
    event EmergencyWithdrawalPerformed(address indexed from, address indexed to);

    /**
     * @notice Contract constructor.
     * @param _owner Address of the owner of the contract.
     * @param _wlth Address of the WLTH token contract.
     * @param _allocation Allocation amount for rewards.
     * @param _distributionStartTimestamp Timestamp when reward distribution starts.
     * @param _leftoversUnlockTimestamp Timestamp when leftover tokens can be withdrawn.
     */
    constructor(
        address _owner,
        address _wlth,
        uint256 _allocation,
        uint256 _distributionStartTimestamp,
        uint256 _leftoversUnlockTimestamp
    ) {
        if (_owner == address(0)) revert StakingGenesisNFTVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert StakingGenesisNFTVesting__WlthZeroAddress();

        i_wlth = IERC20(_wlth);
        i_allocation = _allocation;
        i_distributionStartTimestamp = _distributionStartTimestamp;
        i_leftoversUnlockTimestamp = _leftoversUnlockTimestamp;
        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function release() external override {
        if (s_walletAccessLost[msg.sender]) revert StakingGenesisNFTVesting__WalletLost(msg.sender);
        release(msg.sender, msg.sender);
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function setRewards(Rewards[] calldata _rewards) external override onlyOwner {
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
    function emergencyWithdraw(address _from, address _to) external override onlyOwner {
        if (!s_walletAccessLost[_from]) revert StakingGenesisNFTVesting__WalletNotLost(_from);

        emit EmergencyWithdrawalPerformed(_from, _to);

        release(_from, _to);
    }

    /**
     * @inheritdoc ILeftoversWithdrawal
     */
    function withdrawLeftovers(address _account) external override onlyOwner {
        if (block.timestamp < i_leftoversUnlockTimestamp) revert StakingGenesisNFTVesting__LeftoversWithdrawalLocked();
        emit LeftoversWithdrawn(_account, i_wlth.balanceOf(address(this)));

        i_wlth.safeTransfer(_account, i_wlth.balanceOf(address(this)));
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
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function releaseableAmount(address _account) public view override returns (uint256) {
        return s_userClaimed[_account] ? 0 : s_series1Rewards[_account] + s_series2Rewards[_account];
    }

    /**
     * @inheritdoc ILeftoversWithdrawal
     */
    function leftoversUnlockTimestamp() external view override returns (uint256) {
        return i_leftoversUnlockTimestamp;
    }

    /**
     * @inheritdoc IStakingGenesisNFTVesting
     */
    function lostWallet(address _wallet) external view override returns (bool) {
        return s_walletAccessLost[_wallet];
    }

    function release(address _from, address _to) private {
        if (block.timestamp < i_distributionStartTimestamp) revert StakingGenesisNFTVesting__DistributionNotStarted();

        uint256 amount = releaseableAmount(_from);
        if (amount == 0) revert StakingGenesisNFTVesting__NoRewardsForUser(_from);
        if (amount > i_wlth.balanceOf(address(this))) revert StakingGenesisNFTVesting__NotEnoughTokens();

        s_releasedAmount += amount;
        s_userClaimed[_from] = true;

        emit Released(_to, amount);

        i_wlth.safeTransfer(_to, amount);
    }
}
