import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { GenesisNFTVesting, IGeneisNFTMirror, Wlth } from '../../typechain-types';

describe('Genesis NFT Vesting unit tests', function () {
  const deployGenesisNFTVesting = async () => {
    const [deployer, owner, user1, user2] = await ethers.getSigners();

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const ONE_MONTH_IN_SECONDS = 2628000;
    const ONE_YEAR_IN_SECONDS = 12 * ONE_MONTH_IN_SECONDS;

    const duration = ONE_YEAR_IN_SECONDS;
    const cadence = ONE_MONTH_IN_SECONDS;
    const vestingStartTimestamp = (await ethers.provider.getBlock('latest')).timestamp + ONE_MONTH_IN_SECONDS;

    const allocation = parseEther('1000000');

    const emergencyWithdrawalUnlockTimestamp =
      (await ethers.provider.getBlock('latest')).timestamp + ONE_YEAR_IN_SECONDS;

    const genesisNFTSeries1Mirror: FakeContract<IGeneisNFTMirror> = await smock.fake('GenesisNFTMirror');
    const genesisNFTSeries2Mirror: FakeContract<IGeneisNFTMirror> = await smock.fake('GenesisNFTMirror');

    const genesisNFTVesting: GenesisNFTVesting = await deploy(
      'GenesisNFTVesting',
      [
        owner.address,
        genesisNFTSeries1Mirror.address,
        genesisNFTSeries2Mirror.address,
        wlth.address,
        duration,
        cadence,
        vestingStartTimestamp,
        allocation,
        emergencyWithdrawalUnlockTimestamp
      ],
      deployer
    );

    const bonus = await genesisNFTVesting.BONUS();
    const series1MaxReward = await genesisNFTVesting.SERIES_1_MAX_REWARD();
    const series2MaxReward = await genesisNFTVesting.SERIES_2_MAX_REWARD();

    const user1Series1Tokens = [0, 1, 2];
    const user1Series2Tokens = [5, 6];
    const user2Series1Tokens = [3, 4];
    const user2Series2Tokens = [9, 10];

    return {
      deployer,
      owner,
      user1,
      user2,
      genesisNFTVesting,
      wlth,
      genesisNFTSeries1Mirror,
      genesisNFTSeries2Mirror,
      duration,
      cadence,
      vestingStartTimestamp,
      allocation,
      user1Series1Tokens,
      user1Series2Tokens,
      user2Series1Tokens,
      user2Series2Tokens,
      ONE_MONTH_IN_SECONDS,
      bonus,
      series1MaxReward,
      series2MaxReward,
      emergencyWithdrawalUnlockTimestamp
    };
  };

  beforeEach(async () => {
    const {
      genesisNFTVesting,
      user1,
      user2,
      user1Series1Tokens,
      user1Series2Tokens,
      user2Series1Tokens,
      user2Series2Tokens,
      genesisNFTSeries1Mirror,
      genesisNFTSeries2Mirror,
      wlth,
      allocation
    } = await loadFixture(deployGenesisNFTVesting);

    genesisNFTSeries1Mirror.balanceOf.reset();
    genesisNFTSeries2Mirror.balanceOf.reset();
    genesisNFTSeries1Mirror.ownerOf.reset();
    genesisNFTSeries2Mirror.ownerOf.reset();

    genesisNFTSeries1Mirror.balanceOf.whenCalledWith(user1.address).returns(user1Series1Tokens.length);
    genesisNFTSeries2Mirror.balanceOf.whenCalledWith(user1.address).returns(user1Series2Tokens.length);
    genesisNFTSeries1Mirror.balanceOf.whenCalledWith(user2.address).returns(user2Series1Tokens.length);
    genesisNFTSeries2Mirror.balanceOf.whenCalledWith(user2.address).returns(user2Series2Tokens.length);
    user1Series1Tokens.forEach((i) => {
      genesisNFTSeries1Mirror.ownerOf.whenCalledWith(i).returns(user1.address);
    });
    user1Series2Tokens.forEach((i) => {
      genesisNFTSeries2Mirror.ownerOf.whenCalledWith(i).returns(user1.address);
    });
    wlth.transfer.returns(true);

    wlth.balanceOf.whenCalledWith(genesisNFTVesting.address).returns(allocation);
  });

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy with initial params', async () => {
        const {
          genesisNFTVesting,
          owner,
          wlth,
          duration,
          cadence,
          vestingStartTimestamp,
          allocation,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          emergencyWithdrawalUnlockTimestamp
        } = await loadFixture(deployGenesisNFTVesting);

        expect(await genesisNFTVesting.owner()).to.be.equal(owner.address);
        expect(await genesisNFTVesting.wlth()).to.be.equal(wlth.address);
        expect(await genesisNFTVesting.duration()).to.be.equal(duration);
        expect(await genesisNFTVesting.cadence()).to.be.equal(cadence);
        expect(await genesisNFTVesting.vestingStartTimestamp()).to.be.equal(vestingStartTimestamp);
        expect(await genesisNFTVesting.allocation()).to.be.equal(allocation);
        expect(await genesisNFTVesting.released()).to.be.equal(0);
        expect(await genesisNFTVesting.genesisNftSeries1Mirror()).to.be.equal(genesisNFTSeries1Mirror.address);
        expect(await genesisNFTVesting.genesisNftSeries2Mirror()).to.be.equal(genesisNFTSeries2Mirror.address);
        expect(await genesisNFTVesting.emergencyWithdrawalUnlockTimestamp()).to.be.equal(
          emergencyWithdrawalUnlockTimestamp
        );
      });
    });

    describe('Reverts', () => {
      it("Should revert when owner's address is zero address", async () => {
        const {
          deployer,
          genesisNFTVesting,
          wlth,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          duration,
          cadence,
          vestingStartTimestamp,
          allocation,
          emergencyWithdrawalUnlockTimestamp
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              constants.AddressZero,
              genesisNFTSeries1Mirror.address,
              genesisNFTSeries2Mirror.address,
              wlth.address,
              duration,
              cadence,
              vestingStartTimestamp,
              allocation,
              emergencyWithdrawalUnlockTimestamp
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__OwnerZeroAddress');
      });
      it('Should revert when wlth address is zero address', async () => {
        const {
          deployer,
          genesisNFTVesting,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          owner,
          duration,
          cadence,
          vestingStartTimestamp,
          allocation,
          emergencyWithdrawalUnlockTimestamp
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              genesisNFTSeries1Mirror.address,
              genesisNFTSeries2Mirror.address,
              constants.AddressZero,
              duration,
              cadence,
              vestingStartTimestamp,
              allocation,
              emergencyWithdrawalUnlockTimestamp
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__WlthZeroAddress');
      });

      it('Should revert when genesis nft series 1 address is zero address', async () => {
        const {
          deployer,
          genesisNFTVesting,
          wlth,
          genesisNFTSeries2Mirror,
          owner,
          duration,
          cadence,
          vestingStartTimestamp,
          allocation,
          emergencyWithdrawalUnlockTimestamp
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              constants.AddressZero,
              genesisNFTSeries2Mirror.address,
              wlth.address,
              duration,
              cadence,
              vestingStartTimestamp,
              allocation,
              emergencyWithdrawalUnlockTimestamp
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__GenesisNftSeries1MirrorZeroAddress');
      });

      it('Should revert when genesis nft series 2 address is zero address', async () => {
        const {
          deployer,
          genesisNFTVesting,
          wlth,
          genesisNFTSeries1Mirror,
          owner,
          duration,
          cadence,
          vestingStartTimestamp,
          allocation,
          emergencyWithdrawalUnlockTimestamp
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              genesisNFTSeries1Mirror.address,
              constants.AddressZero,
              wlth.address,
              duration,
              cadence,
              vestingStartTimestamp,
              allocation,
              emergencyWithdrawalUnlockTimestamp
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__GenesisNftSeries2MirrorZeroAddress');
      });
    });
  });

  describe('Release all available', () => {
    describe('Success', async () => {
      it('Should realease all avaiable tokens', async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series1Tokens,
          user1Series2Tokens,
          vestingStartTimestamp,
          ONE_MONTH_IN_SECONDS
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const series1TokenReward = (await genesisNFTVesting.SERIES_1_MAX_REWARD()).div(12);
        const series2TokenReward = (await genesisNFTVesting.SERIES_2_MAX_REWARD()).div(12);

        const totalRewardsClaimed = series1TokenReward
          .mul(user1Series1Tokens.length)
          .add(series2TokenReward.mul(user1Series2Tokens.length));

        await expect(
          genesisNFTVesting.connect(user1).releaseAllAvailable(user1Series1Tokens, user1Series2Tokens, user1.address)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1TokenReward, user1Series1Tokens[0])
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1TokenReward, user1Series1Tokens[1])
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1TokenReward, user1Series1Tokens[2])
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series2TokenReward, user1Series2Tokens[0])
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series2TokenReward, user1Series2Tokens[1]);
        expect(await genesisNFTVesting.released()).to.be.equal(totalRewardsClaimed);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1TokenReward
        );
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[1])).to.be.equal(
          series1TokenReward
        );
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[2])).to.be.equal(
          series1TokenReward
        );
        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          series2TokenReward
        );
        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[1])).to.be.equal(
          series2TokenReward
        );
      });
    });

    describe('Reverts', () => {
      it("Should revert when vesting hasn't started yet", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.connect(user1).releaseAllAvailable(user1Series1Tokens, user1Series2Tokens, user1.address)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });

      it('Should revert if a user has no NFTs', async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series1Tokens,
          user1Series2Tokens,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          vestingStartTimestamp
        } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries1Mirror.balanceOf.whenCalledWith(user1.address).returns(0);
        genesisNFTSeries2Mirror.balanceOf.whenCalledWith(user1.address).returns(0);

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).releaseAllAvailable(user1Series1Tokens, user1Series2Tokens, user1.address)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NoNFTs')
          .withArgs(user1.address);
      });
      it('Should revert when not an owner of a token from series 1', async () => {
        const { genesisNFTVesting, user1, user2Series1Tokens, user1Series2Tokens, vestingStartTimestamp } =
          await loadFixture(deployGenesisNFTVesting);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).releaseAllAvailable(user2Series1Tokens, user1Series2Tokens, user1.address)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user1.address);
      });

      it('Should revert when not an owner of a token from series 2', async () => {
        const { genesisNFTVesting, user1, user2Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );
        await time.increaseTo(vestingStartTimestamp);

        await expect(genesisNFTVesting.connect(user1).releaseAllAvailable([], user2Series2Tokens, user1.address))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(2, user2Series2Tokens[0], user1.address);
      });
    });
  });

  describe('Bonus setup', () => {
    describe('Success', () => {
      it('Should set bonus', async () => {
        const { genesisNFTVesting, owner, bonus } = await loadFixture(deployGenesisNFTVesting);
        const tokensWithBonus = [0, 1];

        await genesisNFTVesting.connect(owner).setupBonus(tokensWithBonus);

        expect(await genesisNFTVesting.bonusValue(0)).to.be.equal(bonus);
        expect(await genesisNFTVesting.bonusValue(1)).to.be.equal(bonus);
        expect(await genesisNFTVesting.bonusValue(3)).to.be.equal(0);
      });
    });

    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);
        const tokensWithBonus = [0, 1];

        await expect(genesisNFTVesting.connect(user1).setupBonus(tokensWithBonus)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Unvested amount per nft', () => {
    describe('Success', () => {
      beforeEach(async () => {
        const { genesisNFTSeries1Mirror, genesisNFTSeries2Mirror } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries1Mirror.isTokenExisted.returns(true);
        genesisNFTSeries2Mirror.isTokenExisted.returns(true);
      });

      it('Should return max unvested amount for an nft series 1 if nothing vested yet', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, series1MaxReward } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);
        expect(
          await genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(series1MaxReward);
      });

      it('Should return 0 if everything already vested for an nft series 1', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, duration } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(
          await genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it('Should return less than max when some already vested for an nft series 1', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series1MaxReward.div(12);
        const left = series1MaxReward.sub(rewardsAfterMonth);

        expect(
          await genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(left);
      });

      it('Should return max unvested amount for an nft series 2 if nothing vested yet', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, series2MaxReward } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);
        expect(
          await genesisNFTVesting.unvestedAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(series2MaxReward);
      });

      it('Should return 0 if everything already vested for an nft series 2', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, duration } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(
          await genesisNFTVesting.unvestedAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it('Should return less than max when some already vested for an nft series 2', async () => {
        const { genesisNFTVesting, user2Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series2MaxReward.div(12);
        const left = series2MaxReward.sub(rewardsAfterMonth);

        expect(
          await genesisNFTVesting.unvestedAmountPerNFT(false, user2Series1Tokens[0], await time.latest())
        ).to.be.equal(left);
      });
    });

    describe('Reverts', () => {
      it('Should revert if nft series 1 does not exist', async () => {
        const { genesisNFTSeries1Mirror, genesisNFTVesting } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries1Mirror.isTokenExisted.returns(false);

        await expect(genesisNFTVesting.unvestedAmountPerNFT(true, 0, await time.latest()))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NFTNotExisted')
          .withArgs(1, 0);
      });

      it('Should revert if nft series 2 does not exist', async () => {
        const { genesisNFTSeries2Mirror, genesisNFTVesting } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries2Mirror.isTokenExisted.returns(false);

        await expect(genesisNFTVesting.unvestedAmountPerNFT(false, 0, await time.latest()))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NFTNotExisted')
          .withArgs(2, 0);
      });
    });
  });

  describe('Releasable amount', () => {
    describe('Success', () => {
      it('Should return max releasable amount when vesting finished', async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series1Tokens,
          user1Series2Tokens,
          vestingStartTimestamp,
          duration,
          series1MaxReward,
          series2MaxReward
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        const rewards = series1MaxReward
          .mul(user1Series1Tokens.length)
          .add(series2MaxReward.mul(user1Series2Tokens.length));

        console.log('Reward', rewards);
        expect(
          await genesisNFTVesting.releasableAmount(
            user1Series1Tokens,
            user1Series2Tokens,
            await time.latest(),
            user1.address
          )
        ).to.be.equal(rewards);
      });

      it("Should return 0 when empty nfts' arrays", async () => {
        const { genesisNFTVesting, user1, vestingStartTimestamp } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp);

        expect(await genesisNFTVesting.releasableAmount([], [], await time.latest(), user1.address)).to.be.equal(0);
      });
    });

    describe('Reverts', () => {
      it('Should revert when a user has no nfts', async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series1Tokens,
          user1Series2Tokens,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror
        } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries1Mirror.balanceOf.reset();
        genesisNFTSeries2Mirror.balanceOf.reset();
        genesisNFTSeries1Mirror.balanceOf.returns(0);
        genesisNFTSeries2Mirror.balanceOf.returns(0);

        await expect(
          genesisNFTVesting.releasableAmount(user1Series1Tokens, user1Series2Tokens, await time.latest(), user1.address)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NoNFTs')
          .withArgs(user1.address);
      });

      it("Should revert when not a user's token from series 1", async () => {
        const { genesisNFTVesting, user1, user2Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.releasableAmount(user2Series1Tokens, user1Series2Tokens, await time.latest(), user1.address)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user1.address);
      });

      it("Should revert when not a user's token from series 2", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user2Series2Tokens, vestingStartTimestamp } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.releasableAmount(user1Series1Tokens, user2Series2Tokens, await time.latest(), user1.address)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(2, user2Series2Tokens[0], user1.address);
      });

      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.releasableAmount(user1Series1Tokens, user1Series2Tokens, await time.latest(), user1.address)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });
    });
  });

  describe('Emergency withdraw', () => {
    describe('Success', () => {
      it("Should withdraw all wlth from the contract's balance", async () => {
        const { genesisNFTVesting, owner, wlth, allocation, emergencyWithdrawalUnlockTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(emergencyWithdrawalUnlockTimestamp);

        const emegencyWithdrawalAddress = Wallet.createRandom().address;

        await expect(genesisNFTVesting.connect(owner).emergencyWithdraw(emegencyWithdrawalAddress))
          .to.emit(genesisNFTVesting, 'EmergencyWithdrawal')
          .withArgs(emegencyWithdrawalAddress, allocation);

        expect(wlth.transfer).to.have.been.calledWith(emegencyWithdrawalAddress, allocation);
      });
    });

    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.connect(user1).emergencyWithdraw(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when locked', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.connect(owner).emergencyWithdraw(owner.address)).to.be.revertedWithCustomError(
          genesisNFTVesting,
          'GenesisNFTVesting__EmergencyWithdrawalLocked'
        );
      });
    });
  });

  describe('Release per nft', () => {
    describe('Success', () => {
      it("Should release all available tokens for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, vestingStartTimestamp, duration, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], series1MaxReward, user1.address)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1MaxReward, user1Series1Tokens[0]);

        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1MaxReward
        );
        expect(await genesisNFTVesting.released()).to.be.equal(series1MaxReward);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1MaxReward
        );
        expect(
          await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it("Should release some of available tokens for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, vestingStartTimestamp, duration, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        const amountToRelease = parseEther('1000');
        const left = series1MaxReward.sub(amountToRelease);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], amountToRelease, user1.address)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, amountToRelease, user1Series1Tokens[0]);

        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          amountToRelease
        );
        expect(await genesisNFTVesting.released()).to.be.equal(amountToRelease);
        expect(
          await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(left);
      });

      it("Should release all available tokens for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1, user1Series2Tokens, vestingStartTimestamp, duration, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(false, user1Series2Tokens[0], series2MaxReward, user1.address)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series2MaxReward, user1Series2Tokens[0]);

        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          series2MaxReward
        );
        expect(await genesisNFTVesting.released()).to.be.equal(series2MaxReward);
        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          series2MaxReward
        );
        expect(
          await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it("Should release some of available tokens for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1, user1Series2Tokens, vestingStartTimestamp, duration, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        const amountToRelease = parseEther('1000');
        const left = series2MaxReward.sub(amountToRelease);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(false, user1Series2Tokens[0], amountToRelease, user1.address)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, amountToRelease, user1Series2Tokens[0]);

        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          amountToRelease
        );
        expect(await genesisNFTVesting.released()).to.be.equal(amountToRelease);
        expect(
          await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(left);
      });
    });
    describe('Reverts', () => {
      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 1, user1.address)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });

      it('Should revert when not the owner of series 1 nft', async () => {
        const { genesisNFTVesting, user1, user2Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(genesisNFTVesting.connect(user1).releasePerNFT(true, user2Series1Tokens[0], 1, user1.address))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user1.address);
      });

      it('Should revert when not the owner of series 2 nft', async () => {
        const { genesisNFTVesting, user1, user2Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(genesisNFTVesting.connect(user1).releasePerNFT(false, user2Series2Tokens[0], 1, user1.address))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(2, user2Series2Tokens[0], user1.address);
      });

      it('Should revert when amount greater than releasable', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 100, user1.address)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotEnoughTokensVested');
      });

      it("Should revert when not enough wlth in the contract's balance", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, wlth, vestingStartTimestamp, ONE_MONTH_IN_SECONDS } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        wlth.balanceOf.whenCalledWith(genesisNFTVesting.address).returns(0);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 1, user1.address)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__InsufficientWlthBalance');
      });
    });
  });

  describe('Releasable amount per nft', () => {
    describe('Success', () => {
      it("Should all tokens be releasable for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, duration, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(
          await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(series1MaxReward);
      });

      it("Should all tokens be releasable for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, duration, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(
          await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(series2MaxReward);
      });

      it("Should some tokens be releasable for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series1MaxReward.div(12);

        expect(
          await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(rewardsAfterMonth);
      });

      it("Should some tokens be releasable for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user2Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series2MaxReward.div(12);

        expect(
          await genesisNFTVesting.releasableAmountPerNFT(false, user2Series1Tokens[0], await time.latest())
        ).to.be.equal(rewardsAfterMonth);
      });

      it("Should return 0 when nothing is releasable for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(
          await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it("Should return 0 when nothing is releasable for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(
          await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it("Should return releasable amount with bonus for a user's nft from series 1", async () => {
        const {
          genesisNFTVesting,
          owner,
          user1Series1Tokens,
          vestingStartTimestamp,
          duration,
          series1MaxReward,
          bonus
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        await genesisNFTVesting.connect(owner).setupBonus([user1Series1Tokens[0]]);

        const totalRewards = series1MaxReward.add(bonus);
        expect(
          await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(totalRewards);
      });
    });

    describe('Reverts', () => {
      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1Series1Tokens } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });
    });
  });

  describe('Vested amount per nft', () => {
    describe('Success', () => {
      it('Should retern 0 when nothing vested for series 1', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it('Should return 0 when nothing vested for series 2', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it('Should return 0 when nothing vested for series 1 before first cadance passed', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp + 1);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(0);
      });

      it("Should return all vested tokens for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, duration, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(series1MaxReward);
      });

      it("Should return all vested tokens for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, duration, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(false, user1Series2Tokens[0], await time.latest())
        ).to.be.equal(series2MaxReward);
      });

      it("Should return some vested tokens for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series1MaxReward.div(12);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(rewardsAfterMonth);
      });

      it("Should return some vested tokens for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user2Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series2MaxReward.div(12);

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(false, user2Series1Tokens[0], await time.latest())
        ).to.be.equal(rewardsAfterMonth);
      });

      it("Should return some vested tokens plus some of the bonus for a user's nft from series 1", async () => {
        const {
          genesisNFTVesting,
          owner,
          user1Series1Tokens,
          vestingStartTimestamp,
          duration,
          series1MaxReward,
          bonus,
          ONE_MONTH_IN_SECONDS
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS * 6);

        await genesisNFTVesting.connect(owner).setupBonus([user1Series1Tokens[0]]);

        const rewardsAfterMonth = series1MaxReward.div(2);
        const totalRewards = rewardsAfterMonth.add(bonus.div(2));

        expect(
          await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.equal(totalRewards);
      });
    });
    describe('Reverts', () => {
      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1Series1Tokens } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0], await time.latest())
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });
    });
  });
});
