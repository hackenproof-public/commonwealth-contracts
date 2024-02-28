// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

/**
 * @title Investment Fund interface
 */
interface IInvestmentFund {
    struct Details {
        string name;
        address currency;
        address investmentNft;
        address treasuryWallet;
        address nesisNftRevenue;
        address lpPoolAddress;
        address burnAddress;
        address communityFund;
        uint16 managementFee;
        uint256 cap;
        uint256 totalInvestment;
        uint256 totalIncome;
        Payout[] payouts;
        bytes32 state;
    }

    struct Block {
        uint128 number;
        uint128 timestamp;
    }

    struct Payout {
        uint256 value;
        Block blockData;
        bool inProfit;
        bool locked;
    }

    /**
     * @notice Emitted when breakeven for investment fund is reached
     * @param breakeven Breakeven value
     */
    event BreakevenReached(uint256 indexed breakeven);

    /**
     * @notice Emitted when investment cap is reached
     * @param cap Cap value
     */
    event CapReached(uint256 cap);

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
     * @param investmentFund Address of investment fund to which profit is provided
     * @param income Provided income, including fee
     * @param fee Carry Fee
     * @param blockNumber Number of block in which profit is provided
     */
    event ProfitProvided(address indexed investmentFund, uint256 income, uint256 fee, uint256 indexed blockNumber);

    /**
     * @notice Emitted when user withdraws profit from fund
     * @param recipient Recipient address
     * @param currency Currency used for withdrawal
     * @param amount Amount of tokens withdrawn
     */
    event ProfitWithdrawn(address indexed recipient, address indexed currency, uint256 amount);

    /**
     * @notice Emitted when payouts are unlocked
     * @param from Index of first payout unlocked
     * @param to Index of last payout unlocked
     */
    event PayoutsUnlocked(uint256 from, uint256 to);

    /**
     * @notice Emitted when project is added to a fund
     * @param caller Address that added project
     * @param project Project address
     */
    event ProjectAdded(address indexed caller, address indexed project);

    /**
     * @notice Emitted when tokens are deployed to a project from a investment fund
     * @param caller Address that deployed funds
     * @param project Project address
     * @param amount Amount of tokens deployed to project
     */
    event FundsDeployedToProject(address indexed caller, address indexed project, uint256 amount);

    /**
     * @notice Emitted when project is removed from a fund
     * @param caller Address that removed project
     * @param project Project address
     */
    event ProjectRemoved(address indexed caller, address indexed project);

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
     * @param _tokenUri URI of metadata for Investment NFT minted within investment
     */
    function invest(uint240 _amount, string calldata _tokenUri) external;

    /**
     * @notice Unlocks payouts to given index.
     *
     * Requirements:
     * - 'to' must be lower or equal than number of payouts.
     *
     * Emits a {PayoutsUnlocked} event.
     *
     * @param _index Index of last payout to unlock
     */
    function unlockPayoutsTo(uint256 _index) external;

    /**
     * @notice Withdraws all avaiable profits in USD Coin tokens using investment NFT.
     *
     * Emits a {Withdrawn} event.
     *
     */
    function withdraw() external;

    /**
     * @notice Adds project to investment fund. Throws if project already exists in fund.
     *
     * Requirements:
     * - Project must not exist in fund
     *
     * Emits ProjectAdded event
     *
     * @param _project Address of project to be added
     */
    function addProject(address _project) external;

    /**
     * @notice Deploys funds to project.
     *
     * Requirements:
     * - project must be added to investment fund
     * - amount must be higher than zero and lower than available funds defined by project contract
     *
     * @param _project project contract address which will receive funds
     * @param _amount Amount of funds to deploy to project
     */
    function deployFundsToProject(address _project, uint256 _amount) external;

    /**
     * @notice Rmoves a projects from fund
     *
     * Requirements:
     * - Project must exist in fund
     *
     * Emits ProjectRemoved event
     *
     * @param _project Address of project to be added
     */
    function removeProject(address _project) external;

    /**
     * @notice Provides 'amount' number of USD Coin tokens to be distributed between investors.
     *
     * Emits a {ProfitProvided} event.
     *
     * @param _amount Amount of tokens provided within payout
     */
    function provideProfit(uint256 _amount) external;

    /**
     * @notice Returns amount of profit payouts made within a fund.
     */
    function getPayoutsCount() external view returns (uint256);

    /**
     * @notice Returns funds available for account to be withdrawn, connected carry fee and last used payout index.
     *
     * @param _account Wallet address for which to check available funds details
     */
    function getAvailableFundsDetails(
        address _account
    ) external view returns (uint256 amount, uint256 carryFee, uint256 lastPayoutIndex);

    /**
     * @notice Returns list of projects within a fund
     */
    function listProjects() external view returns (address[] memory);

    /**
     * @notice Returns number of projects within fund
     */
    function getProjectsCount() external view returns (uint256);

    /**
     * @notice Returns if fund is already in profit (breakeven is reached).
     */
    function isInProfit() external view returns (bool);

    /**
     * @notice Returns public details of investment fund
     */
    function getDetails() external view returns (Details memory);

    /**
     * @notice Returns investment NFT contract
     */
    function investmentNft() external view returns (address);

    /**
     * @notice Returns name of investment fund
     */
    function name() external view returns (string memory);

    /**
     * @notice Returns address of currency for investments
     */
    function currency() external view returns (address);

    /**
     * @notice Returns address of payout unlocker
     */
    function unlocker() external view returns (address);

    /**
     * @notice Returns address of contract for staking WLTH
     */
    function stakingWlth() external view returns (address);

    /**
     * @notice Returns address of fee distribution wallets
     */
    function treasuryWallet() external view returns (address);

    /**
     * @notice Returns address of fee distribution wallets
     */
    function genesisNftRevenue() external view returns (address);

    /**
     * @notice Returns address of LP pool
     */
    function lpPoolAddress() external view returns (address);

    /**
     * @notice Returns address of burn address
     */
    function burnAddress() external view returns (address);

    /**
     * @notice Returns management fee
     */
    function managementFee() external view returns (uint16);

    /**
     * @notice Returns address of community fund
     */
    function communityFund() external view returns (address);

    /**
     * @notice Returns cap value
     */
    function cap() external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function totalIncome() external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function nextPayoutToUnlock() external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function userTotalWithdrawal() external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function userNextPayout() external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function maxPercentageWalletInvestmentLimit() external view returns (uint256);

    /**
     * @notice Returns total investment
     */
    function payouts() external view returns (Payout[] memory);

    /**
     * @notice Returns total investment
     */
    function payout(uint256 _index) external view returns (Payout memory);
}
