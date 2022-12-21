// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IInvestmentNFT.sol";

contract InvestmentNFT is ERC721, IInvestmentNFT {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    mapping(uint256 => uint256) public investmentValue;

    constructor() ERC721("Investment NFT", "CWI") {}

    function mint(address to, uint256 value) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        investmentValue[tokenId] = value;
        return tokenId;
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }
}
