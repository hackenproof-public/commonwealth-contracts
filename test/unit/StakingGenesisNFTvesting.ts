import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { StakingGenesisNFT, StakingGenesisNFTvesting, USDC } from '../../typechain-types';

describe('StakingGenesisNFTvesting unit tests', () => {
  let usdc: FakeContract<USDC>;
  let stakingGenesisNFT: FakeContract<StakingGenesisNFT>;
  let vesting: StakingGenesisNFTvesting;

  const STAKING_LARGE_AMOUNT = 200;
  const STAKING_SMALL_AMOUNT = 100;
  const HUGE_AMOUNT = 999_999_999_999;
  const deployStakingGenesisNFTvesting = async () => {
    const [deployer, claimer] = await ethers.getSigners();

    usdc = await smock.fake('USDC');
    stakingGenesisNFT = await smock.fake('StakingGenesisNFT');

    vesting = await deployProxy(
      'StakingGenesisNFTvesting',
      [deployer.address, usdc.address, stakingGenesisNFT.address, Date.now()],
      deployer
    );

    return { vesting, usdc, owner: deployer, claimer, stakingGenesisNFT };
  };

  const resetFakes = (usdc: FakeContract<USDC>, stakingGenesisNFT: FakeContract<StakingGenesisNFT>) => {
    usdc.balanceOf.reset();
    usdc.transfer.reset();
    stakingGenesisNFT.getRewardLarge.reset();
    stakingGenesisNFT.getRewardSmall.reset();
  };

  before(async () => {
    await deployStakingGenesisNFTvesting();
  });

  beforeEach(async () => {
    resetFakes(usdc, stakingGenesisNFT);

    stakingGenesisNFT.getRewardLarge.returns(STAKING_LARGE_AMOUNT);
    stakingGenesisNFT.getRewardSmall.returns(STAKING_SMALL_AMOUNT);

    usdc.balanceOf.whenCalledWith(vesting.address).returns(HUGE_AMOUNT);
  });

  describe('#claim()', () => {
    it('Should fail if no vested currency was provided', async () => {
      const { vesting, usdc } = await loadFixture(deployStakingGenesisNFTvesting);
      usdc.balanceOf.whenCalledWith(vesting.address).returns(0);

      await expect(vesting.claim(STAKING_LARGE_AMOUNT)).to.be.revertedWith(
        'Vesting contract does not have enough currency to process the claim!'
      );
    });

    it('Should fail if no claimer does not have any tokens to claim', async () => {
      const { vesting, usdc, owner, stakingGenesisNFT } = await loadFixture(deployStakingGenesisNFTvesting);
      stakingGenesisNFT.getRewardLarge.returns(0);
      stakingGenesisNFT.getRewardSmall.returns(0);

      await expect(vesting.claim(STAKING_LARGE_AMOUNT)).to.be.revertedWith("You can't claim that many tokens");
    });

    it('Should allow to claim deserved amount of tokens in one go', async () => {
      const { vesting, usdc, owner, claimer, stakingGenesisNFT } = await loadFixture(deployStakingGenesisNFTvesting);

      await expect(vesting.connect(claimer).claim(STAKING_LARGE_AMOUNT + STAKING_SMALL_AMOUNT)).to.not.be.reverted;
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, STAKING_LARGE_AMOUNT + STAKING_SMALL_AMOUNT);
    });

    it('Should allow to claim deserved amount of tokens in three goes', async () => {
      const { vesting, usdc, owner, claimer, stakingGenesisNFT } = await loadFixture(deployStakingGenesisNFTvesting);

      await expect(vesting.connect(claimer).claim(STAKING_SMALL_AMOUNT)).to.not.be.reverted;
      await expect(vesting.connect(claimer).claim(STAKING_LARGE_AMOUNT - 10)).to.not.be.reverted;
      await expect(vesting.connect(claimer).claim(10)).to.not.be.reverted;
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, STAKING_SMALL_AMOUNT);
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, STAKING_LARGE_AMOUNT - 10);
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, 10);
    });

    it('Should not allow to exceed claimable tokens', async () => {
      const { vesting, usdc, owner, claimer, stakingGenesisNFT } = await loadFixture(deployStakingGenesisNFTvesting);

      await expect(vesting.connect(claimer).claim(STAKING_SMALL_AMOUNT)).to.not.be.reverted;
      await expect(vesting.connect(claimer).claim(STAKING_LARGE_AMOUNT)).to.not.be.reverted;
      await expect(vesting.connect(claimer).claim(1)).to.be.revertedWith("You can't claim that many tokens");
      await expect(vesting.connect(owner).claim(STAKING_LARGE_AMOUNT)).to.not.be.reverted;
    });

    it('Should revert claiming if paused', async () => {
      const { vesting, usdc, owner, claimer, stakingGenesisNFT } = await loadFixture(deployStakingGenesisNFTvesting);
      await vesting.connect(owner).pause();

      await expect(vesting.claim(STAKING_LARGE_AMOUNT)).to.be.revertedWith('Pausable: paused');
    });
  });
});
