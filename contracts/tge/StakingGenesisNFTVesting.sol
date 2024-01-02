// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStakingGenesisNFT} from "../interfaces/IStakingGenesisNFT.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

error BaseVesting__TokenZeroAddress();
error BaseVesting__GenesisNftZeroAddress();
error BaseVesting__VestingNotStarted();
error BaseVesting__NotEnoughTokensVested();
error BaseVesting__NotEnoughTokensOnContract();

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
    event Released(address indexed beneficiary, address indexed token, uint256 indexed amount);

    constructor(
        address owner_,
        address token_,
        uint256 allocation_,
        uint256 vestingStartTimestamp_,
        address stakingGenNftAddress_
    ) {
        if (stakingGenNftAddress_ == address(0)) revert BaseVesting__TokenZeroAddress();
        if (token_ == address(0)) revert BaseVesting__GenesisNftZeroAddress();

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
        address tokenAddress = token;
        if (block.timestamp < vestingStartTimestamp) revert BaseVesting__VestingNotStarted();
        if (amount > releaseableAmount(beneficiary)) revert BaseVesting__NotEnoughTokensVested();
        if (IERC20(tokenAddress).balanceOf(address(this)) < amount) revert BaseVesting__NotEnoughTokensOnContract();

        released += amount;
        amountClaimedByWallet[beneficiary] += amount;

        IERC20(tokenAddress).safeTransfer(beneficiary, amount);

        emit Released(beneficiary, tokenAddress, amount);
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
}
