// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


contract GenesisNFTmirror is Ownable {

    event TokenMoved(uint256 indexed tokenId, address indexed to);

    mapping(uint256 => address) private _tokens;
    mapping(address => uint256) private _balances;

    address private _governor;

    constructor(address owner, address governor, uint256[] memory tokenIds, address[] memory tokenOwners) {
        require(owner != address(0), "Owner is zero address");
        require(governor != address(0), "Governor is zero address");
        require(tokenIds.length == tokenOwners.length, "Token id count must be equal to token owner count");

        _transferOwnership(owner);
        _governor = governor;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _tokens[tokenIds[i]] = tokenOwners[i];
            _balances[tokenOwners[i]]++;
        }
    }

    function moveToken(uint256 token, address newHolder) external {
        require(msg.sender == _governor || msg.sender == owner(), "Unauthorized access");

        _decreaseOldHolderBalance(token);

        emit TokenMoved(token, address(0));

        uint256 newHolderBalance = _balances[newHolder];
        _balances[newHolder] = newHolderBalance + 1;

        _tokens[token] = newHolder;
    }

    function destroyToken(uint256 token) external {
        require(msg.sender == _governor || msg.sender == owner(), "Unauthorized access");

        _decreaseOldHolderBalance(token);

        emit TokenMoved(token, address(0));

        delete _tokens[token];
    }

    function changeGovernor(address newGovernor) onlyOwner external {
        require(newGovernor != _governor, "This is a governor already");

        _governor = newGovernor;
    }

    function balanceOf(address owner) public view returns(uint256) {
        require(owner != address(0), "address zero is invalid owner");

        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns(address) {
        address owner = _tokens[tokenId];
        require(owner != address(0), "invalid token ID");

        return owner;
    }

    function _decreaseOldHolderBalance(uint256 tokenId) internal {
        uint256 oldBalance = _balances[_tokens[tokenId]];
        if (oldBalance > 0) {
            _balances[_tokens[tokenId]] = oldBalance - 1;
        }
    }
}