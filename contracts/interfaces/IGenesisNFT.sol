// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721Mintable} from "./IERC721Mintable.sol";

interface IGenesisNFT {
    /**
     * @notice Returns Genesis NFT factor used for revenue calculations
     * @return Genesis NFT factor
     */
    function getFactor() external returns (uint256);
}
