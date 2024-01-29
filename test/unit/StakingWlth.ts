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
import { getStakeIdFromTx, toUsdc, toWlth } from '../utils';

chai.use(smock.matchers);
const { expect } = chai;

describe('Staking WLTH unit tests', () => {
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

  const initializeFakes = (investmentValueReturn: BigNumber, quoteReturn?: BigNumber) => {
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
      const { staking, owner } = await loadFixture(deployStaking);
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
            defaultCommunityFund,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(staking, 'OwnablePausable__OwnerAccountZeroAddress');
    });

    it('Should revert deploying if token is zero address', async () => {
      const { staking } = await loadFixture(deployStaking);
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
            defaultCommunityFund,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__TokenZeroAddress');
    });

    it('Should revert deploying if community fund is zero address', async () => {
      const { staking } = await loadFixture(deployStaking);
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
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500]
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__CommunityFundZeroAddress');
    });

    it('Should revert deploying if durations and coefficients arrays lengths does not match', async () => {
      const { staking } = await loadFixture(deployStaking);
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
            defaultCommunityFund,
            maxDiscount,
            [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
            [5000, 3750, 3125, 2500, 123123]
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__DurationsCoeffecientsLenghtsMismatch');
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
    const investmentSize = toUsdc('1200');

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
      const stake = { amount: toWlth('600'), period: ONE_YEAR };
      quoter.quote.returns([toUsdc('300'), 0, 0, 0]);

      await expect(staking.connect(user).stake(fund.address, stake.amount, stake.period))
        .to.emit(staking, 'TokensStaked')
        .withArgs(user.address, fund.address, 0, stake.amount);
    });

    it('Should create staking position', async () => {
      const stake = { amount: toWlth('600'), period: ONE_YEAR };
      quoter.quote.returns([toUsdc('300'), 0, 0, 0]);

      const stakeTime = (await time.latest()) + 100;
      await time.setNextBlockTimestamp(stakeTime);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);
      const stakeId = await getStakeIdFromTx(tx, staking.address);

      expect(await staking.getPositionDetails(0)).to.deep.equal([
        stakeId,
        user.address,
        fund.address,
        stake.amount,
        toUsdc('300'),
        investmentSize,
        [stakeTime, stake.period],
        true,
        0
      ]);
    });

    it('Should revert staking if fund not registered', async () => {
      const stake = { amount: toWlth('600'), duration: ONE_YEAR };
      quoter.quote.returns([stake.amount, 0, 0, 0]);

      await staking.connect(owner).unregisterFund(fund.address);
      await expect(
        staking.connect(user).stake(fund.address, stake.amount, stake.duration)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__InvestmentFundNotRegistered');
    });

    it('Should revert staking if target discount is equal to zero', async () => {
      const stake = { amount: toWlth('600'), duration: ONE_YEAR };
      quoter.quote.returns([0, 0, 0, 0]); // gives zero discount

      await expect(
        staking.connect(user).stake(fund.address, stake.amount, stake.duration)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__ZeroTargetDiscount');
    });

    it('Should revert staking if target discount exceeds maximum value', async () => {
      const stake = { amount: toWlth('601'), duration: ONE_YEAR }; // half of investment value + 1
      quoter.quote.returns([toUsdc('601'), 0, 0, 0]);

      await expect(
        staking.connect(user).stake(fund.address, stake.amount, stake.duration)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__TargetDiscountAboveMaxValue');
    });

    it('Should revert staking if total target discount exceeds maximum value', async () => {
      const stake1 = { amount: toWlth('600'), duration: ONE_YEAR };
      const stake2 = { amount: toWlth('100'), duration: ONE_YEAR };
      quoter.quote.returnsAtCall(0, [toUsdc('300'), 0, 0, 0]);
      // discount reaches max value at total stakes worth of half investment value, in that case 600 USDC
      quoter.quote.returnsAtCall(1, [toUsdc('301'), 0, 0, 0]);

      await staking.connect(user).stake(fund.address, stake1.amount, stake1.duration);
      await expect(
        staking.connect(user).stake(fund.address, stake2.amount, stake2.duration)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__TargetDiscountAboveMaxValue');
    });

    it('Should return staked tokens in fund', async () => {
      const fund2 = await smock.fake('InvestmentFund');
      const nft2 = await smock.fake('InvestmentNFT');
      const stake1 = { amount: toWlth('600'), duration: ONE_YEAR };
      const stake2 = { amount: toWlth('100'), duration: ONE_YEAR };

      fund2.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund2.investmentNft.returns(nft2.address);
      nft2.getInvestmentValue.returns(investmentSize);
      quoter.quote.returnsAtCall(0, [toUsdc('600'), 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [toUsdc('100'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund2.address);
      await staking.connect(user).stake(fund.address, stake1.amount, stake1.duration);
      await staking.connect(user).stake(fund2.address, stake2.amount, stake2.duration);

      expect(await staking.getStakingAccounts()).to.deep.equal([user.address]);
      expect(await staking.getStakedTokensInFund(user.address, fund.address)).to.equal(stake1.amount);
      expect(await staking.getStakedTokensInFund(user.address, fund2.address)).to.equal(stake2.amount);
      expect(await staking.getStakedTokens(user.address)).to.equal(stake1.amount.add(stake2.amount));
    });
  });

  describe('#unstake()', () => {
    let restorer: SnapshotRestorer;
    let stake1Id: number;
    let stake1Time: number;

    const investmentSize = toUsdc('1200');
    const stake1 = { amount: toWlth('300'), period: ONE_YEAR };

    before(async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      initializeFakes(investmentSize, stake1.amount);

      await staking.connect(owner).registerFund(fund.address);
      quoter.quote.returnsAtCall(0, [toUsdc('300'), 0, 0, 0]);

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
      await expect(
        staking.connect(user).unstake(fund.address, stake1.amount.add(toWlth('1')))
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__UnstakeExceedsStake');
    });

    describe('when unstaked in Capital Raise Period', async () => {
      it('Should not collect early unstaking penalty', async () => {
        // staking/unstaking calculations are for stake value without 1% tx fee, which has to be included in unstaking transfers
        // so in that case tx fee is 1% of stake amount *0.99, which is 2.97
        const expectedFee = toWlth('2.97');
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, stake1.amount);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        // WLTH effectively transferred to contract is 99% of declared stake amount, so its 297
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(
          user.address,
          stake1.amount.mul(99).div(100).sub(expectedFee)
        );
      });

      it('Should not collect early unstaking penalty for any position', async () => {
        const stake2 = { amount: toWlth('100'), period: TWO_YEARS };

        quoter.quote.returns([toUsdc('100'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

        const toUnstake = toWlth('150');
        const expectedFee = toWlth('1.485');
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, toUnstake);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(
          user.address,
          toUnstake.mul(99).div(100).sub(expectedFee)
        );
      });

      it('Should simulate not collect early unstaking penalty for any position', async () => {
        const stake2 = { amount: toWlth('100'), period: TWO_YEARS };

        quoter.quote.returns([toUsdc('100'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

        const toUnstake = toWlth('150');
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        expect(await staking.connect(user).getUnstakeSimulation(fund.address, toUnstake)).to.deep.equal([
          toWlth('0'),
          BigNumber.from(1722)
        ]);
      });

      [
        { unstake: toWlth('150'), remaining: [toWlth('225'), toWlth('25')] }, // average lower than the smallest position
        { unstake: toWlth('300'), remaining: [toWlth('100'), 0] }, // average greater than the smallest position
        { unstake: toWlth('149'), remaining: [toWlth('225.5'), toWlth('25.5')] } // remainder
      ].forEach((item) => {
        it(`Should subtract average from all positions [unstake=${item.unstake}]`, async () => {
          const stake2 = { amount: toWlth('100'), period: TWO_YEARS };

          quoter.quote.returns([toUsdc('100'), 0, 0, 0]);
          const tx = await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);
          const stake2Id = await getStakeIdFromTx(tx, staking.address);

          await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
          await staking.connect(user).unstake(fund.address, item.unstake);
          expect((await staking.getPositionDetails(stake1Id)).amountInWlth).to.equal(item.remaining[0]);
          expect((await staking.getPositionDetails(stake2Id)).amountInWlth).to.equal(item.remaining[1]);
        });
      });
    });

    describe('when unstaked in Capital Deployment Period', async () => {
      it('Should simulate not collect early unstaking penalty if unstaked from closed positions', async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        const timestampAfterStakingFinished = stake1.period * 2;
        await time.increaseTo(stake1Time + timestampAfterStakingFinished);
        expect(await staking.connect(user).getUnstakeSimulation(fund.address, stake1.amount)).to.deep.equal([
          toWlth('0'),
          BigNumber.from(2000)
        ]);
      });

      it('Should not collect early unstaking penalty if unstaked from closed positions', async () => {
        const expectedFee = toWlth('2.97');
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        const timestampAfterStakingFinished = stake1.period * 2;
        await time.setNextBlockTimestamp(stake1Time + timestampAfterStakingFinished);
        await staking.connect(user).unstake(fund.address, stake1.amount);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(
          user.address,
          stake1.amount.mul(99).div(100).sub(expectedFee)
        );
      });

      it('Should not collect early unstaking penalty if all NFTs are sold', async () => {
        const expectedFee = toWlth('2.97');
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells all NFTs
        nft.getInvestmentValue.returns(0);

        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, stake1.amount);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(
          user.address,
          stake1.amount.mul(99).div(100).sub(expectedFee)
        );
      });

      it('Should not collect early unstaking penalty if unlocked tokens are available', async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $900 -> equivalent of $150 in WLTH is unlocked
        nft.getInvestmentValue.returns(toUsdc('300'));

        const unlocked = toWlth('150');
        const expectedFee = toWlth('1.485');
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, unlocked);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(
          user.address,
          unlocked.mul(99).div(100).sub(expectedFee)
        );
      });

      it('Should not collect unstaking penalty from multiple stakes if unlocked tokens are available', async () => {
        const stake2 = { amount: toWlth('100'), period: TWO_YEARS };

        quoter.quote.returns([toUsdc('100'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $900
        nft.getInvestmentValue.returns(toUsdc('300'));

        const toUnstake = toWlth('150');
        const expectedFee = toWlth('1.485');
        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, toUnstake);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, expectedFee);
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(
          user.address,
          toUnstake.mul(99).div(100).sub(expectedFee)
        );
      });

      it('Should collect early unstaking penalty if unstaked before staking is finished', async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        await time.setNextBlockTimestamp(stake1Time + stake1.period / 2);
        await staking.connect(user).unstake(fund.address, stake1.amount);

        // 300 usdc - tx fee = 297 usdc as calculation base
        // total penalty burn = 297*0.4 = 118.8
        // penalty tx fee = 118.8*0.01 = 1.188
        // burn transfer = 118.8*0.99 = 117.612
        expect(wlth.burn).to.have.been.calledWith(toWlth('117.612'));
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, toWlth('1.188'));

        // user unstake = 297*0.6 = 178.2
        // user transfer fee = 178.2*0.01 = 1.782
        // user transfer = 178.2*0.99 = 176.418
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(defaultCommunityFund, toWlth('1.782'));
        expect(wlth.transfer.atCall(2)).to.have.been.calledWith(user.address, toWlth('176.418'));
      });

      it('Should simulate early unstaking penalty if unstaked before staking is finished', async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        await time.increaseTo(stake1Time + stake1.period / 2);
        expect(await staking.connect(user).getUnstakeSimulation(fund.address, stake1.amount)).to.deep.equal([
          toWlth('120'),
          BigNumber.from(0)
        ]);
      });

      it('Should simulate proper unstaking penalty if positions are finished, unlocked and locked', async () => {
        const stake2 = { amount: toWlth('150'), period: FOUR_YEARS };

        quoter.quote.returns([toUsdc('150'), 0, 0, 0]);
        const tx = await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);
        const stake2Id = getStakeIdFromTx(tx, staking.address);
        const stake2Time = (await staking.getPositionDetails(stake2Id)).period.start.toNumber();

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $200
        nft.getInvestmentValue.returns(toUsdc('1000'));

        const timestampAfterStake1Finished = stake1Time + stake1.period + 1;
        await time.increaseTo(timestampAfterStake1Finished);

        // unstake from various positions: ended(300 WLTH), unlocked(50 WLTH) and locked(100 WLTH)
        expect(await staking.connect(user).getUnstakeSimulation(fund.address, toWlth('450'))).to.deep.equal([
          toWlth('60'),
          BigNumber.from(2400)
        ]);
      });

      it('Should collect proper unstaking penalty if positions are finished, unlocked and locked', async () => {
        const stake2 = { amount: toWlth('150'), period: FOUR_YEARS };

        quoter.quote.returns([toUsdc('150'), 0, 0, 0]);
        const tx = await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);
        const stake2Id = getStakeIdFromTx(tx, staking.address);
        const stake2Time = (await staking.getPositionDetails(stake2Id)).period.start.toNumber();

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $200
        nft.getInvestmentValue.returns(toUsdc('1000'));

        const timestampAfterStake1Finished = stake1Time + stake1.period + 1;
        await time.setNextBlockTimestamp(timestampAfterStake1Finished);

        // unstake from ended positions
        await staking.connect(user).getUnstakeSimulation(fund.address, toWlth('300'));
        await staking.connect(user).unstake(fund.address, toWlth('300'));
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, toWlth('2.97'));
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, toWlth('294.03'));

        // unstake unlocked tokens
        await staking.connect(user).getUnstakeSimulation(fund.address, toWlth('50'));
        await staking.connect(user).unstake(fund.address, toWlth('50'));
        expect(wlth.transfer.atCall(2)).to.have.been.calledWith(defaultCommunityFund, toWlth('0.495'));
        expect(wlth.transfer.atCall(3)).to.have.been.calledWith(user.address, toWlth('49.005'));

        const timestampAfterTwoYears = stake2Time + stake1.period * 2;
        await time.setNextBlockTimestamp(timestampAfterTwoYears);

        // unstake locked with penalty
        await staking.connect(user).getUnstakeSimulation(fund.address, toWlth('300'));
        await staking.connect(user).unstake(fund.address, toWlth('100'));
        expect(wlth.burn).to.have.been.calledWith(toWlth('39.204'));
        expect(wlth.transfer.atCall(4)).to.have.been.calledWith(defaultCommunityFund, toWlth('0.396'));
        expect(wlth.transfer.atCall(5)).to.have.been.calledWith(defaultCommunityFund, toWlth('0.594'));
        expect(wlth.transfer.atCall(6)).to.have.been.calledWith(user.address, toWlth('58.806'));
      });

      it('Should collect no penalty if finished tokens cover maximum discount', async () => {
        const stake2 = { amount: toWlth('150'), period: FOUR_YEARS };

        quoter.quote.returns([toUsdc('150'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $600 -> discount from stake 1 increases to maximum value
        nft.getInvestmentValue.returns(toUsdc('600'));

        const timestampAfterStake2Finished = stake1Time + stake1.period + 1;
        await time.setNextBlockTimestamp(timestampAfterStake2Finished);

        const toUnstake = toUsdc('450');
        await staking.connect(user).unstake(fund.address, toUnstake);

        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(defaultCommunityFund, toUsdc('4.455'));
        expect(wlth.transfer.atCall(1)).to.have.been.calledWith(user.address, toUsdc('441.045'));
      });

      it('Should simulate no penalty if finished tokens cover maximum discount', async () => {
        const stake2 = { amount: toWlth('150'), period: FOUR_YEARS };

        quoter.quote.returns([toUsdc('150'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

        // user sells NFTs with $600 -> discount from stake 1 increases to maximum value
        nft.getInvestmentValue.returns(toUsdc('600'));

        const timestampAfterStake2Finished = stake1Time + stake1.period + 1;
        await time.increaseTo(timestampAfterStake2Finished);

        const toUnstake = toUsdc('450');
        expect(await staking.connect(user).getUnstakeSimulation(fund.address, toUnstake)).to.deep.equal([
          toWlth('0'),

          BigNumber.from(4000)
        ]);
      });
    });
  });

  describe('#getDiscountInTimestamp()', () => {
    it('Should return constant discount if staked in CRP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start)).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR / 2))).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(TWO_YEARS))).to.equal(4000);
    });

    it('Should return linear discount if staked in CDP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR / 2))).to.equal(2000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(TWO_YEARS))).to.equal(4000);
    });

    it('Should return correct discount if staked multiple times', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake1 = { amount: toWlth('100'), period: FOUR_YEARS };
      const stake2 = { amount: toWlth('100'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [toUsdc('100'), 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [toUsdc('100'), 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + TWO_YEARS;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1.amount, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

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
      const stake1 = { amount: toWlth('100'), period: FOUR_YEARS };
      const stake2 = { amount: toWlth('100'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [toUsdc('100'), 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [toUsdc('100'), 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + TWO_YEARS;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1.amount, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

      // user sells all NFTs
      nft.getInvestmentValue.returns(0);

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + ONE_YEAR)).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + FOUR_YEARS)).to.equal(4000);
    });

    it('Should increase discount up to max value if decreased investment size after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('2000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(2000);

      // user splits NFT and sells one worth $400
      nft.getInvestmentValue.returns(toUsdc('1600'));
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(2500);

      // user sells token worth $800
      nft.getInvestmentValue.returns(toUsdc('1000'));
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);

      // user sells token worth $500
      nft.getInvestmentValue.returns(toUsdc('500'));
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(4000);
    });

    it('Should decrease discount if increased investment size after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('2000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(2000);

      // user buys NFT worth $500
      nft.getInvestmentValue.returns(toUsdc('2500'));
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.add(ONE_YEAR))).to.equal(1600);
    });

    it('Should return zero discount if timestamp before stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('2000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, start.sub(1))).to.equal(0);
    });

    it('Should revert returning discount if fund not registered', async () => {
      const { staking, fund, user } = await setup();

      await expect(
        staking.getDiscountInTimestamp(user.address, fund.address, Date.now())
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__InvestmentFundNotRegistered');
    });
  });

  describe('#getDiscountFromPreviousInvestmentInTimestamp()', () => {
    it('Should return constant discount if staked in CRP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      nft.getPastInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start, 100)
      ).to.equal(4000);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          start.add(ONE_YEAR / 2),
          100
        )
      ).to.equal(4000);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(4000);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          start.add(TWO_YEARS),
          100
        )
      ).to.equal(4000);
    });

    it('Should return linear discount if staked in CDP', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      nft.getPastInvestmentValue.returns(toUsdc('1000'));

      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start, 100)
      ).to.equal(0);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          start.add(ONE_YEAR / 2),
          100
        )
      ).to.equal(2000);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(4000);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          start.add(TWO_YEARS),
          100
        )
      ).to.equal(4000);
    });

    it('Should return correct discount if staked multiple times', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake1 = { amount: toWlth('100'), period: FOUR_YEARS };
      const stake2 = { amount: toWlth('100'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      nft.getPastInvestmentValue.returns(toUsdc('1000'));

      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [toUsdc('100'), 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [toUsdc('100'), 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + TWO_YEARS;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1.amount, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, stake1Time, 100)
      ).to.equal(0);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          stake1Time + ONE_YEAR,
          100
        )
      ).to.equal(400);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          stake1Time + TWO_YEARS,
          100
        )
      ).to.equal(800);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          stake1Time + THREE_YEARS,
          100
        )
      ).to.equal(1200 + 800);
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(
          user.address,
          fund.address,
          stake1Time + FOUR_YEARS,
          100
        )
      ).to.equal(1600 + 800);
    });

    it('Should return maximum discount if staked multiple times and sold all NFTs', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake1 = { amount: toWlth('100'), period: FOUR_YEARS };
      const stake2 = { amount: toWlth('100'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returnsAtCall(0, [toUsdc('100'), 0, 0, 0]);
      quoter.quote.returnsAtCall(1, [toUsdc('100'), 0, 0, 0]);

      const stake1Time = Date.now() + 1000;
      const stake2Time = stake1Time + TWO_YEARS;

      await staking.connect(owner).registerFund(fund.address);

      await time.setNextBlockTimestamp(stake1Time);
      await staking.connect(user).stake(fund.address, stake1.amount, stake1.period);

      await time.setNextBlockTimestamp(stake2Time);
      await staking.connect(user).stake(fund.address, stake2.amount, stake2.period);

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));

      // user sells all NFTs
      nft.getInvestmentValue.returns(0);

      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time)).to.equal(0);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + ONE_YEAR)).to.equal(4000);
      expect(await staking.getDiscountInTimestamp(user.address, fund.address, stake1Time + FOUR_YEARS)).to.equal(4000);
    });

    it('Should not increase discount for previous investment if decreased investment size after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('2000'));
      nft.getPastInvestmentValue.returns(toUsdc('2000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(2000);

      // user splits NFT and sells one worth $400
      nft.getInvestmentValue.returns(toUsdc('1600'));
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(2000);

      // user sells token worth $800
      nft.getInvestmentValue.returns(toUsdc('1000'));
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(2000);

      // user sells token worth $500
      nft.getInvestmentValue.returns(toUsdc('500'));
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(2000);
    });

    it('Should not decrease discount for previous investment if increased investment size after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('2000'));
      nft.getPastInvestmentValue.returns(toUsdc('2000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(2000);

      // user buys NFT worth $500
      nft.getInvestmentValue.returns(toUsdc('2500'));
      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.add(ONE_YEAR), 100)
      ).to.equal(2000);
    });

    it('Should return zero discount if timestamp before stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('500'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('2000'));
      nft.getPastInvestmentValue.returns(toUsdc('2000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('500'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);
      const tx = await staking.connect(user).stake(fund.address, stake.amount, stake.period);

      const stakeId = await getStakeIdFromTx(tx, staking.address);
      const start = (await staking.getPositionDetails(stakeId)).period.start;

      expect(
        await staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, start.sub(1), 100)
      ).to.equal(0);
    });

    it('Should revert returning discount if fund not registered', async () => {
      const { staking, fund, user } = await setup();

      await expect(
        staking.getDiscountFromPreviousInvestmentInTimestamp(user.address, fund.address, Date.now(), 100)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__InvestmentFundNotRegistered');
    });
  });

  describe('#getEstimatedDiscount()', () => {
    it('Should return correct discount estimation in CRP', async () => {
      const { staking, wlth, fund, nft, owner, user } = await setup();

      fund.currentState.returns(formatBytes32String(FundState.FundsIn));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);

      await staking.connect(owner).registerFund(fund.address);
      const stakeTime = (await time.latest()) + 1000;
      const period = { start: stakeTime, duration: ONE_YEAR };

      expect(await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime)).to.equal(
        800
      );
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime + ONE_YEAR / 2)
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime + ONE_YEAR)
      ).to.equal(800);
    });

    it('Should return correct discount estimation in CDP', async () => {
      const { staking, wlth, fund, nft, owner, user } = await setup();

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);

      await staking.connect(owner).registerFund(fund.address);
      const stakeTime = (await time.latest()) + 1000;
      const period = { start: stakeTime, duration: ONE_YEAR };

      expect(await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime)).to.equal(
        0
      );
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime + ONE_YEAR / 2)
      ).to.equal(400);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime + ONE_YEAR)
      ).to.equal(800);
    });

    it('Should return correct discount estimation in CDP after stake', async () => {
      const { staking, wlth, quoter, fund, nft, owner, user } = await setup();
      const stake = { amount: toWlth('100'), period: ONE_YEAR };

      fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      fund.investmentNft.returns(nft.address);
      nft.getInvestmentValue.returns(toUsdc('1000'));
      wlth.transferFrom.returns(true);
      quoter.quote.returns([toUsdc('100'), 0, 0, 0]);

      await staking.connect(owner).registerFund(fund.address);

      const stakeTime = (await time.latest()) + 1000;
      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.period);
      const period = { start: stakeTime, duration: ONE_YEAR };

      expect(await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime)).to.equal(
        0
      );
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime + ONE_YEAR / 2)
      ).to.equal(800);
      expect(
        await staking.getEstimatedDiscount(user.address, fund.address, toUsdc('100'), period, stakeTime + ONE_YEAR)
      ).to.equal(1600);
    });
  });

  describe('Staked tokens getters', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = toUsdc('1200');

    describe('when single staking position', () => {
      // stake half of investment USDC tokens as WLTH tokens
      const stake = { amount: toWlth('600'), duration: ONE_YEAR };

      before(async () => {
        ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

        initializeFakes(investmentSize, stake.amount);

        await staking.connect(owner).registerFund(fund.address);

        quoter.quote.returns([toUsdc('600'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

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
        const sold = toUsdc('300');
        nft.getInvestmentValue.returns(investmentSize.sub(sold));

        const expectedUnlocked = toWlth('150');
        // due to large WLTH precision there can be numerical issues with calculating exact expected unlocked value
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.be.above(
          expectedUnlocked.sub(toWlth('0.1'))
        );
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.be.below(
          expectedUnlocked.add(toWlth('0.1'))
        );
      });
    });

    describe('when multiple staking positions', () => {
      let restorer: SnapshotRestorer;

      const stake1 = { amount: toWlth('300'), duration: ONE_YEAR };
      const stake2 = { amount: toWlth('75'), duration: FOUR_YEARS };

      before(async () => {
        ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

        initializeFakes(investmentSize);

        await staking.connect(owner).registerFund(fund.address);

        quoter.quote.returns([toUsdc('300'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake1.amount, stake1.duration);

        quoter.quote.returns([toUsdc('75'), 0, 0, 0]);
        await staking.connect(user).stake(fund.address, stake2.amount, stake2.duration);

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

        expect(await staking.getReleasedTokensFromEndedPositions(user.address, fund.address)).to.equal(toWlth('300'));
      });

      it('Should return tokens unlocked by investment change', async () => {
        const sold = toUsdc('400');
        nft.getInvestmentValue.returns(investmentSize.sub(sold));

        /*
        Tokens used for discount calculations are rounded down so the unlocked ones are rounded up after this operation
        stake 1
         locked: 266,666666666666666667 -> 266
         unlocked: 300 - 266,666666666666666667 = 33,333333333333333334
        stake 2
         locked: 66,666666666666666667 -> 66
         unlocked: 75 - 66,666666666666666667 = 9,333333333333333334 
         total unlocked tokens without rounding up: 41.666666666666666668
        */
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.equal(
          toWlth('41.666666666666666668')
        ); // 34+9
      });

      it('Should return unlocked tokens if position ended and investment size changed', async () => {
        const sold = toUsdc('400');
        nft.getInvestmentValue.returns(investmentSize.sub(sold));

        await time.increase(stake1.duration + 1);
        await mine();

        expect(await staking.getReleasedTokensFromEndedPositions(user.address, fund.address)).to.equal(toWlth('300'));
        expect(await staking.getReleasedTokensFromOpenPositions(user.address, fund.address)).to.equal(toWlth('25'));
        expect(await staking.getReleasedTokens(user.address, fund.address)).to.equal(toWlth('325'));
      });
    });

    it("Should return empty user's staking positions if not staked", async () => {
      ({ staking, user, fund } = await setup());
      expect(await staking.getStakingPositionsInFund(user.address, fund.address)).to.deep.equal([]);
    });

    it('Should revert returning total unlocked tokens if fund not registered', async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      await expect(staking.getReleasedTokens(user.address, fund.address)).to.be.revertedWithCustomError(
        staking,
        'StakingWlth__InvestmentFundNotRegistered'
      );
    });

    it('Should revert returning tokens unlocked by position end', async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      await expect(
        staking.getReleasedTokensFromEndedPositions(user.address, fund.address)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__InvestmentFundNotRegistered');
    });

    it('Should revert returning tokens unlocked by investment size decrease', async () => {
      ({ staking, wlth, quoter, fund, nft, deployer, owner, user } = await setup());

      await expect(
        staking.getReleasedTokensFromOpenPositions(user.address, fund.address)
      ).to.be.revertedWithCustomError(staking, 'StakingWlth__InvestmentFundNotRegistered');
    });
  });

  describe('#getTotalStakingPeriod()', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = toUsdc('1200');

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
      const stake = { amount: toWlth('100'), duration: ONE_YEAR };
      //const stakeWithFee = getStakeWithFee(stake.amount);
      const stakeTime = Date.now() + 100;
      quoter.quote.returns([toUsdc('100'), 0, 0, 0]);

      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

      const period = await staking.getTotalStakingPeriod(user.address, fund.address);
      expect(period.start).to.equal(stakeTime);
      expect(period.duration).to.equal(ONE_YEAR);
    });

    it('Should get correct staking period if multiple positions overlaps', async () => {
      const stake = { amount: toWlth('100'), duration: ONE_YEAR };
      //const stakeWithFee = getStakeWithFee(stake.amount);
      const stakeTime = Date.now() + 100;
      quoter.quote.returns([toUsdc('100'), 0, 0, 0]);

      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

      await time.setNextBlockTimestamp(stakeTime + ONE_YEAR / 2);
      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

      expect(await staking.getTotalStakingPeriod(user.address, fund.address)).to.deep.equal([
        stakeTime,
        ONE_YEAR + ONE_YEAR / 2
      ]);
    });

    it('Should get correct staking period if multiple positions do not overlap', async () => {
      const stake = { amount: toWlth('100'), duration: ONE_YEAR };
      //const stakeWithFee = getStakeWithFee(stake.amount);
      const stakeTime = Date.now() + 100;
      quoter.quote.returns([toUsdc('100'), 0, 0, 0]);

      await time.setNextBlockTimestamp(stakeTime);
      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

      await time.setNextBlockTimestamp(stakeTime + ONE_YEAR + 150);
      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

      expect(await staking.getTotalStakingPeriod(user.address, fund.address)).to.deep.equal([
        stakeTime,
        TWO_YEARS + 150
      ]);
    });

    it('Should omit empty positions when returning staking duration', async () => {
      const stake = { amount: toWlth('100'), duration: ONE_YEAR };
      //const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([toUsdc('100'), 0, 0, 0]);

      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);
      await staking.connect(user).unstake(fund.address, stake.amount);

      expect(await staking.getTotalStakingPeriod(user.address, fund.address)).to.deep.equal([0, 0]);
    });
  });

  describe('#getPenalty()', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = toUsdc('1200');

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
        const stake = { amount: toWlth('300'), duration: ONE_YEAR };
        //const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([toUsdc('100'), 0, 0, 0]);

        await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(0);
      });
    });

    describe('when fund is in Capital Deployment Period', async () => {
      beforeEach(async () => {
        fund.currentState.returns(formatBytes32String(FundState.FundsDeployed));
      });

      it('Should return 0 penalty if fund is in position is finished', async () => {
        const stake = { amount: toWlth('300'), duration: ONE_YEAR };
        //const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([toUsdc('300'), 0, 0, 0]);

        await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

        await time.increase(stake.duration);
        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(0);
      });

      it('Should return correct penalty if position is active and no tokens unlocked', async () => {
        const stake = { amount: toWlth('300'), duration: ONE_YEAR };
        //const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([toUsdc('300'), 0, 0, 0]);

        const stakeTime = Date.now() + 1000;
        await time.setNextBlockTimestamp(stakeTime);
        await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

        await time.increaseTo(stakeTime + stake.duration / 2);
        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(toWlth('120'));
      });

      it('Should return correct penalty if position is active and tokens unlocked', async () => {
        const stake = { amount: toWlth('300'), duration: ONE_YEAR };
        //const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([toUsdc('300'), 0, 0, 0]);

        const stakeTime = Date.now() + 1000;
        await time.setNextBlockTimestamp(stakeTime);
        await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

        nft.getInvestmentValue.returns(toUsdc('300'));

        const unlocked = stake.amount.div(2);
        await time.increaseTo(stakeTime + stake.duration / 2);
        expect(await staking.getPenalty(user.address, fund.address, unlocked)).to.equal(0);
        expect(await staking.getPenalty(user.address, fund.address, stake.amount)).to.equal(toWlth('60'));
      });
    });
  });

  describe('#getRequiredStakeForMaxDiscount()', () => {
    let restorer: SnapshotRestorer;
    const investmentSize = toUsdc('1200');

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
      expect(await staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.equal(
        toUsdc('600')
      );
    });

    [FundState.FundsIn, FundState.CapReached, FundState.FundsDeployed].forEach((state) => {
      it(`Should return required stake for max discount if stake is done [state=${state}]`, async () => {
        const stake = { amount: toWlth('150'), duration: ONE_YEAR };
        //const stakeWithFee = getStakeWithFee(stake.amount);
        quoter.quote.returns([toUsdc('150'), 0, 0, 0]);
        fund.currentState.returns(formatBytes32String(state));

        await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

        expect(await staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.equal(
          toUsdc('450')
        );
      });
    });

    it('Should return zero required stake for max discount if max stake is done', async () => {
      const stake = { amount: toWlth('600'), duration: ONE_YEAR };
      //const stakeWithFee = getStakeWithFee(stake.amount);
      quoter.quote.returns([toUsdc('600'), 0, 0, 0]);

      await staking.connect(user).stake(fund.address, stake.amount, stake.duration);

      expect(await staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)).to.equal(0);
    });

    [0, 1].forEach((value) => {
      it(`Should revert if investment value is too low [value=${value}]`, async () => {
        nft.getInvestmentValue.returns(value);

        await expect(
          staking.getRequiredStakeForMaxDiscount(user.address, fund.address, ONE_YEAR)
        ).to.be.revertedWithCustomError(staking, 'StakingWlth__InvestmentValueTooLow');
      });
    });
  });
});
