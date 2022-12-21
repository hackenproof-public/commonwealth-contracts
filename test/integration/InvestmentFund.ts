import { smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';

chai.should();
chai.use(smock.matchers);

describe('Investment Fund integration tests', () => {
  let deployer: SignerWithAddress;
  let wallet: SignerWithAddress;

  async function deployFixture() {
    [deployer, wallet] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', deployer, []);
    const investmentNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, []);
    const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
      'Investment Fund',
      usdc.address,
      investmentNft.address
    ]);

    await usdc.mint(wallet.address, 1000 * 10 ** 6);

    return { investmentFund, usdc, investmentNft };
  }

  describe('Deployment', () => {
    it('Should deploy', async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await usdc.balanceOf(wallet.address)).to.equal(1000 * 10 ** 6);
    });
  });

  describe('Invest', () => {
    it('Should invest if allowance is sufficient', async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      await usdc.connect(wallet).approve(investmentFund.address, 15 * 10 ** 6);
      await investmentFund.connect(wallet).invest(15 * 10 ** 6);

      expect(await usdc.balanceOf(wallet.address)).to.equal(985 * 10 ** 6);
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(15 * 10 ** 6);
    });

    it('Should revert investing if allowance is insufficient', async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      await usdc.connect(wallet).approve(investmentFund.address, 15 * 10 ** 6 - 1);
      await expect(investmentFund.connect(wallet).invest(15 * 10 ** 6)).to.be.revertedWith(
        'ERC20: insufficient allowance'
      );
    });
  });
});
