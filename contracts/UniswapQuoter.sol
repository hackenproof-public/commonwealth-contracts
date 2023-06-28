// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;

import {IQuoterV2} from "@uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IDexQuoter} from "./interfaces/IDexQuoter.sol";

contract UniswapQuoter is ReentrancyGuardUpgradeable, IDexQuoter {
    IQuoterV2 private quoter;
    uint24 private feeTier;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _quoter, uint24 _feeTier) public initializer {
        quoter = IQuoterV2(_quoter);
        feeTier = _feeTier;
    }

    function quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    )
        external
        nonReentrant
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
    {
        IQuoterV2.QuoteExactInputSingleParams memory params = IQuoterV2.QuoteExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            fee: feeTier,
            sqrtPriceLimitX96: 0 // this must be set to protect against price slippage!
        });

        return quoter.quoteExactInputSingle(params);
    }

    uint256[48] private __gap;
}
