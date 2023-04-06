// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {ERC721, ERC721Enumerable, IERC165, IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/Checkpoints.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IInvestmentNFT} from "./interfaces/IInvestmentNFT.sol";
import {_add, _subtract} from "./libraries/Utils.sol";

/**
 * @title Investment NFT contract
 */
contract InvestmentNFT is ERC721Enumerable, IInvestmentNFT {
    using Checkpoints for Checkpoints.History;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(uint256 => uint256) public tokenValue;

    Counters.Counter private _tokenIdCounter;
    EnumerableSet.AddressSet private _wallets;
    mapping(address => Checkpoints.History) private _walletCheckpoints;
    Checkpoints.History private _totalCheckpoints;

    /**
     * @notice Initializes the contract
     */
    constructor() ERC721("Investment NFT", "CWI") {}

    /**
     * @inheritdoc IInvestmentNFT
     */
    function mint(address to, uint256 value) external {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        tokenValue[tokenId] = value;
        _safeMint(to, tokenId);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function burn(uint256 tokenId) external {
        _burn(tokenId);
        tokenValue[tokenId] = 0;
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getInvestmentValue(address account) public view virtual returns (uint256) {
        return _walletCheckpoints[account].latest();
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getPastInvestmentValue(address account, uint256 blockNumber) public view virtual returns (uint256) {
        return _walletCheckpoints[account].getAtProbablyRecentBlock(blockNumber);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getTotalInvestmentValue() public view virtual returns (uint256) {
        return _totalCheckpoints.latest();
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getPastTotalInvestmentValue(uint256 blockNumber) public view virtual returns (uint256) {
        return _totalCheckpoints.getAtProbablyRecentBlock(blockNumber);
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getUserParticipation(address account) external view returns (uint256, uint256) {
        return (getInvestmentValue(account), getTotalInvestmentValue());
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getUserParticipationInBlock(
        address account,
        uint256 blockNumber
    ) external view returns (uint256, uint256) {
        return (getPastInvestmentValue(account, blockNumber), getPastTotalInvestmentValue(blockNumber));
    }

    /**
     * @inheritdoc IInvestmentNFT
     */
    function getWallets() external view returns (address[] memory) {
        return _wallets.values();
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, ERC721Enumerable) returns (bool) {
        return
            interfaceId == type(IERC721Enumerable).interfaceId ||
            interfaceId == type(IInvestmentNFT).interfaceId ||
            super.supportsInterface(interfaceId);
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
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
        _transferInvestmentValue(from, to, tokenValue[firstTokenId]);

        // Add wallet to list if first token transferred in or minted
        if (to != address(0) && _wallets.contains(to) == false) {
            _wallets.add(to);
        }

        // Remove wallet from list if last token transferred out or burnt
        if (from != address(0) && balanceOf(from) == 0) {
            _wallets.remove(from);
        }
    }
}
