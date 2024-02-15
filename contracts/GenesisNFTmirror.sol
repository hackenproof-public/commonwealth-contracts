// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {OwnablePausable} from "./OwnablePausable.sol";
import {IGeneisNFTMirror} from "./interfaces/IGenesisNFTMirror.sol";

error GenesisNftMirror__OwnerZeroAddress();
error GenesisNftMirror__GovernorZeroAddress();
error GenesisNftMirror__AccessDenied();
error GenesisNFTMirror__TokenAlreadyAssigned(uint256 tokenId);
error GenesisNFTMirror__NotTokenOwner(uint256 tokenId, address account);
error GenesisNFTMirror__IndexOutOfBounds();
error GenesisNFTMirror__OwnerIndexOutOfBounds();
error GenesisNFTMirror__TokensLimitReached();
error GenesisNFTMirror_NotTokenOwner(uint256 tokenId, address account);
error GenesisNFTMirror__NoTokensAssigned(address account);

/**
 * @title GenesisNFTMirror
 * @notice Contract representing the mirror functionality for NFTs.
 */
contract GenesisNFTMirror is IGeneisNFTMirror, OwnablePausable {
    event TokenMoved(uint256 indexed tokenId, address indexed to);
    event TokensAssigned(uint256[] tokenId, address indexed to);
    event TokensUnassigned(uint256[] tokenId, address indexed from);

    uint256 public constant TOKENS_LIMIT = 160;

    address private s_governor;

    string private s_name;
    string private s_symbol;

    uint256[] private s_allTokens;
    mapping(uint256 => address) private s_tokenOwner;
    mapping(address => uint256) private s_balances;
    mapping(address => mapping(uint256 => uint256)) private s_ownedTokens;
    mapping(address => mapping(uint256 => uint256)) private s_ownedTokensIndex;
    mapping(uint256 => bool) private s_tokenExist;

    modifier onlyGovernorOrOwner() {
        if (msg.sender != s_governor && msg.sender != owner()) revert GenesisNftMirror__AccessDenied();
        _;
    }

    modifier tokensLimit(uint256 tokens) {
        if (tokens > TOKENS_LIMIT) {
            revert GenesisNFTMirror__TokensLimitReached();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract.
     * @param _owner Address of the owner.
     * @param _governor Address of the governor.
     * @param _name Name of the NFT mirror.
     * @param _symbol Symbol of the NFT mirror.
     */
    function initialize(
        address _owner,
        address _governor,
        string memory _name,
        string memory _symbol
    ) public initializer {
        if (_owner == address(0)) revert GenesisNftMirror__OwnerZeroAddress();
        if (_governor == address(0)) revert GenesisNftMirror__GovernorZeroAddress();

        __OwnablePausable_init(_owner);
        s_governor = _governor;
        s_name = _name;
        s_symbol = _symbol;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function assign(
        uint256[] memory _tokenIds,
        address _account
    ) external override onlyGovernorOrOwner tokensLimit(_tokenIds.length) {
        uint256 accountBalance = s_balances[_account];
        for (uint256 i; i < _tokenIds.length; ) {
            bool tokenExist = s_tokenExist[_tokenIds[i]];
            address tokenOwner = s_tokenOwner[_tokenIds[i]];
            if (tokenOwner == _account) {
                revert GenesisNFTMirror__TokenAlreadyAssigned(_tokenIds[i]);
            }
            if (tokenExist && tokenOwner != _account && tokenOwner != address(0)) {
                revert GenesisNFTMirror__NotTokenOwner(_tokenIds[i], tokenOwner);
            }

            s_ownedTokens[_account][accountBalance] = _tokenIds[i];
            s_ownedTokensIndex[_account][_tokenIds[i]] = accountBalance;
            s_tokenOwner[_tokenIds[i]] = _account;
            accountBalance++;

            if (!tokenExist) {
                s_tokenExist[_tokenIds[i]] = true;
                s_allTokens.push(_tokenIds[i]);
            }

            unchecked {
                i++;
            }
        }

        s_balances[_account] = accountBalance;

        emit TokensAssigned(_tokenIds, _account);
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function unassign(
        uint256[] memory _tokenIds,
        address _account
    ) external override onlyGovernorOrOwner tokensLimit(_tokenIds.length) {
        uint256 currentBalance = s_balances[_account];
        if (currentBalance == 0) {
            revert GenesisNFTMirror__NoTokensAssigned(_account);
        }
        for (uint256 i; i < _tokenIds.length; ) {
            address tokenOwner = s_tokenOwner[_tokenIds[i]];
            if (tokenOwner != _account) {
                revert GenesisNFTMirror_NotTokenOwner(_tokenIds[i], _account);
            }

            uint256 lastTokenIndex = balanceOf(_account) - 1;
            uint256 tokenIndex = s_ownedTokensIndex[_account][_tokenIds[i]];

            if (tokenIndex != lastTokenIndex) {
                uint256 lastTokenId = s_ownedTokens[_account][lastTokenIndex];

                s_ownedTokens[_account][tokenIndex] = lastTokenId;
                s_ownedTokensIndex[_account][lastTokenId] = tokenIndex;
            }

            delete s_ownedTokensIndex[_account][_tokenIds[i]];
            delete s_ownedTokens[_account][lastTokenIndex];
            delete s_tokenOwner[_tokenIds[i]];

            unchecked {
                i++;
            }
        }

        s_balances[_account] = currentBalance - _tokenIds.length;

        emit TokensUnassigned(_tokenIds, _account);
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function changeGovernor(address _governor) external override onlyOwner {
        if (_governor == address(0)) {
            revert GenesisNftMirror__GovernorZeroAddress();
        }
        s_governor = _governor;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function name() external view override returns (string memory) {
        return s_name;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function symbol() external view override returns (string memory) {
        return s_symbol;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function totalSupply() external view override returns (uint256) {
        return s_allTokens.length;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function governor() external view override returns (address) {
        return s_governor;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function ownersOf(uint256[] memory _tokensIds) public view override returns (TokenOwner[] memory) {
        TokenOwner[] memory owners = new TokenOwner[](_tokensIds.length);
        for (uint256 i; i < _tokensIds.length; i++) {
            owners[i] = TokenOwner(_tokensIds[i], s_tokenOwner[_tokensIds[i]]);
        }

        return owners;
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function balanceOf(address _owner) public view override returns (uint256) {
        return s_balances[_owner];
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function ownerOf(uint256 _tokenId) public view override returns (address) {
        return s_tokenOwner[_tokenId];
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function isTokenExisted(uint256 _tokenId) external view override returns (bool) {
        return s_tokenExist[_tokenId];
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function tokenByIndex(uint256 _index) external view override returns (uint256) {
        if (_index >= s_allTokens.length) {
            revert GenesisNFTMirror__IndexOutOfBounds();
        }
        return s_allTokens[_index];
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function tokenOfOwnerByIndex(address _owner, uint256 _index) external view override returns (uint256) {
        if (_index >= balanceOf(_owner)) {
            revert GenesisNFTMirror__OwnerIndexOutOfBounds();
        }
        return s_ownedTokens[_owner][_index];
    }

    /**
     * @inheritdoc IGeneisNFTMirror
     */
    function ownedTokensIndex(address _owner, uint256 _tokenId) external view override returns (uint256) {
        if (ownerOf(_tokenId) == address(0)) {
            revert GenesisNFTMirror_NotTokenOwner(_tokenId, _owner);
        }
        return s_ownedTokensIndex[_owner][_tokenId];
    }

    uint256[48] private __gap;
}
