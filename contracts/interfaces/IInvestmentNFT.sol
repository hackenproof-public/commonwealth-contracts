// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";

interface IInvestmentNFT is IERC721EnumerableUpgradeable {
    /**
     * @notice Metadata structure for NFT
     */
    struct Metadata {
        string name;
        string description;
        string image;
        string externalUrl;
    }

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
     * @notice Emitted when metadata for NFT is changed
     * @param name Metadata name
     * @param description Metadata description
     * @param image Metadata image
     * @param externalUrl Metadata external URL
     */
    event MetadataChanged(string indexed name, string indexed description, string indexed image, string externalUrl);

    /**
     * @notice Emitted when metadata name for NFT is changed
     * @param name Metadata name
     */
    event MetadataNameChanged(string indexed name);

    /**
     * @notice Emitted when metadata description for NFT is changed
     * @param description Metadata description
     */
    event MetadataDescriptionChanged(string indexed description);

    /**
     * @notice Emitted when metadata image for NFT is changed
     * @param image Metadata image
     */
    event MetadataImageChanged(string indexed image);

    /**
     * @notice Emitted when metadata external URL for NFT is changed
     * @param externalUrl Metadata external URL
     */
    event MetadataExternalUrlChanged(string indexed externalUrl);

    /**
     * @notice Emitted when minimum value for NFT is changed
     * @param value New minimum value
     */
    event MinimumValueChanged(uint256 indexed value);

    // /**
    //  * @notice Emitted when Marketplace address is changed
    //  * @param marketplaceAddress address of the marketplace
    //  */
    // event MarketplaceAddressChanged(address marketplaceAddress);

    /**
     * @notice Emitted when series1 boolean is changed
     * @param newAddress new address which will receive royalty
     * @param value royalty percent in basis points (1/100 of a percent)
     */
    event RoyaltyChanged(address indexed newAddress, uint96 indexed value);

    /**
     * @notice Mints NFT with specified investment value and metadata URI
     * @param to Token recipient
     * @param value Investment value assigned to token
     */
    function mint(address to, uint256 value) external;

    /**
     * @notice Splits one NFT into multiple unique tokens
     * @dev Burns NFT indended for split and mints multiple ones in the place of the former one. Sum of values must equal to the value of splitted NFT
     * @param tokenId Token ID to split
     * @param values List of new tokens values
     * @param values List of new tokens metadata URIs
     */
    function split(uint256 tokenId, uint256[] calldata values) external;

    /**
     * @notice Sets buyback and burn address
     * @param _address Address where royalty should be send
     * @param _value Royalty value
     */
    function setRoyalty(address _address, uint96 _value) external;

    /**
     * @notice Set new metadata name
     * @param _name New metadata name
     */
    function setMetadataName(string memory _name) external;

    /**
     * @notice Set new metadata description
     * @param _description New metadata description
     */
    function setMetadataDescription(string memory _description) external;

    /**
     * @notice Set new metadata image
     * @param _image New metadata image
     */
    function setMetadataImage(string memory _image) external;

    /**
     * @notice Set new metadata external URL
     * @param _extenralUrl New metadata external URL
     */
    function setMetadataExternalUrl(string memory _extenralUrl) external;

    /**
     * @notice Set all metadata at once
     * @param _metadata Metadata structure
     */
    function setAllMetadata(Metadata memory _metadata) external;

    /**
     * @notice Set minimum value for NFT
     * @param _minimumValue New minimum value
     */
    function setMinimumValue(uint256 _minimumValue) external;

    /**
     * @notice Set NFT marketplace address
     * @param _address New marketplace address
     */
    function setMarketplaceAddress(address _address) external;

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
     * @notice Returns percentage of the token as string
     * @param tokenId Id of the token
     * @return Total String percentage
     */
    function getSharePercentage(uint256 tokenId) external view returns (string memory);

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
