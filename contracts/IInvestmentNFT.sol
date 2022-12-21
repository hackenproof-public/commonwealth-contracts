// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IInvestmentNFT {
    function mint(address to, uint256 value) external returns (uint256);

    function burn(uint256 tokenId) external;
}
