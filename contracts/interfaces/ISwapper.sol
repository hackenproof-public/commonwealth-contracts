// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title ISwapper interface
 */
interface ISwapper {
    /**
     * @notice Emitted when tokens are swapped
     * @param caller address initiating a swap
     * @param amountIn amount of sourceToken to be used to initialise a swap
     * @param sourceToken address of ERC20 contract for a source token
     * @param amountOut amount of targetToken acquired from a swap
     * @param targetToken address of ERC20 contract for a target token
     */
    event Swapped(
        address indexed caller,
        uint256 amountIn,
        address sourceToken,
        uint256 amountOut,
        address targetToken
    );

    /**
     * @notice Emitted when changed the SwapRouter02 address
     * @param oldAddress old SwapRouter02 address
     * @param newAddress new SwapRouter02 address
     */
    event SwapRouterSet(address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Executes a DeFi swap from a sourceToken to targetToken
     * @param _amountIn amount of sourceToken to be used to initialise a swap
     * @param _sourceToken address of ERC20 contract for a source token
     * @param _targetToken address of ERC20 contract for a target token
     * @param _amountOutMinimum percentage of slippage
     * @param _sqrtPriceLimitX96 slippage protection
     * @return _amountOut amount of targetToken acquired after the swap
     */
    function swap(
        uint256 _amountIn,
        address _sourceToken,
        address _targetToken,
        uint24 _feeTier,
        uint256 _amountOutMinimum,
        uint160 _sqrtPriceLimitX96
    ) external returns (uint256 _amountOut);

    /**
     * @notice returns the SwapRouter02 address
     * @return The SwapRouter02 address
     */
    function getIV3SwapRouterAddress() external view returns (address);

    /**
     * @notice sets new SwapRouter02 address
     * @param _newSwapRouter new SwapRouter02 address
     */

    function setIV3SwapRouterAddress(address _newSwapRouter) external;
}
