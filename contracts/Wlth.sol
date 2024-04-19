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

    /**
     * @notice WLTH constructor
     * @param _name Name of the token
     * @param _symbol Symbol of the token
     */
    constructor(string memory _name, string memory _symbol, address _wallet) ERC20(_name, _symbol) {
        _mint(_wallet, 1e9 * 1e18); // 1 billion WLTH
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
