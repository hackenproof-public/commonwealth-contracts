import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { formatBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { InvestmentFund, ProfitProvider, USDC } from '../../typechain-types';
import { FundState } from '../types';
import { toUsdc } from '../utils';

describe('ProfitProvider', () => {
  const deployProfitProvider = async () => {
    const [deployer, owner] = await ethers.getSigners();
    const minimumProfit = toUsdc('1000');

    const currency: FakeContract<USDC> = await smock.fake('USDC');
    const fund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');

    const profitProvider = (await deployProxy(
      'ProfitProvider',
      [owner.address, fund.address, currency.address, minimumProfit],
      deployer
    )) as ProfitProvider;

    return {
      deployer,
      owner,
      fund,
      currency,
      profitProvider,
      minimumProfit
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with initial params', async () => {
        const { profitProvider, owner, fund, currency, minimumProfit } = await loadFixture(deployProfitProvider);

        expect(await profitProvider.owner()).to.equal(owner.address);
        expect(await profitProvider.fund()).to.equal(fund.address);
        expect(await profitProvider.currency()).to.equal(currency.address);
        expect(await profitProvider.minimumProfit()).to.equal(minimumProfit);
      });

      it('Should deploy if the fund address is zero address', async () => {
        const { deployer, owner, currency, minimumProfit } = await loadFixture(deployProfitProvider);

        const profitProvider = (await deployProxy(
          'ProfitProvider',
          [owner.address, constants.AddressZero, currency.address, minimumProfit],
          deployer
        )) as ProfitProvider;

        expect(await profitProvider.owner()).to.equal(owner.address);
        expect(await profitProvider.fund()).to.equal(constants.AddressZero);
        expect(await profitProvider.currency()).to.equal(currency.address);
        expect(await profitProvider.minimumProfit()).to.equal(minimumProfit);
      });
    });

    describe('Reverts', () => {
      it("Should revert if the owner's address is the zero address", async () => {
        const { profitProvider, deployer, fund, currency, minimumProfit } = await loadFixture(deployProfitProvider);

        await expect(
          deployProxy(
            'ProfitProvider',
            [constants.AddressZero, fund.address, currency.address, minimumProfit],
            deployer
          )
        ).to.be.revertedWithCustomError(profitProvider, 'ProfitProvider__OwnerAccountZeroAddress');
      });

      it("Should revert when the currency's address is the zero address", async () => {
        const { profitProvider, deployer, owner, fund, minimumProfit } = await loadFixture(deployProfitProvider);

        await expect(
          deployProxy('ProfitProvider', [owner.address, fund.address, constants.AddressZero, minimumProfit], deployer)
        ).to.be.revertedWithCustomError(profitProvider, 'ProfitProvider__CurrencyZeroAddress');
      });

      it("Should revert when reinitializing the contract's params", async () => {
        const { profitProvider, owner, fund, currency, minimumProfit } = await loadFixture(deployProfitProvider);

        await expect(
          profitProvider.initialize(owner.address, fund.address, currency.address, minimumProfit)
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('Perform upkeep', () => {
    describe('Success', () => {
      it("Should perform the upkeep function and transfer the fund's profit to the fund", async () => {
        const { profitProvider, currency, fund, minimumProfit } = await loadFixture(deployProfitProvider);

        currency.balanceOf.whenCalledWith(profitProvider.address).returns(minimumProfit);
        currency.approve.returns(true);
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        await expect(profitProvider.performUpkeep('0x'))
          .to.emit(profitProvider, 'ProfitProvided')
          .withArgs(minimumProfit);
        expect(currency.approve).to.have.been.calledWith(fund.address, minimumProfit);
        expect(fund.provideProfit).to.have.been.calledWith(minimumProfit, true);
      });
    });

    describe('Reverts', () => {
      it('Should revert when balance less then minimum profit and fund not in cdp', async () => {
        const { profitProvider, currency, minimumProfit, fund } = await loadFixture(deployProfitProvider);

        const currentBalance = minimumProfit.sub(1);
        const state = formatBytes32String(FundState.FundsIn);
        currency.balanceOf.whenCalledWith(profitProvider.address).returns(currentBalance);
        fund.currentState.returns(state);

        await expect(profitProvider.performUpkeep('0x'))
          .to.be.revertedWithCustomError(profitProvider, 'ProfitProvider__UpkeepNotNeeded')
          .withArgs(currentBalance, state);
      });

      it('Should revert when balance less then minimum profit and fund in cdp', async () => {
        const { profitProvider, currency, minimumProfit, fund } = await loadFixture(deployProfitProvider);

        const currentBalance = minimumProfit.sub(1);
        const state = formatBytes32String(FundState.FundsDeployed);
        currency.balanceOf.whenCalledWith(profitProvider.address).returns(currentBalance);
        fund.currentState.returns(state);

        await expect(profitProvider.performUpkeep('0x'))
          .to.be.revertedWithCustomError(profitProvider, 'ProfitProvider__UpkeepNotNeeded')
          .withArgs(currentBalance, state);
      });

      it('Should revert when balance greater then minimum profit and fund not in cdp', async () => {
        const { profitProvider, currency, minimumProfit, fund } = await loadFixture(deployProfitProvider);

        const currentBalance = minimumProfit;
        const state = formatBytes32String(FundState.FundsIn);
        currency.balanceOf.whenCalledWith(profitProvider.address).returns(currentBalance);
        fund.currentState.returns(state);

        await expect(profitProvider.performUpkeep('0x'))
          .to.be.revertedWithCustomError(profitProvider, 'ProfitProvider__UpkeepNotNeeded')
          .withArgs(currentBalance, state);
      });
    });
  });

  describe('Check upkeep', () => {
    describe('Success', () => {
      it('Should the upkeep function return false if balance equal then minimum profit and fund in CDP', async () => {
        const { profitProvider, currency, fund, minimumProfit } = await loadFixture(deployProfitProvider);

        currency.balanceOf.whenCalledWith(profitProvider.address).returns(minimumProfit);
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        const results = await profitProvider.checkUpkeep('0x');
        expect(results[0]).to.be.false;
        expect(results[1]).to.equal('0x');
      });

      it('Should the upkeep function return true if balance greater then minimum profit', async () => {
        const { profitProvider, currency, minimumProfit } = await loadFixture(deployProfitProvider);

        currency.balanceOf.whenCalledWith(profitProvider.address).returns(minimumProfit.add(1));

        const results = await profitProvider.checkUpkeep('0x');
        expect(results[0]).to.be.true;
        expect(results[1]).to.equal('0x');
      });
    });

    it('Should the upkeep function return false if balance less then minimum profit and fund not in cdp', async () => {
      const { profitProvider, fund, currency, minimumProfit } = await loadFixture(deployProfitProvider);

      currency.balanceOf.whenCalledWith(profitProvider.address).returns(minimumProfit.sub(1));
      fund.currentState.returns(formatBytes32String(FundState.FundsIn));

      const results = await profitProvider.checkUpkeep('0x');
      expect(results[0]).to.be.false;
      expect(results[1]).to.equal('0x');
    });

    it('Should the upkeep function return false if balance less then minimum profit and fund in cdp', async () => {
      const { profitProvider, fund, currency, minimumProfit } = await loadFixture(deployProfitProvider);

      currency.balanceOf.whenCalledWith(profitProvider.address).returns(minimumProfit.sub(1));
      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

      const results = await profitProvider.checkUpkeep('0x');
      expect(results[0]).to.be.false;
      expect(results[1]).to.equal('0x');
    });

    it('Should the upkeep function return false if balance greater then minimum profit and fund not in cdp', async () => {
      const { profitProvider, fund, currency, minimumProfit } = await loadFixture(deployProfitProvider);

      currency.balanceOf.whenCalledWith(profitProvider.address).returns(minimumProfit.sub(1));
      fund.currentState.returns(formatBytes32String(FundState.FundsIn));

      const results = await profitProvider.checkUpkeep('0x');
      expect(results[0]).to.be.false;
      expect(results[1]).to.equal('0x');
    });
  });

  describe('Set minimum profit', () => {
    describe('Success', () => {
      it('Should set the minimum profit', async () => {
        const { profitProvider, owner } = await loadFixture(deployProfitProvider);

        const newMinimumProfit = toUsdc('2000');

        await expect(profitProvider.connect(owner).setMinimumProfit(newMinimumProfit))
          .to.emit(profitProvider, 'MinimumProfitSet')
          .withArgs(newMinimumProfit);
        expect(await profitProvider.minimumProfit()).to.equal(newMinimumProfit);
      });
    });

    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { profitProvider, deployer } = await loadFixture(deployProfitProvider);

        await expect(profitProvider.connect(deployer).setMinimumProfit(toUsdc('2000'))).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });
});
