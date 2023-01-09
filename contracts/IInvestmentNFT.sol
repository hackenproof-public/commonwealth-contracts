// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IInvestmentNFT {
    function mint(address to, uint256 value) external;

    function burn(uint256 tokenId) external;
}
