// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {FEE_PERCENTAGE, TRANSACTION_FEE, ROYALTY_PERCENTAGE, BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error Marketplace__OwnerZeroAddress();
error Marketplace__FeeZeroAddress();
error Marketplace__RoyaltyZeroAddress();
error Marketplace__TokenZeroAddress();
error Marketplace__ERC721AddressExists();
error Marketplace__ERC721ZeroAddress();
error Marketplace__ERC721AddressNotAdded();
error Marketplace__ERC721AddressNotAllowed();
error Marketplace__NFTNotOwnedByMsgSender();
error Marketplace__ListingNotActive();
error Marketplace__NotOwnerOrSeller();
error Marketplace__NotSeller();
error Marketplace__ZeroPrice();

contract Marketplace is ReentrancyGuardUpgradeable, OwnablePausable, IMarketplace{
    /**
     * @notice Count of s_listings
     */
    uint256 private s_listingCount;

    /**
     * @notice Token used for buy sell
     */
    address private s_paymentAddress;

    /**
     * @notice The address fees are transferred to
     */
    address private s_feeAddress;

    /**
     * @notice The address royalties are transferred to
     */
    address private s_secondarySales;

    /**
     * @notice Token used for buy sell
     */
    IERC20 private s_paymentToken;

    /**
     * @notice Addresses of allowed contracts
     */
    mapping(address => bool) private s_allowedContracts;

    /**
     * @notice Listings made
     */
    mapping(uint256 => Listing) private s_listings;

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
        address _paymentToken,
        address _feeAddress,
        address _royaltyAddress
    ) public virtual initializer {
        if (_owner == address(0)) {
            revert Marketplace__OwnerZeroAddress();
        }
        if (_paymentToken == address(0)) {
            revert Marketplace__TokenZeroAddress();
        }
        if (_feeAddress == address(0)) {
            revert Marketplace__FeeZeroAddress();
        }
        if (_royaltyAddress == address(0)) {
            revert Marketplace__RoyaltyZeroAddress();
        }
        __Context_init();
        {
        __OwnablePausable_init(_owner);
        }
        __ReentrancyGuard_init();
        s_paymentAddress = _paymentToken; 
        s_paymentToken = IERC20(_paymentToken);
        s_feeAddress = _feeAddress;
        s_secondarySales = _royaltyAddress;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function addAllowedContract(address _nftContract) external onlyOwner {
        if (_nftContract == address(0)) {
            revert Marketplace__ERC721ZeroAddress();
        }
        if (s_allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressExists();
        }
        s_allowedContracts[_nftContract] = true;

        emit AddressAdded(_nftContract);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function removeAllowedContract(address _nftContract) external onlyOwner {
        if (_nftContract == address(0)) {
            revert Marketplace__ERC721ZeroAddress();
        }
        if (!s_allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressNotAdded();
        }
        delete s_allowedContracts[_nftContract];

        emit AddressRemoved(_nftContract);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function cancelListing(uint256 _listingId) external nonReentrant{
        Listing memory listing = s_listings[_listingId];
        if (msg.sender != listing.seller && msg.sender != owner()) {
            revert Marketplace__NotOwnerOrSeller();
        }

        delete s_listings[_listingId];
        s_listingCount--;

        emit Canceled(_listingId, msg.sender);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function updateListingPrice(uint256 _listingId, uint256 _price) external nonReentrant{
        if (msg.sender != s_listings[_listingId].seller) {
            revert Marketplace__NotSeller();
        }

        s_listings[_listingId].price = _price;

        emit PriceUpdated(_listingId, _price);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function listNFT(
        address _nftContract,
        uint256 _tokenId,
        uint256 _price
    ) external nonReentrant{
        if (!s_allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressNotAllowed();
        }
        if (IERC721(_nftContract).ownerOf(_tokenId) != msg.sender) {
            revert Marketplace__NFTNotOwnedByMsgSender();
        }
        if (_price <= 0) {
            revert Marketplace__ZeroPrice();
        }

        s_listings[s_listingCount] = Listing({
            seller: msg.sender,
            nftContract: _nftContract,
            tokenId: _tokenId,
            price: _price
        });

        s_listingCount++;

        emit Listed(
            s_listingCount-1,
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
        Listing memory listing = s_listings[_listingId];

        if (listing.seller == address(0)) {
            revert Marketplace__ListingNotActive();
        }

        uint256 fee = (listing.price * FEE_PERCENTAGE) / BASIS_POINT_DIVISOR;
        uint256 royalty = (listing.price * ROYALTY_PERCENTAGE) / BASIS_POINT_DIVISOR;
        uint256 transaction_fee = (listing.price * TRANSACTION_FEE) / BASIS_POINT_DIVISOR;
        uint256 sellerAmount = listing.price - fee - royalty;

        s_paymentToken.transferFrom(msg.sender, s_feeAddress, fee);
        s_paymentToken.transferFrom(msg.sender, s_secondarySales, royalty);
        s_paymentToken.transferFrom(msg.sender, s_secondarySales, transaction_fee);
        s_paymentToken.transferFrom(msg.sender, listing.seller, sellerAmount);

        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        emit Sale(_listingId, msg.sender, listing.seller, listing.price);

        delete s_listings[_listingId];
        s_listingCount--;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getAllListings() external view returns (Listing[] memory) {
        Listing[] memory allListings = new Listing[](s_listingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < s_listingCount; i++) {
            if (s_listings[i].price > 0) {
                allListings[index] = s_listings[i];
                index++;
            }
        }
        return allListings;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getOneListing(uint256 _listingId) external view returns (Listing memory) {
        return s_listings[_listingId];
    }

    function getAllowedContract(address _nftContract) external view returns (bool) {
        return s_allowedContracts[_nftContract];
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getListingCount() external view returns (uint256) {
        return s_listingCount;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function paymentToken() external view returns (address) {
        return s_paymentAddress;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function feeAddress() external view returns (address) {
        return s_feeAddress;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function royaltyAddress() external view returns (address) {
        return s_secondarySales;
    }

    function isAllowedContract(address _nftContract) external view returns (bool) {
        return s_allowedContracts[_nftContract];
    }

    uint256[50] private __gap;
}