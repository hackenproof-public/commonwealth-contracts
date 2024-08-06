// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {MARKETPLACE_FEE_PERCENTAGE, TRANSACTION_FEE, ROYALTY_PERCENTAGE, BASIS_POINT_DIVISOR} from "./libraries/Constants.sol";
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
error Marketplace__NFTNotApprovedForMarketplaceContract();
error Marketplace__NotSeller();
error Marketplace__ZeroPrice();
error Marketplace__NotEnoughWlthApproved();
error Marketplace__InvalidListingId();

contract Marketplace is OwnablePausable, IMarketplace {
    /**
     * @notice The address off the Revenue Wallet
     */
    address private s_revenueWallet;

    /**
     * @notice The address royalties are transferred to
     */
    address private s_secondarySales;

    /**
     * @notice Token used for buy sell
     */
    IERC20 private s_paymentToken;

    /**
     * @notice keeps actual amount of NFTs listed
     */
    uint256 private s_listingCount;

    /**
     * @notice Assigns a unique id to each listing
     */
    uint256 private s_listingIdCounter;

    /**
     * @notice Addresses of allowed contracts
     */
    mapping(address => bool) private s_allowedContracts;

    /**
     * @notice Listings made
     */
    mapping(uint256 => Listing) private s_listings;

    /**
     * @notice NFT contract and token Id to Listing Id
     */
    mapping(address => mapping(uint256 => uint256)) private s_tokenIdToListingId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _owner Contract owner
     * @param _paymentToken Address of payout unlocker
     * @param _revenueWallet Revenue wallet address
     * @param _royaltyAddress Address of currency for investments
     */
    function initialize(
        address _owner,
        address _paymentToken,
        address _revenueWallet,
        address _royaltyAddress
    ) public virtual initializer {
        if (_owner == address(0)) {
            revert Marketplace__OwnerZeroAddress();
        }
        if (_paymentToken == address(0)) {
            revert Marketplace__TokenZeroAddress();
        }
        if (_revenueWallet == address(0)) {
            revert Marketplace__FeeZeroAddress();
        }
        if (_royaltyAddress == address(0)) {
            revert Marketplace__RoyaltyZeroAddress();
        }
        __Context_init();
        {
            __OwnablePausable_init(_owner);
        }
        s_paymentToken = IERC20(_paymentToken);
        s_revenueWallet = _revenueWallet;
        s_secondarySales = _royaltyAddress;
        s_listingIdCounter = 1;
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
    function cancelListing(uint256 _listingId) external {
        _cancelListing(_listingId);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function cancelListing(address _nftContract, uint256 _tokenId) external {
        _cancelListing(s_tokenIdToListingId[_nftContract][_tokenId]);
    }

    function _cancelListing(uint256 _listingId) private {
        if (
            _msgSender() != s_listings[_listingId].seller &&
            _msgSender() != owner() &&
            !s_allowedContracts[_msgSender()]
        ) {
            revert Marketplace__NotOwnerSellerAllowedContracts();
        }
        s_tokenIdToListingId[s_listings[_listingId].nftContract][s_listings[_listingId].tokenId] = 0;
        s_listings[_listingId].listed = false;
        s_listingCount--;

        emit Canceled(_listingId, _msgSender());
    }

    /**
     * @inheritdoc IMarketplace
     */
    function updateListingPrice(uint256 _listingId, uint256 _price) external {
        if (!s_listings[_listingId].listed) {
            revert Marketplace__InvalidListingId();
        }

        if (_msgSender() != s_listings[_listingId].seller) {
            revert Marketplace__NotSeller();
        }

        s_listings[_listingId].price = _price;

        emit PriceUpdated(_listingId, _price);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function listNFT(address _nftContract, uint256 _tokenId, uint256 _price) external returns (uint256) {
        if (_price <= 0) {
            revert Marketplace__ZeroPrice();
        }
        if (!s_allowedContracts[_nftContract]) {
            revert Marketplace__ERC721AddressNotAllowed();
        }
        if (IERC721(_nftContract).ownerOf(_tokenId) != _msgSender()) {
            revert Marketplace__NFTNotOwnedByMsgSender();
        }
        if (IERC721(_nftContract).getApproved(_tokenId) != address(this)) {
            revert Marketplace__NFTNotApprovedForMarketplaceContract();
        }

        uint256 listingId = s_listingIdCounter;
        s_listings[listingId] = Listing({
            seller: _msgSender(),
            nftContract: _nftContract,
            tokenId: _tokenId,
            price: _price,
            listed: true,
            sold: false
        });

        s_tokenIdToListingId[_nftContract][_tokenId] = listingId;
        s_listingIdCounter++;
        s_listingCount++;

        emit Listed(listingId, _msgSender(), _nftContract, _tokenId, _price);

        return listingId;
    }

    /**
     * @inheritdoc IMarketplace
     */
    function buyNFT(uint256 _listingId) external {
        Listing memory listing = s_listings[_listingId];
        if (!listing.listed) {
            revert Marketplace__ListingNotActive();
        }
        if (IERC20(s_paymentToken).allowance(_msgSender(), address(this)) < listing.price) {
            revert Marketplace__NotEnoughWlthApproved();
        }

        s_listings[_listingId].listed = false;
        s_listings[_listingId].sold = true;

        s_listingCount--;

        emit Sale(_listingId, _msgSender(), listing.seller, listing.price);

        uint256 fee = (listing.price * MARKETPLACE_FEE_PERCENTAGE) / BASIS_POINT_DIVISOR;
        uint256 royalty = (listing.price * ROYALTY_PERCENTAGE) / BASIS_POINT_DIVISOR;
        uint256 transactionFee = (listing.price * TRANSACTION_FEE) / BASIS_POINT_DIVISOR;
        uint256 sellerAmount = listing.price - fee - royalty - transactionFee;

        _transferFrom(address(s_paymentToken), _msgSender(), s_revenueWallet, fee);
        _transferFrom(address(s_paymentToken), _msgSender(), s_secondarySales, royalty + transactionFee);
        _transferFrom(address(s_paymentToken), _msgSender(), listing.seller, sellerAmount);

        IERC721(listing.nftContract).safeTransferFrom(listing.seller, _msgSender(), listing.tokenId);
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getListingByListingId(uint256 _listingId) external view returns (Listing memory) {
        return s_listings[_listingId];
    }

    /**
     * @inheritdoc IMarketplace
     */
    function getListingByTokenId(address _nftContract, uint256 _tokenId) external view returns (Listing memory) {
        return s_listings[s_tokenIdToListingId[_nftContract][_tokenId]];
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
    function revenueWallet() external view returns (address) {
        return s_revenueWallet;
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
