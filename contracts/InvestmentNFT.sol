// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Checkpoints.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IInvestmentNFT.sol";

contract InvestmentNFT is ERC721Enumerable, IInvestmentNFT {
    using Checkpoints for Checkpoints.History;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    mapping(uint256 => uint256) public tokenValue;

    mapping(address => Checkpoints.History) private _walletCheckpoints;
    Checkpoints.History private _totalCheckpoints;

    constructor() ERC721("Investment NFT", "CWI") {}

    function mint(address to, uint256 value) external {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        tokenValue[tokenId] = value;
        _safeMint(to, tokenId);
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
        tokenValue[tokenId] = 0;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, ERC721Enumerable) returns (bool) {
        return
            interfaceId == type(IERC721Enumerable).interfaceId ||
            interfaceId == type(IInvestmentNFT).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function getInvestmentValue(address account) external view virtual returns (uint256) {
        return _walletCheckpoints[account].latest();
    }

    function getPastInvestmentValue(address account, uint256 blockNumber) external view virtual returns (uint256) {
        return _walletCheckpoints[account].getAtProbablyRecentBlock(blockNumber);
    }

    function getTotalInvestmentValue() external view virtual returns (uint256) {
        return _totalCheckpoints.latest();
    }

    function getPastTotalInvestmentValue(uint256 blockNumber) external view virtual returns (uint256) {
        return _totalCheckpoints.getAtProbablyRecentBlock(blockNumber);
    }

    function _add(uint256 a, uint256 b) private pure returns (uint256) {
        return a + b;
    }

    function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
        return a - b;
    }

    function _transferInvestmentValue(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            _totalCheckpoints.push(_add, value);
        }
        if (to == address(0)) {
            _totalCheckpoints.push(_subtract, value);
        }
        _moveInvestmentValue(from, to, value);
    }

    function _moveInvestmentValue(address from, address to, uint256 value) private {
        if (from != to && value > 0) {
            // TODO emit events when investment value changes
            if (from != address(0)) {
                _walletCheckpoints[from].push(_subtract, value);
            }
            if (to != address(0)) {
                _walletCheckpoints[to].push(_add, value);
            }
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        _transferInvestmentValue(from, to, tokenValue[firstTokenId]);
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
