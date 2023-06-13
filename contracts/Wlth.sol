// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/**
 * @title WLTH contract
 */
contract Wlth is ERC20Upgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param name Token name
     * @param symbol Token symbol
     */
    function initialize(string memory name, string memory symbol) public initializer {
        __Context_init();
        __ERC20_init(name, symbol);

        // TODO Token distribution will be defined according to token allocation table
        _mint(_msgSender(), 1e9 * 1e18); // 1 billion WLTH
    }

    uint256[50] private __gap;
}
