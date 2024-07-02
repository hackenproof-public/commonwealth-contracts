// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title Investment Fund interface
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
     * @param listingId Address of investment fund to which profit is provided
     * @param seller Provided income, including fee
     * @param nftContract Carry Fee
     * @param tokenId Number of block in which profit is provided
     * @param price Provided income, including fee
     */
    event Listed(
        uint256 listingId,
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 price
    );

    /**
     * @notice Emitted when new profit is provided to investment fund
     * @param listingId Address of investment fund to which profit is provided
     * @param buyer Provided income, including fee
     * @param seller Carry Fee
     * @param price Number of block in which profit is provided
     */
    event Sale(
        uint256 listingId,
        address buyer,
        address seller,
        uint256 price
    );

    /**
     * @notice Emitted when new profit is provided to investment fund
     * @param listingId Address of investment fund to which profit is provided
     * @param seller Provided income, including fee
     */
    event Canceled(uint256 listingId, address seller);

    /**
     * @notice Adds address to investment fund. Throws if project already exists in fund.
     *
     * Requirements:
     * - Project must not exist in fund
     *
     * Emits ProjectAdded event
     *
     * @param _nftContract Address of project to be added
     */
    function addAllowedContract(address _nftContract) external;

    /**
     * @notice Adds address to investment fund. Throws if project already exists in fund.
     *
     * Requirements:
     * - Project must not exist in fund
     *
     * Emits ProjectAdded event
     *
     * @param _nftContract Address of project to be added
     */
    function removeAllowedContract(address _nftContract) external;

    /**
     * @notice Adds address to investment fund. Throws if project already exists in fund.
     *
     * Requirements:
     * - Project must not exist in fund
     *
     * Emits ProjectAdded event
     *
     * @param _listingId Address of project to be added
     */
    function cancelListing(uint256 _listingId) external;

    /**
     * @notice Adds address to investment fund. Throws if project already exists in fund.
     *
     * Requirements:
     * - Project must not exist in fund
     *
     * Emits ProjectAdded event
     *
     * @param _nftContract Address of project to be added
     * @param _tokenId Address of project to be added
     * @param _price Address of project to be added
     */
    function listNFT(address _nftContract, uint256 _tokenId, uint256 _price) external;

    /**
     * @notice Adds address to investment fund. Throws if project already exists in fund.
     *
     * Requirements:
     * - Project must not exist in fund
     *
     * Emits ProjectAdded event
     *
     * @param _listingId Address of project to be added
     */
    function buyNFT(uint256 _listingId) external;

    /**
     * @notice Returns amount of profit payouts made within a fund.
     */
     function getAllListings() external view returns (Listing[] memory);

     /**
     * @notice Returns amount of profit payouts made within a fund.
     */
     function getOneListing(uint256 _listingId) external view returns (Listing memory);
}