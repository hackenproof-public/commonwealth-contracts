import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { GenesisNFTV1, GenesisNFTV2, GenesisNFTVesting, StakingGenesisNFT, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe('Genesis NFT Vesting unit tests', function () {
  const deployFixture = async () => {
    const TWENTY_FOUR_BILIONS = 24000000;
    const SECONDS_IN_YEAR = 31536000;
    const TWO_YEARS = 2 * SECONDS_IN_YEAR;
    const ONE_MONTH = SECONDS_IN_YEAR / 12;
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
    const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
    const cadence = ONE_MONTH;
    const duration = TWO_YEARS;

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
    const genNFTseries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
    const genNFTseries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFTV2');
    const [deployer, owner] = await ethers.getSigners();

    const genesisNFTVesting: GenesisNFTVesting = await deploy(
      'GenesisNFTVesting',
      [
        owner.address,
        wlth.address,
        duration,
        cadence,
        vestingStartTimestamp,
        genNFTseries1.address,
        genNFTseries2.address,
        stakingGenesisNft.address
      ],
      deployer
    );

    return {
      genesisNFTVesting,
      deployer,
      owner,
      wlth,
      duration,
      cadence,
      vestingStartTimestamp,
      stakingGenesisNft,
      genNFTseries1,
      genNFTseries2
    };
  };

  describe('Deployment', function () {
    it('Should deploy', async () => {
      const {
        genesisNFTVesting,
        owner,
        wlth,
        duration,
        cadence,
        vestingStartTimestamp,
        stakingGenesisNft,
        genNFTseries1,
        genNFTseries2
      } = await loadFixture(deployFixture);

      expect(await genesisNFTVesting.owner()).to.equal(owner.address);
      expect(await genesisNFTVesting.token()).to.equal(wlth.address);
      expect(await genesisNFTVesting.duration()).to.equal(duration);
      expect(await genesisNFTVesting.cadence()).to.equal(cadence);
      expect(await genesisNFTVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await genesisNFTVesting.genNftSeries1Contract()).to.equal(genNFTseries1.address);
      expect(await genesisNFTVesting.genNftSeries2Contract()).to.equal(genNFTseries2.address);
      expect(await genesisNFTVesting.stakingGenNftContract()).to.equal(stakingGenesisNft.address);
    });

    it('Should revert deploying if token address is zero', async () => {
      const { genesisNFTVesting } = await loadFixture(deployFixture);
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
      const genNFTseries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
      const genNFTseries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFTV2');
      const [deployer, owner] = await ethers.getSigners();

      const TWENTY_FOUR_BILIONS = 24000000;
      const SECONDS_IN_YEAR = 31536000;
      const TWO_YEARS = 2 * SECONDS_IN_YEAR;
      const ONE_MONTH = SECONDS_IN_YEAR / 12;
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
      const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
      const cadence = ONE_MONTH;
      const duration = TWO_YEARS;
      await expect(
        deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            constants.AddressZero,
            duration,
            cadence,
            vestingStartTimestamp,
            genNFTseries1.address,
            genNFTseries2.address,
            stakingGenesisNft.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__TokenZeroAddress');
    });

    it('Should revert deploying if Gen1 address is zero', async () => {
      const { genesisNFTVesting } = await loadFixture(deployFixture);
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
      const genNFTseries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
      const genNFTseries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFTV2');
      const [deployer, owner] = await ethers.getSigners();

      const TWENTY_FOUR_BILIONS = 24000000;
      const SECONDS_IN_YEAR = 31536000;
      const TWO_YEARS = 2 * SECONDS_IN_YEAR;
      const ONE_MONTH = SECONDS_IN_YEAR / 12;
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
      const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
      const cadence = ONE_MONTH;
      const duration = TWO_YEARS;
      await expect(
        deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            wlth.address,
            duration,
            cadence,
            vestingStartTimestamp,
            constants.AddressZero,
            genNFTseries2.address,
            stakingGenesisNft.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__GenesisNftSeries1ZeroAddress');
    });

    it('Should revert deploying if Gen2 address is zero', async () => {
      const { genesisNFTVesting } = await loadFixture(deployFixture);
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
      const genNFTseries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
      const genNFTseries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFTV2');
      const [deployer, owner] = await ethers.getSigners();

      const TWENTY_FOUR_BILIONS = 24000000;
      const SECONDS_IN_YEAR = 31536000;
      const TWO_YEARS = 2 * SECONDS_IN_YEAR;
      const ONE_MONTH = SECONDS_IN_YEAR / 12;
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
      const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
      const cadence = ONE_MONTH;
      const duration = TWO_YEARS;
      await expect(
        deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            wlth.address,
            duration,
            cadence,
            vestingStartTimestamp,
            genNFTseries1.address,
            constants.AddressZero,
            stakingGenesisNft.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__GenesisNftSeries2ZeroAddress');
    });

    it('Should revert deploying if staking Genesis NFT contract address is zero', async () => {
      const { genesisNFTVesting } = await loadFixture(deployFixture);
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
      const genNFTseries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
      const genNFTseries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFTV2');
      const [deployer, owner] = await ethers.getSigners();

      const TWENTY_FOUR_BILIONS = 24000000;
      const SECONDS_IN_YEAR = 31536000;
      const TWO_YEARS = 2 * SECONDS_IN_YEAR;
      const ONE_MONTH = SECONDS_IN_YEAR / 12;
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;
      const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
      const cadence = ONE_MONTH;
      const duration = TWO_YEARS;
      await expect(
        deploy(
          'GenesisNFTVesting',
          [
            owner.address,
            wlth.address,
            duration,
            cadence,
            vestingStartTimestamp,
            genNFTseries1.address,
            genNFTseries2.address,
            constants.AddressZero
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__StakingGenesisNftZeroAddress');
    });
  });

  describe('Bonus logic', function () {
    it('Should setup list of tokens affected by bonus', async () => {
      const { genesisNFTVesting, owner } = await loadFixture(deployFixture);

      expect(await genesisNFTVesting.connect(owner).bonusSetup([1, 12, 3, 5, 6, 63, 28]));
    });

    it('Should include bonus in total WHLT allocation for NFT affected by bonus', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1 } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      expect(await genesisNFTVesting.connect(owner).bonusSetup([1]));
      expect(await genesisNFTVesting.connect(owner).getBonusValue(1)).to.equal(4400);
      expect(await genesisNFTVesting.connect(owner).releaseableAmount([1], [], timestamp, owner.address)).to.equal(
        toWlth('48400')
      );
    });

    it('Should not include bonus in total WHLT allocation for NFT not affected by bonus', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1 } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      expect(await genesisNFTVesting.connect(owner).bonusSetup([2]));
      expect(await genesisNFTVesting.connect(owner).getBonusValue(1)).to.equal(0);
      expect(await genesisNFTVesting.connect(owner).releaseableAmount([1], [], timestamp, owner.address)).to.equal(
        toWlth('44000')
      );
    });
  });

  describe('Releasable Amount', function () {
    it('Should return releasable amount of WLTH for beneficiary', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1 } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      expect(await genesisNFTVesting.connect(owner).releaseableAmount([1], [], timestamp, owner.address)).to.equal(
        toWlth('44000')
      );
    });

    it('Should return releasable amount of WLTH for given Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1 } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      expect(await genesisNFTVesting.connect(owner).releaseableAmountPerNFT(true, 1, timestamp)).to.equal(
        toWlth('44000')
      );
    });
  });

  describe('Release', function () {
    it('Should revert if address is not the owner of given Genesis NFTs', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, deployer } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(deployer.address);

      const timestamp = vestingStartTimestamp;
      await time.increaseTo(timestamp);
      await expect(
        genesisNFTVesting.connect(owner).releasePerNFT(true, 1, toWlth('1'), owner.address)
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__NotOwnerOfGenesisNft');
    });

    it('Should revert if address does not have any Genesis NFTs', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1 } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(0));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp;
      await time.increaseTo(timestamp);
      await expect(
        genesisNFTVesting.connect(owner).releasePerNFT(true, 1, toWlth('1'), owner.address)
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__AccessDenied');
    });

    it('Should revert if vesting has not started yet', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries1 } = await loadFixture(deployFixture);

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      const timestamp = vestingStartTimestamp - 2;
      await time.increaseTo(timestamp);
      await expect(
        genesisNFTVesting.connect(owner).releasePerNFT(true, 1, toWlth('1'), owner.address)
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__VestingNotStarted');
    });

    it('Should revert if not enough tokens vested', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration / 2;
      await time.increaseTo(timestamp);
      await expect(
        genesisNFTVesting.connect(owner).releasePerNFT(true, 1, toWlth('44000'), owner.address)
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__NotEnoughTokensVested');
    });

    it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      await expect(
        genesisNFTVesting.connect(owner).releasePerNFT(true, 1, toWlth('1'), owner.address)
      ).to.be.revertedWithCustomError(genesisNFTVesting,'GenesisNftVesting__InsufficientTokensOnContract');
    });

    it('Should release all tokens availabe for the specific Genesis NFT owned by beneficiary', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(toWlth('100000'));
      wlth.transfer.returns(true);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      expect(await genesisNFTVesting.connect(owner).releasePerNFT(true, 1, toWlth('44000'), owner.address));
    });

    it('Should release all tokens availabe for the beneficiary', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, genNFTseries2, wlth } =
        await loadFixture(deployFixture);

      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(toWlth('100000'));
      wlth.transfer.returns(true);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);
      expect(await genesisNFTVesting.connect(owner).releaseAllAvailable([1], [1], owner.address));
    });
  });

  describe('Vested/Unvested Getters', function () {
    it('Should return proper unvested WLTH amount at vesting start for Series1 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries1, wlth } = await loadFixture(deployFixture);
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(true, 1, timestamp)).to.equal(
        toWlth('44000')
      );
    });

    it('Should return proper vested WLTH amount at vesting start for Series1 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries1, wlth } = await loadFixture(deployFixture);
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(true, 1, timestamp)).to.equal(toWlth('0'));
    });
    it('Should return proper unvested WLTH amount after single cadence for Series1 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries1, wlth, cadence } = await loadFixture(
        deployFixture
      );
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + cadence;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(true, 1, timestamp)).to.equal(
        toWlth('42166.666666666666666667')
      );
    });

    it('Should return proper vested WLTH amount after single cadence for Series1 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, cadence, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + cadence;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(true, 1, timestamp)).to.equal(
        toWlth('1833.333333333333333333')
      );
    });
    it('Should return proper unvested WLTH amount after full vesting duration for Series1 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(true, 1, timestamp)).to.equal(toWlth('0'));
    });

    it('Should return proper vested WLTH amount after full vesting duration for Series1 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(true, 1, timestamp)).to.equal(
        toWlth('44000')
      );
    });

    it('Should return proper unvested WLTH amount at vesting start for Series2 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries2, wlth } = await loadFixture(deployFixture);
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(false, 1, timestamp)).to.equal(
        toWlth('6444')
      );
    });

    it('Should return proper vested WLTH amount at vesting start for Series2 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries2, wlth } = await loadFixture(deployFixture);
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(false, 1, timestamp)).to.equal(toWlth('0'));
    });
    it('Should return proper unvested WLTH amount after single cadence for Series2 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, genNFTseries2, wlth, cadence } = await loadFixture(
        deployFixture
      );
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + cadence;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(false, 1, timestamp)).to.equal(
        toWlth('6175.500000000000000000')
      );
    });

    it('Should return proper vested WLTH amount after single cadence for Series2 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, cadence, genNFTseries2, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + cadence;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(false, 1, timestamp)).to.equal(
        toWlth('268.5')
      );
    });
    it('Should return proper unvested WLTH amount after full vesting duration for Series2 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries2, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(false, 1, timestamp)).to.equal(toWlth('0'));
    });

    it('Should return proper vested WLTH amount after full vesting duration for Series2 Genesis NFT', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries2, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries2.balanceOf.returns(BigNumber.from(1));
      genNFTseries2.ownerOf.returns(owner.address);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(false, 1, timestamp)).to.equal(
        toWlth('6444')
      );
    });

    it('Should return proper unvested WLTH amount including bonus', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      genesisNFTVesting.connect(owner).bonusSetup([1]);

      const timestamp = vestingStartTimestamp + duration / 2;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getUnvestedAmountPerNft(true, 1, timestamp)).to.equal(
        toWlth('24200')
      );
    });

    it('Should return proper vested WLTH amount including bonus', async () => {
      const { genesisNFTVesting, owner, vestingStartTimestamp, duration, genNFTseries1, wlth } = await loadFixture(
        deployFixture
      );
      genNFTseries1.balanceOf.returns(BigNumber.from(1));
      genNFTseries1.ownerOf.returns(owner.address);
      genesisNFTVesting.connect(owner).bonusSetup([1]);
      wlth.balanceOf.returns(0);

      const timestamp = vestingStartTimestamp + duration;
      await time.increaseTo(timestamp);

      expect(await genesisNFTVesting.connect(owner).getVestedAmountPerNft(true, 1, timestamp)).to.equal(
        toWlth('48400')
      );
    });
  });
});
