// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {IPeriodicVesting, IVesting} from "./interfaces/IPeriodicVesting.sol";

/**
 * @title Periodic vesting schedule contract
 */
contract PeriodicVesting is IPeriodicVesting, ERC165Upgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @notice Vested token address
     */
    address private token;

    /**
     * @notice Address that can release vested tokens
     */
    address public beneficiary;

    /**
     * @notice Vesting start timestamp
     */
    uint256 public startTimestamp;

    /**
     * @notice Vesting periods
     */
    IPeriodicVesting.VestingPeriod[] public periods;

    /**
     * @notice Total token allocation during vesting schedule
     */
    uint256 public totalAllocation;

    /**
     * @notice Total vesting duration in seconds
     */
    uint256 public totalDuration;

    /**
     * @notice Number of already released tokens
     */
    uint256 public released;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param token_ Vested token implementing IERC20 interface
     * @param beneficiary_ Address that can release vested tokens
     * @param startTimestamp_ Vesting start timestamp
     * @param periods_ Vesting periods
     */
    function initialize(
        address token_,
        address beneficiary_,
        uint256 startTimestamp_,
        IPeriodicVesting.VestingPeriod[] memory periods_
    ) public initializer {
        require(token_ != address(0), "Token is zero address");
        require(beneficiary_ != address(0), "Beneficiary is zero address");
        _validatePeriods(periods_);

        token = token_;
        beneficiary = beneficiary_;
        startTimestamp = startTimestamp_;

        uint256 allocation = 0;
        uint256 duration = 0;
        for (uint256 i = 0; i < periods_.length; i++) {
            periods.push(periods_[i]);
            allocation += periods_[i].allocation;
            duration += periods_[i].duration;
        }

        totalAllocation = allocation;
        totalDuration = duration;
    }

    /**
     * @inheritdoc IVesting
     */
    function release(uint256 amount) external virtual {
        require(msg.sender == beneficiary, "Unauthorized access");
        require(amount <= getReleasableAmount(), "Not enough tokens vested");

        released += amount;
        emit Released(msg.sender, token, amount);

        IERC20Upgradeable(token).safeTransfer(beneficiary, amount);
    }

    /**
     * @inheritdoc IVesting
     */
    function getReleasableAmount() public view virtual returns (uint256) {
        return getVestedAmount(block.timestamp) - released;
    }

    /**
     * @inheritdoc IVesting
     */
    function getVestedAmount(uint256 timestamp) public view virtual returns (uint256) {
        if (timestamp < startTimestamp) {
            return 0;
        } else if (timestamp >= startTimestamp + totalDuration) {
            return totalAllocation;
        } else {
            IPeriodicVesting.VestingPeriod[] memory _periods = periods;
            uint256 vested = 0;
            uint256 periodStart = startTimestamp;

            for (uint256 i = 0; i < _periods.length; i++) {
                vested += _getVestedAmountInPeriod(timestamp, periodStart, _periods[i]);

                uint256 nextPeriodStart = periodStart + _periods[i].duration;
                if (timestamp < nextPeriodStart) {
                    break;
                } else {
                    periodStart = nextPeriodStart;
                }
            }

            return vested;
        }
    }

    /**
     * @inheritdoc IPeriodicVesting
     */
    function getDetails() external view returns (IPeriodicVesting.VestingDetails memory) {
        return IPeriodicVesting.VestingDetails(token, beneficiary, startTimestamp, periods);
    }

    /**
     * @inheritdoc IVesting
     */
    function getVestedToken() external view returns (address) {
        return token;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IPeriodicVesting).interfaceId ||
            interfaceId == type(IVesting).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _validatePeriods(IPeriodicVesting.VestingPeriod[] memory periods_) internal pure {
        for (uint256 i = 0; i < periods_.length; i++) {
            IPeriodicVesting.VestingPeriod memory period = periods_[i];
            require(period.cadence <= period.duration, "Invalid vesting cadence");
            if (period.duration > 0) {
                require(period.cadence > 0, "Invalid vesting cadence");
            }
            require(period.cliff <= period.duration, "Cliff period greater than duration");
        }
    }

    function _getVestedAmountInPeriod(
        uint256 timestamp,
        uint256 periodStart,
        IPeriodicVesting.VestingPeriod memory period
    ) private pure returns (uint256) {
        if (timestamp < periodStart + period.cliff) {
            return 0;
        } else if (timestamp >= periodStart + period.duration) {
            return period.allocation;
        } else {
            uint256 elapsedTime = timestamp - periodStart;
            uint256 vestedCadences = elapsedTime / period.cadence;
            uint256 vestedTime = vestedCadences * period.cadence;

            return (period.allocation * vestedTime) / period.duration;
        }
    }

    uint256[43] private __gap;
}
