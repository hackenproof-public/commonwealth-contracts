// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {FEE_PERCENTAGE, ROYALTY_PERCENTAGE} from "./libraries/Constants.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error Marketplace__ERC721AddressExists();
error Marketplace__ERC721ZeroAddress();
error Marketplace__ERC721AddressNotAdded();
error Marketplace__ERC721AddressNotAllowed();
error Marketplace__NFTNotOwnedByMsgSender();
error Marketplace__ListingNotActive();
error Marketplace__NotOwnerOrSeller();
error Marketplace__NotOwner();

contract Marketplace is ReentrancyGuardUpgradeable, OwnablePausable, IMarketplace{
    /**
     * @notice Token used for buy sell
     */
    IERC20 public paymentToken;

    /**
     * @notice The addresses for allowed ERC721 tokens
     */
    address[] public allowedERC721Addresses;

    /**
     * @notice The address fees are transferred to
     */
    address private feeAddress;

    /**
     * @notice The address royalties are transferred to
     */
    address private royaltyAddress;

    /**
     * @notice Addresses of allowed contracts
     */
    mapping(address => bool) public allowedContracts;

    /**
     * @notice Listings made
     */
    mapping(uint256 => Listing) public listings;

    /**
     * @notice Count of listings
     */
    uint256 private listingCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _owner Contract owner
     * @param _paymentToken Address of payout unlocker
     * @param _feeAddress Investment fund name
     * @param _royaltyAddress Address of currency for investments
     */
    function initialize(
        address _owner,
        IERC20 _paymentToken,
        address _feeAddress,
        address _royaltyAddress
    ) public virtual initializer {
        __Context_init();
        {
        __OwnablePausable_init(_owner);
        }
        __ReentrancyGuard_init();
        paymentToken = _paymentToken;
        feeAddress = _feeAddress;
        royaltyAddress = _royaltyAddress;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function addAllowedContract(address _nftContract) external onlyOwner {
        if (_nftContract == address(0)) {
            revert Marketplace__ERC721ZeroAddress();
        }
        if (allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressExists();
        }
        if (msg.sender != owner()) {
            revert Marketplace__NotOwner();
        }
        allowedContracts[_nftContract] = true;
        allowedERC721Addresses.push(_nftContract);

        emit AddressAdded(_nftContract);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function removeAllowedContract(address _nftContract) external onlyOwner {
        if (_nftContract == address(0)) {
            revert Marketplace__ERC721ZeroAddress();
        }
        if (!allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressNotAdded();
        }
        if (msg.sender != owner()) {
            revert Marketplace__NotOwner();
        }
        allowedContracts[_nftContract] = false;

        emit AddressRemoved(_nftContract);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function cancelListing(uint256 _listingId) external nonReentrant{
        Listing storage listing = listings[_listingId];
        if (msg.sender != listing.seller && msg.sender != owner()) {
            revert Marketplace__NotOwnerOrSeller();
        }

        delete listings[_listingId];
        listingCount--;

        emit Canceled(_listingId, msg.sender);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function listNFT(
        address _nftContract,
        uint256 _tokenId,
        uint256 _price
    ) external nonReentrant{
        if (!allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressNotAllowed();
        }
        if (IERC721(_nftContract).ownerOf(_tokenId) != msg.sender) {
            revert Marketplace__NFTNotOwnedByMsgSender();
        }

        listings[listingCount] = Listing({
            seller: msg.sender,
            nftContract: _nftContract,
            tokenId: _tokenId,
            price: _price
        });

        listingCount++;

        emit Listed(
            listingCount,
            msg.sender,
            _nftContract,
            _tokenId,
            _price
        );
    }

    /**
     * @inheritdoc IMarketplace
     */
    function buyNFT(uint256 _listingId) external nonReentrant{
        Listing storage listing = listings[_listingId];

        uint256 fee = (listing.price * FEE_PERCENTAGE) / 100;
        uint256 royalty = (listing.price * ROYALTY_PERCENTAGE) / 1000;
        uint256 sellerAmount = listing.price - fee - royalty;

        paymentToken.transferFrom(msg.sender, feeAddress, fee);
        paymentToken.transferFrom(msg.sender, royaltyAddress, royalty);
        paymentToken.transferFrom(msg.sender, listing.seller, sellerAmount);

        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        delete listings[_listingId];
        listingCount--;


        emit Sale(_listingId, msg.sender, listing.seller, listing.price);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getAllListings() external view returns (Listing[] memory) {
        Listing[] memory allListings = new Listing[](listingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < listingCount; i++) {
            if (listings[i].price > 0) {
                allListings[index] = listings[i];
                index++;
            }
        }
        return allListings;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getOneListing(uint256 _listingId) external view returns (Listing memory) {
        Listing storage listing = listings[_listingId];
        return listing;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getListingCount() external view returns (uint256) {
        return listingCount;
    }

    uint256[50] private __gap;
}