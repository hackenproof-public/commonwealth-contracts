// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface ISimpleVesting {
    /**
     * @notice Emitted when token released from vesting contract
     * @param beneficiary Wallet that released tokens
     * @param wlth Token address
     * @param amount Amount released
     */
    event Released(address indexed beneficiary, address indexed wlth, uint256 indexed amount);

    /**
     * @notice Emitted when benefitiary changed by owner
     * @param oldBenefitiary address able to release before change
     * @param newBenefitiary new address available to release
     */
    event BeneficiaryChanged(address indexed oldBenefitiary, address indexed newBenefitiary);

    /**
     * @notice Emitted when owner sets vesting start timestamp
     * @param vestingStartTimestamp vesting start timestamp setted up
     */
    event VestingStartTimestampSetted(uint256 indexed vestingStartTimestamp);

    /**
     * @notice Releases the tokens for whitelisted address
     * @param _amount amount of WLTH to be released
     * @param _beneficiary address of wallet which will be releasing WLTH
     */
    function release(uint256 _amount, address _beneficiary) external;

    /**
     * @notice Sets vesting start timestamp (one-time use)
     * @param _timestamp desired vesting start timestamp
     */
    function setVestingStartTimestamp(uint256 _timestamp) external;

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
     * @notice Beneficiary setter
     */
    function setBeneficiary(address beneficiary_) external;

    /**
     * @notice Address which can release vested tokens
     */
    function beneficiary() external view returns (address);

    /**
     * @notice Returns tokens vested up to the actual timestamp in seconds
     */
    function vestedAmount() external view returns (uint256);

    /**
     * @notice Returns releaseable amount of vesting token. Defined by children vesting contracts
     */
    function releaseableAmount() external view returns (uint256);
}
