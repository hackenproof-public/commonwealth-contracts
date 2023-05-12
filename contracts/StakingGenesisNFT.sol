// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import {OwnablePausable} from "./OwnablePausable.sol";
import {IStakingGenesisNFT} from "./interfaces/IStakingGenesisNFT.sol";

/**
 * @title Staking Genesis NFT
 */
contract StakingGenesisNFT is ERC721HolderUpgradeable, OwnablePausable, IStakingGenesisNFT {
    uint256 private constant DAILY_REWARD_SMALL = 5;
    uint256 private constant DAILY_REWARD_LARGE = 27;

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

        finalTimestamp = finalTimestamp_;
        smallNft = IERC721Upgradeable(smallNft_);
        largeNft = IERC721Upgradeable(largeNft_);
        rewardPeriod = rewardPeriod_;
    }

    function initialiseSmallNft(address smallNft_) external onlyOwner {
        require(address(smallNft) == address(0), "Small NFT was already initialised");

        smallNft = IERC721Upgradeable(smallNft_);
    }

    function initialiseLargeNft(address largeNft_) external onlyOwner {
        require(address(largeNft) == address(0), "Large NFT was already initialised");

        largeNft = IERC721Upgradeable(largeNft_);
    }

    function setFinalTimestamp(uint256 finalTimestamp_) external onlyOwner {
        require(finalTimestamp_ >= block.timestamp, "Cannot set final timestamp for one in the past");

        finalTimestamp = finalTimestamp_;
    }

    function stake(uint256[] calldata tokenIdsSmall, uint256[] calldata tokenIdsLarge) external whenNotPaused {
        require(block.timestamp <= finalTimestamp, "Staking time has ended");

        if (tokenIdsSmall.length > 0) {
            require(address(smallNft) != address(0), "Small NFT contract was not configured");

            stakedSmallKeys[_msgSender()].push(block.timestamp);
            _saveStake(tokenIdsSmall, stakedSmall[_msgSender()], smallNft);
        }

        if (tokenIdsLarge.length > 0) {
            require(address(largeNft) != address(0), "Large NFT contract was not configured");

            stakedLargeKeys[_msgSender()].push(block.timestamp);
            _saveStake(tokenIdsLarge, stakedLarge[_msgSender()], largeNft);
        }

        for (uint256 i = 0; i < tokenIdsSmall.length; i++) {
            smallNft.safeTransferFrom(_msgSender(), address(this), tokenIdsSmall[i]);
        }

        for (uint256 i = 0; i < tokenIdsLarge.length; i++) {
            largeNft.safeTransferFrom(_msgSender(), address(this), tokenIdsLarge[i]);
        }
    }

    function unstake(uint256[] calldata tokenIdsSmall, uint256[] calldata tokenIdsLarge) external whenNotPaused {
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

        for (uint256 i = 0; i < tokenIdsSmall.length; i++) {
            smallNft.safeTransferFrom(address(this), _msgSender(), tokenIdsSmall[i]);
        }

        for (uint256 i = 0; i < tokenIdsLarge.length; i++) {
            largeNft.safeTransferFrom(address(this), _msgSender(), tokenIdsLarge[i]);
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
        uint256 amount = 0;
        for (uint256 i = 0; i < stakedSmallKeys[account].length; i++) {
            amount += stakedSmall[account][stakedSmallKeys[account][i]].length;
        }

        uint256[] memory tokenIds = new uint256[](amount);
        uint256 index = 0;
        for (uint256 i = 0; i < stakedSmallKeys[account].length; i++) {
            uint256 key = stakedSmallKeys[account][i];
            for (uint256 j = 0; j < stakedSmall[account][key].length; j++) {
                tokenIds[index++] = stakedSmall[account][key][j];
            }
        }

        return tokenIds;
    }

    function getStakedTokensLarge(address account) external view returns (uint256[] memory) {
        uint256 amount = 0;

        for (uint256 i = 0; i < stakedLargeKeys[account].length; i++) {
            amount += stakedLarge[account][stakedLargeKeys[account][i]].length;
        }

        uint256[] memory tokenIds = new uint256[](amount);
        uint256 index = 0;
        for (uint256 i = 0; i < stakedLargeKeys[account].length; i++) {
            uint256 key = stakedLargeKeys[account][i];
            for (uint256 j = 0; j < stakedLarge[account][key].length; j++) {
                tokenIds[index++] = stakedLarge[account][key][j];
            }
        }

        return tokenIds;
    }

    function _saveStake(
        uint256[] calldata tokenIds,
        mapping(uint256 => uint256[]) storage staked,
        IERC721Upgradeable nft
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(nft.ownerOf(tokenIds[i]) == _msgSender(), "Unexpected tokenId");

            staked[block.timestamp].push(tokenIds[i]);
        }
    }

    function _removeStakedToken(
        uint256[] calldata tokenIds,
        uint256[] storage keys,
        mapping(uint256 => uint256[]) storage staked,
        uint256 dailyReward
    ) internal returns (uint256) {
        uint256 reward = 0;

        for (uint i = 0; i < tokenIds.length; i++) {
            bool found = false;
            for (uint j = 0; !found && j < keys.length; j++) {
                for (uint k = 0; !found && k < staked[keys[j]].length; k++) {
                    if (staked[keys[j]][k] == tokenIds[i]) {
                        _remove(k, staked[keys[j]]);
                        reward += _calculateOneTokenReward(keys[j], dailyReward);
                        found = true;
                    }
                }
            }
            require(found, "You have not staked some of these tokens");
        }

        return reward;
    }

    function _calculateReward(
        uint256[] storage keys,
        mapping(uint256 => uint256[]) storage staked,
        uint dailyReward
    ) internal view returns (uint256) {
        uint256 reward = 0;

        for (uint256 i = 0; i < keys.length; i++) {
            reward += _calculateOneTokenReward(keys[i], dailyReward) * staked[keys[i]].length;
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
