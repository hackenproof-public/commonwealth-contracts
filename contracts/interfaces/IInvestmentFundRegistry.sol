// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * @title Investment Fund interface
 */
interface IInvestmentFundRegistry {
    /**
     * @dev Emitted when new investment fund is created
     * @param fundAddress Address of new investment fund
     */
    event FundAddedToRegistry(address indexed fundAddress);

    /**
     * @dev Emitted when investment fund is removed
     * @param fundAddress Address of removed fund
     */
    event FundRemovedFromRegistry(address indexed fundAddress);

    /**
     * @dev Adds investment fund to registry.
     *
     * Emits a {FundAddedToRegistry} event.
     *
     * @param fundAddress Address of investment fund
     */
    function addFund(address fundAddress) external;

    /**
     * @dev Returns number of investment funds in registry.
     */
    function getFundsCount() external view returns (uint256);

    /**
     * @dev Returns list of investment funds.
     */
    function listFunds() external view returns (address[] memory);

    /**
     * @dev Removes investment fund from registry.
     *
     * Emits a {FundRemovedFromRegistry} event.
     *
     * @param fundAddress Address of fund to remove
     */
    function removeFund(address fundAddress) external;
}
