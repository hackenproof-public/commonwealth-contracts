// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

library LibFund {
    uint256 public constant FEE_DIVISOR = 10000;

    bytes32 public constant STATE_EMPTY = "Empty";
    bytes32 public constant STATE_FUNDS_IN = "FundsIn";
    bytes32 public constant STATE_CAP_REACHED = "CapReached";
    bytes32 public constant STATE_FUNDS_DEPLOYED = "FundsDeployed";
    bytes32 public constant STATE_ACTIVE = "Active";
    bytes32 public constant STATE_BREAKEVEN = "Breakeven";
    bytes32 public constant STATE_CLOSED = "Closed";
}
