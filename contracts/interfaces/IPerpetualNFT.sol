// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";

interface IPerpetualNFT is IERC721EnumerableUpgradeable {
    /**
     * @notice Metadata structure for NFT
     */
    struct Metadata {
        string name;
        string description;
        string image;
        string externalUrl;
    }

    /**
     * @notice Principal structure
     */
    struct Principal {
        uint256 tokenId;
        uint256 value;
    }
    /**
     * @notice Emitted when new minter account is added to contract
     * @param account Address of new minter
     */
    event MinterAdded(address indexed account);

    /**
     * @notice Emitted when minter account is removed from contract
     * @param account Address of removed minter
     */
    event MinterRemoved(address indexed account);

    /**
     * @notice Emitted when NFT is splitted
     * @param caller Address which removed minter
     * @param tokenId ID of splitted token
     */
    event TokenSplitted(address indexed caller, uint256 indexed tokenId);

    /**
     * @notice Emitted when metadata for NFT is changed
     * @param name Metadata name
     * @param description Metadata description
     * @param image Metadata image
     * @param externalUrl Metadata external URL
     */
    event MetadataChanged(string indexed name, string indexed description, string indexed image, string externalUrl);

    /**
     * @notice Emitted when metadata name for NFT is changed
     * @param name Metadata name
     */
    event MetadataNameChanged(string indexed name);

    /**
     * @notice Emitted when metadata description for NFT is changed
     * @param description Metadata description
     */
    event MetadataDescriptionChanged(string indexed description);

    /**
     * @notice Emitted when metadata image for NFT is changed
     * @param image Metadata image
     */
    event MetadataImageChanged(string indexed image);

    /**
     * @notice Emitted when metadata external URL for NFT is changed
     * @param externalUrl Metadata external URL
     */
    event MetadataExternalUrlChanged(string indexed externalUrl);

    /**
     * @notice Emitted when minimum value for NFT is changed
     * @param value New minimum value
     */
    event MinimumValueChanged(uint256 indexed value);

    /**
     * @notice Emitted when splitting is enabled or disabled
     * @param enabled True if splitting is enabled, false otherwise
     */
    event SplittingEnabled(bool indexed enabled);

    /**
     * @notice Emitted when new principal is added
     * @param tokenId Token ID
     * @param value Principal value
     */
    event PrincipalUpdated(uint256 indexed tokenId, uint256 indexed value);

    /**
     * @notice Emitted when perpetual fund is set
     * @param fund Perpetual fund address
     */
    event PerpetualFundSet(address indexed fund);

    /**
     * @notice Add new minter account
     * @param _account Address of new minter
     */
    function addMinter(address _account) external;

    /**
     * @notice Remove minter account
     * @param _account Address of removed minter
     */
    function removeMinter(address _account) external;

    /**
     * @notice Mints NFT with specified investment value and metadata URI
     * @param _to Token recipient
     * @param _value Investment value assigned to token
     */
    function mint(address _to, uint256 _value) external;

    /**
     * @notice Splits one NFT into multiple unique tokens
     * @dev Burns NFT indended for split and mints multiple ones in the place of the former one. Sum of values must equal to the value of splitted NFT
     * @param tokenId Token ID to split
     * @param values List of new tokens values
     * @param values List of new tokens metadata URIs
     */
    function split(uint256 tokenId, uint256[] calldata values) external;

    /**
     * @notice Update principal value for NFT
     * @param _principals List of new principals
     */
    function updatePrincipals(Principal[] memory _principals) external;

    function setPerpetualFund(address _perpetualFund) external;

    /**
     * @notice Set new metadata name
     * @param _name New metadata name
     */
    function setMetadataName(string memory _name) external;

    /**
     * @notice Set new metadata description
     * @param _description New metadata description
     */
    function setMetadataDescription(string memory _description) external;

    /**
     * @notice Set new metadata image
     * @param _image New metadata image
     */
    function setMetadataImage(string memory _image) external;

    /**
     * @notice Set new metadata external URL
     * @param _extenralUrl New metadata external URL
     */
    function setMetadataExternalUrl(string memory _extenralUrl) external;

    /**
     * @notice Set all metadata at once
     * @param _metadata Metadata structure
     */
    function setAllMetadata(Metadata memory _metadata) external;

    /**
     * @notice Enable or disable splitting
     * @param _enabled True if splitting is enabled, false otherwise
     */
    function enableSplitting(bool _enabled) external;

    /**
     * @notice Set minimum value for NFT
     * @param _minimumValue New minimum value
     */
    function setMinimumValue(uint256 _minimumValue) external;

    /**
     * @notice Returns true if account is minter
     * @param account Account address
     */
    function isMinter(address account) external view returns (bool);

    /**
     * @notice Returns true if splitting is enabled
     */
    function splittingEnabled() external view returns (bool);

    /**
     * @notice Returns address of the profit distributor
     */
    function profitDistributor() external view returns (address);

    /**
     * @notice Returns minimum value for NFT
     */
    function minimumValue() external view returns (uint256);

    /**
     * @notice Returns metadata for NFT
     */
    function metadata() external view returns (Metadata memory);

    /**
     * @notice Returns perpetual fund address
     */
    function perpetualFund() external view returns (address);

    /**
     * @notice Returns principal value for NFT
     * @param _tokenId Token ID
     */
    function currentPrincipal(uint256 _tokenId) external view returns (uint256);

    /**
     * @notice Returns value and principl for NFT
     * @param _tokenId Token ID
     */
    function getCurrentTokenValueDetails(uint256 _tokenId) external view returns (uint256, uint256);

    /**
     * @notice Returns summarized investment value from tokens holded by `account`
     * @param _account Account for which to retrieve investment value
     * @return Account's investment value
     */
    function getInvestmentValue(address _account) external view returns (uint256);

    /**
     * @notice Returns summarized investment value from tokens holded by `account` in specified block number
     * @param _account Account for which to retrieve investment value
     * @param _blockNumber Block number
     * @return Account's investment value in block
     */
    function getPastInvestmentValue(address _account, uint256 _blockNumber) external view returns (uint256);

    /**
     * @notice Returns summarized investment value for all tokens within fund
     * @return Total investment value
     */
    function getTotalInvestmentValue() external view returns (uint256);

    /**
     * @notice Returns percentage of the token as string
     * @param _tokenId Id of the token
     * @return Total String percentage
     */
    function getSharePercentage(uint256 _tokenId) external view returns (string memory);

    /**
     * @notice Returns summarized investment value for all tokens within fund in specified block number
     * @param _blockNumber Block number
     * @return Total investment value in block
     */
    function getPastTotalInvestmentValue(uint256 _blockNumber) external view returns (uint256);

    /**
     * @notice Returns account share of the fund in the form of account investment value and total value invested in fund
     * @param _account Account address
     * @return Account investment value
     * @return Total fund investment value
     */
    function getParticipation(address _account) external view returns (uint256, uint256);

    /**
     * @notice Returns account share of the fund in specified block number in the form of account investment value and total value invested in fund
     * @param _account Account address
     * @param _blockNumber Block number for which to retrieve share
     * @return Account investment value
     * @return Total fund investment value
     */
    function getPastParticipation(address _account, uint256 _blockNumber) external view returns (uint256, uint256);

    /**
     * @notice Returns accounts holding at least one NFT
     * @return List of accounts
     */
    function getInvestors() external view returns (address[] memory);

    /**
     * @notice Returns investment value assigned to NFT
     * @param _tokenId Token ID
     * @return Token investment value
     */
    function tokenValue(uint256 _tokenId) external view returns (uint256);
}
