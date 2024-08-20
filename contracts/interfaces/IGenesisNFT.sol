// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IGenesisNFT {
    /**
     * @notice Metadata structure for NFT
     */
    struct Metadata {
        string name;
        string description;
        string externalUrl;
        string id;
        string percentage;
    }
    /**
     * @notice Emitted when zkSync GenesisNFTmirror notification about moving a token is sent
     * @param tokenId id of a transferred token
     * @param to address of a transfer
     * @param txHash canonical transaction hash of the notification
     */
    event TokenMoved(uint256 indexed tokenId, address indexed to, bytes32 indexed txHash);

    /**
     * @notice Emitted when the contract owner changes
     * @param previousOwner address of the previous owner
     * @param newOwner address of the new owner
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Emitted when metadata for NFT is changed
     * @param name Metadata name
     * @param description Metadata description
     * @param externalUrl Metadata external URL
     */
    event MetadataChanged(
        string indexed name,
        string indexed description,
        string externalUrl,
        string id,
        string percentage
    );

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
     * @param metadataImages Metadata images
     */
    event MetadataImageChanged(string[] indexed metadataImages);

    /**
     * @notice Emitted when metadata external URL for NFT is changed
     * @param externalUrl Metadata external URL
     */
    event MetadataExternalUrlChanged(string indexed externalUrl);

    /**
     * @notice Emitted when metadata series id for NFT is changed
     * @param id id of the series
     */
    event MetadataIdChanged(string indexed id);

    /**
     * @notice Emitted when metadata series percentage for NFT is changed
     * @param percentage percentage profit of the series
     */
    event MetadataPercentageChanged(string indexed percentage);

    /**
     * @notice Emitted when token allocation is changed
     * @param tokenAllocation token allocation of the series
     */
    event TokenAllocationChanged(uint256 tokenAllocation);

    /**
     * @notice Emitted when Marketplace address is changed
     * @param marketplaceAddress address of the marketplace
     */
    event MarketplaceAddressChanged(address marketplaceAddress);

    /**
     * @notice Emitted when series1 boolean is changed
     * @param newAddress new address which will receive royalty
     * @param value royalty percent in basis points (1/100 of a percent)
     */
    event RoyaltyChanged(address indexed newAddress, uint96 indexed value);

    /**
     * @notice Emitted when series1 boolean is changed
     * @param _series1 if true, s1
     */
    event Series1Changed(bool _series1);

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
     * @param metadataImages New metadata image
     */
    function setMetadataImage(string[] memory metadataImages) external;

    /**
     * @notice Set new metadata external URL
     * @param _extenralUrl New metadata external URL
     */
    function setMetadataExternalUrl(string memory _extenralUrl) external;

    /**
     * @notice Set new metadata series
     * @param _id New metadata series id
     */
    function setMetadataId(string memory _id) external;

    /**
     * @notice Set new metadata percentage
     * @param _percentage New metadata series id
     */
    function setMetadataPercentage(string memory _percentage) external;

    /**
     * @notice Set all metadata at once
     * @param _metadata Metadata structure
     */
    function setAllMetadata(Metadata memory _metadata) external;

    /**
     * @notice Set token allocation for series
     * @param _token_allocation token allocation
     */
    function setTokenAllocation(uint256 _token_allocation) external;

    /**
     * @notice Set series1 bool
     * @param _series1 if true, s1
     */
    function setSeries1(bool _series1) external;

    /**
     * @notice Returns Genesis NFT series number
     * @return Genesis NFT series number
     */
    function getSeries() external view returns (uint256);
}
