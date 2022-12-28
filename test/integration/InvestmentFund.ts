import { smock } from '@defi-wonderland/smock';
import { Log } from '@ethersproject/providers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';
import { getLogs } from '../utils';

chai.should();
chai.use(smock.matchers);

describe('Investment Fund integration tests', () => {
  const managementFee: number = 200;
  const investedEventTopic: string = ethers.utils.id('Invested(address,address,uint256,uint256)');

  let deployer: SignerWithAddress;
  let treasuryWallet: SignerWithAddress;
  let wallet: SignerWithAddress;

  async function deployFixture() {
    [deployer, treasuryWallet, wallet] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', deployer, []);
    const investmentNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, []);
    const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
      'Investment Fund',
      usdc.address,
      investmentNft.address,
      treasuryWallet.address,
      managementFee
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
    [
      { amount: 1, invested: 1, fee: 0 },
      { amount: 15 * 10 ** 6, invested: 147 * 10 ** 5, fee: 3 * 10 ** 5 }
    ].forEach((data) => {
      it('Should invest ${amount} USDC if allowance is sufficient', async () => {
        const { investmentFund, usdc, investmentNft } = await loadFixture(deployFixture);
        const initialBalance: BigNumber = await usdc.balanceOf(wallet.address);

        await usdc.connect(wallet).approve(investmentFund.address, data.amount);
        const tx: ContractTransaction = await investmentFund.connect(wallet).invest(data.amount);

        const logsInvested: Log[] = await getLogs(tx, investmentFund.address, investedEventTopic);
        expect(logsInvested).to.have.length(1);

        const tokenId: BigNumber = investmentFund.interface.parseLog(logsInvested[0]).args.tokenId;

        expect(await usdc.balanceOf(wallet.address)).to.equal(initialBalance.sub(data.amount));
        expect(await usdc.balanceOf(treasuryWallet.address)).to.equal(data.fee);
        expect(await usdc.balanceOf(investmentFund.address)).to.equal(data.invested);
        expect(await investmentNft.investmentValue(tokenId)).to.equal(data.invested);
      });
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
