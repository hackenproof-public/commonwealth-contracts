// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {BaseVesting} from "./BaseVesting.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error WhitelistedVesting__UnauthorizedAccess();
error WhitelistedVesting__VestingNotStarted();
error WhitelistedVesting__NotEnoughTokensVested();
error WhitelistedVesting__NotEnoughTokensOnContract();

contract WhitelistedVesting is BaseVesting {
    using SafeERC20 for IERC20;
    /**
     * @notice Whitelisted addresses
     */
    mapping(address => bool) public whitelist;

    /**
     * @notice Actual amount of whitelisted addresses
     */
    uint256 public whitelistedAddressesAmount;

    /**
     * @notice Amount of tokens already released by an address
     */
    mapping(address => uint256) public amountReleasedByAddress;

    constructor(
        address owner_,
        address token_,
        uint256 allocationGroupId_,
        uint256 allocation_,
        uint256 duration_,
        uint256 cadence_,
        uint256 vestingStartTimestamp_,
        address[] memory whitelist_
    ) BaseVesting(owner_, token_, allocationGroupId_, allocation_, duration_, cadence_, vestingStartTimestamp_) {
        whitelistedAddressesAmount = whitelist_.length;
        for (uint256 i = 0; i < whitelist_.length; i++) {
            whitelist[whitelist_[i]] = true;
        }
    }

    /**
     * @dev Defines how many tokens can be released by given address
     */
    function releaseableAmount() public view override returns (uint256) {
        require(accessCheck(), "address is not whitelisted");
        return getVestedAmount(block.timestamp) / whitelistedAddressesAmount - amountReleasedByAddress[_msgSender()];
    }

    /**
     * @dev Releases the tokens for whitelisted address
     */
    function release(uint256 amount, address beneficiary) public override {
        address tokenAddress = token;
        if (!accessCheck()) revert WhitelistedVesting__UnauthorizedAccess();
        if (block.timestamp < vestingStartTimestamp) revert WhitelistedVesting__VestingNotStarted();
        if (amount > releaseableAmount()) revert WhitelistedVesting__NotEnoughTokensVested();
        if (IERC20(tokenAddress).balanceOf(address(this)) < amount) revert WhitelistedVesting__NotEnoughTokensOnContract();

        released += amount;
        amountReleasedByAddress[beneficiary] += amount;

        IERC20(tokenAddress).safeTransfer(beneficiary, amount);

        emit Released(beneficiary, tokenAddress, amount);
    }

    /**
     * @dev Allows Owner to add address to whitelist
     */
    function addAddressToWhitelist(address addressToWhitelist) external onlyOwner {
        require(!whitelist[addressToWhitelist], "address is whitelisted already");
        whitelist[addressToWhitelist] = true;
        whitelistedAddressesAmount++;
    }

    /**
     * @dev Allows Owner to remove address from whitelist
     */
    function removeAddressFromWhitelist(address whitelistedAddress) external onlyOwner {
        require(whitelist[whitelistedAddress], "address is not whitelisted");
        whitelist[whitelistedAddress] = false;
        whitelistedAddressesAmount--;
    }

    /**
     * @dev Defines which addresses can release tokens
     */
    function accessCheck() public view override returns (bool) {
        return whitelist[_msgSender()] && whitelistedAddressesAmount > 0;
    }
}
