// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IDexQuoter {
    /**
     * @notice Returns the amount out received for a given exact input but for a swap of a single pool
     * @param tokenIn Address of token being swapped in
     * @param tokenOut Address of token being swapped out
     * @param amountIn The desired input amount
     * @return amountOut The amount of `tokenOut` that would be received
     * @return sqrtPriceX96After The sqrt price of the pool after the swap
     * @return initializedTicksCrossed The number of initialized ticks that the swap crossed
     * @return gasEstimate The estimate of the gas that the swap consumes
     */
    function quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    )
        external
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate);
}
