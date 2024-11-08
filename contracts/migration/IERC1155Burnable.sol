// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC1155Burnable {
    function burn(address account, uint256 id, uint256 value) external;
}
