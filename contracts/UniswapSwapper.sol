// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/ISwapper.sol";

contract UniswapSwapper is ISwapper, ReentrancyGuard {
    ISwapRouter public swapRouter;
    uint24 private feeTier;

    constructor(address _swapRouter, uint24 _feeTier) {
        swapRouter = ISwapRouter(_swapRouter);
        feeTier = _feeTier;
    }

    function swap(uint256 amountIn, address sourceToken, address targetToken) external nonReentrant returns (uint256) {
        TransferHelper.safeTransferFrom(sourceToken, msg.sender, address(this), amountIn);

        TransferHelper.safeApprove(sourceToken, address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: sourceToken,
            tokenOut: targetToken,
            fee: feeTier,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        emit Swapped(msg.sender, amountIn, sourceToken, amountOut, targetToken);

        return amountOut;
    }
}
