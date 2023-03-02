import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { formatBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { IPeriodicVesting__factory, IVesting__factory, PeriodicVesting, Project, USDC } from '../../typechain-types';
import { getInterfaceId, getInterfaceIdWithBase, toUsdc } from '../utils';

describe('Project integration tests', () => {
  const defaultProjectName = 'Project 1';
  const IPeriodicVestingId = ethers.utils.arrayify(
    getInterfaceIdWithBase([IPeriodicVesting__factory.createInterface(), IVesting__factory.createInterface()])
  );
  const IVestingId = ethers.utils.arrayify(getInterfaceId(IVesting__factory.createInterface()));

  const deployProjectWithPeriodicVesting = async () => {
    const [deployer] = await ethers.getSigners();

    const project: Project = await deploy('Project', deployer, [defaultProjectName, deployer.address]);

    const beneficiary = project;
    const startBlock = (await ethers.provider.getBlockNumber()) + 10;
    const totalAllocation = toUsdc('100');
    const duration = 10;
    const cadence = 1;
    const cliff = 0;

    const usdc: USDC = await deploy('USDC', deployer, []);
    const vesting: PeriodicVesting = await deploy('PeriodicVesting', deployer, [
      usdc.address,
      beneficiary.address,
      startBlock,
      [[totalAllocation, duration, cadence, cliff]]
    ]);

    await project.setVesting(vesting.address);

    return { project, vesting, usdc, deployer, beneficiary, startBlock, totalAllocation, duration, cadence, cliff };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { project, vesting } = await loadFixture(deployProjectWithPeriodicVesting);

      expect(await project.name()).to.equal(defaultProjectName);
      expect(await project.status()).to.equal(formatBytes32String('Added'));
      expect(await project.vesting()).to.equal(vesting.address);
    });
  });

  describe('Project details', () => {
    it('Should return project details', async () => {
      const { project, vesting, usdc, beneficiary, startBlock, totalAllocation, duration, cadence, cliff } =
        await loadFixture(deployProjectWithPeriodicVesting);

      expect(await project.getDetails()).to.deep.equal([
        defaultProjectName,
        formatBytes32String('Added'),
        vesting.address
      ]);

      expect(await vesting.supportsInterface(IPeriodicVestingId)).to.equal(true);
      expect(await vesting.supportsInterface(IVestingId)).to.equal(true);

      expect(await vesting.getDetails()).to.deep.equal([
        usdc.address,
        beneficiary.address,
        startBlock,
        [[totalAllocation, duration, cadence, cliff]]
      ]);
    });
  });
});
