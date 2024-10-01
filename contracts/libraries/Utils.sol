// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
using SafeERC20Upgradeable for IERC20Upgradeable;

error Utils__CurrencyTransferFailed();

function _add(uint256 a, uint256 b) pure returns (uint256) {
    return a + b;
}

function _subtract(uint256 a, uint256 b) pure returns (uint256) {
    return a - b;
}

function _transferFrom(address erc20Token, address from, address to, uint256 amount) {
    IERC20Upgradeable(erc20Token).safeTransferFrom(from, to, amount);
}

function _transfer(address erc20Token, address to, uint256 amount) {
    IERC20Upgradeable(erc20Token).safeTransfer(to, amount);
}
