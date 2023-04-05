// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title WLTH contract
 */
contract Wlth is ERC20 {
    /**
     * @dev Initializes the contract
     */
    constructor() ERC20("Common Wealth Token", "WLTH") {
        _mint(_msgSender(), 1e9 * 1e18); // 1 billion WLTH
    }
}
