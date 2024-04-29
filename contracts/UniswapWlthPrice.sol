// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.18;

import {OwnablePausable} from "./OwnablePausable.sol";
import {OracleLibrary} from "./libraries/uniswap/OracleLibrary.sol";
import {IUniswapWlthPrice} from "./interfaces/IUniswapWlthPrice.sol";

error UniswapWlthPrice__WlthZeroAddress();
error UniswapWlthPrice__UsdcZeroAddress();
error UniswapWlthPrice__PoolZeroAddress();
error UniswapWlthPrice__TokenNotSupported();
error UniswapWlthPrice__ZeroAmount();
error UniswapWlthPrice__ObservationTimeZero();

contract UniswapWlthPrice is IUniswapWlthPrice, OwnablePausable {
    /**
     * @notice Observation time
     */
    uint32 private s_observationTime;

    /**
     * @notice Address of WLTH token contract
     */
    address private s_wlth;

    /**
     * @notice Address of USDC token contract
     */
    address private s_usdc;

    /**
     * @notice Address of Uniswap V3 pool
     */
    address private s_pool;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract
     * @param _owner Address of contract owner
     * @param _wlth Address of WLTH token contract
     * @param _usdc Address of USDC token contract
     * @param _pool Address of Uniswap V3 pool
     * @param _observationTime observation time
     */

    function initialize(
        address _owner,
        address _wlth,
        address _usdc,
        address _pool,
        uint32 _observationTime
    ) public initializer {
        if (_wlth == address(0)) revert UniswapWlthPrice__WlthZeroAddress();
        if (_usdc == address(0)) revert UniswapWlthPrice__UsdcZeroAddress();
        if (_pool == address(0)) revert UniswapWlthPrice__PoolZeroAddress();
        if (_observationTime == 0) revert UniswapWlthPrice__ObservationTimeZero();

        s_wlth = _wlth;
        s_usdc = _usdc;
        s_pool = _pool;
        s_observationTime = _observationTime;

        __Context_init();
        __OwnablePausable_init(_owner);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function setObservationTime(uint32 _newObservationTime) external onlyOwner {
        if (_newObservationTime == 0) revert UniswapWlthPrice__ObservationTimeZero();
        uint32 oldObservationTime = s_observationTime;
        s_observationTime = _newObservationTime;
        emit ObservationTimeSet(oldObservationTime, _newObservationTime);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function estimateAmountOut(uint128 _amountIn) external view returns (uint256) {
        if (_amountIn == 0) revert UniswapWlthPrice__ZeroAmount();
        (int24 tick, ) = OracleLibrary.consult(s_pool, s_observationTime);

        return OracleLibrary.getQuoteAtTick(tick, _amountIn, s_wlth, s_usdc);
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function getWlthTokenAddress() external view returns (address) {
        return s_wlth;
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function getUsdcTokenAddress() external view returns (address) {
        return s_usdc;
    }

    /**
     * @inheritdoc IUniswapWlthPrice
     */
    function getPoolAddress() external view returns (address) {
        return s_pool;
    }

    uint256[48] private __gap;
}
