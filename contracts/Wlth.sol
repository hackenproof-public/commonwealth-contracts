// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IWlth} from "./interfaces/IWlth.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title WLTH contract
 */
contract Wlth is ERC20, IWlth {
    /**
     * @notice Amount of burned tokens
     */
    uint256 private s_burned;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(_msgSender(), 1e9 * 1e18); // 1 billion WLTH
    }

    /**
     * @inheritdoc IWlth
     */
    function burn(uint256 _amount) external override {
        _burn(_msgSender(), _amount);
        s_burned += _amount;
    }

    /**
     * @inheritdoc IWlth
     */
    function burned() external view override returns (uint256) {
        return s_burned;
    }
}
