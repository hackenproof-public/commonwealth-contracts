// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * @title Investment Fund interface
 */
interface IInvestmentFund {
    /**
     * @dev Emitted when user invests in fund
     * @param investor Investor address
     * @param currency Currency used for investment
     * @param value Amount of tokens spent for investment
     * @param fee Amount of tokens spent for fee
     */
    event Invested(address indexed investor, address indexed currency, uint256 value, uint256 fee);

    /**
     * @dev Emitted when investment cap is reached
     * @param investor Investor address
     * @param currency Currency used for investment
     * @param amount Amount of tokens invested
     * @param cap Cap value
     */
    event CapReached(address indexed investor, address currency, uint256 amount, uint256 cap);

    /**
     * @dev Invests `amount` number of USD Coin tokens to investment fund.
     *
     * Requirements:
     * - `amount` must be greater than zero.
     * - Caller must have been allowed in USD Coin to move this token by {approve}.
     *
     * Emits a {Invested} event.
     *
     * @param amount Amount of tokens to be invested
     */
    function invest(uint240 amount) external;
}
