import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';

chai.should();
chai.use(smock.matchers);

const MAX_UINT240: BigNumber = BigNumber.from(
  '1766847064778384329583297500742918515827483896875618958121606201292619775'
);

describe('Investment Fund unit tests', () => {
  const managementFee: number = 200;

  let deployer: SignerWithAddress;
  let treasuryWallet: SignerWithAddress;
  let wallet: SignerWithAddress;

  const setup = async () => {
    const { investmentFund, usdc, investmentNft } = await loadFixture(deployFixture);

    usdc.transferFrom.reset();
    investmentNft.mint.reset();

    usdc.transferFrom.returns(true);
    investmentNft.mint.returns(1);

    return { investmentFund, usdc, investmentNft };
  };

  const deployFixture = async () => {
    [deployer, treasuryWallet, wallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
    const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
      'Investment Fund',
      usdc.address,
      investmentNft.address,
      treasuryWallet.address,
      managementFee
    ]);

    return { investmentFund, usdc, investmentNft };
  };

  describe('Deployment', () => {
    it(`Should return initial parameters`, async () => {
      const { investmentFund, usdc, investmentNft } = await loadFixture(deployFixture);

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
      expect(await investmentFund.treasuryWallet()).to.equal(treasuryWallet.address);
      expect(await investmentFund.managementFee()).to.equal(managementFee);
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
          managementFee
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
          managementFee
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
          managementFee
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
          10000
        ])
      ).to.be.revertedWith('Invalid management fee');
    });
  });

  describe('#setCurrency()', () => {
    it('Should set currency', async () => {
      const { investmentFund, usdc } = await setup();

      expect(await investmentFund.currency()).to.equal(usdc.address);

      expect(await investmentFund.connect(wallet).setCurrency(constants.AddressZero))
        .to.emit(investmentFund, 'CurrencyChanged')
        .withArgs(wallet.address, usdc.address, constants.AddressZero);
      expect(await investmentFund.currency()).to.equal(constants.AddressZero);
    });
  });

  describe('#setInvestmentNft()', () => {
    it('Should set Investment NFT', async () => {
      const { investmentFund, investmentNft } = await setup();

      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);

      expect(await investmentFund.connect(wallet).setInvestmentNft(constants.AddressZero))
        .to.emit(investmentFund, 'InvestmentNftChanged')
        .withArgs(wallet.address, investmentNft.address, constants.AddressZero);
      expect(await investmentFund.investmentNft()).to.equal(constants.AddressZero);
    });
  });

  describe('#invest()', () => {
    [1, MAX_UINT240].forEach((amount) => {
      it(`Should invest [amount=${amount}]`, async () => {
        const { investmentFund, usdc } = await setup();

        expect(await investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund.address, 'Invested')
          .withArgs(wallet.address, usdc.address, amount, 1);
      });
    });

    it(`Should revert investing if amount is 0`, async () => {
      const { investmentFund } = await setup();

      await expect(investmentFund.connect(wallet).invest(0)).to.be.revertedWith('Invalid amount invested');
    });

    it(`Should revert investing if currency fee transfer fails`, async () => {
      const { investmentFund, usdc } = await setup();

      usdc.transferFrom.returnsAtCall(0, false);
      usdc.transferFrom.returnsAtCall(1, true);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency fee transfer failed');
    });

    it(`Should revert investing if currency transfer fails`, async () => {
      const { investmentFund, usdc } = await setup();

      usdc.transferFrom.returnsAtCall(0, true);
      usdc.transferFrom.returnsAtCall(1, false);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    [0, 1].forEach((call) => {
      it(`Should revert investing if currency transfer reverts`, async () => {
        const { investmentFund, usdc } = await setup();

        usdc.transferFrom.revertsAtCall(call);

        await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
      });
    });

    it(`Should revert investing if investment NFT mint reverts`, async () => {
      const { investmentFund, investmentNft } = await setup();

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
    });
  });
});
