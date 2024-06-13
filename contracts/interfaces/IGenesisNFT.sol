// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IGenesisNFTVesting} from "./IGenesisNFTVesting.sol";

interface IGenesisNFT {
    /**
     * @notice Metadata structure for NFT
     */
    struct Metadata {
        string name;
        string description;
        string image;
        string externalUrl;
        string id;
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
     * @param image Metadata image
     * @param externalUrl Metadata external URL
     */
    event MetadataChanged(string indexed name, string indexed description, string indexed image, string externalUrl, string id);

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
     * @notice Emitted when metadata series id for NFT is changed
     * @param id id of the series
     */
    event MetadataIdChanged(string indexed id);

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
     * @notice Set new metadata series
     * @param _id New metadata series id
     */
    function setMetadataId(string memory _id) external;

    /**
     * @notice Set all metadata at once
     * @param _metadata Metadata structure
     */
    function setAllMetadata(Metadata memory _metadata) external;

    /**
     * @notice Returns Genesis NFT series number
     * @return Genesis NFT series number
     */
    function getSeries() external view returns (uint256);

    /**
     * @notice Returns Unvested Tokens
     * @return Unvested Tokens
     */
    function fetchTokenDetails(uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Returns Number of Slices
     * @return Number of slices
     */
    function getSlices(uint256 _tokenId) external view returns (uint256);
}
