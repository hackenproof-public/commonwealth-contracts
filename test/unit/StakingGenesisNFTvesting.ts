import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { StakingGenesisNFT, StakingGenNFTVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe('Vesting Staking Genesis NFT unit tests', () => {
  const TWENTY_FOUR_BILIONS = '24000000';
  const SECONDS_IN_YEAR = 31536000;

  const ONE_MONTH = SECONDS_IN_YEAR / 12;

  const ONE_TOKEN = toWlth('1');
  const allocation = toWlth(TWENTY_FOUR_BILIONS);

  const deployStakingGenesisNftVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

    const [deployer, beneficiary, owner] = await ethers.getSigners();
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const stakingGenNFT: FakeContract<StakingGenesisNFT> = await smock.fake('StakingGenesisNFT');
    const stakingGenNftVesting: StakingGenNFTVesting = await deploy(
      'StakingGenNFTVesting',
      [owner.address, wlth.address, allocation, vestingStartTimestamp, stakingGenNFT.address],
      deployer
    );

    return {
      owner,
      stakingGenNftVesting,
      wlth,
      deployer,
      beneficiary,
      allocation,
      vestingStartTimestamp,
      stakingGenNFT
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { stakingGenNftVesting, wlth, stakingGenNFT, allocation, vestingStartTimestamp, owner } = await loadFixture(
        deployStakingGenesisNftVesting
      );

      expect(await stakingGenNftVesting.token()).to.equal(wlth.address);
      expect(await stakingGenNftVesting.owner()).to.equal(owner.address);
      expect(await stakingGenNftVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await stakingGenNftVesting.allocation()).to.equal(allocation);
      expect(await stakingGenNftVesting.stakingGenNftAddress()).to.equal(stakingGenNFT.address);
    });
  });

  describe('getReleasableAmount()', () => {
    describe('release()', () => {
      it('Should not release tokens before vesting time', async () => {
        const { stakingGenNftVesting, vestingStartTimestamp, beneficiary, wlth, stakingGenNFT } = await loadFixture(
          deployStakingGenesisNftVesting
        );
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        stakingGenNFT.getRewardLarge.returns(27);
        stakingGenNFT.getRewardSmall.returns(4);
        await time.increaseTo(vestingStartTimestamp - 100);

        await expect(
          stakingGenNftVesting.connect(beneficiary).release(toWlth('100'), beneficiary.address)
        ).to.be.revertedWith('Vesting has not started yet!');
      });

      it('Should release 3000 tokens after vesting time', async () => {
        const { stakingGenNftVesting, vestingStartTimestamp, beneficiary, wlth, allocation, stakingGenNFT } =
          await loadFixture(deployStakingGenesisNftVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        stakingGenNFT.getRewardLarge.returns(2000);
        stakingGenNFT.getRewardSmall.returns(1000);

        await time.increaseTo(vestingStartTimestamp);
        await stakingGenNftVesting.connect(beneficiary).release(toWlth('3000'), beneficiary.address);
        expect(await stakingGenNftVesting.connect(beneficiary).released()).to.equal(toWlth('3000'));
      });

      it('Should revert releasing tokens if wallet does not have any NFTs staked', async () => {
        const { stakingGenNftVesting, vestingStartTimestamp, beneficiary, wlth, deployer, stakingGenNFT } =
          await loadFixture(deployStakingGenesisNftVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        stakingGenNFT.getRewardLarge.returns(0);
        stakingGenNFT.getRewardSmall.returns(0);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          stakingGenNftVesting.connect(deployer).release(toWlth('1'), beneficiary.address)
        ).to.be.revertedWith('Unauthorized access!');
      });

      it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
        const { stakingGenNftVesting, vestingStartTimestamp, beneficiary, wlth, stakingGenNFT } = await loadFixture(
          deployStakingGenesisNftVesting
        );
        wlth.balanceOf.returns(0);
        stakingGenNFT.getRewardLarge.returns(27);
        stakingGenNFT.getRewardSmall.returns(4);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          stakingGenNftVesting.connect(beneficiary).release(toWlth('1'), beneficiary.address)
        ).to.be.revertedWith('Not enough tokens to process the release!');
      });

      it('Should revert releasing tokens if transfer fails', async () => {
        const { stakingGenNftVesting, vestingStartTimestamp, beneficiary, wlth, stakingGenNFT } = await loadFixture(
          deployStakingGenesisNftVesting
        );
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(toWlth('10'));
        stakingGenNFT.getRewardLarge.returns(27);
        stakingGenNFT.getRewardSmall.returns(4);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          stakingGenNftVesting.connect(beneficiary).release(toWlth('1'), beneficiary.address)
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
      });
    });
  });
});
