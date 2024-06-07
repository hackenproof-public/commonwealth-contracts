import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
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
    const whitelistedVesting: WhitelistedVesting = await deployProxy(
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
        deployProxy(
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
      ).to.be.revertedWithCustomError(whitelistedVesting, 'OwnablePausable__OwnerAccountZeroAddress');
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
        deployProxy(
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
        deployProxy(
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
        deployProxy(
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
        deployProxy(
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
        deployProxy(
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

    it('Should revert when initialize again', async () => {
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

      await expect(
        whitelistedVesting.initialize(
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
        )
      ).to.be.revertedWith('Initializable: contract is already initialized');
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
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution)
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
        toWlth('1000')
      ];

      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distributionBeneficiary1);

      await expect(
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distributionBeneficiary2)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__TotalAllocationMismatch');
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
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution)
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
        whitelistedVesting.connect(beneficiary1).whitelistedWalletSetup(beneficiary1.address, distribution)
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

      expect(await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution))
        .to.emit(whitelistedVesting, 'WhitelistedWalletSetup')
        .withArgs(beneficiary1.address, allocation, distribution);
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

      const whitelistedVesting = await deployProxy(
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 7);

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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      await whitelistedVesting.connect(beneficiary1).release(toWlth('100000'), beneficiary1.address);
      expect(wlth.transfer.atCall(0)).to.have.been.calledWith(beneficiary1.address, toWlth('100000'));
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('100000'));
      expect(await whitelistedVesting.connect(beneficiary1).releasedAmountPerWallet(beneficiary1.address)).to.equal(
        toWlth('100000')
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 8);
      await whitelistedVesting.connect(beneficiary1).release(toWlth('300000'), beneficiary1.address);
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('400000'));
      expect(await whitelistedVesting.connect(beneficiary1).releasedAmountPerWallet(beneficiary1.address)).to.equal(
        toWlth('400000')
      );

      await time.increaseTo(vestingStartTimestamp + duration);
      await whitelistedVesting.connect(beneficiary1).release(toWlth('1700000'), beneficiary1.address);
      expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('2100000'));
      expect(await whitelistedVesting.connect(beneficiary1).releasedAmountPerWallet(beneficiary1.address)).to.equal(
        toWlth('2100000')
      );
    });
  });

  describe('releaseWithPenalty()', () => {
    it('Should revert function execution when gamification is not enabled', async () => {
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
      const leftoversUnlockDelay = ONE_YEAR;

      const [deployer, beneficiary1, beneficiary2, owner, communityFund] = await ethers.getSigners();
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const whitelistedVesting: WhitelistedVesting = await deployProxy(
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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
      const whitelistedVesting: WhitelistedVesting = await deployProxy(
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

    it('Should revert decrease contract allocation when not called by owner', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total reduction by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6955000'),
        toWlth('12185000'),
        toWlth('17395000'), // missing previous cadence element
        toWlth('22615000'),
        toWlth('27835000'),
        toWlth('33055000'),
        toWlth('38275000'),
        toWlth('43495000'),
        toWlth('48715000'),
        toWlth('53935000'),
        toWlth('59155000'),
        toWlth('64375000'),
        toWlth('69595000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'),
        toWlth('12180000'),
        toWlth('17390000'),
        toWlth('22610000'),
        toWlth('27830000'),
        toWlth('33050000'),
        toWlth('38270000'),
        toWlth('43490000'),
        toWlth('48710000'),
        toWlth('53930000'),
        toWlth('59150000'),
        toWlth('64370000'),
        toWlth('69590000')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated

      await expect(
        whitelistedVesting.connect(beneficiary1).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert decrease contract allocation due to too short array', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total reduction by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6955000'),
        toWlth('17395000'), // missing previous cadence element
        toWlth('22615000'),
        toWlth('27835000'),
        toWlth('33055000'),
        toWlth('38275000'),
        toWlth('43495000'),
        toWlth('48715000'),
        toWlth('53935000'),
        toWlth('59155000'),
        toWlth('64375000'),
        toWlth('69595000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'),
        toWlth('12170000'),
        toWlth('17390000'),
        toWlth('22610000'),
        toWlth('27830000'),
        toWlth('33050000'),
        toWlth('38270000'),
        toWlth('43490000'),
        toWlth('48710000'),
        toWlth('53930000'),
        toWlth('59150000'),
        toWlth('64370000'),
        toWlth('69590000')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated

      await expect(
        whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayLength');
    });

    it('Should revert decrease contract allocation due to cadence below actual allocation for given cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('49999'), // cadence allocation lower than actual amount of token already allocated to wallets for this cadence
        toWlth('12185000'),
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69599000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000'), // contract corresponding allocation - 10000 WLTH
        toWlth('50000') // contract corresponding allocation - 10000 WLTH
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated

      await expect(
        whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should revert decrease contract allocation if new allocation for cadence is bigger than actual one', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('12180001'), // bigger cadence allocation than actual one
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69599000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'), // contract corresponding allocation - 10000 WLTH
        toWlth('12170000'), // contract corresponding allocation - 10000 WLTH
        toWlth('17390000'), // contract corresponding allocation - 10000 WLTH
        toWlth('22610000'), // contract corresponding allocation - 10000 WLTH
        toWlth('27830000'), // contract corresponding allocation - 10000 WLTH
        toWlth('33050000'), // contract corresponding allocation - 10000 WLTH
        toWlth('38270000'), // contract corresponding allocation - 10000 WLTH
        toWlth('43490000'), // contract corresponding allocation - 10000 WLTH
        toWlth('48710000'), // contract corresponding allocation - 10000 WLTH
        toWlth('53930000'), // contract corresponding allocation - 10000 WLTH
        toWlth('59150000'), // contract corresponding allocation - 10000 WLTH
        toWlth('64370000'), // contract corresponding allocation - 10000 WLTH
        toWlth('69590000') // contract corresponding allocation - 10000 WLTH
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated

      await expect(
        whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should revert decrease contract allocation due to array inconsistency', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6500000'),
        toWlth('6000000'), // next cadence cannot have lower allocation than previous one
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69599000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000'),
        toWlth('10000')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated

      await expect(
        whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should revert decrease contract allocation due to incorrect total allocation', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('12185000'),
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('70000000') // total allocation higher than actual one (69600000)
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'), // contract corresponding allocation - 10000 WLTH
        toWlth('12170000'), // contract corresponding allocation - 10000 WLTH
        toWlth('17390000'), // contract corresponding allocation - 10000 WLTH
        toWlth('22610000'), // contract corresponding allocation - 10000 WLTH
        toWlth('27830000'), // contract corresponding allocation - 10000 WLTH
        toWlth('33050000'), // contract corresponding allocation - 10000 WLTH
        toWlth('38270000'), // contract corresponding allocation - 10000 WLTH
        toWlth('43490000'), // contract corresponding allocation - 10000 WLTH
        toWlth('48710000'), // contract corresponding allocation - 10000 WLTH
        toWlth('53930000'), // contract corresponding allocation - 10000 WLTH
        toWlth('59150000'), // contract corresponding allocation - 10000 WLTH
        toWlth('64370000'), // contract corresponding allocation - 10000 WLTH
        toWlth('69590000') // contract corresponding allocation - 10000 WLTH
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated

      await expect(
        whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidTotalAllocation');
    });

    it('Should revert decrease contract allocation due to higher cadence compared to actual allocation', async () => {
      const { whitelistedVesting, owner, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('13185000'), // cadence with too high allocation compared to actual contract allocation (12185000)
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69599000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'), // contract corresponding allocation - 10000 WLTH
        toWlth('12170000'), // contract corresponding allocation - 10000 WLTH
        toWlth('17390000'), // contract corresponding allocation - 10000 WLTH
        toWlth('22610000'), // contract corresponding allocation - 10000 WLTH
        toWlth('27830000'), // contract corresponding allocation - 10000 WLTH
        toWlth('33050000'), // contract corresponding allocation - 10000 WLTH
        toWlth('38270000'), // contract corresponding allocation - 10000 WLTH
        toWlth('43490000'), // contract corresponding allocation - 10000 WLTH
        toWlth('48710000'), // contract corresponding allocation - 10000 WLTH
        toWlth('53930000'), // contract corresponding allocation - 10000 WLTH
        toWlth('59150000'), // contract corresponding allocation - 10000 WLTH
        toWlth('64370000'), // contract corresponding allocation - 10000 WLTH
        toWlth('69590000') // contract corresponding allocation - 10000 WLTH
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);

      await expect(
        whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should decrease contract allocation', async () => {
      const {
        whitelistedVesting,
        owner,
        beneficiary1,
        tokenReleaseDistribution,
        wlth,
        vestingStartTimestamp,
        cadence
      } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total reduction by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6955000'),
        toWlth('12175000'),
        toWlth('17395000'),
        toWlth('22615000'),
        toWlth('27835000'),
        toWlth('33055000'),
        toWlth('38275000'),
        toWlth('43495000'),
        toWlth('48715000'),
        toWlth('53935000'),
        toWlth('59155000'),
        toWlth('64375000'),
        toWlth('69595000')
      ];

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'), // contract corresponding allocation - 10000 WLTH
        toWlth('12170000'), // contract corresponding allocation - 10000 WLTH
        toWlth('17390000'), // contract corresponding allocation - 10000 WLTH
        toWlth('22610000'), // contract corresponding allocation - 10000 WLTH
        toWlth('27830000'), // contract corresponding allocation - 10000 WLTH
        toWlth('33050000'), // contract corresponding allocation - 10000 WLTH
        toWlth('38270000'), // contract corresponding allocation - 10000 WLTH
        toWlth('43490000'), // contract corresponding allocation - 10000 WLTH
        toWlth('48710000'), // contract corresponding allocation - 10000 WLTH
        toWlth('53930000'), // contract corresponding allocation - 10000 WLTH
        toWlth('59150000'), // contract corresponding allocation - 10000 WLTH
        toWlth('64370000'), // contract corresponding allocation - 10000 WLTH
        toWlth('69590000') // contract corresponding allocation - 10000 WLTH
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);
      // there is 10000 WLTH unallocated
      wlth.balanceOf.returns(toWlth('10000'));
      wlth.transfer.returns(true);

      expect(await whitelistedVesting.connect(owner).decreaseAllocation(newTokenReleaseDistribution))
        .to.emit(whitelistedVesting, 'AllocationDecreased')
        .withArgs(tokenReleaseDistribution, newTokenReleaseDistribution);

      await time.increaseTo(vestingStartTimestamp + cadence * 8);
      expect(whitelistedVesting.connect(beneficiary1).release(toWlth('10000'), beneficiary1.address));
    });

    it('Should revert increase contract allocation when not called by owner', async () => {
      const { whitelistedVesting, beneficiary1 } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('12185000'),
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69605000')
      ];

      await expect(
        whitelistedVesting.connect(beneficiary1).increaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert increase contract allocation due to too short array', async () => {
      const { whitelistedVesting, owner, tokenReleaseDistribution } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('12185000'), // missing previous cadence
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69605000')
      ];

      await expect(
        whitelistedVesting.connect(owner).increaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayLength');
    });

    it('Should revert increase contract allocation due to incorrect total allocation', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('12185000'),
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69500000') // total allocation lower than actual one (69600000)
      ];

      await expect(
        whitelistedVesting.connect(owner).increaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidTotalAllocation');
    });

    it('Should revert increase contract allocation due to array inconsistency', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('12185000'), // next cadence cannot have lower allocation than previous one
        toWlth('6965000'),
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69605000')
      ];

      await expect(
        whitelistedVesting.connect(owner).increaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should revert increase contract allocation due to lower cadence compared to actual allocation', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('10185000'), // cadence with too low allocation compared to actual contract allocation (12185000)
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69605000')
      ];

      await expect(
        whitelistedVesting.connect(owner).increaseAllocation(newTokenReleaseDistribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should increase contract allocation', async () => {
      const {
        whitelistedVesting,
        owner,
        tokenReleaseDistribution,
        wlth,
        vestingStartTimestamp,
        cadence,
        beneficiary1
      } = await loadFixture(deploySimpleVesting);
      const newTokenReleaseDistribution = [
        // total increase by 5000 WLTH
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6965000'),
        toWlth('12185000'),
        toWlth('17405000'),
        toWlth('22625000'),
        toWlth('27845000'),
        toWlth('33065000'),
        toWlth('38285000'),
        toWlth('43505000'),
        toWlth('48725000'),
        toWlth('53945000'),
        toWlth('59165000'),
        toWlth('64385000'),
        toWlth('69605000')
      ];

      wlth.transfer.returns(true);
      wlth.balanceOf.returns(toWlth('100000'));

      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('6950000'), // contract corresponding allocation - 10000 WLTH
        toWlth('12170000'), // contract corresponding allocation - 10000 WLTH
        toWlth('17390000'), // contract corresponding allocation - 10000 WLTH
        toWlth('22610000'), // contract corresponding allocation - 10000 WLTH
        toWlth('27830000'), // contract corresponding allocation - 10000 WLTH
        toWlth('33050000'), // contract corresponding allocation - 10000 WLTH
        toWlth('38270000'), // contract corresponding allocation - 10000 WLTH
        toWlth('43490000'), // contract corresponding allocation - 10000 WLTH
        toWlth('48710000'), // contract corresponding allocation - 10000 WLTH
        toWlth('53930000'), // contract corresponding allocation - 10000 WLTH
        toWlth('59150000'), // contract corresponding allocation - 10000 WLTH
        toWlth('64370000'), // contract corresponding allocation - 10000 WLTH
        toWlth('69590000') // contract corresponding allocation - 10000 WLTH
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);

      expect(await whitelistedVesting.connect(owner).increaseAllocation(newTokenReleaseDistribution))
        .to.emit(whitelistedVesting, 'AllocationIncreased')
        .withArgs(tokenReleaseDistribution, newTokenReleaseDistribution);

      await time.increaseTo(vestingStartTimestamp + cadence * 8);
      expect(whitelistedVesting.connect(beneficiary1).release(toWlth('10000'), beneficiary1.address));
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
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

      expect(await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution));

      await time.increaseTo(vestingStartTimestamp + 1);
      await whitelistedVesting.connect(beneficiary1).releaseWithPenalty(allocation, beneficiary1.address);

      await expect(
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, secondDistribution)
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
        whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidDistributionArrayAllocation');
    });

    it('Should remove single address from the whitelist before vesting start', async () => {
      const { whitelistedVesting, owner, beneficiary1, allocation, tokenReleaseDistribution, vestingStartTimestamp } =
        await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - 10 * ONE_SECOND);

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);

      const addressesAmount = await whitelistedVesting.connect(owner).whitelistedAddressesAmount();
      expect(await whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address))
        .to.emit(whitelistedVesting, 'AddressDeactivated')
        .withArgs(beneficiary1.address, addressesAmount, addressesAmount.add(1));
    });

    it('Should remove single address from the whitelist during vesting', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);
      const walletAllocation = toWlth('2200');
      const walletDistribution = [
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('0'),
        toWlth('1000'),
        toWlth('1100'),
        toWlth('1200'),
        toWlth('1300'),
        toWlth('1400'),
        toWlth('1500'),
        toWlth('1600'),
        toWlth('1700'),
        toWlth('1800'),
        toWlth('1900'),
        toWlth('2000'),
        toWlth('2100'),
        toWlth('2200')
      ];

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, walletDistribution);

      await time.setNextBlockTimestamp(vestingStartTimestamp + cadence * 8);

      const addressesAmount = await whitelistedVesting.connect(owner).whitelistedAddressesAmount();
      expect(await whitelistedVesting.connect(owner).deactivateAddress(beneficiary1.address))
        .to.emit(whitelistedVesting, 'WhitelistedAddressesAmountChanged')
        .withArgs(addressesAmount, addressesAmount.add(1));

      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 8)
      ).to.equals(toWlth('1100')); // cannot revoke already given allocation
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 9)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 11)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 12)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 13)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 10)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 14)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 15)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 16)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 17)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 18)
      ).to.equals(toWlth('1100'));
      expect(
        await whitelistedVesting.connect(beneficiary1).walletAllocationForCadence(beneficiary1.address, 19)
      ).to.equals(toWlth('1100'));
    });

    it('Should remove single address from the whitelist before vesting starts', async () => {
      const { whitelistedVesting, owner, beneficiary1, allocation, tokenReleaseDistribution, vestingStartTimestamp } =
        await loadFixture(deploySimpleVesting);
      await time.increaseTo(vestingStartTimestamp - 3 * ONE_SECOND);

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);

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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * (cadenceNumber + 1)); // moving to start of cadence 8

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__PastCadenceModificationNotAllowed');
    });

    it('Should revert if try to set too large allocation for one of cadences', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp, allocation } = await loadFixture(
        deploySimpleVesting
      );

      const newAmount = toWlth('99');
      const walletAllocation = toWlth('100');
      const cadenceNumber = 18; // cadence before last one
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber); // moving to start of cadence 18

      await expect(
        whitelistedVesting
          .connect(owner)
          .setWalletAllocationForCadence(beneficiary1.address, cadenceNumber + 1, allocation.add(1))
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__TotalAllocationPerCadenceMismatch');
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadenceWalletAllocation');
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadenceWalletAllocation');
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadenceWalletAllocation');
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

      const whitelistedVesting: WhitelistedVesting = await deployProxy(
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__InvalidSingleCadenceWalletAllocation');
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__PastCadenceModificationNotAllowed');
    });

    it('Should revert if try to set the same allocation for specific cadence', async () => {
      const { whitelistedVesting, owner, beneficiary1, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * cadenceNumber);

      await expect(
        whitelistedVesting.connect(owner).setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, allocation)
      ).to.be.revertedWithCustomError(whitelistedVesting, 'WhitelistedVesting__SameWalletAllocationForCadenceProvided');
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

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
      const oldAmount = toWlth('100');
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      await time.increaseTo(vestingStartTimestamp + cadence * (cadenceNumber - 1));

      expect(
        await whitelistedVesting
          .connect(owner)
          .setWalletAllocationForCadence(beneficiary1.address, cadenceNumber, newAmount)
      )
        .to.emit(whitelistedVesting, 'CadenceAllocationForWalletChanged')
        .withArgs(beneficiary1.address, cadenceNumber, oldAmount, newAmount);
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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

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

    it('Should return total amount of WLTH allocated to whitelisted wallets', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);

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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      expect(await whitelistedVesting.connect(owner).totalWalletAllocation()).to.equal(toWlth('100'));
    });

    it('Should return total amount of WLTH allocated to whitelisted wallets', async () => {
      const { whitelistedVesting, owner, vestingStartTimestamp, beneficiary1 } = await loadFixture(deploySimpleVesting);

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

      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, distribution);

      expect(await whitelistedVesting.connect(owner).totalWalletAllocationInCadence(1)).to.equal(0);
      expect(await whitelistedVesting.connect(owner).totalWalletAllocationInCadence(7)).to.equal(toWlth('100'));
    });

    it('Should return zero vested WLTH amount before vesting start timestamp', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
      time.increaseTo(vestingStartTimestamp - 1);

      expect(await whitelistedVesting.connect(owner).vestedAmount()).to.equal(0);
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it(
        'Should return proper vested WLTH amount [' + value + '] by contract at based on actual block timestamp',
        async () => {
          const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
            await loadFixture(deploySimpleVesting);
          await whitelistedVesting
            .connect(owner)
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
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
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).vestedAmountToCadence(index)).to.equal(value);
        }
      );
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it('Should return proper releasable WLTH amount by contract at the beginning of cadence ' + index, async () => {
        const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
          await loadFixture(deploySimpleVesting);
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
        time.increaseTo(vestingStartTimestamp + cadence * index);

        expect(await whitelistedVesting.connect(owner).releaseableAmount()).to.equal(value);
      });
    });

    tokenReleaseDistribution.forEach((value, index) => {
      it('Should return proper cadence number [' + value + '] for respective block timestamp', async () => {
        const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp, cadence } =
          await loadFixture(deploySimpleVesting);
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
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
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);

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
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
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
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);

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
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
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
            .whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
          time.increaseTo(vestingStartTimestamp + cadence * index);

          expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(value);
        }
      );
    });

    it('Should return zero vested WLTH amount by given address before vesting start ', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
      time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(0);
    });

    it('Should return zero vested WLTH amount by given address before vesting start ', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
      time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(await whitelistedVesting.connect(owner).vestedAmountPerWallet(beneficiary1.address)).to.equal(0);
    });

    it('Should return zero vested WLTH amount by given address before vesting start ', async () => {
      const { whitelistedVesting, owner, allocation, beneficiary1, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution);
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

      const whitelistedVesting = await deployProxy(
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
        whitelistedVesting.connect(beneficiary1).penalty(toWlth('1'), beneficiary1.address)
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

      const whitelistedVesting = await deployProxy(
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
        whitelistedVesting.connect(beneficiary1).penalty(toWlth('1'), beneficiary1.address)
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
        await whitelistedVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, tokenReleaseDistribution)
      );
      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      expect(await whitelistedVesting.connect(beneficiary1).penalty(toWlth('10000000'), beneficiary1.address)).to.equal(
        toWlth('1536000')
      );

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

        const whitelistedVesting = await deployProxy(
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
  describe('Allocation groups setup check', () => {
    it('Should proper marketing setup group', async () => {
      const {
        whitelistedVesting,
        vestingStartTimestamp,
        beneficiary1,
        beneficiary2,
        wlth,
        owner,
        communityFund,
        leftoversUnlockDelay,
        deployer
      } = await loadFixture(deploySimpleVesting);
      wlth.transfer.returns(true);
      wlth.balanceOf.returns(allocation);

      const vestingParameters = {
        gamification: true,
        allocation: 92500000,
        duration: ONE_MONTH * 30,
        cadence: ONE_MONTH
      };

      const tokenReleaseDistribution = [
        // 1 month cliff, 30% unlock, 5 month cliff, 24 month linear vest
        toWlth('0'), //vesting start timestamp
        toWlth(((vestingParameters.allocation * 3) / 10).toString()), //end of cadence1
        toWlth(((vestingParameters.allocation * 3) / 10).toString()), //end of cadence2
        toWlth(((vestingParameters.allocation * 3) / 10).toString()), //end of cadence3
        toWlth(((vestingParameters.allocation * 3) / 10).toString()), //end of cadence4
        toWlth(((vestingParameters.allocation * 3) / 10).toString()), //end of cadence5
        toWlth(((vestingParameters.allocation * 3) / 10).toString()), //end of cadence6
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 1) / 240).toString()), //end of cadence7
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 2) / 240).toString()), //end of cadence8
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 3) / 240).toString()), //end of cadence9
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 4) / 240).toString()), //end of cadence10
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 5) / 240).toString()), //end of cadence11
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 6) / 240).toString()), //end of cadence12
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 7) / 240).toString()), //end of cadence13
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 8) / 240).toString()), //end of cadence14
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 9) / 240).toString()), //end of cadence15
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 10) / 240).toString()), //end of cadence16
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 11) / 240).toString()), //end of cadence17
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 12) / 240).toString()), //end of cadence18
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 13) / 240).toString()), //end of cadence19
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 14) / 240).toString()), //end of cadence20
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 15) / 240).toString()), //end of cadence21
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 16) / 240).toString()), //end of cadence22
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 17) / 240).toString()), //end of cadence23
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 18) / 240).toString()), //end of cadence24
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 19) / 240).toString()), //end of cadence25
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 20) / 240).toString()), //end of cadence26
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 21) / 240).toString()), //end of cadence27
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 22) / 240).toString()), //end of cadence28
        toWlth(((vestingParameters.allocation * 3) / 10 + (vestingParameters.allocation * 7 * 23) / 240).toString()), //end of cadence29
        toWlth(vestingParameters.allocation.toString()) //end of cadence30
      ];

      const wallet1Allocation = 1000000;
      const wallet1Distribution = [
        toWlth('0'), //vesting start timestamp
        toWlth(((wallet1Allocation * 3) / 10).toString()), //end of cadence1
        toWlth(((wallet1Allocation * 3) / 10).toString()), //end of cadence2
        toWlth(((wallet1Allocation * 3) / 10).toString()), //end of cadence3
        toWlth(((wallet1Allocation * 3) / 10).toString()), //end of cadence4
        toWlth(((wallet1Allocation * 3) / 10).toString()), //end of cadence5
        toWlth(((wallet1Allocation * 3) / 10).toString()), //end of cadence6
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 1) / 240).toString()), //end of cadence7
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 2) / 240).toString()), //end of cadence8
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 3) / 240).toString()), //end of cadence9
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 4) / 240).toString()), //end of cadence10
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 5) / 240).toString()), //end of cadence11
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 6) / 240).toString()), //end of cadence12
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 7) / 240).toString()), //end of cadence13
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 8) / 240).toString()), //end of cadence14
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 9) / 240).toString()), //end of cadence15
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 10) / 240).toString()), //end of cadence16
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 11) / 240).toString()), //end of cadence17
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 12) / 240).toString()), //end of cadence18
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 13) / 240).toString()), //end of cadence19
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 14) / 240).toString()), //end of cadence20
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 15) / 240).toString()), //end of cadence21
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 16) / 240).toString()), //end of cadence22
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 17) / 240).toString()), //end of cadence23
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 18) / 240).toString()), //end of cadence24
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 19) / 240).toString()), //end of cadence25
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 20) / 240).toString()), //end of cadence26
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 21) / 240).toString()), //end of cadence27
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 22) / 240).toString()), //end of cadence28
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 23) / 240).toString()), //end of cadence29
        toWlth(wallet1Allocation.toString()) //end of cadence30
      ];

      const wallet2Allocation = 2500000;
      const wallet2Distribution = [
        toWlth('0'), //vesting start timestamp
        toWlth(((wallet2Allocation * 3) / 10).toString()), //end of cadence1
        toWlth(((wallet2Allocation * 3) / 10).toString()), //end of cadence2
        toWlth(((wallet2Allocation * 3) / 10).toString()), //end of cadence3
        toWlth(((wallet2Allocation * 3) / 10).toString()), //end of cadence4
        toWlth(((wallet2Allocation * 3) / 10).toString()), //end of cadence5
        toWlth(((wallet2Allocation * 3) / 10).toString()), //end of cadence6
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 1) / 240).toString()), //end of cadence7
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 2) / 240).toString()), //end of cadence8
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 3) / 240).toString()), //end of cadence9
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 4) / 240).toString()), //end of cadence10
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 5) / 240).toString()), //end of cadence11
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 6) / 240).toString()), //end of cadence12
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 7) / 240).toString()), //end of cadence13
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 8) / 240).toString()), //end of cadence14
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 9) / 240).toString()), //end of cadence15
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 10) / 240).toString()), //end of cadence16
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 11) / 240).toString()), //end of cadence17
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 12) / 240).toString()), //end of cadence18
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 13) / 240).toString()), //end of cadence19
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 14) / 240).toString()), //end of cadence20
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 15) / 240).toString()), //end of cadence21
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 16) / 240).toString()), //end of cadence22
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 17) / 240).toString()), //end of cadence23
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 18) / 240).toString()), //end of cadence24
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 19) / 240).toString()), //end of cadence25
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 20) / 240).toString()), //end of cadence26
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 21) / 240).toString()), //end of cadence27
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 22) / 240).toString()), //end of cadence28
        toWlth(((wallet2Allocation * 3) / 10 + (wallet2Allocation * 7 * 23) / 240).toString()), //end of cadence29
        toWlth(wallet2Allocation.toString()) //end of cadence30
      ];

      const marketingVesting = await deployProxy(
        'WhitelistedVesting',
        [
          vestingParameters.gamification,
          owner.address,
          wlth.address,
          communityFund.address,
          toWlth(vestingParameters.allocation.toString()),
          vestingParameters.duration,
          vestingParameters.cadence,
          leftoversUnlockDelay,
          vestingStartTimestamp,
          tokenReleaseDistribution
        ],
        deployer
      );

      await marketingVesting.connect(owner).whitelistedWalletSetup(beneficiary1.address, wallet1Distribution);

      await marketingVesting.connect(owner).whitelistedWalletSetup(beneficiary2.address, wallet2Distribution);

      await time.increaseTo(vestingStartTimestamp + cadence);
      await marketingVesting
        .connect(beneficiary1)
        .release(toWlth(((wallet1Allocation * 3) / 10).toString()), beneficiary1.address);
      expect(await marketingVesting.connect(beneficiary1).released()).to.equal(
        toWlth(((wallet1Allocation * 3) / 10).toString())
      );

      await time.increaseTo(vestingStartTimestamp + cadence * 7);
      await marketingVesting
        .connect(beneficiary1)
        .release(
          toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 1) / 240).toString()).sub(
            toWlth(((wallet1Allocation * 3) / 10).toString())
          ),
          beneficiary1.address
        );
      expect(await marketingVesting.connect(beneficiary1).released()).to.equal(
        toWlth(((wallet1Allocation * 3) / 10 + (wallet1Allocation * 7 * 1) / 240).toString())
      );

      // await time.increaseTo(vestingStartTimestamp + cadence * 8);
      // await marketingVesting.connect(beneficiary1).release(toWlth((wallet1Allocation*3/10+wallet1Allocation*7*2/240).toString()), beneficiary1.address);
      // expect(await marketingVesting.connect(beneficiary1).released()).to.equal(toWlth((wallet1Allocation*3/10+wallet1Allocation*7*2/240).toString()));
    });
  });
});
