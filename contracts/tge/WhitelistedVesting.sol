// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWlth} from "../interfaces/IWlth.sol";
import {IWhitelistedVesting} from "../interfaces/IWhitelistedVesting.sol";
import {IWithdrawal} from "../interfaces/IWithdrawal.sol";
import {MAX_GAMIFICATION_PENALTY, BASIS_POINT_DIVISOR} from "../libraries/Constants.sol";

error WhitelistedVesting__VestingNotStarted();
error WhitelistedVesting__OwnerZeroAddress();
error WhitelistedVesting__WlthZeroAddress();
error WhitelistedVesting__CommunityFundZeroAddress();
error WhitelistedVesting__InvalidDistributionArrayAllocation();
error WhitelistedVesting__NotEnoughTokensVested(uint256 requested, uint256 currentReleaseableAmount);
error WhitelistedVesting__NotEnoughTokensOnContract();
error WhitelistedVesting__InvalidDistributionArrayLength();
error WhitelistedVesting__TotalAllocationPerCadenceMismatch();
error WhitelistedVesting__TotalAllocationMismatch();
error WhitelistedVesting__NotEnoughTokensAllocated();
error WhitelistedVesting__GamificationNotEnabled();
error WhitelistedVesting__LeftoversWithdrawalLocked();
error WhitelistedVesting__NoSurplus(uint256 balance, uint256 released, uint256 allocation);
error WhitelistedVesting__VestingStartTimestampAlreadyDefined();
error WhitelistedVesting__PastVestingStartTimestamp();
error WhitelistedVesting__PastCadenceModificationNotAllowed();
error WhitelistedVesting__InvalidSingleCadenceWalletAllocation();
error WhitelistedVesting__WalletClaimedWithPenalty();
error WhitelistedVesting__SameWalletAllocationForCadenceProvided();

/**
 * @title WhitelistedVesting
 * @notice Contract for vesting WLTH tokens
 */
contract WhitelistedVesting is ReentrancyGuard, Ownable, IWhitelistedVesting, IWithdrawal {
    using SafeERC20 for IERC20;

    /**
     * @notice Indicates if gamification (penalty) feature is active
     */
    bool private immutable i_gamification;

    /**
     * @notice WLTH contract token address
     */
    address private immutable i_wlth;

    /**
     * @notice Community Fund address
     */
    address private immutable i_communityFund;

    /**
     * @notice Cadences amount
     */
    uint256 private immutable i_cadenceAmount;

    /**
     * @notice Delay when leftover tokens can be withdrawn after the vesting is ended.
     */
    uint256 private immutable i_leftoversUnlockDelay;

    /**
     * @notice Total token allocation during vesting schedule
     */
    uint256 private immutable i_allocation;

    /**
     * @notice Total vesting duration in seconds
     */
    uint256 private immutable i_duration;

    /**
     * @notice Time after which the new tokens are released
     */
    uint256 private immutable i_cadence;

    /**
     * @notice Vesting start block's timestamp
     */
    uint256 private s_vestingStartTimestamp;

    /**
     * @notice amount of currently whitelisted addresses
     */
    uint256 private s_whitelistedAddressesAmount;

    /**
     * @notice amount of WLTH allocated to whitelisted wallets
     */
    uint256 private s_totalWalletsAllocation;

    /**
     * @notice Number of already released tokens
     */
    uint256 private s_released;

    /**
     * @notice total WLTH released by contract per cadence
     */
    uint256[] private s_tokenReleaseDistribution;

    /**
     * @notice total amount of WLTH tokens allocated to cadece, where key is cadence number
     */
    mapping(uint256 => uint256) private s_cadenceAllocation;

    /**
     * @notice Whitelisted wallets, where key is whitelisted wallet address
     */
    mapping(address => uint256) private s_whitelistedWalletReleased;

    /**
     * @notice WLTH allocation distribution per wallet
     */
    mapping(address => mapping(uint256 => uint256)) private s_distribution;

    /**
     * @notice Indicates if wallet has claimed with penalty
     */
    mapping(address => bool) private s_claimedWithPenalty;

    /**
     * @notice controls if function is enabled only in case of gamified vesting
     */
    modifier gamified() {
        if (!i_gamification) revert WhitelistedVesting__GamificationNotEnabled();
        _;
    }

    /**
     * @notice controls if function cannot be executed before vesting start timestamp
     */
    modifier afterVestingStart() {
        if (s_vestingStartTimestamp == 0 || block.timestamp < s_vestingStartTimestamp)
            revert WhitelistedVesting__VestingNotStarted();
        _;
    }

    /**
     * @notice Contract constructor.
     * @param _gamification Indicates if gamification (penalty) feature is active
     * @param _owner Contract owner
     * @param _wlth WLTH contract token address
     * @param _communityFund Community Fund address
     * @param _allocation Total token allocation during vesting schedule
     * @param _duration Total vesting duration in seconds
     * @param _cadence Time after which the new tokens are released
     * @param _leftoversUnlockDelay Delay when leftover tokens can be withdrawn after the vesting is ended.
     * @param _vestingStartTimestamp Vesting start block's timestamp
     * @param _tokenReleaseDistribution Array of token release distribution
     */
    constructor(
        bool _gamification,
        address _owner,
        address _wlth,
        address _communityFund,
        uint256 _allocation,
        uint256 _duration,
        uint256 _cadence,
        uint256 _leftoversUnlockDelay,
        uint256 _vestingStartTimestamp,
        uint256[] memory _tokenReleaseDistribution
    ) {
        if (_owner == address(0)) revert WhitelistedVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert WhitelistedVesting__WlthZeroAddress();
        if (_communityFund == address(0)) revert WhitelistedVesting__CommunityFundZeroAddress();
        if (_vestingStartTimestamp > 0 && _vestingStartTimestamp < block.timestamp)
            revert WhitelistedVesting__PastVestingStartTimestamp();
        uint256 cadencesAmount = _duration / _cadence;
        if (cadencesAmount + 1 != _tokenReleaseDistribution.length)
            revert WhitelistedVesting__InvalidDistributionArrayLength();
        if (_tokenReleaseDistribution[_tokenReleaseDistribution.length - 1] != _allocation)
            revert WhitelistedVesting__InvalidDistributionArrayAllocation();

        i_wlth = _wlth;
        i_allocation = _allocation;
        i_duration = _duration;
        i_cadence = _cadence;
        i_gamification = _gamification;
        i_communityFund = _communityFund;
        i_leftoversUnlockDelay = _leftoversUnlockDelay;
        i_cadenceAmount = _duration / _cadence;
        s_vestingStartTimestamp = _vestingStartTimestamp;
        s_tokenReleaseDistribution = _tokenReleaseDistribution;
        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function release(uint256 _amount, address _beneficiary) external override afterVestingStart {
        _release(_amount, _beneficiary, false);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function releaseWithPenalty(uint256 _amount, address _beneficiary) external override gamified afterVestingStart {
        _release(_amount, _beneficiary, true);
        s_claimedWithPenalty[_beneficiary] = true;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function deactivateAddress(address _wallet) external override onlyOwner {
        if (s_claimedWithPenalty[_wallet]) {
            revert WhitelistedVesting__WalletClaimedWithPenalty();
        }
        uint256 cadenceNumber = _actualCadence();
        s_totalWalletsAllocation -= (s_distribution[_wallet][i_cadenceAmount] - s_distribution[_wallet][cadenceNumber]);
        for (uint i = cadenceNumber + 1; i <= i_cadenceAmount; ) {
            s_cadenceAllocation[i] = s_cadenceAllocation[i] - s_distribution[_wallet][i];
            s_distribution[_wallet][i] = cadenceNumber == 0 ? 0 : s_distribution[_wallet][i - 1];
            unchecked {
                i++;
            }
        }

        uint256 addressesAmount = s_whitelistedAddressesAmount;

        s_whitelistedAddressesAmount--;

        emit AddressDeactivated(_wallet, addressesAmount, addressesAmount - 1);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function whitelistedWalletSetup(
        address _whitelistedAddress,
        uint256[] calldata _distribution
    ) external override onlyOwner {
        if (s_claimedWithPenalty[_whitelistedAddress]) {
            revert WhitelistedVesting__WalletClaimedWithPenalty();
        }
        if (_distribution.length != i_cadenceAmount + 1) revert WhitelistedVesting__InvalidDistributionArrayLength();
        uint256 walletAllocation = _distribution[_distribution.length - 1];
        if (walletAllocation > i_allocation - s_totalWalletsAllocation)
            revert WhitelistedVesting__TotalAllocationMismatch();

        for (uint i; i < _distribution.length; ) {
            if (s_cadenceAllocation[i] + _distribution[i] > s_tokenReleaseDistribution[i])
                revert WhitelistedVesting__TotalAllocationPerCadenceMismatch();
            unchecked {
                i++;
            }
        }

        for (uint i; i < _distribution.length - 1; ) {
            if (_distribution[i] > _distribution[i + 1])
                revert WhitelistedVesting__InvalidDistributionArrayAllocation();
            unchecked {
                i++;
            }
        }

        s_whitelistedAddressesAmount++;
        s_totalWalletsAllocation += walletAllocation;

        for (uint i; i < _distribution.length; ) {
            s_distribution[_whitelistedAddress][i] = _distribution[i];
            s_cadenceAllocation[i] = s_cadenceAllocation[i] + _distribution[i];
            unchecked {
                i++;
            }
        }

        emit WhitelistedWalletSetup(_whitelistedAddress, walletAllocation, _distribution);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function setWalletAllocationForCadence(
        address _wallet,
        uint256 _cadenceNumber,
        uint256 _amount
    ) external override onlyOwner {
        if (s_claimedWithPenalty[_wallet]) revert WhitelistedVesting__WalletClaimedWithPenalty();
        uint256 walletAllocationBeforeChange = s_distribution[_wallet][_cadenceNumber];
        if (walletAllocationBeforeChange == _amount)
            revert WhitelistedVesting__SameWalletAllocationForCadenceProvided();
        if (block.timestamp >= s_vestingStartTimestamp && _actualCadence() >= _cadenceNumber)
            revert WhitelistedVesting__PastCadenceModificationNotAllowed();
        uint256 givenCadenceAllocation = s_cadenceAllocation[_cadenceNumber];
        if (givenCadenceAllocation - walletAllocationBeforeChange + _amount >= _vestedAmountToCadence(_cadenceNumber))
            revert WhitelistedVesting__TotalAllocationPerCadenceMismatch();
        if (
            (_cadenceNumber == 0 && _amount > s_distribution[_wallet][1]) ||
            (_cadenceNumber == i_cadenceAmount && _amount < s_distribution[_wallet][_cadenceNumber - 1]) ||
            (_cadenceNumber > 0 &&
                _cadenceNumber < i_cadenceAmount &&
                (_amount < s_distribution[_wallet][_cadenceNumber - 1] ||
                    _amount > s_distribution[_wallet][_cadenceNumber + 1]))
        ) {
            revert WhitelistedVesting__InvalidSingleCadenceWalletAllocation();
        }
        s_distribution[_wallet][_cadenceNumber] = _amount;
        s_cadenceAllocation[_cadenceNumber] = givenCadenceAllocation - walletAllocationBeforeChange + _amount;
        s_totalWalletsAllocation = s_totalWalletsAllocation - walletAllocationBeforeChange + _amount;

        emit CadenceAllocationForWalletChanged(_wallet, _cadenceNumber, walletAllocationBeforeChange, _amount);
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawLeftovers(address _wallet) external override onlyOwner {
        if (s_vestingStartTimestamp + i_duration + i_leftoversUnlockDelay > block.timestamp)
            revert WhitelistedVesting__LeftoversWithdrawalLocked();

        emit LeftoversWithdrawn(_wallet, IERC20(i_wlth).balanceOf(address(this)));

        IERC20(i_wlth).safeTransfer(_wallet, IERC20(i_wlth).balanceOf(address(this)));
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawSurplus(address _wallet) external override onlyOwner {
        uint256 balance = IERC20(i_wlth).balanceOf(address(this));
        uint256 alreadyReleased = s_released;

        if (balance + alreadyReleased <= i_allocation)
            revert WhitelistedVesting__NoSurplus(balance, alreadyReleased, i_allocation);

        uint256 surplus = balance + alreadyReleased - i_allocation;

        emit SurplusWithdrawn(_wallet, surplus);

        IERC20(i_wlth).safeTransfer(_wallet, surplus);
    }


    /**
     * @inheritdoc IWhitelistedVesting
     */
    function setVestingStartTimestamp(uint256 _timestamp) external override onlyOwner {
        if (s_vestingStartTimestamp != 0) revert WhitelistedVesting__VestingStartTimestampAlreadyDefined();
        if (_timestamp < block.timestamp) revert WhitelistedVesting__PastVestingStartTimestamp();

        s_vestingStartTimestamp = _timestamp;

        emit VestingStartTimestampSetted(_timestamp);
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function leftoversUnlockDelay() external view override returns (uint256) {
        return i_leftoversUnlockDelay;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function penalty(uint256 _amount, address _beneficiary) external view override returns (uint256) {
        return _calculatePenalty(_amount, _beneficiary);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function releaseableAmount() external view override returns (uint256) {
        if (block.timestamp < s_vestingStartTimestamp) {
            return 0;
        } else {
            return s_tokenReleaseDistribution[_actualCadence()] - s_released;
        }
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function wlth() external view override returns (address) {
        return i_wlth;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function duration() external view override returns (uint256) {
        return i_duration;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function cadence() external view override returns (uint256) {
        return i_cadence;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function vestingStartTimestamp() external view override returns (uint256) {
        return s_vestingStartTimestamp;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function allocation() external view override returns (uint256) {
        return i_allocation;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function released() external view override returns (uint256) {
        return s_released;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function whitelistedAddressesAmount() external view override returns (uint256) {
        return s_whitelistedAddressesAmount;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function communityFund() external view override returns (address) {
        return i_communityFund;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function tokenReleaseDistribution() external view override returns (uint256[] memory) {
        return s_tokenReleaseDistribution;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function gamification() external view override returns (bool) {
        return i_gamification;
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function vestedAmountPerWallet(address _wallet) external view override returns (uint256) {
        return _vestedAmountPerWallet(_wallet);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function releaseableAmountPerWallet(address _wallet) external view override returns (uint256) {
        return _releaseableAmountPerWallet(_wallet);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function walletAllocationForCadence(
        address _wallet,
        uint256 _cadenceNumber
    ) external view override returns (uint256) {
        return s_distribution[_wallet][_cadenceNumber];
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function vestedAmountToCadence(uint256 _cadence) external view override returns (uint256) {
        return _vestedAmountToCadence(_cadence);
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function vestedAmount() external view returns (uint256) {
        if (block.timestamp < s_vestingStartTimestamp) {
            return 0;
        } else {
            return s_tokenReleaseDistribution[_actualCadence()];
        }
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function actualCadence() external view override returns (uint256) {
        return _actualCadence();
    }

    /**
     * @inheritdoc IWhitelistedVesting
     */
    function releasedAmountPerWallet(address _wallet) external view override returns (uint256) {
        return s_whitelistedWalletReleased[_wallet];
    }

    function _calculatePenalty(
        uint256 _amount,
        address _beneficiary
    ) private view gamified afterVestingStart returns (uint256) {
        uint256 vested = _vestedAmountPerWallet(_beneficiary);
        uint256 slashingPool = _amount <= vested ? 0 : _amount - vested;

        if (slashingPool == 0) return 0;
        return
            (slashingPool * MAX_GAMIFICATION_PENALTY * (i_cadenceAmount - _actualCadence())) /
            i_cadenceAmount /
            BASIS_POINT_DIVISOR;
    }

    function _vestedAmountPerWallet(address _wallet) private view returns (uint256) {
        if (block.timestamp < s_vestingStartTimestamp) {
            return 0;
        } else {
            return
                s_claimedWithPenalty[_wallet]
                    ? s_distribution[_wallet][i_cadenceAmount]
                    : s_distribution[_wallet][_actualCadence()];
        }
    }

    function _releaseableAmountPerWallet(address _wallet) private view returns (uint256) {
        uint256 alreadyReleased = s_whitelistedWalletReleased[_wallet];
        uint256 vested = _vestedAmountPerWallet(_wallet);
        return alreadyReleased < vested ? vested - alreadyReleased : 0;
    }

    function _actualCadence() private view returns (uint256) {
        uint256 cadenceNumber = block.timestamp < s_vestingStartTimestamp
            ? 0
            : (block.timestamp - s_vestingStartTimestamp) / i_cadence;
        return cadenceNumber < i_cadenceAmount ? cadenceNumber : i_cadenceAmount;
    }

    function _vestedAmountToCadence(uint256 _cadence) private view returns (uint256) {
        return s_tokenReleaseDistribution[_cadence];
    }

    function _release(uint256 _amount, address _beneficiary, bool _penalty) private {
        uint256 availableTokensAmount = s_distribution[_beneficiary][i_cadenceAmount] -
            s_whitelistedWalletReleased[_beneficiary];
        uint256 toRelease;
        if (!_penalty) {
            uint256 currentReleaseableAmount = _releaseableAmountPerWallet(_beneficiary);
            if (_amount > currentReleaseableAmount)
                revert WhitelistedVesting__NotEnoughTokensVested(_amount, currentReleaseableAmount);
            toRelease = _amount;
        } else toRelease = availableTokensAmount;
        if (IERC20(i_wlth).balanceOf(address(this)) < (_penalty ? availableTokensAmount : _amount))
            revert WhitelistedVesting__NotEnoughTokensOnContract();

        s_released += toRelease;
        s_whitelistedWalletReleased[_beneficiary] += toRelease;

        uint256 penaltyAmount = _penalty ? _calculatePenalty(toRelease, _beneficiary) : 0;
        emit Released(_beneficiary, toRelease, penaltyAmount);
        IERC20(i_wlth).safeTransfer(_beneficiary, toRelease - penaltyAmount);

        if (penaltyAmount > 0) {
            IWlth(i_wlth).burn((penaltyAmount * 99) / 100);
            IERC20(i_wlth).safeTransfer(i_communityFund, penaltyAmount / 100);
        }
    }
}
