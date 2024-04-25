import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
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
  const ONE_WEEK = 604800;
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
      tokenReleaseDistribution,
      communityFund,
      leftoversUnlockDelay
    };
  };

  describe('Deployment', () => {
    it('Should revert deployment if owner is zero address', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
          'WhitelistedVesting',
          [
            gamification,
            constants.AddressZero,
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
        )
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__OwnerZeroAddress');
    });

    it('Should revert deployment if wlth is zero address', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
          'WhitelistedVesting',
          [
            gamification,
            owner.address,
            constants.AddressZero,
            communityFund.address,
            allocation,
            duration,
            cadence,
            leftoversUnlockDelay,
            vestingStartTimestamp,
            tokenReleaseDistribution
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__WlthZeroAddress');
    });

    it('Should revert deployment if community fund is zero address', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
          'WhitelistedVesting',
          [
            gamification,
            owner.address,
            wlth.address,
            constants.AddressZero,
            allocation,
            duration,
            cadence,
            leftoversUnlockDelay,
            vestingStartTimestamp,
            tokenReleaseDistribution
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__CommunityFundZeroAddress');
    });

    it('Should revert deployment if community fund is zero address', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
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
            1,
            tokenReleaseDistribution
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__PastVestingStartTimestamp');
    });

    it('Should revert deployment if invalid distribution table length', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);

      const newTokenReleaseDistribution = [
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

      await expect(
        deploy(
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
            newTokenReleaseDistribution
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayLength');
    });

    it('Should revert deployment if last item of distribution array does not match the allocation', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);

      const newTokenReleaseDistribution = [
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
        toWlth('69600000').sub(toWlth('1'))
      ];

      await expect(
        deploy(
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
            newTokenReleaseDistribution
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should deploy and return initial parameters', async () => {
      const {
        whitelistedVesting,
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay
      } = await loadFixture(deploySimpleVesting);

      expect(await whitelistedVesting.wlth()).to.equal(wlth.address);
      expect(await whitelistedVesting.owner()).to.equal(owner.address);
      expect(await whitelistedVesting.communityFund()).to.equal(communityFund.address);
      expect(await whitelistedVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await whitelistedVesting.allocation()).to.equal(allocation);
      expect(await whitelistedVesting.duration()).to.equal(duration);
      expect(await whitelistedVesting.cadence()).to.equal(cadence);
      expect(await whitelistedVesting.gamification()).to.equal(gamification);
      expect(await whitelistedVesting.tokenReleaseDistribution()).to.deep.equal(tokenReleaseDistribution);
      expect(await whitelistedVesting.leftoversUnlockDelay()).to.equal(leftoversUnlockDelay);
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
    it('Should revert setup whitelisted wallet due to invalid distribution array length', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const allocation = toWlth('69600000');

      const distribution = [
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

      await expect(
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayLength');
    });

    it('Should revert setup if new wallet total allocation along with the rest of setted up wallets allocation exceed total contract allocation', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1, beneficiary2 } = await loadFixture(
        deploySimpleVesting
      );
      const allocationBeneficiary1 = toWlth('69600000');
      const allocationBeneficiary2 = toWlth('1000');

      // covers total contract allocation entirely
      const distributionBeneficiary1 = [
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

      const distributionBeneficiary2 = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('1000'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0')
      ];

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocationBeneficiary1, distributionBeneficiary1);

      await expect(
        whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocationBeneficiary2, distributionBeneficiary2)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__TotalAllocationMismatch');
    });

    it('Should revert setup due to mismatch of declared wallet allocation and given distribution array', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);
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
        allocation.sub(toWlth('1'))
      ];

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await expect(
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__TotalAllocationPerWalletMismatch');
    });

    it('Should revert setup due to too large cadence allocation of one of the elements', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);
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
        toWlth('64380000').add(toWlth('1')),
        allocation
      ];

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await expect(
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__TotalAllocationPerCadenceMismatch');
    });

    it('Should revert if called by not owner', async () => {
      const { whitelistedVesting, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const allocation = toWlth('69600000');

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('1'),
        toWlth('0'),
        toWlth('69599999'),
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

      await expect(
        whitelistedVesting.connect(beneficiary1).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should setup whitelisted wallet before vesting start', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const allocation = toWlth('69600000');
      const addressesAmount = await whitelistedVesting.connect(owner).whitelistedAddressesAmount();

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
      )
        .to.emit(whitelistedVesting, 'WhitelistedAddressesAmountChanged')
        .withArgs(addressesAmount, addressesAmount.add(1));
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

    it('Should not release tokens if vestingStartTimestamp not set', async () => {
      const {
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        gamification,
        communityFund,
        tokenReleaseDistribution,
        vestingStartTimestamp,
        leftoversUnlockDelay,
        deployer,
        beneficiary1
      } = await loadFixture(deploySimpleVesting);

      const whitelistedVesting = await deploy(
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
          0,
          tokenReleaseDistribution
        ],
        deployer
      );

      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + cadence * 10);

      await expect(
        whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__VestingNotStarted');
    });

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
      const { whitelistedVesting, vestingStartTimestamp, beneficiary1, cadence, wlth, owner, allocation } =
        await loadFixture(deploySimpleVesting);

      const tokenReleaseDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('1000'),
        toWlth('20000')
      ];

      const walletAllocation = toWlth('20000');
      /*
        Penalty calculations for this case:
        equantion: penalty = slashpool * maxPenalty * (cadencesAmount - actualCadence) / cadencesAmount
        vested = 1000
        slashpool = 20000 - 1000 = 19000 as for penalty feature this will release whole allocation
        penalty = 19000*0.8*12/19 = 9600
      */
      const expectedPenalty = toWlth('9600');

      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, walletAllocation, tokenReleaseDistribution)
      );
      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      expect(await whitelistedVesting.connect(beneficiary1).penalty(walletAllocation, beneficiary1.address)).to.equal(
        expectedPenalty
      );
      expect(await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(toWlth('1000'), beneficiary1.address))
        .to.emit(whitelistedVesting, 'Released')
        .withArgs(beneficiary1.address, walletAllocation, expectedPenalty);
      expect(wlth.transfer).to.have.been.calledWith(beneficiary1.address, walletAllocation.sub(expectedPenalty));
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(walletAllocation);
      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmountPerWallet(beneficiary1.address)).to.equal(
        0
      );
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

  describe('Contract management', () => {
    it('Should revert vestingStartTimestamp when not called by owner', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);

      const newVestingStartTimestamp = vestingStartTimestamp + ONE_MONTH;

      await expect(
        whitelistedVesting.connect(beneficiary1).setVestingStartTimestamp(newVestingStartTimestamp)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert vestingStartTimestamp has been set already', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newVestingStartTimestamp = vestingStartTimestamp + ONE_MONTH;

      await expect(
        whitelistedVesting.connect(owner).setVestingStartTimestamp(newVestingStartTimestamp)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__VestingStartTimestampAlreadyDefined');
    });

    it('Should revert setting vestingStartTimestamp lower than block timestamp (past)', async () => {
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
      await time.increaseTo(vestingStartTimestamp + 1);

      await expect(
        whitelistedVesting.connect(owner).setVestingStartTimestamp(vestingStartTimestamp)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__PastVestingStartTimestamp');
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

    it('Should revert when deactivate a wallet which already claimed with penalty', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        owner,
        beneficiary1,
        wlth,
        allocation,
        tokenReleaseDistribution
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      expect(
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + 1);
      await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(allocation, beneficiary1.address);

      await expect(
        whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__WalletClaimedWithPenalty');
    });

    it('Should revert when resetup a wallet which already claimed with penalty', async () => {
      const { whitelistedVesting, vestingStartTimestamp, owner, beneficiary1, wlth } = await loadFixture(
        deploySimpleVesting
      );
      wlth.transfer.returns(true);
      const allocation = toWlth('100');
      wlth.balanceOf.returns(allocation);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      const secondAllocation = toWlth('200');
      const secondDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('200')
      ];

      expect(
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      );

      await time.increaseTo(vestingStartTimestamp + 1);
      await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(allocation, beneficiary1.address);

      await expect(
        whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, secondAllocation, secondDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__WalletClaimedWithPenalty');
    });

    it('Should revert when setup wallet and cadane lower then previous', async () => {
      const { whitelistedVesting, vestingStartTimestamp, owner, beneficiary1, wlth } = await loadFixture(
        deploySimpleVesting
      );
      wlth.transfer.returns(true);
      const allocation = toWlth('100');
      wlth.balanceOf.returns(allocation);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('50'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await expect(
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should remove single address from the whitelist before vesting start', async () => {
      const { whitelistedVesting, owner, beneficiary1, allocation, tokenReleaseDistribution, vestingStartTimestamp } =
        await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - 10 * ONE_SECOND);

      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);

      const addressesAmount = await whitelistedVesting.connect(owner).whitelistedAddressesAmount();
      expect(await whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address))
        .to.emit(whitelistedVesting, 'WhitelistedAddressesAmountChanged')
        .withArgs(addressesAmount, addressesAmount.add(1));
    });

    it('Should remove single address from the whitelist during vesting', async () => {
      const { whitelistedVesting, owner, beneficiary1, allocation, tokenReleaseDistribution, vestingStartTimestamp } =
        await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);

      await time.increaseTo(vestingStartTimestamp + cadence * 8);

      const addressesAmount = await whitelistedVesting.connect(owner).whitelistedAddressesAmount();
      expect(await whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address))
        .to.emit(whitelistedVesting, 'WhitelistedAddressesAmountChanged')
        .withArgs(addressesAmount, addressesAmount.add(1));
    });

    it('Should remove single address from the whitelist before vesting starts', async () => {
      const { whitelistedVesting, owner, beneficiary1, allocation, tokenReleaseDistribution, vestingStartTimestamp } =
        await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - 3 * ONE_SECOND);

      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const addressesAmount = await whitelistedVesting.connect(owner).whitelistedAddressesAmount();
      expect(await whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address))
        .to.emit(whitelistedVesting, 'WhitelistedAddressesAmountChanged')
        .withArgs(addressesAmount, addressesAmount.add(1));
    });

    it('Should revert if try to set wallet allocation for past cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('99');
      const allocation = toWlth('100');
      const cadenceNumber = 7; // end of cadence 6 means start of cadence 7
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * (cadenceNumber + 1)); // moving to start of cadence 8

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__PastCadenceModificationNotAllowed');
    });

    it('Should revert if try to set wallet allocation for a wallet which already claimed with penalty', async () => {
      const { wlth, whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );

      const newAmount = toWlth('51');
      const allocation = toWlth('100');
      const cadenceNumber = 7;
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('50'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);
      await time.increaseTo(vestingStartTimestamp);

      await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(allocation, beneficiary1.address);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__WalletClaimedWithPenalty');
    });

    it('Should revert if max cadence and amount lower then previous', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('1');
      const allocation = toWlth('100');
      const cadenceNumber = 19;

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('50'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadanceWalletAllocation');
    });

    it('Should revert if cadence between fist and last and amount lower then previous', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('1');
      const allocation = toWlth('100');
      const cadenceNumber = 8;

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('50'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadanceWalletAllocation');
    });

    it('Should revert if cadence between fist and last and amount higher then next', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('101');
      const allocation = toWlth('100');
      const cadenceNumber = 8;

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('50'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadanceWalletAllocation');
    });

    it('Should revert if first cadence amount lower then next', async () => {
      const {
        wlth,
        communityFund,
        leftoversUnlockDelay,
        vestingStartTimestamp,
        allocation,
        deployer,
        owner,
        beneficiary1
      } = await loadFixture(deploySimpleVesting);

      const adjustedTokenReleaseDistribution = [
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
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
          adjustedTokenReleaseDistribution
        ],
        deployer
      );

      const newAmount = toWlth('1');
      const userAllocation = toWlth('100');
      const cadenceNumber = 0;

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('50'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, userAllocation, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadanceWalletAllocation');
    });

    it('Should revert if try to set wallet allocation for past cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('6960001'); // total avaiable allocation for this cadence + 1
      const allocation = toWlth('100');
      const cadenceNumber = 7; // end of cadence 6 means start of cadence 7
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__TotalAllocationPerCadenceMismatch');
    });

    it('Should revert if set wallet allocation for cadence not called by owner', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('99');
      const allocation = toWlth('100');
      const cadenceNumber = 7; // end of cadence 6 means start of cadence 7
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber);

      await expect(
        whitelistedVesting
          .connect(beneficiary1)
          .setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should decrease wallet allocation for specific cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('50');
      const allocation = toWlth('100');
      const cadenceNumber = 7; // end of cadence 6 means start of cadence 7
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber);

      expect(
        await whitelistedVesting
          .connect(owner)
          .setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      )
        .to.emit(whitelistedVesting, 'CadenceAllocationForWalletChanged')
        .withArgs(beneficiary1.address, cadenceNumber, newAmount);
    });

    it('Should increase wallet allocation for specific cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('200');
      const allocation = toWlth('100');
      const cadenceNumber = 19; // end of cadence 6 means start of cadence 7
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      expect(
        await whitelistedVesting
          .connect(owner)
          .setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      )
        .to.emit(whitelistedVesting, 'CadenceAllocationForWalletChanged')
        .withArgs(beneficiary1.address, cadenceNumber, newAmount);
    });

    it('Should decrease wallet allocation for specific cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

      const newAmount = toWlth('99');
      const allocation = toWlth('100');
      const cadenceNumber = 7; // end of cadence 6 means start of cadence 7
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      const distribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100'),
        toWlth('100')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, allocation, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber);

      expect(
        await whitelistedVesting
          .connect(owner)
          .setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      )
        .to.emit(whitelistedVesting, 'CadenceAllocationForWalletChanged')
        .withArgs(beneficiary1.address, cadenceNumber, newAmount);
    });
  });

  describe('Contract related getters', () => {
    it('Should return amount of WLTH tokens released by contract', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);

      expect(await whitelistedVesting.connect(owner).released()).to.equal(0);
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper vested WLTH amount [' + value + '] by contract at based on actual block timestamp',
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
            await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).vestedAmount()).to.equal(value);
        }
      );
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper vested WLTH amount [' +
          value +
          '] by contract at the beginning of given cadence ' +
          index,
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
            await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).vestedAmountToCadence(index)).to.equal(value);
        }
      );
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it('Should return proper releasable WLTH amount by contract at the beginning of cadence ' + index, async () => {
        const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
          await loadFixture(deploySimpleVesting);
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
        time.increaseTo(vestingStartTimestamp + cadence * index);

        expect(await whitelistedVesting.connect(owner).releaseableAmount()).to.equal(value);
      });
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it('Should return proper cadence number [' + value + '] for respective block timestamp', async () => {
        const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
          await loadFixture(deploySimpleVesting);
        await whitelistedVesting
          .connect(owner)
          .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
        time.increaseTo(vestingStartTimestamp + cadence * index);

        expect(await whitelistedVesting.connect(owner).actualCadence()).to.equal(index);
      });
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper WLTH allocation [' + value + '] by given address at the beginning of cadence ' + index,
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1 } = await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);

          expect(
            await whitelistedVesting.connect(owner).walletAllocationForCadence(beneficiary1.address, index)
          ).to.equal(value);
        }
      );
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper releasable WLTH amount [' +
          value +
          '] by given address at the beginning of cadence ' +
          index,
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
            await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).releaseableAmountPerWallet(beneficiary1.address)).to.equal(
            value
          );
        }
      );
    });
  });

  describe('Wallet related getters', () => {
    it('Should return whitelisted addresses amount', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);

      expect(await whitelistedVesting.connect(owner).whitelistedAddressesAmount()).to.equal(0);
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper WLTH allocation [' + value + '] by given address at the beginning of cadence ' + index,
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1 } = await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);

          expect(
            await whitelistedVesting.connect(owner).walletAllocationForCadence(beneficiary1.address, index)
          ).to.equal(value);
        }
      );
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper releasable WLTH amount [' +
          value +
          '] by given address at the beginning of cadence ' +
          index,
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
            await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).releaseableAmountPerWallet(beneficiary1.address)).to.equal(
            value
          );
        }
      );
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper vested WLTH amount [' + value + '] by given address at the beginning of cadence ' + index,
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
            await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(value);
        }
      );
    });

    it('Should return zero vested WLTH amount by given address before vesting start ', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
      time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(0);
    });

    it('Should return zero vested WLTH amount by given address before vesting start ', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
      time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(0);
    });

    it('Should return zero vested WLTH amount by given address before vesting start ', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting
        .connect(owner)
        .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);
      time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(0);
    });

    it('Should revert penalty calculation if contract not gamified', async () => {
      const {
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        deployer,
        beneficiary1
      } = await loadFixture(deploySimpleVesting);

      const whitelistedVesting = await deploy(
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

      await expect(
        whitelistedVesting.connect(beneficiary1).calculatePenalty(toWlth('1'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__GamificationNotEnabled');
    });

    it('Should revert penalty calculation before vesting start timestamp', async () => {
      const {
        owner,
        wlth,
        allocation,
        duration,
        cadence,
        communityFund,
        tokenReleaseDistribution,
        leftoversUnlockDelay,
        vestingStartTimestamp,
        deployer,
        beneficiary1
      } = await loadFixture(deploySimpleVesting);

      const whitelistedVesting = await deploy(
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
          0,
          tokenReleaseDistribution
        ],
        deployer
      );

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await expect(
        whitelistedVesting.connect(beneficiary1).calculatePenalty(toWlth('1'), beneficiary1.address)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__VestingNotStarted');
    });

    it('Should calculate penalty', async () => {
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
      expect(
        await whitelistedVesting.connect(beneficiary1).calculatePenalty(toWlth('10000000'), beneficiary1.address)
      ).to.equal(toWlth('1536000'));

      /*
        Penalty calculations for this case:
        equantion: penalty = slashpool * maxPenalty * (cadencesAmount - actualCadence) / cadencesAmount
        vested = 6960000
        slashpool = 10000000 - 6960000 = 3040000
        penalty = 3040000*0.8*12/19 = 1536000
      */ 0;
    });
  });

  describe('Leftovers withdraw', () => {
    describe('Success', () => {
      it("Should withdraw all wlth from the contract's balance", async () => {
        const {
          whitelistedVesting,
          owner,
          wlth,
          allocation,
          leftoversUnlockDelay,
          vestingStartTimestamp,
          duration,
          beneficiary2,
          beneficiary1
        } = await loadFixture(deploySimpleVesting);
        wlth.transferFrom.reset();
        wlth.transfer.reset();
        wlth.transfer(whitelistedVesting.address, allocation);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);

        // await whitelistedVesting
        //     .connect(owner)
        //     .whitelistedWalletSetup(beneficiary1.address, allocation, tokenReleaseDistribution);

        // await time.increaseTo(vestingStartTimestamp + 7 * cadence);
        // await whitelistedVesting.connect(beneficiary1).release(toWlth('6960000'), beneficiary1.address);

        await time.increaseTo(vestingStartTimestamp + duration + leftoversUnlockDelay);

        await expect(whitelistedVesting.connect(owner).withdrawLeftovers(beneficiary2.address))
          .to.emit(whitelistedVesting, 'LeftoversWithdrawn')
          .withArgs(beneficiary2.address, allocation);

        expect(wlth.transfer).to.have.been.calledWith(beneficiary2.address, allocation);
      });
    });

    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { whitelistedVesting, beneficiary1 } = await loadFixture(deploySimpleVesting);

        await expect(
          whitelistedVesting.connect(beneficiary1).withdrawLeftovers(beneficiary1.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when locked', async () => {
        const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);

        await expect(whitelistedVesting.connect(owner).withdrawLeftovers(owner.address)).to.be.revertedWithCustomError(
          whitelistedVesting,
          'WhitelistedVesting__LeftoversWithdrawalLocked'
        );
      });

      it('Should revert when locked due to not setted vesting start timestamp', async () => {
        const {
          owner,
          wlth,
          allocation,
          duration,
          cadence,
          gamification,
          communityFund,
          tokenReleaseDistribution,
          leftoversUnlockDelay,
          deployer
        } = await loadFixture(deploySimpleVesting);

        const whitelistedVesting = await deploy(
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
            0,
            tokenReleaseDistribution
          ],
          deployer
        );

        await expect(whitelistedVesting.connect(owner).withdrawLeftovers(owner.address)).to.be.revertedWithCustomError(
          whitelistedVesting,
          'WhitelistedVesting__LeftoversWithdrawalLocked'
        );
      });
    });
  });

  describe('Surplus withdraw', () => {
    describe('Success', () => {
      it('Should withdraw surplus from the contract', async () => {
        const { whitelistedVesting, owner, wlth, allocation, beneficiary2 } = await loadFixture(deploySimpleVesting);

        const surplus = toWlth('1000');
        wlth.balanceOf.reset();
        wlth.balanceOf.whenCalledWith(whitelistedVesting.address).returns(allocation.add(surplus));

        await expect(whitelistedVesting.connect(owner).withdrawSurplus(beneficiary2.address))
          .to.emit(whitelistedVesting, 'SurplusWithdrawn')
          .withArgs(beneficiary2.address, surplus);

        expect(wlth.transfer).to.have.been.calledWith(beneficiary2.address, surplus);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { whitelistedVesting, beneficiary1 } = await loadFixture(deploySimpleVesting);

        await expect(whitelistedVesting.connect(beneficiary1).withdrawSurplus(beneficiary1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when no surplus', async () => {
        const { whitelistedVesting, owner, wlth, allocation, beneficiary2 } = await loadFixture(deploySimpleVesting);
        wlth.balanceOf.reset();
        wlth.balanceOf.whenCalledWith(whitelistedVesting.address).returns(allocation);

        await expect(whitelistedVesting.connect(owner).withdrawSurplus(beneficiary2.address))
          .to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__NoSurplus')
          .withArgs(allocation, 0, allocation);
      });
    });
  });
});
