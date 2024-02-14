// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title IGeneisNFTMirror
 * @notice Interface for the GeneisNFTMirror contract, representing NFT mirror functionality.
 */
interface IGeneisNFTMirror {
    /**
     * @notice Assigns specified token IDs to a given account.
     * @param _tokenIds Array of token IDs to be assigned.
     * @param _account Address of the account to which tokens will be assigned.
     */
    function assign(uint256[] memory _tokenIds, address _account) external;

    /**
     * @notice Unassigns all tokens from a given account.
     * @param _tokenIds Array of token IDs to be unassigned.
     * @param _account Address of the account from which tokens will be unassigned.
     */
    function unassign(uint256[] memory _tokenIds, address _account) external;

    /**
     * @notice Changes the governor address.
     * @param _governor Address of the new governor.
     */
    function changeGovernor(address _governor) external;

    /**
     * @notice Gets the name of the NFT mirror.
     * @return The name of the NFT mirror.
     */
    function name() external view returns (string memory);

    /**
     * @notice Gets the symbol of the NFT mirror.
     * @return The symbol of the NFT mirror.
     */
    function symbol() external view returns (string memory);

    /**
     * @notice Gets the total supply of tokens in the NFT mirror.
     * @return The total supply of tokens.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @notice Gets the address of the governor.
     * @return The address of the governor.
     */
    function governor() external view returns (address);

    /**
     * @notice Gets the balance of tokens owned by a specific address.
     * @param _owner Address for which the token balance is queried.
     * @return The balance of tokens owned by the address.
     */
    function balanceOf(address _owner) external view returns (uint256);

    /**
     * @notice Gets the owner of a specific token.
     * @param _tokenId ID of the token for which the owner is queried.
     * @return The address of the owner of the token.
     */
    function ownerOf(uint256 _tokenId) external view returns (address);

    /**
     * @notice Checks if a token with the given ID exists.
     * @param _tokenId ID of the token to check for existence.
     * @return True if the token exists, false otherwise.
     */
    function isTokenExisted(uint256 _tokenId) external view returns (bool);

    /**
     * @notice Gets the token ID at a specific index in the list of all tokens.
     * @param _index Index of the token in the list of all tokens.
     * @return The ID of the token at the specified index.
     */
    function tokenByIndex(uint256 _index) external view returns (uint256);

    /**
     * @notice Gets the token ID at a specific index in the list of tokens owned by a specific address.
     * @param _owner Address for which the index is queried.
     * @param _index Index of the token in the list of owned tokens.
     * @return The ID of the token at the specified index.
     */
    function tokenOfOwnerByIndex(address _owner, uint256 _index) external view returns (uint256);

    /**
     * @notice Gets the index of the token owned by a specific address.
     * @param _owner Address of the owner.
     * @param _tokenId Token ID for which the index is queried.
     * @return The index of the token owned by the specified address.
     */
    function ownedTokensIndex(address _owner, uint256 _tokenId) external view returns (uint256);
}
