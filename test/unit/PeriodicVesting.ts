import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, mineUpTo } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { PeriodicVesting, USDC } from '../../typechain-types';
import { toUsdc } from '../utils';

describe('Periodic vesting unit tests', () => {
  const deployPeriodicVesting = async () => {
    const [deployer, wallet] = await ethers.getSigners();

    const beneficiary = wallet;
    const startBlock = (await ethers.provider.getBlockNumber()) + 10;
    const totalAllocation = toUsdc('100');
    const duration = 10;
    const cadence = 1;
    const cliff = 0;

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const vesting: PeriodicVesting = await deploy('PeriodicVesting', deployer, [
      usdc.address,
      beneficiary.address,
      startBlock,
      [[totalAllocation, duration, cadence, cliff]]
    ]);

    return { vesting, usdc, deployer, beneficiary, startBlock, totalAllocation, duration, cadence, cliff };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { vesting, usdc, beneficiary, startBlock, totalAllocation } = await loadFixture(deployPeriodicVesting);

      expect(await vesting.getVestedToken()).to.equal(usdc.address);
      expect(await vesting.beneficiary()).to.equal(beneficiary.address);
      expect(await vesting.startBlock()).to.equal(startBlock);
      expect(await vesting.totalAllocation()).to.equal(totalAllocation);
      expect(await vesting.totalDuration()).to.equal(10);
      expect(await vesting.periods(0)).to.deep.equal([totalAllocation, 10, 1, 0]);
    });
  });

  describe('#getReleasableAmount()', () => {
    it('Should return no releasable tokens if timestamp before vesting start', async () => {
      const { vesting, startBlock } = await loadFixture(deployPeriodicVesting);
      await mineUpTo(startBlock - 1);

      expect(await vesting.getReleasableAmount()).to.equal(0);
    });

    [
      { duration: 10, cadence: 1, distribution: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1000] },
      { duration: 10, cadence: 5, distribution: [0, 0, 0, 0, 0, 500, 500, 500, 500, 500, 1000, 1000, 1000] }
    ].forEach((data) => {
      it(`Should return releasable tokens within duration depending on cadence [cadence=${data.cadence}]`, async () => {
        const [deployer, wallet] = await ethers.getSigners();

        const startBlock = (await ethers.provider.getBlockNumber()) + 10;
        const totalAllocation = 1000;

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const vesting: PeriodicVesting = await deploy('PeriodicVesting', deployer, [
          usdc.address,
          wallet.address,
          startBlock,
          [[totalAllocation, data.duration, data.cadence, 0]]
        ]);

        for (let i = 0; i < data.distribution.length; i++) {
          await mineUpTo(startBlock + i);
          expect(await vesting.getReleasableAmount()).to.equal(data.distribution[i]);
        }
      });
    });

    it('Should return all tokens from the beginning', async () => {
      const [deployer, wallet] = await ethers.getSigners();

      const startBlock = (await ethers.provider.getBlockNumber()) + 10;
      const totalAllocation = 1000;
      const duration = 0;

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const vesting: PeriodicVesting = await deploy('PeriodicVesting', deployer, [
        usdc.address,
        wallet.address,
        startBlock,
        [[totalAllocation, duration, duration, 0]]
      ]);

      await mineUpTo(startBlock);
      expect(await vesting.getReleasableAmount()).to.equal(totalAllocation);
    });

    [
      {
        periods: [
          { allocation: 1000, duration: 10, cadence: 1, cliff: 0 },
          { allocation: 30, duration: 6, cadence: 1, cliff: 0 }
        ],
        distribution: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1005, 1010, 1015, 1020, 1025, 1030, 1030]
      },
      {
        periods: [
          { allocation: 10, duration: 1, cadence: 1, cliff: 0 },
          { allocation: 30, duration: 6, cadence: 2, cliff: 0 },
          { allocation: 40, duration: 4, cadence: 3, cliff: 0 }
        ],
        distribution: [0, 10, 10, 20, 20, 30, 30, 40, 40, 40, 70, 80]
      },
      {
        periods: [{ allocation: 100, duration: 5, cadence: 1, cliff: 3 }],
        distribution: [0, 0, 0, 60, 80, 100, 100]
      }
    ].forEach((data) => {
      it('Should return releasable tokens if multiple periods', async () => {
        const [deployer, wallet] = await ethers.getSigners();

        const startBlock = (await ethers.provider.getBlockNumber()) + 10;
        let inputPeriods = data.periods.map((p) => [p.allocation, p.duration, p.cadence, p.cliff]);

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const vesting: PeriodicVesting = await deploy('PeriodicVesting', deployer, [
          usdc.address,
          wallet.address,
          startBlock,
          inputPeriods
        ]);

        for (let i = 0; i < data.distribution.length; i++) {
          await mineUpTo(startBlock + i);
          expect(await vesting.getReleasableAmount()).to.equal(data.distribution[i]);
        }
      });
    });
  });

  describe('#release()', () => {
    it('Should release tokens', async () => {
      const { vesting, usdc, startBlock, beneficiary } = await loadFixture(deployPeriodicVesting);
      usdc.transfer.returns(true);

      await mineUpTo(startBlock + 1);
      expect(await vesting.released()).to.equal(0);

      await expect(vesting.connect(beneficiary).release(toUsdc('10')))
        .to.emit(vesting, 'Released')
        .withArgs(beneficiary.address, usdc.address, toUsdc('10'));

      expect(await vesting.released()).to.equal(toUsdc('10'));
    });

    it('Should release tokens within vesting time', async () => {
      const { vesting, usdc, startBlock, beneficiary, duration } = await loadFixture(deployPeriodicVesting);
      usdc.transfer.returns(true);

      await mineUpTo(startBlock + 1);
      expect(await vesting.getReleasableAmount()).to.equal(toUsdc('10'));

      await expect(vesting.connect(beneficiary).release(toUsdc('3')))
        .to.emit(vesting, 'Released')
        .withArgs(beneficiary.address, usdc.address, toUsdc('3'));

      expect(await vesting.getReleasableAmount()).to.equal(toUsdc('17')); // new block mined so additional tokens vested

      await mineUpTo(startBlock + duration); // last vesting block
      expect(await vesting.getReleasableAmount()).to.equal(toUsdc('97'));
      await expect(vesting.connect(beneficiary).release(toUsdc('97')))
        .to.emit(vesting, 'Released')
        .withArgs(beneficiary.address, usdc.address, toUsdc('97'));

      expect(await vesting.getReleasableAmount()).to.equal(toUsdc('0'));
    });

    it('Should revert releasing tokens if not enough vested', async () => {
      const { vesting, usdc, startBlock, beneficiary } = await loadFixture(deployPeriodicVesting);
      usdc.transfer.returns(true);
      await mineUpTo(startBlock + 1);

      // new block is mined for release transaction so new tokens are vested
      await expect(vesting.connect(beneficiary).release(toUsdc('20').add(1))).to.be.revertedWith(
        'Not enough tokens vested'
      );
    });

    it('Should revert releasing tokens if not beneficiary', async () => {
      const { vesting, usdc, startBlock, deployer } = await loadFixture(deployPeriodicVesting);
      usdc.transfer.returns(true);
      await mineUpTo(startBlock + 1);

      await expect(vesting.connect(deployer).release(toUsdc('10'))).to.be.revertedWith('Unauthorized access');
    });

    it('Should revert releasing tokens if transfer fails', async () => {
      const { vesting, usdc, startBlock, beneficiary } = await loadFixture(deployPeriodicVesting);
      usdc.transfer.returns(false);
      await mineUpTo(startBlock + 1);

      await expect(vesting.connect(beneficiary).release(toUsdc('10'))).to.be.revertedWith(
        'SafeERC20: ERC20 operation did not succeed'
      );
    });
  });
});
