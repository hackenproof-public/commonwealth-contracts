import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentNFT, USDC } from '../../typechain-types';
import { Fixture, FundState, SetupNamedParameters, SetupResult } from '../types';
import { createFixtureFactory, setCurrentState } from '../utils';

const MAX_UINT240: BigNumber = BigNumber.from(
  '1766847064778384329583297500742918515827483896875618958121606201292619775'
);

describe('Investment Fund unit tests', () => {
  const defaultManagementFee: number = 200;
  const defaultInvestmentCap: BigNumber = BigNumber.from(10 ** 12);

  let deployer: SignerWithAddress;
  let treasuryWallet: SignerWithAddress;
  let wallet: SignerWithAddress;

  const fixtureFactory = createFixtureFactory();

  const setup = async ({
    fundName = 'Investment Fund',
    managementFee = defaultManagementFee,
    cap = defaultInvestmentCap
  }: SetupNamedParameters = {}): Promise<SetupResult> => {
    [deployer, treasuryWallet, wallet] = await ethers.getSigners();
    const fixture: Fixture = await fixtureFactory.getFixture({
      fundName,
      treasuryWallet: treasuryWallet.address,
      managementFee,
      cap
    });

    const { investmentFund, usdc, investmentNft } = await loadFixture(fixture);

    usdc.transferFrom.reset();
    investmentNft.mint.reset();

    usdc.transferFrom.returns(true);
    investmentNft.mint.returns(1);

    return { investmentFund, usdc, investmentNft };
  };

  describe('Deployment', () => {
    it(`Should return initial parameters`, async () => {
      const { investmentFund, usdc, investmentNft } = await setup();

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
      expect(await investmentFund.treasuryWallet()).to.equal(treasuryWallet.address);
      expect(await investmentFund.managementFee()).to.equal(defaultManagementFee);
      expect(await investmentFund.cap()).to.equal(defaultInvestmentCap);
      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.Empty);
    });

    it(`Should revert deployment if invalid currency`, async () => {
      [deployer, treasuryWallet] = await ethers.getSigners();

      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          constants.AddressZero,
          investmentNft.address,
          treasuryWallet.address,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid currency address');
    });

    it(`Should revert deployment if invalid NFT address`, async () => {
      [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          constants.AddressZero,
          treasuryWallet.address,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid NFT address');
    });

    it(`Should revert deployment if invalid treasury wallet address`, async () => {
      [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          constants.AddressZero,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid treasury wallet address');
    });

    it(`Should revert deployment if invalid management fee`, async () => {
      [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          treasuryWallet.address,
          10000,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid management fee');
    });

    it(`Should revert deployment if invalid investment cap`, async () => {
      [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          treasuryWallet.address,
          defaultManagementFee,
          0
        ])
      ).to.be.revertedWith('Invalid investment cap');
    });
  });

  describe('#setCurrency()', () => {
    it('Should set currency', async () => {
      const { investmentFund, usdc } = await setup();

      expect(await investmentFund.currency()).to.equal(usdc.address);

      await expect(investmentFund.connect(wallet).setCurrency(constants.AddressZero))
        .to.emit(investmentFund, 'CurrencyChanged')
        .withArgs(wallet.address, usdc.address, constants.AddressZero);
      expect(await investmentFund.currency()).to.equal(constants.AddressZero);
    });
  });

  describe('#setInvestmentNft()', () => {
    it('Should set Investment NFT', async () => {
      const { investmentFund, investmentNft } = await setup();

      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);

      await expect(investmentFund.connect(wallet).setInvestmentNft(constants.AddressZero))
        .to.emit(investmentFund, 'InvestmentNFTChanged')
        .withArgs(wallet.address, investmentNft.address, constants.AddressZero);
      expect(await investmentFund.investmentNft()).to.equal(constants.AddressZero);
    });
  });

  describe('#invest()', () => {
    [BigNumber.from(1), defaultInvestmentCap.sub(1)].forEach((amount: BigNumber) => {
      it(`Should invest if amount lower than cap [amount=${amount}]`, async () => {
        const { investmentFund, usdc } = await setup();
        await setCurrentState(investmentFund, FundState.FundsIn);

        const fee: BigNumber = amount.mul(defaultManagementFee).div(10000);
        await expect(investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount.sub(fee), fee);
      });
    });

    //[default investment cap, cap for which amount is a maximum possible value]
    [defaultInvestmentCap, MAX_UINT240.sub(MAX_UINT240.mul(defaultManagementFee).div(10000))].forEach((cap) => {
      it(`Should invest with cap reached if amount equal to cap [cap=${cap}]`, async () => {
        const { investmentFund, usdc } = await setup({ cap });
        await setCurrentState(investmentFund, FundState.FundsIn);

        const amount: BigNumber = cap.mul(10000).div(10000 - defaultManagementFee);
        const fee: BigNumber = amount.mul(defaultManagementFee).div(10000);

        await expect(investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount.sub(fee), fee)
          .to.emit(investmentFund, 'CapReached')
          .withArgs(wallet.address, usdc.address, amount.sub(fee), cap);

        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.CapReached);
      });
    });

    it(`Should revert investing if amount greater than cap`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.FundsIn);

      const amount: BigNumber = defaultInvestmentCap
        .add(1)
        .mul(10000)
        .div(10000 - defaultManagementFee);
      const fee: BigNumber = amount.mul(defaultManagementFee).div(10000);

      await expect(investmentFund.connect(wallet).invest(amount)).to.be.revertedWith('Total invested funds exceed cap');
    });

    it(`Should revert investing if amount is 0`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.FundsIn);

      await expect(investmentFund.connect(wallet).invest(0)).to.be.revertedWith('Invalid amount invested');
    });

    it(`Should revert investing if currency fee transfer fails`, async () => {
      const { investmentFund, usdc } = await setup();
      await setCurrentState(investmentFund, FundState.FundsIn);

      usdc.transferFrom.returnsAtCall(0, false);
      usdc.transferFrom.returnsAtCall(1, true);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency fee transfer failed');
    });

    it(`Should revert investing if currency transfer fails`, async () => {
      const { investmentFund, usdc } = await setup();
      await setCurrentState(investmentFund, FundState.FundsIn);

      usdc.transferFrom.returnsAtCall(0, true);
      usdc.transferFrom.returnsAtCall(1, false);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    [0, 1].forEach((call) => {
      it(`Should revert investing if currency transfer reverts`, async () => {
        const { investmentFund, usdc } = await setup();
        await setCurrentState(investmentFund, FundState.FundsIn);

        usdc.transferFrom.revertsAtCall(call);

        await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
      });
    });

    it(`Should revert investing if investment NFT mint reverts`, async () => {
      const { investmentFund, investmentNft } = await setup();
      await setCurrentState(investmentFund, FundState.FundsIn);

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
    });

    [
      FundState.Empty,
      FundState.CapReached,
      FundState.FundsDeployed,
      FundState.Active,
      // FundState.Breakeven,
      FundState.Closed
    ].forEach((state) => {
      it(`Should revert if in invalid state: ${state}`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });
    });
  });

  describe('#addProject()', () => {
    it(`Should not revert if in Empty state`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.Empty);

      await expect(investmentFund.addProject()).not.to.be.reverted;
    });

    [
      FundState.FundsIn,
      FundState.CapReached,
      FundState.FundsDeployed,
      FundState.Active,
      // FundState.Breakeven,
      FundState.Closed
    ].forEach((state) => {
      it(`Should revert if in invalid state: ${state}`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.addProject()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });

  describe('#startCollectingFunds()', () => {
    it(`Should go to FundsIn state if in Empty state`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.Empty);

      await investmentFund.startCollectingFunds();

      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsIn);
    });

    [
      FundState.FundsIn,
      FundState.CapReached,
      FundState.FundsDeployed,
      FundState.Active,
      // FundState.Breakeven,
      FundState.Closed
    ].forEach((state) => {
      it(`Should revert if in invalid state: ${state}`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.startCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });

  describe('#stopCollectingFunds()', () => {
    it(`Should go to CapReached state if in FundsIn state`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.FundsIn);

      await investmentFund.stopCollectingFunds();

      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.CapReached);
    });

    [
      FundState.Empty,
      FundState.CapReached,
      FundState.FundsDeployed,
      FundState.Active,
      // FundState.Breakeven,
      FundState.Closed
    ].forEach((state) => {
      it(`Should revert if in invalid state: ${state}`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });

  describe('#deployFunds()', () => {
    it(`Should go to FundsDeployed state if in CapReached state`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.CapReached);

      await investmentFund.deployFunds();

      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsDeployed);
    });

    [
      FundState.Empty,
      FundState.FundsIn,
      FundState.FundsDeployed,
      FundState.Active,
      // FundState.Breakeven,
      FundState.Closed
    ].forEach((state) => {
      it(`Should revert if in invalid state: ${state}`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });

  describe('#activateFund()', () => {
    it(`Should go to Active state if in FundsDeployed state`, async () => {
      const { investmentFund } = await setup();
      await setCurrentState(investmentFund, FundState.FundsDeployed);

      await investmentFund.activateFund();

      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.Active);
    });

    [
      FundState.Empty,
      FundState.FundsIn,
      FundState.CapReached,
      FundState.Active,
      // FundState.Breakeven,
      FundState.Closed
    ].forEach((state) => {
      it(`Should revert if in invalid state: ${state}`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.activateFund()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });

  describe('#provideProfits()', () => {
    // todo: add breakeven state
    [FundState.Active].forEach((state) => {
      it(`Should not revert if in ${state} state`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await expect(investmentFund.provideProfits()).not.to.be.reverted;
      });
    });

    [FundState.Empty, FundState.FundsIn, FundState.CapReached, FundState.FundsDeployed, FundState.Closed].forEach(
      (state) => {
        it(`Should revert if in invalid state: ${state}`, async () => {
          const { investmentFund } = await setup();
          await setCurrentState(investmentFund, state);

          await expect(investmentFund.provideProfits()).to.be.revertedWith('Not allowed in current state');
        });
      }
    );
  });

  describe('#closeFund()', () => {
    // todo: add breakeven state
    [FundState.Active].forEach((state) => {
      it(`Should go to Closed state if in ${state} state`, async () => {
        const { investmentFund } = await setup();
        await setCurrentState(investmentFund, state);

        await investmentFund.closeFund();

        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.Closed);
      });
    });

    [FundState.Empty, FundState.FundsIn, FundState.CapReached, FundState.FundsDeployed, FundState.Closed].forEach(
      (state) => {
        it(`Should revert if in invalid state: ${state}`, async () => {
          const { investmentFund } = await setup();
          await setCurrentState(investmentFund, state);

          await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
        });
      }
    );
  });
});
