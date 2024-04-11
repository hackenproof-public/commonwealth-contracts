// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ISimpleVesting} from "../interfaces/ISimpleVesting.sol";
import {IWithdrawal} from "../interfaces/IWithdrawal.sol";

error SimpleVesting__OwnerZeroAddress();
error SimpleVesting__WlthZeroAddress();
error SimpleVesting__BeneficiaryZeroAddress();
error SimpleVesting__UnauthorizedAccess();
error SimpleVesting__VestingNotStarted();
error SimpleVesting__NotEnoughTokensVested();
error SimpleVesting__NotEnoughTokensOnContract();
error SimpleVesting__LeftoversWithdrawalLocked();
error SimpleVesting__VestingStartTimestampAlreadyDefined();
error SimpleVesting__PastVestingStartTimestamp();
error SimpleVesting__NoSurplus(uint256 balance, uint256 released, uint256 allocation);

/**
 * @title SimpleVesting
 * @notice Contract for vesting WLTH tokens
 */
contract SimpleVesting is ReentrancyGuard, Ownable, ISimpleVesting, IWithdrawal {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /**
     * @notice WLTH contract token address
     */
    address private immutable i_wlth;

    /**
     * @notice Total token allocation during vesting schedule
     */
    uint256 private immutable i_allocation;

    /**
     * @notice Total vesting duration in seconds
     */
    uint256 private immutable i_duration;

    /**
     * @notice Time after which the new tokens are released
     */
    uint256 private immutable i_cadence;

    /**
     * @notice Delay when leftover tokens can be withdrawn after the vesting is ended.
     */
    uint256 private immutable i_leftoversUnlockDelay;

    /**
     * @notice Address that can release vested tokens
     */
    address private s_beneficiary;

    /**
     * @notice Vesting start block's timestamp
     */
    uint256 private s_vestingStartTimestamp;

    /**
     * @notice Number of already released tokens
     */
    uint256 private s_released;

    /**
     * @notice Contract constructor.
     * @param _owner Contract owner
     * @param _wlth WLTH contract token address
     * @param _beneficiary Address that can release vested tokens
     * @param _allocation Total token allocation during vesting schedule
     * @param _duration Total vesting duration in seconds
     * @param _cadence Time after which the new tokens are released
     * @param _leftoversUnlockDelay Delay when leftover tokens can be withdrawn after the vesting is ended.
     * @param _vestingStartTimestamp Vesting start block's timestamp
     */
    constructor(
        address _owner,
        address _wlth,
        address _beneficiary,
        uint256 _allocation,
        uint256 _duration,
        uint256 _cadence,
        uint256 _leftoversUnlockDelay,
        uint256 _vestingStartTimestamp
    ) {
        if (_owner == address(0)) revert SimpleVesting__OwnerZeroAddress();
        if (_wlth == address(0)) revert SimpleVesting__WlthZeroAddress();
        if (_beneficiary == address(0)) revert SimpleVesting__BeneficiaryZeroAddress();
        if (_vestingStartTimestamp > 0 && _vestingStartTimestamp < block.timestamp)
            revert SimpleVesting__PastVestingStartTimestamp();

        i_wlth = _wlth;
        i_allocation = _allocation;
        i_duration = _duration;
        i_cadence = _cadence;
        i_leftoversUnlockDelay = _leftoversUnlockDelay;
        s_beneficiary = _beneficiary;
        s_vestingStartTimestamp = _vestingStartTimestamp;
        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function release(uint256 _amount, address _beneficiary) external virtual {
        if (!accessCheck()) revert SimpleVesting__UnauthorizedAccess();
        if (block.timestamp < s_vestingStartTimestamp) revert SimpleVesting__VestingNotStarted();
        if (_amount > releaseableAmount()) revert SimpleVesting__NotEnoughTokensVested();
        if (IERC20(i_wlth).balanceOf(address(this)) < _amount) revert SimpleVesting__NotEnoughTokensOnContract();

        s_released += _amount;

        emit Released(_beneficiary, i_wlth, _amount);

        IERC20(i_wlth).safeTransfer(_beneficiary, _amount);
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function setBeneficiary(address _newBeneficiary) external onlyOwner {
        if (_newBeneficiary == address(0)) revert SimpleVesting__BeneficiaryZeroAddress();

        address oldBeneficiary = s_beneficiary;
        s_beneficiary = _newBeneficiary;

        emit BeneficiaryChanged(oldBeneficiary, _newBeneficiary);
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawLeftovers(address _wallet) external override onlyOwner {
        if (
            s_vestingStartTimestamp == 0 ||
            s_vestingStartTimestamp + i_duration + i_leftoversUnlockDelay > block.timestamp
        ) revert SimpleVesting__LeftoversWithdrawalLocked();

        emit LeftoversWithdrawn(_wallet, IERC20(i_wlth).balanceOf(address(this)));

        IERC20(i_wlth).safeTransfer(_wallet, IERC20(i_wlth).balanceOf(address(this)));
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function withdrawSurplus(address _wallet) external override onlyOwner {
        uint256 balance = IERC20(i_wlth).balanceOf(address(this));
        uint256 alreadyReleased = s_released;

        if (balance + alreadyReleased <= i_allocation)
            revert SimpleVesting__NoSurplus(balance, alreadyReleased, i_allocation);

        uint256 surplus = balance + alreadyReleased - i_allocation;

        emit SurplusWithdrawn(_wallet, surplus);

        IERC20(i_wlth).safeTransfer(_wallet, surplus);
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function setVestingStartTimestamp(uint256 _timestamp) external override onlyOwner {
        if (s_vestingStartTimestamp != 0) revert SimpleVesting__VestingStartTimestampAlreadyDefined();
        if (_timestamp < block.timestamp) revert SimpleVesting__PastVestingStartTimestamp();

        s_vestingStartTimestamp = _timestamp;

        emit VestingStartTimestampSetted(_timestamp);
    }

    /**
     * @inheritdoc IWithdrawal
     */
    function leftoversUnlockDelay() external view override returns (uint256) {
        return i_leftoversUnlockDelay;
    }

    /**
     * @notice Returns tokens vested up to the actual timestamp in seconds
     */
    function vestedAmount() public view virtual returns (uint256) {
        if (block.timestamp < s_vestingStartTimestamp) {
            return 0;
        } else if (block.timestamp >= s_vestingStartTimestamp + i_duration) {
            return i_allocation;
        } else {
            return (actualCadence() * i_allocation * i_cadence) / i_duration;
        }
    }

    /**
     * @notice Returns releaseable amount of vesting token. Defined by children vesting contracts
     */
    function releaseableAmount() public view returns (uint256) {
        return vestedAmount() - s_released;
    }

    /**
     * @notice Defines which address or addresses can release vested tokens
     */
    function accessCheck() public view returns (bool) {
        return _msgSender() == s_beneficiary;
    }

    /**
     * @notice calculates actual cadence
     */
    function actualCadence() public view returns (uint256) {
        return (block.timestamp - s_vestingStartTimestamp) / i_cadence;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function wlth() external view override returns (address) {
        return i_wlth;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function duration() external view override returns (uint256) {
        return i_duration;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function cadence() external view override returns (uint256) {
        return i_cadence;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function vestingStartTimestamp() external view override returns (uint256) {
        return s_vestingStartTimestamp;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function allocation() external view override returns (uint256) {
        return i_allocation;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function beneficiary() external view override returns (address) {
        return s_beneficiary;
    }

    /**
     * @inheritdoc ISimpleVesting
     */
    function released() external view override returns (uint256) {
        return s_released;
    }
}
