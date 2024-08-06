import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  IERC165Upgradeable__factory,
  IPerpetualFund__factory,
  PerpetualFund,
  PerpetualNFT,
  ProfitProvider,
  StakingWlth,
  USDC
} from '../../typechain-types';
import { FundState } from '../types';
import { getInterfaceId, toUsdc } from '../utils';

describe('PerpetualFund', () => {
  const deployPerpetualFund = async () => {
    const [
      deployer,
      owner,
      fundsWallet,
      profitGenerator,
      profitDistributor,
      revenueWallet,
      lpPoolWallet,
      buybackAndBurnWallet,
      secondarySalesWallet,
      user1,
      user2
    ] = await ethers.getSigners();

    const basisPoint = 10000;

    const fundName = 'Perpetual Fund';
    const managementFee = 1000;
    const minimumInvestment = toUsdc('50');

    const config = {
      name: fundName,
      managementFee: managementFee,
      minimumInvestment: minimumInvestment,
      revenueWallet: revenueWallet.address,
      lpPoolWallet: lpPoolWallet.address,
      buybackAndBurnWallet: buybackAndBurnWallet.address,
      secondarySalesWallet: secondarySalesWallet.address
    };

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    usdc.transferFrom.reset();
    usdc.transfer.reset();
    usdc.balanceOf.reset();
    usdc.approve.reset();

    const perpetualNFT: FakeContract<PerpetualNFT> = await smock.fake('PerpetualNFT');
    perpetualNFT.supportsInterface.reset();
    perpetualNFT.getPastTotalInvestmentValue.reset();
    perpetualNFT.getPastParticipation.reset();
    perpetualNFT.supportsInterface.returns(true);

    const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
    staking.getDiscountFromPreviousInvestmentInTimestamp.reset();

    const profitProvider: FakeContract<ProfitProvider> = await smock.fake('ProfitProvider');

    await owner.sendTransaction({
      to: profitProvider.address,
      value: ethers.utils.parseEther('1000')
    });

    const perpetualFund: PerpetualFund = await deployProxy(
      'PerpetualFund',
      [
        owner.address,
        usdc.address,
        perpetualNFT.address,
        staking.address,
        config,
        profitProvider.address,
        profitGenerator.address,
        profitDistributor.address
      ],
      deployer
    );

    return {
      deployer,
      owner,
      revenueWallet,
      lpPoolWallet,
      buybackAndBurnWallet,
      secondarySalesWallet,
      perpetualFund,
      usdc,
      perpetualNFT,
      staking,
      fundName,
      managementFee,
      minimumInvestment,
      user1,
      user2,
      basisPoint,
      profitProvider,
      fundsWallet,
      profitDistributor,
      profitGenerator
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with inital values', async () => {
        const {
          owner,
          revenueWallet,
          lpPoolWallet,
          buybackAndBurnWallet,
          secondarySalesWallet,
          perpetualFund,
          profitProvider,
          profitDistributor,
          profitGenerator,
          usdc,
          perpetualNFT,
          staking,
          fundName,
          managementFee,
          minimumInvestment
        } = await loadFixture(deployPerpetualFund);

        const details = await perpetualFund.getDetails();

        expect(await perpetualFund.owner()).to.be.equal(owner.address);
        expect(await perpetualFund.name()).to.be.equal(fundName);
        expect(await perpetualFund.currency()).to.be.equal(usdc.address);
        expect(await perpetualFund.perpetualNFT()).to.be.equal(perpetualNFT.address);
        expect(await perpetualFund.stakingWlth()).to.be.equal(staking.address);
        expect(await perpetualFund.revenueWallet()).to.be.equal(revenueWallet.address);
        expect(await perpetualFund.lpPoolWallet()).to.be.equal(lpPoolWallet.address);
        expect(await perpetualFund.buybackAndBurnWallet()).to.be.equal(buybackAndBurnWallet.address);
        expect(await perpetualFund.secondarySalesWallet()).to.be.equal(secondarySalesWallet.address);
        expect(await perpetualFund.managementFee()).to.be.equal(managementFee);
        expect(await perpetualFund.minimumInvestment()).to.be.equal(minimumInvestment);
        expect(await perpetualFund.profitDistributor()).to.be.equal(profitDistributor.address);
        expect(await perpetualFund.profitGenerator()).to.be.equal(profitGenerator.address);
        expect(await perpetualFund.profitProvider()).to.be.equal(profitProvider.address);
        expect(await perpetualFund.totalIncome()).to.be.equal(0);
        expect(
          await perpetualFund.supportsInterface(
            ethers.utils.arrayify(getInterfaceId(IPerpetualFund__factory.createInterface()))
          )
        ).to.be.true;
        expect(
          await perpetualFund.supportsInterface(
            ethers.utils.arrayify(getInterfaceId(IERC165Upgradeable__factory.createInterface()))
          )
        ).to.be.true;
        expect(parseBytes32String(await perpetualFund.currentState())).to.equal(FundState.FundsIn);

        expect(details.name).to.be.equal(fundName);
        expect(details.currency).to.be.equal(usdc.address);
        expect(details.perpetualNFT).to.be.equal(perpetualNFT.address);
        expect(details.revenueWallet).to.be.equal(revenueWallet.address);
        expect(details.lpPoolWallet).to.be.equal(lpPoolWallet.address);
        expect(details.buybackAndBurnWallet).to.be.equal(buybackAndBurnWallet.address);
        expect(details.secondarySalesWallet).to.be.equal(secondarySalesWallet.address);
        expect(details.managementFee).to.be.equal(managementFee);
        expect(details.totalInvestment).to.be.equal(0);
        expect(details.totalIncome).to.be.equal(0);
        getInterfaceId(IPerpetualFund__factory.createInterface());
        expect(details.minimumInvestment).to.be.equal(minimumInvestment);
      });
    });

    describe('Reverts', () => {
      it("Should revert when owner's address is zero address", async () => {
        const {
          deployer,
          owner,
          revenueWallet,
          lpPoolWallet,
          buybackAndBurnWallet,
          secondarySalesWallet,
          perpetualFund,
          perpetualNFT,
          staking,
          fundName,
          managementFee,
          minimumInvestment,
          profitProvider,
          profitGenerator,
          profitDistributor
        } = await loadFixture(deployPerpetualFund);

        await expect(
          deployProxy(
            'PerpetualFund',
            [
              ethers.constants.AddressZero,
              owner.address,
              perpetualNFT.address,
              staking.address,
              {
                name: fundName,
                managementFee: managementFee,
                minimumInvestment: minimumInvestment,
                revenueWallet: revenueWallet.address,
                lpPoolWallet: lpPoolWallet.address,
                buybackAndBurnWallet: buybackAndBurnWallet.address,
                secondarySalesWallet: secondarySalesWallet.address
              },
              profitProvider.address,
              profitGenerator.address,
              profitDistributor.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(perpetualFund, 'OwnablePausable__OwnerAccountZeroAddress');
      });

      it('Should revert when currency address is zero address', async () => {
        const {
          deployer,
          owner,
          revenueWallet,
          lpPoolWallet,
          buybackAndBurnWallet,
          secondarySalesWallet,
          perpetualFund,
          perpetualNFT,
          staking,
          fundName,
          managementFee,
          minimumInvestment,
          profitProvider,
          profitGenerator,
          profitDistributor
        } = await loadFixture(deployPerpetualFund);

        await expect(
          deployProxy(
            'PerpetualFund',
            [
              owner.address,
              ethers.constants.AddressZero,
              perpetualNFT.address,
              staking.address,
              {
                name: fundName,
                managementFee: managementFee,
                minimumInvestment: minimumInvestment,
                revenueWallet: revenueWallet.address,
                lpPoolWallet: lpPoolWallet.address,
                buybackAndBurnWallet: buybackAndBurnWallet.address,
                secondarySalesWallet: secondarySalesWallet.address
              },
              profitProvider.address,
              profitGenerator.address,
              profitDistributor.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
      });

      it('Should revert when perpetual nft address is zero address', async () => {
        const {
          deployer,
          owner,
          revenueWallet,
          lpPoolWallet,
          buybackAndBurnWallet,
          secondarySalesWallet,
          perpetualFund,
          perpetualNFT,
          staking,
          fundName,
          managementFee,
          minimumInvestment,
          profitProvider,
          profitGenerator,
          profitDistributor
        } = await loadFixture(deployPerpetualFund);

        await expect(
          deployProxy(
            'PerpetualFund',
            [
              owner.address,
              perpetualNFT.address,
              ethers.constants.AddressZero,
              staking.address,
              {
                name: fundName,
                managementFee: managementFee,
                minimumInvestment: minimumInvestment,
                revenueWallet: revenueWallet.address,
                lpPoolWallet: lpPoolWallet.address,
                buybackAndBurnWallet: buybackAndBurnWallet.address,
                secondarySalesWallet: secondarySalesWallet.address
              },
              profitProvider.address,
              profitGenerator.address,
              profitDistributor.address
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
      });
    });

    it('Should revert when staking address is zero address', async () => {
      const {
        deployer,
        owner,
        revenueWallet,
        lpPoolWallet,
        buybackAndBurnWallet,
        secondarySalesWallet,
        perpetualFund,
        perpetualNFT,
        usdc,
        fundName,
        managementFee,
        minimumInvestment,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        deployProxy(
          'PerpetualFund',
          [
            owner.address,
            perpetualNFT.address,
            usdc.address,
            ethers.constants.AddressZero,
            {
              name: fundName,
              managementFee: managementFee,
              minimumInvestment: minimumInvestment,
              revenueWallet: revenueWallet.address,
              lpPoolWallet: lpPoolWallet.address,
              buybackAndBurnWallet: buybackAndBurnWallet.address,
              secondarySalesWallet: secondarySalesWallet.address
            },
            profitProvider.address,
            profitGenerator.address,
            profitDistributor.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
    });

    it('Should revenrt when revenue wallet address is zero address', async () => {
      const {
        deployer,
        owner,
        perpetualNFT,
        perpetualFund,
        usdc,
        staking,
        fundName,
        managementFee,
        minimumInvestment,
        secondarySalesWallet,
        buybackAndBurnWallet,
        lpPoolWallet,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        deployProxy(
          'PerpetualFund',
          [
            owner.address,
            perpetualNFT.address,
            usdc.address,
            staking.address,
            {
              name: fundName,
              managementFee: managementFee,
              minimumInvestment: minimumInvestment,
              revenueWallet: ethers.constants.AddressZero,
              lpPoolWallet: lpPoolWallet.address,
              buybackAndBurnWallet: buybackAndBurnWallet.address,
              secondarySalesWallet: secondarySalesWallet.address
            },
            profitProvider.address,
            profitGenerator.address,
            profitDistributor.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
    });

    it('Should revert when lp pool wallet address is zero address', async () => {
      const {
        deployer,
        owner,
        perpetualNFT,
        perpetualFund,
        usdc,
        staking,
        fundName,
        managementFee,
        secondarySalesWallet,
        buybackAndBurnWallet,
        revenueWallet,
        minimumInvestment,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        deployProxy(
          'PerpetualFund',
          [
            owner.address,
            perpetualNFT.address,
            usdc.address,
            staking.address,
            {
              name: fundName,
              managementFee: managementFee,
              minimumInvestment: minimumInvestment,
              revenueWallet: revenueWallet.address,
              lpPoolWallet: ethers.constants.AddressZero,
              buybackAndBurnWallet: buybackAndBurnWallet.address,
              secondarySalesWallet: secondarySalesWallet.address
            },
            profitProvider.address,
            profitGenerator.address,
            profitDistributor.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
    });

    it('Should revert when buyback and burn wallet address is zero address', async () => {
      const {
        deployer,
        owner,
        perpetualNFT,
        perpetualFund,
        usdc,
        staking,
        fundName,
        managementFee,
        secondarySalesWallet,
        lpPoolWallet,
        revenueWallet,
        minimumInvestment,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        deployProxy(
          'PerpetualFund',
          [
            owner.address,
            perpetualNFT.address,
            usdc.address,
            staking.address,
            {
              name: fundName,
              managementFee: managementFee,
              minimumInvestment: minimumInvestment,
              revenueWallet: revenueWallet.address,
              lpPoolWallet: lpPoolWallet.address,
              buybackAndBurnWallet: ethers.constants.AddressZero,
              secondarySalesWallet: secondarySalesWallet.address
            },
            profitProvider.address,
            profitGenerator.address,
            profitDistributor.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
    });

    it('Should revert when secondary sales wallet address is zero address', async () => {
      const {
        deployer,
        owner,
        perpetualNFT,
        perpetualFund,
        usdc,
        staking,
        fundName,
        managementFee,
        buybackAndBurnWallet,
        lpPoolWallet,
        revenueWallet,
        minimumInvestment,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        deployProxy(
          'PerpetualFund',
          [
            owner.address,
            perpetualNFT.address,
            usdc.address,
            staking.address,
            {
              name: fundName,
              managementFee: managementFee,
              minimumInvestment: minimumInvestment,
              revenueWallet: revenueWallet.address,
              lpPoolWallet: lpPoolWallet.address,
              buybackAndBurnWallet: buybackAndBurnWallet.address,
              secondarySalesWallet: ethers.constants.AddressZero
            },
            profitProvider.address,
            profitGenerator.address,
            profitDistributor.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
    });

    it('Should revert when managementFee is greater than 10000', async () => {
      const {
        deployer,
        owner,
        perpetualNFT,
        perpetualFund,
        minimumInvestment,
        staking,
        fundName,
        secondarySalesWallet,
        buybackAndBurnWallet,
        lpPoolWallet,
        revenueWallet,
        usdc,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        deployProxy(
          'PerpetualFund',
          [
            owner.address,
            perpetualNFT.address,
            usdc.address,
            staking.address,
            {
              name: fundName,
              managementFee: 10001,
              minimumInvestment: minimumInvestment,
              revenueWallet: revenueWallet.address,
              lpPoolWallet: lpPoolWallet.address,
              buybackAndBurnWallet: buybackAndBurnWallet.address,
              secondarySalesWallet: secondarySalesWallet.address
            },
            profitProvider.address,
            profitGenerator.address,
            profitDistributor.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__InvalidManagementFee');
    });

    it('Should revert when initialize again', async () => {
      const {
        owner,
        perpetualFund,
        usdc,
        perpetualNFT,
        staking,
        fundName,
        managementFee,
        minimumInvestment,
        secondarySalesWallet,
        buybackAndBurnWallet,
        lpPoolWallet,
        revenueWallet,
        profitProvider,
        profitGenerator,
        profitDistributor
      } = await loadFixture(deployPerpetualFund);

      await expect(
        perpetualFund.initialize(
          owner.address,
          usdc.address,
          perpetualNFT.address,
          staking.address,
          {
            name: fundName,
            managementFee: managementFee,
            minimumInvestment: minimumInvestment,
            revenueWallet: revenueWallet.address,
            lpPoolWallet: lpPoolWallet.address,
            buybackAndBurnWallet: buybackAndBurnWallet.address,
            secondarySalesWallet: secondarySalesWallet.address
          },
          profitProvider.address,
          profitGenerator.address,
          profitDistributor.address
        )
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  describe('Invest', () => {
    describe('Success', () => {
      it('Should invest', async () => {
        const { user1, perpetualFund, usdc, perpetualNFT, revenueWallet, profitGenerator, basisPoint } =
          await loadFixture(deployPerpetualFund);
        const amount = toUsdc('10000');
        const fee = amount.mul(1000).div(basisPoint);

        usdc.transferFrom.returns(true);

        await expect(perpetualFund.connect(user1).invest(amount))
          .to.emit(perpetualFund, 'Invested')
          .withArgs(user1.address, usdc.address, amount, fee);
        expect(perpetualNFT.mint).to.have.been.calledWith(user1.address, amount);
        expect(usdc.transferFrom).to.have.been.calledWith(user1.address, profitGenerator.address, amount.sub(fee));
        expect(usdc.transferFrom).to.have.been.calledWith(user1.address, revenueWallet.address, fee);
      });
    });
    describe('Reverts', () => {
      it('Should revert when amount is less than the minimum investment', async () => {
        const { user1, perpetualFund, minimumInvestment } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(user1).invest(minimumInvestment.sub(1))).to.be.revertedWithCustomError(
          perpetualFund,
          'PerpetualFund__InvestmentTooLow'
        );
      });
    });

    it('Should revert when the fund is already closed', async () => {
      const { owner, user1, perpetualFund } = await loadFixture(deployPerpetualFund);

      await perpetualFund.connect(owner).closeFund();

      await expect(perpetualFund.connect(user1).invest(toUsdc('100'))).to.be.revertedWithCustomError(
        perpetualFund,
        'StateMachine__NotAllowedInCurrentState'
      );
    });
  });

  describe('ProvideProfit', async () => {
    describe('Success', async () => {
      it('Should provide profit', async () => {
        const { perpetualFund, profitProvider, usdc, perpetualNFT } = await loadFixture(deployPerpetualFund);

        const amount = toUsdc('10000');
        usdc.transferFrom.returns(true);

        const blockNumberDuringOperation = (await time.latestBlock()) + 1;
        await expect(perpetualFund.connect(profitProvider.wallet).provideProfit(amount))
          .to.emit(perpetualFund, 'ProfitProvided')
          .withArgs(0, amount, blockNumberDuringOperation);
        expect(await perpetualFund.getProfitCounter()).to.be.equal(1);
        expect(await perpetualFund.totalIncome()).to.be.equal(amount);

        const profit = await perpetualFund.getProfit(0);
        expect(profit.id).to.be.equal(0);
        expect(profit.provided).to.be.equal(amount);
        expect(profit.distributed).to.be.equal(0);
        expect(profit.blockNumber).to.be.equal(blockNumberDuringOperation);

        expect(usdc.transferFrom).to.have.been.calledWith(profitProvider.address, perpetualFund.address, amount);
        expect(perpetualNFT.enableSplitting).to.have.been.calledWith(false);
      });
    });
    describe('Reverts', async () => {
      it('Should revert when called by a non profit provider', async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(owner).provideProfit(toUsdc('100'))).to.be.revertedWithCustomError(
          perpetualFund,
          'PerpetualFund__OperationNotAllowed'
        );
      });

      it('Should revert when amount is zero', async () => {
        const { profitProvider, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(profitProvider.wallet).provideProfit(0)).to.be.revertedWithCustomError(
          perpetualFund,
          'PerpetualFund__ZeroProfitProvided'
        );
      });
    });
  });

  describe('DistributeProfit', async () => {
    describe('Scuccess', async () => {
      it('Should distribute profit', async () => {
        const { perpetualFund, profitProvider, profitDistributor, user1, user2, usdc } = await loadFixture(
          deployPerpetualFund
        );

        const amount = toUsdc('4500');
        usdc.transferFrom.returns(true);

        const profits = [
          { wallet: user1.address, notSubjectedToCarryFee: toUsdc('1000'), subjectedToCarryFee: toUsdc('500') },
          { wallet: user2.address, notSubjectedToCarryFee: toUsdc('2000'), subjectedToCarryFee: toUsdc('1000') }
        ];

        await perpetualFund.connect(profitProvider.wallet).provideProfit(amount);
        await expect(perpetualFund.connect(profitDistributor).distributeProfit(0, profits))
          .to.emit(perpetualFund, 'ProfitDistributed')
          .withArgs(0, user1.address, profits[0].notSubjectedToCarryFee, profits[0].subjectedToCarryFee)
          .to.emit(perpetualFund, 'ProfitDistributed')
          .withArgs(0, user2.address, profits[1].notSubjectedToCarryFee, profits[1].subjectedToCarryFee);

        const user1Profits = await perpetualFund.getUserProfits(user1.address);
        expect(user1Profits.length).to.be.equal(1);

        expect(user1Profits[0].profitId).to.be.equal(0);
        expect(user1Profits[0].withdrawn).to.be.false;
        expect(user1Profits[0].nonSubjectedToCarryFee).to.be.equal(profits[0].notSubjectedToCarryFee);
        expect(user1Profits[0].subjectedToCarryFee).to.be.equal(profits[0].subjectedToCarryFee);
        const profit = await perpetualFund.getProfit(0);
        expect(profit.distributed).to.be.equal(amount);
      });
    });
    describe('Reverts', async () => {
      it("Should revert when called by a non profit distributor's address", async () => {
        const { perpetualFund, profitProvider, user1, user2, usdc } = await loadFixture(deployPerpetualFund);

        const profits = [
          { wallet: user1.address, notSubjectedToCarryFee: toUsdc('1000'), subjectedToCarryFee: toUsdc('500') },
          { wallet: user2.address, notSubjectedToCarryFee: toUsdc('2000'), subjectedToCarryFee: toUsdc('1000') }
        ];

        await expect(perpetualFund.connect(user1).distributeProfit(0, profits)).to.be.revertedWithCustomError(
          perpetualFund,
          'PerpetualFund__OperationNotAllowed'
        );
      });

      it("Should revert when profit id doesn't exist", async () => {
        const { perpetualFund, profitDistributor, user1, user2 } = await loadFixture(deployPerpetualFund);

        const profits = [
          { wallet: user1.address, notSubjectedToCarryFee: toUsdc('1000'), subjectedToCarryFee: toUsdc('500') },
          { wallet: user2.address, notSubjectedToCarryFee: toUsdc('2000'), subjectedToCarryFee: toUsdc('1000') }
        ];
        await expect(
          perpetualFund.connect(profitDistributor).distributeProfit(0, profits)
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__NotExistingProfit');
      });

      it("Should revert when distribution exceeds the profit's amount", async () => {
        const { perpetualFund, profitProvider, profitDistributor, user1, user2, usdc } = await loadFixture(
          deployPerpetualFund
        );

        const amount = toUsdc('4500');
        usdc.transferFrom.returns(true);

        const profits = [
          { wallet: user1.address, notSubjectedToCarryFee: toUsdc('1001'), subjectedToCarryFee: toUsdc('500') },
          { wallet: user2.address, notSubjectedToCarryFee: toUsdc('2000'), subjectedToCarryFee: toUsdc('1000') }
        ];
        await perpetualFund.connect(profitProvider.wallet).provideProfit(amount);

        await expect(
          perpetualFund.connect(profitDistributor).distributeProfit(0, profits)
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ProfitToAssingExceedProvidedProfit');
      });
    });
  });

  describe('Withdraw', async () => {
    describe('Success', async () => {
      it("Should withdraw funds without carry fee distribution when the user's profit is not subjected to carry fee", async () => {
        const { user1, perpetualFund, usdc, profitProvider, profitDistributor } = await loadFixture(
          deployPerpetualFund
        );

        const amount = toUsdc('1000');

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

        const profits = [{ wallet: user1.address, notSubjectedToCarryFee: amount, subjectedToCarryFee: toUsdc('0') }];

        await perpetualFund.connect(profitProvider.wallet).provideProfit(amount);
        await perpetualFund.connect(profitDistributor).distributeProfit(0, profits);

        await expect(perpetualFund.connect(user1).withdraw())
          .to.emit(perpetualFund, 'ProfitWithdrawn')
          .withArgs(user1.address, amount);
        expect(usdc.transfer).to.have.been.calledWith(user1.address, amount);
        expect(await perpetualFund.userTotalWithdrawal(user1.address)).to.be.equal(amount);
        expect(await perpetualFund.nextUserProfitId(user1.address)).to.be.equal(1);
        expect(await perpetualFund.totalWithdrawal()).to.be.equal(amount);
        const availableFundsDetails = await perpetualFund.getAvailableFundsDetails(user1.address);
        expect(availableFundsDetails.amount).to.be.equal(0);
        expect(availableFundsDetails.carryFee).to.be.equal(0);
        expect(availableFundsDetails.userProfitStartIndex).to.be.equal(1);
      });

      it("Should withdraw fund with carry fee distribution when the user's profit is subjected to carry fee", async () => {
        const {
          user1,
          perpetualFund,
          usdc,
          profitProvider,
          profitDistributor,
          revenueWallet,
          lpPoolWallet,
          buybackAndBurnWallet,
          secondarySalesWallet
        } = await loadFixture(deployPerpetualFund);

        const amount = toUsdc('1000');
        const fee = amount.mul(40).div(100);
        const amountAfterFee = amount.sub(fee);

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

        const profits = [{ wallet: user1.address, notSubjectedToCarryFee: 0, subjectedToCarryFee: amount }];

        await perpetualFund.connect(profitProvider.wallet).provideProfit(amount);
        await perpetualFund.connect(profitDistributor).distributeProfit(0, profits);

        await expect(perpetualFund.connect(user1).withdraw())
          .to.emit(perpetualFund, 'ProfitWithdrawn')
          .withArgs(user1.address, amountAfterFee);
        expect(usdc.transfer).to.have.been.calledWith(user1.address, amountAfterFee);
        expect(await perpetualFund.userTotalWithdrawal(user1.address)).to.be.equal(amountAfterFee);
        expect(await perpetualFund.nextUserProfitId(user1.address)).to.be.equal(1);
        expect(await perpetualFund.totalWithdrawal()).to.be.equal(amount);
        const availableFundsDetails = await perpetualFund.getAvailableFundsDetails(user1.address);
        expect(availableFundsDetails.amount).to.be.equal(0);
        expect(availableFundsDetails.carryFee).to.be.equal(0);
        expect(availableFundsDetails.userProfitStartIndex).to.be.equal(1);

        expect(usdc.transfer).to.have.been.calledWith(revenueWallet.address, fee.mul(80).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPoolWallet.address, fee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(buybackAndBurnWallet.address, fee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(secondarySalesWallet.address, fee.mul(2).div(1000));
      });

      it("Should withdraw fund with carry fee distribution when the user's profits are subjected and non subjected to carry fee and the user has withdrawn before", async () => {
        const {
          user1,
          perpetualFund,
          usdc,
          profitProvider,
          profitDistributor,
          revenueWallet,
          lpPoolWallet,
          buybackAndBurnWallet,
          secondarySalesWallet
        } = await loadFixture(deployPerpetualFund);

        const amount = toUsdc('1000');
        const subjectToCarryFee = amount.div(2);
        const notSubjectToCarryFee = amount.div(2);
        const fee = notSubjectToCarryFee.mul(40).div(100);
        const amountAfterFee = notSubjectToCarryFee.sub(fee).add(subjectToCarryFee);

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

        const profits = [
          {
            wallet: user1.address,
            notSubjectedToCarryFee: subjectToCarryFee,
            subjectedToCarryFee: notSubjectToCarryFee
          }
        ];

        await perpetualFund.connect(profitProvider.wallet).provideProfit(amount);
        await perpetualFund.connect(profitDistributor).distributeProfit(0, profits);

        await expect(perpetualFund.connect(user1).withdraw())
          .to.emit(perpetualFund, 'ProfitWithdrawn')
          .withArgs(user1.address, amountAfterFee);
        expect(usdc.transfer).to.have.been.calledWith(user1.address, amountAfterFee);
        expect(await perpetualFund.userTotalWithdrawal(user1.address)).to.be.equal(amountAfterFee);
        expect(await perpetualFund.nextUserProfitId(user1.address)).to.be.equal(1);
        expect(await perpetualFund.totalWithdrawal()).to.be.equal(amount);
        const availableFundsDetails = await perpetualFund.getAvailableFundsDetails(user1.address);
        expect(availableFundsDetails.amount).to.be.equal(0);
        expect(availableFundsDetails.carryFee).to.be.equal(0);
        expect(availableFundsDetails.userProfitStartIndex).to.be.equal(1);

        expect(usdc.transfer).to.have.been.calledWith(revenueWallet.address, fee.mul(80).div(100));
        expect(usdc.transfer).to.have.been.calledWith(lpPoolWallet.address, fee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(buybackAndBurnWallet.address, fee.mul(99).div(1000));
        expect(usdc.transfer).to.have.been.calledWith(secondarySalesWallet.address, fee.mul(2).div(1000));
      });
    });

    describe('Reverts', async () => {
      it('Should revert when no funds are available', async () => {
        const { user1, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(user1).withdraw()).to.be.revertedWithCustomError(
          perpetualFund,
          'PerpetualFund__NoFundsAvailable'
        );
      });
    });
  });

  describe('GetAvailableFundsDetails', async () => {
    it('Should return the available funds details', async () => {
      const { user1, perpetualFund, usdc, profitProvider, profitDistributor } = await loadFixture(deployPerpetualFund);

      const amount = toUsdc('1000');
      const subjectToCarryFee = amount.div(2);
      const notSubjectToCarryFee = amount.div(2);
      const fee = notSubjectToCarryFee.mul(40).div(100);
      const amountAfterFee = notSubjectToCarryFee.sub(fee).add(subjectToCarryFee);

      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);

      const profits = [
        {
          wallet: user1.address,
          notSubjectedToCarryFee: subjectToCarryFee,
          subjectedToCarryFee: notSubjectToCarryFee
        }
      ];

      await perpetualFund.connect(profitProvider.wallet).provideProfit(amount);
      await perpetualFund.connect(profitDistributor).distributeProfit(0, profits);

      const availableFunds = await perpetualFund.getAvailableFundsDetails(user1.address);

      expect(availableFunds.amount).to.be.equal(amountAfterFee);
      expect(availableFunds.carryFee).to.be.equal(fee);
      expect(availableFunds.userProfitStartIndex).to.be.equal(0);
    });
  });

  describe('CloseFund', async () => {
    describe('Success', async () => {
      it('Should close fund', async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(owner).closeFund()).to.emit(perpetualFund, 'FundClosed');
        expect(parseBytes32String(await perpetualFund.currentState())).to.equal(FundState.Closed);
      });
    });
    describe('Reverts', async () => {
      it('Should revert when called by a non owner', async () => {
        const { owner, user1, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(user1).closeFund()).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Should revert when the fund is already closed', async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        await perpetualFund.connect(owner).closeFund();

        await expect(perpetualFund.connect(owner).closeFund()).to.be.revertedWithCustomError(
          perpetualFund,
          'StateMachine__NotAllowedInCurrentState'
        );
      });
    });
  });

  describe('Set the minimum investment amount', () => {
    describe('Success', () => {
      it('Should set the minimum investment amount', async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        expect(await perpetualFund.connect(owner).setMinimumInvestment(50))
          .to.emit(perpetualFund, 'MinimumInvestmentSet')
          .withArgs(50);
        expect(await perpetualFund.minimumInvestment()).to.be.equal(50);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(user1).setMinimumInvestment(50)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Set the profit provider', () => {
    describe('Success', () => {
      it('Should set the profit provider', async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        const newProfitProvider = ethers.Wallet.createRandom();

        expect(await perpetualFund.connect(owner).setProfitProvider(newProfitProvider.address))
          .to.emit(perpetualFund, 'ProfitProviderSet')
          .withArgs(newProfitProvider.address);
        expect(await perpetualFund.profitProvider()).to.be.equal(newProfitProvider.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, perpetualFund } = await loadFixture(deployPerpetualFund);
        const newProfitProvider = ethers.Wallet.createRandom();

        await expect(perpetualFund.connect(user1).setProfitProvider(newProfitProvider.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the profit provider's address", async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(
          perpetualFund.connect(owner).setProfitProvider(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
      });
    });
  });

  describe('Set the buyback and burn address', () => {
    describe('Success', () => {
      it('Should set the buyback and burn address', async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        const newBuybackAndBurnAddress = ethers.Wallet.createRandom();

        expect(await perpetualFund.connect(owner).setBuybackAndBurnAddress(newBuybackAndBurnAddress.address))
          .to.emit(perpetualFund, 'BuybackAndBurnAddressSet')
          .withArgs(newBuybackAndBurnAddress.address);
        expect(await perpetualFund.buybackAndBurnWallet()).to.be.equal(newBuybackAndBurnAddress.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, perpetualFund } = await loadFixture(deployPerpetualFund);
        const newBuybackAndBurnAddress = ethers.Wallet.createRandom();

        await expect(
          perpetualFund.connect(user1).setBuybackAndBurnAddress(newBuybackAndBurnAddress.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it("Should revert when zero address is passed as the profit provider's address", async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(
          perpetualFund.connect(owner).setBuybackAndBurnAddress(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
      });
    });
  });

  describe('Set the staking wlth contract', () => {
    describe('Success', () => {
      it('Should set the staking contract', async () => {
        const { owner, perpetualFund, staking } = await loadFixture(deployPerpetualFund);

        expect(await perpetualFund.connect(owner).setStakingWlth(staking.address))
          .to.emit(perpetualFund, 'StakingWlthSet')
          .withArgs(staking.address);
        expect(await perpetualFund.stakingWlth()).to.be.equal(staking.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when not called by the owner', async () => {
        const { user1, perpetualFund, staking } = await loadFixture(deployPerpetualFund);

        await expect(perpetualFund.connect(user1).setStakingWlth(staking.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it("Should revert when zero address is passed as the staking contract's address", async () => {
        const { owner, perpetualFund } = await loadFixture(deployPerpetualFund);

        await expect(
          perpetualFund.connect(owner).setStakingWlth(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(perpetualFund, 'PerpetualFund__ZeroAddress');
      });
    });
  });
});
