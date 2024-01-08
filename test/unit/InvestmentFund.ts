import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, mineUpTo, SnapshotRestorer, takeSnapshot, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { formatBytes32String, parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  IInvestmentFund__factory,
  InvestmentFund,
  InvestmentNFT,
  Project,
  StakingWlth,
  USDC
} from '../../typechain-types';
import { FundState, InvestmentFundDeploymentParameters } from '../types';
import { getInterfaceId, toUsdc } from '../utils';

const MAX_UINT240 = BigNumber.from('1766847064778384329583297500742918515827483896875618958121606201292619775');

describe('Investment Fund unit tests', () => {
  const defaultManagementFee = 1000;
  const defaultInvestmentCap = toUsdc('1000000');
  const IInvestmentFundId = ethers.utils.arrayify(getInterfaceId(IInvestmentFund__factory.createInterface()));
  const tokenUri = 'ipfs://token-uri';
  const defaultTreasury = ethers.Wallet.createRandom().address;
  const maxStakingDiscount = 4000;

  let investmentFund: InvestmentFund;
  let usdc: FakeContract<USDC>;
  let investmentNft: FakeContract<InvestmentNFT>;
  let staking: FakeContract<StakingWlth>;
  let project: FakeContract<Project>;
  let restorer: SnapshotRestorer;
  let deployer: SignerWithAddress;
  let wallet: SignerWithAddress;
  let owner: SignerWithAddress;
  let unlocker: SignerWithAddress;
  let communityFund: SignerWithAddress;

  const deployInvestmentFund = async ({
    fundName = 'Investment Fund',
    treasuryWallet = defaultTreasury,
    managementFee = defaultManagementFee,
    cap = defaultInvestmentCap
  }: InvestmentFundDeploymentParameters = {}) => {
    const [deployer, owner, user, wallet, genesisNftRevenue, lpPool, burnAddr, communityFund, unlocker] =
      await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
    const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
    const project: FakeContract<Project> = await smock.fake('Project');

    await owner.sendTransaction({
      to: project.address,
      value: ethers.utils.parseEther('1000')
    });

    investmentNft.supportsInterface.returns(true);

    const feeDistributionAddresses = {
      treasuryWallet: treasuryWallet,
      lpPool: lpPool.address,
      burn: burnAddr.address,
      communityFund: communityFund.address,
      genesisNftRevenue: genesisNftRevenue.address
    };

    const investmentFund: InvestmentFund = await deployProxy(
      'InvestmentFund',
      [
        owner.address,
        unlocker.address,
        fundName,
        usdc.address,
        investmentNft.address,
        staking.address,
        feeDistributionAddresses,
        managementFee,
        cap
      ],
      deployer
    );

    return {
      investmentFund,
      usdc,
      investmentNft,
      staking,
      deployer,
      treasuryWallet,
      wallet,
      owner,
      project,
      genesisNftRevenue,
      lpPool,
      burnAddr,
      communityFund,
      unlocker
    };
  };

  const deployFixture = async () => {
    return deployInvestmentFund();
  };

  const resetFakes = (
    usdc: FakeContract<USDC>,
    investmentNft: FakeContract<InvestmentNFT>,
    staking: FakeContract<StakingWlth>
  ) => {
    investmentNft.getParticipation.reset();
    investmentNft.getPastParticipation.reset();
    investmentNft.getTotalInvestmentValue.reset();
    investmentNft.mint.reset();
    investmentNft.supportsInterface.reset();
    usdc.transfer.reset();
    usdc.transferFrom.reset();
    staking.getDiscountFromPreviousInvestmentInTimestamp.reset();
  };

  const setup = async () => {
    const {
      investmentFund,
      usdc,
      investmentNft,
      staking,
      deployer,
      treasuryWallet,
      wallet,
      owner,
      project,
      genesisNftRevenue,
      lpPool,
      burnAddr,
      communityFund,
      unlocker
    } = await loadFixture(deployFixture);

    resetFakes(usdc, investmentNft, staking);

    usdc.transferFrom.returns(true);
    investmentNft.supportsInterface.returns(true);
    investmentNft.mint.returns(1);

    return {
      investmentFund,
      usdc,
      investmentNft,
      staking,
      deployer,
      treasuryWallet,
      wallet,
      owner,
      project,
      genesisNftRevenue,
      lpPool,
      burnAddr,
      communityFund,
      unlocker
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const {
        investmentFund,
        usdc,
        investmentNft,
        genesisNftRevenue,
        lpPool,
        burnAddr,
        communityFund,
        owner,
        unlocker
      } = await setup();

      expect(await investmentFund.supportsInterface(IInvestmentFundId)).to.equal(true);
      expect(await investmentFund.owner()).to.equal(owner.address);
      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
      expect(await investmentFund.treasuryWallet()).to.equal(defaultTreasury);
      expect(await investmentFund.managementFee()).to.equal(defaultManagementFee);
      expect(await investmentFund.cap()).to.equal(defaultInvestmentCap);
      expect(await investmentFund.unlocker()).to.equal(unlocker.address);
      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsIn);

      expect(await investmentFund.getDetails()).to.deep.equal([
        'Investment Fund',
        usdc.address,
        investmentNft.address,
        defaultTreasury,
        genesisNftRevenue.address,
        lpPool.address,
        burnAddr.address,
        communityFund.address,
        defaultManagementFee,
        defaultInvestmentCap,
        BigNumber.from(0),
        BigNumber.from(0),
        [],
        formatBytes32String(FundState.FundsIn)
      ]);
    });

    describe('Deployment', () => {
      it('Should revert deployment if invalid owner', async () => {
        const { investmentFund } = await setup();
        const [deployer, unlocker, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              constants.AddressZero,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'OwnablePausable__OwnerAccountZeroAddress');
      });

      it('Should revert deployment if invalid unlocker', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              constants.AddressZero,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__UnlockerZeroAddress');
      });

      it('Should revert deployment if invalid currency', async () => {
        const { investmentFund } = await setup();
        const [deployer, unlocker, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund, owner] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              constants.AddressZero,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__CurrencyZeroAddress');
      });

      it('Should revert deployment if invalid NFT address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              constants.AddressZero,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvestmentNftZeroAddress');
      });

      it('Should revert deployment if invalid staking address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              constants.AddressZero,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__StakingWlthZeroAddress');
      });

      it('Should revert deployment if invalid treasury wallet address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: constants.AddressZero,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__TreasuryZeroAddress');
      });

      it('Should revert deployment if invalid liquidity pool address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, genesisNftRevenue, treasuryWallet, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: constants.AddressZero,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__LpPoolZeroAddress');
      });

      it('Should revert deployment if invalid burn wallet address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, genesisNftRevenue, treasuryWallet, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: constants.AddressZero,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__BurnZeroAddress');
      });

      it('Should revert deployment if invalid community fund wallet address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, genesisNftRevenue, treasuryWallet, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: constants.AddressZero,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__CommunityFundZeroAddress');
      });

      it('Should revert deployment if invalid genesis nft revenue wallet address', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, genesisNftRevenue, treasuryWallet, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: constants.AddressZero
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__GenesisNftRevenueZeroAddress');
      });

      it('Should revert deployment if invalid management fee', async () => {
        const { investmentFund } = await setup();
        const [deployer, owner, unlocker, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              10000,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvalidManagementFee');
      });

      it('Should revert deployment if invalid investment cap', async () => {
        const { investmentFund } = await setup();
        const [deployer, unlocker, owner, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              0
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvalidInvestmentCap');
      });

      it('Should revert deployment if NFT contract does not support proper interface', async () => {
        const { investmentFund } = await setup();
        const [deployer, unlocker, owner, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund] =
          await ethers.getSigners();

        const feeDistributionAddresses = {
          treasuryWallet: treasuryWallet.address,
          lpPool: lpPool.address,
          burn: burnAddr.address,
          communityFund: communityFund.address,
          genesisNftRevenue: genesisNftRevenue.address
        };

        const usdc: FakeContract<USDC> = await smock.fake('USDC');
        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
        investmentNft.supportsInterface.returns(false);
        await expect(
          deployProxy(
            'InvestmentFund',
            [
              owner.address,
              unlocker.address,
              'Investment Fund',
              usdc.address,
              investmentNft.address,
              staking.address,
              feeDistributionAddresses,
              defaultManagementFee,
              defaultInvestmentCap
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvestmentNftInterfaceNotSupported');
      });
    });
  });

  describe('#invest()', () => {
    [toUsdc('50'), defaultInvestmentCap.sub(1)].forEach((amount: BigNumber) => {
      it(`Should invest if amount lower than cap [amount=${amount}]`, async () => {
        const { investmentFund, usdc, wallet } = await setup();

        const fee = amount.mul(defaultManagementFee).div(10000);
        await expect(investmentFund.connect(wallet).invest(amount, tokenUri))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount, fee);
      });
    });

    //[default investment cap, cap for which amount is a maximum possible value]
    [defaultInvestmentCap, MAX_UINT240.sub(MAX_UINT240.mul(defaultManagementFee).div(10000))].forEach((cap) => {
      it(`Should invest with cap reached if amount equal to cap [cap=${cap}]`, async () => {
        const { investmentFund, usdc, investmentNft, wallet } = await deployInvestmentFund({ cap });

        usdc.transferFrom.returns(true);
        investmentNft.mint.returns(1);

        const amount = cap;
        const fee = amount.mul(defaultManagementFee).div(10000);

        await expect(investmentFund.connect(wallet).invest(amount, tokenUri))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount, fee)
          .to.emit(investmentFund, 'CapReached')
          .withArgs(cap);

        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.CapReached);
      });
    });

    it('Should revert investing if amount greater than cap', async () => {
      const { investmentFund, wallet } = await setup();

      const amount = defaultInvestmentCap.add(1);

      await expect(investmentFund.connect(wallet).invest(amount, tokenUri)).to.be.revertedWithCustomError(
        investmentFund,
        'InvestmentFund__TotalInvestmentAboveCap'
      );
    });

    it('Should revert investing if amount is 0', async () => {
      const { investmentFund, wallet } = await setup();

      await expect(investmentFund.connect(wallet).invest(0, tokenUri)).to.be.revertedWithCustomError(
        investmentFund,
        'InvestmentFund__InvestmentTooLow'
      );
    });

    it('Should revert investing if amount is less then 50 USDC', async () => {
      const { investmentFund, wallet } = await setup();

      await expect(investmentFund.connect(wallet).invest(toUsdc('49'), tokenUri)).to.be.revertedWithCustomError(
        investmentFund,
        'InvestmentFund__InvestmentTooLow'
      );
    });

    it('Should revert investing if currency fee transfer fails', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      usdc.transferFrom.returnsAtCall(0, false);
      usdc.transferFrom.returnsAtCall(1, true);

      await expect(investmentFund.connect(wallet).invest(toUsdc('50'), tokenUri)).to.be.revertedWithCustomError(
        investmentFund,
        'Utils__CurrencyTransferFailed'
      );
    });

    it('Should revert investing if currency transfer fails', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      usdc.transferFrom.returnsAtCall(0, true);
      usdc.transferFrom.returnsAtCall(1, false);

      await expect(investmentFund.connect(wallet).invest(toUsdc('50'), tokenUri)).to.be.revertedWithCustomError(
        investmentFund,
        'Utils__CurrencyTransferFailed'
      );
    });

    [0, 1].forEach((call) => {
      it('Should revert investing if currency transfer reverts', async () => {
        const { investmentFund, usdc, wallet } = await setup();

        usdc.transferFrom.revertsAtCall(call);

        await expect(investmentFund.connect(wallet).invest(toUsdc('50'), tokenUri)).to.be.reverted;
      });
    });

    it('Should revert investing if investment NFT mint reverts', async () => {
      const { investmentFund, investmentNft, wallet } = await setup();

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1, tokenUri)).to.be.reverted;
    });
  });

  describe('#addProject()', () => {
    it('Should add project to fund', async () => {
      ({ investmentFund, owner } = await setup());

      expect(await investmentFund.getProjectsCount()).to.equal(0);
      expect(await investmentFund.listProjects()).to.deep.equal([]);

      const project: FakeContract<Project> = await smock.fake('Project');
      await expect(investmentFund.connect(owner).addProject(project.address))
        .to.emit(investmentFund, 'ProjectAdded')
        .withArgs(owner.address, project.address);

      expect(await investmentFund.getProjectsCount()).to.equal(1);
      expect(await investmentFund.listProjects()).to.deep.equal([project.address]);
    });

    it('Should revert adding project to fund if project is zero address', async () => {
      ({ investmentFund, owner } = await setup());

      await expect(
        investmentFund.connect(owner).addProject(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__ProjectZeroAddress');
    });

    it('Should revert adding project to fund if already exists', async () => {
      ({ investmentFund, owner } = await setup());

      const project: FakeContract<Project> = await smock.fake('Project');
      await investmentFund.connect(owner).addProject(project.address);

      await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWithCustomError(
        investmentFund,
        'InvestmentFund__ProjectExist'
      );
    });
  });

  describe('#removeProject()', () => {
    it('Should remove project from fund', async () => {
      ({ investmentFund, owner } = await setup());

      const project: FakeContract<Project> = await smock.fake('Project');
      await investmentFund.connect(owner).addProject(project.address);
      expect(await investmentFund.getProjectsCount()).to.equal(1);

      await expect(investmentFund.connect(owner).removeProject(project.address))
        .to.emit(investmentFund, 'ProjectRemoved')
        .withArgs(owner.address, project.address);

      expect(await investmentFund.getProjectsCount()).to.equal(0);
    });

    it('Should revert removing project from fund if it does not exist', async () => {
      ({ investmentFund, owner } = await setup());

      await expect(
        investmentFund.connect(owner).removeProject(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NotRegisteredProject');

      const project: FakeContract<Project> = await smock.fake('Project');
      await expect(investmentFund.connect(owner).removeProject(project.address)).to.be.revertedWithCustomError(
        investmentFund,
        'InvestmentFund__NotRegisteredProject'
      );
    });
  });

  describe('#provideProfit()', () => {
    const investmentValue = toUsdc('100');

    before(async () => {
      ({ investmentFund, usdc, investmentNft, staking, deployer, wallet, owner, project } = await setup());

      await investmentFund.connect(wallet).invest(investmentValue, tokenUri);
      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft, staking);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      investmentNft.getParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getInvestors.returns([deployer.address]);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      staking.getDiscountFromPreviousInvestmentInTimestamp.returns(0);
    });

    [1, investmentValue.sub(1)].forEach((value) => {
      it(`Should provide profit lower than breakeven [value=${value}]`, async () => {
        const profitBlock = (await time.latestBlock()) + 10;
        await mineUpTo(profitBlock - 1);

        await expect(investmentFund.connect(project.wallet).provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value, 0, profitBlock);

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(1);

        expect(await investmentFund.getAvailableFundsDetails(deployer.address)).to.deep.equal([0, 0, 0]);

        const block = await ethers.provider.getBlock(profitBlock);
        expect(await investmentFund.payouts(0)).to.deep.equal([value, [block.number, block.timestamp], false, true]);
      });
    });

    it('Should provide profit equal to breakeven', async () => {
      const profit = investmentValue;
      const profitBlock = (await time.latestBlock()) + 10;
      await mineUpTo(profitBlock - 1);

      await expect(investmentFund.connect(project.wallet).provideProfit(profit))
        .to.emit(investmentFund, 'ProfitProvided')
        .withArgs(investmentFund.address, profit, 0, profitBlock)
        .to.emit(investmentFund, 'BreakevenReached')
        .withArgs(profit);

      expect(await investmentFund.totalIncome()).to.equal(profit);
      expect(await investmentFund.getPayoutsCount()).to.equal(1);
      expect(await investmentFund.getAvailableFundsDetails(deployer.address)).to.deep.equal([0, 0, 0]);
      expect(usdc.transferFrom).to.have.been.callCount(1);

      const block = await ethers.provider.getBlock(profitBlock);
      expect(await investmentFund.payouts(0)).to.deep.equal([profit, [block.number, block.timestamp], false, true]);
    });

    [investmentValue.add(1)].forEach((value) => {
      it(`Should provide profit higher than breakeven [value=${value}]`, async () => {
        const profitBlock = (await time.latestBlock()) + 10;
        await mineUpTo(profitBlock - 1);

        const initialFee = value.sub(investmentValue).div(10);
        await expect(investmentFund.connect(project.wallet).provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value, initialFee, profitBlock)
          .to.emit(investmentFund, 'BreakevenReached')
          .withArgs(investmentValue);

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(2);
        expect(await investmentFund.getAvailableFundsDetails(deployer.address)).to.deep.equal([0, 0, 0]);
        expect(usdc.transferFrom).to.have.been.called;

        const block = await ethers.provider.getBlock(profitBlock);
        expect(await investmentFund.payouts(0)).to.deep.equal([
          investmentValue,
          [block.number, block.timestamp],
          false,
          true
        ]);
        expect(await investmentFund.payouts(1)).to.deep.equal([
          value.sub(investmentValue),
          [block.number, block.timestamp],
          true,
          true
        ]);
      });
    });

    it('Should provide multiple profits', async () => {
      const profit1 = investmentValue;
      const profit2 = toUsdc('30');

      await investmentFund.connect(project.wallet).provideProfit(profit1);
      await investmentFund.connect(project.wallet).provideProfit(profit2);

      expect(await investmentFund.totalIncome()).to.equal(profit1.add(profit2));
      expect(await investmentFund.getPayoutsCount()).to.equal(2);

      expect((await investmentFund.payouts(0)).value).to.equal(profit1);
      expect((await investmentFund.payouts(1)).value).to.equal(profit2);
    });

    it('Should revert providing zero profit', async () => {
      await expect(investmentFund.connect(project.wallet).provideProfit(0)).to.revertedWithCustomError(
        investmentFund,
        'InvestmentFund__ZeroProfitProvided'
      );
    });

    it('Should revert providing profit if addres is not registered as project', async () => {
      await expect(investmentFund.connect(owner).provideProfit(toUsdc('20')))
        .to.revertedWithCustomError(investmentFund, 'InvestmentFund__NotRegisteredProject')
        .withArgs(owner.address);
    });

    it('Should revert providing profit if transfer fails', async () => {
      usdc.transferFrom.returns(false);
      await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.revertedWithCustomError(
        investmentFund,
        'Utils__CurrencyTransferFailed'
      );
    });
  });

  describe('#unlockPayoutsTo()', () => {
    const investmentValue = toUsdc('100');

    before(async () => {
      ({ investmentFund, usdc, investmentNft, staking, deployer, wallet, owner, project, unlocker } = await setup());

      await investmentFund.connect(wallet).invest(investmentValue, tokenUri);
      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft, staking);
      usdc.transferFrom.returns(true);
      investmentNft.getParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getInvestors.returns([deployer.address]);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      staking.getDiscountFromPreviousInvestmentInTimestamp.returns(0);
    });

    it('Should unlock all available payouts', async () => {
      await investmentFund.connect(project.wallet).provideProfit(1);
      await investmentFund.connect(project.wallet).provideProfit(1);

      await expect(investmentFund.connect(unlocker).unlockPayoutsTo(1))
        .to.emit(investmentFund, 'PayoutsUnlocked')
        .withArgs(0, 1);
      expect(await investmentFund.nextPayoutToUnlock()).to.equal(2);

      expect((await investmentFund.payouts(0)).locked).to.be.false;
      expect((await investmentFund.payouts(1)).locked).to.be.false;
    });

    it('Should unlock some available payouts', async () => {
      await investmentFund.connect(project.wallet).provideProfit(1);
      await investmentFund.connect(project.wallet).provideProfit(1);

      await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0))
        .to.emit(investmentFund, 'PayoutsUnlocked')
        .withArgs(0, 0);
      expect(await investmentFund.nextPayoutToUnlock()).to.equal(1);

      expect((await investmentFund.payouts(0)).locked).to.be.false;
      expect((await investmentFund.payouts(1)).locked).to.be.true;
    });

    it('Should revert if not unlocker', async () => {
      await expect(investmentFund.connect(owner).unlockPayoutsTo(1))
        .to.revertedWithCustomError(investmentFund, 'InvestmentFund__NotTheUnlocker')
        .withArgs(owner.address);
    });

    it('Should revert if nothing to unlock', async () => {
      await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0))
        .to.revertedWithCustomError(investmentFund, 'InvestmentFund__NoPayoutToUnclock')
        .withArgs();
    });

    it('Should revert if payout already unlocked', async () => {
      await investmentFund.connect(project.wallet).provideProfit(1);
      await investmentFund.connect(unlocker).unlockPayoutsTo(0);
      await investmentFund.connect(project.wallet).provideProfit(1);

      await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0))
        .to.revertedWithCustomError(investmentFund, 'InvestmentFund__PayoutIndexTooLow')
        .withArgs();
    });

    it('Should revert if payout not exists yet', async () => {
      await investmentFund.connect(project.wallet).provideProfit(1);

      await expect(investmentFund.connect(unlocker).unlockPayoutsTo(1))
        .to.revertedWithCustomError(investmentFund, 'InvestmentFund__PayoutIndexTooHigh')
        .withArgs();
    });
  });

  describe('#getAvailableFundsDetails()', () => {
    const walletInvestment = toUsdc('600');
    const ownerInvestment = toUsdc('400');
    const totalInvestment = ownerInvestment.add(walletInvestment);

    before(async () => {
      ({ investmentFund, usdc, investmentNft, staking, deployer, wallet, owner, project, unlocker } = await setup());
      await investmentFund.connect(wallet).invest(walletInvestment, tokenUri);
      await investmentFund.connect(owner).invest(ownerInvestment, tokenUri);
      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft, staking);

      investmentNft.getPastParticipation.returns([walletInvestment, totalInvestment]);
      investmentNft.getTotalInvestmentValue.returns(totalInvestment);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      staking.getDiscountFromPreviousInvestmentInTimestamp.returns(0);
    });

    it('Should return zero available funds if no profit provided and no unlocked payouts', async () => {
      expect(await investmentFund.getAvailableFundsDetails(wallet.address)).to.deep.equal([0, 0, 0]);
    });

    it('Should return availale funds with zero carry fee if payouts not if profit', async () => {
      await investmentFund.connect(project.wallet).provideProfit(toUsdc('10'));
      await investmentFund.connect(unlocker).unlockPayoutsTo(0);

      expect(await investmentFund.getAvailableFundsDetails(wallet.address)).to.deep.equal([toUsdc('6'), 0, 1]);
    });

    it('Should return availale funds with with carry fee if payouts in profit', async () => {
      await investmentFund.connect(project.wallet).provideProfit(toUsdc('2000'));
      await investmentFund.connect(unlocker).unlockPayoutsTo(1);

      expect(await investmentFund.getAvailableFundsDetails(wallet.address)).to.deep.equal([
        toUsdc('960'),
        toUsdc('180'),
        2
      ]);
    });

    it('Should return zero profit if user did not invest', async () => {
      investmentNft.getParticipation.reset();
      investmentNft.getPastParticipation.reset();
      investmentNft.getParticipation.returns([0, 0]);
      investmentNft.getPastParticipation.returns([0, 0]);

      await investmentFund.connect(project.wallet).provideProfit(toUsdc('2000'));
      await investmentFund.connect(unlocker).unlockPayoutsTo(1);

      expect(await investmentFund.getAvailableFundsDetails(wallet.address)).to.deep.equal([0, 0, 2]);
    });
  });

  describe('#withdraw()', () => {
    const investmentValue = toUsdc('100');

    before(async () => {
      ({ investmentFund, usdc, investmentNft, staking, deployer, wallet, owner, project, unlocker } = await setup());
      await investmentFund.connect(wallet).invest(investmentValue, tokenUri);
      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft, staking);

      investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      staking.getDiscountFromPreviousInvestmentInTimestamp.returns(0);
    });

    describe('if no profit provided', () => {
      it('Should revert withdrawing if no profit provided', async () => {
        await expect(investmentFund.connect(wallet).withdraw())
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NoFundsAvailable')
          .withArgs(wallet.address);
      });
    });

    describe('if profit provided', () => {
      beforeEach(async () => {
        await investmentFund.connect(project.wallet).provideProfit(toUsdc('200'));
        await investmentFund.connect(unlocker).unlockPayoutsTo(1);
      });

      it('Should withdraw profit and distribute carry fee', async () => {
        await expect(investmentFund.connect(wallet).withdraw())
          .to.emit(investmentFund, 'ProfitWithdrawn')
          .withArgs(wallet.address, usdc.address, toUsdc('160'));
        expect(usdc.transfer).to.have.been.calledWith(wallet.address, toUsdc('160'));
      });

      it('Should revert withdrawal if currency transfer fails', async () => {
        usdc.transfer.returns(false);

        await expect(investmentFund.connect(wallet).withdraw()).to.revertedWithCustomError(
          investmentFund,
          'Utils__CurrencyTransferFailed'
        );
      });
    });
  });

  describe('State machine', async () => {
    describe('FundsIn', () => {
      before(async () => {
        ({ investmentFund, owner, project, unlocker } = await setup());
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should not revert adding project', async () => {
        await expect(investmentFund.connect(owner).addProject(project.address)).not.to.be.reverted;
      });

      it('Should not revert removing project', async () => {
        await investmentFund.connect(owner).addProject(project.address);
        await expect(investmentFund.connect(owner).removeProject(project.address)).not.to.be.reverted;
      });

      it('Should not revert investing', async () => {
        await expect(investmentFund.invest(toUsdc('50'), tokenUri)).not.to.be.reverted;
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should not revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).not.to.be.reverted;
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert providing profits', async () => {
        await investmentFund.connect(owner).addProject(project.address);
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert unlocking payouts', async () => {
        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });

    describe('CapReached', () => {
      before(async () => {
        ({ investmentFund, owner, project, unlocker } = await setup());

        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.connect(owner).stopCollectingFunds();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should revert adding project', async () => {
        await expect(investmentFund.connect(owner).addProject(project.address)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.connect(owner).removeProject(project.address)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1, tokenUri)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should not revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).not.to.be.reverted;
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert unlocking payouts', async () => {
        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });

    describe('FundsDeployed', () => {
      const investmentValue = toUsdc('100');
      const profit = toUsdc('1');

      before(async () => {
        ({ investmentFund, usdc, investmentNft, owner, project, staking, unlocker } = await setup());

        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.invest(investmentValue, tokenUri);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

        staking.getDiscountFromPreviousInvestmentInTimestamp.returns(0);
        await investmentFund.connect(project.wallet).provideProfit(profit);

        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();

        resetFakes(usdc, investmentNft, staking);

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        investmentNft.getParticipation.returns([investmentValue, investmentValue]);
        investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      });

      it('Should revert adding project', async () => {
        await expect(investmentFund.connect(owner).addProject(project.address)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.connect(owner).removeProject(project.address)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1, tokenUri)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should not revert withdrawing', async () => {
        await investmentFund.connect(unlocker).unlockPayoutsTo(0);
        await expect(investmentFund.withdraw()).not.to.be.reverted;
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).to.be.to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should not revert providing profits', async () => {
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).not.to.be.reverted;
      });

      it('Should not revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).not.to.be.reverted;
      });
      it('Should not revert unlocking payouts', async () => {
        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0)).not.to.be.reverted;
      });
    });

    describe('Closed', () => {
      before(async () => {
        ({ investmentFund, owner, project, unlocker } = await setup());

        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(owner).closeFund();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should revert adding project', async () => {
        await expect(investmentFund.connect(owner).addProject(project.address)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.connect(owner).removeProject(project.address)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1, tokenUri)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert unlocking payouts', async () => {
        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0)).to.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });
});
