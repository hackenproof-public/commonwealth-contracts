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
     * @notice Set minimum amount of USDC to perform buyback
     * @param _minimumBuyback Minimum amount of USDC to perform buyback
     */
    function setMinimumBuyback(uint256 _minimumBuyback) external;

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
}
