// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";

interface IInvestmentNFT is IERC721EnumerableUpgradeable {
    /**
     * @notice Emitted when token URI is changed
     * @param caller Address which changed token URI
     * @param tokenId ID of token for which URI was changed
     * @param uri New token URI
     */
    event TokenURIChanged(address indexed caller, uint256 indexed tokenId, string uri);

    /**
     * @notice Emitted when new minter account is added to contract
     * @param caller Address which added minter
     * @param account Address of new minter
     */
    event MinterAdded(address indexed caller, address indexed account);

    /**
     * @notice Emitted when minter account is removed from contract
     * @param caller Address which removed minter
     * @param account Address of removed minter
     */
    event MinterRemoved(address indexed caller, address indexed account);

    /**
     * @notice Emitted when NFT is splitted
     * @param caller Address which removed minter
     * @param tokenId ID of splitted token
     */
    event TokenSplitted(address indexed caller, uint256 indexed tokenId);

    /**
     * @notice Mints NFT with specified investment value and metadata URI
     * @param to Token recipient
     * @param value Investment value assigned to token
     * @param tokenUri URI of token metadata
     */
    function mint(address to, uint256 value, string calldata tokenUri) external;

    /**
     * @notice Splits one NFT into multiple unique tokens
     * @dev Burns NFT indended for split and mints multiple ones in the place of the former one. Sum of values must equal to the value of splitted NFT
     * @param tokenId Token ID to split
     * @param values List of new tokens values
     * @param values List of new tokens metadata URIs
     */
    function split(uint256 tokenId, uint256[] calldata values, string[] calldata tokenUris) external;

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
     * @notice Returns account share of the fund in the form of account investment value and total value invested in fund
     * @param account Account address
     * @return Account investment value
     * @return Total fund investment value
     */
    function getParticipation(address account) external view returns (uint256, uint256);

    /**
     * @notice Returns account share of the fund in specified block number in the form of account investment value and total value invested in fund
     * @param account Account address
     * @param blockNumber Block number for which to retrieve share
     * @return Account investment value
     * @return Total fund investment value
     */
    function getPastParticipation(address account, uint256 blockNumber) external view returns (uint256, uint256);

    /**
     * @notice Returns accounts holding at least one NFT
     * @return List of accounts
     */
    function getInvestors() external view returns (address[] memory);

    /**
     * @notice Returns investment value assigned to NFT
     * @param tokenId Token ID
     * @return Token investment value
     */
    function tokenValue(uint256 tokenId) external returns (uint256);
}
