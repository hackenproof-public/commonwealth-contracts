// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IWhitelistedVesting {
    struct WhitelistedWallet {
        uint256 released; // amount of WLTH already released by given wallet
        uint256 allocation; // total WLTH amount allocated to given wallet
        //bool isActive; // indicates if user will receive its token allocation for future cadences
    }

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
     * @notice Emitted when owner sets vesting start timestamp
     * @param wallet wallet for which allocation was changed
     * @param cadence cadence from which allocation was changed
     * @param actualAmount allocation after change
     */
    event CadenceAllocationForWalletChanged(
        address indexed wallet,
        uint256 indexed cadence,
        uint256 indexed actualAmount
    );

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param vestingStartTimestamp vesting start timestamp setted up
     */
    event VestingStartTimestampSetted(uint256 indexed vestingStartTimestamp);

    /**
     * @notice Wallet setup along with respective checks
     * @param _whitelistedAddress address of wallet to be whitelisted
     * @param _allocation total WLTH allocation for given wallet
     * @param _distribution Array of WLTH amounts which represents allocation per cadence, where array index reflects cadence number
     */
    function whitelistedWalletSetup(
        address _whitelistedAddress,
        uint256 _allocation,
        uint256[] memory _distribution
    ) external;

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
}
