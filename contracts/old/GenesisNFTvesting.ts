import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { GenesisNFTV1, GenesisNFTV2, GenesisNFTVesting, StakingGenesisNFT, Wlth } from '../../typechain-types';

// TODO: fix timestamp manipulation crashes next tests issue
describe('Vesting Genesis NFT unit tests', () => {
  const ONE_MONTH = 2592000;
  const TWO_YEARS = 24 * ONE_MONTH;
  const duration = TWO_YEARS;
  const cadence = ONE_MONTH;

  const deployGenesisNftVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
    const [deployer, owner, beneficiary] = await ethers.getSigners();
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const stakingGenNFT: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
    const genNFTseries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFT');
    const genNFTseries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFT');

    const genesisNftVesting: GenesisNFTVesting = await deploy(
      'GenesisNFTVesting',
      [
        owner.address,
        wlth.address,
        duration,
        cadence,
        vestingStartTimestamp,
        genNFTseries1.address,
        genNFTseries2.address,
        stakingGenNFT.address
      ],
      deployer
    );

    return {
      owner,
      genesisNftVesting,
      wlth,
      deployer,
      duration,
      cadence,
      vestingStartTimestamp,
      genNFTseries1,
      genNFTseries2,
      stakingGenNFT,
      beneficiary
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const {
        genesisNftVesting,
        wlth,
        duration,
        vestingStartTimestamp,
        cadence,
        genNFTseries1,
        genNFTseries2,
        stakingGenNFT
      } = await loadFixture(deployGenesisNftVesting);

      expect(await genesisNftVesting.token()).to.equal(wlth.address);
      expect(await genesisNftVesting.duration()).to.equal(duration);
      expect(await genesisNftVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await genesisNftVesting.cadence()).to.equal(cadence);
      expect(await genesisNftVesting.genNftSeries1Contract()).to.equal(genNFTseries1.address);
      expect(await genesisNftVesting.genNftSeries2Contract()).to.equal(genNFTseries2.address);
      expect(await genesisNftVesting.stakingGenNftContract()).to.equal(stakingGenNFT.address);
    });
  });

  describe('releasableAmount()', () => {
    it('Should return no releaseable tokens if timestamp before vesting start', async () => {
      const { genesisNftVesting, vestingStartTimestamp, beneficiary, genNFTseries1 } = await loadFixture(
        deployGenesisNftVesting
      );
      await time.increaseTo(vestingStartTimestamp - 1);
      genNFTseries1.balanceOf.returns(1);
      genNFTseries1.ownerOf.returns(beneficiary.address);

      expect(
        await genesisNftVesting
          .connect(beneficiary)
          .releaseableAmount([1], [], vestingStartTimestamp, beneficiary.address)
      ).to.equal(0);
    });

    it('Should return releaseable amount of WLTH for series 1 token after first cadence from vesting start moment', async () => {
      const { genesisNftVesting, vestingStartTimestamp, genNFTseries1, beneficiary, cadence } = await loadFixture(
        deployGenesisNftVesting
      );
      await time.increaseTo(vestingStartTimestamp + cadence);
      genNFTseries1.balanceOf.returns(1);
      genNFTseries1.ownerOf.returns(beneficiary.address);
      expect(
        await genesisNftVesting
          .connect(beneficiary)
          .releaseableAmount([1], [], vestingStartTimestamp + cadence, beneficiary.address)
      ).to.equal(1833);
    });

    it('Should return releaseable amount of WLTH for series 2 token after first cadence from vesting start moment', async () => {
      const { genesisNftVesting, vestingStartTimestamp, genNFTseries2, beneficiary, cadence } = await loadFixture(
        deployGenesisNftVesting
      );
      await time.increaseTo(vestingStartTimestamp + cadence);
      genNFTseries2.balanceOf.returns(1);
      genNFTseries2.ownerOf.returns(beneficiary.address);
      expect(
        await genesisNftVesting
          .connect(beneficiary)
          .releaseableAmount([], [1], vestingStartTimestamp + cadence, beneficiary.address)
      ).to.equal(268);
    });

    it('Should return whole series 1 token allocation at duration pass moment', async () => {
      const { genesisNftVesting, duration, vestingStartTimestamp, beneficiary, genNFTseries1 } = await loadFixture(
        deployGenesisNftVesting
      );
      await time.increaseTo(vestingStartTimestamp + duration);
      genNFTseries1.balanceOf.returns(1);
      genNFTseries1.ownerOf.returns(beneficiary.address);

      expect(
        await genesisNftVesting
          .connect(beneficiary)
          .releaseableAmount([1], [], vestingStartTimestamp + duration, beneficiary.address)
      ).to.equal(44000);
    });

    it('Should return whole series 2 token allocation at duration pass moment', async () => {
      const { genesisNftVesting, duration, vestingStartTimestamp, beneficiary, genNFTseries2 } = await loadFixture(
        deployGenesisNftVesting
      );
      await time.increaseTo(vestingStartTimestamp + duration);
      genNFTseries2.balanceOf.returns(1);
      genNFTseries2.ownerOf.returns(beneficiary.address);

      expect(
        await genesisNftVesting
          .connect(beneficiary)
          .releaseableAmount([], [1], vestingStartTimestamp + duration, beneficiary.address)
      ).to.equal(6444);
    });

    it('Should return whole token allocation at duration pass moment with bonus included', async () => {
      const { genesisNftVesting, duration, vestingStartTimestamp, owner, beneficiary, genNFTseries1 } =
        await loadFixture(deployGenesisNftVesting);
      await time.increaseTo(vestingStartTimestamp + duration);
      genNFTseries1.balanceOf.returns(1);
      genNFTseries1.ownerOf.returns(beneficiary.address);

      await genesisNftVesting.connect(owner).bonusSetup([1]);

      expect(
        await genesisNftVesting
          .connect(beneficiary)
          .releaseableAmount([1], [], vestingStartTimestamp + duration, beneficiary.address)
      ).to.equal(48400);
    });

    describe('release()', () => {
      it('Should not release tokens before vesting time', async () => {
        const { genesisNftVesting, vestingStartTimestamp, beneficiary, wlth } = await loadFixture(
          deployGenesisNftVesting
        );
        await time.increaseTo(vestingStartTimestamp - 100);

        await expect(
          genesisNftVesting.connect(beneficiary).release(1, [1], [], beneficiary.address)
        ).to.be.revertedWith('Vesting has not started yet!');
      });

      it('Should release tokens within vesting time', async () => {
        const { genesisNftVesting, vestingStartTimestamp, beneficiary, cadence, wlth, duration } = await loadFixture(
          deployGenesisNftVesting
        );
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(100000);

        await time.increaseTo(vestingStartTimestamp + cadence);
        await genesisNftVesting.connect(beneficiary).release(1000, [1], [], beneficiary.address);
        expect(await genesisNftVesting.connect(beneficiary).released()).to.equal(1000);

        await time.increaseTo(vestingStartTimestamp + 2 * cadence);
        await genesisNftVesting.connect(beneficiary).release(1000, [1], [], beneficiary.address);
        expect(await genesisNftVesting.connect(beneficiary).released()).to.equal(2000);

        await time.increaseTo(vestingStartTimestamp + duration);
        await genesisNftVesting.connect(beneficiary).release(42000, [1], [], beneficiary.address);
        expect(await genesisNftVesting.connect(beneficiary).released()).to.equal(44000);
      });

      it('Should revert releasing tokens if not enough vested', async () => {
        const { genesisNftVesting, vestingStartTimestamp, beneficiary, wlth } = await loadFixture(
          deployGenesisNftVesting
        );
        wlth.transfer.returns(true);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNftVesting.connect(beneficiary).release(2000, [1], [], beneficiary.address)
        ).to.be.revertedWith('Not enough tokens vested!');
      });

      it('Should revert releasing tokens if not beneficiary', async () => {
        const { genesisNftVesting, vestingStartTimestamp, beneficiary, wlth, genNFTseries1, deployer } =
          await loadFixture(deployGenesisNftVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(100000);
        genNFTseries1.balanceOf.returns(1);
        genNFTseries1.ownerOf.returns(deployer.address);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          genesisNftVesting.connect(deployer).release(1000, [1], [], beneficiary.address)
        ).to.be.revertedWithCustomError(genesisNftVesting, 'TokenNotOwnedByWallet');
      });

      it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
        const { genesisNftVesting, vestingStartTimestamp, beneficiary, wlth, cadence, genNFTseries1 } =
          await loadFixture(deployGenesisNftVesting);
        wlth.balanceOf.returns(0);
        genNFTseries1.balanceOf.returns(1);
        genNFTseries1.ownerOf.returns(beneficiary.address);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          genesisNftVesting.connect(beneficiary).release(1000, [1], [], beneficiary.address)
        ).to.be.revertedWith('Not enough tokens to process the release!');
      });

      it('Should revert releasing tokens if transfer fails', async () => {
        const { genesisNftVesting, vestingStartTimestamp, beneficiary, wlth, genNFTseries1 } = await loadFixture(
          deployGenesisNftVesting
        );
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(100000);
        genNFTseries1.balanceOf.returns(1);
        genNFTseries1.ownerOf.returns(beneficiary.address);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          genesisNftVesting.connect(beneficiary).release(1000, [1], [], beneficiary.address)
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
      });
    });
  });
});
