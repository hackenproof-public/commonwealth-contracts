// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BaseVesting} from "./BaseVesting.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract StakingGenNFTVesting is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /**
     * @notice Vested token address
     */
    address public token;

    /**
     * @notice Total token allocation during vesting schedule
     */
    uint256 public allocation;

    /**
     * @notice Number of already released tokens
     */
    uint256 public released;

    /**
     * @notice Vesting start block's timestamp
     */
    uint256 public vestingStartTimestamp;

    /**
     * @notice Staking Genesis NFT contract address
     */
    address public stakingGenNftAddress;

    /**
     * @notice check for vested WLTH tokens by given beneficiary
     */
    mapping(address => uint256) public amountClaimedByWallet;

    /**
     * @notice Emitted when token released from vesting contract
     * @param beneficiary Wallet that released tokens
     * @param token Token address
     * @param amount Amount released
     */
    event Released(address indexed beneficiary, address indexed token, uint256 amount);

    constructor(
        address owner_,
        address token_,
        uint256 allocation_,
        uint256 vestingStartTimestamp_,
        address stakingGenNftAddress_
    ) {
        stakingGenNftAddress = stakingGenNftAddress_;
        token = token_;
        allocation = allocation_;
        vestingStartTimestamp = vestingStartTimestamp_;
        _transferOwnership(owner_);
    }

    /**
     * @dev Release the tokens from this contract to the beneficiary
     */
    function release(uint256 amount, address beneficiary) public virtual {
        require(accessCheck(beneficiary), "Unauthorized access!");
        require(block.timestamp >= vestingStartTimestamp, "Vesting has not started yet!");
        require(amount <= releaseableAmount(beneficiary), "Not enough tokens vested!");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Not enough tokens to process the release!");

        released += amount;
        amountClaimedByWallet[beneficiary] += amount;
        emit Released(beneficiary, token, amount);

        IERC20(token).safeTransfer(beneficiary, amount);
    }

    /**
     * @dev Returns amount of tokens available to release for actual block timestamp
     */
    function releaseableAmount(address beneficiary) public view returns (uint256) {
        return
            (IStakingGenesisNFT(stakingGenNftAddress).getRewardSmall(beneficiary) +
                IStakingGenesisNFT(stakingGenNftAddress).getRewardLarge(beneficiary)) *
            1e18 -
            amountClaimedByWallet[beneficiary];
    }

    /**
     * @dev Defines which address can release tokens
     */
    function accessCheck(address beneficiary) public view returns (bool) {
        return (IStakingGenesisNFT(stakingGenNftAddress).getRewardSmall(beneficiary) > 0 ||
            IStakingGenesisNFT(stakingGenNftAddress).getRewardLarge(beneficiary) > 0);
    }
}
