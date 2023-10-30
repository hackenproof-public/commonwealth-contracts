import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, mine, SnapshotRestorer, takeSnapshot, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { BigNumber, constants } from 'ethers';
import { formatBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, StakingWlth, UniswapQuoter, Wlth } from '../../typechain-types';
import { DEFAULT_TRANSACTION_FEE } from '../constants';
import { FundState } from '../types';
import { getStakeIdFromTx, getStakeWithFee, toWlth } from '../utils';

chai.use(smock.matchers);
const { expect } = chai;

describe.skip('Staking WLTH unit tests', () => {
  const SECONDS_IN_YEAR = 31536000;
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;
  const defaultFee = DEFAULT_TRANSACTION_FEE;
  const maxDiscount = 4000; // percentage points in basis points
  const defaultTreasury = ethers.Wallet.createRandom().address;
  const defaultCommunityFund = ethers.Wallet.createRandom().address;
  const usdc = ethers.Wallet.createRandom().address;

  let staking: StakingWlth;
  let wlth: FakeContract<Wlth>;
  let quoter: FakeContract<UniswapQuoter>;
  let fund: FakeContract<InvestmentFund>;
  let nft: FakeContract<InvestmentNFT>;
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

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
        defaultCommunityFund,
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

  const initializeFakes = (investmentValueReturn: number, quoteReturn?: BigNumber) => {
    fund.currentState.reset();
    fund.investmentNft.reset();
    nft.getInvestmentValue.reset();
    wlth.transferFrom.reset();
    wlth.transfer.reset();
    quoter.quote.reset();

    fund.currentState.returns(formatBytes32String(FundState.FundsIn));
    fund.investmentNft.returns(nft.address);
    nft.getInvestmentValue.returns(investmentValueReturn);
    wlth.transferFrom.returns(true);
    wlth.transfer.returns(true);
    if (quoteReturn !== undefined) {
      quoter.quote.returns([quoteReturn, 0, 0, 0]);
    }
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
            defaultCommunityFund,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWith('Owner is zero address');
    });

    it('Should revert deploying if token is zero address', async () => {
      const [deployer, owner, communityFund] = await ethers.getSigners();

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
            defaultCommunityFund,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWith('Token is zero address');
    });

    it('Should revert deploying if treasury is zero address', async () => {
      const [deployer, owner, communityFund] = await ethers.getSigners();

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
            communityFund.address,
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
    let restorer: SnapshotRestorer;
    const investmentSize = 1200;

    before(async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      initializeFakes(investmentSize);
      await staking.connect(owner).registerFund(fund.address);

      restorer = await takeSnapshot();
    });

    afterEach(async () => {
      await restorer.restore();
      initializeFakes(investmentSize);
    });

    it('Should emit event on stake', async () => {
      const stake = { amount: 600, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await expect(staking.connect(user).stake(fund.address, stakeWithFee, stake.period))
        .to.emit(staking, 'TokensStaked')
        .withArgs(user.address, fund.address, 0, stake.amount);
    });

    it('Should create staking position', async () => {
      const stake = { amount: 600, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      const equivalentInUsdc = 300;

      quoter.quote.returns([equivalentInUsdc, 0, 0, 0]);

      const stakeTime = (await time.latest()) + 100;
      await time.setNextBlockTimestamp(stakeTime);
      const tx = await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);
      const stakeId = await getStakeIdFromTx(tx, staking.address);

      expect(await staking.getPositionDetails(0)).to.deep.equal([
        stakeId,
        user.address,
        fund.address,
        stake.amount,
        equivalentInUsdc,
        investmentSize,
        [stakeTime, stake.duration],
        true,
        0
      ]);
    });

    it('Should revert staking if fund not registered', async () => {
      const stake = { amount: 600, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).unregisterFund(fund.address);
      await expect(staking.connect(user).stake(fund.address, stakeWithFee, stake.duration)).to.be.revertedWith(
        'Fund is not registered'
      );
    });

    it('Should revert staking if target discount is equal to zero', async () => {
      const stake = { amount: 600, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([0, 0, 0, 0]); // gives zero discount

      await expect(staking.connect(user).stake(fund.address, stakeWithFee, stake.duration)).to.be.revertedWith(
        'Target discount is equal to zero'
      );
    });

    it('Should revert staking if target discount exceeds maximum value', async () => {
      const stake = { amount: investmentSize / 2 + 1, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await expect(staking.connect(user).stake(fund.address, stakeWithFee, stake.duration)).to.be.revertedWith(
        'Target discount exceeds maximum value'
      );
    });

    it('Should revert staking if total target discount exceeds maximum value', async () => {
      const stake1 = { amount: 600, duration: ONE_YEAR };
      const stake1WithFee = getStakeWithFee(stake1.amount);
      const stake2 = { amount: 100, duration: ONE_YEAR };
      const stake2WithFee = getStakeWithFee(stake2.amount);
      quoter.quote.returnsAtCall(0, [stake1.amount, 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [stake2.amount, 0, 0, 0]);

      await staking.connect(user).stake(fund.address, stake1WithFee, stake1.duration);
      await expect(staking.connect(user).stake(fund.address, stake2WithFee, stake2.duration)).to.be.revertedWith(
        'Target discount exceeds maximum value'
      );
    });

    it('Should return staked tokens in fund', async () => {
      const fund2 = await smock.fake('InvestmentFund');
      const nft2 = await smock.fake('InvestmentNFT');
      const stake1 = { amount: 600, duration: ONE_YEAR };
      const stake1WithFee = getStakeWithFee(stake1.amount);
      const stake2 = { amount: 100, duration: ONE_YEAR };
      const stake2WithFee = getStakeWithFee(stake2.amount);

      fund2.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund2.investmentNft.returns(nft2.address);
      nft2.getInvestmentValue.returns(investmentSize);
      quoter.quote.returnsAtCall(0, [stake1.amount, 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [stake2.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund2.address);
      await staking.connect(user).stake(fund.address, stake1WithFee, stake1.duration);
      await staking.connect(user).stake(fund2.address, stake2WithFee, stake2.duration);

      expect(await staking.getStakingAccounts()).to.deep.equal([user.address]);
      expect(await staking.getStakedTokensInFund(user.address, fund.address)).to.equal(stake1.amount);
      expect(await staking.getStakedTokensInFund(user.address, fund2.address)).to.equal(stake2.amount);
      expect(await staking.getStakedTokens(user.address)).to.equal(stake1.amount + stake2.amount);
    });
  });

  describe('#unstake()', () => {
    let restorer: SnapshotRestorer;
    let stake1Id: number;
    let stake1Time: number;

    const investmentSize = 1200;
    const stake1 = { amount: toWlth('300'), period: ONE_YEAR };
    const stakeTxFee = stake1.amount.div(100);

    before(async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      initializeFakes(investmentSize, stake1.amount);

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp((await time.latest()) + 100);
      const tx = await staking.connect(user).stake(fund.address, stake1.amount, stake1.period);
      stake1Id = await getStakeIdFromTx(tx, staking.address);
      stake1Time = (await staking.getPositionDetails(stake1Id)).period.start.toNumber();

      restorer = await takeSnapshot();
    });

    afterEach(async () => {
      await restorer.restore();
      initializeFakes(investmentSize, stake1.amount);
    });

    it('Should emit event on unstake', async () => {
      await expect(staking.connect(user).unstake(fund.address, stake1.amount))
        .to.emit(staking, 'TokensUnstaked')
        .withArgs(user.address, fund.address, stake1.amount);
    });

    it('Should keep position if all tokens unstaked', async () => {
      expect(await staking.getStakingPositionsInFund(user.address, fund.address)).to.deep.equal([0]);
      await staking.connect(user).unstake(fund.address, stake1.amount);

      expect(await staking.getStakingPositionsInFund(user.address, fund.address)).to.deep.equal([0]);
    });

    it('Should revert if unstaking more tokens than available', async () => {
      await expect(staking.connect(user).unstake(fund.address, stake1.amount.add(toWlth('1')))).to.be.revertedWith(
        'Amount to unstake exceeds staked value'
      );
    });

    describe('when unstaked in Capital Raise Period', async () => {
      it('Should not collect early unstaking penalty', async () => {
        const expectedFee = 3;
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, stake1.amount);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, stake1.amount - expectedFee);
      });

      it('Should not collect early unstaking penalty for any position', async () => {
        const stake2 = { amount: 100, period: TWO_YEARS };
        const stake2WithFee = getStakeWithFee(stake2.amount);

        quoter.quote.returns([stake2.amount, 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2WithFee, stake2.period);

        const toUnstake = 150;
        const expectedFee = 1;
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, toUnstake);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, toUnstake - expectedFee);
      });

      [
        { unstake: 150, remaining: [225, 25] }, // average lower than the smallest position
        { unstake: 300, remaining: [100, 0] }, // average greater than the smallest position
        { unstake: 149, remaining: [225, 26] } // remainder
      ].forEach((item) => {
        it(`Should subtract average from all positions [unstake=${item.unstake}]`, async () => {
          const stake2 = { amount: 100, period: TWO_YEARS };
          const stake2WithFee = getStakeWithFee(stake2.amount);

          quoter.quote.returns([stake2.amount, 0, 0, 0]);
          const tx = await staking.connect(user).stake(fund.address, stake2WithFee, stake2.period);
          const stake2Id = await getStakeIdFromTx(tx, staking.address);

          await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
          await staking.connect(user).unstake(fund.address, item.unstake);
          expect((await staking.getPositionDetails(stake1Id)).amountInWlth).to.equal(item.remaining[0]);
          expect((await staking.getPositionDetails(stake2Id)).amountInWlth).to.equal(item.remaining[1]);
        });
      });
    });

    describe('when unstaked in Capital Deployment Period', async () => {
      it('Should not collect early unstaking penalty if unstaked from closed positions', async () => {
        const expectedFee = 3;
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        const timestampAfterStakingFinished = stake1.period * 2;
        await time.setNextBlockTimestamp(stake1Time + timestampAfterStakingFinished);
        await staking.connect(user).unstake(fund.address, stake1.amount);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, stake1.amount - expectedFee);
      });

      it('Should not collect early unstaking penalty if all NFTs are sold', async () => {
        const expectedFee = 3;
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells all NFTs
        nft.getInvestmentValue.returns(0);

        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, stake1.amount);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, stake1.amount - expectedFee);
      });

      it('Should not collect early unstaking penalty if unlocked tokens are available', async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $900 -> equivalent of $150 in WLTH is unlocked
        nft.getInvestmentValue.returns(300);

        const unlocked = 150;
        const expectedFee = 1;
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, unlocked);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, unlocked - expectedFee);
      });

      it('Should not collect unstaking penalty from multiple stakes if unlocked tokens are available', async () => {
        const stake2 = { amount: 100, period: TWO_YEARS };

        quoter.quote.returns([stake2.amount, 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $900
        nft.getInvestmentValue.returns(300);

        const toUnstake = toWlth('150');
        const expectedFee = 1;
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, toUnstake);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, toUnstake - expectedFee);
      });

      it('Should collect early unstaking penalty if unstaked before staking is finished', async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, stake1.amount);

        // 300 usdc - tx fee = 297 usdc as calculation base
        // total penalty burn = 297*0.4 = 118.8
        // penalty tx fee = 118.8*0.01 = 1.188
        // burn transfer = 118.8 - 1.188 = 117.612
        expect(wlth.burn).to.have.been.calledWith(toWlth('117.612'));
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, toWlth('1.188'));

        // user unstake = 300 - 118.8 = 181.2
        // user transfer fee = 181.2*0.01 = 1.812
        // user transfer = 181.2 - 1.812 = 179.388
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(defaultCommunityFund, toWlth('1.812'));
        expect(wlth.transfer.atCall(2)).to.have.been.calledWith(user.address, toWlth('179.388'));
      });

      it('Should collect proper unstaking penalty if positions are finished, unlocked and locked', async () => {
        const stake2 = { amount: 150, period: FOUR_YEARS };
        const stake2WithFee = getStakeWithFee(stake2.amount);

        quoter.quote.returns([stake2.amount, 0, 0, 0]);
        const tx = await staking.connect(user).stake(fund.address, stake2WithFee, stake2.period);
        const stake2Id = getStakeIdFromTx(tx, staking.address);
        const stake2Time = (await staking.getPositionDetails(stake2Id)).period.start.toNumber();

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $200
        nft.getInvestmentValue.returns(1000);

        const timestampAfterStake1Finished = stake1Time + stake1.period + 1;
        await time.setNextBlockTimestamp(timestampAfterStake1Finished);

        // unstake from ended positions
        await staking.connect(user).unstake(fund.address, 300);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, 3);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, 297);

        // unstake unlocked tokens
        await staking.connect(user).unstake(fund.address, 50);
        expect(wlth.transfer.atCall(2)).to.have.been.calledWith(user.address, 50);

        const timestampAfterTwoYears = stake2Time + stake1.period * 2;
        await time.setNextBlockTimestamp(timestampAfterTwoYears);

        // unstake locked with penalty
        await staking.connect(user).unstake(fund.address, 100);
        expect(wlth.transfer.atCall(3)).to.have.been.calledWith(defaultCommunityFund, 1);
        expect(wlth.burn).to.have.been.calledWith(40);
        expect(wlth.transfer.atCall(4)).to.have.been.calledWith(user.address, 59);
      });

      it('Should collect no penalty if finished tokens cover maximum discount', async () => {
        const stake2 = { amount: 150, period: FOUR_YEARS };
        const stake2WithFee = getStakeWithFee(stake2.amount);

        quoter.quote.returns([stake2.amount, 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2WithFee, stake2.period);

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $600 -> discount from stake 1 increases to maximum value
        nft.getInvestmentValue.returns(600);

        const timestampAfterStake2Finished = stake1Time + stake1.period + 1;
        await time.setNextBlockTimestamp(timestampAfterStake2Finished);

        const toUnstake = 450;
        await staking.connect(user).unstake(fund.address, toUnstake);

        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, 4);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, 446);
      });
    });
  });

  describe('#getDiscountInTimestamp()', () => {
    it('Should return constant discount if staked in CRP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stakeWithFee, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start)).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR / 2))).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(TWO_YEARS))).to.equal(4000);
    });

    it('Should return linear discount if staked in CDP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stakeWithFee, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR / 2))).to.equal(2000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(TWO_YEARS))).to.equal(4000);
    });

    it('Should return correct discount if staked multiple times', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake1 = { amount: 100, period: FOUR_YEARS };
      const stake1WithFee = getStakeWithFee(stake1.amount);
      const stake2 = { amount: 100, period: ONE_YEAR };
      const stake2WithFee = getStakeWithFee(stake2.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [stake1.amount, 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [stake2.amount, 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + TWO_YEARS;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1WithFee, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2WithFee, stake2.period);

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + ONE_YEAR)).to.equal(400);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + TWO_YEARS)).to.equal(800);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + THREE_YEARS)).to.equal(
        1200 + 800
      );
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + FOUR_YEARS)).to.equal(
        1600 + 800
      );
    });

    it('Should return maximum discount if staked multiple times and sold all NFTs', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake1 = { amount: 100, period: FOUR_YEARS };
      const stake1WithFee = getStakeWithFee(stake1.amount);
      const stake2 = { amount: 100, period: ONE_YEAR };
      const stake2WithFee = getStakeWithFee(stake2.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [stake1.amount, 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [stake2.amount, 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + TWO_YEARS;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1WithFee, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2WithFee, stake2.period);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

      // user sells all NFTs
      nft.getInvestmentValue.returns(0);

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + ONE_YEAR)).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + FOUR_YEARS)).to.equal(4000);
    });

    it('Should increase discount up to max value if decreased investment size after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(2000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stakeWithFee, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(2000);

      // user splits NFT and sells one worth $400
      nft.getInvestmentValue.returns(1600);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(2500);

      // user sells token worth $800
      nft.getInvestmentValue.returns(1000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);

      // user sells token worth $500
      nft.getInvestmentValue.returns(500);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);
    });

    it('Should decrease discount if increased investment size after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(2000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stakeWithFee, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(2000);

      // user buys NFT worth $500
      nft.getInvestmentValue.returns(2500);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(1600);
    });

    it('Should return zero discount if timestamp before stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 500, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(2000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stakeWithFee, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.sub(1))).to.equal(0);
    });

    it('Should revert returning discount if fund not registered', async () => {
      const { staking, fund, user } = await setup();

      await expect(staking.getDiscountInTimestamp(user.address, fund.address, Date.now())).to.be.revertedWith(
        'Fund is not registered'
      );
    });
  });

  describe('#getEstimatedDiscount()', () => {
    it('Should return correct discount estimation in CRP', async () => {
      const { staking, wlth, fund, nft, owner, user } = await setup();

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);

      await staking.connect(owner).registerFund(fund.address);
      const stakeTime = (await time.latest()) + 1000;
      const period = { start: stakeTime, duration: ONE_YEAR };

      expect(await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime)).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime + ONE_YEAR / 2)
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime + ONE_YEAR)
      ).to.equal(800);
    });

    it('Should return correct discount estimation in CDP', async () => {
      const { staking, wlth, fund, nft, owner, user } = await setup();

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);

      await staking.connect(owner).registerFund(fund.address);
      const stakeTime = (await time.latest()) + 1000;
      const period = { start: stakeTime, duration: ONE_YEAR };

      expect(await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime)).to.equal(0);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime + ONE_YEAR / 2)
      ).to.equal(400);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime + ONE_YEAR)
      ).to.equal(800);
    });

    it('Should return correct discount estimation in CDP after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: 100, period: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(1000);
      wlth.transferFrom.returns(true);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);

      const stakeTime = (await time.latest()) + 1000;
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stakeWithFee, stake.period);
      const period = { start: stakeTime, duration: ONE_YEAR };

      expect(await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime)).to.equal(0);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime + ONE_YEAR / 2)
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, 100, period, stakeTime + ONE_YEAR)
      ).to.equal(1600);
    });
  });

  describe('Staked tokens getters', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = 1200;

    describe('when single staking position', () => {
      const stake = { amount: investmentSize / 2, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);

      before(async () => {
        ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

        initializeFakes(investmentSize, stake.amount);

        await staking.connect(owner).registerFund(fund.address);

        quoter.quote.returns([stake.amount, 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

        restorer = await takeSnapshot();
      });

      afterEach(async () => {
        await restorer.restore();
        initializeFakes(investmentSize, stake.amount);
      });

      it("Should return user's staking position", async () => {
        expect(await staking.getStakingPositionsInFund(user.address, fund.address)).to.deep.equal([0]);
      });

      it('Should return tokens unlocked by position end', async () => {
        await time.increase(stake.duration);
        await mine();

        const expectedUnlocked = stake.amount;
        expect(await staking.getReleasedTokensFromEndedPositions(user.address, fund.address)).to.equal(
          expectedUnlocked
        );
      });

      it('Should return tokens unlocked by investment change', async () => {
        const sold = 300;
        nft.getInvestmentValue.returns(investmentSize - sold);

        const expectedUnlocked = 150;
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.equal(expectedUnlocked);
      });
    });

    describe('when multiple staking positions', () => {
      let restorer: SnapshotRestorer;

      const stake1 = { amount: 300, duration: ONE_YEAR };
      const stake1WithFee = getStakeWithFee(stake1.amount);
      const stake2 = { amount: 75, duration: FOUR_YEARS };
      const stake2WithFee = getStakeWithFee(stake2.amount);

      before(async () => {
        ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

        initializeFakes(investmentSize);

        await staking.connect(owner).registerFund(fund.address);

        quoter.quote.returns([stake1.amount, 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake1WithFee, stake1.duration);

        quoter.quote.returns([stake2.amount, 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2WithFee, stake2.duration);

        restorer = await takeSnapshot();
      });

      afterEach(async () => {
        await restorer.restore();
        initializeFakes(investmentSize);
      });

      it("Should return multiple user's staking positions", async () => {
        expect(await staking.getStakingPositionsInFund(user.address, fund.address)).to.deep.equal([0, 1]);
      });

      it('Should return tokens unlocked by position end', async () => {
        await time.increase(stake1.duration + 1);
        await mine();

        expect(await staking.getReleasedTokensFromEndedPositions(user.address, fund.address)).to.equal(300);
      });

      it('Should return tokens unlocked by investment change', async () => {
        const sold = 400;
        nft.getInvestmentValue.returns(investmentSize - sold);

        /*
        Tokens used for discount calculations are rounded down so the unlocked ones are rounded up
        stake 1
         locked: 266,67 -> 266
         unlocked: 300 - 266 = 34
        stake 2
         locked: 66,67 -> 66
         unlocked: 75 - 66 = 9
        */
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.equal(34 + 9);
      });

      it('Should return unlocked tokens if position ended and investment size changed', async () => {
        const sold = 400;
        nft.getInvestmentValue.returns(investmentSize - sold);

        await time.increase(stake1.duration + 1);
        await mine();

        expect(await staking.getReleasedTokensFromEndedPositions(user.address, fund.address)).to.equal(300);
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.equal(25);
        expect(await staking.getReleasedTokens(user.address, fund.address)).to.equal(325);
      });
    });

    it("Should return empty user's staking positions if not staked", async () => {
      expect(await staking.getStakingPositionsInFund(user.address, fund.address)).to.deep.equal([]);
    });

    it('Should revert returning total unlocked tokens if fund not registered', async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      await expect(staking.getReleasedTokens(user.address, fund.address)).to.be.revertedWith('Fund is not registered');
    });

    it('Should revert returning tokens unlocked by position end', async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      await expect(staking.getReleasedTokensFromEndedPositions(user.address, fund.address)).to.be.revertedWith(
        'Fund is not registered'
      );
    });

    it('Should revert returning tokens unlocked by investment size decrease', async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      await expect(staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.be.revertedWith(
        'Fund is not registered'
      );
    });
  });

  describe('#getTotalStakingPeriod()', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = 1200;

    before(async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      initializeFakes(investmentSize);
      await staking.connect(owner).registerFund(fund.address);

      restorer = await takeSnapshot();
    });

    afterEach(async () => {
      await restorer.restore();
      initializeFakes(investmentSize);
    });

    it('Should get correct staking period if one position', async () => {
      const stake = { amount: 100, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      const stakeTime = Date.now() + 100;
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

      const period = await staking.getTotalStakingPeriod(user.address, fund.address);
      expect(period.start).to.equal(stakeTime);
      expect(period.duration).to.equal(ONE_YEAR);
    });

    it('Should get correct staking period if multiple positions overlaps', async () => {
      const stake = { amount: 100, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      const stakeTime = Date.now() + 100;
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

      await time.setNextBlockTimestamp(stakeTime + ONE_YEAR / 2);
      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

      expect(await staking.getTotalStakingPeriod(user.address, fund.address)).to.deep.equal([
        stakeTime,
        ONE_YEAR + ONE_YEAR / 2
      ]);
    });

    it('Should get correct staking period if multiple positions do not overlap', async () => {
      const stake = { amount: 100, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      const stakeTime = Date.now() + 100;
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

      await time.setNextBlockTimestamp(stakeTime + ONE_YEAR + 150);
      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

      expect(await staking.getTotalStakingPeriod(user.address, fund.address)).to.deep.equal([
        stakeTime,
        TWO_YEARS + 150
      ]);
    });

    it('Should omit empty positions when returning staking duration', async () => {
      const stake = { amount: 100, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);
      await staking.connect(user).unstake(fund.address, stake.amount);

      expect(await staking.getTotalStakingPeriod(user.address, fund.address)).to.deep.equal([0, 0]);
    });
  });

  describe('#getPenalty()', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = 1200;

    before(async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      initializeFakes(investmentSize);
      await staking.connect(owner).registerFund(fund.address);

      restorer = await takeSnapshot();
    });

    afterEach(async () => {
      await restorer.restore();
      initializeFakes(investmentSize);
    });

    describe('when fund is in Capital Raise Period', async () => {
      beforeEach(async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      });

      it('Should return 0 penalty', async () => {
        const stake = { amount: 300, duration: ONE_YEAR };
        const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([stake.amount, 0, 0, 0]);

        await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(0);
      });
    });

    describe('when fund is in Capital Deployment Period', async () => {
      beforeEach(async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      });

      it('Should return 0 penalty if fund is in position is finished', async () => {
        const stake = { amount: 300, duration: ONE_YEAR };
        const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([stake.amount, 0, 0, 0]);

        await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

        await time.increase(stake.duration);
        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(0);
      });

      it('Should return correct penalty if position is active and no tokens unlocked', async () => {
        const stake = { amount: 300, duration: ONE_YEAR };
        const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([stake.amount, 0, 0, 0]);

        const stakeTime = Date.now() + 1000;
        await time.setNextBlockTimestamp(stakeTime);
        await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

        await time.increaseTo(stakeTime + stake.duration / 2);
        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(120);
      });

      it('Should return correct penalty if position is active and tokens unlocked', async () => {
        const stake = { amount: 300, duration: ONE_YEAR };
        const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([stake.amount, 0, 0, 0]);

        const stakeTime = Date.now() + 1000;
        await time.setNextBlockTimestamp(stakeTime);
        await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

        nft.getInvestmentValue.returns(300);

        const unlocked = stake.amount / 2;
        await time.increaseTo(stakeTime + stake.duration / 2);
        expect(await staking.getPenalty(user.address, fund.address, unlocked)).to.equal(0);
        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(60);
      });
    });
  });

  describe('#getRequiredStakeForMaxDiscount()', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = 1200;

    before(async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      initializeFakes(investmentSize);
      await staking.connect(owner).registerFund(fund.address);

      restorer = await takeSnapshot();
    });

    afterEach(async () => {
      await restorer.restore();
      initializeFakes(investmentSize);
    });

    it('Should return required stake for max discount if no stake done', async () => {
      expect(await staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.equal(600);
    });

    [FundState.FundsIn, FundState.CapReached, FundState.FundsDeployed].forEach((state) => {
      it(`Should return required stake for max discount if stake is done [state=${state}]`, async () => {
        const stake = { amount: 150, duration: ONE_YEAR };
        const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([150, 0, 0, 0]);
        fund.currentState.returns(formatBytes32String(state));

        await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

        expect(await staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.equal(450);
      });
    });

    it('Should return zero required stake for max discount if max stake is done', async () => {
      const stake = { amount: 600, duration: ONE_YEAR };
      const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([600, 0, 0, 0]);

      await staking.connect(user).stake(fund.address, stakeWithFee, stake.duration);

      expect(await staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.equal(0);
    });

    [0, 1].forEach((value) => {
      it(`Should revert if investment value is too low [value=${value}]`, async () => {
        nft.getInvestmentValue.returns(value);

        await expect(staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.be.revertedWith(
          'Investment value is too low'
        );
      });
    });
  });
});
