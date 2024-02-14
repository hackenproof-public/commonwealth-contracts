// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGeneisNFTMirror} from "../interfaces/IGenesisNFTMirror.sol";
import {IGenesisNFTVesting} from "../interfaces/IGenesisNFTVesting.sol";
import {IEmergencyWithdrawal} from "../interfaces/IEmergencyWithdrawal.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

error GenesisNFTVesting__OwnerZeroAddress();
error GenesisNFTVesting__WlthZeroAddress();
error GenesisNFTVesting__GenesisNftSeries1MirrorZeroAddress();
error GenesisNFTVesting__GenesisNftSeries2MirrorZeroAddress();
error GenesisNFTVesting__NoNFTs(address wallet);
error GenesisNFTVesting__VestingNotStarted();
error GenesisNFTVesting__NotOwnerOfGenesisNFT(uint256 series, uint256 tokenId, address account);
error GenesisNFTVesting__NotEnoughTokensVested();
error GenesisNFTVesting__InsufficientWlthBalance();
error GenesisNFTVesting__NothingToRelease();
error GenesisNFTVesting__NFTNotExisted(uint256 series, uint256 tokenId);
error GenesisNFTVesting__EmergencyWithdrawalLocked();

contract GenesisNFTVesting is IGenesisNFTVesting, IEmergencyWithdrawal, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

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
    IGeneisNFTMirror private i_genesisNftSeries2Mirror;

    /**
     * @notice Instance of the WLTH token contract.
     */
    IERC20 private i_wlth;

    /**
     * @notice Duration of the vesting period.
     */
    uint256 private i_duration;

    /**
     * @notice Cadence of vesting (time interval between releases).
     */
    uint256 private i_cadence;

    /**
     * @notice Timestamp when vesting starts.
     */
    uint256 private i_vestingStartTimestamp;

    /**
     * @notice Allocation amount for rewards.
     */
    uint256 private i_allocation;

    /**
     * @notice Timestamp when emergency withdrawal is unlocked.
     */
    uint256 private i_emergencyWithdrawalUnlockTimestamp;

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
     * @notice Event emitted when rewards are released.
     */
    event Released(address indexed beneficiary, uint256 amount, uint256 tokenId);

    constructor(
        address _owner,
        address _genesisNftSeries1Mirror,
        address _genesisNftSeries2Mirror,
        address _wlth,
        uint256 _duration,
        uint256 _cadence,
        uint256 _vestingStartTimestamp,
        uint256 _allocation,
        uint _emergencyWithdrawalUnlockTimestamp
    ) {
        if (_owner == address(0)) revert GenesisNFTVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert GenesisNFTVesting__WlthZeroAddress();
        if (_genesisNftSeries1Mirror == address(0)) revert GenesisNFTVesting__GenesisNftSeries1MirrorZeroAddress();
        if (_genesisNftSeries2Mirror == address(0)) revert GenesisNFTVesting__GenesisNftSeries2MirrorZeroAddress();

        i_genesisNftSeries1Mirror = IGeneisNFTMirror(_genesisNftSeries1Mirror);
        i_genesisNftSeries2Mirror = IGeneisNFTMirror(_genesisNftSeries2Mirror);
        i_wlth = IERC20(_wlth);
        i_duration = _duration;
        i_cadence = _cadence;
        i_vestingStartTimestamp = _vestingStartTimestamp;
        i_allocation = _allocation;
        i_emergencyWithdrawalUnlockTimestamp = _emergencyWithdrawalUnlockTimestamp;

        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releaseAllAvailable(
        uint256[] memory _series1TokenIds,
        uint256[] memory _series2TokenIds,
        address _beneficiary
    ) external override {
        if (block.timestamp < i_vestingStartTimestamp) revert GenesisNFTVesting__VestingNotStarted();
        if (!accessCheck(_beneficiary)) revert GenesisNFTVesting__NoNFTs(_beneficiary);
        releaseAllForSeries(_series1TokenIds, _beneficiary, true);
        releaseAllForSeries(_series2TokenIds, _beneficiary, false);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function setupBonus(uint256[] memory _series1tokenIds) external override onlyOwner {
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
    function unvestedAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _actualTimestamp
    ) external view override returns (uint256) {
        if (_series1) {
            if (!i_genesisNftSeries1Mirror.isTokenExisted(_tokenId))
                revert GenesisNFTVesting__NFTNotExisted(1, _tokenId);
            return
                (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) - vestedAmountPerNFT(_series1, _tokenId, _actualTimestamp);
        } else {
            if (!i_genesisNftSeries2Mirror.isTokenExisted(_tokenId))
                revert GenesisNFTVesting__NFTNotExisted(2, _tokenId);
            return SERIES_2_MAX_REWARD - vestedAmountPerNFT(_series1, _tokenId, _actualTimestamp);
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releasableAmount(
        uint256[] memory _series1TokenIds,
        uint256[] memory _series2TokenIds,
        uint256 _actualTimestamp,
        address _beneficiary
    ) external view override returns (uint256) {
        if (!accessCheck(_beneficiary)) revert GenesisNFTVesting__NoNFTs(_beneficiary);

        uint256 amount;

        amount += releasableAmountForSeries(_series1TokenIds, _beneficiary, true, _actualTimestamp);
        amount += releasableAmountForSeries(_series2TokenIds, _beneficiary, false, _actualTimestamp);

        return amount;
    }

    /**
     * @inheritdoc IEmergencyWithdrawal
     */
    function emergencyWithdraw(address _wallet) external override onlyOwner {
        if (i_emergencyWithdrawalUnlockTimestamp > block.timestamp)
            revert GenesisNFTVesting__EmergencyWithdrawalLocked();

        emit EmergencyWithdrawal(_wallet, i_wlth.balanceOf(address(this)));

        i_wlth.safeTransfer(_wallet, i_wlth.balanceOf(address(this)));
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
        return i_vestingStartTimestamp;
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
     * @inheritdoc IEmergencyWithdrawal
     */
    function emergencyWithdrawalUnlockTimestamp() external view override returns (uint256) {
        return i_emergencyWithdrawalUnlockTimestamp;
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releasePerNFT(bool _series1, uint256 _tokenId, uint256 _amount, address _beneficiary) public override {
        if (block.timestamp < i_vestingStartTimestamp) revert GenesisNFTVesting__VestingNotStarted();
        if (
            !(
                _series1
                    ? i_genesisNftSeries1Mirror.ownerOf(_tokenId) == _beneficiary
                    : i_genesisNftSeries2Mirror.ownerOf(_tokenId) == _beneficiary
            )
        ) {
            revert GenesisNFTVesting__NotOwnerOfGenesisNFT(_series1 ? 1 : 2, _tokenId, _beneficiary);
        }

        if (releasableAmountPerNFT(_series1, _tokenId, block.timestamp) < _amount)
            revert GenesisNFTVesting__NotEnoughTokensVested();
        if (i_wlth.balanceOf(address(this)) < _amount) revert GenesisNFTVesting__InsufficientWlthBalance();

        s_released += _amount;

        if (_series1) {
            s_amountClaimedBySeries1TokenId[_tokenId] += _amount;
        } else {
            s_amountClaimedBySeries2TokenId[_tokenId] += _amount;
        }

        emit Released(_beneficiary, _amount, _tokenId);

        i_wlth.safeTransfer(_beneficiary, _amount);
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function releasableAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _actualTimestamp
    ) public view override returns (uint256) {
        if (block.timestamp < i_vestingStartTimestamp) revert GenesisNFTVesting__VestingNotStarted();
        uint256 cadencesAmount = (_actualTimestamp - i_vestingStartTimestamp) / i_cadence;
        if (_series1) {
            uint256 claimed = s_amountClaimedBySeries1TokenId[_tokenId];
            return
                Math.min(
                    (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) - claimed,
                    (((cadencesAmount * (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) * i_cadence)) / i_duration) -
                        claimed
                );
        } else {
            uint256 claimed = s_amountClaimedBySeries2TokenId[_tokenId];
            return
                Math.min(
                    SERIES_2_MAX_REWARD - claimed,
                    (((cadencesAmount * SERIES_2_MAX_REWARD * i_cadence)) / i_duration) - claimed
                );
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function vestedAmountPerNFT(
        bool _series1,
        uint256 _tokenId,
        uint256 _actualTimestamp
    ) public view override returns (uint256) {
        if (_actualTimestamp < i_vestingStartTimestamp) revert GenesisNFTVesting__VestingNotStarted();
        uint256 cadencesAmount = (_actualTimestamp - i_vestingStartTimestamp) / i_cadence;
        if (_series1) {
            return
                Math.min(
                    (SERIES_1_MAX_REWARD + bonusValue(_tokenId)),
                    (cadencesAmount * (SERIES_1_MAX_REWARD + bonusValue(_tokenId)) * i_cadence) / i_duration
                );
        } else {
            return Math.min(SERIES_2_MAX_REWARD, (cadencesAmount * SERIES_2_MAX_REWARD * i_cadence) / i_duration);
        }
    }

    /**
     * @inheritdoc IGenesisNFTVesting
     */
    function bonusValue(uint256 _tokenId) public view override returns (uint256) {
        return s_bonusValue[_tokenId] ? BONUS : 0;
    }

    function releaseAllForSeries(uint256[] memory _ids, address _beneficiary, bool _series1) private {
        for (uint i; i < _ids.length; ) {
            releasePerNFT(_series1, _ids[i], releasableAmountPerNFT(_series1, _ids[i], block.timestamp), _beneficiary);

            unchecked {
                i++;
            }
        }
    }

    function releasableAmountForSeries(
        uint256[] memory _ids,
        address _beneficiary,
        bool _series1,
        uint256 _actualTimestamp
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

                amount += releasableAmountPerNFT(_series1, _ids[i], _actualTimestamp);
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
}
