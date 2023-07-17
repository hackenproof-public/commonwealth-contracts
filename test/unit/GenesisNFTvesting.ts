import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFT, GenesisNFTvesting, USDC } from '../../typechain-types';

describe('GenesisNFTvesting unit tests', () => {
  let usdc: FakeContract<USDC>;
  let genesisNFT: FakeContract<GenesisNFT>;
  let vesting: GenesisNFTvesting;

  const STARTING_TIMESTAMP = Date.now();
  const SECONDS_IN_MONTH = 2_678_400;
  const HUGE_AMOUNT = 999_999_999;
  const ONE_SERIES_ONE_TOKEN_AMOUNT = 44_000;
  const ONE_SERIES_TWO_TOKEN_AMOUNT = 6_444;

  const deployGenesisNFTvesting = async () => {
    const [deployer, claimer] = await ethers.getSigners();

    usdc = await smock.fake('USDC');
    genesisNFT = await smock.fake('GenesisNFT');

    vesting = await deployProxy(
      'GenesisNFTvesting',
      [deployer.address, usdc.address, genesisNFT.address, STARTING_TIMESTAMP],
      deployer
    );

    return { vesting, usdc, owner: deployer, claimer, genesisNFT };
  };

  const resetFakes = (usdc: FakeContract<USDC>, stakingGenesisNFT: FakeContract<GenesisNFT>) => {
    usdc.balanceOf.reset();
    usdc.transfer.reset();
    stakingGenesisNFT.getSeries.reset();
  };

  before(async () => {
    await deployGenesisNFTvesting();
  });

  beforeEach(async () => {
    resetFakes(usdc, genesisNFT);

    usdc.balanceOf.whenCalledWith(vesting.address).returns(HUGE_AMOUNT);
  });

  describe('#claim()', () => {
    it('Should fail if no vested currency was provided', async () => {
      const { vesting, usdc } = await loadFixture(deployGenesisNFTvesting);
      usdc.balanceOf.whenCalledWith(vesting.address).returns(0);

      await expect(vesting.claim(ONE_SERIES_ONE_TOKEN_AMOUNT)).to.be.revertedWith(
        'Vesting contract does not have enough currency to process the claim!'
      );
    });

    it('Should fail if unknown Genesis NFT series was provided', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(3);
      await time.increaseTo(STARTING_TIMESTAMP + SECONDS_IN_MONTH + 1000);

      await expect(vesting.claim(ONE_SERIES_ONE_TOKEN_AMOUNT)).to.be.revertedWith('Unknown Genesis NFT token series');
    });

    it('Should fail if no claimer does not have any tokens to claim', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(1);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(0);
      await time.increaseTo(STARTING_TIMESTAMP + SECONDS_IN_MONTH + 1000);

      await expect(vesting.claim(ONE_SERIES_ONE_TOKEN_AMOUNT)).to.be.revertedWith("You can't claim that many tokens");
    });

    it('Should allow to claim deserved amount of series one tokens in one go', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(1);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(2);
      await time.increaseTo(STARTING_TIMESTAMP + SECONDS_IN_MONTH + 1000);

      const expectedReward = Math.floor((1 / 24) * 2 * ONE_SERIES_ONE_TOKEN_AMOUNT);

      await expect(vesting.connect(claimer).claim(expectedReward)).to.not.be.reverted;
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, expectedReward);
    });

    it('Should revert too big claim for series one GEnesis NFT', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(1);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(2);
      await time.increaseTo(STARTING_TIMESTAMP + SECONDS_IN_MONTH + 1000);

      const expectedReward = Math.floor((1 / 24) * 2 * ONE_SERIES_ONE_TOKEN_AMOUNT);

      await expect(vesting.connect(claimer).claim(expectedReward + 1)).to.be.revertedWith(
        "You can't claim that many tokens"
      );
    });

    it('Should allow to claim whole reward', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(1);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(2);
      await time.increaseTo(STARTING_TIMESTAMP + SECONDS_IN_MONTH * 24 + 1000);

      const expectedReward = Math.floor(2 * ONE_SERIES_ONE_TOKEN_AMOUNT);

      await expect(vesting.connect(claimer).claim(expectedReward)).to.not.be.reverted;
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, expectedReward);
    });

    it('Should not continue vesting after period is over', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(1);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(2);
      await time.increaseTo(STARTING_TIMESTAMP + SECONDS_IN_MONTH * 44 + 1000);

      const expectedReward = Math.floor(2 * ONE_SERIES_ONE_TOKEN_AMOUNT);

      await expect(vesting.connect(claimer).claim(expectedReward)).to.not.be.reverted;
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, expectedReward);
    });

    it('Should allow to claim deserved amount of series two tokens in one go', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(2);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(3);
      await time.increaseTo(STARTING_TIMESTAMP + 2 * SECONDS_IN_MONTH + 1000);

      const expectedReward = Math.floor((2 / 24) * 3 * ONE_SERIES_TWO_TOKEN_AMOUNT);

      await expect(vesting.connect(claimer).claim(expectedReward)).to.not.be.reverted;
      expect(usdc.transfer).to.have.been.calledWith(claimer.address, expectedReward);
    });

    it('Should revert too big claim for series two GEnesis NFT', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      genesisNFT.getSeries.returns(2);
      genesisNFT.balanceOf.whenCalledWith(claimer.address).returns(3);
      await time.increaseTo(STARTING_TIMESTAMP + 2 * SECONDS_IN_MONTH + 1000);

      const expectedReward = Math.floor((2 / 24) * 3 * ONE_SERIES_TWO_TOKEN_AMOUNT);

      await expect(vesting.connect(claimer).claim(expectedReward + 1)).to.be.revertedWith(
        "You can't claim that many tokens"
      );
    });

    it('Should revert claiming if paused', async () => {
      const { vesting, usdc, owner, claimer, genesisNFT } = await loadFixture(deployGenesisNFTvesting);
      await vesting.connect(owner).pause();

      await expect(vesting.claim(ONE_SERIES_ONE_TOKEN_AMOUNT)).to.be.revertedWith('Pausable: paused');
    });
  });
});
