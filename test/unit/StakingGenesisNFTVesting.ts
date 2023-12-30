import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { deployProxy } from '../../scripts/utils';
import { constants } from 'ethers';
import { StakingGenesisNFT, StakingGenNFTVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe('Staking GenesisNFT Vesting unit tests', () => {
  const TWENTY_FOUR_BILIONS = '24000000';
  const SECONDS_IN_YEAR = 31536000;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const ONE_MONTH = Math.floor(SECONDS_IN_YEAR / 12);
  const ONE_SECOND = 1;
  const ONE_TOKEN = toWlth('1');
  const allocation = toWlth(TWENTY_FOUR_BILIONS);

  const deploySimpleVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

    const [deployer, beneficiary1, beneficiary2, owner] = await ethers.getSigners();
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
    const stakingGenNFTVesting: StakingGenNFTVesting = await deploy(
      'StakingGenNFTVesting',
      [owner.address, wlth.address, allocation, vestingStartTimestamp, stakingGenesisNft.address],
      deployer
    );

    return {
      owner,
      stakingGenNFTVesting,
      wlth,
      deployer,
      allocation,
      vestingStartTimestamp,
      beneficiary1,
      beneficiary2,
      stakingGenesisNft
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { wlth, allocation, vestingStartTimestamp, stakingGenesisNft, stakingGenNFTVesting } = await loadFixture(
        deploySimpleVesting
      );

      expect(await stakingGenNFTVesting.token()).to.equal(wlth.address);
      expect(await stakingGenNFTVesting.stakingGenNftAddress()).to.equal(stakingGenesisNft.address);
      expect(await stakingGenNFTVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await stakingGenNFTVesting.allocation()).to.equal(allocation);
    });

    it('Should revert deploying if staking nft is zero address', async () => {
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

      const [deployer, beneficiary1, beneficiary2, owner] = await ethers.getSigners();
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
      await expect(
        deployProxy(
          'StakingGenNFTVesting',
          [owner.address, wlth.address, allocation, vestingStartTimestamp, constants.AddressZero],
          deployer
        )
      ).to.be.revertedWith('Genesis NFT is zero address');
    });

    it('Should revert deploying if token is zero address', async () => {
      const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

      const [deployer, beneficiary1, beneficiary2, owner] = await ethers.getSigners();
      const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
      const stakingGenesisNft: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
      await expect(
        deployProxy(
          'StakingGenNFTVesting',
          [owner.address, constants.AddressZero, allocation, vestingStartTimestamp, stakingGenesisNft.address],
          deployer
        )
      ).to.be.revertedWith('Token is zero address');
    });
  });

  describe('getReleasableAmount()', () => {
    it('Should return no releaseable tokens if timestamp before vesting start', async () => {
      const { stakingGenNFTVesting, wlth, vestingStartTimestamp, allocation, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

      expect(await stakingGenNFTVesting.connect(beneficiary1).releaseableAmount(beneficiary1.address)).to.equal(0);
    });

    it('Should return releaseable tokens at vesting timestamp moment', async () => {
      const { stakingGenNFTVesting, vestingStartTimestamp, wlth, allocation, beneficiary1, stakingGenesisNft } =
        await loadFixture(deploySimpleVesting);
      wlth.balanceOf.returns(allocation);
      stakingGenesisNft.getRewardLarge.returns(21);

      await time.increaseTo(vestingStartTimestamp);
      expect(await stakingGenNFTVesting.connect(beneficiary1).releaseableAmount(beneficiary1.address)).to.equal(
        toWlth('21')
      );
    });

    describe('release()', () => {
      it('Should revert if user does not have any Genesis NFTs staked', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth } =
          await loadFixture(deploySimpleVesting);
        wlth.balanceOf.returns(allocation);
        stakingGenesisNft.getRewardLarge.returns(0);
        stakingGenesisNft.getRewardSmall.returns(0);

        await expect(
          stakingGenNFTVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
        ).to.be.revertedWith('Unauthorized access!');
      });

      it('Should not release tokens before vesting time', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth } =
          await loadFixture(deploySimpleVesting);
        wlth.balanceOf.returns(allocation);
        stakingGenesisNft.getRewardLarge.returns(1);
        await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

        await expect(
          stakingGenNFTVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
        ).to.be.revertedWith('Vesting has not started yet!');
      });

      it('Should revert releasing tokens if not enough vested', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        stakingGenesisNft.getRewardLarge.returns(21);
        await time.increaseTo(vestingStartTimestamp);
        await stakingGenNFTVesting.connect(beneficiary1).release(toWlth('20'), beneficiary1.address);

        await expect(
          stakingGenNFTVesting.connect(beneficiary1).release(toWlth('20'), beneficiary1.address)
        ).to.be.revertedWith('Not enough tokens vested!');
      });

      it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth } =
          await loadFixture(deploySimpleVesting);
        wlth.balanceOf.returns(0);
        stakingGenesisNft.getRewardLarge.returns(21);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          stakingGenNFTVesting.connect(beneficiary1).release(toWlth('20'), beneficiary1.address)
        ).to.be.revertedWith('Not enough tokens to process the release!');
      });

      it('Should release tokens if wallet has only Series 1 Genesis NFT Staked', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth, deployer } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        stakingGenesisNft.getRewardLarge.returns(21);
        await time.increaseTo(vestingStartTimestamp);
        await expect(stakingGenNFTVesting.connect(beneficiary1).release(toWlth('21'), beneficiary1.address));
      });

      it('Should release tokens if wallet has only Series 2 Genesis NFT Staked', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth, deployer } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(allocation);
        stakingGenesisNft.getRewardSmall.returns(6);
        await time.increaseTo(vestingStartTimestamp);
        await expect(stakingGenNFTVesting.connect(beneficiary1).release(toWlth('6'), beneficiary1.address));
      });

      it('Should release tokens if wallet has both Series 1 and Series 2 Genesis NFT Staked', async () => {
        const { stakingGenNFTVesting, stakingGenesisNft, vestingStartTimestamp, beneficiary1, wlth, deployer } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(allocation);
        stakingGenesisNft.getRewardLarge.returns(21);
        stakingGenesisNft.getRewardSmall.returns(6);
        await time.increaseTo(vestingStartTimestamp);

        await expect(stakingGenNFTVesting.connect(beneficiary1).release(toWlth('27'), beneficiary1.address));
      });
    });
  });
});
