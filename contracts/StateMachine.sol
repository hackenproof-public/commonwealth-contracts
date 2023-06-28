// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IStateMachine} from "./interfaces/IStateMachine.sol";

contract StateMachine is IStateMachine, Initializable {
    /**
     * @dev Current state
     */
    bytes32 public currentState;

    mapping(bytes32 => mapping(bytes4 => bool)) internal functionsAllowed;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // solhint-disable-next-line func-name-mixedcase
    function __StateMachine_init(bytes32 initialState) internal onlyInitializing {
        __StateMachine_init_unchained(initialState);
    }

    // solhint-disable-next-line func-name-mixedcase
    function __StateMachine_init_unchained(bytes32 initialState) internal onlyInitializing {
        currentState = initialState;
    }

    /**
     * @dev Limits access for current state
     * @dev Only functions allowed using allowFunction are permitted
     */
    modifier onlyAllowedStates() {
        require(functionsAllowed[currentState][msg.sig], "Not allowed in current state");
        _;
    }

    function allowFunction(bytes32 state, bytes4 selector) internal {
        functionsAllowed[state][selector] = true;
    }

    uint256[48] private __gap;
}
