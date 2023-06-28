// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title State Machine interface
 */
interface IStateMachine {
    /**
     * @notice Returns current state
     */
    function currentState() external view returns (bytes32);
}
