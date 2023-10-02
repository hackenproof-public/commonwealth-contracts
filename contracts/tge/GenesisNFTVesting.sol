// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract GenesisNFTVesting is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    address public genNftSeries1Contract;
    address public genNftSeries2Contract;
    address public stakingGenNftContract;

    /**
     * @notice Vested token address
     */
    address public token;

    /**
     * @notice Total vesting duration in seconds
     */
    uint256 public duration;

    /**
     * @notice Time after which the new tokens are released
     */
    uint256 public cadence;

    /**
     * @notice Number of already released tokens
     */
    uint256 public released;

    /**
     * @notice Vesting start block's timestamp
     */
    uint256 public vestingStartTimestamp;

    /**
     * @notice List of Genesis NFT series1 tokenIds affected by bonus
     */
    mapping(uint256 => bool) public bonusTokens;

    /**
     * @notice mapping for check if given TokenId already vested WLTH tokens
     */
    mapping(uint256 => uint256) public amountClaimedBySeries1TokenId;

    /**
     * @notice mapping for check if given TokenId already vested WLTH tokens
     */
    mapping(uint256 => uint256) public amountClaimedBySeries2TokenId;

    /**
     * @notice Emitted when token released from vesting contract
     * @param beneficiary Wallet that released tokens
     * @param token Token address
     * @param amount Amount released
     */
    event Released(address indexed beneficiary, address indexed token, uint256 amount);

    /**
     * @notice reverts whole transaction when one of tokens is not owned by given wallet
     */
    error TokenNotOwnedByWallet(uint256 series, uint256 tokenId);

    constructor(
        address owner_,
        address token_,
        uint256 duration_,
        uint256 cadence_,
        uint256 vestingStartTimestamp_,
        address genNftSeries1Contract_,
        address genNftSeries2Contract_,
        address stakingGenNftContract_
    ) {
        token = token_;
        duration = duration_;
        cadence = cadence_;
        vestingStartTimestamp = vestingStartTimestamp_;
        genNftSeries1Contract = genNftSeries1Contract_;
        genNftSeries2Contract = genNftSeries2Contract_;
        stakingGenNftContract = stakingGenNftContract_;
        _transferOwnership(owner_);
    }

    /**
     * @dev Release all available tokens from all Genesis NFTs owned by this wallet
     */
    function release(
        uint256 amount,
        uint256[] memory series1TokenIds,
        uint256[] memory series2TokenIds,
        address beneficiary
    ) public virtual {
        require(accessCheck(beneficiary), "Unauthorized access!");
        require(block.timestamp >= vestingStartTimestamp, "Vesting has not started yet!");
        require(
            releaseableAmount(series1TokenIds, series2TokenIds, block.timestamp, beneficiary) > amount,
            "Not enough tokens vested!"
        );
        require(IERC20(token).balanceOf(address(this)) >= amount, "Not enough tokens to process the release!");

        released += amount;
        emit Released(beneficiary, token, amount);

        IERC20(token).safeTransfer(beneficiary, amount * 1e18);
    }

    /**
     * @dev Returns amount of tokens available to release for actual block timestamp
     */
    function releaseableAmount(
        uint256[] memory series1TokenIds,
        uint256[] memory series2TokenIds,
        uint256 actualTimestamp,
        address beneficiary
    ) public view returns (uint256) {
        require(accessCheck(beneficiary), "Access denied");
        uint256 amount = 0;
        uint256[] memory stakedSeries1Tokens = IStakingGenesisNFT(stakingGenNftContract).getStakedTokensLarge(
            beneficiary
        );
        uint256[] memory stakedSeries2Tokens = IStakingGenesisNFT(stakingGenNftContract).getStakedTokensSmall(
            beneficiary
        );
        if (series1TokenIds.length > 0) {
            for (uint i = 0; i < series1TokenIds.length; i++) {
                if (
                    IERC721Upgradeable(genNftSeries1Contract).ownerOf(series1TokenIds[i]) == beneficiary ||
                    _contains(stakedSeries1Tokens, series1TokenIds[i])
                ) {
                    amount += releaseableAmountPerNFT(true, series1TokenIds[i], actualTimestamp);
                } else {
                    revert TokenNotOwnedByWallet(1, series1TokenIds[i]);
                }
            }
        }

        if (series2TokenIds.length > 0) {
            for (uint i = 0; i < series2TokenIds.length; i++) {
                if (
                    IERC721Upgradeable(genNftSeries2Contract).ownerOf(series2TokenIds[i]) == beneficiary ||
                    _contains(stakedSeries2Tokens, series2TokenIds[i])
                ) {
                    amount += releaseableAmountPerNFT(false, series2TokenIds[i], actualTimestamp);
                } else {
                    revert TokenNotOwnedByWallet(2, series2TokenIds[i]);
                }
            }
        }
        return amount;
    }

    function _contains(uint256[] memory array, uint256 value) private pure returns (bool) {
        bool arrayContainsValue = false;
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == value) arrayContainsValue = true;
        }
        return arrayContainsValue;
    }

    function releaseableAmountPerNFT(
        bool series1,
        uint256 tokenId,
        uint256 actualTimestamp
    ) public view returns (uint256) {
        uint256 cadencesAmount = (actualTimestamp - vestingStartTimestamp) / cadence;
        if (series1) {
            uint256 claimed = amountClaimedBySeries1TokenId[tokenId];
            return
                Math.min(
                    44000 + getBonusValue(tokenId) - claimed,
                    ((cadencesAmount * (44000 + getBonusValue(tokenId)) * cadence) / duration) - claimed
                );
        } else {
            uint256 claimed = amountClaimedBySeries2TokenId[tokenId];
            return Math.min(6444 - claimed, ((cadencesAmount * 6444 * cadence) / duration) - claimed);
        }
    }

    /**
     * @dev Defines which address can release tokens
     */
    function accessCheck(address beneficiary) public view returns (bool) {
        return getSeries1TokenCount(beneficiary) > 0 || getSeries2TokenCount(beneficiary) > 0;
    }

    function bonusSetup(uint256[] memory series1tokenIds) public onlyOwner {
        for (uint i = 0; i < series1tokenIds.length; i++) {
            bonusTokens[series1tokenIds[i]] = true;
        }
    }

    function getBonusValue(uint256 tokenId) public view returns (uint256) {
        return bonusTokens[tokenId] ? 4400 : 0;
    }

    /**
     * @dev Counts amount of Series 1 tokens both owned and staked by address
     */
    function getSeries1TokenCount(address beneficiary) public view returns (uint256) {
        return
            IERC721Upgradeable(genNftSeries1Contract).balanceOf(beneficiary) +
            IStakingGenesisNFT(stakingGenNftContract).getStakedTokensLarge(beneficiary).length;
    }

    /**
     * @dev Counts amount of Series 2 tokens both owned and staked by address
     */
    function getSeries2TokenCount(address beneficiary) public view returns (uint256) {
        return
            IERC721Upgradeable(genNftSeries2Contract).balanceOf(beneficiary) +
            IStakingGenesisNFT(stakingGenNftContract).getStakedTokensSmall(beneficiary).length;
    }
}
