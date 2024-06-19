// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

interface IProfitProvider {
    /**
     * @notice Emitted when a profit is provided
     * @param amount The amount of profit provided
     */
    event ProfitProvided(uint256 amount);

    /**
     * @notice Emitted when the minimum profit is set
     * @param minimumProfit The new minimum profit
     */
    event MinimumProfitSet(uint256 minimumProfit);

    /**
     * @notice Set the minimum profit
     * @param _minimumProfit The new minimum profit
     
     */
    function setMinimumProfit(uint256 _minimumProfit) external;

    /**
     * @notice Get the fund address
     * @return The fund address
     */
    function fund() external view returns (address);

    /**
     * @notice Get the currency address
     * @return The currency address
     */
    function currency() external view returns (address);

    /**
     * @notice Get the minimum profit
     * @return The minimum profit
     */
    function minimumProfit() external view returns (uint256);
}
