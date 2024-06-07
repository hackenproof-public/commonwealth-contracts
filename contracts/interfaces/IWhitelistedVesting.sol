// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IWhitelistedVesting {
    /**
     * @notice Emitted when token released from vesting contract
     * @param beneficiary Wallet that released tokens
     * @param amount Amount released
     * @param penalty penalty included in this transaction
     */
    event Released(address indexed beneficiary, uint256 indexed amount, uint256 indexed penalty);

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param oldAmount Amount of whitelisted wallets before change
     * @param newAmount Amount of whitelisted wallets after change
     */
    event WhitelistedAddressesAmountChanged(uint256 indexed oldAmount, uint256 indexed newAmount);

    /**
     * @notice Emitted when new whitelisted wallet was set
     * @param whitelistedAddress whitelisted wallet's address
     * @param allocation total WLTH allocation for whitelisted wallet
     * @param distribution WLTH distribution table for given wallet
     */
    event WhitelistedWalletSetup(
        address indexed whitelistedAddress,
        uint256 indexed allocation,
        uint256[] indexed distribution
    );

    /**
     * @notice Emitted when whitelisted wallet was removed from whitelist
     * @param wallet deactivated wallet's address
     * @param newAddressesAmount total whitelisted wallets amount after deactivation
     * @param oldAddressesAmount total whitelisted wallets amount before deactivation
     */
    event AddressDeactivated(
        address indexed wallet,
        uint256 indexed newAddressesAmount,
        uint256 indexed oldAddressesAmount
    );

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param wallet wallet for which allocation was changed
     * @param cadence cadence from which allocation was changed
     * @param newAmount allocation before change
     * @param newAmount allocation after change
     */
    event CadenceAllocationForWalletChanged(
        address indexed wallet,
        uint256 indexed cadence,
        uint256 oldAmount,
        uint256 indexed newAmount
    );

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param vestingStartTimestamp vesting start timestamp setted up
     */
    event VestingStartTimestampSetted(uint256 indexed vestingStartTimestamp);

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param oldAllocation old token distribution array
     * @param newAllocation new token distribution array
     */
    event AllocationIncreased(uint256[] indexed oldAllocation, uint256[] indexed newAllocation);

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param oldAllocation old token distribution array
     * @param newAllocation new token distribution array
     */
    event AllocationDecreased(uint256[] indexed oldAllocation, uint256[] indexed newAllocation);

    /**
     * @notice Wallet setup along with respective checks
     * @param _whitelistedAddress address of wallet to be whitelisted
     * @param _distribution Array of WLTH amounts which represents allocation per cadence, where array index reflects cadence number
     */
    function whitelistedWalletSetup(address _whitelistedAddress, uint256[] memory _distribution) external;

    /**
     * @notice Allows Owner to remove address from whitelist
     * @param _whitelistedAddress address of wallet to be deactivated
     */
    function deactivateAddress(address _whitelistedAddress) external;

    /**
     * @notice Releases the tokens for whitelisted address
     * @param _amount amount of WLTH to be released with penalty
     * @param _beneficiary address of wallet which will be releasing WLTH
     */
    function releaseWithPenalty(uint256 _amount, address _beneficiary) external;

    /**
     * @notice Releases the tokens for whitelisted address
     * @param _amount amount of WLTH to be released
     * @param _beneficiary address of wallet which will be releasing WLTH
     */
    function release(uint256 _amount, address _beneficiary) external;

    /**
     * @notice Defines allocation of specific wallet in given cadence
     * @param _wallet address of whitelisted wallet
     * @param _cadenceNumber future cadence
     * @param _amount amount of WLTH which will be allocated to this wallet after given cadence
     */
    function setWalletAllocationForCadence(address _wallet, uint256 _cadenceNumber, uint256 _amount) external;

    /**
     * @notice Sets vesting start timestamp (one-time use)
     * @param _timestamp desired vesting start timestamp
     */
    function setVestingStartTimestamp(uint256 _timestamp) external;

    /**
     * @notice Increase contract allocation. WLTH should be sent to the contract after this action
     * @param newAllocation new token distribution array
     */
    function increaseAllocation(uint256[] calldata newAllocation) external;

    /**
     * @notice Decrease contract allocation and sends WLTH surplus to given wallet
     * @param newAllocation new token distribution array
     */
    function decreaseAllocation(uint256[] calldata newAllocation) external;

    /**
     * @notice calculates the penalty, gamification
     * @param _amount amount of WLTH to be released
     * @param _beneficiary address of wallet which will be releasing WLTH
     */
    function penalty(uint256 _amount, address _beneficiary) external view returns (uint256);

    /**
     * @notice Returns the address of the WLTH token contract.
     * @return The address of the WLTH token contract.
     */
    function wlth() external view returns (address);

    /**
     * @notice Returns the duration of the vesting period.
     * @return The duration of the vesting period.
     */
    function duration() external view returns (uint256);

    /**
     * @notice Returns the cadence of releasing rewards.
     * @return The cadence of releasing rewards.
     */
    function cadence() external view returns (uint256);

    /**
     * @notice Returns the timestamp at which the vesting starts.
     * @return The timestamp at which the vesting starts.
     */
    function vestingStartTimestamp() external view returns (uint256);

    /**
     * @notice Returns the total allocation of rewards.
     * @return The total allocation of rewards.
     */
    function allocation() external view returns (uint256);

    /**
     * @notice Returns the total amount of rewards released.
     * @return The total amount of rewards released.
     */
    function released() external view returns (uint256);

    /**
     * @notice Returns the total amount of currently whitelisted addresses
     */
    function whitelistedAddressesAmount() external view returns (uint256);

    /**
     * @notice Returns the community fund address
     */
    function communityFund() external view returns (address);

    /**
     * @notice Returns tokens release distribution for whole contract, defined at deployment
     */
    function tokenReleaseDistribution() external view returns (uint256[] memory);

    /**
     * @notice Returns if gamification is enabled for given contract
     */
    function gamification() external view returns (bool);

    /**
     * @notice Defines amount of vested tokens for given whitelisted wallet
     */
    function vestedAmountPerWallet(address _wallet) external view returns (uint256);

    /**
     * @notice Defines how many tokens can be released by given address
     */
    function releaseableAmountPerWallet(address _wallet) external view returns (uint256);

    /**
     * @notice Defines how many tokens was allocated to given address for given cadence
     */
    function walletAllocationForCadence(address _wallet, uint256 _cadenceNumber) external view returns (uint256);

    /**
     * @notice Returns how many tokens can be released from vesting contract
     */
    function releaseableAmount() external view returns (uint256);

    /**
     * @notice Defines how many tokens can be released from vesting contract for given cadence
     */
    function vestedAmountToCadence(uint256 _cadence) external view returns (uint256);

    /**
     * @notice Returns tokens vested by contract up to the actual timestamp in seconds
     */
    function vestedAmount() external view returns (uint256);

    /**
     * @notice Returns actual amount of passed cadences
     */
    function actualCadence() external view returns (uint256);

    /**
     * @notice Returns amount of WLTH already released by given wallet
     */
    function releasedAmountPerWallet(address _wallet) external view returns (uint256);

    /**
     * @notice Returns total amount of WLTH allocated to whitelisted wallets
     */
    function totalWalletAllocation() external view returns (uint256);

    /**
     * @notice Returns amount of WLTH allocated to whitelisted wallets for specific cadence
     */
    function totalWalletAllocationInCadence(uint256 _cadence) external view returns (uint256);
}
