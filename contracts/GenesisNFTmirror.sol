// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

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
        require(_owner != address(0), "Owner is zero address");
        require(_governor != address(0), "Governor is zero address");
        require(_tokenIds.length == _tokenOwners.length, "Token id count must be equal to token owner count");

        _transferOwnership(_owner);
        governor = _governor;
        name = _name;
        symbol = _symbol;

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            tokens[_tokenIds[i]] = _tokenOwners[i];
            balances[_tokenOwners[i]]++;
        }
    }

    function moveToken(uint256 token, address newHolder) external {
        require(msg.sender == governor || msg.sender == owner(), "Unauthorized access");

        if (tokens[token] == address(0)) {
            totalSupply++;
            _allTokens.push(token);
        }

        _decreaseOldHolderBalance(token);

        emit TokenMoved(token, address(0));

        uint256 newHolderBalance = balances[newHolder];
        _ownedTokens[newHolder][newHolderBalance] = token;

        balances[newHolder] = newHolderBalance + 1;

        tokens[token] = newHolder;
    }

    function destroyToken(uint256 token) external {
        require(msg.sender == governor || msg.sender == owner(), "Unauthorized access");

        _decreaseOldHolderBalance(token);

        emit TokenMoved(token, address(0));

        delete tokens[token];
    }

    function changeGovernor(address newGovernor) external onlyOwner {
        require(newGovernor != governor, "This is a governor already");

        governor = newGovernor;
    }

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "address zero is invalid owner");

        return balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = tokens[tokenId];
        require(owner != address(0), "invalid token ID");

        return owner;
    }

    function tokenByIndex(uint256 index) public view virtual returns (uint256) {
        require(index < totalSupply, "Index out of bounds");
        return _allTokens[index];
    }

    function tokenOfOwnerByIndex(address owner, uint256 index) public view virtual returns (uint256) {
        require(index < balanceOf(owner), "Owner index out of bounds");
        return _ownedTokens[owner][index];
    }

    function _decreaseOldHolderBalance(uint256 tokenId) internal {
        uint256 oldBalance = balances[tokens[tokenId]];
        if (oldBalance > 0) {
            balances[tokens[tokenId]] = oldBalance - 1;
        }
    }
}
