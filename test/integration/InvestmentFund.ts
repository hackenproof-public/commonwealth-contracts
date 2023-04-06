import { Log } from '@ethersproject/providers';
import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';
import { getLogs, toUsdc } from '../utils';

describe('Investment Fund integration tests', () => {
  const managementFee = 1000;
  const defaultInvestmentCap = toUsdc('1000000');
  const investedEventTopic = ethers.utils.id('Invested(address,address,uint256,uint256)');
  const mintedEventTopic = ethers.utils.id('Transfer(address,address,uint256)');

  let investmentFund: InvestmentFund;
  let usdc: USDC;
  let investmentNft: InvestmentNFT;
  let deployer: SignerWithAddress;
  let wallet: SignerWithAddress;
  let treasuryWallet: SignerWithAddress;
  let profitProvider: SignerWithAddress;
  let restorer: SnapshotRestorer;

  async function deployFixture() {
    [deployer, treasuryWallet, wallet, profitProvider] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', deployer, []);
    const investmentNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, []);
    const investmentFund: InvestmentFund = await deploy('InvestmentFund', deployer, [
      'Investment Fund',
      usdc.address,
      investmentNft.address,
      treasuryWallet.address,
      managementFee,
      defaultInvestmentCap
    ]);

    await usdc.mint(deployer.address, toUsdc('1000000'));
    await usdc.mint(wallet.address, toUsdc('1000000'));

    return { investmentFund, usdc, investmentNft, deployer, wallet, treasuryWallet, profitProvider };
  }

  describe('Deployment', () => {
    it('Should deploy', async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await usdc.balanceOf(deployer.address)).to.equal(toUsdc('1000000'));
      expect(await usdc.balanceOf(wallet.address)).to.equal(toUsdc('1000000'));
    });
  });

  describe('Invest', () => {
    [
      { amount: 1, invested: 1, fee: 0 },
      { amount: 15 * 10 ** 6, invested: 135 * 10 ** 5, fee: 15 * 10 ** 5 }
    ].forEach((data) => {
      it(`Should invest ${data.amount} USDC if allowance is sufficient`, async () => {
        const { investmentFund, usdc, investmentNft } = await loadFixture(deployFixture);

        const initialBalance = await usdc.balanceOf(wallet.address);

        await usdc.connect(wallet).approve(investmentFund.address, data.amount);
        const tx: ContractTransaction = await investmentFund.connect(wallet).invest(data.amount);

        const logsMinted: Log[] = await getLogs(tx, investmentNft.address, mintedEventTopic);
        expect(logsMinted).to.have.length(1);

        const tokenId: BigNumber = investmentNft.interface.parseLog(logsMinted[0]).args.tokenId;

        expect(await usdc.balanceOf(wallet.address)).to.equal(initialBalance.sub(data.amount));
        expect(await usdc.balanceOf(treasuryWallet.address)).to.equal(data.fee);
        expect(await usdc.balanceOf(investmentFund.address)).to.equal(data.invested);
        expect(await investmentNft.tokenValue(tokenId)).to.equal(data.amount);
        expect(await investmentFund.totalInvestment()).to.equal(data.amount);
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

  describe('Provide profit', () => {
    it('Should provide profit for multiple investors', async () => {
      const { investmentFund, usdc, deployer, wallet, profitProvider } = await loadFixture(deployFixture);

      await usdc.mint(profitProvider.address, toUsdc('1000'));

      await usdc.connect(deployer).approve(investmentFund.address, toUsdc('10'));
      await investmentFund.connect(deployer).invest(toUsdc('10'));
      await usdc.connect(wallet).approve(investmentFund.address, toUsdc('20'));
      await investmentFund.connect(wallet).invest(toUsdc('20'));
      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();

      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('3'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('3'));

      expect(await investmentFund.totalIncome()).to.equal(toUsdc('3'));
      expect(await investmentFund.getPayoutsCount()).to.equal(1);
      const payout = await investmentFund.payouts(0);
      expect(payout.value).to.equal(toUsdc('3'));
      expect(payout.fee).to.equal(toUsdc('0'));
      expect(payout.blockNumber).to.equal(await ethers.provider.getBlockNumber());
      expect(payout.inProfit).to.equal(false);
    });

    it('Should provide profit for multiple investors after breakeven', async () => {
      const { investmentFund, usdc, deployer, wallet, profitProvider } = await loadFixture(deployFixture);

      await usdc.mint(profitProvider.address, toUsdc('1000'));

      await usdc.connect(deployer).approve(investmentFund.address, toUsdc('10'));
      await investmentFund.connect(deployer).invest(toUsdc('10'));
      await usdc.connect(wallet).approve(investmentFund.address, toUsdc('20'));
      await investmentFund.connect(wallet).invest(toUsdc('20'));
      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();

      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('120'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('30')); // breakeven reached

      expect(await investmentFund.totalIncome()).to.equal(toUsdc('30'));
      expect(await investmentFund.getPayoutsCount()).to.equal(1);

      const payout0 = await investmentFund.payouts(0);
      expect(payout0.value).to.equal(toUsdc('30'));
      expect(payout0.fee).to.equal(toUsdc('0'));
      expect(payout0.blockNumber).to.equal(await ethers.provider.getBlockNumber());
      expect(payout0.inProfit).to.equal(false);

      await investmentFund.connect(profitProvider).provideProfit(toUsdc('90')); // provide profit above breakeven

      expect(await investmentFund.totalIncome()).to.equal(toUsdc('120'));
      expect(await investmentFund.getPayoutsCount()).to.equal(2);

      const payout1 = await investmentFund.payouts(1);
      expect(payout1.value).to.equal(toUsdc('90'));
      expect(payout1.fee).to.equal(toUsdc('45'));
      expect(payout1.blockNumber).to.equal(await ethers.provider.getBlockNumber());
      expect(payout1.inProfit).to.equal(true);
    });
  });

  describe('Withdraw', () => {
    const deployerInvestment = toUsdc('10');
    const walletInvestment = toUsdc('20');
    let deployerTokenId: BigNumber;
    let walletTokenId: BigNumber;

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet, treasuryWallet, profitProvider } = await loadFixture(
        deployFixture
      ));

      await usdc.mint(profitProvider.address, toUsdc('1000'));

      await usdc.connect(deployer).approve(investmentFund.address, deployerInvestment);
      let tx: ContractTransaction = await investmentFund.connect(deployer).invest(deployerInvestment);

      let logsMinted: Log[] = await getLogs(tx, investmentNft.address, mintedEventTopic);
      deployerTokenId = investmentNft.interface.parseLog(logsMinted[0]).args.tokenId;

      await usdc.connect(wallet).approve(investmentFund.address, walletInvestment);
      tx = await investmentFund.connect(wallet).invest(walletInvestment);

      logsMinted = await getLogs(tx, investmentNft.address, mintedEventTopic);
      walletTokenId = investmentNft.interface.parseLog(logsMinted[0]).args.tokenId;

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();
    });

    it('Should withdraw profit', async () => {
      const treasuryBalance = await usdc.balanceOf(treasuryWallet.address);

      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('3'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('3'));
      expect(await usdc.balanceOf(treasuryWallet.address)).to.equal(treasuryBalance);

      const walletBalance = await usdc.balanceOf(wallet.address);
      const investmentFundBalance = await usdc.balanceOf(investmentFund.address);

      await investmentFund.connect(wallet).withdraw(toUsdc('1'));
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(toUsdc('1')));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(toUsdc('1')));

      await investmentFund.connect(wallet).withdraw(toUsdc('1'));
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(toUsdc('2')));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(toUsdc('2')));
    });

    it('Should withdraw profit if breakeven reached', async () => {
      const treasuryBalance = await usdc.balanceOf(treasuryWallet.address);

      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('90'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('90'));

      expect(await usdc.balanceOf(treasuryWallet.address)).to.equal(treasuryBalance.add(toUsdc('30')));

      const investmentFundBalance = await usdc.balanceOf(investmentFund.address);
      const walletBalance = await usdc.balanceOf(wallet.address);

      await investmentFund.connect(wallet).withdraw(toUsdc('30'));
      const actualFundWithdrawal1 = toUsdc('25'); // 20 USDC below breakeven + 5 USDC above breakeven (5 USDC taken previously as carry fee excluded)
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(actualFundWithdrawal1));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(actualFundWithdrawal1));

      await investmentFund.connect(wallet).withdraw(toUsdc('30'));
      const actualFundWithdrawal2 = toUsdc('15'); // 15 USDC above breakeven (15 USDC taken previously as carry fee excluded)
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(
        investmentFundBalance.sub(actualFundWithdrawal1).sub(actualFundWithdrawal2)
      );
      expect(await usdc.balanceOf(wallet.address)).to.equal(
        walletBalance.add(actualFundWithdrawal1).add(actualFundWithdrawal2)
      );
    });

    it('Should withdraw profit if nft owner changed', async () => {
      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('9'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('6'));

      let investmentFundBalance = await usdc.balanceOf(investmentFund.address);
      const walletBalance = await usdc.balanceOf(wallet.address);
      const deployerBalance = await usdc.balanceOf(deployer.address);

      // wallet can withdraw part of his profit (1 out of 4 USDC)
      await investmentFund.connect(wallet).withdraw(toUsdc('1'));
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(toUsdc('1')));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(toUsdc('1')));

      await investmentNft.connect(wallet).transferFrom(wallet.address, deployer.address, walletTokenId);
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('3'));

      investmentFundBalance = await usdc.balanceOf(investmentFund.address);

      // wallet withdraws the rest of his profit (3 out of 3 USDC from 1st payout)
      await investmentFund.connect(wallet).withdraw(toUsdc('3'));
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(toUsdc('3')));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(toUsdc('4')));

      // wallet cannot withdraw profit from 2nd payout since he did not have any NFTs then
      await expect(investmentFund.connect(wallet).withdraw(toUsdc('1'))).to.be.revertedWith(
        'Withdrawal amount exceeds available funds'
      );

      // deployer withdraws all of his profit (2 USDC from 1st payout and 3 USDC from 2nd payout)
      await investmentFund.connect(deployer).withdraw(toUsdc('5'));
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(toUsdc('8')));
      expect(await usdc.balanceOf(deployer.address)).to.equal(deployerBalance.add(toUsdc('5')));

      await expect(investmentFund.connect(deployer).withdraw(toUsdc('1'))).to.be.revertedWith(
        'Withdrawal amount exceeds available funds'
      );
    });

    it('Should withdraw profit if hundred payouts provided', async () => {
      const numberOfPayouts: number = 100;
      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('0.000003').mul(numberOfPayouts));
      for (let i = 0; i < numberOfPayouts; i++) {
        await investmentFund.connect(profitProvider).provideProfit(toUsdc('0.000003'));
      }

      expect(await investmentFund.getPayoutsCount()).to.equal(numberOfPayouts);

      const expectedDeployerProfit = toUsdc('0.000001').mul(numberOfPayouts);
      const expectedWalletProfit = toUsdc('0.000002').mul(numberOfPayouts);
      expect(await investmentFund.getAvailableFunds(deployer.address)).to.equal(expectedDeployerProfit);
      expect(await investmentFund.getAvailableFunds(wallet.address)).to.equal(expectedWalletProfit);

      const investmentFundBalance = await usdc.balanceOf(investmentFund.address);
      const walletBalance = await usdc.balanceOf(wallet.address);
      const treasuryBalance = await usdc.balanceOf(treasuryWallet.address);

      await investmentFund.connect(wallet).withdraw(expectedWalletProfit);
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(expectedWalletProfit));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(expectedWalletProfit));
      expect(await usdc.balanceOf(treasuryWallet.address)).to.equal(treasuryBalance);
    });

    it('Should retrieve available profit for account', async () => {
      const profit = toUsdc('6');
      await usdc.connect(profitProvider).approve(investmentFund.address, profit);
      await investmentFund.connect(profitProvider).provideProfit(profit);

      expect(await investmentFund.getAvailableFunds(deployer.address)).to.equal(profit.mul(1).div(3));
      expect(await investmentFund.getAvailableFunds(wallet.address)).to.equal(profit.mul(2).div(3));
    });

    [1, 10].forEach((numberOfPayouts: number) => {
      it('Should retrieve zero profit if it is too low to be divided', async () => {
        await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('0.000001').mul(numberOfPayouts));
        for (let i = 0; i < numberOfPayouts; i++) {
          await investmentFund.connect(profitProvider).provideProfit(toUsdc('0.000001'));
        }
        expect(await investmentFund.getPayoutsCount()).to.equal(numberOfPayouts);
        expect(await investmentFund.getAvailableFunds(wallet.address)).to.equal(0);
      });
    });

    it('Should retrieve user profit and carry fee for withdrawal', async () => {
      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('90'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('90'));

      expect(await investmentFund.getWithdrawalCarryFee(wallet.address, toUsdc('20'))).to.equal(toUsdc('0'));
      expect(await investmentFund.getWithdrawalCarryFee(wallet.address, toUsdc('30'))).to.equal(toUsdc('5'));
    });

    it('Should retrieve user max profit and carry fee for withdrawal if amount exceeds total income', async () => {
      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('90'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('90'));

      await expect(investmentFund.getWithdrawalCarryFee(wallet.address, toUsdc('60').add(1))).to.be.revertedWith(
        'Withdrawal amount exceeds available funds'
      );
    });
  });
});
