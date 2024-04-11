import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { GenesisNFT, GenesisNFTVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe('Genesis NFT Vesting unit tests', function () {
  const deployGenesisNFTVesting = async () => {
    const [deployer, owner, user1, user2, communityFund] = await ethers.getSigners();

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const ONE_MONTH_IN_SECONDS = 2628000;
    const ONE_YEAR_IN_SECONDS = 12 * ONE_MONTH_IN_SECONDS;

    const duration = ONE_YEAR_IN_SECONDS;
    const cadence = ONE_MONTH_IN_SECONDS;
    const vestingStartTimestamp = (await ethers.provider.getBlock('latest')).timestamp + ONE_MONTH_IN_SECONDS;

    const allocation = parseEther('1000000');

    const leftoversUnlockDelay = ONE_YEAR_IN_SECONDS;

    // const genesisNFTSeries1Mirror: FakeContract<IGeneisNFTMirror> = await smock.fake('GenesisNFTMirror');
    // const genesisNFTSeries2Mirror: FakeContract<IGeneisNFTMirror> = await smock.fake('GenesisNFTMirror');

    const genesisNFTSeries1Mirror: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');
    const genesisNFTSeries2Mirror: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');

    const genesisNFTVesting: GenesisNFTVesting = await deploy(
      'GenesisNFTVesting',
      [
        owner.address,
        genesisNFTSeries1Mirror.address,
        genesisNFTSeries2Mirror.address,
        wlth.address,
        communityFund.address,
        duration,
        cadence,
        allocation,
        leftoversUnlockDelay,
        vestingStartTimestamp
      ],
      deployer
    );

    const bonus = await genesisNFTVesting.BONUS();
    const series1MaxReward = await genesisNFTVesting.SERIES_1_MAX_REWARD();
    const series2MaxReward = await genesisNFTVesting.SERIES_2_MAX_REWARD();
    //await genesisNFTVesting.connect(owner).setVestingStartTimestamp(vestingStartTimestamp);

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
      leftoversUnlockDelay,
      communityFund
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
          leftoversUnlockDelay
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
        expect(await genesisNFTVesting.leftoversUnlockDelay()).to.be.equal(leftoversUnlockDelay);
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
          allocation,
          leftoversUnlockDelay,
          communityFund
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              constants.AddressZero,
              genesisNFTSeries1Mirror.address,
              genesisNFTSeries2Mirror.address,
              wlth.address,
              communityFund.address,
              duration,
              cadence,
              allocation,
              leftoversUnlockDelay,
              0
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
          allocation,
          leftoversUnlockDelay,
          communityFund
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              genesisNFTSeries1Mirror.address,
              genesisNFTSeries2Mirror.address,
              constants.AddressZero,
              communityFund.address,
              duration,
              cadence,
              allocation,
              leftoversUnlockDelay,
              0
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__WlthZeroAddress');
      });

      it('Should revert when community fund address is zero address', async () => {
        const {
          deployer,
          genesisNFTVesting,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          owner,
          duration,
          cadence,
          allocation,
          leftoversUnlockDelay,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              genesisNFTSeries1Mirror.address,
              genesisNFTSeries2Mirror.address,
              wlth.address,
              constants.AddressZero,
              duration,
              cadence,
              allocation,
              leftoversUnlockDelay,
              0
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__CommunityFundZeroAddress');
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
          allocation,
          leftoversUnlockDelay,
          communityFund
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              constants.AddressZero,
              genesisNFTSeries2Mirror.address,
              wlth.address,
              communityFund.address,
              duration,
              cadence,
              allocation,
              leftoversUnlockDelay,
              0
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__GenesisNftSeries1ZeroAddress');
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
          allocation,
          leftoversUnlockDelay,
          communityFund
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              genesisNFTSeries1Mirror.address,
              constants.AddressZero,
              wlth.address,
              communityFund.address,
              duration,
              cadence,
              allocation,
              leftoversUnlockDelay,
              0
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__GenesisNftSeries2ZeroAddress');
      });

      it('Should revert when invalid vesting start timestamp provided', async () => {
        const {
          deployer,
          genesisNFTVesting,
          wlth,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          owner,
          duration,
          cadence,
          allocation,
          leftoversUnlockDelay,
          communityFund
        } = await loadFixture(deployGenesisNFTVesting);

        await expect(
          deploy(
            'GenesisNFTVesting',
            [
              owner.address,
              genesisNFTSeries1Mirror.address,
              genesisNFTSeries2Mirror.address,
              wlth.address,
              communityFund.address,
              duration,
              cadence,
              allocation,
              leftoversUnlockDelay,
              1
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__PastVestingStartTimestamp');
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
          ONE_MONTH_IN_SECONDS,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const series1TokenReward = (await genesisNFTVesting.SERIES_1_MAX_REWARD()).div(12);
        const series2TokenReward = (await genesisNFTVesting.SERIES_2_MAX_REWARD()).div(12);

        const totalRewardsClaimed = series1TokenReward
          .mul(user1Series1Tokens.length)
          .add(series2TokenReward.mul(user1Series2Tokens.length));

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releaseAllAvailable(user1Series1Tokens, user1Series2Tokens, user1.address, false)
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

      it('Should realease all avaiable tokens with proper penalty after one month of vesting', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, wlth } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const series1TokenReward = await genesisNFTVesting.SERIES_1_MAX_REWARD();

        await expect(genesisNFTVesting.connect(user1).releaseAllAvailable([0], [], user1.address, true))
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1TokenReward, user1Series1Tokens[0]);

        expect(wlth.transfer).to.have.been.calledWith(user1.address, toWlth('14422.222222222222222222'));

        /*
        Penalty calculations for this case:
        equantion: penalty = slashpool * maxPenalty * (cadencesAmount - actualCadence) / cadencesAmount
        vested = 3666.666666
        slashpool = 44000 - 3666.666666 = 40333.333334
        penalty = 40333.333334*0.8*23/24 = 29577.7777783
        user will get: 44000 - 29577.7777783 = 14422.222222222222222222
        */

        expect(await genesisNFTVesting.released()).to.be.equal(series1TokenReward);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1TokenReward
        );
      });

      it('Should realease all avaiable tokens with 0 penalty after vesting end', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, vestingStartTimestamp, wlth, duration } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        const series1TokenReward = await genesisNFTVesting.SERIES_1_MAX_REWARD();

        await expect(genesisNFTVesting.connect(user1).releaseAllAvailable([0], [], user1.address, true))
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1TokenReward, user1Series1Tokens[0]);

        expect(wlth.transfer).to.have.been.calledWith(user1.address, series1TokenReward);

        /*
        Penalty calculations for this case:
        equantion: penalty = slashpool * maxPenalty * (cadencesAmount - actualCadence) / cadencesAmount
        vested = 3666.666666
        slashpool = 44000 - 3666.666666 = 40333.333334
        penalty = 40333.333334*0.8*23/24 = 29577.7777783
        user will get: 44000 - 29577.7777783 = 14422.222222222222222222
        */

        expect(await genesisNFTVesting.released()).to.be.equal(series1TokenReward);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1TokenReward
        );
      });
    });

    describe('Reverts', () => {
      it("Should revert when vesting hasn't started yet", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releaseAllAvailable(user1Series1Tokens, user1Series2Tokens, user1.address, false)
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
          genesisNFTVesting
            .connect(user1)
            .releaseAllAvailable(user1Series1Tokens, user1Series2Tokens, user1.address, false)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NoNFTs')
          .withArgs(user1.address);
      });
      it('Should revert when not an owner of a token from series 1', async () => {
        const { genesisNFTVesting, user1, user2Series1Tokens, user1Series2Tokens, vestingStartTimestamp } =
          await loadFixture(deployGenesisNFTVesting);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releaseAllAvailable(user2Series1Tokens, user1Series2Tokens, user1.address, false)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user1.address);
      });

      it('Should revert when not an owner of a token from series 2', async () => {
        const { genesisNFTVesting, user1, user2Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );
        await time.increaseTo(vestingStartTimestamp);

        await expect(genesisNFTVesting.connect(user1).releaseAllAvailable([], user2Series2Tokens, user1.address, false))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(2, user2Series2Tokens[0], user1.address);
      });
    });
  });

  describe('Bonus setup', () => {
    describe('Success', () => {
      it('Should set and revoke bonus', async () => {
        const { genesisNFTVesting, owner, bonus } = await loadFixture(deployGenesisNFTVesting);
        const tokensWithBonus = [0, 1];

        await genesisNFTVesting.connect(owner).setupBonus(tokensWithBonus, true);

        expect(await genesisNFTVesting.bonusValue(0)).to.be.equal(bonus);
        expect(await genesisNFTVesting.bonusValue(1)).to.be.equal(bonus);
        expect(await genesisNFTVesting.bonusValue(3)).to.be.equal(0);

        await genesisNFTVesting.connect(owner).setupBonus(tokensWithBonus, false);

        expect(await genesisNFTVesting.bonusValue(0)).to.be.equal(0);
        expect(await genesisNFTVesting.bonusValue(1)).to.be.equal(0);
        expect(await genesisNFTVesting.bonusValue(3)).to.be.equal(0);
      });
    });

    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);
        const tokensWithBonus = [0, 1];

        await expect(genesisNFTVesting.connect(user1).setupBonus(tokensWithBonus, true)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Unvested amount per nft', () => {
    describe('Success', () => {
      beforeEach(async () => {
        const { genesisNFTSeries1Mirror, genesisNFTSeries2Mirror } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries1Mirror.exists.returns(true);
        genesisNFTSeries2Mirror.exists.returns(true);
      });

      it('Should return max unvested amount for an nft series 1 if nothing vested yet', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, series1MaxReward } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);
        expect(await genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(series1MaxReward);
      });

      it('Should return 0 if everything already vested for an nft series 1', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, duration } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(0);
      });

      it('Should return less than max when some already vested for an nft series 1', async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series1MaxReward.div(12);
        const left = series1MaxReward.sub(rewardsAfterMonth);

        expect(await genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(left);
      });

      it('Should return max unvested amount for an nft series 2 if nothing vested yet', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, series2MaxReward } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);
        expect(await genesisNFTVesting.unvestedAmountPerNFT(false, user1Series2Tokens[0])).to.be.equal(
          series2MaxReward
        );
      });

      it('Should return 0 if everything already vested for an nft series 2', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, duration } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await genesisNFTVesting.unvestedAmountPerNFT(false, user1Series2Tokens[0])).to.be.equal(0);
      });

      it('Should return less than max when some already vested for an nft series 2', async () => {
        const { genesisNFTVesting, user2Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series2MaxReward.div(12);
        const left = series2MaxReward.sub(rewardsAfterMonth);

        expect(await genesisNFTVesting.unvestedAmountPerNFT(false, user2Series1Tokens[0])).to.be.equal(left);
      });
    });

    describe('Reverts', () => {
      it('Should revert if nft series 1 does not exist', async () => {
        const { genesisNFTSeries1Mirror, genesisNFTVesting } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries1Mirror.exists.returns(false);

        await expect(genesisNFTVesting.unvestedAmountPerNFT(true, 0))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NFTNotExisted')
          .withArgs(1, 0);
      });

      it('Should revert if nft series 2 does not exist', async () => {
        const { genesisNFTSeries2Mirror, genesisNFTVesting } = await loadFixture(deployGenesisNFTVesting);

        genesisNFTSeries2Mirror.exists.returns(false);

        await expect(genesisNFTVesting.unvestedAmountPerNFT(false, 0))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NFTNotExisted')
          .withArgs(2, 0);
      });

      it('Should revert if vesting start timestamp not defined', async () => {
        const {
          owner,
          duration,
          wlth,
          communityFund,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          cadence,
          allocation,
          leftoversUnlockDelay,
          deployer,
          vestingStartTimestamp,
          ONE_MONTH_IN_SECONDS,
          series1MaxReward,
          user1Series1Tokens
        } = await loadFixture(deployGenesisNFTVesting);

        const genesisNFTVesting: GenesisNFTVesting = await deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            genesisNFTSeries1Mirror.address,
            genesisNFTSeries2Mirror.address,
            wlth.address,
            communityFund.address,
            duration,
            cadence,
            allocation,
            leftoversUnlockDelay,
            0
          ],
          deployer
        );

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        genesisNFTSeries1Mirror.exists.returns(true);

        await expect(genesisNFTVesting.unvestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.revertedWithCustomError(
          genesisNFTVesting,
          'GenesisNFTVesting__VestingNotStarted'
        );
      });

      it('Should revert if vesting start timestamp not started yet', async () => {
        const { genesisNFTSeries1Mirror, genesisNFTVesting, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp - 1);

        genesisNFTSeries1Mirror.exists.returns(true);

        await expect(genesisNFTVesting.unvestedAmountPerNFT(true, 0)).to.be.revertedWithCustomError(
          genesisNFTVesting,
          'GenesisNFTVesting__VestingNotStarted'
        );
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
          await genesisNFTVesting.releasableAmount(user1Series1Tokens, user1Series2Tokens, user1.address, false)
        ).to.be.equal(rewards);
      });

      it("Should return 0 when empty nfts' arrays", async () => {
        const { genesisNFTVesting, user1, vestingStartTimestamp } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp);

        expect(await genesisNFTVesting.releasableAmount([], [], user1.address, false)).to.be.equal(0);
      });

      it('Should return max releasable amount for genesis NFT series 2 only when vesting finished', async () => {
        const {
          genesisNFTVesting,
          user1,
          cadence,
          user1Series2Tokens,
          vestingStartTimestamp,
          duration,
          series2MaxReward,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration + cadence);

        const rewards = series2MaxReward.mul(user1Series2Tokens.length);

        genesisNFTSeries1Mirror.balanceOf.reset;
        genesisNFTSeries2Mirror.balanceOf.reset;
        genesisNFTSeries1Mirror.balanceOf.whenCalledWith(user1.address).returns(0);
        genesisNFTSeries2Mirror.balanceOf.whenCalledWith(user1.address).returns(2);

        expect(await genesisNFTVesting.releasableAmount([], user1Series2Tokens, user1.address, false)).to.be.equal(
          rewards
        );
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

        await expect(genesisNFTVesting.releasableAmount(user1Series1Tokens, user1Series2Tokens, user1.address, false))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NoNFTs')
          .withArgs(user1.address);
      });

      it("Should revert when not a user's token from series 1", async () => {
        const { genesisNFTVesting, user1, user2, user2Series1Tokens, user1Series2Tokens, user1Series1Tokens } =
          await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.releasableAmount(user2Series1Tokens, user1Series2Tokens, user1.address, false))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user1.address);

        await expect(genesisNFTVesting.releasableAmount(user2Series1Tokens, user1Series2Tokens, user2.address, false))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user2.address);
      });

      it("Should revert when not a user's token from series 2", async () => {
        const {
          genesisNFTVesting,
          user1,
          user2,
          user1Series1Tokens,
          user2Series2Tokens,
          vestingStartTimestamp,
          user1Series2Tokens
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp);

        await expect(genesisNFTVesting.releasableAmount(user1Series1Tokens, user2Series2Tokens, user1.address, false))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(2, user2Series2Tokens[0], user1.address);

        await expect(genesisNFTVesting.releasableAmount(user1Series1Tokens, user2Series2Tokens, user2.address, false))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user1Series1Tokens[0], user2.address);
      });

      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.releasableAmount(user1Series1Tokens, user1Series2Tokens, user1.address, false)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });

      it('Should revert when vesting start not started', async () => {
        const {
          genesisNFTVesting,
          user1,
          cadence,
          user1Series2Tokens,
          vestingStartTimestamp,
          duration,
          series2MaxReward,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp - 1);

        genesisNFTSeries1Mirror.balanceOf.reset;
        genesisNFTSeries2Mirror.balanceOf.reset;
        genesisNFTSeries1Mirror.balanceOf.whenCalledWith(user1.address).returns(0);
        genesisNFTSeries2Mirror.balanceOf.whenCalledWith(user1.address).returns(2);

        await expect(
          genesisNFTVesting.releasableAmount([], user1Series2Tokens, user1.address, false)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });
    });
  });

  describe('Leftovers withdraw', () => {
    describe('Success', () => {
      it("Should withdraw all wlth from the contract's balance", async () => {
        const { genesisNFTVesting, owner, wlth, allocation, leftoversUnlockDelay, vestingStartTimestamp, duration } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration + leftoversUnlockDelay);

        const leftoversWithdrawalAddress = Wallet.createRandom().address;

        await expect(genesisNFTVesting.connect(owner).withdrawLeftovers(leftoversWithdrawalAddress))
          .to.emit(genesisNFTVesting, 'LeftoversWithdrawn')
          .withArgs(leftoversWithdrawalAddress, allocation);

        expect(wlth.transfer).to.have.been.calledWith(leftoversWithdrawalAddress, allocation);
      });
    });

    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.connect(user1).withdrawLeftovers(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when locked', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.connect(owner).withdrawLeftovers(owner.address)).to.be.revertedWithCustomError(
          genesisNFTVesting,
          'GenesisNFTVesting__LeftoversWithdrawalLocked'
        );
      });

      it('Should revert when locked due to not setted vesting start timestamp', async () => {
        const {
          owner,
          duration,
          wlth,
          communityFund,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          cadence,
          allocation,
          leftoversUnlockDelay,
          deployer
        } = await loadFixture(deployGenesisNFTVesting);

        const genesisNFTVesting: GenesisNFTVesting = await deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            genesisNFTSeries1Mirror.address,
            genesisNFTSeries2Mirror.address,
            wlth.address,
            communityFund.address,
            duration,
            cadence,
            allocation,
            leftoversUnlockDelay,
            0
          ],
          deployer
        );

        await expect(genesisNFTVesting.connect(owner).withdrawLeftovers(owner.address)).to.be.revertedWithCustomError(
          genesisNFTVesting,
          'GenesisNFTVesting__LeftoversWithdrawalLocked'
        );
      });
    });
  });

  describe('Release per nft', () => {
    describe('Success', () => {
      it("Should release all available tokens for a user's nft from series 1", async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series1Tokens,
          vestingStartTimestamp,
          duration,
          series1MaxReward,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releasePerNFT(true, user1Series1Tokens[0], series1MaxReward, user1.address, false)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series1MaxReward, user1Series1Tokens[0]);

        expect(wlth.transfer).to.have.been.calledWith(user1.address, series1MaxReward);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1MaxReward
        );
        expect(await genesisNFTVesting.released()).to.be.equal(series1MaxReward);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          series1MaxReward
        );
        expect(await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)).to.be.equal(0);
      });

      it("Should release some of available tokens for a user's nft from series 1", async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series1Tokens,
          vestingStartTimestamp,
          duration,
          series1MaxReward,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        const amountToRelease = parseEther('1000');
        const left = series1MaxReward.sub(amountToRelease);

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releasePerNFT(true, user1Series1Tokens[0], amountToRelease, user1.address, false)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, amountToRelease, user1Series1Tokens[0]);

        expect(wlth.transfer).to.have.been.calledWith(user1.address, amountToRelease);
        expect(await genesisNFTVesting.amountClaimedBySeries1TokenId(user1Series1Tokens[0])).to.be.equal(
          amountToRelease
        );
        expect(await genesisNFTVesting.released()).to.be.equal(amountToRelease);
        expect(await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)).to.be.equal(left);
      });

      it("Should release all available tokens for a user's nft from series 2", async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series2Tokens,
          vestingStartTimestamp,
          duration,
          series2MaxReward,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releasePerNFT(false, user1Series2Tokens[0], series2MaxReward, user1.address, false)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, series2MaxReward, user1Series2Tokens[0]);

        expect(wlth.transfer).to.have.been.calledWith(user1.address, series2MaxReward);
        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          series2MaxReward
        );
        expect(await genesisNFTVesting.released()).to.be.equal(series2MaxReward);
        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          series2MaxReward
        );
        expect(await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], false)).to.be.equal(0);
      });

      it("Should release some of available tokens for a user's nft from series 2", async () => {
        const {
          genesisNFTVesting,
          user1,
          user1Series2Tokens,
          vestingStartTimestamp,
          duration,
          series2MaxReward,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        const amountToRelease = parseEther('1000');
        const left = series2MaxReward.sub(amountToRelease);

        await expect(
          genesisNFTVesting
            .connect(user1)
            .releasePerNFT(false, user1Series2Tokens[0], amountToRelease, user1.address, false)
        )
          .to.emit(genesisNFTVesting, 'Released')
          .withArgs(user1.address, amountToRelease, user1Series2Tokens[0]);

        expect(wlth.transfer).to.have.been.calledWith(user1.address, amountToRelease);
        expect(await genesisNFTVesting.amountClaimedBySeries2TokenId(user1Series2Tokens[0])).to.be.equal(
          amountToRelease
        );
        expect(await genesisNFTVesting.released()).to.be.equal(amountToRelease);
        expect(await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], false)).to.be.equal(left);
      });
    });
    describe('Reverts', () => {
      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 1, user1.address, false)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });

      it('Should revert when not the owner of series 1 nft', async () => {
        const { genesisNFTVesting, user1, user2Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user2Series1Tokens[0], 1, user1.address, false)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(1, user2Series1Tokens[0], user1.address);
      });

      it('Should revert when not the owner of series 2 nft', async () => {
        const { genesisNFTVesting, user1, user2Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(false, user2Series2Tokens[0], 1, user1.address, false)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotOwnerOfGenesisNFT')
          .withArgs(2, user2Series2Tokens[0], user1.address);
      });

      it('Should revert when amount greater than releasable', async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 100, user1.address, false)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NotEnoughTokensVested');
      });

      it("Should revert when not enough wlth in the contract's balance", async () => {
        const { genesisNFTVesting, user1, user1Series1Tokens, wlth, vestingStartTimestamp, ONE_MONTH_IN_SECONDS } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        wlth.balanceOf.whenCalledWith(genesisNFTVesting.address).returns(0);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 1, user1.address, false)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__InsufficientWlthBalance');
      });

      it('Should revert when nft series 1 lost and not an owner', async () => {
        const { genesisNFTVesting, user1, owner, user1Series1Tokens, vestingStartTimestamp, duration } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);
        await genesisNFTVesting.connect(owner).setLostToken(true, [user1Series1Tokens[0]]);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(true, user1Series1Tokens[0], 1, user1.address, false)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenLost')
          .withArgs(1, user1Series1Tokens[0]);
      });

      it('Should revert when nft series 2 lost and not an owner', async () => {
        const { genesisNFTVesting, user1, owner, user1Series2Tokens, vestingStartTimestamp, duration } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);
        await genesisNFTVesting.connect(owner).setLostToken(false, [user1Series2Tokens[0]]);

        await expect(
          genesisNFTVesting.connect(user1).releasePerNFT(false, user1Series2Tokens[0], 1, user1.address, false)
        )
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenLost')
          .withArgs(2, user1Series2Tokens[0]);
      });

      it('Should revert penalty calculation before vesting start timestamp', async () => {
        const {
          user1,
          owner,
          vestingStartTimestamp,
          duration,
          wlth,
          communityFund,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          cadence,
          allocation,
          leftoversUnlockDelay,
          deployer
        } = await loadFixture(deployGenesisNFTVesting);

        const genesisNFTVesting: GenesisNFTVesting = await deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            genesisNFTSeries1Mirror.address,
            genesisNFTSeries2Mirror.address,
            wlth.address,
            communityFund.address,
            duration,
            cadence,
            allocation,
            leftoversUnlockDelay,
            vestingStartTimestamp
          ],
          deployer
        );

        await time.increaseTo(vestingStartTimestamp - 1);

        await expect(
          genesisNFTVesting.connect(user1).calculatePenalty(true, toWlth('1'), 0)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });

      it('Should revert penalty calculation if vesting start timestamp not defined', async () => {
        const {
          user1,
          owner,
          vestingStartTimestamp,
          duration,
          wlth,
          communityFund,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          cadence,
          allocation,
          leftoversUnlockDelay,
          deployer
        } = await loadFixture(deployGenesisNFTVesting);

        const genesisNFTVesting: GenesisNFTVesting = await deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            genesisNFTSeries1Mirror.address,
            genesisNFTSeries2Mirror.address,
            wlth.address,
            communityFund.address,
            duration,
            cadence,
            allocation,
            leftoversUnlockDelay,
            0
          ],
          deployer
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).calculatePenalty(true, toWlth('1'), 0)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');
      });
    });
  });

  describe('Releasable amount per nft', () => {
    describe('Success', () => {
      it("Should all tokens be releasable for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, duration, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)).to.be.equal(
          series1MaxReward
        );
      });

      it("Should all tokens be releasable for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, duration, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], false)).to.be.equal(
          series2MaxReward
        );

        expect(await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], true)).to.be.equal(
          series2MaxReward
        );
      });

      it("Should some tokens be releasable for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series1MaxReward.div(12);

        expect(await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)).to.be.equal(
          rewardsAfterMonth
        );
      });

      it("Should some tokens be releasable for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user2Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series2MaxReward.div(12);

        expect(await genesisNFTVesting.releasableAmountPerNFT(false, user2Series1Tokens[0], false)).to.be.equal(
          rewardsAfterMonth
        );
      });

      it("Should return 0 when nothing is releasable for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)).to.be.equal(0);
      });

      it("Should return 0 when nothing is releasable for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(await genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], false)).to.be.equal(0);
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

        await genesisNFTVesting.connect(owner).setupBonus([user1Series1Tokens[0]], true);

        const totalRewards = series1MaxReward.add(bonus);
        expect(await genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)).to.be.equal(
          totalRewards
        );
      });
    });

    describe('Reverts', () => {
      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1Series1Tokens, user1Series2Tokens } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(
          genesisNFTVesting.releasableAmountPerNFT(true, user1Series1Tokens[0], false)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingNotStarted');

        await expect(
          genesisNFTVesting.releasableAmountPerNFT(false, user1Series2Tokens[0], true)
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

        expect(await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(0);
      });

      it('Should return 0 when nothing vested for series 2', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        expect(await genesisNFTVesting.vestedAmountPerNFT(false, user1Series2Tokens[0])).to.be.equal(0);
      });

      it('Should return 0 when nothing vested for series 1 before first cadance passed', async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp + 1);

        expect(await genesisNFTVesting.vestedAmountPerNFT(false, user1Series2Tokens[0])).to.be.equal(0);
      });

      it("Should return all vested tokens for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, duration, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(series1MaxReward);
      });

      it("Should return all vested tokens for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user1Series2Tokens, vestingStartTimestamp, duration, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await genesisNFTVesting.vestedAmountPerNFT(false, user1Series2Tokens[0])).to.be.equal(series2MaxReward);
      });

      it("Should return some vested tokens for a user's nft from series 1", async () => {
        const { genesisNFTVesting, user1Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series1MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series1MaxReward.div(12);

        expect(await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(rewardsAfterMonth);
      });

      it("Should return some vested tokens for a user's nft from series 2", async () => {
        const { genesisNFTVesting, user2Series1Tokens, vestingStartTimestamp, ONE_MONTH_IN_SECONDS, series2MaxReward } =
          await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + ONE_MONTH_IN_SECONDS);

        const rewardsAfterMonth = series2MaxReward.div(12);

        expect(await genesisNFTVesting.vestedAmountPerNFT(false, user2Series1Tokens[0])).to.be.equal(rewardsAfterMonth);
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

        await genesisNFTVesting.connect(owner).setupBonus([user1Series1Tokens[0]], true);

        const rewardsAfterMonth = series1MaxReward.div(2);
        const totalRewards = rewardsAfterMonth.add(bonus.div(2));

        expect(await genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.equal(totalRewards);
      });
    });
    describe('Reverts', () => {
      it('Should revert when vesting not started', async () => {
        const { genesisNFTVesting, user1Series1Tokens } = await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.vestedAmountPerNFT(true, user1Series1Tokens[0])).to.be.revertedWithCustomError(
          genesisNFTVesting,
          'GenesisNFTVesting__VestingNotStarted'
        );
      });
    });
  });

  describe('Set lost token', () => {
    describe('Success', () => {
      it('Should set a series 1 token as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await expect(genesisNFTVesting.connect(owner).setLostToken(true, tokenId))
          .to.emit(genesisNFTVesting, 'LostTokenSet')
          .withArgs(tokenId, 1);

        expect(await genesisNFTVesting.lostToken(true, tokenId)).to.be.equal(true);
      });

      it('Should set a series 2 token as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await expect(genesisNFTVesting.connect(owner).setLostToken(false, tokenId))
          .to.emit(genesisNFTVesting, 'LostTokenSet')
          .withArgs(tokenId, 2);

        expect(await genesisNFTVesting.lostToken(false, tokenId)).to.be.equal(true);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await expect(genesisNFTVesting.connect(user1).setLostToken(true, tokenId)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when a series 1 token already set as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await genesisNFTVesting.connect(owner).setLostToken(true, tokenId);

        await expect(genesisNFTVesting.connect(owner).setLostToken(true, tokenId))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenAlreadyLost')
          .withArgs(1, tokenId);
      });

      it('Should revert when a series 2 token already set as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await genesisNFTVesting.connect(owner).setLostToken(false, tokenId);

        await expect(genesisNFTVesting.connect(owner).setLostToken(false, tokenId))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenAlreadyLost')
          .withArgs(2, tokenId);
      });
    });
  });

  describe('Reset lost token', () => {
    describe('Success', () => {
      it('Should reset a series 1 token as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await genesisNFTVesting.connect(owner).setLostToken(true, tokenId);

        await expect(genesisNFTVesting.connect(owner).resetLostToken(true, tokenId))
          .to.emit(genesisNFTVesting, 'LostTokenReseted')
          .withArgs(tokenId, 1);

        expect(await genesisNFTVesting.lostToken(true, tokenId)).to.be.equal(false);
      });

      it('Should reset a series 2 token as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await genesisNFTVesting.connect(owner).setLostToken(false, tokenId);

        await expect(genesisNFTVesting.connect(owner).resetLostToken(false, tokenId))
          .to.emit(genesisNFTVesting, 'LostTokenReseted')
          .withArgs(tokenId, 2);

        expect(await genesisNFTVesting.lostToken(false, tokenId)).to.be.equal(false);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await expect(genesisNFTVesting.connect(user1).resetLostToken(true, tokenId)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when a series 1 token not set as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await expect(genesisNFTVesting.connect(owner).resetLostToken(true, tokenId))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenNotLost')
          .withArgs(1, tokenId);
      });

      it('Should revert when a series 2 token not set as lost', async () => {
        const { genesisNFTVesting, owner } = await loadFixture(deployGenesisNFTVesting);
        const tokenId = 1;

        await expect(genesisNFTVesting.connect(owner).resetLostToken(false, tokenId))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenNotLost')
          .withArgs(2, tokenId);
      });
    });
  });

  describe('Set vesting start timestamp', () => {
    describe('Success', () => {
      it('Should set vesting start timestamp', async () => {
        const {
          owner,
          vestingStartTimestamp,
          duration,
          wlth,
          communityFund,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          cadence,
          allocation,
          leftoversUnlockDelay,
          deployer
        } = await loadFixture(deployGenesisNFTVesting);

        const genesisNFTVesting: GenesisNFTVesting = await deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            genesisNFTSeries1Mirror.address,
            genesisNFTSeries2Mirror.address,
            wlth.address,
            communityFund.address,
            duration,
            cadence,
            allocation,
            leftoversUnlockDelay,
            0
          ],
          deployer
        );
        const timestamp = vestingStartTimestamp;

        await genesisNFTVesting.connect(owner).setVestingStartTimestamp(timestamp);

        expect(await genesisNFTVesting.vestingStartTimestamp()).to.be.equal(timestamp);
      });
    });
    describe('Reverts', () => {
      it('Should revert when called by not a owner', async () => {
        const { genesisNFTVesting, vestingStartTimestamp, owner, deployer } = await loadFixture(
          deployGenesisNFTVesting
        );
        const timestamp = vestingStartTimestamp;

        await expect(genesisNFTVesting.connect(deployer).setVestingStartTimestamp(timestamp)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when vesting start timestamp already defined', async () => {
        const { genesisNFTVesting, vestingStartTimestamp, owner } = await loadFixture(deployGenesisNFTVesting);
        const timestamp = vestingStartTimestamp;

        await expect(
          genesisNFTVesting.connect(owner).setVestingStartTimestamp(timestamp)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__VestingStartTimestampAlreadyDefined');
      });

      it('Should revert when vesting start timestamp is past, lower than block timestamp', async () => {
        const {
          owner,
          vestingStartTimestamp,
          duration,
          wlth,
          communityFund,
          genesisNFTSeries1Mirror,
          genesisNFTSeries2Mirror,
          cadence,
          allocation,
          leftoversUnlockDelay,
          deployer
        } = await loadFixture(deployGenesisNFTVesting);

        const genesisNFTVesting: GenesisNFTVesting = await deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            genesisNFTSeries1Mirror.address,
            genesisNFTSeries2Mirror.address,
            wlth.address,
            communityFund.address,
            duration,
            cadence,
            allocation,
            leftoversUnlockDelay,
            0
          ],
          deployer
        );
        const timestamp = vestingStartTimestamp - 1;
        time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(owner).setVestingStartTimestamp(timestamp)
        ).to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__PastVestingStartTimestamp');
      });
    });
  });

  describe('Emergency withdraw', () => {
    describe('Success', () => {
      it('Should emergency withdraw avaiable tokens from a series 1 token', async () => {
        const {
          genesisNFTVesting,
          owner,
          user1Series1Tokens,
          vestingStartTimestamp,
          duration,
          series1MaxReward,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);
        await expect(genesisNFTVesting.connect(owner).setLostToken(true, user1Series1Tokens[0]));

        await expect(genesisNFTVesting.connect(owner).emergencyWithdraw(true, user1Series1Tokens[0], owner.address))
          .to.emit(genesisNFTVesting, 'EmergencyWithdrawalPerformed')
          .withArgs(1, user1Series1Tokens[0], owner.address, series1MaxReward);

        expect(wlth.transfer).to.have.been.calledWith(owner.address, series1MaxReward);
      });

      it('Should emergency withdraw avaiable tokens from a series 2 token', async () => {
        const {
          genesisNFTVesting,
          owner,
          user1Series2Tokens,
          vestingStartTimestamp,
          duration,
          series2MaxReward,
          wlth
        } = await loadFixture(deployGenesisNFTVesting);

        await time.increaseTo(vestingStartTimestamp + duration);
        await expect(genesisNFTVesting.connect(owner).setLostToken(false, user1Series2Tokens[0]));

        await expect(genesisNFTVesting.connect(owner).emergencyWithdraw(false, user1Series2Tokens[0], owner.address))
          .to.emit(genesisNFTVesting, 'EmergencyWithdrawalPerformed')
          .withArgs(2, user1Series2Tokens[0], owner.address, series2MaxReward);

        expect(wlth.transfer).to.have.been.calledWith(owner.address, series2MaxReward);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not owner of the nft series 1', async () => {
        const { genesisNFTVesting, user1, user2Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNFTVesting.connect(user1).emergencyWithdraw(true, user2Series1Tokens[0], user1.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it("Should revert when a series 1 token isn't set as lost", async () => {
        const { genesisNFTVesting, owner, user1Series1Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(genesisNFTVesting.connect(owner).emergencyWithdraw(true, user1Series1Tokens[0], owner.address))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenNotLost')
          .withArgs(1, user1Series1Tokens[0]);
      });

      it("Should revert when a series 2 token isn't set as lost", async () => {
        const { genesisNFTVesting, owner, user1Series2Tokens, vestingStartTimestamp } = await loadFixture(
          deployGenesisNFTVesting
        );

        await expect(genesisNFTVesting.connect(owner).emergencyWithdraw(false, user1Series2Tokens[0], owner.address))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__TokenNotLost')
          .withArgs(2, user1Series2Tokens[0]);
      });
    });
  });

  describe('Surplus withdraw', () => {
    describe('Success', () => {
      it('Should withdraw surplus from the contract', async () => {
        const { genesisNFTVesting, owner, wlth, allocation } = await loadFixture(deployGenesisNFTVesting);

        const surplusWithdrawalAddress = Wallet.createRandom().address;
        const surplus = parseEther('1000');
        wlth.balanceOf.whenCalledWith(genesisNFTVesting.address).returns(allocation.add(surplus));

        await expect(genesisNFTVesting.connect(owner).withdrawSurplus(surplusWithdrawalAddress))
          .to.emit(genesisNFTVesting, 'SurplusWithdrawn')
          .withArgs(surplusWithdrawalAddress, surplus);

        expect(wlth.transfer).to.have.been.calledWith(surplusWithdrawalAddress, surplus);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not owner', async () => {
        const { genesisNFTVesting, user1 } = await loadFixture(deployGenesisNFTVesting);

        await expect(genesisNFTVesting.connect(user1).withdrawSurplus(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when no surplus', async () => {
        const { genesisNFTVesting, owner, wlth, allocation } = await loadFixture(deployGenesisNFTVesting);

        const surplusWithdrawalAddress = Wallet.createRandom().address;
        wlth.balanceOf.whenCalledWith(genesisNFTVesting.address).returns(allocation);

        await expect(genesisNFTVesting.connect(owner).withdrawSurplus(surplusWithdrawalAddress))
          .to.be.revertedWithCustomError(genesisNFTVesting, 'GenesisNFTVesting__NoSurplus')
          .withArgs(allocation, 0, allocation);
      });
    });
  });
});
