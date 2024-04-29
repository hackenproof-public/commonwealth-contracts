// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IUniswapWlthPrice {
    /**
     * @notice Emitted when observation time is changed
     * @param oldObservationTime observation time before the change
     * @param newObservationTime observation time after the change
     */
    event ObservationTimeSet(uint32 indexed oldObservationTime, uint32 indexed newObservationTime);

    /**
     * @notice Returns the amount out received for a given exact input based on Uniswap V3 Oracle
     * @param _amountIn The desired WLTH amount
     * @return _amountOut The amount of USDC that would be received
     */
    function estimateAmountOut(uint128 _amountIn) external view returns (uint256 _amountOut);

    /**
     * @notice changes the observation time
     * @param _newObservationTime The desired WLTH amount
     */
    function setObservationTime(uint32 _newObservationTime) external;

    /**
     * @notice Returns WLTH token address
     * @return WLTH token address
     */
    function getWlthTokenAddress() external view returns (address);

    /**
     * @notice Returns USDC token address
     * @return USDC token address
     */
    function getUsdcTokenAddress() external view returns (address);

    /**
     * @notice Returns pool address
     * @return pool address
     */
    function getPoolAddress() external view returns (address);
}
