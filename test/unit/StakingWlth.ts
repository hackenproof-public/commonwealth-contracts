import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import chai from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, StakingWlth, UniswapQuoter, Wlth } from '../../typechain-types';
import { FundState } from '../types';
import { getLogs } from '../utils';

chai.use(smock.matchers);
const { expect } = chai;

describe('Common Wealth Staking unit tests', () => {
  const SECONDS_IN_YEAR = 31536000;
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;
  const defaultFee = 200;
  const maxDiscount = 4000; // in basis points
  const tokensStakedEventTopic = ethers.utils.id('TokensStaked(address,address,uint256,uint256)');
  const defaultTreasury = ethers.Wallet.createRandom().address;
  const usdc = ethers.Wallet.createRandom().address;

  const deployStaking = async () => {
    const [deployer, owner, user] = await ethers.getSigners();

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const quoter: FakeContract<UniswapQuoter> = await smock.fake('UniswapQuoter');
    const staking: StakingWlth = await deployProxy(
      'StakingWlth',
      [
        owner.address,
        wlth.address,
        usdc,
        quoter.address,
        defaultFee,
        defaultTreasury,
        maxDiscount,
        [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
        [5000, 3750, 3125, 2500]
      ],
      deployer
    );

    return { staking, wlth, usdc, quoter, deployer, owner, user };
  };

  const setup = async () => {
    const { staking, wlth, usdc, quoter, deployer, owner, user } = await loadFixture(deployStaking);

    const fund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
    const nft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');

    fund.currentState.reset();
    fund.investmentNft.reset();
    nft.getInvestmentValue.reset();
    wlth.transferFrom.reset();
    quoter.quote.reset();

    return { staking, wlth, usdc, quoter, fund, nft, deployer, owner, user };
  };

  describe('Deployment', () => {
    it('Should deploy with correct owner', async () => {
      const { staking, owner } = await loadFixture(deployStaking);

      expect(await staking.owner()).to.equal(owner.address);
    });

    it('Should revert deploying if owner is zero address', async () => {
      const [deployer] = await ethers.getSigners();

      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const quoter: FakeContract<UniswapQuoter> = await smock.fake('UniswapQuoter');
      await expect(
        deployProxy(
          'StakingWlth',
          [
            constants.AddressZero,
            wlth.address,
            usdc,
            quoter.address,
            defaultFee,
            defaultTreasury,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWith('Owner is zero address');
    });

    it('Should revert deploying if token is zero address', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const quoter: FakeContract<UniswapQuoter> = await smock.fake('UniswapQuoter');
      await expect(
        deployProxy(
          'StakingWlth',
          [
            owner.address,
            constants.AddressZero,
            usdc,
            quoter.address,
            defaultFee,
            defaultTreasury,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWith('Token is zero address');
    });

    it('Should revert deploying if treasury is zero address', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const quoter: FakeContract<UniswapQuoter> = await smock.fake('UniswapQuoter');
      await expect(
        deployProxy(
          'StakingWlth',
          [
            owner.address,
            wlth.address,
            usdc,
            quoter.address,
            defaultFee,
            constants.AddressZero,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWith('Treasury is zero address');
    });
  });

  describe('#registerFund()', () => {
    it('Should register fund if owner', async () => {
      const { staking, fund, owner } = await setup();

      await staking.connect(owner).registerFund(fund.address);
      expect(await staking.getRegisteredFunds()).to.deep.equal([fund.address]);
    });

    it('Should revert registering fund if not owner', async () => {
      const { staking, fund, user } = await setup();

      await expect(staking.connect(user).registerFund(fund.address)).to.be.reverted;
    });
  });

  describe('#unregisterFund()', () => {
    it('Should unregister fund if owner', async () => {
      const { staking, fund, owner } = await setup();

      await staking.connect(owner).registerFund(fund.address);
      await staking.connect(owner).unregisterFund(fund.address);

      expect(await staking.getRegisteredFunds()).to.deep.equal([]);
    });

    it('Should revert unregistering fund if not owner', async () => {
      const { staking, fund, owner, user } = await setup();

      await staking.connect(owner).registerFund(fund.address);
      await expect(staking.connect(user).unregisterFund(fund.address)).to.be.reverted;
    });
  });

  describe('#stake()', () => {
    it('Should emit event on stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      await expect(staking.connect(user).stake(fund.address, stake.amount, stake.period))
        .to.emit(staking, 'TokensStaked')
        .withArgs(user.address, fund.address, 0, stake.amount);

      expect(await staking.getStakingAccounts()).to.deep.equal([user.address]);
    });

    [
      { usdc: 1, discount: 8 },
      { usdc: 250, discount: 2000 },
      { usdc: 500, discount: 4000 }
    ].forEach((data) => {
      it('Should calculate proper discount for different USDC/WLTH price', async () => {
        const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
        const stake = { amount: 500, period: ONE_YEAR };

        fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
        fund.investmentNft.returns(nft.address);
        nft.getInvestmentValue.returns(1000);
        wlth.transferFrom.returns(true);
        quoter.quote.returns([data.usdc, 0, 0, 0]);

        await staking.connect(owner).registerFund(fund.address);
        const stakeTime = (await time.latest()) + 100;
        await time.setNextBlockTimestamp(stakeTime);
        await staking.connect(user).stake(fund.address, stake.amount, stake.period);

        expect(await staking.stakingDetails(0)).to.deep.equal([
          user.address,
          fund.address,
          stake.amount,
          data.usdc,
          [stakeTime, stakeTime + stake.period, data.discount, true]
        ]);
      });
    });

    it('Should revert staking if fund not registered', async () => {
      const { staking, wlth, quoter, fund, nft, user } = await setup();

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([500, 0, 0, 0]);

      await expect(staking.connect(user).stake(fund.address, 500, ONE_YEAR)).to.be.revertedWith(
        'Fund is not registered'
      );
    });

    it('Should revert staking if target discount is equal to zero', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([0, 0, 0, 0]); // gives zero discount

      await staking.connect(owner).registerFund(fund.address);
      await expect(staking.connect(user).stake(fund.address, 500, ONE_YEAR)).to.be.revertedWith(
        'Target discount is equal to zero'
      );
    });

    it('Should revert staking if target discount exceeds maximum value', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([5000, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      await expect(staking.connect(user).stake(fund.address, 5000, ONE_YEAR)).to.be.revertedWith(
        'Target discount exceeds maximum value'
      );
    });

    it('Should revert staking if total target discount exceeds maximum value', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [500, 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [100, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      await staking.connect(user).stake(fund.address, 500, ONE_YEAR);
      await expect(staking.connect(user).stake(fund.address, 100, ONE_YEAR)).to.be.revertedWith(
        'Target discount exceeds maximum value'
      );
    });
  });

  describe('#getDiscountInTimestamp()', () => {
    it('Should return correct discount if staked in CRP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const logsMinted = await getLogs(tx, staking.address, tokensStakedEventTopic);
      expect(logsMinted).to.have.length(1);

      const stakeId = staking.interface.parseLog(logsMinted[0]).args.stakeId as BigNumber;
      const start = (await staking.stakingDetails(stakeId)).discount.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start)).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(SECONDS_IN_YEAR / 2))).to.equal(
        4000
      );
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(SECONDS_IN_YEAR))).to.equal(
        4000
      );
    });

    it('Should return correct discount if staked in CDP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const logsMinted = await getLogs(tx, staking.address, tokensStakedEventTopic);
      expect(logsMinted).to.have.length(1);

      const stakeId = staking.interface.parseLog(logsMinted[0]).args.stakeId as BigNumber;
      const start = (await staking.stakingDetails(stakeId)).discount.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(SECONDS_IN_YEAR / 2))).to.equal(
        2000
      );
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(SECONDS_IN_YEAR))).to.equal(
        4000
      );
    });

    it('Should return correct discount if staked multiple times', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake1 = { amount: 100, period: FOUR_YEARS };
      const stake2 = { amount: 100, period: ONE_YEAR };

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [stake1.amount, 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [stake2.amount, 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + 2 * SECONDS_IN_YEAR;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1.amount, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + SECONDS_IN_YEAR)).to.equal(
        400
      );
      expect(
        await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + 2 * SECONDS_IN_YEAR)
      ).to.equal(800);
      expect(
        await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + 3 * SECONDS_IN_YEAR)
      ).to.equal(1200 + 800);
      expect(
        await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + 4 * SECONDS_IN_YEAR)
      ).to.equal(1600 + 800);
    });
  });

  describe('#getEstimatedDiscount()', () => {
    it('Should return correct discount estimation in CRP', async () => {
      const { staking, wlth, fund, nft, owner, user } = await setup();

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);

      await staking.connect(owner).registerFund(fund.address);
      const stakeTime = (await time.latest()) + 1000;

      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, stakeTime, ONE_YEAR, stakeTime)
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(
          user.address,
          fund.address,
          100,
          stakeTime,
          ONE_YEAR,
          stakeTime + SECONDS_IN_YEAR / 2
        )
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(
          user.address,
          fund.address,
          100,
          stakeTime,
          ONE_YEAR,
          stakeTime + SECONDS_IN_YEAR
        )
      ).to.equal(800);
    });

    it('Should return correct discount estimation in CDP', async () => {
      const { staking, wlth, fund, nft, owner, user } = await setup();

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);

      await staking.connect(owner).registerFund(fund.address);
      const stakeTime = (await time.latest()) + 1000;

      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, stakeTime, ONE_YEAR, stakeTime)
      ).to.equal(0);
      expect(
        await staking.getEstimatedDiscount(
          user.address,
          fund.address,
          100,
          stakeTime,
          ONE_YEAR,
          stakeTime + SECONDS_IN_YEAR / 2
        )
      ).to.equal(400);
      expect(
        await staking.getEstimatedDiscount(
          user.address,
          fund.address,
          100,
          stakeTime,
          ONE_YEAR,
          stakeTime + SECONDS_IN_YEAR
        )
      ).to.equal(800);
    });

    it('Should return correct discount estimation in CDP after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 100, period: ONE_YEAR };

      fund.currentState.returns(utils.formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);

      const stakeTime = (await time.latest()) + 1000;
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, stakeTime, ONE_YEAR, stakeTime)
      ).to.equal(0);
      expect(
        await staking.getEstimatedDiscount(
          user.address,
          fund.address,
          100,
          stakeTime,
          ONE_YEAR,
          stakeTime + SECONDS_IN_YEAR / 2
        )
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(
          user.address,
          fund.address,
          100,
          stakeTime,
          ONE_YEAR,
          stakeTime + SECONDS_IN_YEAR
        )
      ).to.equal(1600);
    });
  });
});
