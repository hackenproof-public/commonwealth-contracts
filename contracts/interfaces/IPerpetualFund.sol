// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

/**
 * @title Investment Fund interface
 */
interface IPerpetualFund {
    /**
     * @notice Details of investment fund
     */
    struct Details {
        string name;
        address currency;
        address perpetualNFT;
        address revenueWallet;
        address lpPoolWallet;
        address buybackAndBurnWallet;
        address secondarySalesWallet;
        uint16 managementFee;
        uint256 totalInvestment;
        uint256 totalIncome;
        uint256 minimumInvestment;
    }

    /**
     * @notice Configuration of investment fund
     */
    struct Config {
        string name;
        uint16 managementFee;
        uint256 minimumInvestment;
        address revenueWallet;
        address lpPoolWallet;
        address buybackAndBurnWallet;
        address secondarySalesWallet;
    }
    /**
     *
     * @notice Unassigned profit
     */
    struct UnassignedProfit {
        address wallet;
        uint256 notSubjectedToCarryFee;
        uint256 subjectedToCarryFee;
    }

    /**
     * @notice User profit
     */
    struct UserProfit {
        uint256 profitId;
        bool withdrawn;
        uint256 nonSubjectedToCarryFee;
        uint256 subjectedToCarryFee;
    }

    /**
     * @notice Profit
     */
    struct Profit {
        uint256 id;
        uint256 provided;
        uint256 distributed;
        uint256 blockNumber;
    }

    /**
     * @notice Emitted when user invests in fund
     * @param investor Investor address
     * @param currency Currency used for investment
     * @param value Amount of tokens spent for investment
     * @param fee Amount of tokens spent for fee
     */
    event Invested(address indexed investor, address indexed currency, uint256 value, uint256 fee);

    /**
     * @notice Emitted when new profit is provided to investment fund
     * @param index Index of profit
     * @param income Provided income, including fee
     * @param blockNumber Block number of profit providing
     */
    event ProfitProvided(uint256 indexed index, uint256 indexed income, uint256 indexed blockNumber);

    /**
     * @notice Emitted when profit distributed to a user
     * @param profitId Id of profit
     * @param wallet Wallet address
     * @param nonSubjectedToCarryFee Amount of tokens not subjected to carry fee
     * @param subjectedToCarryFee Amount of tokens subjected to carry fee
     */
    event ProfitDistributed(
        uint256 profitId,
        address indexed wallet,
        uint256 indexed nonSubjectedToCarryFee,
        uint256 indexed subjectedToCarryFee
    );

    /**
     * @notice Emitted when user withdraws profit from fund
     * @param recipient Recipient address
     * @param amount Amount of tokens withdrawn
     */
    event ProfitWithdrawn(address indexed recipient, uint256 indexed amount);

    /**
     * @notice Emitted when staking WLTH contract is set
     * @param stakingWlth Address of staking WLTH contract
     */
    event StakingWlthSet(address indexed stakingWlth);

    /**
     * Emmited when minimum investment amount is set
     * @param minimumInvetment Minimum investment amount
     */
    event MinimumInvestmentSet(uint256 indexed minimumInvetment);

    /**
     * @notice Emitted when profit provider is set
     * @param profitProvider Address of profit provider
     */
    event ProfitProviderSet(address indexed profitProvider);

    /**
     * @notice Emitted when buyback and burn address  is set
     * @param buybackAndBurn Address of buyback and burn
     */
    event BuybackAndBurnAddressSet(address indexed buybackAndBurn);

    /**
     * @notice Emitted when fund is closed
     */
    event FundClosed();

    /**
     * @notice Invests 'amount' number of USD Coin tokens to investment fund.
     *
     * Requirements:
     * - 'amount' must be greater than zero.
     * - Caller must have been allowed in USD Coin to move this token by {approve}.
     *
     * Emits a {Invested} event.
     *
     * @param _amount Amount of tokens to be invested
     */
    function invest(uint240 _amount) external;

    /**
     * @notice Withdraws all avaiable profits in USD Coin tokens using investment NFT.
     *
     * Emits a {Withdrawn} event.
     *
     */
    function withdraw() external;

    /**
     * @notice Provides 'amount' number of USD Coin tokens to be distributed between investors.
     *
     * Emits a {ProfitProvided} event.
     *
     * @param _amount Amount of tokens provided within payout
     */
    function provideProfit(uint256 _amount) external;

    /**
     * @notice Distributes profits between investors.
     *
     * Emits a {ProfitDistributed} event.
     *
     * @param profitId Id of profit to be distributed
     * @param profits Array of profits to be distributed
     */
    function distributeProfit(uint256 profitId, UnassignedProfit[] memory profits) external;

    /**
     * @notice Sets staking WLTH contract address.
     * @param _stakingWlth Address of staking WLTH contract
     */
    function setStakingWlth(address _stakingWlth) external;

    /**
     * @notice Sets the minimum investment amount.
     * @param _minimumInvestment Minimum investment amount
     */
    function setMinimumInvestment(uint256 _minimumInvestment) external;

    /**
     * @notice Sets profit provider address
     * @param _profitProvider Address of profit provider
     */
    function setProfitProvider(address _profitProvider) external;

    /**
     * @notice Sets buyback and burn address
     * @param _buybackAndBurn Address of buyback and burn contract
     */
    function setBuybackAndBurnAddress(address _buybackAndBurn) external;

    /**
     * @notice Returns funds available for account to be withdrawn, connected carry fee and last used payout index.
     *
     * @param _account Wallet address for which to check available funds details
     */
    function getAvailableFundsDetails(
        address _account
    ) external view returns (uint256 amount, uint256 carryFee, uint256 lastPayoutIndex);

    /**
     * @notice Returns public details of investment fund
     */
    function getDetails() external view returns (Details memory);

    /**
     * @notice Returns investment NFT contract
     */
    function perpetualNFT() external view returns (address);

    /**
     * @notice Returns name of investment fund
     */
    function name() external view returns (string memory);

    /**
     * @notice Returns address of currency for investments
     */
    function currency() external view returns (address);

    /**
     * @notice Returns address of contract for staking WLTH
     */
    function stakingWlth() external view returns (address);

    /**
     * @notice Returns address of the revenue wallet
     */
    function revenueWallet() external view returns (address);

    /**
     * @notice Returns address of LP pool wallet
     */
    function lpPoolWallet() external view returns (address);

    /**
     * @notice Returns address of buyback and burn wallet
     */
    function buybackAndBurnWallet() external view returns (address);

    /**
     * @notice Returns management fee
     */
    function managementFee() external view returns (uint16);

    /**
     * @notice Returns address of secondary sales wallet
     */
    function secondarySalesWallet() external view returns (address);

    /**
     * @notice Returns total returned profits
     */
    function totalIncome() external view returns (uint256);

    /**
     * @notice Returns total user withdrawals amount
     * @param _wallet Wallet address
     */
    function userTotalWithdrawal(address _wallet) external view returns (uint256);

    /**
     * @notice Returns minimum investment amount
     */
    function minimumInvestment() external view returns (uint256);

    /**
     * @notice Returns profit provider
     */
    function profitProvider() external view returns (address);

    /**
     * @notice Change fund status to closed
     */
    function closeFund() external;

    /**
     * @notice Returns profit distributor address
     */
    function profitDistributor() external view returns (address);

    /**
     * @notice Returns address of profit generator
     */
    function profitGenerator() external view returns (address);

    /**
     * @notice Returns profit details
     */
    function getProfit(uint256 _profitId) external view returns (Profit memory);

    /**
     * @notice Returns total profits counter
     */
    function getProfitCounter() external view returns (uint256);

    /**
     * @notice Returns user profits
     */
    function getUserProfits(address _account) external view returns (UserProfit[] memory);

    /**
     * @notice Returns next user profit id
     */
    function nextUserProfitId(address _account) external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function totalWithdrawal() external view returns (uint256);
}
