import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, constants, Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { StakingGenesisNFTVesting, Wlth } from '../../typechain-types';

type Rewards = {
  account: string;
  series1Rewards: BigNumber;
  series2Rewards: BigNumber;
};

describe('StakingGenesisNFTVesting', () => {
  const deployStakingGenesisNFTVesting = async () => {
    const [deployer, owner, user1, user2] = await ethers.getSigners();
    const ONE_DAY_IN_SECONDS = 86400;

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');

    const allocation = parseEther('1000');
    const distributionStartTimestamp = (await time.latest()) + ONE_DAY_IN_SECONDS;

    const leftoversUnlockDelay = 365 * ONE_DAY_IN_SECONDS;

    const stakingGenesisNFTVesting = (await deploy(
      'StakingGenesisNFTVesting',
      [owner.address, wlth.address, allocation, distributionStartTimestamp, leftoversUnlockDelay],
      deployer
    )) as StakingGenesisNFTVesting;

    wlth.balanceOf.returns(allocation);
    wlth.transfer.returns(true);

    const rewards: Rewards[] = [
      {
        account: user1.address,
        series1Rewards: parseEther('500'),
        series2Rewards: parseEther('100')
      },
      {
        account: user2.address,
        series1Rewards: parseEther('250'),
        series2Rewards: parseEther('150')
      }
    ];

    return {
      deployer,
      owner,
      user1,
      user2,
      wlth,
      allocation,
      distributionStartTimestamp,
      stakingGenesisNFTVesting,
      rewards,
      leftoversUnlockDelay
    };
  };
  describe('Deployment', () => {
    it('Should deploy the contract with initial params', async () => {
      const { owner, stakingGenesisNFTVesting, wlth, allocation, distributionStartTimestamp, leftoversUnlockDelay } =
        await loadFixture(deployStakingGenesisNFTVesting);

      expect(await stakingGenesisNFTVesting.owner()).to.equal(owner.address);
      expect(await stakingGenesisNFTVesting.wlth()).to.equal(wlth.address);
      expect(await stakingGenesisNFTVesting.allocation()).to.equal(allocation);
      expect(await stakingGenesisNFTVesting.distributionStartTimestamp()).to.equal(distributionStartTimestamp);
      expect(await stakingGenesisNFTVesting.leftoversUnlockDelay()).to.equal(leftoversUnlockDelay);
    });

    describe('Reverts', () => {
      it("Should revert if the owner's address is the zero address", async () => {
        const {
          stakingGenesisNFTVesting,
          deployer,
          wlth,
          allocation,
          distributionStartTimestamp,
          leftoversUnlockDelay
        } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(
          deploy(
            'StakingGenesisNFTVesting',
            [ethers.constants.AddressZero, wlth.address, allocation, distributionStartTimestamp, leftoversUnlockDelay],
            deployer
          )
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__OwnerZeroAddress');
      });

      it("Should revert if the wlth's address is the zero address", async () => {
        const {
          stakingGenesisNFTVesting,
          deployer,
          owner,
          allocation,
          distributionStartTimestamp,
          leftoversUnlockDelay
        } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(
          deploy(
            'StakingGenesisNFTVesting',
            [owner.address, ethers.constants.AddressZero, allocation, distributionStartTimestamp, leftoversUnlockDelay],
            deployer
          )
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__WlthZeroAddress');
      });

      it('Should revert if invalid vesting start timetamp provided', async () => {
        const { stakingGenesisNFTVesting, deployer, owner, allocation, wlth, leftoversUnlockDelay } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await expect(
          deploy(
            'StakingGenesisNFTVesting',
            [owner.address, wlth.address, allocation, 1, leftoversUnlockDelay],
            deployer
          )
        ).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__PastDistributionStartTimestamp'
        );
      });
    });
  });
  describe('Set rewards', () => {
    it('Should set rewards', async () => {
      const { owner, user1, user2, stakingGenesisNFTVesting, rewards } = await loadFixture(
        deployStakingGenesisNFTVesting
      );

      await stakingGenesisNFTVesting.connect(owner).setRewards(rewards);

      expect(await stakingGenesisNFTVesting.series1Rewards(user1.address)).to.equal(rewards[0].series1Rewards);
      expect(await stakingGenesisNFTVesting.series2Rewards(user1.address)).to.equal(rewards[0].series2Rewards);

      expect(await stakingGenesisNFTVesting.series1Rewards(user2.address)).to.equal(rewards[1].series1Rewards);
      expect(await stakingGenesisNFTVesting.series2Rewards(user2.address)).to.equal(rewards[1].series2Rewards);

      expect(await stakingGenesisNFTVesting.totalRewards()).to.be.equal(parseEther('1000'));
    });

    it('Should revert if the caller is not the owner', async () => {
      const { user1, stakingGenesisNFTVesting, rewards } = await loadFixture(deployStakingGenesisNFTVesting);

      await expect(stakingGenesisNFTVesting.connect(user1).setRewards(rewards)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert if the rewards bigger than allocation', async () => {
      const { owner, stakingGenesisNFTVesting, rewards } = await loadFixture(deployStakingGenesisNFTVesting);

      const tooHighRewards: Rewards[] = [
        {
          account: owner.address,
          series1Rewards: parseEther('1001'),
          series2Rewards: parseEther('1001')
        }
      ];

      await expect(stakingGenesisNFTVesting.connect(owner).setRewards(tooHighRewards)).to.be.revertedWithCustomError(
        stakingGenesisNFTVesting,
        'StakingGenesisNFTVesting__RewardsTooHigh'
      );
    });
  });

  describe('Release', () => {
    describe('Success', () => {
      const setup = async () => {
        const { owner, user1, user2, rewards, distributionStartTimestamp, stakingGenesisNFTVesting, wlth } =
          await loadFixture(deployStakingGenesisNFTVesting);
        await stakingGenesisNFTVesting.connect(owner).setRewards(rewards);
        await time.increaseTo(distributionStartTimestamp);

        return { user1, user2, stakingGenesisNFTVesting, wlth };
      };

      it("Should claim the user's rewards", async () => {
        const { user1, stakingGenesisNFTVesting, wlth } = await setup();

        await expect(stakingGenesisNFTVesting.connect(user1).release())
          .to.emit(stakingGenesisNFTVesting, 'Released')
          .withArgs(user1.address, parseEther('600'));

        expect(await stakingGenesisNFTVesting.series1Rewards(user1.address)).to.equal(parseEther('500'));
        expect(await stakingGenesisNFTVesting.series2Rewards(user1.address)).to.equal(parseEther('100'));
        expect(await stakingGenesisNFTVesting.releaseableAmount(user1.address)).to.equal(0);
        expect(await stakingGenesisNFTVesting.releasedAmount()).to.be.equal(parseEther('600'));
        expect(await stakingGenesisNFTVesting.userClaimed(user1.address)).to.be.true;
        expect(wlth.transfer).to.have.been.calledWith(user1.address, parseEther('600'));
      });

      it('Should claim users rewards', async () => {
        const { user1, user2, stakingGenesisNFTVesting, wlth } = await setup();

        await expect(stakingGenesisNFTVesting.connect(user1).release())
          .to.emit(stakingGenesisNFTVesting, 'Released')
          .withArgs(user1.address, parseEther('600'));

        expect(await stakingGenesisNFTVesting.series1Rewards(user1.address)).to.equal(parseEther('500'));
        expect(await stakingGenesisNFTVesting.series2Rewards(user1.address)).to.equal(parseEther('100'));
        expect(await stakingGenesisNFTVesting.releaseableAmount(user1.address)).to.equal(0);
        expect(await stakingGenesisNFTVesting.releasedAmount()).to.be.equal(parseEther('600'));
        expect(await stakingGenesisNFTVesting.userClaimed(user1.address)).to.be.true;
        expect(await stakingGenesisNFTVesting.userClaimed(user2.address)).to.be.false;
        expect(wlth.transfer).to.have.been.calledWith(user1.address, parseEther('600'));

        await expect(stakingGenesisNFTVesting.connect(user2).release())
          .to.emit(stakingGenesisNFTVesting, 'Released')
          .withArgs(user2.address, parseEther('400'));

        expect(await stakingGenesisNFTVesting.series1Rewards(user2.address)).to.equal(parseEther('250'));
        expect(await stakingGenesisNFTVesting.series2Rewards(user2.address)).to.equal(parseEther('150'));
        expect(await stakingGenesisNFTVesting.releaseableAmount(user2.address)).to.equal(0);
        expect(await stakingGenesisNFTVesting.releasedAmount()).to.be.equal(parseEther('1000'));
        expect(await stakingGenesisNFTVesting.userClaimed(user2.address)).to.be.true;
        expect(wlth.transfer).to.have.been.calledWith(user2.address, parseEther('400'));
      });
    });

    describe('Reverts', () => {
      it("Should revert if distribution hasn't started", async () => {
        const { stakingGenesisNFTVesting, user1 } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(user1).release()).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__DistributionNotStarted'
        );
      });
      it("Should revert if distribution hasn't set", async () => {
        const { owner, deployer, wlth, allocation, leftoversUnlockDelay, distributionStartTimestamp } =
          await loadFixture(deployStakingGenesisNFTVesting);

        const stakingGenesisNFTVesting = await deploy(
          'StakingGenesisNFTVesting',
          [owner.address, wlth.address, allocation, 0, leftoversUnlockDelay],
          deployer
        );

        await time.increaseTo(distributionStartTimestamp);

        await expect(stakingGenesisNFTVesting.connect(owner).release()).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__DistributionNotStarted'
        );
      });
      it('Should revert if the has no rewards', async () => {
        const { stakingGenesisNFTVesting, user1, distributionStartTimestamp } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await time.increaseTo(distributionStartTimestamp);

        await expect(stakingGenesisNFTVesting.connect(user1).release())
          .to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__NoRewardsForUser')
          .withArgs(user1.address);
      });
      it('Should revert if a user already claimed the rewards', async () => {
        const { stakingGenesisNFTVesting, owner, user1, distributionStartTimestamp, rewards } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await stakingGenesisNFTVesting.connect(owner).setRewards(rewards);
        await time.increaseTo(distributionStartTimestamp);
        await stakingGenesisNFTVesting.connect(user1).release();

        await expect(stakingGenesisNFTVesting.connect(user1).release()).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__NoRewardsForUser'
        );
      });

      it("Should revert if not enough tokens in the contract's balance", async () => {
        const { owner, user1, stakingGenesisNFTVesting, rewards, distributionStartTimestamp, wlth } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await stakingGenesisNFTVesting.connect(owner).setRewards(rewards);
        await time.increaseTo(distributionStartTimestamp);
        wlth.balanceOf.returns(parseEther('599'));

        await expect(stakingGenesisNFTVesting.connect(user1).release()).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__NotEnoughTokens'
        );
      });

      it('Should revert if the wallet is lost', async () => {
        const { owner, user1, stakingGenesisNFTVesting, rewards, distributionStartTimestamp } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await stakingGenesisNFTVesting.connect(owner).setRewards(rewards);
        await time.increaseTo(distributionStartTimestamp);
        await stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address);

        await expect(stakingGenesisNFTVesting.connect(user1).release())
          .to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__WalletLost')
          .withArgs(user1.address);
      });
    });
  });

  describe('Set lost wallet', () => {
    describe('Success', () => {
      it('Should set the wallet as lost', async () => {
        const { owner, user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address))
          .to.emit(stakingGenesisNFTVesting, 'LostWalletSet')
          .withArgs(user1.address);

        expect(await stakingGenesisNFTVesting.lostWallet(user1.address)).to.be.true;
      });
    });

    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(user1).setLostWallet(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert if the wallet is already lost', async () => {
        const { owner, user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address);

        await expect(
          stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address)
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__WalletAlreadyLost');
      });
    });
  });

  describe("Reset lost wallet's status", () => {
    describe('Success', () => {
      it('Should reset the wallet status', async () => {
        const { owner, user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address);

        await expect(stakingGenesisNFTVesting.connect(owner).resetLostWallet(user1.address))
          .to.emit(stakingGenesisNFTVesting, 'LostWalletReseted')
          .withArgs(user1.address);

        expect(await stakingGenesisNFTVesting.lostWallet(user1.address)).to.be.false;
      });
    });
    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(user1).resetLostWallet(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert if the wallet is not lost', async () => {
        const { owner, user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(
          stakingGenesisNFTVesting.connect(owner).resetLostWallet(user1.address)
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__WalletNotLost');
      });
    });
  });

  describe('Emergency withdrawal', () => {
    describe('Success', () => {
      it("Should withdraw the user's funds if lost", async () => {
        const { owner, user1, stakingGenesisNFTVesting, wlth, distributionStartTimestamp, rewards, allocation } =
          await loadFixture(deployStakingGenesisNFTVesting);
        await stakingGenesisNFTVesting.connect(owner).setRewards(rewards);
        await time.increaseTo(distributionStartTimestamp);
        wlth.balanceOf.returns(allocation);

        await stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address);

        await expect(stakingGenesisNFTVesting.connect(owner).emergencyWithdraw(user1.address, owner.address))
          .to.emit(stakingGenesisNFTVesting, 'EmergencyWithdrawalPerformed')
          .withArgs(user1.address, owner.address)
          .to.emit(stakingGenesisNFTVesting, 'Released')
          .withArgs(owner.address, parseEther('600'));

        expect(wlth.transfer).to.have.been.calledWith(owner.address, parseEther('600'));
      });
    });

    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { user1, user2, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(
          stakingGenesisNFTVesting.connect(user1).emergencyWithdraw(user2.address, user1.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when a wallet is not lost', async () => {
        const { owner, user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(owner).emergencyWithdraw(user1.address, owner.address))
          .to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__WalletNotLost')
          .withArgs(user1.address);
      });

      it('Should revert when a receiver wallet is zero', async () => {
        const { owner, user1, stakingGenesisNFTVesting, distributionStartTimestamp } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await stakingGenesisNFTVesting.connect(owner).setLostWallet(user1.address);
        await time.increaseTo(distributionStartTimestamp);

        await expect(
          stakingGenesisNFTVesting.connect(owner).emergencyWithdraw(user1.address, constants.AddressZero)
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__AddressToZeroAddress');
      });

      it('Should revert when a giver wallet is zero', async () => {
        const { owner, user1, stakingGenesisNFTVesting, distributionStartTimestamp } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await stakingGenesisNFTVesting.connect(owner).setLostWallet(constants.AddressZero);
        await time.increaseTo(distributionStartTimestamp);

        await expect(
          stakingGenesisNFTVesting.connect(owner).emergencyWithdraw(constants.AddressZero, owner.address)
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__AddressFromZeroAddress');
      });
    });
  });

  describe("Set distribution's start timestamp", () => {
    describe('Success', () => {
      it('Should set the distribution start timestamp', async () => {
        const { owner, deployer, wlth, allocation, leftoversUnlockDelay, distributionStartTimestamp } =
          await loadFixture(deployStakingGenesisNFTVesting);

        const stakingGenesisNFTVesting = await deploy(
          'StakingGenesisNFTVesting',
          [owner.address, wlth.address, allocation, 0, leftoversUnlockDelay],
          deployer
        );
        await expect(stakingGenesisNFTVesting.connect(owner).setDistributionStartTimestamp(distributionStartTimestamp))
          .to.emit(stakingGenesisNFTVesting, 'DistributionStartTimestampSet')
          .withArgs(distributionStartTimestamp);

        expect(await stakingGenesisNFTVesting.distributionStartTimestamp()).to.equal(distributionStartTimestamp);
      });
    });

    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(user1).setDistributionStartTimestamp(1000)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert if the distribution has already started', async () => {
        const { owner, stakingGenesisNFTVesting, distributionStartTimestamp } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await time.increaseTo(distributionStartTimestamp);

        await expect(
          stakingGenesisNFTVesting.connect(owner).setDistributionStartTimestamp(1000)
        ).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__DistributionStartTimestampAlreadySet'
        );
      });

      it('Should revert if the distribution timestamp is past, lower than block timestamp', async () => {
        const { owner, distributionStartTimestamp, wlth, allocation, leftoversUnlockDelay, deployer } =
          await loadFixture(deployStakingGenesisNFTVesting);

        const stakingGenesisNFTVesting = await deploy(
          'StakingGenesisNFTVesting',
          [owner.address, wlth.address, allocation, 0, leftoversUnlockDelay],
          deployer
        );

        await time.increaseTo(distributionStartTimestamp);

        await expect(
          stakingGenesisNFTVesting.connect(owner).setDistributionStartTimestamp(distributionStartTimestamp - 100)
        ).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__PastDistributionStartTimestamp'
        );
      });
    });
  });

  describe('Leftovers withdrawal', () => {
    describe('Success', () => {
      it('Should withdraw', async () => {
        const { owner, stakingGenesisNFTVesting, wlth, allocation, leftoversUnlockDelay, distributionStartTimestamp } =
          await loadFixture(deployStakingGenesisNFTVesting);
        const leftoversWithdrawalAccount = Wallet.createRandom().address;
        wlth.balanceOf.returns(allocation);

        await time.increaseTo(distributionStartTimestamp + leftoversUnlockDelay);

        await expect(stakingGenesisNFTVesting.connect(owner).withdrawLeftovers(leftoversWithdrawalAccount))
          .to.emit(stakingGenesisNFTVesting, 'LeftoversWithdrawn')
          .withArgs(leftoversWithdrawalAccount, allocation);

        expect(wlth.transfer).to.have.been.calledWith(leftoversWithdrawalAccount, allocation);
      });
    });

    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(user1).withdrawLeftovers(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert if the leftovers withdrawal locked', async () => {
        const { owner, stakingGenesisNFTVesting, distributionStartTimestamp } = await loadFixture(
          deployStakingGenesisNFTVesting
        );

        await time.increaseTo(distributionStartTimestamp);

        await expect(
          stakingGenesisNFTVesting.connect(owner).withdrawLeftovers(owner.address)
        ).to.be.revertedWithCustomError(
          stakingGenesisNFTVesting,
          'StakingGenesisNFTVesting__LeftoversWithdrawalLocked'
        );
      });

      it("Should revert when distribution hasn't set", async () => {
        const { owner, deployer, wlth, allocation, leftoversUnlockDelay, distributionStartTimestamp } =
          await loadFixture(deployStakingGenesisNFTVesting);

        const stakingGenesisNFTVesting = await deploy(
          'StakingGenesisNFTVesting',
          [owner.address, wlth.address, allocation, 0, leftoversUnlockDelay],
          deployer
        );

        await expect(
          stakingGenesisNFTVesting.connect(owner).withdrawLeftovers(owner.address)
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__DistributionNotStarted');
      });

      it("Should revert when distribution hasn't started", async () => {
        const { owner, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(
          stakingGenesisNFTVesting.connect(owner).withdrawLeftovers(owner.address)
        ).to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__DistributionNotStarted');
      });
    });
  });

  describe('Surplus withdraw', () => {
    describe('Success', () => {
      it('Should withdraw surplus', async () => {
        const { owner, stakingGenesisNFTVesting, wlth, allocation } = await loadFixture(deployStakingGenesisNFTVesting);

        const surplus = parseEther('1000');
        const surplusWithdrawalAccount = Wallet.createRandom().address;
        wlth.balanceOf.returns(allocation.add(surplus));

        await expect(stakingGenesisNFTVesting.connect(owner).withdrawSurplus(surplusWithdrawalAccount))
          .to.emit(stakingGenesisNFTVesting, 'SurplusWithdrawn')
          .withArgs(surplusWithdrawalAccount, surplus);

        expect(wlth.transfer).to.have.been.calledWith(surplusWithdrawalAccount, allocation);
      });
    });

    describe('Reverts', () => {
      it('Should revert if the caller is not the owner', async () => {
        const { user1, stakingGenesisNFTVesting } = await loadFixture(deployStakingGenesisNFTVesting);

        await expect(stakingGenesisNFTVesting.connect(user1).withdrawSurplus(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert if the no surplus', async () => {
        const { owner, stakingGenesisNFTVesting, wlth, allocation } = await loadFixture(deployStakingGenesisNFTVesting);

        wlth.balanceOf.returns(allocation);
        await expect(stakingGenesisNFTVesting.connect(owner).withdrawSurplus(owner.address))
          .to.be.revertedWithCustomError(stakingGenesisNFTVesting, 'StakingGenesisNFTVesting__NoSurplus')
          .withArgs(allocation, 0, allocation);
      });
    });
  });
});
