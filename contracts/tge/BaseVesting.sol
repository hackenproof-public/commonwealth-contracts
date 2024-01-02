// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

error BaseVesting__UnauthorizedAccess();
error BaseVesting__VestingNotStarted();
error BaseVesting__NotEnoughTokensVested();
error BaseVesting__NotEnoughTokensOnContract();

/**
 * @title Base vesting schedule contract
 */
abstract contract BaseVesting is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /**
     * @notice Vested token address
     */
    address public token;

    /**
     * @notice Allocation group represented by this contract
     */
    uint256 public allocationGroupId;

    /**
     * @notice Total token allocation during vesting schedule
     */
    uint256 public allocation;

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
     * @notice Emitted when token released from vesting contract
     * @param beneficiary Wallet that released tokens
     * @param token Token address
     * @param amount Amount released
     */
    event Released(address indexed beneficiary, address indexed token, uint256 indexed amount);

    /**
     * @notice Initializes the contract
     * @param token_ Vested token implementing IERC20 interface
     * @param allocationGroupId_ ID of allocation group represented by this contract
     * @param allocation_ total token allocation
     * @param duration_ total vesting duration in seconds
     * @param cadence_ Vesting cadence
     * @param vestingStartTimestamp_ Vesting start as unix timestamp in seconds
     */
    constructor(
        address owner_,
        address token_,
        uint256 allocationGroupId_,
        uint256 allocation_,
        uint256 duration_,
        uint256 cadence_,
        uint256 vestingStartTimestamp_
    ) {
        token = token_;
        allocationGroupId = allocationGroupId_;
        allocation = allocation_;
        duration = duration_;
        cadence = cadence_;
        vestingStartTimestamp = vestingStartTimestamp_;
        _transferOwnership(owner_);
    }

    /**
     * @dev Release the tokens from this contract to the beneficiary
     */
    function release(uint256 amount, address beneficiary) public virtual {
        address tokenAddress = token;
        if (!accessCheck()) revert BaseVesting__UnauthorizedAccess();
        if (block.timestamp < vestingStartTimestamp) revert BaseVesting__VestingNotStarted();
        if (amount > releaseableAmount()) revert BaseVesting__NotEnoughTokensVested();
        if (IERC20(tokenAddress).balanceOf(address(this)) < amount) revert BaseVesting__NotEnoughTokensOnContract();

        released += amount;

        IERC20(tokenAddress).safeTransfer(beneficiary, amount);

        emit Released(beneficiary, tokenAddress, amount);
    }

    /**
     * @dev Returns tokens vested up to the actual timestamp in seconds
     */
    function getVestedAmount(uint256 actualTimestamp) public view virtual returns (uint256) {
        if (actualTimestamp < vestingStartTimestamp) {
            return 0;
        } else if (actualTimestamp >= vestingStartTimestamp + duration) {
            return allocation;
        } else {
            uint256 cadencesAmount = (actualTimestamp - vestingStartTimestamp) / cadence;
            return (cadencesAmount * allocation * cadence) / duration;
        }
    }

    /**
     * @dev Returns address of vested token
     */
    function getVestedToken() external view returns (address) {
        return token;
    }

    /**
     * @dev Returns releaseable amount of vesting token. Defined by children vesting contracts
     */
    function releaseableAmount() public view virtual returns (uint256);

    /**
     * @dev Defines which address or addresses can release vested tokens. Defined by children vesting contracts
     */
    function accessCheck() public view virtual returns (bool) {
        return true;
    }
}
