// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

interface IERC721Mintable {
    function mint(address recipient, uint256 amount, string memory uri) external;

    function mintBatch(address[] memory recipients, uint256[] memory amounts, string memory uri) external;
}
