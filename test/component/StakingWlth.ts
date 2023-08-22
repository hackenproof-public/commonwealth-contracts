import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import chai from 'chai';
import { ethers } from 'hardhat';
import { deploy, deployProxy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, StakingWlth, UniswapQuoter } from '../../typechain-types';
import { getTokenIdFromTx, toUsdc } from '../utils';

chai.use(smock.matchers);
const { expect } = chai;

describe('Common Wealth Staking component tests', () => {
  const SECONDS_IN_YEAR = 31536000;
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;
  const managementFee = 1000;
  const defaultFee = 200;
  const defaultInvestmentCap = toUsdc('1000000');
  const maxDiscount = 4000; // in basis points
  const defaultTreasury = ethers.Wallet.createRandom().address;
  const tokenUri = 'ipfs://token-uri';

  const deployStaking = async () => {
    const [deployer, owner, user] = await ethers.getSigners();

    const treasury = defaultTreasury;
    const wlth = await deployProxy('Wlth', ['Common Wealth Token', 'WLTH', owner.address], deployer);
    const usdc = await deploy('USDC', [], deployer);
    const quoter: FakeContract<UniswapQuoter> = await smock.fake('UniswapQuoter');
    const staking: StakingWlth = await deployProxy(
      'StakingWlth',
      [
        owner.address,
        wlth.address,
        usdc.address,
        quoter.address,
        defaultFee,
        defaultTreasury,
        maxDiscount,
        [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
        [5000, 3750, 3125, 2500]
      ],
      deployer
    );
    const nft: InvestmentNFT = await deployProxy('InvestmentNFT', ['INFT', 'CWI', owner.address], deployer);
    const fund: InvestmentFund = await deployProxy(
      'InvestmentFund',
      [
        owner.address,
        'Investment Fund',
        usdc.address,
        nft.address,
        staking.address,
        treasury,
        managementFee,
        defaultInvestmentCap
      ],
      deployer
    );
    await nft.connect(owner).addMinter(fund.address);
    await staking.connect(owner).registerFund(fund.address);

    await usdc.mint(deployer.address, toUsdc('1000000'));
    await usdc.mint(owner.address, toUsdc('1000000'));
    await usdc.mint(user.address, toUsdc('1000000'));
    await wlth.connect(deployer).transfer(user.address, toUsdc('1000000'));

    return { staking, wlth, usdc, fund, nft, quoter, deployer, owner, user };
  };

  const setup = async () => {
    const { staking, wlth, usdc, fund, nft, quoter, deployer, owner, user } = await loadFixture(deployStaking);

    quoter.quote.reset();

    return { staking, wlth, usdc, quoter, fund, nft, deployer, owner, user };
  };

  describe('#getDiscountInTimestamp()', () => {
    it('Should keep discount after splitting investment NFT', async () => {
      const { staking, wlth, usdc, quoter, fund, nft, owner, user } = await setup();
      const investment = 1200;
      const stake = { amount: 600, period: ONE_YEAR };

      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await usdc.connect(user).approve(fund.address, investment);
      await fund.connect(user).invest(investment, tokenUri);
      await fund.connect(owner).stopCollectingFunds();
      await fund.connect(owner).deployFunds();

      const stakeTime = (await time.latest()) + 100;
      await wlth.connect(user).approve(staking.address, stake.amount);
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const timestampAfterHalfYear = stakeTime + ONE_YEAR / 2;
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(2000);

      await nft.connect(user).split(0, [600, 600], ['ipfs://token-1', 'ipfs://token-2']);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(2000);
    });

    it('Should decrease discount if made new investment after stake in CRP', async () => {
      const { staking, wlth, usdc, quoter, fund, user } = await setup();
      const investment1 = 1200;
      const stake = { amount: 600, period: ONE_YEAR };

      quoter.quote.returns([stake.amount, 0, 0, 0]);

      // CRP
      await usdc.connect(user).approve(fund.address, investment1);
      await fund.connect(user).invest(investment1, tokenUri);

      const stakeTime = (await time.latest()) + 100;
      await wlth.connect(user).approve(staking.address, stake.amount);
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const timestampAfterHalfYear = stakeTime + ONE_YEAR / 2;
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(4000);

      const investment2 = 600;
      await usdc.connect(user).approve(fund.address, investment2);
      await fund.connect(user).invest(investment2, tokenUri);

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(2666);
    });

    it('Should decrease discount after buying investment NFT in CDP', async () => {
      const { staking, wlth, usdc, quoter, fund, nft, owner, user } = await setup();
      const userInvestment = 1200;
      const ownerInvestment = 600;
      const stake = { amount: 600, period: ONE_YEAR };

      quoter.quote.returns([stake.amount, 0, 0, 0]);

      // CRP
      await usdc.connect(user).approve(fund.address, userInvestment);
      await fund.connect(user).invest(userInvestment, tokenUri);
      await usdc.connect(owner).approve(fund.address, ownerInvestment);
      const tx = await fund.connect(owner).invest(ownerInvestment, tokenUri);
      const ownerTokenId = await getTokenIdFromTx(tx, nft.address);

      await fund.connect(owner).stopCollectingFunds();
      await fund.connect(owner).deployFunds();

      // CDP
      const stakeTime = (await time.latest()) + 100;
      await wlth.connect(user).approve(staking.address, stake.amount);
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const timestampAfterHalfYear = stakeTime + ONE_YEAR / 2;
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(2000);

      await nft.connect(owner).transferFrom(owner.address, user.address, ownerTokenId);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(1333);
    });

    it('Should increase discount up to max value after selling investment NFT in CDP', async () => {
      const { staking, wlth, usdc, quoter, fund, nft, owner, user } = await setup();
      const investment1 = 900;
      const investment2 = 300;
      const stake = { amount: 600, period: ONE_YEAR };

      quoter.quote.returns([stake.amount, 0, 0, 0]);

      // CRP
      await usdc.connect(user).approve(fund.address, investment1 + investment2);
      const tx1 = await fund.connect(user).invest(investment1, tokenUri);
      const tx2 = await fund.connect(user).invest(investment2, tokenUri);
      const userTokenId1 = await getTokenIdFromTx(tx1, nft.address);
      const userTokenId2 = await getTokenIdFromTx(tx2, nft.address);
      await fund.connect(owner).stopCollectingFunds();
      await fund.connect(owner).deployFunds();

      // CDP
      const stakeTime = (await time.latest()) + 100;
      await wlth.connect(user).approve(staking.address, stake.amount);
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const timestampAfterHalfYear = stakeTime + ONE_YEAR / 2;
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(2000);

      await nft.connect(user).transferFrom(user.address, owner.address, userTokenId2);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(2666);

      await nft.connect(user).transferFrom(user.address, owner.address, userTokenId1);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, timestampAfterHalfYear)).to.equal(4000);
    });
  });
});
