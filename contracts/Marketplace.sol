// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {FEE_PERCENTAGE, TRANSACTION_FEE, ROYALTY_PERCENTAGE, BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {_transfer, _transferFrom} from "./libraries/Utils.sol";
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
error Marketplace__NotOwnerSellerAllowedContracts();
error Marketplace__NotSeller();
error Marketplace__ZeroPrice();

contract Marketplace is ReentrancyGuardUpgradeable, OwnablePausable, IMarketplace{
    /**
     * @notice Count of s_listings
     */
    uint256 private s_listingCount;

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
        if (_msgSender() != s_listings[_listingId].seller && _msgSender() != owner() && !s_allowedContracts[_msgSender()]) {
            revert Marketplace__NotOwnerSellerAllowedContracts();
        }

        delete s_listings[_listingId];
        s_listingCount--;
 
        emit Canceled(_listingId, _msgSender());
    }

    /**
     * @inheritdoc IMarketplace
     */
    function updateListingPrice(uint256 _listingId, uint256 _price) external nonReentrant{
        if (_msgSender() != s_listings[_listingId].seller) {
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
        uint256 _price,
        bool _isInvestmentNft
    ) external nonReentrant{
        if (!s_allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressNotAllowed();
        }
        if (IERC721(_nftContract).ownerOf(_tokenId) != _msgSender()) {
            revert Marketplace__NFTNotOwnedByMsgSender();
        }
        if (_price <= 0) {
            revert Marketplace__ZeroPrice();
        }

        s_listings[s_listingCount] = Listing({
            seller: _msgSender(),
            nftContract: _nftContract,
            tokenId: _tokenId,
            price: _price
        });

        s_listingCount++;

        if(_isInvestmentNft) IInvestmentNFT(_nftContract).setTokenListed(_tokenId, true);

        emit Listed(
            s_listingCount-1,
            _msgSender(),
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

        _transferFrom(address(s_paymentToken),_msgSender(), s_feeAddress, fee);
        _transferFrom(address(s_paymentToken),_msgSender(), s_secondarySales, royalty);
        _transferFrom(address(s_paymentToken),_msgSender(), s_secondarySales, transaction_fee);
        _transferFrom(address(s_paymentToken),_msgSender(), listing.seller, sellerAmount);

        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            _msgSender(),
            listing.tokenId
        );

        emit Sale(_listingId, _msgSender(), listing.seller, listing.price);

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

    /**
     * @inheritdoc IMarketplace
     */
    function getListingCount() external view returns (uint256) {
        return s_listingCount;
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
    function paymentToken() external view returns (address) {
        return address(s_paymentToken);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function royaltyAddress() external view returns (address) {
        return s_secondarySales;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function isAllowedContract(address _nftContract) external view returns (bool) {
        return s_allowedContracts[_nftContract];
    }

    uint256[50] private __gap;
}