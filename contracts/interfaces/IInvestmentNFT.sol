// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IInvestmentNFT is IERC721Enumerable {
    function mint(address to, uint256 value) external;

    function burn(uint256 tokenId) external;

    function getInvestmentValue(address account) external view returns (uint256);

    function getPastInvestmentValue(address account, uint256 blockNumber) external view returns (uint256);

    function getTotalInvestmentValue() external view returns (uint256);

    function getPastTotalInvestmentValue(uint256 blockNumber) external view returns (uint256);
}
