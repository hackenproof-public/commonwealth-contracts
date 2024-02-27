// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGeneisNFTMirror} from "../interfaces/IGenesisNFTMirror.sol";
import {IGenesisNFTVesting} from "../interfaces/IGenesisNFTVesting.sol";
import {IWithdrawal} from "../interfaces/IWithdrawal.sol";
import {IWlth} from "../interfaces/IWlth.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MAX_GAMIFICATION_PENALTY, BASIS_POINT_DIVISOR} from "../libraries/Constants.sol";

error GenesisNFTVesting__OwnerZeroAddress();
error GenesisNFTVesting__WlthZeroAddress();
error GenesisNFTVesting__CommunityFundZeroAddress();
error GenesisNFTVesting__GenesisNftSeries1MirrorZeroAddress();
error GenesisNFTVesting__GenesisNftSeries2MirrorZeroAddress();
error GenesisNFTVesting__NoNFTs(address wallet);
error GenesisNFTVesting__VestingNotStarted();
error GenesisNFTVesting__NotOwnerOfGenesisNFT(uint256 series, uint256 tokenId, address account);
error GenesisNFTVesting__NotEnoughTokensVested();
error GenesisNFTVesting__InsufficientWlthBalance();
error GenesisNFTVesting__NothingToRelease();
error GenesisNFTVesting__NFTNotExisted(uint256 series, uint256 tokenId);
error GenesisNFTVesting__LeftoversWithdrawalLocked();
error GenesisNFTVesting__TokenAlreadyLost(uint256 series, uint256 tokenId);
error GenesisNFTVesting__TokenNotLost(uint256 series, uint256 tokenId);
error GenesisNFTVesting__TokenLost(uint256 series, uint256 tokenId);
error GenesisNFTVesting__NoSurplus(uint256 balance, uint256 released, uint256 allocation);
error GenesisNFTVesting__GamificationNotEnabled();
error GenesisNFTVesting__VestingStartTimestampAlreadyDefined();

contract GenesisNFTVesting is IGenesisNFTVesting, IWithdrawal, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /**
     * @notice Community fund address.
     */
    address private immutable i_communityFund;

    /**
     * @notice Maximum reward amount for Series 1 Genesis NFTs.
     */
    uint256 public constant SERIES_1_MAX_REWARD = 44000 * 1e18;

    /**
     * @notice Maximum reward amount for Series 2 Genesis NFTs.
     */
    uint256 public constant SERIES_2_MAX_REWARD = 6444 * 1e18;

    /**
     * @notice Bonus reward amount.
     */
    uint256 public constant BONUS = 4400 * 1e18;

    /**
     * @notice Instance of the Genesis NFT Mirror contract for Series 1.
     */
    IGeneisNFTMirror private immutable i_genesisNftSeries1Mirror;

    /**
     * @notice Instance of the Genesis NFT Mirror contract for Series 2.
     */
    IGeneisNFTMirror private immutable i_genesisNftSeries2Mirror;

    /**
     * @notice Instance of the WLTH token contract.
     */
    IERC20 private immutable i_wlth;

    /**
     * @notice Duration of the vesting period.
     */
    uint256 private immutable i_duration;

    /**
     * @notice Cadence of vesting (time interval between releases).
     */
    uint256 private immutable i_cadence;

    /**
     * @notice Allocation amount for rewards.
     */
    uint256 private immutable i_allocation;

    /**
     * @notice Period after duration when emergency withdrawal is unlocked.
     */
    uint256 private immutable i_leftoversUnlockDelay;

    /**
     * @notice Amount of cadences based on vesting and cadence perionds.
     */
    uint256 private immutable i_cadencesAmount;

    /**
     * @notice Timestamp when vesting starts.
     */
    uint256 private s_vestingStartTimestamp;

    /**
     * @notice Total amount of rewards released.
     */
    uint256 private s_released;

    /**
     * @notice Mapping to track whether a bonus reward is set for a specific token ID.
     */
    mapping(uint256 => bool) private s_bonusValue;

    /**
     * @notice Mapping to track the amount claimed by each Series 1 token ID.
     */
    mapping(uint256 => uint256) private s_amountClaimedBySeries1TokenId;

    /**
     * @notice Mapping to track the amount claimed by each Series 2 token ID.
     */
    mapping(uint256 => uint256) private s_amountClaimedBySeries2TokenId;

    /**
     * @notice Mapping to track the status of lost tokens.
     */
    mapping(uint256 => mapping(uint256 => bool)) private s_lostTokens;

    /**
     * @notice controls if function is function is not available before vesting start
     */
    modifier afterVestingStart() {
        if (s_vestingStartTimestamp == 0 || block.timestamp < s_vestingStartTimestamp)
            revert GenesisNFTVesting__VestingNotStarted();
        _;
    }

    /**
     * @notice Constructor for GenesisNFTVesting contract.
     * @param _owner The address of the contract owner.
     * @param _genesisNftSeries1Mirror The address of the Genesis NFT Mirror contract for Series 1.
     * @param _genesisNftSeries2Mirror The address of the Genesis NFT Mirror contract for Series 2.
     * @param _wlth The address of the WLTH token contract.
     * @param _duration The duration of the vesting period.
     * @param _cadence The cadence of vesting (time interval between releases).
     * @param _allocation The allocation amount for rewards.
     * @param _leftoversUnlockDelay The timestamp when emergency withdrawal is unlocked.
     * @param _vestingStartTimestamp The timestamp when vesting starts.
     */
    constructor(
        address _owner,
        address _genesisNftSeries1Mirror,
        address _genesisNftSeries2Mirror,
        address _wlth,
        address _communityFund,
        uint256 _duration,
        uint256 _cadence,
        uint256 _allocation,
        uint256 _leftoversUnlockDelay,
        uint256 _vestingStartTimestamp
    ) {
        if (_owner == address(0)) revert GenesisNFTVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert GenesisNFTVesting__WlthZeroAddress();
        if (_communityFund == address(0)) revert GenesisNFTVesting__CommunityFundZeroAddress();
        if (_genesisNftSeries1Mirror == address(0)) revert GenesisNFTVesting__GenesisNftSeries1MirrorZeroAddress();
        if (_genesisNftSeries2Mirror == address(0)) revert GenesisNFTVesting__GenesisNftSeries2MirrorZeroAddress();

        i_genesisNftSeries1Mirror = IGeneisNFTMirror(_genesisNftSeries1Mirror);
        i_genesisNftSeries2Mirror = IGeneisNFTMirror(_genesisNftSeries2Mirror);
        i_wlth = IERC20(_wlth);
        i_communityFund = _communityFund;
        i_duration = _duration;
        i_cadence = _cadence;
        i_allocation = _allocation;
        i_leftoversUnlockDelay = _leftoversUnlockDelay;
        i_cadencesAmount = _duration / _cadence;
        s_vestingStartTimestamp = _vestingStartTimestamp;

        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releaseAllAvailable(
        uint256[] calldata _series1TokenIds,
        uint256[] calldata _series2TokenIds,
        address _beneficiary,
        bool _gamified
    ) external override afterVestingStart {
        if (!accessCheck(_beneficiary)) revert GenesisNFTVesting__NoNFTs(_beneficiary);
        releaseAllForSeries(_series1TokenIds, _beneficiary, true, _gamified);
        releaseAllForSeries(_series2TokenIds, _beneficiary, false, _gamified);
    }

    /**
     * @notice calculates the penalty, gamification
     */
    function calculatePenalty(
        bool _series1,
        uint256 _amount,
        uint256 _tokenId
    ) public view afterVestingStart returns (uint256) {
        uint256 vested = releasableAmountPerNFT(_series1, _tokenId, false);
        uint256 slashingPool = _amount <= vested ? 0 : _amount - vested;
        if (slashingPool == 0) return 0;
        return
            (slashingPool * MAX_GAMIFICATION_PENALTY * (i_cadencesAmount - actualCadence())) /
            i_cadencesAmount /
            BASIS_POINT_DIVISOR;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function setupBonus(uint256[] calldata _series1tokenIds) external override onlyOwner {
        for (uint i; i < _series1tokenIds.length; ) {
            s_bonusValue[_series1tokenIds[i]] = true;
            unchecked {
                i++;
            }
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function setLostToken(bool _series1, uint256 _tokenId) external override onlyOwner {
        if (s_lostTokens[_series1 ? 1 : 2][_tokenId])
            revert GenesisNFTVesting__TokenAlreadyLost(_series1 ? 1 : 2, _tokenId);

        s_lostTokens[_series1 ? 1 : 2][_tokenId] = true;

        emit LostTokenSet(_tokenId, _series1 ? 1 : 2);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function resetLostToken(bool _series1, uint256 _tokenId) external override onlyOwner {
        if (!s_lostTokens[_series1 ? 1 : 2][_tokenId])
            revert GenesisNFTVesting__TokenNotLost(_series1 ? 1 : 2, _tokenId);
        s_lostTokens[_series1 ? 1 : 2][_tokenId] = false;

        emit LostTokenReseted(_tokenId, _series1 ? 1 : 2);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function emergencyWithdraw(bool _series1, uint256 _tokenId, address _to) external override onlyOwner {
        if (!s_lostTokens[_series1 ? 1 : 2][_tokenId])
            revert GenesisNFTVesting__TokenNotLost(_series1 ? 1 : 2, _tokenId);

        uint256 amount = releasableAmountPerNFT(_series1, _tokenId, false);
        emit EmergencyWithdrawalPerformed(_series1 ? 1 : 2, _tokenId, _to, amount);

        releasePerNFT(_series1, _tokenId, amount, _to, false);
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawLeftovers(address _wallet) external override onlyOwner {
        if (
            s_vestingStartTimestamp == 0 ||
            s_vestingStartTimestamp + i_duration + i_leftoversUnlockDelay > block.timestamp
        ) revert GenesisNFTVesting__LeftoversWithdrawalLocked();

        emit LeftoversWithdrawn(_wallet, i_wlth.balanceOf(address(this)));

        i_wlth.safeTransfer(_wallet, i_wlth.balanceOf(address(this)));
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawSurplus(address _wallet) external override onlyOwner {
        uint256 balance = i_wlth.balanceOf(address(this));
        uint256 alreadyReleased = s_released;

        if (balance + alreadyReleased <= i_allocation)
            revert GenesisNFTVesting__NoSurplus(balance, alreadyReleased, i_allocation);

        uint256 surplus = balance + alreadyReleased - i_allocation;

        emit SurplusWithdrawn(_wallet, surplus);

        i_wlth.safeTransfer(_wallet, surplus);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function setVestingStartTimestamp(uint256 _timestamp) external override {
        if (s_vestingStartTimestamp != 0) revert GenesisNFTVesting__VestingStartTimestampAlreadyDefined();
        s_vestingStartTimestamp = _timestamp;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function unvestedAmountPerNFT(bool _series1, uint256 _tokenId) external view override returns (uint256) {
        if (_series1) {
            if (!i_genesisNftSeries1Mirror.isTokenExisted(_tokenId))
                revert GenesisNFTVesting__NFTNotExisted(1, _tokenId);
            return (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) - vestedAmountPerNFT(_series1, _tokenId);
        } else {
            if (!i_genesisNftSeries2Mirror.isTokenExisted(_tokenId))
                revert GenesisNFTVesting__NFTNotExisted(2, _tokenId);
            return SERIES_2_MAX_REWARD - vestedAmountPerNFT(_series1, _tokenId);
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releasableAmount(
        uint256[] calldata _series1TokenIds,
        uint256[] calldata _series2TokenIds,
        address _beneficiary,
        bool _gamified
    ) external view override returns (uint256) {
        if (!accessCheck(_beneficiary)) revert GenesisNFTVesting__NoNFTs(_beneficiary);

        uint256 amount;

        amount += releasableAmountForSeries(_series1TokenIds, _beneficiary, true, _gamified);
        amount += releasableAmountForSeries(_series2TokenIds, _beneficiary, false, _gamified);

        return amount;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function genesisNftSeries1Mirror() external view override returns (address) {
        return address(i_genesisNftSeries1Mirror);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function genesisNftSeries2Mirror() external view override returns (address) {
        return address(i_genesisNftSeries2Mirror);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function wlth() external view override returns (address) {
        return address(i_wlth);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function duration() external view override returns (uint256) {
        return i_duration;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function cadence() external view override returns (uint256) {
        return i_cadence;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function vestingStartTimestamp() external view override returns (uint256) {
        return s_vestingStartTimestamp;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function allocation() external view override returns (uint256) {
        return i_allocation;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function released() external view override returns (uint256) {
        return s_released;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function amountClaimedBySeries1TokenId(uint256 tokenId) external view override returns (uint256) {
        return s_amountClaimedBySeries1TokenId[tokenId];
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function amountClaimedBySeries2TokenId(uint256 tokenId) external view override returns (uint256) {
        return s_amountClaimedBySeries2TokenId[tokenId];
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function leftoversUnlockDelay() external view override returns (uint256) {
        return i_leftoversUnlockDelay;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function lostToken(bool _series1, uint256 _tokenId) public view override returns (bool) {
        return s_lostTokens[_series1 ? 1 : 2][_tokenId];
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releasePerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _amount,
        address _beneficiary,
        bool _gamified
    ) public override afterVestingStart {
        if (s_lostTokens[_series1 ? 1 : 2][_tokenId] && msg.sender != owner())
            revert GenesisNFTVesting__TokenLost(_series1 ? 1 : 2, _tokenId);
        if (
            !(
                _series1
                    ? i_genesisNftSeries1Mirror.ownerOf(_tokenId) == _beneficiary
                    : i_genesisNftSeries2Mirror.ownerOf(_tokenId) == _beneficiary
            ) && msg.sender != owner()
        ) {
            revert GenesisNFTVesting__NotOwnerOfGenesisNFT(_series1 ? 1 : 2, _tokenId, _beneficiary);
        }

        if (!_gamified && releasableAmountPerNFT(_series1, _tokenId, _gamified) < _amount)
            revert GenesisNFTVesting__NotEnoughTokensVested();
        if (i_wlth.balanceOf(address(this)) < _amount) revert GenesisNFTVesting__InsufficientWlthBalance();

        uint256 penaltyAmount = !_gamified ? 0 : calculatePenalty(_series1, _amount, _tokenId);

        s_released += _amount;

        if (_series1) {
            s_amountClaimedBySeries1TokenId[_tokenId] += _amount;
        } else {
            s_amountClaimedBySeries2TokenId[_tokenId] += _amount;
        }

        emit Released(_beneficiary, _amount, _tokenId);

        if (penaltyAmount > 0) {
            IWlth(address(i_wlth)).burn((penaltyAmount * 99 * 99) / 10000);
            i_wlth.safeTransfer(i_communityFund, (penaltyAmount * 99) / 10000);
        }

        i_wlth.safeTransfer(_beneficiary, _amount - penaltyAmount);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releasableAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        bool _gamified
    ) public view override afterVestingStart returns (uint256) {
        if (_series1) {
            uint256 claimed = s_amountClaimedBySeries1TokenId[_tokenId];
            return
                _gamified
                    ? (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) - claimed
                    : Math.min(
                        (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) - claimed,
                        (((actualCadence() * (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) * i_cadence)) / i_duration) -
                            claimed
                    );
        } else {
            uint256 claimed = s_amountClaimedBySeries2TokenId[_tokenId];
            return
                _gamified
                    ? SERIES_2_MAX_REWARD - claimed
                    : Math.min(
                        SERIES_2_MAX_REWARD - claimed,
                        (((actualCadence() * SERIES_2_MAX_REWARD * i_cadence)) / i_duration) - claimed
                    );
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function vestedAmountPerNFT(
        bool _series1,
        uint256 _tokenId
    ) public view override afterVestingStart returns (uint256) {
        if (_series1) {
            return
                Math.min(
                    (SERIES_1_MAX_REWARD + bonusValue(_tokenId)),
                    (actualCadence() * (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) * i_cadence) / i_duration
                );
        } else {
            return Math.min(SERIES_2_MAX_REWARD, (actualCadence() * SERIES_2_MAX_REWARD * i_cadence) / i_duration);
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function bonusValue(uint256 _tokenId) public view override returns (uint256) {
        return s_bonusValue[_tokenId] ? BONUS : 0;
    }

    function releaseAllForSeries(uint256[] calldata _ids, address _beneficiary, bool _series1, bool _gamified) private {
        for (uint i; i < _ids.length; ) {
            releasePerNFT(
                _series1,
                _ids[i],
                releasableAmountPerNFT(_series1, _ids[i], _gamified),
                _beneficiary,
                _gamified
            );
            unchecked {
                i++;
            }
        }
    }

    function releasableAmountForSeries(
        uint256[] calldata _ids,
        address _beneficiary,
        bool _series1,
        bool _gamified
    ) private view returns (uint256) {
        uint256 amount;
        if (_ids.length > 0) {
            for (uint i; i < _ids.length; ) {
                bool isOwner = _series1
                    ? i_genesisNftSeries1Mirror.ownerOf(_ids[i]) == _beneficiary
                    : i_genesisNftSeries2Mirror.ownerOf(_ids[i]) == _beneficiary;

                if (!isOwner) {
                    revert GenesisNFTVesting__NotOwnerOfGenesisNFT(_series1 ? 1 : 2, _ids[i], _beneficiary);
                }

                amount += releasableAmountPerNFT(_series1, _ids[i], _gamified);
                unchecked {
                    i++;
                }
            }
        }
        return amount;
    }

    function accessCheck(address _beneficiary) private view returns (bool) {
        return
            i_genesisNftSeries1Mirror.balanceOf(_beneficiary) > 0 ||
            i_genesisNftSeries2Mirror.balanceOf(_beneficiary) > 0;
    }

    /**
     * @notice Returns releaseable amount of vesting token. Defined by children vesting contracts
     */
    function actualCadence() private view afterVestingStart returns (uint256) {
        uint256 cadenceNumber = (block.timestamp - s_vestingStartTimestamp) / i_cadence;
        return cadenceNumber <= i_cadencesAmount ? cadenceNumber : i_cadencesAmount;
    }
}
