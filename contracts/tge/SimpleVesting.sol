// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {BaseVesting} from "./BaseVesting.sol";

contract SimpleVesting is BaseVesting {
    /**
     * @notice Address that can release vested tokens
     */
    address public beneficiary;

    constructor(
        address owner_,
        address token_,
        uint256 allocationGroupId_,
        uint256 allocation_,
        uint256 duration_,
        uint256 cadence_,
        uint256 vestingStartTimestamp_,
        address beneficiary_
    ) BaseVesting(owner_, token_, allocationGroupId_, allocation_, duration_, cadence_, vestingStartTimestamp_) {
        beneficiary = beneficiary_;
    }

    /**
     * @dev Returns amount of tokens available to release for actual block timestamp
     */
    function releaseableAmount() public view override returns (uint256) {
        return getVestedAmount(block.timestamp) - released;
    }

    /**
     * @dev Defines which address can release tokens
     */
    function accessCheck() public view override returns (bool) {
        return _msgSender() == beneficiary;
    }

    /**
     * @dev Beneficiary setter
     */
    function setBeneficiary(address beneficiary_) public onlyOwner {
        beneficiary = beneficiary_;
    }
}
