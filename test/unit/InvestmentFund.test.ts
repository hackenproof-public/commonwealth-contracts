import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  IERC165Upgradeable__factory,
  IInvestmentFund__factory,
  InvestmentFund,
  InvestmentNFT,
  Project,
  StakingWlth,
  USDC
} from '../../typechain-types';
import { FundState } from '../types';
import { getInterfaceId, toUsdc } from '../utils';

describe('InvestmentFund', () => {
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
    const managementFee = 1000;
    const cap = toUsdc('1000000');
    const maxPercentageWalletInvestmentLimit = 2000;
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

    await owner.sendTransaction({
      to: project.address,
      value: ethers.utils.parseEther('1000')
    });

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
        cap,
        maxPercentageWalletInvestmentLimit,
        minimumInvestment
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
      investmentFund,
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
      basisPoint
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        const details = await investmentFund.getDetails();

        expect(await investmentFund.owner()).to.be.equal(owner.address);
        expect(await investmentFund.unlocker()).to.be.equal(unlocker.address);
        expect(await investmentFund.name()).to.be.equal(fundName);
        expect(await investmentFund.currency()).to.be.equal(usdc.address);
        expect(await investmentFund.investmentNft()).to.be.equal(investmentNft.address);
        expect(await investmentFund.stakingWlth()).to.be.equal(staking.address);
        expect(await investmentFund.treasuryWallet()).to.be.equal(treasuryWallet.address);
        expect(await investmentFund.lpPoolAddress()).to.be.equal(lpPool.address);
        expect(await investmentFund.burnAddress()).to.be.equal(burnAddr.address);
        expect(await investmentFund.communityFund()).to.be.equal(communityFund.address);
        expect(await investmentFund.genesisNftRevenue()).to.be.equal(genesisNftRevenue.address);
        expect(await investmentFund.managementFee()).to.be.equal(managementFee);
        expect(await investmentFund.cap()).to.be.equal(cap);
        expect(await investmentFund.maxPercentageWalletInvestmentLimit()).to.be.equal(
          maxPercentageWalletInvestmentLimit
        );
        expect(await investmentFund.minimumInvestment()).to.be.equal(minimumInvestment);
        expect(await investmentFund.totalIncome()).to.be.equal(0);
        expect(await investmentFund.payouts()).to.have.lengthOf(0);
        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsIn);
        expect(
          await investmentFund.supportsInterface(
            ethers.utils.arrayify(getInterfaceId(IInvestmentFund__factory.createInterface()))
          )
        ).to.be.true;
        expect(
          await investmentFund.supportsInterface(
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__UnlockerZeroAddress');
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
          investmentFund,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__CurrencyZeroAddress');
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
          investmentFund,
          usdc,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvestmentNftZeroAddress');
      });

      //TODO Uncoment when staking is on production
      // it('Should revert when staking address is zero address', async () => {
      //   const {
      //     deployer,
      //     owner,
      //     unlocker,
      //     treasuryWallet,
      //     lpPool,
      //     burnAddr,
      //     communityFund,
      //     genesisNftRevenue,
      //     investmentFund,
      //     usdc,
      //     investmentNft,
      //     fundName,
      //     managementFee,
      //     cap,
      //     maxPercentageWalletInvestmentLimit,
      //     minimumInvestment
      //   } = await loadFixture(deployInvestmentFund);

      //   await expect(
      //     deployProxy(
      //       'InvestmentFund',
      //       [
      //         owner.address,
      //         unlocker.address,
      //         fundName,
      //         usdc.address,
      //         investmentNft.address,
      //         ethers.constants.AddressZero,
      //         {
      //           treasuryWallet: treasuryWallet.address,
      //           lpPool: lpPool.address,
      //           burn: burnAddr.address,
      //           communityFund: communityFund.address,
      //           genesisNftRevenue: genesisNftRevenue.address
      //         },
      //         managementFee,
      //         cap,
      //         maxPercentageWalletInvestmentLimit
      //         minimumInvestment
      //       ],
      //       deployer
      //     )
      //   ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__StakingWlthZeroAddress');
      // });

      it('Should revert when treasuryWallet address is zero address', async () => {
        const {
          deployer,
          owner,
          unlocker,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__TreasuryZeroAddress');
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__LpPoolZeroAddress');
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__BurnZeroAddress');
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__CommunityFundZeroAddress');
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__GenesisNftRevenueZeroAddress');
      });

      it('Should revert when managementFee is greater than 10000', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              10001,
              cap,
              maxPercentageWalletInvestmentLimit,
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvalidManagementFee');
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
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvalidInvestmentCap');
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
          investmentFund,
          usdc,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
        investmentNft.supportsInterface.returns(false);

        await expect(
          deployProxy(
            'InvestmentFund',
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
              minimumInvestment
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__InvestmentNftInterfaceNotSupported');
      });

      it('Should revert when initialize again', async () => {
        const {
          deployer,
          owner,
          unlocker,
          treasuryWallet,
          lpPool,
          burnAddr,
          communityFund,
          genesisNftRevenue,
          investmentFund,
          usdc,
          investmentNft,
          staking,
          fundName,
          managementFee,
          cap,
          maxPercentageWalletInvestmentLimit,
          minimumInvestment
        } = await loadFixture(deployInvestmentFund);

        await expect(
          investmentFund.initialize(
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
            minimumInvestment
          )
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('Invest', () => {
    describe('Success', () => {
      it('Should invest', async () => {
        const { user1, investmentFund, usdc, investmentNft, treasuryWallet, basisPoint } = await loadFixture(
          deployInvestmentFund
        );
        const amount = toUsdc('10000');
        const fee = amount.mul(1000).div(basisPoint);

        usdc.transferFrom.returns(true);
        await expect(investmentFund.connect(user1).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(user1.address, usdc.address, amount, fee);
        expect(investmentNft.mint).to.have.been.calledWith(user1.address, amount);
        expect(usdc.transferFrom).to.have.been.calledWith(user1.address, investmentFund.address, amount.sub(fee));
        expect(usdc.transferFrom).to.have.been.calledWith(user1.address, treasuryWallet.address, fee);
      });

      it("Should change state to 'CapReached' when investment reaches the cap", async () => {
        const { user1, investmentFund, usdc, investmentNft, cap, managementFee, basisPoint } = await loadFixture(
          deployInvestmentFund
        );
        const amount = toUsdc('10000');
        const fee = amount.mul(managementFee).div(basisPoint);
        usdc.transferFrom.returns(true);

        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));

        await expect(investmentFund.connect(user1).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(user1.address, usdc.address, amount, fee)
          .to.emit(investmentFund, 'CapReached');
      });
    });

    describe('Reverts', () => {
      it("Should revert if fund not in 'FundsIn' state", async () => {
        const { user1, investmentFund, usdc, investmentNft, cap } = await loadFixture(deployInvestmentFund);
        usdc.transferFrom.returns(true);

        investmentNft.getTotalInvestmentValue.returns(cap.sub(toUsdc('10000')));
        await investmentFund.connect(user1).invest(toUsdc('10000'));

        await expect(investmentFund.connect(user1).invest(toUsdc('10000'))).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when investment less then the required minimal amount', async () => {
        const { user1, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).invest(toUsdc('49'))).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__InvestmentTooLow'
        );
      });

      it("Should revert when a user's investment exceeds the maximum wallet investment limit", async () => {
        const { user1, investmentFund, cap, maxPercentageWalletInvestmentLimit, basisPoint } = await loadFixture(
          deployInvestmentFund
        );
        const maxLimit = cap.mul(maxPercentageWalletInvestmentLimit).div(basisPoint);

        await expect(investmentFund.connect(user1).invest(maxLimit.add(1))).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmmentFund__MaxPercentageWalletInvestmentLimitReached'
        );
      });

      it("Should revert when an investment exceeds the fund's cap", async () => {
        const { user1, investmentFund, cap, investmentNft } = await loadFixture(deployInvestmentFund);
        investmentNft.getTotalInvestmentValue.returns(cap);

        await expect(investmentFund.connect(user1).invest(toUsdc('100')))
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__TotalInvestmentAboveCap')
          .withArgs(cap.add(toUsdc('100')));
      });
    });
  });

  describe('AddProject', () => {
    describe('Success', () => {
      it('Should add project', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(owner).addProject(project.address))
          .to.emit(investmentFund, 'ProjectAdded')
          .withArgs(owner.address, project.address);
        expect(await investmentFund.getProjectsCount()).to.be.equal(1);
        expect(await investmentFund.listProjects()).to.have.lengthOf(1);
        expect((await investmentFund.listProjects())[0]).to.be.equal(project.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { user1, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).addProject(project.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when project's address is zero", async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(
          investmentFund.connect(owner).addProject(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__ProjectZeroAddress');
      });

      it("Should revert when project's address is already added", async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).addProject(project.address);

        await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__ProjectExist'
        );
      });

      it("Should revert when the fund not in 'FundsIn' state", async () => {
        const { owner, investmentFund, usdc, investmentNft, cap, project, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        usdc.transferFrom.returns(true);
        await investmentFund.connect(user1).invest(amount);

        await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('RemoveProject', () => {
    describe('Success', () => {
      it('Should remove project', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).addProject(project.address);

        await expect(investmentFund.connect(owner).removeProject(project.address))
          .to.emit(investmentFund, 'ProjectRemoved')
          .withArgs(owner.address, project.address);
        expect(await investmentFund.getProjectsCount()).to.be.equal(0);
        expect(await investmentFund.listProjects()).to.have.lengthOf(0);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { owner, user1, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).addProject(project.address);

        await expect(investmentFund.connect(user1).removeProject(project.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when a project is not registered', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(owner).removeProject(project.address))
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NotRegisteredProject')
          .withArgs(project.address);
      });

      it("Should revert when the fund not in 'FundsIn' state", async () => {
        const { owner, investmentFund, usdc, investmentNft, cap, project, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        usdc.transferFrom.returns(true);
        await investmentFund.connect(user1).invest(amount);

        await expect(investmentFund.connect(owner).removeProject(project.address)).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('StopCollectingFunds', () => {
    describe('Success', () => {
      it('Should stop collecting funds', async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        expect(await investmentFund.connect(owner).stopCollectingFunds()).to.emit(
          investmentFund,
          'FundsCollectionStopped'
        );
        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.CapReached);
      });
    });

    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { owner, user1, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).stopCollectingFunds()).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when the fund not in 'FundsIn' state", async () => {
        const { owner, user1, investmentNft, usdc, investmentFund, cap } = await loadFixture(deployInvestmentFund);

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        usdc.transferFrom.returns(true);
        await investmentFund.connect(user1).invest(amount);

        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  // TODO Need to be updated after the logic is defined and implemented
  describe('DeployFunds', () => {
    describe('Success', () => {
      it('Should deploy funds to the projects', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();

        expect(await investmentFund.connect(owner).deployFunds());
        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsDeployed);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { owner, user1, investmentFund, investmentNft, usdc, cap } = await loadFixture(deployInvestmentFund);
        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        usdc.transferFrom.returns(true);
        await investmentFund.connect(user1).invest(amount);

        await expect(investmentFund.connect(user1).deployFunds()).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when the fund not in 'CapReached' state", async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(owner).deployFunds()).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('DeployFundsToProject', () => {
    describe('Success', () => {
      it("Should deploy funds to the project's address", async () => {
        const { owner, user1, investmentFund, project, investmentNft, usdc, cap } = await loadFixture(
          deployInvestmentFund
        );
        const amount = toUsdc('10000');
        const fee = amount.mul(1000).div(10000);

        usdc.transferFrom.returns(true);
        usdc.balanceOf.whenCalledWith(investmentFund.address).returns(amount);
        usdc.approve.returns(true);
        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.connect(user1).invest(amount);

        await expect(investmentFund.connect(owner).deployFundsToProject(project.address, amount))
          .to.emit(investmentFund, 'FundsDeployedToProject')
          .withArgs(investmentFund.address, project.address, amount);
        expect(usdc.approve).to.have.been.calledWith(project.address, amount);
        expect(project.deployFunds).to.have.been.calledWith(amount);
      });
    });
    describe('Reverts', () => {
      it('Should revert if not called by owner', async () => {
        const { user1, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(
          investmentFund.connect(user1).deployFundsToProject(project.address, toUsdc('10000'))
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when the project is not registered', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(owner).deployFundsToProject(project.address, toUsdc('10000')))
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NotRegisteredProject')
          .withArgs(project.address);
      });

      it('Should revert when balance of the fund is less than the amount to be deployed', async () => {
        const { owner, usdc, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).addProject(project.address);
        usdc.balanceOf.whenCalledWith(investmentFund.address).returns(toUsdc('1000'));

        await expect(
          investmentFund.connect(owner).deployFundsToProject(project.address, toUsdc('10000'))
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NotEnoughTokensOnInvestmentFund');
      });
    });
  });

  describe('ProvideProfit', () => {
    describe('Success', () => {
      const setup = async () => {
        const {
          owner,
          investmentFund,
          usdc,
          user1,
          investmentNft,
          cap,
          project,
          treasuryWallet,
          genesisNftRevenue,
          lpPool,
          burnAddr,
          communityFund
        } = await loadFixture(deployInvestmentFund);

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await investmentFund.connect(owner).deployFunds();

        return {
          owner,
          investmentFund,
          usdc,
          user1,
          investmentNft,
          cap,
          project,
          treasuryWallet,
          genesisNftRevenue,
          lpPool,
          burnAddr,
          communityFund
        };
      };

      it('Should provide profit to the fund and set values when income lower than total investment', async () => {
        const { investmentFund, usdc, project } = await loadFixture(setup);

        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        const payoutAmount = toUsdc('1000');

        expect(await investmentFund.connect(project.wallet).provideProfit(payoutAmount))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, payoutAmount, 0, blockNumberAfterOperation);
        expect(usdc.transferFrom).to.have.been.calledWith(project.address, investmentFund.address, payoutAmount);
        expect(await investmentFund.getPayoutsCount()).to.be.equal(1);
        expect(await investmentFund.isInProfit()).to.be.false;
        const payouts = await investmentFund.payouts();
        expect(payouts).to.have.lengthOf(1);
        expect(payouts[0].value).to.be.equal(payoutAmount);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.true;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await investmentFund.payout(0)).to.be.deep.equal(payouts[0]);
      });

      it('Should probvide profite when the new total income is equal to total investment', async () => {
        const { investmentFund, usdc, cap, project } = await loadFixture(setup);

        const payoutAmount = cap;
        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        expect(await investmentFund.connect(project.wallet).provideProfit(payoutAmount))
          .to.emit(investmentFund, 'BreakevenReached')
          .withArgs(cap)
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, payoutAmount, 0, blockNumberAfterOperation);

        expect(usdc.transferFrom).to.have.been.calledWith(project.address, investmentFund.address, payoutAmount);
        expect(await investmentFund.getPayoutsCount()).to.be.equal(1);
        expect(await investmentFund.isInProfit()).to.be.false;
        const payouts = await investmentFund.payouts();
        expect(payouts).to.have.lengthOf(1);
        expect(payouts[0].value).to.be.equal(payoutAmount);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.true;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await investmentFund.payout(0)).to.be.deep.equal(payouts[0]);
      });

      it('Should provider profit and distribute initial carry fee when the new total income is greater than total investment', async () => {
        const {
          investmentFund,
          usdc,
          cap,
          project,
          treasuryWallet,
          genesisNftRevenue,
          lpPool,
          burnAddr,
          communityFund
        } = await loadFixture(setup);

        const payoutAmount = cap.add(toUsdc('100'));
        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        const initialCarryFee = payoutAmount.sub(cap).mul(1000).div(10000);

        expect(await investmentFund.connect(project.wallet).provideProfit(payoutAmount))
          .to.emit(investmentFund, 'BreakevenReached')
          .withArgs(cap)
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, cap, initialCarryFee, blockNumberAfterOperation);
        expect(usdc.transferFrom).to.have.been.calledWith(project.address, investmentFund.address, cap);
        expect(await investmentFund.getPayoutsCount()).to.be.equal(2);
        expect(await investmentFund.isInProfit()).to.be.true;

        const payouts = await investmentFund.payouts();
        expect(payouts).to.have.lengthOf(2);
        expect(payouts[0].value).to.be.equal(cap);
        expect(payouts[0].inProfit).to.be.false;
        expect(payouts[0].locked).to.be.true;
        expect(payouts[0].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[0].blockData.timestamp).to.be.equal(await time.latest());
        expect(await investmentFund.payout(0)).to.be.deep.equal(payouts[0]);

        expect(payouts[1].value).to.be.equal(payoutAmount.sub(cap));
        expect(payouts[1].inProfit).to.be.true;
        expect(payouts[1].locked).to.be.true;
        expect(payouts[1].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[1].blockData.timestamp).to.be.equal(await time.latest());
        expect(await investmentFund.payout(1)).to.be.deep.equal(payouts[1]);

        expect(usdc.transfer).to.have.been.calledWith(treasuryWallet.address, initialCarryFee.mul(68).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPool.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(burnAddr.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(communityFund.address, initialCarryFee.mul(2).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(genesisNftRevenue.address, initialCarryFee.mul(12).div(100));
      });

      it('Should provide profit and initial carry fee when the total income is already greater than the total investment', async () => {
        const {
          investmentFund,
          usdc,
          cap,
          project,
          treasuryWallet,
          genesisNftRevenue,
          lpPool,
          burnAddr,
          communityFund
        } = await loadFixture(setup);

        const payoutAmount = toUsdc('100');
        const initialCarryFee = payoutAmount.mul(10).div(100);
        await investmentFund.connect(project.wallet).provideProfit(cap);

        const blockNumberAfterOperation = (await time.latestBlock()) + 1;

        expect(await investmentFund.connect(project.wallet).provideProfit(payoutAmount))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, payoutAmount, initialCarryFee, blockNumberAfterOperation);

        expect(usdc.transferFrom).to.have.been.calledWith(project.address, investmentFund.address, cap);
        expect(await investmentFund.getPayoutsCount()).to.be.equal(2);
        expect(await investmentFund.isInProfit()).to.be.true;

        const payouts = await investmentFund.payouts();
        expect(payouts).to.have.lengthOf(2);
        expect(payouts[1].value).to.be.equal(payoutAmount);
        expect(payouts[1].inProfit).to.be.true;
        expect(payouts[1].locked).to.be.true;
        expect(payouts[1].blockData.number).to.be.equal(blockNumberAfterOperation);
        expect(payouts[1].blockData.timestamp).to.be.equal(await time.latest());
        expect(await investmentFund.payout(1)).to.be.deep.equal(payouts[1]);

        expect(usdc.transfer).to.have.been.calledWith(treasuryWallet.address, initialCarryFee.mul(68).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPool.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(burnAddr.address, initialCarryFee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(communityFund.address, initialCarryFee.mul(2).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(genesisNftRevenue.address, initialCarryFee.mul(12).div(100));
      });
    });

    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(project.wallet).provideProfit(toUsdc('100'))).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when the project is not registered', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(project.wallet).provideProfit(toUsdc('100')))
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NotRegisteredProject')
          .withArgs(project.address);
      });

      it('Should revert when amount is zero', async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(project.wallet).provideProfit(0)).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__ZeroProfitProvided'
        );
      });
    });
  });

  describe('UnlockPayoutsTo', () => {
    describe('Success', () => {
      it('Should unlock all payouts to the given index', async () => {
        const { owner, unlocker, investmentFund, project, usdc, investmentNft, cap, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(cap);
        await investmentFund.connect(project.wallet).provideProfit(cap);
        await investmentFund.connect(project.wallet).provideProfit(cap);

        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(2))
          .to.emit(investmentFund, 'PayoutsUnlocked')
          .withArgs(0, 2);
        expect((await investmentFund.payout(0)).locked).to.be.false;
        expect((await investmentFund.payout(1)).locked).to.be.false;
        expect((await investmentFund.payout(2)).locked).to.be.false;
        expect(await investmentFund.nextPayoutToUnlock()).to.be.equal(3);
      });
    });
    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, investmentFund, project } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(project.wallet).unlockPayoutsTo(0)).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when the caller is not the unlocker', async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(owner).unlockPayoutsTo(0))
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NotTheUnlocker')
          .withArgs(owner.address);
      });

      it("Should revert when next payout isn't less then payouts count", async () => {
        const { owner, unlocker, investmentFund } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0)).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__NoPayoutToUnclock'
        );
      });

      it('Should revert when the given index is lest then the next available payout', async () => {
        const { owner, unlocker, investmentFund, project, usdc, investmentNft, cap, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(cap);
        await investmentFund.connect(unlocker).unlockPayoutsTo(0);

        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(0)).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__PayoutIndexTooLow'
        );
      });

      it("Should revert when the given index is greater then the last payout's index", async () => {
        const { owner, unlocker, investmentFund, project, usdc, investmentNft, cap, user1 } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        await investmentFund.connect(owner).deployFunds();

        await investmentFund.connect(project.wallet).provideProfit(amount);

        await expect(investmentFund.connect(unlocker).unlockPayoutsTo(1)).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__PayoutIndexTooHigh'
        );
      });
    });
  });

  describe('CloseFund', () => {
    describe('Success', () => {
      it('Should close fund', async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(owner).closeFund()).to.emit(investmentFund, 'FundClosed');
        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.Closed);
      });
    });
    describe('Reverts', () => {
      it("Should revert when the fund not in 'FundsDeployed' state", async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(owner).closeFund()).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when not called by owner', async () => {
        const { owner, user1, investmentFund } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(user1).closeFund()).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  });

  describe('GetAvailableFundsDetails', () => {
    describe('Success', () => {
      it('Should return zero when not profit provided', async () => {
        const { investmentFund, user1 } = await loadFixture(deployInvestmentFund);
        expect(await investmentFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([0, 0, 0]);
      });

      it('Should return zero when no payout is unlocked', async () => {
        const { investmentFund, user1, investmentNft, owner, cap, project, usdc } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('10000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(amount);

        expect(await investmentFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([0, 0, 0]);
      });

      it('Should return the available funds details without carry fee when no payout in profit', async () => {
        const { investmentFund, user1, investmentNft, owner, cap, project, usdc, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(amount);
        await investmentFund.connect(unlocker).unlockPayoutsTo(0);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        expect(await investmentFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([
          amount.mul(10).div(100),
          0,
          1
        ]);
      });

      it('Should return the available funds details with carry fee when payout in profit', async () => {
        const { investmentFund, user1, investmentNft, owner, cap, project, usdc, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(cap.mul(2));
        await investmentFund.connect(unlocker).unlockPayoutsTo(1);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        const expectedEarningsFromFirstProfit = cap.mul(10).div(100);
        const expectedEarningsFromSecondProfit = cap.mul(10).div(100).mul(60).div(100);
        // 10% was already taken during profit providing
        const expectedCarryFee = cap.mul(10).div(100).mul(30).div(100);

        expect(await investmentFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([
          expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit),
          expectedCarryFee,
          2
        ]);
      });

      it('Should return zero when the total investment is zero and a profit is provided', async () => {
        const { investmentFund, user1, investmentNft, owner, cap, project, usdc, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        investmentNft.getPastParticipation.returns([0, 0]);

        await investmentFund.connect(project.wallet).provideProfit(cap);
        await investmentFund.connect(unlocker).unlockPayoutsTo(0);

        expect(await investmentFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([0, 0, 1]);
      });
    });

    it('Should carry fee be zero when max discount', async () => {
      const { investmentFund, user1, investmentNft, owner, cap, project, usdc, unlocker, staking } = await loadFixture(
        deployInvestmentFund
      );

      const amount = toUsdc('100000');
      investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
      await investmentFund.connect(owner).addProject(project.address);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      await investmentFund.connect(user1).invest(amount);
      investmentNft.getTotalInvestmentValue.returns(cap);
      await investmentFund.connect(owner).deployFunds();
      await investmentFund.connect(project.wallet).provideProfit(cap.mul(2));
      await investmentFund.connect(unlocker).unlockPayoutsTo(1);
      staking.getDiscountFromPreviousInvestmentInTimestamp.returns(3000);

      // 10% of total investment
      investmentNft.getPastParticipation.returns([amount, cap]);

      const expectedEarningsFromFirstProfit = cap.mul(10).div(100);
      const expectedEarningsFromSecondProfit = cap.mul(10).div(100).mul(90).div(100);

      expect(await investmentFund.getAvailableFundsDetails(user1.address)).to.be.deep.equal([
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
        const { owner, investmentFund, investmentNft, usdc, cap, project, user1, unlocker } = await loadFixture(
          deployInvestmentFund
        );

        const amount = toUsdc('100000');
        investmentNft.getTotalInvestmentValue.returns(cap.sub(amount));
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(cap);
        await investmentFund.connect(unlocker).unlockPayoutsTo(0);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        const expectedEarnings = cap.mul(10).div(100);

        expect(await investmentFund.connect(user1).withdraw())
          .to.emit(investmentFund, 'ProfitWithdrawn')
          .withArgs(user1.address, usdc.address, expectedEarnings);
        expect(await investmentFund.connect(user1.address).userTotalWithdrawal(user1.address)).to.be.equal(
          expectedEarnings
        );
        expect(await investmentFund.connect(user1.address).userNextPayout(user1.address)).to.be.equal(1);
        expect(usdc.transfer).to.have.been.calledWith(user1.address, expectedEarnings);
      });

      it('Should withdraw profits and distribute carry fee', async () => {
        const {
          owner,
          investmentFund,
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
        await investmentFund.connect(owner).addProject(project.address);
        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        await investmentFund.connect(user1).invest(amount);
        investmentNft.getTotalInvestmentValue.returns(cap);
        await investmentFund.connect(owner).deployFunds();
        await investmentFund.connect(project.wallet).provideProfit(cap.mul(2));
        await investmentFund.connect(unlocker).unlockPayoutsTo(1);

        // 10% of total investment
        investmentNft.getPastParticipation.returns([amount, cap]);

        const expectedEarningsFromFirstProfit = cap.mul(10).div(100);
        const expectedEarningsFromSecondProfit = cap.mul(10).div(100).mul(60).div(100);
        // 10% was already taken during profit providing
        const expectedCarryFee = cap.mul(10).div(100).mul(30).div(100);

        expect(await investmentFund.connect(user1).withdraw())
          .to.emit(investmentFund, 'ProfitWithdrawn')
          .withArgs(user1.address, usdc.address, expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit));
        expect(await investmentFund.connect(user1.address).userTotalWithdrawal(user1.address)).to.be.equal(
          expectedEarningsFromFirstProfit.add(expectedEarningsFromSecondProfit)
        );
        expect(await investmentFund.connect(user1.address).userNextPayout(user1.address)).to.be.equal(2);
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
        const { owner, investmentFund, user1 } = await loadFixture(deployInvestmentFund);
        await expect(investmentFund.connect(user1).withdraw()).to.be.revertedWithCustomError(
          investmentFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });

      it('Should revert when nothing to withdraw', async () => {
        const { owner, investmentFund, user1, investmentNft, cap, usdc } = await loadFixture(deployInvestmentFund);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        await expect(investmentFund.connect(user1).withdraw())
          .to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__NoFundsAvailable')
          .withArgs(user1.address);
      });
    });
  });

  describe('Set the staking wlth contract', () => {
    describe('Success', () => {
      it('Should set the staking contract', async () => {
        const { owner, investmentFund, staking } = await loadFixture(deployInvestmentFund);

        expect(await investmentFund.connect(owner).setStakingWlth(staking.address))
          .to.emit(investmentFund, 'StakingWlthSet')
          .withArgs(staking.address);
        expect(await investmentFund.stakingWlth()).to.be.equal(staking.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, investmentFund, staking } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).setStakingWlth(staking.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the staking contract's address", async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(
          investmentFund.connect(owner).setStakingWlth(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__StakingWlthZeroAddress');
      });
    });
  });

  describe('Set the max investment percentage limit', () => {
    describe('Success', () => {
      it('Should set the max percentage investment limit', async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        expect(await investmentFund.connect(owner).setMaxPercentageWalletInvestmentLimit(50))
          .to.emit(investmentFund, 'MaxInvestmentPercentageSet')
          .withArgs(50);
        expect(await investmentFund.maxPercentageWalletInvestmentLimit()).to.be.equal(50);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).setMaxPercentageWalletInvestmentLimit(50)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Set the minimum investment amount', () => {
    describe('Success', () => {
      it('Should set the minimum investment amount', async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        expect(await investmentFund.connect(owner).setMinimumInvestment(50))
          .to.emit(investmentFund, 'MinimumInvestmentSet')
          .withArgs(50);
        expect(await investmentFund.minimumInvestment()).to.be.equal(50);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).setMinimumInvestment(50)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Increase cap', () => {
    describe('Success', () => {
      it('Should increase cap', async () => {
        const { owner, investmentFund, cap } = await loadFixture(deployInvestmentFund);

        expect(await investmentFund.connect(owner).increaseCapTo(cap.add(toUsdc('100000'))))
          .to.emit(investmentFund, 'CapIncreased')
          .withArgs(50);
        expect(await investmentFund.cap()).to.be.equal(cap.add(toUsdc('100000')));
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, investmentFund, cap } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).increaseCapTo(cap.add(toUsdc('100000')))).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert when cap smaller then previous', async () => {
        const { owner, investmentFund, cap } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(owner).increaseCapTo(cap.sub(1))).to.be.revertedWithCustomError(
          investmentFund,
          'InvestmentFund__InvalidInvestmentCap'
        );
      });
    });
  });

  describe('Set the payouts unlocker', () => {
    describe('Success', () => {
      it('Should set the unlocker', async () => {
        const { owner, investmentFund, unlocker } = await loadFixture(deployInvestmentFund);

        expect(await investmentFund.connect(owner).setUnlocker(unlocker.address))
          .to.emit(investmentFund, 'PayoutsUnlockerSet')
          .withArgs(unlocker.address);
        expect(await investmentFund.unlocker()).to.be.equal(unlocker.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, investmentFund, unlocker } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).setUnlocker(unlocker.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the unlocker contract's address", async () => {
        const { owner, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(
          investmentFund.connect(owner).setUnlocker(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(investmentFund, 'InvestmentFund__UnlockerZeroAddress');
      });
    });
  });

  describe('Allow function in state', () => {
    describe('Reverts', () => {
      it('Should revert when called not by the owner', async () => {
        const { user1, investmentFund } = await loadFixture(deployInvestmentFund);

        await expect(investmentFund.connect(user1).allowFunctionsInStates()).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });
});
