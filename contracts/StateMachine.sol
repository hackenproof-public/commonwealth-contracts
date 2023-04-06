// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

contract StateMachine {
    /**
     * @notice Current state
     */
    bytes32 public currentState;

    mapping(bytes32 => mapping(bytes4 => bool)) internal functionsAllowed;

    /**
     * @dev Limits access for current state
     * @dev Only functions allowed using allowFunction are permitted
     */
    modifier onlyAllowedStates() {
        require(functionsAllowed[currentState][msg.sig], "Not allowed in current state");
        _;
    }

    constructor(bytes32 initialState) {
        currentState = initialState;
    }

    function allowFunction(bytes32 state, bytes4 selector) internal {
        functionsAllowed[state][selector] = true;
    }
}
