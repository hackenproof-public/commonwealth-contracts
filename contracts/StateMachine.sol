// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IInvestmentFund.sol";
import "./interfaces/IInvestmentNFT.sol";
import "./LibFund.sol";

contract StateMachine {
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
