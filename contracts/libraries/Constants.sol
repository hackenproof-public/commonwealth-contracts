// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

uint256 constant BASIS_POINT_DIVISOR = 10000; // 100% in basis points
uint256 constant LOWEST_CARRY_FEE = 1000; // 10% in basis points
uint256 constant MINIMUM_INVESTMENT = 50000000; // 50 USDC
uint256 constant EXTRA_EIGHTEEN_ZEROS = 10 ** 18; // extra multiplyer used for proper bigint divison
