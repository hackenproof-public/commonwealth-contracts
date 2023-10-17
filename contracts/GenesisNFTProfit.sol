// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ERC165Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IStakingGenesisNFT} from "./interfaces/IStakingGenesisNFT.sol";
import {IGenesisNFTRevenue} from "./interfaces/IGenesisNFTRevenue.sol";
import {_transferFrom} from "./libraries/Utils.sol";
import {OwnablePausable} from "./OwnablePausable.sol";

/**
 * @title Project contract
 * @dev Holds tokens deployed by system for project and contract defining project tokens vesting schedule
 */
contract GenesisNFTRevenue is OwnablePausable, ERC165Upgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public genNftSeries1Contract;
    address public genNftSeries2Contract;
    address public stakingGenNftContract;

    /**
     * @notice Project name
     */
    string public name;

    /**
     * @notice ERC-20 contract address of token deployed by investment fund
     */
    address public token;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param owner_ Address with admin rights for project
     */
    function initialize(
        address owner_,
        address token_,
        address genNftSeries1Contract_,
        address genNftSeries2Contract_,
        address stakingGenNftContract_
    ) public initializer {
        __Context_init();
        __OwnablePausable_init(owner_);
        __ReentrancyGuard_init();
        token = token_;
        genNftSeries1Contract = genNftSeries1Contract_;
        genNftSeries2Contract = genNftSeries2Contract_;
        stakingGenNftContract = stakingGenNftContract_;
    }

    /**
     * @dev Check available revenue for address based on owned and staked Genesis NFTs
     */
    function claimRevenue(uint256 amount, address beneficiary) external nonReentrant {
        uint256 availableAmount = availableRevenue(beneficiary);
        require(accessCheck(beneficiary), "Access Denied");
        require(amount > 0, "Amount must be higher than zero");
        require(availableAmount >= amount, "Requested amount exceeds available revenue");
        require(IERC20Upgradeable(token).balanceOf(address(this)) >= amount, "Not enough tokens in contract");

        _transferFrom(token, address(this), _msgSender(), amount);
    }

    /**
     * @dev Check available revenue for address based on owned and staked Genesis NFTs
     */
    function availableRevenue(address beneficiary) public view returns (uint256) {
        return
            IERC20Upgradeable(token).balanceOf(address(this)) *
            (getSeries1TokenCount(beneficiary) / 2000 + getSeries2TokenCount(beneficiary) / 3414);
    }

    function accessCheck(address beneficiary) internal view returns (bool) {
        return getSeries1TokenCount(beneficiary) > 0 || getSeries2TokenCount(beneficiary) > 0;
    }

    /**
     * @dev Counts amount of Series 1 tokens both owned and staked by address
     */
    function getSeries1TokenCount(address beneficiary) internal view returns (uint256) {
        return
            IERC721Upgradeable(genNftSeries1Contract).balanceOf(beneficiary) +
            IStakingGenesisNFT(stakingGenNftContract).getStakedTokensLarge(beneficiary).length;
    }

    /**
     * @dev Counts amount of Series 2 tokens both owned and staked by address
     */
    function getSeries2TokenCount(address beneficiary) internal view returns (uint256) {
        return
            IERC721Upgradeable(genNftSeries2Contract).balanceOf(beneficiary) +
            IStakingGenesisNFT(stakingGenNftContract).getStakedTokensSmall(beneficiary).length;
    }

    /**
     * @inheritdoc IERC165Upgradeable
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IGenesisNFTRevenue).interfaceId || super.supportsInterface(interfaceId);
    }

    uint256[45] private __gap;
}
