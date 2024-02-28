// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;

import {IWlthQuoter} from "../interfaces/IWlthQuoter.sol";
import {OwnablePausable} from "../OwnablePausable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract UniswapWlthQuoter is ReentrancyGuardUpgradeable, OwnablePausable, IWlthQuoter {
    uint256 public actualWlthPriceInUsdc;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Context_init();
        __OwnablePausable_init(_owner);
        __ReentrancyGuard_init();
    }

    function quoteExactInputSingle(
        QuoteExactInputSingleParams memory params
    )
        external
        nonReentrant
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
    {
        return ((actualWlthPriceInUsdc * params.amountIn) / 1e18, 0, 0, 0);
    }

    function setActualWlthPriceInUsdc(uint256 _wlthPrice) external onlyOwner {
        actualWlthPriceInUsdc = _wlthPrice;
    }
}
