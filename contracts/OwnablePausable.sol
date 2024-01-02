// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

error OwnablePausable__OwnerAccountZeroAddress();

contract OwnablePausable is OwnableUpgradeable, PausableUpgradeable {
    // solhint-disable-next-line func-name-mixedcase
    function __OwnablePausable_init(address owner_) internal onlyInitializing {
        __OwnablePausable_init_unchained(owner_);
    }

    // solhint-disable-next-line func-name-mixedcase
    function __OwnablePausable_init_unchained(address owner_) internal onlyInitializing {
        if (owner_ == address(0)) revert OwnablePausable__OwnerAccountZeroAddress();

        __Ownable_init();
        __Pausable_init();

        _transferOwnership(owner_);
    }

    /**
     * @notice Pauses crowdsale - disables all transfer operations
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses crowdsale - enables all transfer operations
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @notice disables renounceOwnership - contract cannot be ownerless
     */
    function renounceOwnership() public view override onlyOwner {
        revert("disabled");
    }

    uint256[50] private __gap;
}
