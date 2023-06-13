// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import {IERC1155Burnable} from "./IERC1155Burnable.sol";
import {IERC721Mintable} from "../interfaces/IERC721Mintable.sol";
import {OwnablePausable} from "../OwnablePausable.sol";

contract GenesisNFTUpgrader is OwnablePausable {
    uint256 private constant ERC1155_TOKEN_ID = 1;

    address public sourceNft;
    address public targetNft;

    function initialize(address owner_, address sourceNft_, address targetNft_) public initializer {
        require(sourceNft_ != address(0), "Source contract is zero address");
        require(targetNft_ != address(0), "Target contract is zero address");

        __OwnablePausable_init(owner_);

        sourceNft = sourceNft_;
        targetNft = targetNft_;
    }

    function upgrade(address account, uint256 amount) external whenNotPaused {
        require(_msgSender() == account || _msgSender() == owner(), "Operation not allowed");
        require(
            IERC1155Upgradeable(sourceNft).balanceOf(account, ERC1155_TOKEN_ID) >= amount,
            "Insufficient number of tokens"
        );

        IERC1155Burnable(sourceNft).burn(account, ERC1155_TOKEN_ID, amount);
        IERC721Mintable(targetNft).mint(account, amount);
    }
}
