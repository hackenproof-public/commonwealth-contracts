// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155URIStorageUpgradeable.sol";
import "../IERC1155Burnable.sol";

contract GenNFTV3 is
    ERC1155SupplyUpgradeable,
    ERC1155URIStorageUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2981Upgradeable,
    IERC1155Burnable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE"); // 0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE"); // 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848

    string public name;
    string public contractURI;

    address private _owner;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function setTokenURI(uint256 id, string calldata tokenUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(id, tokenUri);
    }

    function setContractURI(string calldata contractUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = contractUri;
    }

    function setOwner(address owner_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _owner = owner_;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 id, uint256 amount, string memory tokenURI) external onlyRole(MINTER_ROLE) {
        require(amount > 0, "Invalid minting token amount");

        if (totalSupply(id) == 0) {
            _setURI(id, tokenURI);
        }
        _mint(to, id, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        string[] memory tokenURIs
    ) external onlyRole(MINTER_ROLE) {
        for (uint256 i = 0; i < ids.length; i++) {
            require(amounts[i] > 0, "Invalid token amount to mint");
            uint256 id = ids[i];
            if (totalSupply(id) == 0) {
                _setURI(id, tokenURIs[i]);
            }
        }
        _mintBatch(to, ids, amounts, "");
    }

    //TODO change to correct address before the mainnet deployment
    function grantBurnerAndPauserRole() external {
        address wallet;
        require(wallet != address(0), "Invalid wallet address");
        _grantRole(BURNER_ROLE, wallet);
        _grantRole(PAUSER_ROLE, wallet);
    }

    function burn(address account, uint256 id, uint256 value) external virtual onlyRole(BURNER_ROLE) {
        _burn(account, id, value);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function uri(
        uint256 tokenId
    ) public view override(ERC1155Upgradeable, ERC1155URIStorageUpgradeable) returns (string memory) {
        return ERC1155URIStorageUpgradeable.uri(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155Upgradeable, AccessControlUpgradeable, ERC2981Upgradeable) returns (bool) {
        return interfaceId == type(IERC1155Burnable).interfaceId || super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    uint256[47] private __gap;
}
