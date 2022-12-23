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
     * @param amount Amount of tokens invested
     * @param tokenId Investment NFT token ID minted to investor
     */
    event Invested(address indexed investor, address indexed currency, uint256 indexed amount, uint256 tokenId);

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
    function invest(uint256 amount) external;
}
