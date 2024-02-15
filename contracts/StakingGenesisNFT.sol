// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import {OwnablePausable} from "./OwnablePausable.sol";
import {IStakingGenesisNFT} from "./interfaces/IStakingGenesisNFT.sol";

error StakingGenesisNft__OwnerZeroAddress();
error StakingGenesisNft__SmallNftZeroAddress();
error StakingGenesisNft__LargeNftZeroAddress();
error StakingGenesisNft__InvalidFinalTimestamp();
error StakingGenesisNft__StakingFinished();
error StakingGenesisNft__NoTokensStaked();
error StakingGenesisNft__UnexpectedTokenId();
error StakingGenesisNFT__UnstakeLimitReached();

/**
 * @title Staking Genesis NFT
 */
contract StakingGenesisNFT is ERC721HolderUpgradeable, OwnablePausable, IStakingGenesisNFT {
    uint256 private constant DAILY_REWARD_SMALL = 5;
    uint256 private constant DAILY_REWARD_LARGE = 27;
    uint256 private constant UNSTAKE_LIMIT = 50;

    uint256 public rewardPeriod; // in seconds
    IERC721Upgradeable public smallNft;
    IERC721Upgradeable public largeNft;
    uint256 public finalTimestamp;

    mapping(address => uint256[]) private stakedSmallKeys;
    mapping(address => mapping(uint256 => uint256[])) private stakedSmall;
    mapping(address => uint256) private rewardsSmall;

    mapping(address => uint256[]) private stakedLargeKeys;
    mapping(address => mapping(uint256 => uint256[])) private stakedLarge;
    mapping(address => uint256) private rewardsLarge;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner,
        uint256 finalTimestamp_,
        address smallNft_,
        address largeNft_,
        uint256 rewardPeriod_
    ) public initializer {
        __ERC721Holder_init();
        __Context_init();
        __OwnablePausable_init(owner);

        if (owner == address(0)) revert StakingGenesisNft__OwnerZeroAddress();
        if (smallNft_ == address(0)) revert StakingGenesisNft__SmallNftZeroAddress();
        if (largeNft_ == address(0)) revert StakingGenesisNft__LargeNftZeroAddress();

        finalTimestamp = finalTimestamp_;
        smallNft = IERC721Upgradeable(smallNft_);
        largeNft = IERC721Upgradeable(largeNft_);
        rewardPeriod = rewardPeriod_;
    }

    function setFinalTimestamp(uint256 finalTimestamp_) external onlyOwner {
        if (finalTimestamp_ < block.timestamp) revert StakingGenesisNft__InvalidFinalTimestamp();

        finalTimestamp = finalTimestamp_;
    }

    function stake(uint256[] calldata tokenIdsSmall, uint256[] calldata tokenIdsLarge) external whenNotPaused {
        if (block.timestamp > finalTimestamp) revert StakingGenesisNft__StakingFinished();

        if (tokenIdsSmall.length > 0) {
            stakedSmallKeys[_msgSender()].push(block.timestamp);
            _saveStake(tokenIdsSmall, stakedSmall[_msgSender()], smallNft);
        }

        if (tokenIdsLarge.length > 0) {
            stakedLargeKeys[_msgSender()].push(block.timestamp);
            _saveStake(tokenIdsLarge, stakedLarge[_msgSender()], largeNft);
        }

        for (uint256 i; i < tokenIdsSmall.length; ) {
            smallNft.safeTransferFrom(_msgSender(), address(this), tokenIdsSmall[i]);
            unchecked {
                i++;
            }
        }

        for (uint256 i; i < tokenIdsLarge.length; ) {
            largeNft.safeTransferFrom(_msgSender(), address(this), tokenIdsLarge[i]);
            unchecked {
                i++;
            }
        }
    }

    function unstake(uint256[] calldata tokenIdsSmall, uint256[] calldata tokenIdsLarge) external whenNotPaused {
        if (tokenIdsSmall.length + tokenIdsLarge.length > UNSTAKE_LIMIT)
            revert StakingGenesisNFT__UnstakeLimitReached();

        uint256 smallReward = _removeStakedToken(
            tokenIdsSmall,
            stakedSmallKeys[_msgSender()],
            stakedSmall[_msgSender()],
            DAILY_REWARD_SMALL
        );
        uint256 largeReward = _removeStakedToken(
            tokenIdsLarge,
            stakedLargeKeys[_msgSender()],
            stakedLarge[_msgSender()],
            DAILY_REWARD_LARGE
        );

        rewardsSmall[_msgSender()] += smallReward;
        rewardsLarge[_msgSender()] += largeReward;

        for (uint256 i; i < tokenIdsSmall.length; ) {
            smallNft.safeTransferFrom(address(this), _msgSender(), tokenIdsSmall[i]);
            unchecked {
                i++;
            }
        }

        for (uint256 i; i < tokenIdsLarge.length; ) {
            largeNft.safeTransferFrom(address(this), _msgSender(), tokenIdsLarge[i]);
            unchecked {
                i++;
            }
        }
    }

    function getRewardSmall(address account) external view returns (uint256) {
        return
            rewardsSmall[account] +
            _calculateReward(stakedSmallKeys[account], stakedSmall[account], DAILY_REWARD_SMALL);
    }

    function getRewardLarge(address account) external view returns (uint256) {
        return
            rewardsLarge[account] +
            _calculateReward(stakedLargeKeys[account], stakedLarge[account], DAILY_REWARD_LARGE);
    }

    function getStakedTokensSmall(address account) external view returns (uint256[] memory) {
        uint256 amount;
        uint256 stakedSmallKeysLength = stakedSmallKeys[account].length;
        for (uint256 i; i < stakedSmallKeysLength; ) {
            amount += stakedSmall[account][stakedSmallKeys[account][i]].length;
            unchecked {
                i++;
            }
        }

        uint256[] memory tokenIds = new uint256[](amount);
        uint256 index;
        for (uint256 i; i < stakedSmallKeys[account].length; ) {
            uint256 key = stakedSmallKeys[account][i];
            for (uint256 j; j < stakedSmall[account][key].length; ) {
                tokenIds[index++] = stakedSmall[account][key][j];
                unchecked {
                    j++;
                }
            }
            unchecked {
                i++;
            }
        }

        return tokenIds;
    }

    function getStakedTokensLarge(address account) external view returns (uint256[] memory) {
        uint256 amount;
        uint256 stakedLargeKeysLength = stakedLargeKeys[account].length;
        for (uint256 i; i < stakedLargeKeysLength; ) {
            amount += stakedLarge[account][stakedLargeKeys[account][i]].length;
            unchecked {
                i++;
            }
        }

        uint256[] memory tokenIds = new uint256[](amount);
        uint256 index;
        for (uint256 i; i < stakedLargeKeysLength; ) {
            uint256 key = stakedLargeKeys[account][i];
            uint256 stakedLargeAccountKeyLength = stakedLarge[account][key].length;
            for (uint256 j; j < stakedLargeAccountKeyLength; ) {
                tokenIds[index++] = stakedLarge[account][key][j];
                unchecked {
                    j++;
                }
            }
            unchecked {
                i++;
            }
        }

        return tokenIds;
    }

    function _saveStake(
        uint256[] calldata tokenIds,
        mapping(uint256 => uint256[]) storage staked,
        IERC721Upgradeable nft
    ) internal {
        for (uint256 i; i < tokenIds.length; ) {
            if (nft.ownerOf(tokenIds[i]) != _msgSender()) revert StakingGenesisNft__UnexpectedTokenId();

            staked[block.timestamp].push(tokenIds[i]);
            unchecked {
                i++;
            }
        }
    }

    function _removeStakedToken(
        uint256[] calldata tokenIds,
        uint256[] storage keys,
        mapping(uint256 => uint256[]) storage staked,
        uint256 dailyReward
    ) internal returns (uint256) {
        uint256 reward;

        for (uint i; i < tokenIds.length; ) {
            bool found;
            for (uint j; !found && j < keys.length; ) {
                for (uint k; !found && k < staked[keys[j]].length; ) {
                    if (staked[keys[j]][k] == tokenIds[i]) {
                        _remove(k, staked[keys[j]]);
                        reward += _calculateOneTokenReward(keys[j], dailyReward);
                        found = true;
                    }
                    unchecked {
                        k++;
                    }
                }
                unchecked {
                    j++;
                }
            }
            if (!found) revert StakingGenesisNft__NoTokensStaked();
            unchecked {
                i++;
            }
        }

        return reward;
    }

    function _calculateReward(
        uint256[] storage keys,
        mapping(uint256 => uint256[]) storage staked,
        uint dailyReward
    ) internal view returns (uint256) {
        uint256 reward;
        for (uint256 i; i < keys.length; ) {
            reward += _calculateOneTokenReward(keys[i], dailyReward) * staked[keys[i]].length;
            unchecked {
                i++;
            }
        }
        return reward;
    }

    function _calculateOneTokenReward(uint256 stakedTime, uint256 dailyReward) internal view returns (uint256) {
        uint256 timeElapsed = MathUpgradeable.min(block.timestamp, finalTimestamp) - stakedTime;
        uint256 daysElapsed = timeElapsed / rewardPeriod;

        return daysElapsed * dailyReward;
    }

    function _remove(uint index, uint256[] storage array) internal {
        array[index] = array[array.length - 1];
        array.pop();
    }
}
