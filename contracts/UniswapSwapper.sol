// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.18;
pragma abicoder v2;

import {IV3SwapRouter} from "@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error UniswapSwapper__IV3SwapRouterZeroAddress();

contract UniswapSwapper is OwnablePausable, ISwapper, ReentrancyGuardUpgradeable {
    /**
     * @notice Swap router abstraction
     */
    IV3SwapRouter private s_swapRouter;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param _owner Address of contract owner
     * @param _swapRouter Address of router for swaps execution
     */
    function initialize(address _owner, address _swapRouter) public initializer {
        if (_swapRouter == address(0)) revert UniswapSwapper__IV3SwapRouterZeroAddress();
        __Context_init();
        __OwnablePausable_init(_owner);
        s_swapRouter = IV3SwapRouter(_swapRouter);
    }

    /**
     * @inheritdoc ISwapper
     */
    function swap(
        uint256 _amountIn,
        address _sourceToken,
        address _targetToken,
        uint24 _feeTier,
        uint256 _amountOutMinimum,
        uint160 _sqrtPriceLimitX96
    ) external nonReentrant whenNotPaused returns (uint256) {
        TransferHelper.safeTransferFrom(_sourceToken, msg.sender, address(this), _amountIn);

        TransferHelper.safeApprove(_sourceToken, address(s_swapRouter), _amountIn);

        IV3SwapRouter.ExactInputSingleParams memory params = IV3SwapRouter.ExactInputSingleParams({
            tokenIn: _sourceToken,
            tokenOut: _targetToken,
            fee: _feeTier,
            recipient: msg.sender,
            amountIn: _amountIn,
            amountOutMinimum: _amountOutMinimum,
            sqrtPriceLimitX96: _sqrtPriceLimitX96 // this must be set to protect against price slippage!
        });

        uint256 amountOut = s_swapRouter.exactInputSingle(params);
        emit Swapped(msg.sender, _amountIn, _sourceToken, amountOut, _targetToken);

        return amountOut;
    }

    /**
     * @inheritdoc ISwapper
     */
    function setIV3SwapRouterAddress(address _newSwapRouter) external onlyOwner {
        if (_newSwapRouter == address(0)) revert UniswapSwapper__IV3SwapRouterZeroAddress();
        address oldAddress = address(s_swapRouter);
        s_swapRouter = IV3SwapRouter(_newSwapRouter);
        emit SwapRouterSet(oldAddress, _newSwapRouter);
    }

    /**
     * @inheritdoc ISwapper
     */
    function getIV3SwapRouterAddress() external view returns (address) {
        return address(s_swapRouter);
    }

    uint256[48] private __gap;
}
