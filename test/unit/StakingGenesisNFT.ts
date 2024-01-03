import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import chai from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { IERC721Upgradeable, StakingGenesisNFT } from '../../typechain-types';

chai.use(smock.matchers);
const { expect } = chai;

describe('Staking Genesis NFT unit tests', () => {
  const timestamp = Date.now();
  const TIMESTAMP_IN_THE_FUTURE = timestamp + 600;
  const SPECIFIC_TIMESTAMP = timestamp + 1234;
  const TIMESTAMP_IN_THE_PAST = 0;
  const SOME_STAKE = [1, 2, 5];
  const SOME_OTHER_STAKE = [3, 7, 9, 11];
  const DAILY_REWARD_SMALL = 5;
  const DAILY_REWARD_LARGE = 27;
  const SECONDS_PER_DAY = 86_400;

  const deployStakingGenesisNFT = async () => {
    const smallGenesisNFT: FakeContract<IERC721Upgradeable> = await smock.fake('GenesisNFT');
    const largeGenesisNFT: FakeContract<IERC721Upgradeable> = await smock.fake('GenesisNFT');

    smallGenesisNFT.ownerOf.reset();
    largeGenesisNFT.ownerOf.reset();
    smallGenesisNFT['safeTransferFrom(address,address,uint256)'].reset();
    largeGenesisNFT['safeTransferFrom(address,address,uint256)'].reset();

    const [deployer, owner] = await ethers.getSigners();

    const stakingGenesisNft: StakingGenesisNFT = await deployProxy(
      'StakingGenesisNFT',
      [owner.address, TIMESTAMP_IN_THE_FUTURE, smallGenesisNFT.address, largeGenesisNFT.address, SECONDS_PER_DAY],
      deployer
    );

    return { stakingGenesisNft, deployer, owner, smallGenesisNFT, largeGenesisNFT };
  };

  const deployStakingGenesisNFTwithEmptyNftContracts = async () => {
    const [deployer, owner] = await ethers.getSigners();

    const stakingGenesisNft: StakingGenesisNFT = await deployProxy(
      'StakingGenesisNFT',
      [owner.address, TIMESTAMP_IN_THE_FUTURE, constants.AddressZero, constants.AddressZero, SECONDS_PER_DAY],
      deployer
    );

    return { stakingGenesisNft, deployer, owner };
  };

  describe('Deployment', () => {
    it('Should deploy with correct owner', async () => {
      const { stakingGenesisNft, deployer, owner } = await loadFixture(deployStakingGenesisNFT);

      await expect(stakingGenesisNft.connect(deployer).pause()).to.be.reverted;
      await expect(stakingGenesisNft.connect(owner).pause()).not.to.be.reverted;
    });
  });

  describe('#setFinalTimestamp', () => {
    it('Should not allow non-owner to change number', async () => {
      const { stakingGenesisNft, deployer } = await loadFixture(deployStakingGenesisNFT);

      await expect(stakingGenesisNft.connect(deployer).setFinalTimestamp(TIMESTAMP_IN_THE_FUTURE)).to.be.reverted;
    });

    it('Should allow owner to change number', async () => {
      const { stakingGenesisNft, owner } = await loadFixture(deployStakingGenesisNFT);

      await stakingGenesisNft.connect(owner).setFinalTimestamp(SPECIFIC_TIMESTAMP);

      expect(await stakingGenesisNft.finalTimestamp()).to.equal(SPECIFIC_TIMESTAMP);
    });

    it('Should not allow owner to change number for a one in the past', async () => {
      const { stakingGenesisNft, owner } = await loadFixture(deployStakingGenesisNFT);

      await expect(stakingGenesisNft.connect(owner).setFinalTimestamp(TIMESTAMP_IN_THE_PAST)).to.be.revertedWithCustomError(stakingGenesisNft,'StakingGenesisNft__InvalidFinalTimestamp');
    });
  });

  describe('#stake', () => {
    it('Should not allow to stake when paused', async () => {
      const { stakingGenesisNft, deployer, owner } = await loadFixture(deployStakingGenesisNFT);

      await stakingGenesisNft.connect(owner).pause();
      await expect(stakingGenesisNft.connect(deployer).stake([], [])).to.be.reverted;
    });

    it('Should not allow to stake when staking ended', async () => {
      const { stakingGenesisNft, deployer, owner } = await loadFixture(deployStakingGenesisNFT);
      const timestampBefore = await time.latest();

      await stakingGenesisNft.connect(owner).setFinalTimestamp(timestampBefore + 1);
      await time.increase(2);

      const timestampAfter = await time.latest();

      expect(timestampAfter).to.be.greaterThan(timestampBefore + 1);
      await expect(stakingGenesisNft.connect(deployer).stake([], [])).to.be.revertedWithCustomError(stakingGenesisNft,'StakingGenesisNft__StakingFinished');
    });

    it('Should not allow to stake unowned tokens', async () => {
      const { stakingGenesisNft, deployer, owner, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(owner.address));

      await expect(stakingGenesisNft.connect(deployer).stake(SOME_STAKE, [])).to.be.revertedWithCustomError(stakingGenesisNft,'StakingGenesisNft__UnexpectedTokenId');
    });

    it('Should allow to stake owned tokens', async () => {
      const { stakingGenesisNft, deployer, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));

      await expect(stakingGenesisNft.connect(deployer).stake(SOME_STAKE, [])).not.to.be.reverted;
    });
  });

  describe('#getRewardSmall', () => {
    it('Should not give reward if no full day elapsed', async () => {
      const { stakingGenesisNft, deployer, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, []);
      await time.increase(SECONDS_PER_DAY - 1);

      expect(await stakingGenesisNft.connect(deployer).getRewardSmall(deployer.address)).to.equal(0);
    });

    it('Should give reward based on number of days staked after tokens unstaked', async () => {
      const { stakingGenesisNft, deployer, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, []);
      await time.increase(SECONDS_PER_DAY);

      expect(await stakingGenesisNft.connect(deployer).getRewardSmall(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_SMALL
      );

      await time.increase(SECONDS_PER_DAY * 5);

      await stakingGenesisNft.connect(deployer).unstake(SOME_STAKE, []);

      expect(await stakingGenesisNft.connect(deployer).getRewardSmall(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_SMALL * 6
      );
    });

    it('Should not give rewards when final timestamp was reached', async () => {
      const { stakingGenesisNft, deployer, owner, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      const settingFinalTimestampTime = (await time.latest()) + 5;
      const stakingTime = settingFinalTimestampTime + 5;

      await time.setNextBlockTimestamp(settingFinalTimestampTime);
      await stakingGenesisNft.connect(owner).setFinalTimestamp(stakingTime + SECONDS_PER_DAY * 3 + 2);

      await time.setNextBlockTimestamp(stakingTime);
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, []);

      await time.increaseTo(stakingTime + SECONDS_PER_DAY * 5);

      expect(await stakingGenesisNft.connect(deployer).getRewardSmall(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_SMALL * 3
      );
    });
  });

  describe('#getRewardLarge', () => {
    it('Should not give reward if no full day elapsed', async () => {
      const { stakingGenesisNft, deployer, largeGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake([], SOME_STAKE);
      await time.increase(SECONDS_PER_DAY - 1);

      expect(await stakingGenesisNft.connect(deployer).getRewardLarge(deployer.address)).to.equal(0);
    });

    it('Should give reward based on number of days stake1d', async () => {
      const { stakingGenesisNft, deployer, largeGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake([], SOME_STAKE);
      await time.increase(SECONDS_PER_DAY);

      expect(await stakingGenesisNft.connect(deployer).getRewardLarge(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_LARGE
      );

      await time.increase(SECONDS_PER_DAY * 5);

      expect(await stakingGenesisNft.connect(deployer).getRewardLarge(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_LARGE * 6
      );
    });

    it('Should not give rewards when final timestamp was reached', async () => {
      const { stakingGenesisNft, deployer, owner, largeGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      const settingFinalTimestampTime = (await time.latest()) + 5;
      const stakingTime = settingFinalTimestampTime + 5;

      await time.setNextBlockTimestamp(settingFinalTimestampTime);
      await stakingGenesisNft.connect(owner).setFinalTimestamp(stakingTime + SECONDS_PER_DAY * 3 + 2);

      await time.setNextBlockTimestamp(stakingTime);
      await stakingGenesisNft.connect(deployer).stake([], SOME_STAKE);

      await time.increaseTo(stakingTime + SECONDS_PER_DAY * 5);

      expect(await stakingGenesisNft.connect(deployer).getRewardLarge(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_LARGE * 3
      );
    });

    it('Should give small and large rewards at the same time', async () => {
      const { stakingGenesisNft, deployer, owner, smallGenesisNFT, largeGenesisNFT } = await loadFixture(
        deployStakingGenesisNFT
      );
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, SOME_OTHER_STAKE);
      await time.increase(SECONDS_PER_DAY);

      expect(await stakingGenesisNft.connect(owner).getRewardSmall(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_SMALL
      );
      expect(await stakingGenesisNft.connect(deployer).getRewardLarge(deployer.address)).to.equal(
        SOME_OTHER_STAKE.length * DAILY_REWARD_LARGE
      );
    });

    it('Should give small and large rewards for multiple stakes', async () => {
      const { stakingGenesisNft, deployer, owner, smallGenesisNFT, largeGenesisNFT } = await loadFixture(
        deployStakingGenesisNFT
      );
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, SOME_OTHER_STAKE);
      await time.increase(SECONDS_PER_DAY);
      await stakingGenesisNft.connect(deployer).stake(SOME_OTHER_STAKE, SOME_STAKE);
      await time.increase(SECONDS_PER_DAY);

      expect(await stakingGenesisNft.connect(owner).getRewardSmall(deployer.address)).to.equal(
        SOME_STAKE.length * DAILY_REWARD_SMALL * 2 + SOME_OTHER_STAKE.length * DAILY_REWARD_SMALL
      );
      expect(await stakingGenesisNft.connect(deployer).getRewardLarge(deployer.address)).to.equal(
        SOME_OTHER_STAKE.length * DAILY_REWARD_LARGE * 2 + SOME_STAKE.length * DAILY_REWARD_LARGE
      );
    });
  });

  describe('#unstake', () => {
    it('Should not allow to unstake tokens that were not staked', async () => {
      const { stakingGenesisNft, deployer, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE.slice(1), []);

      await expect(stakingGenesisNft.connect(deployer).unstake(SOME_STAKE, [])).to.be.revertedWithCustomError(stakingGenesisNft,'StakingGenesisNft__NoTokensStaked');
    });

    it('Should not allow to unstake when paused', async () => {
      const { stakingGenesisNft, deployer, owner } = await loadFixture(deployStakingGenesisNFT);
      await stakingGenesisNft.connect(owner).pause();

      await expect(stakingGenesisNft.connect(deployer).unstake([], [])).to.be.reverted;
    });

    it('Should unstake', async () => {
      const { stakingGenesisNft, deployer, owner, smallGenesisNFT, largeGenesisNFT } = await loadFixture(
        deployStakingGenesisNFT
      );
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));

      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, SOME_OTHER_STAKE);
      await time.increase(SECONDS_PER_DAY * 5);

      const smallReward = await stakingGenesisNft.connect(owner).getRewardSmall(deployer.address);
      const largeReward = await stakingGenesisNft.connect(owner).getRewardLarge(deployer.address);

      expect(smallReward).to.be.greaterThan(0);
      expect(largeReward).to.be.greaterThan(0);

      smallGenesisNFT['safeTransferFrom(address,address,uint256)'].reset();

      await expect(stakingGenesisNft.connect(deployer).unstake(SOME_STAKE, SOME_OTHER_STAKE)).not.to.be.reverted;
      expect(await stakingGenesisNft.connect(owner).getRewardSmall(deployer.address)).to.be.equal(smallReward);
      expect(await stakingGenesisNft.connect(owner).getRewardLarge(deployer.address)).to.be.equal(largeReward);
      SOME_STAKE.forEach((id) =>
        expect(smallGenesisNFT['safeTransferFrom(address,address,uint256)']).to.have.been.calledWith(
          stakingGenesisNft.address,
          deployer.address,
          id
        )
      );
      SOME_OTHER_STAKE.forEach((id) =>
        expect(largeGenesisNFT['safeTransferFrom(address,address,uint256)']).to.have.been.calledWith(
          stakingGenesisNft.address,
          deployer.address,
          id
        )
      );
    });

    it('Should only provide rewards for the small tokens that are being unstaked', async () => {
      const { stakingGenesisNft, deployer, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, []);
      await stakingGenesisNft.connect(deployer).stake(SOME_OTHER_STAKE, []);
      await time.increase(SECONDS_PER_DAY);
      const unstaked = SOME_STAKE.slice(1);

      await stakingGenesisNft.connect(deployer).unstake(unstaked, []);

      await time.increase(SECONDS_PER_DAY);

      expect(await stakingGenesisNft.getRewardSmall(deployer.address)).to.equal(
        unstaked.length * DAILY_REWARD_SMALL +
          (SOME_STAKE.length - unstaked.length + SOME_OTHER_STAKE.length) * DAILY_REWARD_SMALL * 2
      );
    });

    it('Should only provide rewards for the large tokens that are being unstaked', async () => {
      const { stakingGenesisNft, deployer, largeGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake([], SOME_STAKE);
      await stakingGenesisNft.connect(deployer).stake([], SOME_OTHER_STAKE);
      await time.increase(SECONDS_PER_DAY);
      const unstaked = SOME_STAKE.slice(1);

      await stakingGenesisNft.connect(deployer).unstake([], unstaked);

      await time.increase(SECONDS_PER_DAY);

      expect(await stakingGenesisNft.getRewardLarge(deployer.address)).to.equal(
        unstaked.length * DAILY_REWARD_LARGE +
          (SOME_STAKE.length - unstaked.length + SOME_OTHER_STAKE.length) * DAILY_REWARD_LARGE * 2
      );
    });
  });

  describe('#getStakedTokensSmall', () => {
    it('Should calculate currently staked small tokens', async () => {
      const { stakingGenesisNft, deployer, owner, smallGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => smallGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake(SOME_STAKE, []);
      await time.increase(3);
      await stakingGenesisNft.connect(deployer).stake(SOME_OTHER_STAKE, []);

      expect(await stakingGenesisNft.connect(owner).getStakedTokensSmall(deployer.address)).to.deep.equal([
        ...SOME_STAKE,
        ...SOME_OTHER_STAKE
      ]);
    });
  });

  describe('#getStakedTokensLarge', () => {
    it('Should calculate currently staked large tokens', async () => {
      const { stakingGenesisNft, deployer, owner, largeGenesisNFT } = await loadFixture(deployStakingGenesisNFT);
      SOME_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      SOME_OTHER_STAKE.forEach((id) => largeGenesisNFT.ownerOf.whenCalledWith(id).returns(deployer.address));
      await stakingGenesisNft.connect(deployer).stake([], SOME_STAKE);
      await time.increase(3);
      await stakingGenesisNft.connect(deployer).stake([], SOME_OTHER_STAKE);

      expect(await stakingGenesisNft.connect(owner).getStakedTokensLarge(deployer.address)).to.deep.equal([
        ...SOME_STAKE,
        ...SOME_OTHER_STAKE
      ]);
    });
  });
});
