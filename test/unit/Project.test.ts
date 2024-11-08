import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { formatBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  InvestmentFund,
  InvestmentNFT,
  IProject__factory,
  PeriodicVesting,
  ProfitProvider,
  Project,
  StakingWlth,
  UniswapSwapper,
  USDC
} from '../../typechain-types';
import { getInterfaceId, toUsdc } from '../utils';

describe('Project unit tests', () => {
  const defaultProjectName = 'Project 1';
  const IProjectId = ethers.utils.arrayify(getInterfaceId(IProject__factory.createInterface()));

  const deployProject = async () => {
    const [deployer, wallet, owner, investmentFundSigner] = await ethers.getSigners();
    const fundsAllocation = toUsdc('100000');
    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
    const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
    const project: Project = await deployProxy(
      'Project',
      [defaultProjectName, owner.address, usdc.address, swapper.address, investmentFundSigner.address, fundsAllocation],
      deployer
    );

    const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');
    await project.connect(owner).setVesting(vesting.address);

    return {
      project,
      vesting,
      deployer,
      wallet,
      owner,
      investmentFund,
      usdc,
      fundsAllocation,
      investmentFundSigner,
      swapper
    };
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
      const { project } = await loadFixture(deployProject);
      const [deployer, wallet, owner] = await ethers.getSigners();
      const fundsAllocation = toUsdc('100000');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      await expect(
        deployProxy(
          'Project',
          [
            defaultProjectName,
            owner.address,
            constants.AddressZero,
            swapper.address,
            investmentFund.address,
            fundsAllocation
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(project, 'Project__TokenZeroAddress');
    });

    it('Should revert deploying if investment fund is zero address', async () => {
      const { project } = await loadFixture(deployProject);
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
      ).to.be.revertedWithCustomError(project, 'Project__InvestmentFundZeroAddress');
    });

    it('Should revert deploying if swapper is zero address', async () => {
      const { project } = await loadFixture(deployProject);
      const [deployer, wallet, owner] = await ethers.getSigners();
      const fundsAllocation = toUsdc('100000');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      await expect(
        deployProxy(
          'Project',
          [
            defaultProjectName,
            owner.address,
            usdc.address,
            constants.AddressZero,
            investmentFund.address,
            fundsAllocation
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(project, 'Project__DexSwapperZeroAddress');
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

    it('Should revert setting zero address as vesting contract', async () => {
      const { project, vesting, owner } = await loadFixture(deployProject);

      await expect(project.connect(owner).setVesting(constants.AddressZero)).to.be.revertedWithCustomError(
        project,
        'Project__VestingZeroAddress'
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

  describe('#deployFunds()', () => {
    it('Should revert if amount is zero', async () => {
      const { project, investmentFundSigner } = await loadFixture(deployProject);

      await expect(project.connect(investmentFundSigner).deployFunds(0)).to.be.revertedWithCustomError(
        project,
        'Project__AmountLessOrEqualZero'
      );
    });

    it('Should revert if amount exceeds avaliable funds for this project', async () => {
      const { project, investmentFundSigner, fundsAllocation } = await loadFixture(deployProject);

      await expect(
        project.connect(investmentFundSigner).deployFunds(fundsAllocation.add(toUsdc('1')))
      ).to.be.revertedWithCustomError(project, 'Project__AmountExceedAvailableFunds');
    });

    it('Should revert if by not investment funds assigned to this project', async () => {
      const { project, owner, fundsAllocation } = await loadFixture(deployProject);

      await expect(project.connect(owner).deployFunds(fundsAllocation)).to.be.revertedWithCustomError(
        project,
        'Project__NotInvestmentFund'
      );
    });

    it('Should revert if investment funds does not have enough USDC', async () => {
      const { project, owner, fundsAllocation, usdc } = await loadFixture(deployProject);
      usdc.balanceOf.returns(fundsAllocation.sub(toUsdc('1')));

      await expect(project.connect(owner).deployFunds(fundsAllocation)).to.be.reverted;
    });

    it('Should deploy all funds available at once', async () => {
      const { project, investmentFundSigner, fundsAllocation, usdc } = await loadFixture(deployProject);
      usdc.balanceOf.returns(fundsAllocation);
      await expect(project.connect(investmentFundSigner).deployFunds(fundsAllocation));
    });

    it('Should deploy all funds available at two tranches', async () => {
      const { project, investmentFundSigner, fundsAllocation, usdc } = await loadFixture(deployProject);
      usdc.balanceOf.returns(fundsAllocation);
      const tranche1 = fundsAllocation.sub(toUsdc('2000'));
      const tranche2 = toUsdc('2000');

      await expect(project.connect(investmentFundSigner).deployFunds(tranche1));
      await expect(project.connect(investmentFundSigner).deployFunds(tranche2));
    });
  });

  describe('#sellVestedToInvestmentFund()', () => {
    it('Should revert if amount is zero', async () => {
      const { project, owner } = await loadFixture(deployProject);
      const _amount = 0;
      const _fee = 500;
      const _sqrtPriceLimitX96 = 0;
      const _amountOutMinimum = 0;
      await expect(
        project.connect(owner).sellVestedToInvestmentFund(_amount, _fee, _sqrtPriceLimitX96, _amountOutMinimum)
      ).to.be.revertedWithCustomError(project, 'Project__AmountLessOrEqualZero');
    });

    it('Should revert if vesting contract is zero address', async () => {
      const [deployer, owner, investmentFundSigner] = await ethers.getSigners();
      const fundsAllocation = toUsdc('100000');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      const project: Project = await deployProxy(
        'Project',
        [
          defaultProjectName,
          owner.address,
          usdc.address,
          swapper.address,
          investmentFundSigner.address,
          fundsAllocation
        ],
        deployer
      );

      const _amount = 1;
      const _fee = 500;
      const _sqrtPriceLimitX96 = 0;
      const _amountOutMinimum = 0;
      await expect(
        project.connect(owner).sellVestedToInvestmentFund(_amount, _fee, _sqrtPriceLimitX96, _amountOutMinimum)
      ).to.be.revertedWithCustomError(project, 'Project__VestingZeroAddress');
    });

    it('Should revert if swap fails', async () => {
      const { project, owner, swapper } = await loadFixture(deployProject);
      swapper.swap.returns(false);
      const _amount = 1;
      const _fee = 500;
      const _sqrtPriceLimitX96 = 0;
      const _amountOutMinimum = 0;
      await expect(
        project.connect(owner).sellVestedToInvestmentFund(_amount, _fee, _sqrtPriceLimitX96, _amountOutMinimum)
      ).to.be.reverted;
    });

    it('Should revert providing zero profit to investment fund', async () => {
      const { owner } = await loadFixture(deployProject);

      const defaultManagementFee = 1000;
      const defaultInvestmentCap = toUsdc('1000000');
      const maxPercentageWalletInvestmentLimit = 2000;
      const [treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund, unlocker, deployer] =
        await ethers.getSigners();
      const feeDistributionAddresses = {
        treasuryWallet: treasuryWallet.address,
        lpPool: lpPool.address,
        burn: burnAddr.address,
        communityFund: communityFund.address,
        genesisNftRevenue: genesisNftRevenue.address
      };

      const fundsAllocation = toUsdc('100000');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      investmentNft.supportsInterface.returns(true);
      const minimumInvestment = toUsdc('50');
      const profitProvider: FakeContract<ProfitProvider> = await smock.fake('ProfitProvider');
      const investmentFund: InvestmentFund = await deployProxy(
        'InvestmentFund',
        [
          owner.address,
          unlocker.address,
          'someFund',
          usdc.address,
          investmentNft.address,
          staking.address,
          feeDistributionAddresses,
          defaultManagementFee,
          defaultInvestmentCap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider.address
        ],
        deployer
      );

      const project: Project = await deployProxy(
        'Project',
        [defaultProjectName, owner.address, usdc.address, swapper.address, investmentFund.address, fundsAllocation],
        deployer
      );

      const _amount = 1;
      const _fee = 500;
      const _sqrtPriceLimitX96 = 0;
      const _amountOutMinimum = 0;

      const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');
      await project.connect(owner).setVesting(vesting.address);

      await investmentFund.connect(owner).addProject(owner.address);
      swapper.swap.returns(0);
      await expect(
        project.connect(owner).sellVestedToInvestmentFund(_amount, _fee, _sqrtPriceLimitX96, _amountOutMinimum)
      ).to.be.reverted;
    });

    it('Should revert providing profit if addres is not registered as project', async () => {
      const { owner } = await loadFixture(deployProject);

      const defaultManagementFee = 1000;
      const defaultInvestmentCap = toUsdc('1000000');
      const maxPercentageWalletInvestmentLimit = 2000;

      const [treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund, unlocker, deployer] =
        await ethers.getSigners();
      const feeDistributionAddresses = {
        treasuryWallet: treasuryWallet.address,
        lpPool: lpPool.address,
        burn: burnAddr.address,
        communityFund: communityFund.address,
        genesisNftRevenue: genesisNftRevenue.address
      };

      const fundsAllocation = toUsdc('100000');
      const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      investmentNft.supportsInterface.returns(true);
      const minimumInvestment = toUsdc('50');
      const profitProvider: FakeContract<ProfitProvider> = await smock.fake('ProfitProvider');

      const investmentFund: InvestmentFund = await deployProxy(
        'InvestmentFund',
        [
          owner.address,
          unlocker.address,
          'someFund',
          usdc.address,
          investmentNft.address,
          staking.address,
          feeDistributionAddresses,
          defaultManagementFee,
          defaultInvestmentCap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider.address
        ],
        deployer
      );

      const project: Project = await deployProxy(
        'Project',
        [defaultProjectName, owner.address, usdc.address, swapper.address, investmentFund.address, fundsAllocation],
        deployer
      );

      const _amount = 100;
      const _fee = 500;
      const _sqrtPriceLimitX96 = 0;
      const _amountOutMinimum = 0;

      const vesting: FakeContract<PeriodicVesting> = await smock.fake('PeriodicVesting');
      vesting.getVestedToken.returns(usdc.address);
      await project.connect(owner).setVesting(vesting.address);
      usdc.balanceOf.returns(100);
      swapper.swap.returns(100);
      await expect(
        project.connect(owner).sellVestedToInvestmentFund(_amount, _fee, _sqrtPriceLimitX96, _amountOutMinimum)
      ).to.be.reverted;
    });
  });
});
