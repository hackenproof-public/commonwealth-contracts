import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { Wlth, WlthBonusStaking } from '../../typechain-types';

describe('WlthBonusStaking', () => {
  const deployWlthBonusStaking = async () => {
    const [deployer, owner, communityFund, user1, user2] = await ethers.getSigners();
    const ONE_DAY_IN_SECONDS = 86400;
    const THREE_MONTHS_IN_SECONDS = 3 * 30 * ONE_DAY_IN_SECONDS;
    const SIX_MONTHS_IN_SECONDS = 6 * 30 * ONE_DAY_IN_SECONDS;
    const NINE_MONTHS_IN_SECONDS = 9 * 30 * ONE_DAY_IN_SECONDS;
    const TWELVE_MONTHS_IN_SECONDS = 12 * 30 * ONE_DAY_IN_SECONDS;

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');

    const stakingStartTimestamp = (await time.latest()) + ONE_DAY_IN_SECONDS;
    const stakingDuration = THREE_MONTHS_IN_SECONDS;
    const totalReward = parseEther('1000');

    const wlthBonusStaking = (await deployProxy(
      'WlthBonusStaking',
      [owner.address, wlth.address, communityFund.address, stakingStartTimestamp, stakingDuration, totalReward],
      deployer
    )) as WlthBonusStaking;

    wlth.balanceOf.returns(totalReward);
    wlth.transfer.returns(true);
    wlth.transferFrom.returns(true);

    return {
      deployer,
      owner,
      communityFund,
      user1,
      user2,
      wlth,
      stakingStartTimestamp,
      stakingDuration,
      totalReward,
      wlthBonusStaking,
      ONE_DAY_IN_SECONDS,
      THREE_MONTHS_IN_SECONDS,
      SIX_MONTHS_IN_SECONDS,
      NINE_MONTHS_IN_SECONDS,
      TWELVE_MONTHS_IN_SECONDS
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with initial params', async () => {
        const { wlthBonusStaking, owner, wlth, communityFund, stakingStartTimestamp, stakingDuration, totalReward } =
          await loadFixture(deployWlthBonusStaking);

        expect(await wlthBonusStaking.wlth()).to.equal(wlth.address);
        expect(await wlthBonusStaking.communityFund()).to.equal(communityFund.address);
        expect(await wlthBonusStaking.owner()).to.equal(owner.address);

        const stakingInfo = await wlthBonusStaking.stakingInfo();
        expect(stakingInfo.stakingStartTimestamp).to.equal(stakingStartTimestamp);
        expect(stakingInfo.stakingEndTimestamp).to.equal(stakingStartTimestamp + stakingDuration);
        expect(stakingInfo.totalReward).to.equal(totalReward);
        expect(stakingInfo.totalStaked).to.equal(0);
      });

      it('Should deploy if the staking start timestamp is 0', async () => {
        const { wlthBonusStaking, owner, deployer, wlth, communityFund, stakingDuration, totalReward } =
          await loadFixture(deployWlthBonusStaking);

        const wlthBonusContract = (await deployProxy(
          'WlthBonusStaking',
          [owner.address, wlth.address, communityFund.address, 0, stakingDuration, totalReward],
          deployer
        )) as WlthBonusStaking;

        const stakingInfo = await wlthBonusContract.stakingInfo();
        expect(stakingInfo.stakingStartTimestamp).to.equal(0);
        expect(stakingInfo.stakingEndTimestamp).to.equal(0);
      });
    });

    describe('Reverts', () => {
      it("Should revert if the owner's address is the zero address", async () => {
        const { wlthBonusStaking, wlth, deployer, communityFund, stakingStartTimestamp, stakingDuration, totalReward } =
          await loadFixture(deployWlthBonusStaking);

        await expect(
          deployProxy(
            'WlthBonusStaking',
            [
              constants.AddressZero,
              wlth.address,
              communityFund.address,
              stakingStartTimestamp,
              stakingDuration,
              totalReward
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__OwnerAccountZeroAddress');
      });

      it("Should revert if the wlth's address is the zero address", async () => {
        const {
          wlthBonusStaking,
          owner,
          deployer,
          communityFund,
          stakingStartTimestamp,
          stakingDuration,
          totalReward
        } = await loadFixture(deployWlthBonusStaking);

        await expect(
          deployProxy(
            'WlthBonusStaking',
            [
              owner.address,
              constants.AddressZero,
              communityFund.address,
              stakingStartTimestamp,
              stakingDuration,
              totalReward
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WlthZeroAddress');
      });

      it("Should revert if the communityFund's address is the zero address", async () => {
        const { wlthBonusStaking, owner, deployer, wlth, stakingStartTimestamp, stakingDuration, totalReward } =
          await loadFixture(deployWlthBonusStaking);

        await expect(
          deployProxy(
            'WlthBonusStaking',
            [owner.address, wlth.address, constants.AddressZero, stakingStartTimestamp, stakingDuration, totalReward],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__CommunityFundZeroAddress');
      });

      it('Should revert if the total rewards is 0', async () => {
        const { wlthBonusStaking, owner, deployer, wlth, communityFund, stakingStartTimestamp, stakingDuration } =
          await loadFixture(deployWlthBonusStaking);

        await expect(
          deployProxy(
            'WlthBonusStaking',
            [owner.address, wlth.address, communityFund.address, stakingStartTimestamp, stakingDuration, 0],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WrongTotalRewardValue');
      });

      it('Should revert if the staking start timestamp is greater than 0 and lower then current timestamp', async () => {
        const { wlthBonusStaking, owner, deployer, wlth, communityFund, totalReward, stakingDuration } =
          await loadFixture(deployWlthBonusStaking);

        await expect(
          deployProxy(
            'WlthBonusStaking',
            [owner.address, wlth.address, communityFund.address, 1, stakingDuration, totalReward],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WrongStakingStartTimestamp');
      });

      it('Should revert if the staking duration is 0 and staking start timestamp is greater then current timestamp', async () => {
        const { wlthBonusStaking, owner, deployer, wlth, communityFund, totalReward, stakingStartTimestamp } =
          await loadFixture(deployWlthBonusStaking);

        await expect(
          deployProxy(
            'WlthBonusStaking',
            [owner.address, wlth.address, communityFund.address, stakingStartTimestamp, 0, totalReward],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WrongStakingDuration');
      });

      it("Should revert when reinitializing the contract's params", async () => {
        const {
          wlthBonusStaking,
          owner,
          deployer,
          wlth,
          communityFund,
          stakingStartTimestamp,
          stakingDuration,
          totalReward
        } = await loadFixture(deployWlthBonusStaking);

        await expect(
          wlthBonusStaking.initialize(
            owner.address,
            wlth.address,
            communityFund.address,
            stakingStartTimestamp,
            stakingDuration,
            totalReward
          )
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('Stake', () => {
    describe('Success', () => {
      it('Should stake successfully', async () => {
        const { wlthBonusStaking, user1, wlth, stakingStartTimestamp, communityFund } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');
        const fee = amount.div(100);
        const amountAfterFee = amount.sub(fee);
        wlth.transferFrom.returns(true);

        await time.increaseTo(stakingStartTimestamp);

        await expect(wlthBonusStaking.connect(user1).stake(amount))
          .to.emit(wlthBonusStaking, 'Staked')
          .withArgs(user1.address, amountAfterFee, fee, amountAfterFee);

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

        expect(rewardInfo.staked).to.equal(amountAfterFee);
        expect(rewardInfo.maxReward).to.equal(0);
        expect(rewardInfo.penalty).to.equal(0);
        expect(rewardInfo.rewardAfterPenalty).to.equal(0);

        const stakingInfo = await wlthBonusStaking.stakingInfo();
        expect(stakingInfo.totalStaked).to.equal(amountAfterFee);

        expect(wlth.transferFrom).to.be.calledWith(user1.address, wlthBonusStaking.address, amountAfterFee);
        expect(wlth.transferFrom).to.be.calledWith(user1.address, communityFund.address, fee);
      });

      it('Should add stake successfully', async () => {
        const { wlthBonusStaking, user1, wlth, stakingStartTimestamp } = await loadFixture(deployWlthBonusStaking);

        const amount = parseEther('100');
        const fee = amount.div(100);
        const amountAfterFee = amount.sub(fee);
        wlth.transferFrom.returns(true);

        await time.increaseTo(stakingStartTimestamp);
        await wlthBonusStaking.connect(user1).stake(amount);

        await expect(wlthBonusStaking.connect(user1).stake(amount))
          .to.emit(wlthBonusStaking, 'Staked')
          .withArgs(user1.address, amountAfterFee, fee, amountAfterFee.mul(2));

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

        expect(rewardInfo.staked).to.equal(amountAfterFee.mul(2));
        expect(rewardInfo.maxReward).to.equal(0);
        expect(rewardInfo.penalty).to.equal(0);
        expect(rewardInfo.rewardAfterPenalty).to.equal(0);

        const stakingInfo = await wlthBonusStaking.stakingInfo();
        expect(stakingInfo.totalStaked).to.equal(amountAfterFee.mul(2));
      });

      it('Should second user stake successfully', async () => {
        const { wlthBonusStaking, user1, user2, wlth, stakingStartTimestamp } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');
        const fee = amount.div(100);
        const amountAfterFee = amount.sub(fee);
        wlth.transferFrom.returns(true);

        await time.increaseTo(stakingStartTimestamp);
        await wlthBonusStaking.connect(user1).stake(amount);

        await expect(wlthBonusStaking.connect(user2).stake(amount))
          .to.emit(wlthBonusStaking, 'Staked')
          .withArgs(user2.address, amountAfterFee, fee, amountAfterFee);

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user2.address);

        expect(rewardInfo.staked).to.equal(amountAfterFee);
        expect(rewardInfo.maxReward).to.equal(0);
        expect(rewardInfo.penalty).to.equal(0);
        expect(rewardInfo.rewardAfterPenalty).to.equal(0);

        const stakingInfo = await wlthBonusStaking.stakingInfo();
        expect(stakingInfo.totalStaked).to.equal(amountAfterFee.mul(2));
      });
    });
    describe('Reverts', () => {
      it('Should revert if the staking is not started yet', async () => {
        const { wlthBonusStaking, user1 } = await loadFixture(deployWlthBonusStaking);

        const amount = parseEther('100');

        await expect(wlthBonusStaking.connect(user1).stake(amount)).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__StakingPeriodNotActive'
        );
      });

      it('Should revert if the amount is 0', async () => {
        const { wlthBonusStaking, user1, stakingStartTimestamp } = await loadFixture(deployWlthBonusStaking);

        await time.increaseTo(stakingStartTimestamp);

        await expect(wlthBonusStaking.connect(user1).stake(0)).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__CannotStakeZeroTokens'
        );
      });

      it("Should revert if the staking start timestamp hasn't been set", async () => {
        const { deployer, user1, owner, wlth, communityFund, stakingDuration, totalReward } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');

        const wlthBonusContract = (await deployProxy(
          'WlthBonusStaking',
          [owner.address, wlth.address, communityFund.address, 0, stakingDuration, totalReward],
          deployer
        )) as WlthBonusStaking;

        await expect(wlthBonusContract.connect(user1).stake(amount)).to.be.revertedWithCustomError(
          wlthBonusContract,
          'WlthBonusStaking__StakingPeriodNotActive'
        );
      });

      it('Should revert if the staking is ended', async () => {
        const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');

        await time.increaseTo(stakingStartTimestamp + stakingDuration);

        await expect(wlthBonusStaking.connect(user1).stake(amount)).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__StakingPeriodNotActive'
        );
      });
    });
  });

  describe('Unstake', () => {
    describe('Success', () => {
      it('Should unstake successfully', async () => {
        const { wlthBonusStaking, user1, wlth, stakingStartTimestamp, communityFund } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');
        const stakedFee = amount.div(100);
        const stakedAmountAfterFee = amount.sub(stakedFee);
        const unstakedFee = stakedAmountAfterFee.div(100);
        const unstakedAmountAfterFee = stakedAmountAfterFee.sub(unstakedFee);

        wlth.transferFrom.returns(true);

        await time.increaseTo(stakingStartTimestamp);
        await wlthBonusStaking.connect(user1).stake(amount);

        await expect(wlthBonusStaking.connect(user1).unstake())
          .to.emit(wlthBonusStaking, 'Unstaked')
          .withArgs(user1.address, unstakedAmountAfterFee, unstakedFee);

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

        expect(rewardInfo.staked).to.equal(0);
        expect(rewardInfo.maxReward).to.equal(0);
        expect(rewardInfo.penalty).to.equal(0);
        expect(rewardInfo.rewardAfterPenalty).to.equal(0);

        const stakingInfo = await wlthBonusStaking.stakingInfo();
        expect(stakingInfo.totalStaked).to.equal(0);

        expect(wlth.transfer).to.be.calledWith(user1.address, unstakedAmountAfterFee);
        expect(wlth.transfer).to.be.calledWith(communityFund.address, unstakedFee);
      });
    });
    describe('Reverts', () => {
      it("Should revert if staking hasn't started yet", async () => {
        const { wlthBonusStaking, user1 } = await loadFixture(deployWlthBonusStaking);

        await expect(wlthBonusStaking.connect(user1).unstake()).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__StakingPeriodNotActive'
        );
      });

      it('Should revert if the staking period has ended', async () => {
        const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration } = await loadFixture(
          deployWlthBonusStaking
        );

        await time.increaseTo(stakingStartTimestamp + stakingDuration);

        await expect(wlthBonusStaking.connect(user1).unstake()).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__StakingPeriodNotActive'
        );
      });

      it("Should revert if the staking start timestamp hasn't been set", async () => {
        const { deployer, user1, owner, wlth, communityFund, stakingDuration, totalReward } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');

        const wlthBonusContract = (await deployProxy(
          'WlthBonusStaking',
          [owner.address, wlth.address, communityFund.address, 0, stakingDuration, totalReward],
          deployer
        )) as WlthBonusStaking;

        await expect(wlthBonusContract.connect(user1).unstake()).to.be.revertedWithCustomError(
          wlthBonusContract,
          'WlthBonusStaking__StakingPeriodNotActive'
        );
      });

      it("Should revert if the user hasn't staked yet", async () => {
        const { wlthBonusStaking, user1, stakingStartTimestamp } = await loadFixture(deployWlthBonusStaking);

        await time.increaseTo(stakingStartTimestamp);

        await expect(wlthBonusStaking.connect(user1).unstake()).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__NoStakedTokens'
        );
      });
    });
  });

  describe('Set staking schedule', () => {
    describe('Success', () => {
      it('Should set staking schedule successfully', async () => {
        const { wlth, communityFund, totalReward, deployer, owner, stakingStartTimestamp, stakingDuration } =
          await loadFixture(deployWlthBonusStaking);

        const wlthBonusContract = (await deployProxy(
          'WlthBonusStaking',
          [owner.address, wlth.address, communityFund.address, 0, stakingDuration, totalReward],
          deployer
        )) as WlthBonusStaking;

        const stakingEndTimestamp = stakingStartTimestamp + stakingDuration;

        await expect(wlthBonusContract.connect(owner).setStakingSchedule(stakingStartTimestamp, stakingDuration))
          .to.emit(wlthBonusContract, 'StakingScheduleSet')
          .withArgs(stakingStartTimestamp, stakingEndTimestamp);

        const stakingInfo = await wlthBonusContract.stakingInfo();
        expect(stakingInfo.stakingStartTimestamp).to.equal(stakingStartTimestamp);
        expect(stakingInfo.stakingEndTimestamp).to.equal(stakingEndTimestamp);
      });
    });
    describe('Reverts', () => {
      it("Should revert when call not by the owner's address", async () => {
        const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration } = await loadFixture(
          deployWlthBonusStaking
        );

        await expect(
          wlthBonusStaking.connect(user1).setStakingSchedule(stakingStartTimestamp, stakingDuration)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert if staking start timestamp is 0', async () => {
        const { wlthBonusStaking, owner, stakingDuration } = await loadFixture(deployWlthBonusStaking);

        await expect(
          wlthBonusStaking.connect(owner).setStakingSchedule(0, stakingDuration)
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WrongStakingStartTimestamp');
      });

      it('Should revert if staking start timestamp less than the current timestamp', async () => {
        const { wlthBonusStaking, owner, stakingDuration } = await loadFixture(deployWlthBonusStaking);

        await expect(
          wlthBonusStaking.connect(owner).setStakingSchedule(1, stakingDuration)
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WrongStakingStartTimestamp');
      });

      it('Should revert if staking duration is 0', async () => {
        const { wlthBonusStaking, owner, stakingStartTimestamp } = await loadFixture(deployWlthBonusStaking);

        await expect(
          wlthBonusStaking.connect(owner).setStakingSchedule(stakingStartTimestamp, 0)
        ).to.be.revertedWithCustomError(wlthBonusStaking, 'WlthBonusStaking__WrongStakingDuration');
      });
    });
  });

  describe('Calculate reward info', () => {
    it('Should return empty state if a user has no staked tokens', async () => {
      const { wlthBonusStaking, user1 } = await loadFixture(deployWlthBonusStaking);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(0);
      expect(rewardInfo.maxReward).to.equal(0);
      expect(rewardInfo.penalty).to.equal(0);
      expect(rewardInfo.rewardAfterPenalty).to.equal(0);
    });

    it("Should return only staked value if the staking peried hasn't ended yet", async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp } = await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(0);
      expect(rewardInfo.penalty).to.equal(0);
      expect(rewardInfo.rewardAfterPenalty).to.equal(0);
    });

    it('Should return info with 100% penalty if just after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward } = await loadFixture(
        deployWlthBonusStaking
      );

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward);
      expect(rewardInfo.rewardAfterPenalty).to.equal(0);
    });

    it('Should return info with 100% penalty if just before 3 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, THREE_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + THREE_MONTHS_IN_SECONDS - 1);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward);
      expect(rewardInfo.rewardAfterPenalty).to.equal(0);
    });

    it('Should return info with 75% penalty if 3 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, THREE_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + THREE_MONTHS_IN_SECONDS);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward.div(4).mul(3));
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward.div(4));
    });

    it('Should return info with 75% penalty if just before 6 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, SIX_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + SIX_MONTHS_IN_SECONDS - 1);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward.div(4).mul(3));
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward.div(4));
    });

    it('Should return info with 50% penalty if 6 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, SIX_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + SIX_MONTHS_IN_SECONDS);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward.div(2));
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward.div(2));
    });

    it('Should return info with 50% penalty if just before 9 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, NINE_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + NINE_MONTHS_IN_SECONDS - 1);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward.div(2));
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward.div(2));
    });

    it('Should return info with 25% penalty if 9 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, NINE_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + NINE_MONTHS_IN_SECONDS);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward.div(4));
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward.div(4).mul(3));
    });

    it('Should return info with 25% penalty if just before 12 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, TWELVE_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + TWELVE_MONTHS_IN_SECONDS - 1);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(totalReward.div(4));
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward.div(4).mul(3));
    });

    it('Should return info with 0% penalty if 12 months after staking period ended', async () => {
      const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration, totalReward, TWELVE_MONTHS_IN_SECONDS } =
        await loadFixture(deployWlthBonusStaking);

      const amount = parseEther('100');
      const fee = amount.div(100);
      const amountAfterFee = amount.sub(fee);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + TWELVE_MONTHS_IN_SECONDS);

      const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

      expect(rewardInfo.staked).to.equal(amountAfterFee);
      expect(rewardInfo.maxReward).to.equal(totalReward);
      expect(rewardInfo.penalty).to.equal(0);
      expect(rewardInfo.rewardAfterPenalty).to.equal(totalReward);
    });

    it("Should calculate reward proportionally to the user's staked amount", async () => {
      const {
        wlthBonusStaking,
        user1,
        user2,
        stakingStartTimestamp,
        stakingDuration,
        totalReward,
        TWELVE_MONTHS_IN_SECONDS
      } = await loadFixture(deployWlthBonusStaking);

      const amount1 = parseEther('100');
      const fee1 = amount1.div(100);
      const amountAfterFee1 = amount1.sub(fee1);

      const amount2 = parseEther('200');
      const fee2 = amount2.div(100);
      const amountAfterFee2 = amount2.sub(fee2);

      await time.increaseTo(stakingStartTimestamp);
      await wlthBonusStaking.connect(user1).stake(amount1);
      await wlthBonusStaking.connect(user2).stake(amount2);

      await time.increaseTo(stakingStartTimestamp + stakingDuration + TWELVE_MONTHS_IN_SECONDS);

      const rewardInfo1 = await wlthBonusStaking.calculateRewardInfo(user1.address);
      const rewardInfo2 = await wlthBonusStaking.calculateRewardInfo(user2.address);

      expect(rewardInfo1.staked).to.equal(amountAfterFee1);
      expect(rewardInfo1.maxReward).to.equal(totalReward.div(3));
      expect(rewardInfo1.penalty).to.equal(0);
      expect(rewardInfo1.rewardAfterPenalty).to.equal(totalReward.div(3));

      expect(rewardInfo2.staked).to.equal(amountAfterFee2);
      expect(rewardInfo2.maxReward).to.equal(totalReward.div(3).mul(2));
      expect(rewardInfo2.penalty).to.equal(0);
      expect(rewardInfo2.rewardAfterPenalty).to.equal(totalReward.div(3).mul(2));
    });
  });

  describe('Should claim reward', () => {
    describe('Success', () => {
      it("Should claim the user's reward successfully", async () => {
        const {
          wlthBonusStaking,
          wlth,
          user1,
          stakingStartTimestamp,
          stakingDuration,
          TWELVE_MONTHS_IN_SECONDS,
          communityFund
        } = await loadFixture(deployWlthBonusStaking);

        const amount = parseEther('100');
        const fee = amount.div(100);

        await time.increaseTo(stakingStartTimestamp);
        await wlthBonusStaking.connect(user1).stake(amount);

        await time.increaseTo(stakingStartTimestamp + stakingDuration + TWELVE_MONTHS_IN_SECONDS);

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);
        const rewardFee = rewardInfo.rewardAfterPenalty.div(100);
        const penaltyFee = rewardInfo.penalty.div(100);

        await expect(wlthBonusStaking.connect(user1).claimReward())
          .to.emit(wlthBonusStaking, 'RewardsClaimed')
          .withArgs(
            user1.address,
            rewardInfo.staked,
            rewardInfo.rewardAfterPenalty.sub(rewardFee),
            rewardInfo.penalty.sub(penaltyFee),
            rewardFee,
            penaltyFee
          );

        const rewardInfoAfterClaim = await wlthBonusStaking.calculateRewardInfo(user1.address);
        expect(rewardInfoAfterClaim.staked).to.equal(0);
        expect(rewardInfoAfterClaim.maxReward).to.equal(0);
        expect(rewardInfoAfterClaim.penalty).to.equal(0);
        expect(rewardInfoAfterClaim.rewardAfterPenalty).to.equal(0);

        expect(wlth.transfer).to.be.calledWith(user1.address, rewardInfo.rewardAfterPenalty.sub(rewardFee));
        expect(wlth.transfer).to.be.calledWith(user1.address, rewardInfo.staked);
        expect(wlth.transfer).to.be.calledWith(communityFund.address, rewardFee.add(penaltyFee));
      });

      it("Should claim the user's reward successfully with penalty", async () => {
        const {
          wlthBonusStaking,
          wlth,
          user1,
          stakingStartTimestamp,
          stakingDuration,
          SIX_MONTHS_IN_SECONDS,
          communityFund
        } = await loadFixture(deployWlthBonusStaking);

        const amount = parseEther('100');
        const fee = amount.div(100);

        await time.increaseTo(stakingStartTimestamp);
        await wlthBonusStaking.connect(user1).stake(amount);

        await time.increaseTo(stakingStartTimestamp + stakingDuration + SIX_MONTHS_IN_SECONDS);

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);
        const rewardFee = rewardInfo.rewardAfterPenalty.div(100);
        const penaltyFee = rewardInfo.penalty.div(100);

        await expect(wlthBonusStaking.connect(user1).claimReward())
          .to.emit(wlthBonusStaking, 'RewardsClaimed')
          .withArgs(
            user1.address,
            rewardInfo.staked,
            rewardInfo.rewardAfterPenalty.sub(rewardFee),
            rewardInfo.penalty.sub(penaltyFee),
            rewardFee,
            penaltyFee
          );

        const rewardInfoAfterClaim = await wlthBonusStaking.calculateRewardInfo(user1.address);
        expect(rewardInfoAfterClaim.staked).to.equal(0);
        expect(rewardInfoAfterClaim.maxReward).to.equal(0);
        expect(rewardInfoAfterClaim.penalty).to.equal(0);
        expect(rewardInfoAfterClaim.rewardAfterPenalty).to.equal(0);

        expect(wlth.transfer).to.be.calledWith(user1.address, rewardInfo.rewardAfterPenalty.sub(rewardFee));
        expect(wlth.transfer).to.be.calledWith(user1.address, rewardInfo.staked);
        expect(wlth.transfer).to.be.calledWith(communityFund.address, rewardFee.add(penaltyFee));
        expect(wlth.burn).to.be.calledWith(rewardInfo.penalty.sub(penaltyFee));
      });

      it('Should claim 0 if stake was really small compared to the total stake', async () => {
        const {
          wlthBonusStaking,
          wlth,
          user1,
          user2,
          stakingStartTimestamp,
          stakingDuration,
          totalReward,
          SIX_MONTHS_IN_SECONDS,
          communityFund
        } = await loadFixture(deployWlthBonusStaking);

        const amount1 = ethers.BigNumber.from(10);
        const fee1 = amount1.div(100);
        const amountAfterFee1 = amount1.sub(fee1);

        const amount2 = parseEther('100000');
        const fee2 = amount2.div(100);
        const amountAfterFee2 = amount2.sub(fee2);

        await time.increaseTo(stakingStartTimestamp);
        await wlthBonusStaking.connect(user1).stake(amount1);
        await wlthBonusStaking.connect(user2).stake(amount2);

        await time.increaseTo(stakingStartTimestamp + stakingDuration + SIX_MONTHS_IN_SECONDS);

        const rewardInfo = await wlthBonusStaking.calculateRewardInfo(user1.address);

        await expect(wlthBonusStaking.connect(user1).claimReward())
          .to.emit(wlthBonusStaking, 'RewardsClaimed')
          .withArgs(user1.address, rewardInfo.staked, 0, 0, 0, 0);
      });
    });

    describe('Reverts', () => {
      it('Should revert if the staking period has not ended yet', async () => {
        const { wlthBonusStaking, user1 } = await loadFixture(deployWlthBonusStaking);

        await expect(wlthBonusStaking.connect(user1).claimReward()).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__ClaimRewardPeriodNotActive'
        );
      });

      it("Should revert if the staking start timestamp hasn't been set", async () => {
        const { deployer, user1, owner, wlth, communityFund, stakingDuration, totalReward } = await loadFixture(
          deployWlthBonusStaking
        );

        const amount = parseEther('100');

        const wlthBonusContract = (await deployProxy(
          'WlthBonusStaking',
          [owner.address, wlth.address, communityFund.address, 0, stakingDuration, totalReward],
          deployer
        )) as WlthBonusStaking;

        await expect(wlthBonusContract.connect(user1).claimReward()).to.be.revertedWithCustomError(
          wlthBonusContract,
          'WlthBonusStaking__ClaimRewardPeriodNotActive'
        );
      });

      it('Should revert if a user has no stake', async () => {
        const { wlthBonusStaking, user1, stakingStartTimestamp, stakingDuration } = await loadFixture(
          deployWlthBonusStaking
        );

        await time.increaseTo(stakingStartTimestamp + stakingDuration);

        await expect(wlthBonusStaking.connect(user1).claimReward()).to.be.revertedWithCustomError(
          wlthBonusStaking,
          'WlthBonusStaking__NoStakedTokens'
        );
      });
    });
  });
});
