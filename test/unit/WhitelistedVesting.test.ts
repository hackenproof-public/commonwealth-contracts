import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { WhitelistedVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe('Whitelisted vesting unit tests', () => {
  const TWELVE_BILIONS = '12000000';
  const SECONDS_IN_YEAR = 31536000;
  const ONE_YEAR = SECONDS_IN_YEAR;
  const ONE_MONTH = Math.floor(SECONDS_IN_YEAR / 12);
  const ONE_SECOND = 1;
  const ONE_TOKEN = toWlth('1');
  const allocation = toWlth('69600000');
  const duration = ONE_MONTH * 19;
  const cadence = ONE_MONTH;
  const gamification = true;
  const tokenReleaseDistribution = [
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('0'),
    toWlth('6960000'),
    toWlth('12180000'),
    toWlth('17400000'),
    toWlth('22620000'),
    toWlth('27840000'),
    toWlth('33060000'),
    toWlth('38280000'),
    toWlth('43500000'),
    toWlth('48720000'),
    toWlth('53940000'),
    toWlth('59160000'),
    toWlth('64380000'),
    toWlth('69600000')
  ];

  const deploySimpleVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
    const leftoversUnlockDelay = vestingStartTimestamp + duration + ONE_YEAR;

    const [deployer, beneficiary1, beneficiary2, owner, communityFund] = await ethers.getSigners();
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const whitelistedVesting: WhitelistedVesting = await deploy(
      'WhitelistedVesting',
      [
        gamification,
        owner.address,
        wlth.address,
        communityFund.address,
        allocation,
        duration,
        cadence,
        leftoversUnlockDelay,
        vestingStartTimestamp,
        tokenReleaseDistribution
      ],
      deployer
    );

    //await whitelistedVesting.connect(owner).setVestingStartTimestamp(vestingStartTimestamp);

    return {
      owner,
      whitelistedVesting,
      wlth,
      deployer,
      allocation,
      duration,
      cadence,
      vestingStartTimestamp,
      gamification,
      beneficiary1,
      beneficiary2,
      tokenReleaseDistribution
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { whitelistedVesting, owner, wlth, allocation, duration, cadence, vestingStartTimestamp, gamification } =
        await loadFixture(deploySimpleVesting);

      expect(await whitelistedVesting.wlth()).to.equal(wlth.address);
      expect(await whitelistedVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await whitelistedVesting.allocation()).to.equal(allocation);
      expect(await whitelistedVesting.duration()).to.equal(duration);
      expect(await whitelistedVesting.cadence()).to.equal(cadence);
    });
  });

  describe('getReleasableAmount()', () => {
    it('Should return no releaseable tokens if timestamp before vesting start', async () => {
      const { whitelistedVesting, wlth, vestingStartTimestamp, allocation, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(0);
    });

    it('Should not return releaseable tokens after first cadence from vesting start moment', async () => {
      const { whitelistedVesting, vestingStartTimestamp, wlth, allocation, beneficiary1, cadence } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + cadence);
      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('0'));
    });

    it('Should release first tokens after 6 months cliff', async () => {
      const { whitelistedVesting, cadence, vestingStartTimestamp, wlth, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + 7 * cadence);

      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('6960000'));
    });

    it('Should return whole token allocation at duration pass moment', async () => {
      const { whitelistedVesting, duration, vestingStartTimestamp, wlth, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + duration);

      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('69600000'));
    });
  });

  describe('whitelisted wallet setup', () => {
    it('Should setup whitelisted wallet before vesting start', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, wlth, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      const allocation = toWlth('69600000');

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6960000'),
        toWlth('12180000'),
        toWlth('17400000'),
        toWlth('22620000'),
        toWlth('27840000'),
        toWlth('33060000'),
        toWlth('38280000'),
        toWlth('43500000'),
        toWlth('48720000'),
        toWlth('53940000'),
        toWlth('59160000'),
        toWlth('64380000'),
        toWlth('69600000')
      ];

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      );
    });
  });

  describe('release()', () => {
    it('Should not release tokens before vesting time', async () => {
      const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth } = await loadFixture(deploySimpleVesting);
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

      await expect(
        whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__VestingNotStarted');
    });

    // it('Should equally release tokens between whitelisted addresses within vesting time', async () => {
    //   const {
    //     whitelistedVesting,
    //     vestingStartTimestamp,
    //     beneficiary1,
    //     beneficiary2,
    //     cadence,
    //     wlth,
    //     allocation,
    //     duration,
    //     owner
    //   } = await loadFixture(deploySimpleVesting);
    //   wlth.transfer.returns(true);
    //   await whitelistedVesting.connect(owner).addAddressToWhitelist(beneficiary2.address);
    //   expect(await whitelistedVesting.connect(owner).whitelistedAddressesAmount()).to.equal(2);
    //   wlth.balanceOf.returns(allocation);

    //   await time.increaseTo(vestingStartTimestamp + cadence);
    //   expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('500000'));
    //   await whitelistedVesting.connect(beneficiary1).release(toWlth('500000'), beneficiary1.address);
    //   await whitelistedVesting.connect(beneficiary2).release(toWlth('500000'), beneficiary2.address);
    //   expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('1000000'));
    //   expect(await whitelistedVesting.connect(beneficiary1).amountReleasedByAddress(beneficiary1.address)).to.equal(
    //     toWlth('500000')
    //   );

    //   await time.increaseTo(vestingStartTimestamp + 2 * cadence);
    //   await whitelistedVesting.connect(beneficiary1).release(toWlth('500000'), beneficiary1.address);
    //   expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('1500000'));

    //   await time.increaseTo(vestingStartTimestamp + duration);
    //   await whitelistedVesting.connect(beneficiary1).release(toWlth('11000000'), beneficiary1.address);
    //   expect(await whitelistedVesting.connect(beneficiary2).releaseableAmount()).to.equal(toWlth('11500000'));
    //   expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('12500000'));
    // });

    it('Should revert releasing tokens if not enough vested', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        wlth,
        owner,
        tokenReleaseDistribution,
        allocation
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await expect(
        whitelistedVesting.connect(beneficiary1).release(toWlth('1000000').add(ONE_TOKEN), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__NotEnoughTokensVested');
    });

    it('Should revert releasing tokens if not beneficiary (has no tokens allocated)', async () => {
      const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth, deployer } = await loadFixture(
        deploySimpleVesting
      );
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      await time.increaseTo(vestingStartTimestamp);

      await expect(
        whitelistedVesting.connect(deployer).release(toWlth('1000000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__NotEnoughTokensAllocated');
    });

    it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        wlth,
        cadence,
        owner,
        tokenReleaseDistribution,
        allocation
      } = await loadFixture(deploySimpleVesting);
      wlth.balanceOf.returns(0);
      wlth.transfer.returns(true);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 6);

      await expect(
        whitelistedVesting.connect(beneficiary1).release(toWlth('6960000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__NotEnoughTokensOnContract');
    });

    it('Should revert releasing tokens if transfer fails', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        wlth,
        owner,
        allocation,
        tokenReleaseDistribution
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(false);
      wlth.balanceOf.returns(allocation);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      await expect(
        whitelistedVesting.connect(beneficiary1).release(toWlth('100000'), beneficiary1.address)
      ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
    });

    it('Should release tokens within vesting time', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        cadence,
        wlth,
        owner,
        duration,
        tokenReleaseDistribution,
        allocation
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      await whitelistedVesting.connect(beneficiary1).release(toWlth('100000'), beneficiary1.address);
      expect(wlth.transfer.atCall(0)).to.have.been.calledWith(beneficiary1.address, toWlth('100000'));
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('100000'));

      await time.increaseTo(vestingStartTimestamp + cadence * 8);
      await whitelistedVesting.connect(beneficiary1).release(toWlth('300000'), beneficiary1.address);
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('400000'));

      await time.increaseTo(vestingStartTimestamp + duration);
      await whitelistedVesting.connect(beneficiary1).release(toWlth('1700000'), beneficiary1.address);
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('2100000'));
    });
  });

  describe('releaseWithPenalty()', () => {
    it('Should revert function execution when gamification is not enabled', async () => {
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
      const leftoversUnlockDelay = ONE_YEAR;

      const [deployer, beneficiary1, beneficiary2, owner, communityFund] = await ethers.getSigners();
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const whitelistedVesting: WhitelistedVesting = await deploy(
        'WhitelistedVesting',
        [
          false,
          owner.address,
          wlth.address,
          communityFund.address,
          allocation,
          duration,
          cadence,
          leftoversUnlockDelay,
          0,
          tokenReleaseDistribution
        ],
        deployer
      );
      wlth.balanceOf.returns(allocation);
      await whitelistedVesting.connect(owner).setVestingStartTimestamp(vestingStartTimestamp);
      await time.increaseTo(vestingStartTimestamp);

      await expect(
        whitelistedVesting.connect(beneficiary1).releaseWithPenalty(toWlth('1000000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__GamificationNotEnabled');
    });

    it('Should not release tokens before vesting time', async () => {
      const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth } = await loadFixture(deploySimpleVesting);
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

      await expect(
        whitelistedVesting.connect(beneficiary1).releaseWithPenalty(toWlth('1000000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__VestingNotStarted');
    });

    it('Should revert releasing tokens if not beneficiary (has no tokens allocated)', async () => {
      const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth, deployer } = await loadFixture(
        deploySimpleVesting
      );
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      await time.increaseTo(vestingStartTimestamp);

      await expect(
        whitelistedVesting.connect(deployer).releaseWithPenalty(toWlth('1000000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__NotEnoughTokensAllocated');
    });

    it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        wlth,
        cadence,
        owner,
        tokenReleaseDistribution,
        allocation
      } = await loadFixture(deploySimpleVesting);
      wlth.balanceOf.returns(0);
      wlth.transfer.returns(true);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 6);

      await expect(
        whitelistedVesting.connect(beneficiary1).releaseWithPenalty(toWlth('6960000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__NotEnoughTokensOnContract');
    });

    it('Should revert releasing tokens if transfer fails', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        wlth,
        owner,
        allocation,
        tokenReleaseDistribution
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(false);
      wlth.balanceOf.returns(allocation);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 6);
      await expect(
        whitelistedVesting.connect(beneficiary1).releaseWithPenalty(toWlth('100000'), beneficiary1.address)
      ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
    });

    it('Should release tokens within vesting time with penalty', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        cadence,
        wlth,
        owner,
        duration,
        tokenReleaseDistribution,
        allocation
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );
      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(toWlth('10000000'), beneficiary1.address);
      expect(wlth.transfer).to.have.been.calledWith(beneficiary1.address, toWlth('10000000').sub(toWlth('1536000')));
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('10000000'));
      /*
        Penalty calculations for this case:
        equantion: penalty = slashpool * maxPenalty * (cadencesAmount - actualCadence) / cadencesAmount
        vested = 6960000
        slashpool = 10000000 - 6960000 = 3040000
        penalty = 3040000*0.8*13/19 = 1664000
      */
    });

    it('Should release all tokens after vesting duration time without penalty', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        wlth,
        owner,
        duration,
        tokenReleaseDistribution,
        allocation
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(true);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + duration);
      await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(allocation, beneficiary1.address);
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(allocation);
      expect(await wlth.connect(owner).balanceOf(beneficiary1.address)).to.equal(allocation);
    });
  });

  describe('Whitelist management', () => {
    it('Should revert if non-owner address try to perform whitelist management action', async () => {
      const { whitelistedVesting, deployer } = await loadFixture(deploySimpleVesting);
      const [newBenefitiary1] = await ethers.getSigners();

      await expect(whitelistedVesting.connect(deployer).deactivateAddress(newBenefitiary1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should remove single address from the whitelist', async () => {
      const { whitelistedVesting, owner, beneficiary1, allocation, tokenReleaseDistribution, vestingStartTimestamp } =
        await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
      expect(await whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address));
    });
  });
});
