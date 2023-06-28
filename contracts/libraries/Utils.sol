// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

function _add(uint256 a, uint256 b) pure returns (uint256) {
    return a + b;
}

function _subtract(uint256 a, uint256 b) pure returns (uint256) {
    return a - b;
}

function _transferFrom(address erc20Token, address from, address to, uint256 amount) {
    require(IERC20Upgradeable(erc20Token).transferFrom(from, to, amount), "Currency transfer failed");
}

function _transfer(address erc20Token, address to, uint256 amount) {
    require(IERC20Upgradeable(erc20Token).transfer(to, amount), "Currency transfer failed");
}
