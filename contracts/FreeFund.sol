// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import "./InvestmentFund.sol";

error FreeFund__InvestmentNotAllowed();

contract FreeFund is InvestmentFund {
    event InvestmentAirdroped(address wallet, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     * @param _owner Contract owner
     * @param _unlocker Address of payout unlocker
     * @param _name Investment fund name
     * @param _currency Address of currency for investments
     * @param _investmentNft Address of investment NFT contract
     * @param _stakingWlth Address of contract for staking WLTH
     * @param _feeDistributionAddresses Addresses of fee distribution wallets
     * @param _cap Cap value
     */
    function initialize(
        address _owner,
        address _unlocker,
        string memory _name,
        address _currency,
        address _investmentNft,
        address _stakingWlth,
        FeeDistributionAddresses memory _feeDistributionAddresses,
        uint16,
        uint256 _cap,
        uint256
    ) public override initializer {
        super.initialize(
            _owner,
            _unlocker,
            _name,
            _currency,
            _investmentNft,
            _stakingWlth,
            _feeDistributionAddresses,
            0,
            _cap,
            0
        );

        allowFunction(LibFund.STATE_FUNDS_IN, this.airdropInvestmentNFT.selector);
    }

    /**
     * @inheritdoc IInvestmentFund
     * @dev Invest function is not allowed in FreeFund
     */
    function invest(uint240, string calldata) external override {
        revert FreeFund__InvestmentNotAllowed();
    }

    /**
     * @dev Mints investment NFT and send it to the wallet
     * @param _amount Amount of tokens to be invested
     * @param _wallet Address of wallet to receive investment NFT
     * @param _tokenUri URI of metadata for Investment NFT minted within investment
     */
    function airdropInvestmentNFT(
        uint240 _amount,
        address _wallet,
        string calldata _tokenUri
    ) external onlyOwner onlyAllowedStates {
        if (_amount <= MINIMUM_INVESTMENT) revert InvestmentFund__InvestmentTooLow();
        uint256 actualCap = s_cap;

        IInvestmentNFT nft = s_investmentNft;
        uint256 newTotalInvestment = nft.getTotalInvestmentValue() + _amount;

        if (newTotalInvestment > actualCap) revert InvestmentFund__TotalInvestmentAboveCap(newTotalInvestment);

        if (newTotalInvestment == actualCap) {
            currentState = LibFund.STATE_CAP_REACHED;
            emit CapReached(actualCap);
        }

        emit InvestmentAirdroped(_wallet, _amount);

        nft.mint(_wallet, _amount, _tokenUri);
    }
}
