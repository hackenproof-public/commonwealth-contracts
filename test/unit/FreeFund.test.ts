import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  FreeFund,
  IERC165Upgradeable__factory,
  IInvestmentFund__factory,
  InvestmentNFT,
  ProfitProvider,
  Project,
  StakingWlth,
  USDC
} from '../../typechain-types';
import { FundState } from '../types';
import { getInterfaceId, toUsdc } from '../utils';

describe('FreeFund', () => {
  const deployInvestmentFund = async () => {
    const [
      deployer,
      owner,
      unlocker,
      treasuryWallet,
      lpPool,
      burnAddr,
      communityFund,
      genesisNftRevenue,
      user1,
      user2
    ] = await ethers.getSigners();

    const basisPoint = 10000;

    const fundName = 'Test Fund';
    const managementFee = 0;
    const cap = toUsdc('1000000');
    const maxPercentageWalletInvestmentLimit = 0;
    const minimumInvestment = toUsdc('50');

    const feeDistributionAddresses = {
      treasuryWallet: treasuryWallet.address,
      lpPool: lpPool.address,
      burn: burnAddr.address,
      communityFund: communityFund.address,
      genesisNftRevenue: genesisNftRevenue.address
    };

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    usdc.transferFrom.reset();
    usdc.transfer.reset();
    usdc.balanceOf.reset();
    usdc.approve.reset();

    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
    investmentNft.supportsInterface.reset();
    investmentNft.getPastTotalInvestmentValue.reset();
    investmentNft.getPastParticipation.reset();
    investmentNft.supportsInterface.returns(true);

    const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
    staking.getDiscountFromPreviousInvestmentInTimestamp.reset();
    const project: FakeContract<Project> = await smock.fake('Project');
    const profitProvider: FakeContract<ProfitProvider> = await smock.fake('ProfitProvider');

    await owner.sendTransaction({
      to: project.address,
      value: ethers.utils.parseEther('1000')
    });

    await owner.sendTransaction({
      to: profitProvider.address,
      value: ethers.utils.parseEther('1000')
    });

    const freeFund: FreeFund = await deployProxy(
      'FreeFund',
      [
        owner.address,
        unlocker.address,
        fundName,
        usdc.address,
        investmentNft.address,
        staking.address,
        feeDistributionAddresses,
        managementFee,
        cap,
        maxPercentageWalletInvestmentLimit,
        minimumInvestment,
        profitProvider.address
      ],
      deployer
    );

    return {
      deployer,
      owner,
      unlocker,
      treasuryWallet,
      lpPool,
      burnAddr,
      communityFund,
      genesisNftRevenue,
      freeFund,
      usdc,
      investmentNft,
      staking,
      project,
      fundName,
      managementFee,
      cap,
      maxPercentageWalletInvestmentLimit,
      minimumInvestment,
      user1,
      user2,
      basisPoint,
      profitProvider
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with inital values', async () => {
        const {
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        const details = await freeFund.getDetails();

        expect(await freeFund.owner()).to.be.equal(owner.address);
        expect(await freeFund.unlocker()).to.be.equal(unlocker.address);
        expect(await freeFund.name()).to.be.equal(fundName);
        expect(await freeFund.currency()).to.be.equal(usdc.address);
        expect(await freeFund.investmentNft()).to.be.equal(investmentNft.address);
        expect(await freeFund.stakingWlth()).to.be.equal(staking.address);
        expect(await freeFund.treasuryWallet()).to.be.equal(treasuryWallet.address);
        expect(await freeFund.lpPoolAddress()).to.be.equal(lpPool.address);
        expect(await freeFund.burnAddress()).to.be.equal(burnAddr.address);
        expect(await freeFund.communityFund()).to.be.equal(communityFund.address);
        expect(await freeFund.genesisNftRevenue()).to.be.equal(genesisNftRevenue.address);
        expect(await freeFund.managementFee()).to.be.equal(managementFee);
        expect(await freeFund.cap()).to.be.equal(cap);
        expect(await freeFund.maxPercentageWalletInvestmentLimit()).to.be.equal(maxPercentageWalletInvestmentLimit);
        expect(await freeFund.minimumInvestment()).to.be.equal(minimumInvestment);
        expect(await freeFund.totalIncome()).to.be.equal(0);
        expect(await freeFund.payouts()).to.have.lengthOf(0);
        expect(await freeFund.profitProvider()).to.be.equal(profitProvider.address);
        expect(parseBytes32String(await freeFund.currentState())).to.equal(FundState.FundsIn);
        expect(
          await freeFund.supportsInterface(
            ethers.utils.arrayify(getInterfaceId(IInvestmentFund__factory.createInterface()))
          )
        ).to.be.true;
        expect(
          await freeFund.supportsInterface(
            ethers.utils.arrayify(getInterfaceId(IERC165Upgradeable__factory.createInterface()))
          )
        ).to.be.true;

        expect(details.name).to.be.equal(fundName);
        expect(details.currency).to.be.equal(usdc.address);
        expect(details.investmentNft).to.be.equal(investmentNft.address);
        expect(details.treasuryWallet).to.be.equal(treasuryWallet.address);
        expect(details.lpPoolAddress).to.be.equal(lpPool.address);
        expect(details.burnAddress).to.be.equal(burnAddr.address);
        expect(details.communityFund).to.be.equal(communityFund.address);
        expect(details.genesisNftRevenue).to.be.equal(genesisNftRevenue.address);
        expect(details.managementFee).to.be.equal(managementFee);
        expect(details.cap).to.be.equal(cap);
        expect(details.totalInvestment).to.be.equal(0);
        expect(details.totalIncome).to.be.equal(0);
        expect(details.payouts).to.have.lengthOf(0);

        getInterfaceId(IInvestmentFund__factory.createInterface());
        expect(parseBytes32String(details.state)).to.be.equal(FundState.FundsIn);
        expect(details.maxPercentageWalletInvestmentLimit).to.be.equal(maxPercentageWalletInvestmentLimit);
        expect(details.minimumInvestment).to.be.equal(minimumInvestment);
      });
    });

    describe('Reverts', () => {
      it('Should revert if unlocker is zero address', async () => {
        const {
          deployer,
          owner,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              ethers.constants.AddressZero,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__UnlockerZeroAddress');
      });

      it('Should revert when currency address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              ethers.constants.AddressZero,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__CurrencyZeroAddress');
      });

      it('Should revert when investmentNft address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              ethers.constants.AddressZero,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__InvestmentNftZeroAddress');
      });
      it('Should revert when staking address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              ethers.constants.AddressZero,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__StakingWlthZeroAddress');
      });
      it('Should revert when treasuryWallet address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: ethers.constants.AddressZero,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__TreasuryZeroAddress');
      });

      it('Should revert when lpPool address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: ethers.constants.AddressZero,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__LpPoolZeroAddress');
      });

      it('Should revert when burn address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: ethers.constants.AddressZero,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__BurnZeroAddress');
      });

      it('Should revert when communityFund address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: ethers.constants.AddressZero,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__CommunityFundZeroAddress');
      });

      it('Should revert when genesisNftRevenue address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: ethers.constants.AddressZero
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__GenesisNftRevenueZeroAddress');
      });

      it('Should revert when cap is zero', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              0,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__InvalidInvestmentCap');
      });

      it('Should revert when investment nft does not support UERC165Upgradable interface', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        investmentNft.supportsInterface.returns(false);

        await expect(
          deployProxy(
            'FreeFund',
            [
              owner.address,
              unlocker.address,
              fundName,
              usdc.address,
              investmentNft.address,
              staking.address,
              {
                treasuryWallet: treasuryWallet.address,
                lpPool: lpPool.address,
                burn: burnAddr.address,
                communityFund: communityFund.address,
                genesisNftRevenue: genesisNftRevenue.address
              },
              managementFee,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment,
              profitProvider.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__InvestmentNftInterfaceNotSupported');
      });

      it('Should revert when initialize again', async () => {
        const {
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          freeFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        await expect(
          freeFund.initialize(
            owner.address,
            unlocker.address,
            fundName,
            usdc.address,
            investmentNft.address,
            staking.address,
            {
              treasuryWallet: treasuryWallet.address,
              lpPool: lpPool.address,
              burn: burnAddr.address,
              communityFund: communityFund.address,
              genesisNftRevenue: genesisNftRevenue.address
            },
            managementFee,
            cap,
            maxPercentageWalletInvestmentLimit,
            minimumInvestment,
            profitProvider.address
          )
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('Invest', () => {
    describe('Reverts', () => {
      it('Should always revert', async () => {
        const { user1, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).invest(toUsdc('10000'))).to.be.revertedWithCustomError(
          freeFund,
          'FreeFund__InvestmentNotAllowed'
        );
      });
    });
  });

  describe('AirdropInvestmentNFT', () => {
    describe('Success', () => {
      it('Should airdrop an investment nft', async () => {
        const { freeFund, investmentNft, owner, user1 } = await loadFixture(deployInvestmentFund);
        const amount = toUsdc('1000');

        await expect(freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address))
          .to.emit(freeFund, 'InvestmentAirdroped')
          .withArgs(user1.address, amount);

        expect(investmentNft.mint).to.have.been.calledWith(user1.address, amount);
      });

      it('Should change the state to CapReached when total investment reaches the cap', async () => {
        const { owner, freeFund, user1, investmentNft, cap } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).airdropInvestmentNFT(cap, user1.address))
          .to.emit(freeFund, 'CapReached')
          .withArgs(cap)
          .to.emit(freeFund, 'InvestmentAirdroped')
          .withArgs(user1.address, cap);

        expect(parseBytes32String(await freeFund.currentState())).to.equal(FundState.CapReached);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by owner', async () => {
        const { user1, freeFund } = await loadFixture(deployInvestmentFund);
        await expect(freeFund.connect(user1).airdropInvestmentNFT(1000, user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when not in 'FundsIn' state", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await freeFund.connect(owner).stopCollectingFunds();

        await expect(freeFund.connect(owner).airdropInvestmentNFT(1000, owner.address)).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when exceed the cap', async () => {
        const { owner, freeFund, cap } = await loadFixture(deployInvestmentFund);

        await expect(
          freeFund.connect(owner).airdropInvestmentNFT(cap.add(1), owner.address)
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__TotalInvestmentAboveCap');
      });

      it('Should revert when amount less then minimum investment', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).airdropInvestmentNFT(1, owner.address)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__InvestmentTooLow'
        );
      });
    });
  });

  describe('AddProject', () => {
    describe('Success', () => {
      it('Should add project', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).addProject(project.address))
          .to.emit(freeFund, 'ProjectAdded')
          .withArgs(owner.address, project.address);
        expect(await freeFund.getProjectsCount()).to.be.equal(1);
        expect(await freeFund.listProjects()).to.have.lengthOf(1);
        expect((await freeFund.listProjects())[0]).to.be.equal(project.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { user1, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).addProject(project.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when project's address is zero", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).addProject(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__ProjectZeroAddress'
        );
      });

      it("Should revert when project's address is already added", async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).addProject(project.address);

        await expect(freeFund.connect(owner).addProject(project.address)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__ProjectExist'
        );
      });

      it("Should revert when the fund not in 'Close' state", async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);

        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(owner).closeFund();

        await expect(freeFund.connect(owner).addProject(project.address)).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('RemoveProject', () => {
    describe('Success', () => {
      it('Should remove project', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).addProject(project.address);

        await expect(freeFund.connect(owner).removeProject(project.address))
          .to.emit(freeFund, 'ProjectRemoved')
          .withArgs(owner.address, project.address);
        expect(await freeFund.getProjectsCount()).to.be.equal(0);
        expect(await freeFund.listProjects()).to.have.lengthOf(0);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { owner, user1, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).addProject(project.address);

        await expect(freeFund.connect(user1).removeProject(project.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when a project is not registered', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).removeProject(project.address))
          .to.be.revertedWithCustomError(freeFund, 'InvestmentFund__NotRegisteredProject')
          .withArgs(project.address);
      });

      it("Should revert when the fund not in 'FundsIn' state", async () => {
        const { owner, freeFund, usdc, investmentNft, cap, project, user1 } = await loadFixture(deployInvestmentFund);

        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(owner).closeFund();

        await expect(freeFund.connect(owner).removeProject(project.address)).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('StopCollectingFunds', () => {
    describe('Success', () => {
      it('Should stop collecting funds', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        expect(await freeFund.connect(owner).stopCollectingFunds()).to.emit(freeFund, 'FundsCollectionStopped');
        expect(parseBytes32String(await freeFund.currentState())).to.equal(FundState.CapReached);
      });
    });

    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { owner, user1, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).stopCollectingFunds()).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when the fund not in 'FundsIn' state", async () => {
        const { owner, user1, freeFund } = await loadFixture(deployInvestmentFund);

        await freeFund.connect(owner).stopCollectingFunds();

        await expect(freeFund.connect(owner).stopCollectingFunds()).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  // TODO Need to be updated after the logic is defined and implemented
  describe('DeployFunds', () => {
    describe('Success', () => {
      it('Should deploy funds to the projects', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();

        expect(await freeFund.connect(owner).deployFunds());
        expect(parseBytes32String(await freeFund.currentState())).to.equal(FundState.FundsDeployed);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { owner, user1, freeFund } = await loadFixture(deployInvestmentFund);

        await freeFund.connect(owner).stopCollectingFunds();

        await expect(freeFund.connect(user1).deployFunds()).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it("Should revert when the fund not in 'CapReached' state", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).deployFunds()).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('DeployFundsToProject', () => {
    describe('Success', () => {
      it("Should deploy funds to the project's address", async () => {
        const { owner, user1, freeFund, project, investmentNft, usdc, cap } = await loadFixture(deployInvestmentFund);
        const amount = toUsdc('10000');

        usdc.transferFrom.returns(true);
        usdc.balanceOf.whenCalledWith(freeFund.address).returns(amount);
        usdc.approve.returns(true);
        await freeFund.connect(owner).addProject(project.address);

        await freeFund.connect(owner).stopCollectingFunds();

        await expect(freeFund.connect(owner).deployFundsToProject(project.address, amount))
          .to.emit(freeFund, 'FundsDeployedToProject')
          .withArgs(freeFund.address, project.address, amount);
        expect(usdc.approve).to.have.been.calledWith(project.address, amount);
        expect(project.deployFunds).to.have.been.calledWith(amount);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { user1, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).deployFundsToProject(project.address, toUsdc('10000'))).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when the project is not registered', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).deployFundsToProject(project.address, toUsdc('10000')))
          .to.be.revertedWithCustomError(freeFund, 'InvestmentFund__NotRegisteredProject')
          .withArgs(project.address);
      });

      it('Should revert when balance of the fund is less than the amount to be deployed', async () => {
        const { owner, usdc, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).addProject(project.address);
        usdc.balanceOf.whenCalledWith(freeFund.address).returns(toUsdc('1000'));

        await expect(
          freeFund.connect(owner).deployFundsToProject(project.address, toUsdc('10000'))
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__NotEnoughTokensOnInvestmentFund');
      });
    });
  });

  describe('ProvideProfit', () => {
    describe('Success', () => {
      const setup = async () => {
        const {
          owner,
          freeFund,
          usdc,
          user1,
          investmentNft,
          cap,
          project,
          treasuryWallet,
          genesisNftRevenue,
          lpPool,
          burnAddr,
          communityFund,
          profitProvider
        } = await loadFixture(deployInvestmentFund);

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await freeFund.connect(owner).deployFunds();

        return {
          owner,
          freeFund,
          usdc,
          user1,
          investmentNft,
          cap,
          project,
          treasuryWallet,
          genesisNftRevenue,
          lpPool,
          burnAddr,
          communityFund,
          profitProvider
        };
      };

      it('Should provide profit to the fund and set values when income lower than total investment', async () => {
        const { freeFund, usdc, project } = await loadFixture(setup);

        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        const payoutAmount = toUsdc('1000');

        expect(await freeFund.connect(project.wallet).provideProfit(payoutAmount, false))
          .to.emit(freeFund, 'ProfitProvided')
          .withArgs(freeFund.address, payoutAmount, 0, blockNumberAfterOperation);
        expect(usdc.transferFrom).to.have.been.calledWith(project.address, freeFund.address, payoutAmount);
        expect(await freeFund.getPayoutsCount()).to.be.equal(1);
        expect(await freeFund.isInProfit()).to.be.false;
        const payouts = await freeFund.payouts();
        expect(payouts).to.have.lengthOf(1);
        expect(payouts[0].value).to.be.equal(payoutAmount);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.true;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(0)).to.be.deep.equal(payouts[0]);
      });

      it('Should probvide profite when the new total income is equal to total investment', async () => {
        const { freeFund, usdc, cap, project } = await loadFixture(setup);

        const payoutAmount = cap;
        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        expect(await freeFund.connect(project.wallet).provideProfit(payoutAmount, false))
          .to.emit(freeFund, 'BreakevenReached')
          .withArgs(cap)
          .to.emit(freeFund, 'ProfitProvided')
          .withArgs(freeFund.address, payoutAmount, 0, blockNumberAfterOperation);

        expect(usdc.transferFrom).to.have.been.calledWith(project.address, freeFund.address, payoutAmount);
        expect(await freeFund.getPayoutsCount()).to.be.equal(1);
        expect(await freeFund.isInProfit()).to.be.false;
        const payouts = await freeFund.payouts();
        expect(payouts).to.have.lengthOf(1);
        expect(payouts[0].value).to.be.equal(payoutAmount);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.true;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(0)).to.be.deep.equal(payouts[0]);
      });

      it('Should provider profit and distribute initial carry fee when the new total income is greater than total investment', async () => {
        const { freeFund, usdc, cap, project, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund } =
          await loadFixture(setup);

        const payoutAmount = cap.add(toUsdc('100'));
        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        const initialCarryFee = payoutAmount.sub(cap).mul(1000).div(10000);

        expect(await freeFund.connect(project.wallet).provideProfit(payoutAmount, false))
          .to.emit(freeFund, 'BreakevenReached')
          .withArgs(cap)
          .to.emit(freeFund, 'ProfitProvided')
          .withArgs(freeFund.address, cap, initialCarryFee, blockNumberAfterOperation);
        expect(usdc.transferFrom).to.have.been.calledWith(project.address, freeFund.address, cap);
        expect(await freeFund.getPayoutsCount()).to.be.equal(2);
        expect(await freeFund.isInProfit()).to.be.true;

        const payouts = await freeFund.payouts();
        expect(payouts).to.have.lengthOf(2);
        expect(payouts[0].value).to.be.equal(cap);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.true;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(0)).to.be.deep.equal(payouts[0]);

        expect(payouts[1].value).to.be.equal(payoutAmount.sub(cap));
        expect(payouts[1].inProfit).to.be.true;
        expect(payouts[1].locked).to.be.true;
        expect(payouts[1].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[1].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(1)).to.be.deep.equal(payouts[1]);

        expect(usdc.transfer).to.have.been.calledWith(treasuryWallet.address, initialCarryFee.mul(68).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPool.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(burnAddr.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(communityFund.address, initialCarryFee.mul(2).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(genesisNftRevenue.address, initialCarryFee.mul(12).div(100));
      });

      it('Should provide profit and initial carry fee when the total income is already greater than the total investment', async () => {
        const { freeFund, usdc, cap, project, treasuryWallet, genesisNftRevenue, lpPool, burnAddr, communityFund } =
          await loadFixture(setup);

        const payoutAmount = toUsdc('100');
        const initialCarryFee = payoutAmount.mul(10).div(100);
        await freeFund.connect(project.wallet).provideProfit(cap, false);

        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        expect(await freeFund.connect(project.wallet).provideProfit(payoutAmount, false))
          .to.emit(freeFund, 'ProfitProvided')
          .withArgs(freeFund.address, payoutAmount, initialCarryFee, blockNumberAfterOperation);

        expect(usdc.transferFrom).to.have.been.calledWith(project.address, freeFund.address, cap);
        expect(await freeFund.getPayoutsCount()).to.be.equal(2);
        expect(await freeFund.isInProfit()).to.be.true;

        const payouts = await freeFund.payouts();
        expect(payouts).to.have.lengthOf(2);
        expect(payouts[1].value).to.be.equal(payoutAmount);
        expect(payouts[1].inProfit).to.be.true;
        expect(payouts[1].locked).to.be.true;
        expect(payouts[1].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[1].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(1)).to.be.deep.equal(payouts[1]);

        expect(usdc.transfer).to.have.been.calledWith(treasuryWallet.address, initialCarryFee.mul(68).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPool.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(burnAddr.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(communityFund.address, initialCarryFee.mul(2).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(genesisNftRevenue.address, initialCarryFee.mul(12).div(100));
      });

      it('Should provide profit and unlock payouts', async () => {
        const { freeFund, usdc, project } = await loadFixture(setup);

        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        const payoutAmount = toUsdc('1000');

        expect(await freeFund.connect(project.wallet).provideProfit(payoutAmount, true))
          .to.emit(freeFund, 'ProfitProvided')
          .withArgs(freeFund.address, payoutAmount, 0, blockNumberAfterOperation);
        expect(usdc.transferFrom).to.have.been.calledWith(project.address, freeFund.address, payoutAmount);
        expect(await freeFund.getPayoutsCount()).to.be.equal(1);
        expect(await freeFund.isInProfit()).to.be.false;
        const payouts = await freeFund.payouts();
        expect(payouts).to.have.lengthOf(1);
        expect(payouts[0].value).to.be.equal(payoutAmount);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.false;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(0)).to.be.deep.equal(payouts[0]);
      });

      it('Should provide profit and unlock payouts when profit provider', async () => {
        const { freeFund, usdc, profitProvider } = await loadFixture(setup);

        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        const payoutAmount = toUsdc('1000');

        expect(await freeFund.connect(profitProvider.wallet).provideProfit(payoutAmount, true))
          .to.emit(freeFund, 'ProfitProvided')
          .withArgs(freeFund.address, payoutAmount, 0, blockNumberAfterOperation);
        expect(usdc.transferFrom).to.have.been.calledWith(profitProvider.address, freeFund.address, payoutAmount);
        expect(await freeFund.getPayoutsCount()).to.be.equal(1);
        expect(await freeFund.isInProfit()).to.be.false;
        const payouts = await freeFund.payouts();
        expect(payouts).to.have.lengthOf(1);
        expect(payouts[0].value).to.be.equal(payoutAmount);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.false;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await freeFund.payout(0)).to.be.deep.equal(payouts[0]);
      });
    });

    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(
          freeFund.connect(project.wallet).provideProfit(toUsdc('100'), false)
        ).to.be.revertedWithCustomError(freeFund, 'StateMachine__NotAllowedInCurrentState');
      });

      it('Should revert when the project is not registered', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(project.wallet).provideProfit(toUsdc('100'), false))
          .to.be.revertedWithCustomError(freeFund, 'InvestmentFund__OperationNotAllowed')
          .withArgs(project.address);
      });

      it('Should revert when amount is zero', async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).addProject(project.address);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(project.wallet).provideProfit(0, false)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__ZeroProfitProvided'
        );
      });
    });
  });

  describe('UnlockPayoutsTo', () => {
    describe('Success', () => {
      it('Should unlock all payouts to the given index', async () => {
        const { owner, unlocker, freeFund, project, usdc, investmentNft, cap, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(cap, false);
        await freeFund.connect(project.wallet).provideProfit(cap, false);
        await freeFund.connect(project.wallet).provideProfit(cap, false);

        await expect(freeFund.connect(unlocker).unlockPayoutsTo(2)).to.emit(freeFund, 'PayoutsUnlocked').withArgs(0, 2);
        expect((await freeFund.payout(0)).locked).to.be.false;
        expect((await freeFund.payout(1)).locked).to.be.false;
        expect((await freeFund.payout(2)).locked).to.be.false;
        expect(await freeFund.nextPayoutToUnlock()).to.be.equal(3);
      });
    });
    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, freeFund, project } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(project.wallet).unlockPayoutsTo(0)).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when the caller is not the unlocker', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(owner).unlockPayoutsTo(0))
          .to.be.revertedWithCustomError(freeFund, 'InvestmentFund__NotTheUnlocker')
          .withArgs(owner.address);
      });

      it("Should revert when next payout isn't less then payouts count", async () => {
        const { owner, unlocker, freeFund } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(unlocker).unlockPayoutsTo(0)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__NoPayoutToUnclock'
        );
      });

      it('Should revert when the given index is lest then the next available payout', async () => {
        const { owner, unlocker, freeFund, project, usdc, investmentNft, cap, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(cap, false);
        await freeFund.connect(unlocker).unlockPayoutsTo(0);

        await expect(freeFund.connect(unlocker).unlockPayoutsTo(0)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__PayoutIndexTooLow'
        );
      });

      it("Should revert when the given index is greater then the last payout's index", async () => {
        const { owner, unlocker, freeFund, project, usdc, investmentNft, cap, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        await freeFund.connect(owner).deployFunds();

        await freeFund.connect(project.wallet).provideProfit(amount, false);

        await expect(freeFund.connect(unlocker).unlockPayoutsTo(1)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__PayoutIndexTooHigh'
        );
      });
    });
  });

  describe('CloseFund', () => {
    describe('Success', () => {
      it('Should close fund', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(owner).closeFund()).to.emit(freeFund, 'FundClosed');
        expect(parseBytes32String(await freeFund.currentState())).to.equal(FundState.Closed);
      });
    });
    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).closeFund()).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when not called by owner', async () => {
        const { owner, user1, freeFund } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(user1).closeFund()).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  });

  describe('GetAvailableFundsDetails', () => {
    describe('Success', () => {
      it('Should return zero when not profit provided', async () => {
        const { freeFund, user1 } = await loadFixture(deployInvestmentFund);
        expect(await freeFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([0, 0, 0]);
      });

      it('Should return zero when no payout is unlocked', async () => {
        const { freeFund, user1, investmentNft, owner, cap, project, usdc } = await loadFixture(deployInvestmentFund);

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(amount, false);

        expect(await freeFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([0, 0, 0]);
      });

      it('Should return the available funds details without carry fee when no payout in profit', async () => {
        const { freeFund, user1, investmentNft, owner, cap, project, usdc, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(amount, false);
        await freeFund.connect(unlocker).unlockPayoutsTo(0);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        expect(await freeFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([
          amount.mul(10).div(100),
          0,
          1
        ]);
      });

      it('Should return the available funds details with carry fee when payout in profit', async () => {
        const { freeFund, user1, investmentNft, owner, cap, project, usdc, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(cap.mul(2), false);
        await freeFund.connect(unlocker).unlockPayoutsTo(1);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        const expectedEarningsFromFirstProfit = cap.mul(10).div(100);
        const expectedEarningsFromSecondProfit = cap.mul(10).div(100).mul(60).div(100);
        // 10% was already taken during profit providing
        const expectedCarryFee = cap.mul(10).div(100).mul(30).div(100);

        expect(await freeFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([
          expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit),
          expectedCarryFee,
          2
        ]);
      });

      it('Should return zero when the total investment is zero and a profit is provided', async () => {
        const { freeFund, user1, investmentNft, owner, cap, project, usdc, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        await freeFund.connect(owner).addProject(project.address);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        investmentNft.getPastParticipation.returns([0, 0]);

        await freeFund.connect(project.wallet).provideProfit(cap, false);
        await freeFund.connect(unlocker).unlockPayoutsTo(0);

        expect(await freeFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([0, 0, 1]);
      });
    });

    it('Should carry fee be zero when max discount', async () => {
      const { freeFund, user1, investmentNft, owner, cap, project, usdc, unlocker, staking } = await loadFixture(
        deployInvestmentFund
      );

      const amount = toUsdc('100000');
      investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
      await freeFund.connect(owner).addProject(project.address);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
      investmentNft.getTotalInvestmentValue.returns(cap);
      await freeFund.connect(owner).deployFunds();
      await freeFund.connect(project.wallet).provideProfit(cap.mul(2), false);
      await freeFund.connect(unlocker).unlockPayoutsTo(1);
      staking.getDiscountFromPreviousInvestmentInTimestamp.returns(3000);

      // 10% of total investment
      investmentNft.getPastParticipation.returns([amount, cap]);

      const expectedEarningsFromFirstProfit = cap.mul(10).div(100);
      const expectedEarningsFromSecondProfit = cap.mul(10).div(100).mul(90).div(100);

      expect(await freeFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([
        expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit),
        0,
        2
      ]);

      staking.getDiscountFromPreviousInvestmentInTimestamp.reset();
    });
  });

  describe('Withdraw', () => {
    describe('Success', () => {
      it('Should withdraw profits without carry fee distribution', async () => {
        const { owner, freeFund, investmentNft, usdc, cap, project, user1, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(cap, false);
        await freeFund.connect(unlocker).unlockPayoutsTo(0);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        const expectedEarnings = cap.mul(10).div(100);

        expect(await freeFund.connect(user1).withdraw())
          .to.emit(freeFund, 'ProfitWithdrawn')
          .withArgs(user1.address, usdc.address, expectedEarnings);
        expect(await freeFund.connect(user1.address).userTotalWithdrawal(user1.address)).to.be.equal(expectedEarnings);
        expect(await freeFund.connect(user1.address).userNextPayout(user1.address)).to.be.equal(1);
        expect(usdc.transfer).to.have.been.calledWith(user1.address, expectedEarnings);
      });

      it('Should withdraw profits and distribute carry fee', async () => {
        const {
          owner,
          freeFund,
          investmentNft,
          usdc,
          cap,
          project,
          user1,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue
        } = await loadFixture(deployInvestmentFund);

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await freeFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

        await freeFund.connect(owner).airdropInvestmentNFT(amount, user1.address);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await freeFund.connect(owner).deployFunds();
        await freeFund.connect(project.wallet).provideProfit(cap.mul(2), false);
        await freeFund.connect(unlocker).unlockPayoutsTo(1);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        const expectedEarningsFromFirstProfit = cap.mul(10).div(100);
        const expectedEarningsFromSecondProfit = cap.mul(10).div(100).mul(60).div(100);
        // 10% was already taken during profit providing
        const expectedCarryFee = cap.mul(10).div(100).mul(30).div(100);

        expect(await freeFund.connect(user1).withdraw())
          .to.emit(freeFund, 'ProfitWithdrawn')
          .withArgs(user1.address, usdc.address, expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit));
        expect(await freeFund.connect(user1.address).userTotalWithdrawal(user1.address)).to.be.equal(
          expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit)
        );
        expect(await freeFund.connect(user1.address).userNextPayout(user1.address)).to.be.equal(2);
        expect(usdc.transfer).to.have.been.calledWith(
          user1.address,
          expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit)
        );

        expect(usdc.transfer).to.have.been.calledWith(treasuryWallet.address, expectedCarryFee.mul(68).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPool.address, expectedCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(burnAddr.address, expectedCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(communityFund.address, expectedCarryFee.mul(2).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(genesisNftRevenue.address, expectedCarryFee.mul(12).div(100));
      });
    });
    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, freeFund, user1 } = await loadFixture(deployInvestmentFund);
        await expect(freeFund.connect(user1).withdraw()).to.be.revertedWithCustomError(
          freeFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when nothing to withdraw', async () => {
        const { owner, freeFund, user1, investmentNft, cap, usdc } = await loadFixture(deployInvestmentFund);
        await freeFund.connect(owner).stopCollectingFunds();
        await freeFund.connect(owner).deployFunds();

        await expect(freeFund.connect(user1).withdraw())
          .to.be.revertedWithCustomError(freeFund, 'InvestmentFund__NoFundsAvailable')
          .withArgs(user1.address);
      });
    });
  });

  describe('Set the staking wlth contract', () => {
    describe('Success', () => {
      it('Should set the staking contract', async () => {
        const { owner, freeFund, staking } = await loadFixture(deployInvestmentFund);

        expect(await freeFund.connect(owner).setStakingWlth(staking.address))
          .to.emit(freeFund, 'StakingWlthSet')
          .withArgs(staking.address);
        expect(await freeFund.stakingWlth()).to.be.equal(staking.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, freeFund, staking } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).setStakingWlth(staking.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the staking contract's address", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(
          freeFund.connect(owner).setStakingWlth(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__StakingWlthZeroAddress');
      });
    });
  });

  describe('Set the max investment percentage limit', () => {
    describe('Success', () => {
      it('Should set the max percentage investment limit', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        expect(await freeFund.connect(owner).setMaxPercentageWalletInvestmentLimit(50))
          .to.emit(freeFund, 'MaxInvestmentPercentageSet')
          .withArgs(50);
        expect(await freeFund.maxPercentageWalletInvestmentLimit()).to.be.equal(50);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).setMaxPercentageWalletInvestmentLimit(50)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Set the minimum investment amount', () => {
    describe('Success', () => {
      it('Should set the minimum investment amount', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        expect(await freeFund.connect(owner).setMinimumInvestment(50))
          .to.emit(freeFund, 'MinimumInvestmentSet')
          .withArgs(50);
        expect(await freeFund.minimumInvestment()).to.be.equal(50);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).setMinimumInvestment(50)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Increase cap', () => {
    describe('Success', () => {
      it('Should increase cap', async () => {
        const { owner, freeFund, cap } = await loadFixture(deployInvestmentFund);

        expect(await freeFund.connect(owner).increaseCapTo(cap.add(toUsdc('100000'))))
          .to.emit(freeFund, 'CapIncreased')
          .withArgs(50);
        expect(await freeFund.cap()).to.be.equal(cap.add(toUsdc('100000')));
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, freeFund, cap } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).increaseCapTo(cap.add(toUsdc('100000')))).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when cap smaller then previous', async () => {
        const { owner, freeFund, cap } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).increaseCapTo(cap.sub(1))).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__InvalidInvestmentCap'
        );
      });
    });
  });

  describe('Set the payouts unlocker', () => {
    describe('Success', () => {
      it('Should set the unlocker', async () => {
        const { owner, freeFund, unlocker } = await loadFixture(deployInvestmentFund);

        expect(await freeFund.connect(owner).setUnlocker(unlocker.address))
          .to.emit(freeFund, 'PayoutsUnlockerSet')
          .withArgs(unlocker.address);
        expect(await freeFund.unlocker()).to.be.equal(unlocker.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, freeFund, unlocker } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(user1).setUnlocker(unlocker.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the unlocker contract's address", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(freeFund.connect(owner).setUnlocker(ethers.constants.AddressZero)).to.be.revertedWithCustomError(
          freeFund,
          'InvestmentFund__UnlockerZeroAddress'
        );
      });
    });
  });

  describe('Set the profit provider', () => {
    describe('Success', () => {
      it('Should set the minimum investment amount', async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        const newProfitProvider = ethers.Wallet.createRandom();

        expect(await freeFund.connect(owner).setProfitProvider(newProfitProvider.address))
          .to.emit(freeFund, 'ProfitProviderSet')
          .withArgs(newProfitProvider.address);
        expect(await freeFund.profitProvider()).to.be.equal(newProfitProvider.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, freeFund } = await loadFixture(deployInvestmentFund);
        const newProfitProvider = ethers.Wallet.createRandom();

        await expect(freeFund.connect(user1).setProfitProvider(newProfitProvider.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the profit provider's address", async () => {
        const { owner, freeFund } = await loadFixture(deployInvestmentFund);

        await expect(
          freeFund.connect(owner).setProfitProvider(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(freeFund, 'InvestmentFund__ProfitProviderZeroAddress');
      });
    });
  });
});
