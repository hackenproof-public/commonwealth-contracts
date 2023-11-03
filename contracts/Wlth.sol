// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IWlth} from "./interfaces/IWlth.sol";

/**
 * @title WLTH contract
 */
contract Wlth is ERC20Upgradeable, AccessControlEnumerableUpgradeable, IWlth {
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    /**
     * @notice Number of burned tokens
     */
    uint256 public burned;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param name Token name
     * @param symbol Token symbol
     * @param owner Address with default admin role
     */
    function initialize(string memory name, string memory symbol, address owner) public initializer {
        __Context_init();
        __ERC20_init(name, symbol);
        __ERC165_init();
        __AccessControl_init();
        __AccessControlEnumerable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner);

        // TODO Token distribution will be defined according to token allocation table
        _mint(_msgSender(), 1e9 * 1e18); // 1 billion WLTH
    }

    /**
     * @inheritdoc IWlth
     */
    function burn(uint256 amount) external virtual override onlyRole(BURNER_ROLE) {
        _burn(_msgSender(), amount);
        burned += amount;
    }

    uint256[49] private __gap;
}
