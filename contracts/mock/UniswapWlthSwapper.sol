// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;
pragma abicoder v2;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {IWlthQuoter} from "../interfaces/IWlthQuoter.sol";
import {IWlthSwapper} from "../interfaces/IWlthSwapper.sol";
import {OwnablePausable} from "../OwnablePausable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract UniswapWlthSwapper is ReentrancyGuardUpgradeable, OwnablePausable, IWlthSwapper {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Context_init();
        __OwnablePausable_init(_owner);
        __ReentrancyGuard_init();
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable nonReentrant returns (uint256) {
        revert("Not implemented yet");
    }
}
