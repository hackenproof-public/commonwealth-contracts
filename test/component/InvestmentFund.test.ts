import { FakeContract, smock } from '@defi-wonderland/smock';
import { Log } from '@ethersproject/providers';
import { loadFixture, SnapshotRestorer, takeSnapshot, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy, deployProxy } from '../../scripts/utils';
import {
  InvestmentFund,
  InvestmentNFT,
  IProject__factory,
  PeriodicVesting,
  Project,
  QuoterMock,
  StakingWlth,
  UniswapQuoter,
  UniswapSwapper,
  USDC,
  Wlth
} from '../../typechain-types';
import { getInterfaceId, getLogs, toUsdc } from '../utils';

describe.skip('Investment Fund component tests', () => {
  const SECONDS_IN_YEAR = 31536000;
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;
  const managementFee = 1000;
  const defaultFee = 200;
  const defaultInvestmentCap = toUsdc('1000000');
  const tokenUri = 'ipfs://token-uri';
  const mintedEventTopic = ethers.utils.id('Transfer(address,address,uint256)');
  const defaultTreasury = ethers.Wallet.createRandom().address;
  const defaultCommunityFund = ethers.Wallet.createRandom().address;
  const defaultLpPool = ethers.Wallet.createRandom().address;
  const defaultBurn = ethers.Wallet.createRandom().address;
  const defaultGenesisNftRevenue = ethers.Wallet.createRandom().address;
  const unlocker = ethers.Wallet.createRandom();
  const maxStakingDiscount = 4000;
  const FeeDistributionAddresses = {
    treasuryWallet: defaultTreasury,
    lpPool: defaultLpPool,
    burn: defaultBurn,
    communityFund: defaultCommunityFund,
    genesisNftRevenue: defaultGenesisNftRevenue
  };

  let investmentFund: InvestmentFund;
  let usdc: USDC;
  let investmentNft: InvestmentNFT;
  let project: Project;
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let wallet: SignerWithAddress;
  let genesisNftRevenue: SignerWithAddress;
  let lpPool: SignerWithAddress;
  let burnAddr: SignerWithAddress;
  let profitProvider: SignerWithAddress;
  let restorer: SnapshotRestorer;
  let communityFund: SignerWithAddress;

  async function deployFixture() {
    [deployer, owner, wallet, profitProvider, genesisNftRevenue, lpPool, burnAddr, communityFund] =
      await ethers.getSigners();

    const treasury = defaultTreasury;
    const usdc: USDC = await deploy('USDC', [], deployer);
    const investmentNft: InvestmentNFT = await deployProxy('InvestmentNFT', ['INFT', 'CWI', owner.address], deployer);
    const wlth: Wlth = await deployProxy('Wlth', ['Common Wealth Token', 'WLTH', owner.address], deployer);
    const extQuoter: FakeContract<QuoterMock> = await smock.fake('QuoterMock');
    const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
    const quoter: UniswapQuoter = await deployProxy('UniswapQuoter', [extQuoter.address, 3000], deployer);
    const defaultProjectName = 'Project 1';
    const fundsAllocation = toUsdc('1000');
    const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');
    const IProjectId = ethers.utils.arrayify(getInterfaceId(IProject__factory.createInterface()));
    const staking: StakingWlth = await deployProxy(
      'StakingWlth',
      [
        owner.address,
        wlth.address,
        usdc.address,
        quoter.address,
        defaultFee,
        communityFund.address,
        maxStakingDiscount,
        [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
        [5000, 3750, 3125, 2500]
      ],
      deployer
    );
    const investmentFund: InvestmentFund = await deployProxy(
      'InvestmentFund',
      [
        owner.address,
        unlocker.address,
        'Investment Fund',
        usdc.address,
        investmentNft.address,
        staking.address,
        FeeDistributionAddresses,
        managementFee,
        defaultInvestmentCap
      ],
      deployer
    );

    const project: Project = await deployProxy(
      'Project',
      [defaultProjectName, owner.address, usdc.address, swapper.address, investmentFund.address, fundsAllocation],
      deployer
    );

    await project.connect(owner).setVesting(vesting.address);
    // await investmentFund.connect(owner).addProject(project.address);
    // profitProvider = await ethers.getSigner(project.address);

    await investmentNft.connect(owner).addMinter(investmentFund.address);
    await staking.connect(owner).registerFund(investmentFund.address);

    await usdc.mint(deployer.address, toUsdc('1000000'));
    await usdc.mint(wallet.address, toUsdc('1000000'));
    await usdc.mint(profitProvider.address, toUsdc('1000'));
    await wlth.connect(deployer).transfer(wallet.address, toUsdc('1000000'));

    return {
      investmentFund,
      usdc,
      investmentNft,
      staking,
      extQuoter,
      swapper,
      wlth,
      deployer,
      owner,
      wallet,
      treasury,
      project,
      vesting,
      profitProvider
    };
  }

  describe('Deployment', () => {
    it('Should deploy', async () => {
      const { investmentFund, usdc, project } = await loadFixture(deployFixture);

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await usdc.balanceOf(deployer.address)).to.equal(toUsdc('1000000'));
      expect(await usdc.balanceOf(wallet.address)).to.equal(toUsdc('1000000'));
      expect(await usdc.balanceOf(profitProvider.address)).to.equal(toUsdc('1000'));
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
        const tx = await investmentFund.connect(wallet).invest(data.amount, tokenUri);

        const logsMinted = await getLogs(tx, investmentNft.address, mintedEventTopic);
        expect(logsMinted).to.have.length(1);

        const tokenId = investmentNft.interface.parseLog(logsMinted[0]).args.tokenId as BigNumber;

        expect(await usdc.balanceOf(wallet.address)).to.equal(initialBalance.sub(data.amount));
        expect(await usdc.balanceOf(defaultTreasury)).to.equal(data.fee);
        expect(await usdc.balanceOf(investmentFund.address)).to.equal(data.invested);
        expect(await investmentNft.tokenValue(tokenId)).to.equal(data.amount);
        expect(await investmentNft.getTotalInvestmentValue()).to.equal(data.amount);
      });
    });

    it('Should return correct discount if add investment after stake in CRP', async () => {
      const { investmentFund, usdc, wlth, investmentNft, staking, extQuoter, wallet } = await loadFixture(
        deployFixture
      );
      const stake = { amount: parseUnits('500', 6), period: ONE_YEAR };
      extQuoter.quoteExactInputSingle.returns([stake.amount, 0, 0, 0]);

      await usdc.connect(wallet).approve(investmentFund.address, toUsdc('2000'));
      await wlth.connect(wallet).approve(staking.address, stake.amount);

      await investmentFund.connect(wallet).invest(toUsdc('1000'), tokenUri);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(toUsdc('1000'));

      const stakeTime = (await time.latest()) + 100;
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(wallet).stake(investmentFund.address, stake.amount, stake.period);
      expect(
        await staking.getDiscountInTimestamp(wallet.address, investmentFund.address, stakeTime + stake.period)
      ).to.equal(4000);

      await investmentFund.connect(wallet).invest(toUsdc('1000'), tokenUri);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(toUsdc('2000'));
      expect(
        await staking.getDiscountInTimestamp(wallet.address, investmentFund.address, stakeTime + stake.period)
      ).to.equal(2000);
    });

    it('Should revert investing if allowance is insufficient', async () => {
      const { investmentFund, usdc } = await loadFixture(deployFixture);

      await usdc.connect(wallet).approve(investmentFund.address, 15 * 10 ** 6 - 1);
      await expect(investmentFund.connect(wallet).invest(15 * 10 ** 6, tokenUri)).to.be.revertedWith(
        'ERC20: insufficient allowance'
      );
    });
  });

  describe('Provide profit', () => {
    it('Should provide profit with no carry fee for multiple investors if not in breakeven', async () => {
      const { investmentFund, usdc, deployer, wallet, treasury, project, owner, swapper, vesting } = await loadFixture(
        deployFixture
      );

      await investmentFund.connect(owner).addProject(project.address);
      await usdc.connect(deployer).approve(investmentFund.address, toUsdc('10'));
      await investmentFund.connect(deployer).invest(toUsdc('10'), tokenUri);
      await usdc.connect(wallet).approve(investmentFund.address, toUsdc('20'));
      await investmentFund.connect(wallet).invest(toUsdc('20'), tokenUri);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      const fundBalanceBeforeProfit = await usdc.balanceOf(investmentFund.address);
      const treasuryBalanceBeforeProfit = await usdc.balanceOf(treasury);
      const profit = toUsdc('3');
      await vesting.getVestedToken.returns(usdc.address);
      await usdc.mint(project.address, toUsdc('10'));
      await swapper.swap.returns(profit);
      await project.connect(owner).sellVestedToInvestmentFund(profit);

      expect(await usdc.balanceOf(investmentFund.address)).to.equal(fundBalanceBeforeProfit.add(profit));
      expect(await usdc.balanceOf(treasury)).to.equal(treasuryBalanceBeforeProfit);
    });

    it('Should provide profit with carry fee for multiple investors after breakeven', async () => {
      const { investmentFund, usdc, deployer, wallet, project, treasury, owner, swapper, vesting } = await loadFixture(
        deployFixture
      );

      await investmentFund.connect(owner).addProject(project.address);
      await usdc.connect(deployer).approve(investmentFund.address, toUsdc('10'));
      await investmentFund.connect(deployer).invest(toUsdc('10'), tokenUri);
      await usdc.connect(wallet).approve(investmentFund.address, toUsdc('20'));
      await investmentFund.connect(wallet).invest(toUsdc('20'), tokenUri);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      await usdc.connect(deployer).approve(investmentFund.address, toUsdc('120'));

      const profit0 = toUsdc('30');
      const profit1 = toUsdc('90');
      const fundBalanceBeforeProfit = await usdc.balanceOf(investmentFund.address);
      const treasuryBalanceBeforeProfit = await usdc.balanceOf(treasury);
      const expectedFundBalanceAfterProfit0 = fundBalanceBeforeProfit.add(profit0);
      const expectedCarryFee = toUsdc('36');
      const carryFeeTreasuryShare = toUsdc('24.48'); // 36*0.68 = 30.6

      await vesting.getVestedToken.returns(usdc.address);
      await usdc.mint(project.address, profit0);
      await swapper.swap.returns(profit0);
      await project.connect(owner).sellVestedToInvestmentFund(profit0); // breakeven reached

      expect(await usdc.balanceOf(investmentFund.address)).to.equal(expectedFundBalanceAfterProfit0);
      expect(await usdc.balanceOf(treasury)).to.equal(treasuryBalanceBeforeProfit);

      await usdc.mint(project.address, profit1);
      await swapper.swap.returns(profit1);
      await project.connect(owner).sellVestedToInvestmentFund(profit1); // provide profit above breakeven

      expect(await usdc.balanceOf(investmentFund.address)).to.equal(
        expectedFundBalanceAfterProfit0.add(profit1).sub(expectedCarryFee)
      );
      expect(await usdc.balanceOf(treasury)).to.equal(treasuryBalanceBeforeProfit.add(carryFeeTreasuryShare));
    });

    [
      { elapsed: 1, fee: toUsdc('40'), treasuryShare: toUsdc('27.2') },
      { elapsed: SECONDS_IN_YEAR / 2, fee: toUsdc('20'), treasuryShare: toUsdc('13.6') },
      { elapsed: SECONDS_IN_YEAR, fee: toUsdc('10'), treasuryShare: toUsdc('6.8') }
    ].forEach((data) => {
      it('Should provide profit with decreased carry fee if user staked for discount', async () => {
        const { investmentFund, usdc, staking, extQuoter, wlth, deployer, project, treasury, owner, vesting, swapper } =
          await loadFixture(deployFixture);
        await investmentFund.connect(owner).addProject(project.address);
        await usdc.connect(deployer).approve(investmentFund.address, toUsdc('20'));
        await investmentFund.connect(deployer).invest(toUsdc('20'), tokenUri);
        await investmentFund.connect(owner).stopCollectingFunds();
        await usdc.mint(investmentFund.address, toUsdc('1000'));
        await investmentFund.connect(owner).deployFunds();

        const stake = { amount: parseUnits('10', 6), period: ONE_YEAR };
        extQuoter.quoteExactInputSingle.returns([stake.amount, 0, 0, 0]);
        await wlth.connect(deployer).approve(staking.address, stake.amount);
        await usdc.connect(deployer).approve(investmentFund.address, toUsdc('120'));

        const stakeTime = (await time.latest()) + 100;
        await time.setNextBlockTimestamp(stakeTime);
        await staking.connect(deployer).stake(investmentFund.address, stake.amount, stake.period);

        const profit = toUsdc('120');
        const fundBalanceBeforeProfit = await usdc.balanceOf(investmentFund.address);
        const treasuryBalanceBeforeProfit = await usdc.balanceOf(treasury);

        await time.setNextBlockTimestamp(stakeTime + data.elapsed);
        await vesting.getVestedToken.returns(usdc.address);
        await usdc.mint(project.address, profit);
        await swapper.swap.returns(profit);
        await project.connect(owner).sellVestedToInvestmentFund(profit); // breakeven reached

        expect(await usdc.balanceOf(investmentFund.address)).to.equal(
          fundBalanceBeforeProfit.add(profit).sub(data.fee)
        );
        expect(await usdc.balanceOf(treasury)).to.equal(treasuryBalanceBeforeProfit.add(data.treasuryShare));
      });
    });
  });

  describe('Withdraw', () => {
    const deployerInvestment = toUsdc('10');
    const walletInvestment = toUsdc('20');
    let deployerTokenId: BigNumber;
    let walletTokenId: BigNumber;

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet, project, profitProvider } = await loadFixture(
        deployFixture
      ));

      await investmentFund.connect(owner).addProject(profitProvider.address);
      await usdc.connect(deployer).approve(investmentFund.address, deployerInvestment);
      let tx: ContractTransaction = await investmentFund.connect(deployer).invest(deployerInvestment, tokenUri);

      let logsMinted: Log[] = await getLogs(tx, investmentNft.address, mintedEventTopic);
      deployerTokenId = investmentNft.interface.parseLog(logsMinted[0]).args.tokenId;

      await usdc.connect(wallet).approve(investmentFund.address, walletInvestment);
      tx = await investmentFund.connect(wallet).invest(walletInvestment, tokenUri);

      logsMinted = await getLogs(tx, investmentNft.address, mintedEventTopic);
      walletTokenId = investmentNft.interface.parseLog(logsMinted[0]).args.tokenId;

      await investmentFund.connect(owner).stopCollectingFunds();
      await usdc.mint(investmentFund.address, toUsdc('1000'));
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();
    });

    it('Should withdraw profit', async () => {
      const treasuryBalance = await usdc.balanceOf(defaultTreasury);
      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('3'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('3'));
      expect(await usdc.balanceOf(defaultTreasury)).to.equal(treasuryBalance);

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
      const treasuryBalance = await usdc.balanceOf(defaultTreasury);

      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('90'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('90'));

      /*
        calculation: Profit 90, where 30 is before breakeven and 60 is after
        60 after breakeven means 24 total carry fee
      */

      expect(await usdc.balanceOf(defaultTreasury)).to.equal(treasuryBalance.add(toUsdc('16.32'))); // 24*0.68
      const investmentFundBalance = await usdc.balanceOf(investmentFund.address);
      const walletBalance = await usdc.balanceOf(wallet.address);

      await investmentFund.connect(wallet).withdraw(toUsdc('30'));
      const actualFundWithdrawal1 = toUsdc('26'); // 20 USDC below breakeven + 6 USDC above breakeven (4 USDC taken previously as carry fee excluded)
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(actualFundWithdrawal1));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(actualFundWithdrawal1));

      await investmentFund.connect(wallet).withdraw(toUsdc('30'));
      const actualFundWithdrawal2 = toUsdc('18'); // 18 USDC above breakeven (12 USDC taken previously as carry fee excluded)
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
      const treasuryBalance = await usdc.balanceOf(defaultTreasury);

      await investmentFund.connect(wallet).withdraw(expectedWalletProfit);
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.sub(expectedWalletProfit));
      expect(await usdc.balanceOf(wallet.address)).to.equal(walletBalance.add(expectedWalletProfit));
      expect(await usdc.balanceOf(defaultTreasury)).to.equal(treasuryBalance);
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
      expect(await investmentFund.getWithdrawalCarryFee(wallet.address, toUsdc('30'))).to.equal(toUsdc('4')); // 1% tx fee deducted
    });

    it('Should retrieve user max profit and carry fee for withdrawal if amount exceeds total income', async () => {
      await usdc.connect(profitProvider).approve(investmentFund.address, toUsdc('90'));
      await investmentFund.connect(profitProvider).provideProfit(toUsdc('90'));

      await expect(investmentFund.getWithdrawalCarryFee(wallet.address, toUsdc('60').add(1))).to.be.revertedWith(
        'Withdrawal amount exceeds available funds'
      );
    });
  });

  describe('Project management', () => {
    it('Should add project to the investment fund', async () => {
      const { investmentFund, project, owner } = await loadFixture(deployFixture);

      await investmentFund.connect(owner).addProject(project.address);
      expect(await investmentFund.connect(owner).getProjectsCount()).to.equal(1);
    });
    it('Should remove project from the investment fund', async () => {
      const { investmentFund, project, owner } = await loadFixture(deployFixture);

      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).removeProject(project.address);
      expect(await investmentFund.connect(owner).getProjectsCount()).to.equal(0);
    });
    it('Should deploy funds to the project', async () => {
      const { investmentFund, usdc, project, owner } = await loadFixture(deployFixture);

      await investmentFund.connect(owner).addProject(project.address);
      await usdc.connect(wallet).approve(investmentFund.address, toUsdc('20'));
      await investmentFund.connect(wallet).invest(toUsdc('20'), tokenUri);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFundsToProject(project.address, toUsdc('10'));

      expect(await usdc.balanceOf(project.address)).to.equal(toUsdc('10'));
    });
  });
});
