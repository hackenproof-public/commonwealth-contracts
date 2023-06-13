import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { formatBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { IProject__factory, PeriodicVesting, Project, UniswapSwapper } from '../../typechain-types';
import { getInterfaceId } from '../utils';

describe('Periodic vesting project unit tests', () => {
  const defaultProjectName = 'Project 1';
  const IProjectId = ethers.utils.arrayify(getInterfaceId(IProject__factory.createInterface()));

  const deployProject = async () => {
    const [deployer, wallet] = await ethers.getSigners();

    const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
    const project: Project = await deployProxy(
      'Project',
      [defaultProjectName, deployer.address, swapper.address],
      deployer
    );

    const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');
    await project.setVesting(vesting.address);

    return { project, vesting, deployer, wallet };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const [deployer] = await ethers.getSigners();

      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      const project: Project = await deployProxy(
        'Project',
        [defaultProjectName, deployer.address, swapper.address],
        deployer
      );

      expect(await project.name()).to.equal(defaultProjectName);
      expect(await project.status()).to.equal(formatBytes32String('Added'));
      expect(await project.vesting()).to.equal(ethers.constants.AddressZero);
      expect(await project.supportsInterface(IProjectId)).to.equal(true);
    });

    it('Should revert deployment if owner is zero address', async () => {
      const [deployer] = await ethers.getSigners();

      await expect(
        deployProxy(
          'Project',
          [defaultProjectName, ethers.constants.AddressZero, ethers.constants.AddressZero],
          deployer
        )
      ).to.be.revertedWith('Owner is zero address');
    });
  });

  describe('#setVesting()', () => {
    it('Should set vesting contract', async () => {
      const [deployer] = await ethers.getSigners();

      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      const project: Project = await deployProxy(
        'Project',
        [defaultProjectName, deployer.address, swapper.address],
        deployer
      );
      const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');

      await expect(project.setVesting(vesting.address))
        .to.emit(project, 'VestingContractChanged')
        .withArgs(deployer.address, ethers.constants.AddressZero, vesting.address);

      expect(await project.vesting()).to.equal(vesting.address);
    });

    it('Should revert setting vesting contract if not owner', async () => {
      const { project } = await loadFixture(deployProject);

      await expect(project.setVesting(ethers.constants.AddressZero)).to.be.revertedWith('Vesting is zero address');
    });

    it('Should revert setting vesting contract if not owner', async () => {
      const { project, vesting, wallet } = await loadFixture(deployProject);

      await expect(project.connect(wallet).setVesting(vesting.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#getDetails()', () => {
    it('Should return project details', async () => {
      const { project, vesting } = await loadFixture(deployProject);

      expect(await project.getDetails()).to.deep.equal([
        defaultProjectName,
        formatBytes32String('Added'),
        vesting.address
      ]);
    });
  });

  const SOME_ADDRESS = '0xbd3Afb0bB76683eCb4225F9DBc91f998713C3b01';

  describe('#sellVestedToInvestmentFund()', () => {
    it('Should reject if amount is zero', async () => {
      const { project } = await loadFixture(deployProject);

      await expect(project.sellVestedToInvestmentFund(0, SOME_ADDRESS)).to.be.revertedWith(
        'Amount has to be above zero'
      );
    });
  });
});
