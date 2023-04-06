// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IInvestmentNFT is IERC721Enumerable {
    /**
     * @notice Mints NFT
     * @param to Token recipient
     * @param value Investment value assigned to token
     */
    function mint(address to, uint256 value) external;

    /**
     * @notice Burns NFT
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external;

    /**
     * @notice Returns summarized investment value from tokens holded by `account`
     * @param account Account for which to retrieve investment value
     * @return Account's investment value
     */
    function getInvestmentValue(address account) external view returns (uint256);

    /**
     * @notice Returns summarized investment value from tokens holded by `account` in specified block number
     * @param account Account for which to retrieve investment value
     * @param blockNumber Block number
     * @return Account's investment value in block
     */
    function getPastInvestmentValue(address account, uint256 blockNumber) external view returns (uint256);

    /**
     * @notice Returns summarized investment value for all tokens within fund
     * @return Total investment value
     */
    function getTotalInvestmentValue() external view returns (uint256);

    /**
     * @notice Returns summarized investment value for all tokens within fund in specified block number
     * @param blockNumber Block number
     * @return Total investment value in block
     */
    function getPastTotalInvestmentValue(uint256 blockNumber) external view returns (uint256);

    /**
     * @notice Returns user participation in fund in the form of user investment value and total value invested in fund
     * @param account User account
     * @return User investment value
     * @return Total fund investment value
     */
    function getUserParticipation(address account) external view returns (uint256, uint256);

    /**
     * @notice Returns user participation in fund in specified block number in the form of user investment value and total value invested in fund
     * @param account User account
     * @param blockNumber Block number for which to retrieve participation
     * @return User investment value
     * @return Total fund investment value
     */
    function getUserParticipationInBlock(address account, uint256 blockNumber) external view returns (uint256, uint256);

    /**
     * @notice Returns wallets holding at least one NFT
     * @return List of wallets
     */
    function getWallets() external view returns (address[] memory);

    /**
     * @notice Returns investment value assigned to NFT
     * @param tokenId Token ID
     * @return Token investment value
     */
    function tokenValue(uint256 tokenId) external returns (uint256);
}
