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
     * @notice Executes a DeFi swap from a sourceToken to targetToken
     * @param amountIn amount of sourceToken to be used to initialise a swap
     * @param sourceToken address of ERC20 contract for a source token
     * @param targetToken address of ERC20 contract for a target token
     * @param slippageLimit percentage of slippage
     * @return amountOut amount of targetToken acquired after the swap
     */
    function swap(
        uint256 amountIn,
        address sourceToken,
        address targetToken,
        uint256 slippageLimit
    ) external returns (uint256 amountOut);
}
