// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

error GenesisNftMirror__OwnerZeroAddress();
error GenesisNftMirror__GovernorZeroAddress();
error GenesisNftMirror__TokenIdsOwnersLenghtsMismatch();
error GenesisNftMirror__AccessDenied();
error GenesisNftMirror__GovernorAlready();
error GenesisNftMirror__ZeroAddress();
error GenesisNftMirror__InvalidTokenId();
error GenesisNftMirror__IndexOutOfBounds();
error GenesisNftMirror__OwnerIndexOutOfBounds();

contract GenesisNFTmirror is OwnablePausable {
    event TokenMoved(uint256 indexed tokenId, address indexed to);

    uint256 public totalSupply;
    string public name;
    string public symbol;

    address private governor;

    uint256[] private _allTokens;
    mapping(uint256 => address) private tokens;
    mapping(address => uint256) private balances;
    mapping(address => mapping(uint256 => uint256)) private _ownedTokens;

    modifier GovernorOrOwnerOnly() {
        if (msg.sender == governor || msg.sender == owner()) revert GenesisNftMirror__OwnerZeroAddress();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _governor,
        uint256[] memory _tokenIds,
        address[] memory _tokenOwners,
        string memory _name,
        string memory _symbol
    ) public initializer {
        __OwnablePausable_init(_owner);
        if (_owner == address(0)) revert GenesisNftMirror__OwnerZeroAddress();
        if (_governor == address(0)) revert GenesisNftMirror__GovernorZeroAddress();
        if (_tokenIds.length == _tokenOwners.length) revert GenesisNftMirror__TokenIdsOwnersLenghtsMismatch();

        _transferOwnership(_owner);
        governor = _governor;
        name = _name;
        symbol = _symbol;

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            tokens[_tokenIds[i]] = _tokenOwners[i];
            balances[_tokenOwners[i]]++;
        }
    }

    function moveToken(uint256 token, address newHolder) external GovernorOrOwnerOnly {
        if (tokens[token] == address(0)) {
            totalSupply++;
            _allTokens.push(token);
        }

        _decreaseOldHolderBalance(token);

        uint256 newHolderBalance = balances[newHolder];
        _ownedTokens[newHolder][newHolderBalance] = token;

        balances[newHolder] = newHolderBalance + 1;

        tokens[token] = newHolder;

        emit TokenMoved(token, address(0));
    }

    function destroyToken(uint256 token) external GovernorOrOwnerOnly {
        _decreaseOldHolderBalance(token);

        emit TokenMoved(token, address(0));

        delete tokens[token];
    }

    function changeGovernor(address newGovernor) external onlyOwner {
        if (newGovernor == address(0)) revert GenesisNftMirror__ZeroAddress();
        if (newGovernor == governor) revert GenesisNftMirror__GovernorAlready();

        governor = newGovernor;
    }

    function balanceOf(address owner) public view returns (uint256) {
        if (owner == address(0)) revert GenesisNftMirror__ZeroAddress();

        return balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        if (tokens[tokenId] == address(0)) {
            revert GenesisNftMirror__ZeroAddress();
        } else return tokens[tokenId];
    }

    function tokenByIndex(uint256 index) public view virtual returns (uint256) {
        if (index >= totalSupply) revert GenesisNftMirror__IndexOutOfBounds();
        return _allTokens[index];
    }

    function tokenOfOwnerByIndex(address owner, uint256 index) public view virtual returns (uint256) {
        if (index >= balanceOf(owner)) revert GenesisNftMirror__OwnerIndexOutOfBounds();
        return _ownedTokens[owner][index];
    }

    function _decreaseOldHolderBalance(uint256 tokenId) internal {
        uint256 oldBalance = balances[tokens[tokenId]];
        if (oldBalance > 0) {
            balances[tokens[tokenId]] = oldBalance - 1;
        }
    }
}
