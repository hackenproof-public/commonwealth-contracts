// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IVesting} from "./IVesting.sol";

/**
 * @title IPeriodicVesting interface
 */
interface IPeriodicVesting is IVesting {
    struct VestingPeriod {
        uint256 allocation; // total number of tokens to be vested
        uint256 duration; // duration
        uint256 cadence; // frequency of token vesting
        uint256 cliff; // cliff
    }

    struct VestingDetails {
        address vestedToken; // address of vested token
        address beneficiary; // the address that can release vested tokens
        uint256 startTimestamp; // vesting start timestamp
        VestingPeriod[] periods; // vesting periods
    }

    /**
     * @notice Returns vesting details
     * @return Vesting details
     */
    function getDetails() external view returns (VestingDetails memory);
}
