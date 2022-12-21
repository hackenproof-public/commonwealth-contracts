import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';

chai.should();
chai.use(smock.matchers);

describe('Investment Fund unit tests', () => {
  let deployer: SignerWithAddress;
  let wallet: SignerWithAddress;

  async function deployFixture() {
    [deployer, wallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
    const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
      'Investment Fund',
      usdc.address,
      investmentNft.address
    ]);

    usdc.transferFrom.returns(true);
    investmentNft.mint.returns(1);

    return { investmentFund, usdc, investmentNft };
  }

  describe('Deployment', () => {
    it(`Should return initial parameters`, async () => {
      const { investmentFund, usdc, investmentNft } = await loadFixture(deployFixture);

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
    });

    it(`Should revert deployment if invalid currency`, async () => {
      [deployer] = await ethers.getSigners();

      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, ['Investment Fund', constants.AddressZero, investmentNft.address])
      ).to.be.revertedWith('Invalid currency address');
    });

    it(`Should revert deployment if invalid NFT address`, async () => {
      [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      await expect(
        deploy('InvestmentFund', deployer, ['Investment Fund', usdc.address, constants.AddressZero])
      ).to.be.revertedWith('Invalid NFT address');
    });
  });

  describe('#setCurrency()', () => {
    it('Should set currency', async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      expect(await investmentFund.currency()).to.equal(usdc.address);

      expect(await investmentFund.connect(wallet).setCurrency(constants.AddressZero))
        .to.emit(investmentFund, 'CurrencyChanged')
        .withArgs(wallet.address, usdc.address, constants.AddressZero);
      expect(await investmentFund.currency()).to.equal(constants.AddressZero);
    });
  });

  describe('#setInvestmentNft()', () => {
    it('Should set Investment NFT', async () => {
      const { investmentFund, investmentNft } = await loadFixture(deployFixture);

      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);

      expect(await investmentFund.connect(wallet).setInvestmentNft(constants.AddressZero))
        .to.emit(investmentFund, 'InvestmentNftChanged')
        .withArgs(wallet.address, investmentNft.address, constants.AddressZero);
      expect(await investmentFund.investmentNft()).to.equal(constants.AddressZero);
    });
  });

  describe('#invest()', () => {
    [constants.MaxUint256].forEach((amount) => {
      it.only(`Should invest [amount=${amount}]`, async () => {
        const { investmentFund, usdc } = await loadFixture(deployFixture);

        expect(await investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund.address, 'Invested')
          .withArgs(wallet.address, usdc.address, amount, 1);
      });
    });

    it(`Should revert investing if amount is 0`, async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      await expect(investmentFund.connect(wallet).invest(0)).to.be.revertedWith('Invalid amount invested');
    });

    it(`Should revert investing if currency transfer fails`, async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      usdc.transferFrom.returns(false);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    it(`Should revert investing if currency transfer reverts`, async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      usdc.transferFrom.reverts();

      await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
    });

    it(`Should revert investing if investment NFT mint reverts`, async () => {
      const { investmentFund, usdc, investmentNft } = await loadFixture(deployFixture);

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
    });
  });
});
