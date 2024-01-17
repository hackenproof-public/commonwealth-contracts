// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;
pragma abicoder v2;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error UniswapSwapper__DexSwapRouterZeroAddress();

contract UniswapSwapper is OwnablePausable, ISwapper, ReentrancyGuardUpgradeable {
    ISwapRouter public swapRouter;
    uint24 private feeTier;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param _owner Address of contract owner
     * @param _swapRouter Address of router for swaps execution
     * @param _feeTier Fee tier value
     */
    function initialize(address _owner, address _swapRouter, uint24 _feeTier) public initializer {
        if (_swapRouter == address(0)) revert UniswapSwapper__DexSwapRouterZeroAddress();
        __Context_init();
        __OwnablePausable_init(_owner);
        swapRouter = ISwapRouter(_swapRouter);
        feeTier = _feeTier;
    }

    function swap(
        uint256 amountIn,
        address sourceToken,
        address targetToken,
        uint256 slippageLimit
    ) external nonReentrant whenNotPaused returns (uint256) {
        TransferHelper.safeTransferFrom(sourceToken, msg.sender, address(this), amountIn);

        TransferHelper.safeApprove(sourceToken, address(swapRouter), amountIn);

        uint256 amountTargetToken = ((1000 - slippageLimit) * amountIn) / 1000;

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: sourceToken,
            tokenOut: targetToken,
            fee: feeTier,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: amountTargetToken,
            sqrtPriceLimitX96: 0 // this must be set to protect against price slippage!
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        emit Swapped(msg.sender, amountIn, sourceToken, amountOut, targetToken);

        return amountOut;
    }

    uint256[48] private __gap;
}
