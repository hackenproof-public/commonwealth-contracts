// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title Marketplace interface
 */
interface IMarketplace {
    /**
     * @notice Listing of marketplace
     */
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
    }


    /**
     * @notice Emitted when listing is created and state changed
     * @param listingId Id of the listing
     * @param seller Seller of the nft
     * @param nftContract Contract address for nft
     * @param tokenId Token id of the nft
     * @param price Price of the nft for sale, including fees
     */
    event Listed(
        uint256 listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 price
    );

    /**
     * @notice Emitted when nft is sold
     * @param listingId Id of the listing
     * @param buyer Buyer of the nft
     * @param seller Seller of the nft
     * @param price Price of the nft for sale, including fees
     */
    event Sale(
        uint256 listingId,
        address indexed buyer,
        address indexed seller,
        uint256 indexed price
    );

    /**
     * @notice Emitted when listing is cancelled
     * @param listingId Id of the listing
     * @param seller Seller of the nft
     */
    event Canceled(uint256 indexed listingId, address indexed seller);

    /**
     * @notice Emitted when nft is added
     * @param __nftContract address of nft
     */
    event AddressAdded(address indexed __nftContract);

    /**
     * @notice Emitted when nft is removed
     * @param __nftContract address of nft
     */
    event AddressRemoved(address indexed __nftContract);

    /**
     * @notice Adds address of nft that can be listed in marketplace
     *
     * Requirements:
     * - Address must not exist in fund
     * - Address must not be zero
     * - msg sender needs to be owner
     *
     * Emits AddressAdded event
     *
     * @param _nftContract Address of the nft to be listed
     */
    function addAllowedContract(address _nftContract) external;

    /**
     * @notice Removes address of nft that can be listed in marketplace
     *
     * Requirements:
     * - Address must exist in array
     * - Address must not be zero
     * - msg sender needs to be owner
     *
     * Emits AddressRemoved event
     *
     * @param _nftContract Address of nft to be removed
     */
    function removeAllowedContract(address _nftContract) external;

    /**
     * @notice Cancels the listing in the marketplace
     *
     * Requirements:
     * - Msg sender needs to be seller or owner
     *
     * Emits Canceled event
     *
     * @param _listingId listing id to be cancelled
     */
    function cancelListing(uint256 _listingId) external;

    /**
     * @notice Lists the nft in the marketplace
     *
     * Requirements:
     * - NFT address exists in AllowedAddresses
     * - Msg sender needs to be owner of nft
     *
     * Emits Listed event
     *
     * @param _nftContract contract address of the nft
     * @param _tokenId token id of the nft
     * @param _price price for buyers
     */
    function listNFT(address _nftContract, uint256 _tokenId, uint256 _price) external;

    /**
     * @notice Buying the listed nft
     *
     * Emits Sale event
     *
     * @param _listingId id of the listing to be sold
     */
    function buyNFT(uint256 _listingId) external;

    /**
     * @notice Returns all listings
     */
     function getAllListings() external view returns (Listing[] memory);

     /**
     * @notice Returns a listing with specific listing id
     *
     * @param _listingId id of the listing to be returned
     */
     function getOneListing(uint256 _listingId) external view returns (Listing memory);

     /**
     * @notice Returns count of listings
     */
     function getListingCount() external view returns (uint256);

     /**
     * @notice Returns payment token
     */
    function paymentToken() external view returns (address);

    /**
     * @notice Returns fee address
     */
    function feeAddress() external view returns (address);

    /**
     * @notice Returns royalty address
     */
    function royaltyAddress() external view returns (address);
}