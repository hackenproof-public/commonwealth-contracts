import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';
import { FundState, InvestmentFundDeploymentParameters } from '../types';
import { toUsdc, valueWithFee } from '../utils';

const MAX_UINT240: BigNumber = BigNumber.from(
  '1766847064778384329583297500742918515827483896875618958121606201292619775'
);

describe('Investment Fund unit tests', () => {
  const defaultManagementFee: number = 1000;
  const defaultInvestmentCap: BigNumber = toUsdc('1000000');

  let investmentFund: InvestmentFund;
  let usdc: FakeContract<USDC>;
  let investmentNft: FakeContract<InvestmentNFT>;
  let restorer: SnapshotRestorer;
  let deployer: SignerWithAddress;
  let wallet: SignerWithAddress;
  let treasuryWallet: SignerWithAddress;

  const deployInvestmentFund = async ({
    fundName = 'Investment Fund',
    treasuryAddress = undefined,
    managementFee = defaultManagementFee,
    cap = defaultInvestmentCap
  }: InvestmentFundDeploymentParameters = {}) => {
    const [deployer, treasuryWallet, wallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
    investmentNft.supportsInterface.returns(true);

    const investmentFundFactory = await ethers.getContractFactory('InvestmentFund');
    const investmentFund = await investmentFundFactory.deploy(
      fundName,
      usdc.address,
      investmentNft.address,
      treasuryAddress !== undefined ? treasuryAddress : treasuryWallet.address,
      managementFee,
      cap
    );

    return { investmentFund, usdc, investmentNft, deployer, treasuryWallet, wallet };
  };

  const deployFixture = async () => {
    return deployInvestmentFund();
  };

  const resetFakes = (usdc: FakeContract<USDC>, invNft: FakeContract<InvestmentNFT>) => {
    invNft.getInvestmentValue.reset();
    invNft.getPastInvestmentValue.reset();
    invNft.getTotalInvestmentValue.reset();
    invNft.getPastTotalInvestmentValue.reset();
    invNft.mint.reset();
    invNft.supportsInterface.reset();
    usdc.transfer.reset();
    usdc.transferFrom.reset();
  };

  const setup = async () => {
    const { investmentFund, usdc, investmentNft, deployer, treasuryWallet, wallet } = await loadFixture(deployFixture);

    resetFakes(usdc, investmentNft);

    usdc.transferFrom.returns(true);
    investmentNft.supportsInterface.returns(true);
    investmentNft.mint.returns(1);

    return { investmentFund, usdc, investmentNft, deployer, treasuryWallet, wallet };
  };

  describe('Deployment', () => {
    it(`Should return initial parameters`, async () => {
      const { investmentFund, usdc, investmentNft, treasuryWallet } = await setup();

      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
      expect(await investmentFund.treasuryWallet()).to.equal(treasuryWallet.address);
      expect(await investmentFund.managementFee()).to.equal(defaultManagementFee);
      expect(await investmentFund.cap()).to.equal(defaultInvestmentCap);
      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.Empty);
    });

    it(`Should revert deployment if invalid currency`, async () => {
      const [deployer, treasuryWallet] = await ethers.getSigners();

      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          constants.AddressZero,
          investmentNft.address,
          treasuryWallet.address,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid currency address');
    });

    it(`Should revert deployment if invalid NFT address`, async () => {
      const [deployer, treasuryWallet] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          constants.AddressZero,
          treasuryWallet.address,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid NFT address');
    });

    it(`Should revert deployment if invalid treasury wallet address`, async () => {
      const [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          constants.AddressZero,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid treasury wallet address');
    });

    it(`Should revert deployment if invalid management fee`, async () => {
      const [deployer, treasuryWallet] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          treasuryWallet.address,
          10000,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Invalid management fee');
    });

    it(`Should revert deployment if invalid investment cap`, async () => {
      const [deployer, treasuryWallet] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          treasuryWallet.address,
          defaultManagementFee,
          0
        ])
      ).to.be.revertedWith('Invalid investment cap');
    });

    it('Should revert deployment if NFT contract does not support proper interface', async () => {
      const [deployer, treasuryWallet] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      investmentNft.supportsInterface.returns(false);
      await expect(
        deploy('InvestmentFund', deployer, [
          'Investment Fund',
          usdc.address,
          investmentNft.address,
          treasuryWallet.address,
          defaultManagementFee,
          defaultInvestmentCap
        ])
      ).to.be.revertedWith('Required interface not supported');
    });
  });

  describe('#invest()', () => {
    [BigNumber.from(1), defaultInvestmentCap.sub(1)].forEach((amount: BigNumber) => {
      it(`Should invest if amount lower than cap [amount=${amount}]`, async () => {
        const { investmentFund, usdc, wallet } = await setup();
        await investmentFund.startCollectingFunds();

        const fee: BigNumber = amount.mul(defaultManagementFee).div(10000);
        await expect(investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount.sub(fee), fee);
      });
    });

    //[default investment cap, cap for which amount is a maximum possible value]
    [defaultInvestmentCap, MAX_UINT240.sub(MAX_UINT240.mul(defaultManagementFee).div(10000))].forEach((cap) => {
      it(`Should invest with cap reached if amount equal to cap [cap=${cap}]`, async () => {
        const { investmentFund, usdc, investmentNft, wallet } = await deployInvestmentFund({ cap });
        await investmentFund.startCollectingFunds();

        usdc.transferFrom.returns(true);
        investmentNft.mint.returns(1);

        const amount: BigNumber = cap.mul(10000).div(10000 - defaultManagementFee);
        const fee: BigNumber = amount.mul(defaultManagementFee).div(10000);

        await expect(investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount.sub(fee), fee)
          .to.emit(investmentFund, 'CapReached')
          .withArgs(cap);

        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.CapReached);
      });
    });

    it(`Should revert investing if amount greater than cap`, async () => {
      const { investmentFund, wallet } = await setup();
      await investmentFund.startCollectingFunds();

      const amount: BigNumber = defaultInvestmentCap
        .add(1)
        .mul(10000)
        .div(10000 - defaultManagementFee);
      const fee: BigNumber = amount.mul(defaultManagementFee).div(10000);

      await expect(investmentFund.connect(wallet).invest(amount)).to.be.revertedWith('Total invested funds exceed cap');
    });

    it(`Should revert investing if amount is 0`, async () => {
      const { investmentFund, wallet } = await setup();
      await investmentFund.startCollectingFunds();

      await expect(investmentFund.connect(wallet).invest(0)).to.be.revertedWith('Invalid amount invested');
    });

    it(`Should revert investing if currency fee transfer fails`, async () => {
      const { investmentFund, usdc, wallet } = await setup();
      await investmentFund.startCollectingFunds();

      usdc.transferFrom.returnsAtCall(0, false);
      usdc.transferFrom.returnsAtCall(1, true);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    it(`Should revert investing if currency transfer fails`, async () => {
      const { investmentFund, usdc, wallet } = await setup();
      await investmentFund.startCollectingFunds();

      usdc.transferFrom.returnsAtCall(0, true);
      usdc.transferFrom.returnsAtCall(1, false);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    [0, 1].forEach((call) => {
      it(`Should revert investing if currency transfer reverts`, async () => {
        const { investmentFund, usdc, wallet } = await setup();
        await investmentFund.startCollectingFunds();

        usdc.transferFrom.revertsAtCall(call);

        await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
      });
    });

    it(`Should revert investing if investment NFT mint reverts`, async () => {
      const { investmentFund, investmentNft, wallet } = await setup();
      await investmentFund.startCollectingFunds();

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
    });
  });

  describe('#withdraw()', () => {
    const investmentValue: BigNumber = toUsdc('100');
    const investmentValueWithFee: BigNumber = valueWithFee(investmentValue, defaultManagementFee);
    const defaultProfit: BigNumber = BigNumber.from(10);

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet } = await setup());
      await investmentFund.startCollectingFunds();
      await investmentFund.invest(investmentValueWithFee);
      expect(await investmentFund.totalInvestment()).to.equal(investmentValue);

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();
      await investmentFund.activateFund();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft);

      investmentNft.getInvestmentValue.returns(investmentValue);
      investmentNft.getPastInvestmentValue.returns(investmentValue);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      investmentNft.getPastTotalInvestmentValue.returns(investmentValue);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
    });

    describe('if no profit provided', () => {
      it('Should revert withdrawing if no profit provided', async () => {
        await expect(investmentFund.connect(wallet).withdraw(1)).to.be.revertedWith('Payout does not exist');
      });
    });

    describe('if profit provided', () => {
      before(async () => {
        usdc.transferFrom.returns(true);
        await investmentFund.provideProfit(defaultProfit);

        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      [1, defaultProfit].forEach((value) => {
        it(`Should withdraw profit [value=${value}]`, async () => {
          await expect(investmentFund.connect(wallet).withdraw(value))
            .to.emit(investmentFund, 'ProfitWithdrawn')
            .withArgs(wallet.address, usdc.address, value);
        });
      });

      it('Should revert withdrawal if amount is zero', async () => {
        await expect(investmentFund.connect(wallet).withdraw(0)).to.be.revertedWith('Attempt to withdraw zero tokens');
      });

      it('Should revert withdrawal if amount exceeds profit', async () => {
        await expect(investmentFund.connect(wallet).withdraw(defaultProfit.add(1))).to.be.revertedWith(
          'Withdrawal amount exceeds available funds'
        );
      });

      it('Should revert withdrawal if currency transfer fails', async () => {
        usdc.transfer.returns(false);

        await expect(investmentFund.connect(wallet).withdraw(defaultProfit)).to.be.revertedWith(
          'Currency transfer failed'
        );
      });
    });
  });

  describe('#getWithdrawalDetails()', () => {
    const investmentValue = toUsdc('10');
    const investmentValueWithFee = valueWithFee(investmentValue, defaultManagementFee);
    const defaultProfit = toUsdc('20');

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet } = await setup());
      await investmentFund.startCollectingFunds();
      await investmentFund.invest(investmentValueWithFee);
      expect(await investmentFund.totalInvestment()).to.equal(investmentValue);

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();
      await investmentFund.activateFund();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft);

      investmentNft.getInvestmentValue.returns(investmentValue);
      investmentNft.getPastInvestmentValue.returns(investmentValue);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      investmentNft.getPastTotalInvestmentValue.returns(investmentValue);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
    });

    describe('if no profit provided', () => {
      it('Should revert retrieving profit and fee if no profit provided', async () => {
        await expect(investmentFund.getWithdrawalCarryFee(wallet.address, 1)).to.be.revertedWith(
          'Payout does not exist'
        );
      });
    });

    describe('if profit provided', () => {
      before(async () => {
        usdc.transferFrom.returns(true);
        await investmentFund.provideProfit(defaultProfit);

        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should retrieve profit and fee for payouts before breakeven', async () => {
        expect(await investmentFund.getWithdrawalCarryFee(wallet.address, investmentValue)).to.equal(0);
      });

      [
        { amount: investmentValue.add(1), profit: investmentValue.add(1), fee: 0 },
        { amount: toUsdc('20'), profit: toUsdc('15'), fee: toUsdc('5') }
      ].forEach(async (data) => {
        it('Should retrieve profit and fee for payouts after breakeven', async () => {
          expect(await investmentFund.getWithdrawalCarryFee(wallet.address, data.amount)).to.deep.equal(data.fee);
        });
      });

      it('Should revert retrieving carry fee if no investment is done', async () => {
        investmentNft.getInvestmentValue.returns(0);
        investmentNft.getPastInvestmentValue.returns(0);
        investmentNft.getTotalInvestmentValue.returns(0);
        investmentNft.getPastTotalInvestmentValue.returns(0);

        await expect(investmentFund.getWithdrawalCarryFee(wallet.address, 1)).to.be.revertedWith(
          'Withdrawal amount exceeds available funds'
        );
      });
    });
  });

  describe('#provideProfit()', () => {
    const investmentValue: BigNumber = toUsdc('100');
    const investmentValueWithFee: BigNumber = valueWithFee(investmentValue, defaultManagementFee);

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet, treasuryWallet } = await setup());

      await investmentFund.startCollectingFunds();
      await investmentFund.connect(deployer).invest(investmentValueWithFee);
      expect(await investmentFund.totalInvestment()).to.equal(investmentValue);

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();
      await investmentFund.activateFund();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft);
      usdc.transferFrom.returns(true);
    });

    [1, investmentValue.sub(1)].forEach((value) => {
      it(`Should provide profit lower than breakeven [value=${value}]`, async () => {
        investmentNft.getInvestmentValue.returns(investmentValue);
        investmentNft.getPastInvestmentValue.returns(investmentValue);
        investmentNft.getTotalInvestmentValue.returns(investmentValue);
        investmentNft.getPastTotalInvestmentValue.returns(investmentValue);

        await expect(investmentFund.provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value, await ethers.provider.getBlockNumber());

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(1);
        expect(await investmentFund.getAvailableFunds(deployer.address)).to.equal(value);

        const payout = await investmentFund.payouts(0);
        expect(payout.value).to.equal(value);
        expect(payout.blockNumber).to.equal(await ethers.provider.getBlockNumber());
        expect(payout.inProfit).to.equal(false);
      });
    });

    it('Should provide profit equal to breakeven', async () => {
      await expect(investmentFund.provideProfit(investmentValue))
        .to.emit(investmentFund, 'ProfitProvided')
        .withArgs(investmentFund.address, investmentValue, await ethers.provider.getBlockNumber())
        .to.emit(investmentFund, 'BreakevenReached')
        .withArgs(investmentValue);

      expect(await investmentFund.totalIncome()).to.equal(investmentValue);
      expect(await investmentFund.getPayoutsCount()).to.equal(1);

      const payout = await investmentFund.payouts(0);
      expect(payout.value).to.equal(investmentValue);
      expect(payout.blockNumber).to.equal(await ethers.provider.getBlockNumber());
      expect(payout.inProfit).to.equal(false);
    });

    [investmentValue.add(1), constants.MaxUint256].forEach((value) => {
      it(`Should provide profit higher than breakeven [value=${value}]`, async () => {
        await expect(investmentFund.provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value, await ethers.provider.getBlockNumber())
          .to.emit(investmentFund, 'BreakevenReached')
          .withArgs(investmentValue);

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(2);

        const payout0 = await investmentFund.payouts(0);
        expect(payout0.value).to.equal(investmentValue);
        expect(payout0.blockNumber).to.equal(await ethers.provider.getBlockNumber());
        expect(payout0.inProfit).to.equal(false);

        const payout1 = await investmentFund.payouts(1);
        expect(payout1.value).to.equal(value.sub(investmentValue));
        expect(payout1.blockNumber).to.equal(await ethers.provider.getBlockNumber());
        expect(payout1.inProfit).to.equal(true);
      });
    });

    it('Should revert providing zero profit', async () => {
      await expect(investmentFund.provideProfit(0)).to.revertedWith('Zero profit provided');
    });

    it('Should revert providing profit if transfer fails', async () => {
      usdc.transferFrom.returns(false);
      await expect(investmentFund.provideProfit(1)).to.revertedWith('Currency transfer failed');
    });
  });

  describe('State machine', () => {
    describe(`Empty`, () => {
      before(async () => {
        ({ investmentFund, investmentNft } = await setup());
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it(`Should not revert adding project`, async () => {
        await expect(investmentFund.addProject()).not.to.be.reverted;
      });

      it(`Should not revert starting funds collection`, async () => {
        await expect(investmentFund.startCollectingFunds()).not.to.be.reverted;
      });

      it(`Should revert investing`, async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert withdrawing`, async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert stopping funds collection`, async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert funds deployment`, async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert activating fund`, async () => {
        await expect(investmentFund.activateFund()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert providing profits`, async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe(`FundsIn`, () => {
      before(async () => {
        ({ investmentFund } = await setup());
        await investmentFund.startCollectingFunds();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it(`Should revert adding project`, async () => {
        await expect(investmentFund.addProject()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert starting funds collection`, async () => {
        await expect(investmentFund.startCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should not revert investing`, async () => {
        await expect(investmentFund.invest(1)).not.to.be.reverted;
      });

      it(`Should revert withdrawing`, async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should not revert stopping funds collection`, async () => {
        await expect(investmentFund.stopCollectingFunds()).not.to.be.reverted;
      });

      it(`Should revert funds deployment`, async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert activating fund`, async () => {
        await expect(investmentFund.activateFund()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert providing profits`, async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe(`CapReached`, () => {
      before(async () => {
        ({ investmentFund } = await setup());
        await investmentFund.startCollectingFunds();
        await investmentFund.stopCollectingFunds();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it(`Should revert adding project`, async () => {
        await expect(investmentFund.addProject()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert starting funds collection`, async () => {
        await expect(investmentFund.startCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert investing`, async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert withdrawing`, async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert stopping funds collection`, async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should not revert funds deployment`, async () => {
        await expect(investmentFund.deployFunds()).not.to.be.reverted;
      });

      it(`Should revert activating fund`, async () => {
        await expect(investmentFund.activateFund()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert providing profits`, async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe(`FundsDeployed`, () => {
      before(async () => {
        ({ investmentFund } = await setup());
        await investmentFund.startCollectingFunds();
        await investmentFund.stopCollectingFunds();
        await investmentFund.deployFunds();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it(`Should revert adding project`, async () => {
        await expect(investmentFund.addProject()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert starting funds collection`, async () => {
        await expect(investmentFund.startCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert investing`, async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert withdrawing`, async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert stopping funds collection`, async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert funds deployment`, async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should not revert activating fund`, async () => {
        await expect(investmentFund.activateFund()).not.to.be.reverted;
      });

      it(`Should revert providing profits`, async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe(`Active`, () => {
      const investmentValue: BigNumber = toUsdc('100');
      const profit: BigNumber = toUsdc('1');

      before(async () => {
        ({ investmentFund, usdc, investmentNft } = await setup());
        await investmentFund.startCollectingFunds();
        await investmentFund.invest(investmentValue);
        await investmentFund.stopCollectingFunds();
        await investmentFund.deployFunds();
        await investmentFund.activateFund();

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

        await investmentFund.provideProfit(profit);

        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();

        resetFakes(usdc, investmentNft);

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);
        investmentNft.getInvestmentValue.returns(investmentValue);
        investmentNft.getPastInvestmentValue.returns(investmentValue);
        investmentNft.getTotalInvestmentValue.returns(investmentValue);
        investmentNft.getPastTotalInvestmentValue.returns(investmentValue);
      });

      it(`Should revert adding project`, async () => {
        await expect(investmentFund.addProject()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert starting funds collection`, async () => {
        await expect(investmentFund.startCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert investing`, async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should not revert withdrawing`, async () => {
        await expect(investmentFund.withdraw(profit)).not.to.be.reverted;
      });

      it(`Should revert stopping funds collection`, async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert funds deployment`, async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert activating fund`, async () => {
        await expect(investmentFund.activateFund()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should not revert providing profits`, async () => {
        await expect(investmentFund.provideProfit(1)).not.to.be.reverted;
      });

      it(`Should not revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).not.to.be.reverted;
      });
    });

    describe(`Closed`, () => {
      before(async () => {
        ({ investmentFund } = await setup());
        await investmentFund.startCollectingFunds();
        await investmentFund.stopCollectingFunds();
        await investmentFund.deployFunds();
        await investmentFund.activateFund();
        await investmentFund.closeFund();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it(`Should revert adding project`, async () => {
        await expect(investmentFund.addProject()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert starting funds collection`, async () => {
        await expect(investmentFund.startCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert investing`, async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert withdrawing`, async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert stopping funds collection`, async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert funds deployment`, async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert activating fund`, async () => {
        await expect(investmentFund.activateFund()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert providing profits`, async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });
});
