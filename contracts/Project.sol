// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165, IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IProject} from "./interfaces/IProject.sol";
import {LibProject} from "./libraries/LibProject.sol";

/**
 * @title Project contract
 * @dev Holds tokens deployed by system for project and contract defininf project tokens vesting schedule
 */
contract Project is IProject, ERC165, Ownable {
    /**
     * @notice Project name
     */
    string public name;

    /**
     * @notice Project status
     */
    bytes32 public status;

    /**
     * @notice Vesting contract address
     */
    address public vesting;

    /**
     * @notice Number of tokens deployed to project
     */
    uint256 public fundsDeployed;

    /**
     * @notice Initializes the contract
     * @param name_ Investment fund name
     * @param owner_ Address with admin rights for project
     */
    constructor(string memory name_, address owner_) {
        require(owner_ != address(0), "Owner is zero address");

        name = name_;
        status = LibProject.STATUS_ADDED;
        transferOwnership(owner_);
    }

    /**
     * @inheritdoc IProject
     */
    function setVesting(address vesting_) external onlyOwner {
        require(vesting_ != address(0), "Vesting is zero address");

        emit VestingContractChanged(msg.sender, vesting, vesting_);
        vesting = vesting_;
    }

    /**
     * @inheritdoc IProject
     */
    function getDetails() external view returns (ProjectDetails memory) {
        return ProjectDetails(name, status, vesting);
    }

    function deployFunds(uint256 amount) external {
        // TODO implement funds deployment
        fundsDeployed += amount;
        status = LibProject.STATUS_DEPLOYED;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IProject).interfaceId || super.supportsInterface(interfaceId);
    }
}
