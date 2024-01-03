// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

error GenesisNftVesting__TokenZeroAddress();
error GenesisNftVesting__GenesisNftSeries1ZeroAddress();
error GenesisNftVesting__GenesisNftSeries2ZeroAddress();
error GenesisNftVesting__StakingGenesisNftZeroAddress();
error GenesisNftVesting__AccessDenied();
error GenesisNftVesting__VestingNotStarted();
error GenesisNftVesting__NotOwnerOfGenesisNft();
error GenesisNftVesting__NotEnoughTokensVested();
error GenesisNftVesting__InsufficientTokensOnContract();

contract GenesisNFTVesting is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /**
     * @notice Genesis NFT Series 1 contract address
     */
    address public genNftSeries1Contract;

    /**
     * @notice Genesis NFT Series 2 contract address
     */
    address public genNftSeries2Contract;

    /**
     * @notice Staking Genesis NFT contract address
     */
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
        if (token_ == address(0)) revert GenesisNftVesting__TokenZeroAddress();
        if (genNftSeries1Contract_ == address(0)) revert GenesisNftVesting__GenesisNftSeries1ZeroAddress();
        if (genNftSeries2Contract_ == address(0)) revert GenesisNftVesting__GenesisNftSeries2ZeroAddress();
        if (stakingGenNftContract_ == address(0)) revert GenesisNftVesting__StakingGenesisNftZeroAddress();

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
    function releaseAllAvailable(
        uint256[] memory series1TokenIds,
        uint256[] memory series2TokenIds,
        address beneficiary
    ) public virtual {
        if (!accessCheck(beneficiary)) revert GenesisNftVesting__AccessDenied();
        if (block.timestamp < vestingStartTimestamp) revert GenesisNftVesting__VestingNotStarted();

        uint256[] memory stakedSeries1Tokens = IStakingGenesisNFT(stakingGenNftContract).getStakedTokensLarge(
            beneficiary
        );
        uint256[] memory stakedSeries2Tokens = IStakingGenesisNFT(stakingGenNftContract).getStakedTokensSmall(
            beneficiary
        );

        if (series1TokenIds.length > 0) {
            for (uint i; i < series1TokenIds.length; ) {
                if (
                    IERC721Upgradeable(genNftSeries1Contract).ownerOf(series1TokenIds[i]) == beneficiary ||
                    _contains(stakedSeries1Tokens, series1TokenIds[i])
                ) {
                    releasePerNFT(
                        true,
                        series1TokenIds[i],
                        releaseableAmountPerNFT(true, series1TokenIds[i], block.timestamp),
                        beneficiary
                    );
                } else {
                    revert TokenNotOwnedByWallet(1, series1TokenIds[i]);
                }
                unchecked {
                    i++;
                }
            }
        }

        if (series2TokenIds.length > 0) {
            for (uint i; i < series2TokenIds.length; ) {
                if (
                    IERC721Upgradeable(genNftSeries2Contract).ownerOf(series2TokenIds[i]) == beneficiary ||
                    _contains(stakedSeries2Tokens, series2TokenIds[i])
                ) {
                    releasePerNFT(
                        false,
                        series2TokenIds[i],
                        releaseableAmountPerNFT(false, series2TokenIds[i], block.timestamp),
                        beneficiary
                    );
                } else {
                    revert TokenNotOwnedByWallet(2, series2TokenIds[i]);
                }
                unchecked {
                    i++;
                }
            }
        }
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
        if (!accessCheck(beneficiary)) revert GenesisNftVesting__AccessDenied();
        uint256 amount;
        uint256[] memory stakedSeries1Tokens = IStakingGenesisNFT(stakingGenNftContract).getStakedTokensLarge(
            beneficiary
        );
        uint256[] memory stakedSeries2Tokens = IStakingGenesisNFT(stakingGenNftContract).getStakedTokensSmall(
            beneficiary
        );
        if (series1TokenIds.length > 0) {
            for (uint i; i < series1TokenIds.length; ) {
                if (
                    IERC721Upgradeable(genNftSeries1Contract).ownerOf(series1TokenIds[i]) == beneficiary ||
                    _contains(stakedSeries1Tokens, series1TokenIds[i])
                ) {
                    amount += releaseableAmountPerNFT(true, series1TokenIds[i], actualTimestamp);
                } else {
                    revert TokenNotOwnedByWallet(1, series1TokenIds[i]);
                }
                unchecked {
                    i++;
                }
            }
        }

        if (series2TokenIds.length > 0) {
            for (uint i; i < series2TokenIds.length; ) {
                if (
                    IERC721Upgradeable(genNftSeries2Contract).ownerOf(series2TokenIds[i]) == beneficiary ||
                    _contains(stakedSeries2Tokens, series2TokenIds[i])
                ) {
                    amount += releaseableAmountPerNFT(false, series2TokenIds[i], actualTimestamp);
                } else {
                    revert TokenNotOwnedByWallet(2, series2TokenIds[i]);
                }
                unchecked {
                    i++;
                }
            }
        }
        return amount;
    }

    function _contains(uint256[] memory array, uint256 value) private pure returns (bool) {
        for (uint i; i < array.length; ) {
            if (array[i] == value) return true;
            unchecked {
                i++;
            }
        }
        return false;
    }

    function releaseableAmountPerNFT(
        bool series1,
        uint256 tokenId,
        uint256 actualTimestamp
    ) public view returns (uint256) {
        if (block.timestamp < vestingStartTimestamp) revert GenesisNftVesting__VestingNotStarted();
        uint256 cadencesAmount = (actualTimestamp - vestingStartTimestamp) / cadence;
        if (series1) {
            uint256 claimed = amountClaimedBySeries1TokenId[tokenId];
            return
                Math.min(
                    (44000 + getBonusValue(tokenId)) * 1e18 - claimed,
                    (((cadencesAmount * (44000 + getBonusValue(tokenId)) * cadence) * 1e18) / duration) - claimed
                );
        } else {
            uint256 claimed = amountClaimedBySeries2TokenId[tokenId];
            return Math.min(6444 * 1e18 - claimed, (((cadencesAmount * 6444 * cadence) * 1e18) / duration) - claimed);
        }
    }

    function releasePerNFT(bool isSeries1, uint256 tokenId, uint256 amount, address beneficiary) public {
        if (!accessCheck(beneficiary)) revert GenesisNftVesting__AccessDenied();
        if (!
            (isSeries1
                ? IERC721Upgradeable(genNftSeries1Contract).ownerOf(tokenId) == msg.sender
                : IERC721Upgradeable(genNftSeries2Contract).ownerOf(tokenId) == msg.sender)
        ) revert GenesisNftVesting__NotOwnerOfGenesisNft();
        if (block.timestamp < vestingStartTimestamp) revert GenesisNftVesting__VestingNotStarted();
        uint256 availableAmount = releaseableAmountPerNFT(isSeries1, tokenId, block.timestamp);
        if (availableAmount < amount) revert GenesisNftVesting__NotEnoughTokensVested();
        if (IERC20(token).balanceOf(address(this)) < amount) revert GenesisNftVesting__InsufficientTokensOnContract();

        released += amount;
        if (isSeries1) {
            amountClaimedBySeries1TokenId[tokenId] += amount;
        } else {
            amountClaimedBySeries2TokenId[tokenId] += amount;
        }

        IERC20(token).safeTransfer(beneficiary, amount);
    }

    /**
     * @dev Defines which address can release tokens
     */
    function accessCheck(address beneficiary) public view returns (bool) {
        return getSeries1TokenCount(beneficiary) > 0 || getSeries2TokenCount(beneficiary) > 0;
    }

    function bonusSetup(uint256[] memory series1tokenIds) public onlyOwner {
        for (uint i; i < series1tokenIds.length; ) {
            bonusTokens[series1tokenIds[i]] = true;
            unchecked {
                i++;
            }
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

    /**
     * @dev Gets amount of unvested tokens for given NFT
     */
    function getUnvestedAmountPerNft(
        bool series1,
        uint256 tokenId,
        uint256 actualTimestamp
    ) public view returns (uint256) {
        if (series1) {
            return (44000 + getBonusValue(tokenId)) * 1e18 - getVestedAmountPerNft(series1, tokenId, actualTimestamp);
        } else {
            return 6444 * 1e18 - getVestedAmountPerNft(series1, tokenId, actualTimestamp);
        }
    }

    /**
     * @dev Gets amount of vested tokens for given NFT
     */
    function getVestedAmountPerNft(
        bool series1,
        uint256 tokenId,
        uint256 actualTimestamp
    ) public view returns (uint256) {
        uint256 cadencesAmount = (actualTimestamp - vestingStartTimestamp) / cadence;
        if (series1) {
            return
                Math.min(
                    (44000 + getBonusValue(tokenId)) * 1e18,
                    (cadencesAmount * (44000 + getBonusValue(tokenId)) * cadence * 1e18) / duration
                );
        } else {
            return Math.min(6444 * 1e18, (cadencesAmount * 6444 * cadence * 1e18) / duration);
        }
    }
}
