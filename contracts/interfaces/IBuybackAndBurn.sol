// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IBuybackAndBurn {
    /**
     * @notice Emit when buyback and burn is performed
     * @param wlthBurned Amount of WLTH burned
     * @param usdcSwapped Amount of USDC swapped
     */
    event BuybackAndBurnPerformed(uint256 wlthBurned, uint256 usdcSwapped);

    /**
     * @notice Emit when minimum buyback amount is updated
     * @param minimumBuyback New minimum buyback amount
     */
    event MinimumBuybackSet(uint256 minimumBuyback);

    /**
     * @notice Emit when slippage percentage is updated
     * @param slippageInBasisPoints New slippage percentage
     */
    event SlippageSet(uint256 slippageInBasisPoints);

    /**
     * @notice Set minimum amount of USDC to perform buyback
     * @param _minimumBuyback Minimum amount of USDC to perform buyback
     */
    function setMinimumBuyback(uint256 _minimumBuyback) external;

    /**
     * @notice Set slippage percentage
     * @param _slippageInBasisPoints Slippage percentage
     */
    function setSlippage(uint256 _slippageInBasisPoints) external;

    /**
     * @notice Get minimum amount of USDC to perform buyback
     * @return Minimum amount of USDC to perform buyback
     */
    function minimumBuyback() external view returns (uint256);

    /**
     * @notice Get address of UniswapSwapper contract
     * @return Address of UniswapSwapper contract
     */
    function swapper() external view returns (address);

    /**
     * @notice Get address of WLTH token
     * @return Address of WLTH token
     */
    function wlth() external view returns (address);

    /**
     * @notice Get address of USDC token
     * @return Address of USDC token
     */
    function usdc() external view returns (address);

    /**
     * @notice Get address of USDC/WLTH Uniswap V3 pool
     * @return Address of USDC/WLTH Uniswap V3 pool
     */
    function pool() external view returns (address);

    /**
     * @notice Get slippage percentage
     * @return Slippage percentage
     */
    function slippageInBasisPoints() external view returns (uint256);

    /**
     * @notice Get address of UniswapWlthPrice contract
     * @return Address of UniswapWlthPrice contract
     */
    function wlthPriceOracle() external view returns (address);
}
