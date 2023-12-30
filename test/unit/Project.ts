import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { formatBytes32String } from 'ethers/lib/utils';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  InvestmentFund,
  IProject__factory,
  PeriodicVesting,
  Project,
  UniswapSwapper,
  USDC
} from '../../typechain-types';
import { getInterfaceId, toUsdc } from '../utils';

describe('Project unit tests', () => {
  const defaultProjectName = 'Project 1';
  const IProjectId = ethers.utils.arrayify(getInterfaceId(IProject__factory.createInterface()));

  const deployProject = async () => {
    const [deployer, wallet, owner] = await ethers.getSigners();
    const fundsAllocation = toUsdc('100000');
    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
    const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
    const project: Project = await deployProxy(
      'Project',
      [defaultProjectName, owner.address, usdc.address, swapper.address, investmentFund.address, fundsAllocation],
      deployer
    );

    const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');
    await project.connect(owner).setVesting(vesting.address);

    return { project, vesting, deployer, wallet, owner, investmentFund, usdc, fundsAllocation };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { project, vesting } = await loadFixture(deployProject);
      expect(await project.name()).to.equal(defaultProjectName);
      expect(await project.status()).to.equal(formatBytes32String('Added'));
      expect(await project.vesting()).to.equal(vesting.address);
      expect(await project.supportsInterface(IProjectId)).to.equal(true);
    });

    it('Should revert deploying if token is zero address', async () => {
      const [deployer, wallet, owner] = await ethers.getSigners();
      const fundsAllocation = toUsdc('100000');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      await expect(
        deployProxy(
          'Project',
          [defaultProjectName, owner.address, constants.AddressZero, swapper.address, investmentFund.address, fundsAllocation],
          deployer
        )
      ).to.be.revertedWith('Token is zero address');
    });

    it('Should revert deploying if investment fund is zero address', async () => {
      const [deployer, wallet, owner] = await ethers.getSigners();
      const fundsAllocation = toUsdc('100000');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      await expect(
        deployProxy(
          'Project',
          [defaultProjectName, owner.address, usdc.address, swapper.address, constants.AddressZero, fundsAllocation],
          deployer
        )
      ).to.be.revertedWith('Investment is zero address');
    });

    it('Should revert deploying if swapper is zero address', async () => {
      const [deployer, wallet, owner] = await ethers.getSigners();
      const fundsAllocation = toUsdc('100000');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      await expect(
        deployProxy(
          'Project',
          [defaultProjectName, owner.address, usdc.address, constants.AddressZero, investmentFund.address, fundsAllocation],
          deployer
        )
      ).to.be.revertedWith('Swapper is zero address');
    });
  });

  describe('#setVesting()', () => {
    it('Should set vesting contract', async () => {
      const { project, vesting, owner } = await loadFixture(deployProject);
      const newVesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');

      await expect(project.connect(owner).setVesting(newVesting.address))
        .to.emit(project, 'VestingContractChanged')
        .withArgs(owner.address, vesting.address, newVesting.address);

      expect(await project.vesting()).to.equal(newVesting.address);
    });

    it('Should revert setting vesting contract if not owner', async () => {
      const { project, vesting } = await loadFixture(deployProject);

      await expect(project.setVesting(vesting.address)).to.be.revertedWith('Ownable: caller is not the owner');
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
    it('Should return funds allocation', async () => {
      const { project } = await loadFixture(deployProject);

      expect(await project.getFundsAllocation()).to.equal(toUsdc('100000'));
    });
  });

  describe('#sellVestedToInvestmentFund()', () => {
    it('Should revert if amount is zero', async () => {
      const { project, owner } = await loadFixture(deployProject);

      await expect(project.connect(owner).sellVestedToInvestmentFund(0)).to.be.revertedWith(
        'Amount has to be above zero'
      );
    });
  });
});
