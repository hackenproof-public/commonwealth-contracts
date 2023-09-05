import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { formatBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy, deployProxy } from '../../scripts/utils';
import {
  InvestmentFund,
  InvestmentNFT,
  IPeriodicVesting__factory,
  IVesting__factory,
  PeriodicVesting,
  Project,
  QuoterMock,
  StakingWlth,
  UniswapQuoter,
  UniswapSwapper,
  USDC,
  Wlth
} from '../../typechain-types';
import { getInterfaceId, getInterfaceIdWithBase, toUsdc } from '../utils';

describe('Project component tests', () => {
  const SECONDS_IN_YEAR = 31536000;
  const SOME_USDC_AMOUNT = toUsdc('1000000');
  const ONE_YEAR = 1 * SECONDS_IN_YEAR;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const THREE_YEARS = 3 * SECONDS_IN_YEAR;
  const FOUR_YEARS = 4 * SECONDS_IN_YEAR;
  const managementFee = 1000;
  const defaultFee = 200;
  const defaultInvestmentCap = toUsdc('1000000');
  const defaultTreasury = ethers.Wallet.createRandom().address;
  const maxStakingDiscount = 4000;

  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let wallet: SignerWithAddress;
  let profitProvider: SignerWithAddress;

  async function deployFixture() {
    [deployer, owner, wallet, profitProvider] = await ethers.getSigners();

    const IPeriodicVestingId = ethers.utils.arrayify(
      getInterfaceIdWithBase([IPeriodicVesting__factory.createInterface(), IVesting__factory.createInterface()])
    );
    const IVestingId = ethers.utils.arrayify(getInterfaceId(IVesting__factory.createInterface()));
    const startBlock = (await ethers.provider.getBlockNumber()) + 10;
    const totalAllocation = toUsdc('100');
    const duration = 10;
    const cadence = 1;
    const coeffecients = [5000, 3750, 3125, 2500];
    const cliff = 0;
    const treasury = defaultTreasury;
    const usdc: USDC = await deploy('USDC', [], deployer);
    const investmentNft: InvestmentNFT = await deployProxy('InvestmentNFT', ['INFT', 'CWI', owner.address], deployer);
    const wlth: Wlth = await deployProxy('Wlth', ['Common Wealth Token', 'WLTH', owner.address], deployer);
    const extQuoter: FakeContract<QuoterMock> = await smock.fake('QuoterMock');
    const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
    const quoter: UniswapQuoter = await deployProxy('UniswapQuoter', [extQuoter.address, 3000], deployer);
    const defaultProjectName = 'Project1';
    const staking: StakingWlth = await deployProxy(
      'StakingWlth',
      [
        owner.address,
        wlth.address,
        usdc.address,
        quoter.address,
        defaultFee,
        treasury,
        maxStakingDiscount,
        [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
        coeffecients
      ],
      deployer
    );
    const investmentFund: InvestmentFund = await deployProxy(
      'InvestmentFund',
      [
        owner.address,
        'Investment Fund',
        usdc.address,
        investmentNft.address,
        staking.address,
        treasury,
        managementFee,
        defaultInvestmentCap
      ],
      deployer
    );

    const project: Project = await deployProxy(
      'Project',
      [defaultProjectName, owner.address, swapper.address],
      deployer
    );

    const beneficiary = project;

    await investmentNft.connect(owner).addMinter(investmentFund.address);
    await staking.connect(owner).registerFund(investmentFund.address);

    await usdc.mint(deployer.address, SOME_USDC_AMOUNT);
    await usdc.mint(wallet.address, SOME_USDC_AMOUNT);
    await usdc.mint(profitProvider.address, SOME_USDC_AMOUNT);

    const vesting: PeriodicVesting = await deployProxy(
      'PeriodicVesting',
      [usdc.address, project.address, startBlock, [[totalAllocation, duration, cadence, cliff]]],
      deployer
    );

    const vesting1: PeriodicVesting = await deployProxy(
      'PeriodicVesting',
      [usdc.address, deployer.address, startBlock, [[totalAllocation, duration, cadence, cliff]]],
      deployer
    );

    await usdc.mint(vesting.address, toUsdc('1000'));

    await project.connect(owner).setVesting(vesting.address);
    await investmentFund.connect(owner).addProject(project.address);

    return {
      project,
      vesting,
      usdc,
      deployer,
      beneficiary,
      startBlock,
      totalAllocation,
      duration,
      cadence,
      cliff,
      investmentFund,
      defaultProjectName,
      IPeriodicVestingId,
      IVestingId,
      vesting1,
      swapper
    };
  }

  describe('Deployment', () => {
    it('Should deploy', async () => {
      const { investmentFund, usdc, project } = await loadFixture(deployFixture);

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await project.name()).to.equal('Project1');
      expect(await usdc.balanceOf(deployer.address)).to.equal(SOME_USDC_AMOUNT);
      expect(await usdc.balanceOf(wallet.address)).to.equal(SOME_USDC_AMOUNT);
      expect(await usdc.balanceOf(profitProvider.address)).to.equal(SOME_USDC_AMOUNT);
    });
  });

  describe('Project details', () => {
    it('Should return project details', async () => {
      const {
        project,
        vesting,
        usdc,
        beneficiary,
        startBlock,
        totalAllocation,
        duration,
        cadence,
        cliff,
        defaultProjectName,
        IPeriodicVestingId,
        IVestingId
      } = await loadFixture(deployFixture);

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

  describe('Provide profit', () => {
    it('Should revert if provides zero profit', async () => {
      const { project, investmentFund } = await loadFixture(deployFixture);
      await expect(project.connect(owner).sellVestedToInvestmentFund(0, investmentFund.address)).to.be.revertedWith(
        'Amount has to be above zero'
      );
    });
    it('Should revert if project is not a beneficiary', async () => {
      const { project, investmentFund, vesting1, usdc, duration } = await loadFixture(deployFixture);

      await project.connect(owner).setVesting(vesting1.address);
      await usdc.mint(vesting1.address, toUsdc('10'));
      await mine(duration);
      await expect(project.connect(owner).sellVestedToInvestmentFund(1, investmentFund.address)).to.be.revertedWith(
        'Unauthorized access'
      );
    });
    it('Should provide profit to Investment Fund', async () => {
      const { project, investmentFund, usdc, swapper, duration } = await loadFixture(deployFixture);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();
      await swapper.swap.returns(toUsdc('10'));
      await mine(duration);
      const investmentFundBalance = await usdc.balanceOf(investmentFund.address);
      await project.connect(owner).sellVestedToInvestmentFund(toUsdc('10'), investmentFund.address);
      expect(await usdc.balanceOf(investmentFund.address)).to.equal(investmentFundBalance.add(toUsdc('10')));
    });
  });
});
