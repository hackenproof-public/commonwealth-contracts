import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { formatBytes32String, parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { IInvestmentFund__factory, InvestmentFund, InvestmentNFT, Project, USDC } from '../../typechain-types';
import { FundState, InvestmentFundDeploymentParameters } from '../types';
import { getInterfaceId, toUsdc } from '../utils';

const MAX_UINT240 = BigNumber.from('1766847064778384329583297500742918515827483896875618958121606201292619775');

describe('Investment Fund unit tests', () => {
  const defaultManagementFee = 1000;
  const defaultInvestmentCap = toUsdc('1000000');
  const IInvestmentFundId = ethers.utils.arrayify(getInterfaceId(IInvestmentFund__factory.createInterface()));

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
    invNft.getUserParticipation.reset();
    invNft.getUserParticipationInBlock.reset();
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
    it('Should return initial parameters', async () => {
      const { investmentFund, usdc, investmentNft, treasuryWallet } = await setup();

      expect(await investmentFund.supportsInterface(IInvestmentFundId)).to.equal(true);
      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
      expect(await investmentFund.treasuryWallet()).to.equal(treasuryWallet.address);
      expect(await investmentFund.managementFee()).to.equal(defaultManagementFee);
      expect(await investmentFund.cap()).to.equal(defaultInvestmentCap);
      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsIn);

      expect(await investmentFund.getDetails()).to.deep.equal([
        'Investment Fund',
        usdc.address,
        investmentNft.address,
        treasuryWallet.address,
        defaultManagementFee,
        defaultInvestmentCap,
        BigNumber.from(0),
        BigNumber.from(0),
        [],
        formatBytes32String(FundState.FundsIn)
      ]);
    });

    it('Should revert deployment if invalid currency', async () => {
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

    it('Should revert deployment if invalid NFT address', async () => {
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

    it('Should revert deployment if invalid treasury wallet address', async () => {
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

    it('Should revert deployment if invalid management fee', async () => {
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

    it('Should revert deployment if invalid investment cap', async () => {
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

        const fee = amount.mul(defaultManagementFee).div(10000);
        await expect(investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount, fee);

        expect(await investmentFund.totalInvestment()).to.equal(amount);
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

        await expect(investmentFund.connect(wallet).invest(amount))
          .to.emit(investmentFund, 'Invested')
          .withArgs(wallet.address, usdc.address, amount, fee)
          .to.emit(investmentFund, 'CapReached')
          .withArgs(cap);

        expect(await investmentFund.totalInvestment()).to.equal(amount);
        expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.CapReached);
      });
    });

    it('Should revert investing if amount greater than cap', async () => {
      const { investmentFund, wallet } = await setup();

      const amount = defaultInvestmentCap.add(1);
      const fee = amount.mul(defaultManagementFee).div(10000);

      await expect(investmentFund.connect(wallet).invest(amount)).to.be.revertedWith('Total invested funds exceed cap');
    });

    it('Should revert investing if amount is 0', async () => {
      const { investmentFund, wallet } = await setup();

      await expect(investmentFund.connect(wallet).invest(0)).to.be.revertedWith('Invalid amount invested');
    });

    it('Should revert investing if currency fee transfer fails', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      usdc.transferFrom.returnsAtCall(0, false);
      usdc.transferFrom.returnsAtCall(1, true);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    it('Should revert investing if currency transfer fails', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      usdc.transferFrom.returnsAtCall(0, true);
      usdc.transferFrom.returnsAtCall(1, false);

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency transfer failed');
    });

    [0, 1].forEach((call) => {
      it('Should revert investing if currency transfer reverts', async () => {
        const { investmentFund, usdc, wallet } = await setup();

        usdc.transferFrom.revertsAtCall(call);

        await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
      });
    });

    it('Should revert investing if investment NFT mint reverts', async () => {
      const { investmentFund, investmentNft, wallet } = await setup();

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1)).to.be.reverted;
    });
  });

  describe('#withdraw()', () => {
    const investmentValue = toUsdc('100');
    const defaultProfit = BigNumber.from(10);

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet } = await setup());
      await investmentFund.invest(investmentValue);
      expect(await investmentFund.totalInvestment()).to.equal(investmentValue);

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft);

      investmentNft.getUserParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getUserParticipationInBlock.returns([investmentValue, investmentValue]);
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

  describe('#getWithdrawalCarryFee()', () => {
    const investmentValue = toUsdc('10');
    const defaultProfit = toUsdc('20');

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet } = await setup());
      await investmentFund.invest(investmentValue);
      expect(await investmentFund.totalInvestment()).to.equal(investmentValue);

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft);

      investmentNft.getUserParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getUserParticipationInBlock.returns([investmentValue, investmentValue]);
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
        investmentNft.getUserParticipation.returns([0, 0]);
        investmentNft.getUserParticipationInBlock.returns([0, 0]);

        await expect(investmentFund.getWithdrawalCarryFee(wallet.address, 1)).to.be.revertedWith(
          'Withdrawal amount exceeds available funds'
        );
      });
    });
  });

  describe('#addProject()', () => {
    it('Should add project to fund', async () => {
      ({ investmentFund } = await setup());

      expect(await investmentFund.getProjectsCount()).to.equal(0);
      expect(await investmentFund.listProjects()).to.deep.equal([]);

      const project: FakeContract<Project> = await smock.fake('Project');
      await expect(investmentFund.addProject(project.address))
        .to.emit(investmentFund, 'ProjectAdded')
        .withArgs(deployer.address, project.address);

      expect(await investmentFund.getProjectsCount()).to.equal(1);
      expect(await investmentFund.listProjects()).to.deep.equal([project.address]);
    });

    it('Should revert adding project to fund if project is zero address', async () => {
      ({ investmentFund } = await setup());

      await expect(investmentFund.addProject(ethers.constants.AddressZero)).to.be.revertedWith(
        'Project is zero address'
      );
    });

    it('Should revert adding project to fund if already exists', async () => {
      ({ investmentFund } = await setup());

      const project: FakeContract<Project> = await smock.fake('Project');
      await investmentFund.addProject(project.address);

      await expect(investmentFund.addProject(project.address)).to.be.revertedWith('Project already exists');
    });
  });

  describe('#removeProject()', () => {
    it('Should remove project from fund', async () => {
      ({ investmentFund } = await setup());

      const project: FakeContract<Project> = await smock.fake('Project');
      await investmentFund.addProject(project.address);
      expect(await investmentFund.getProjectsCount()).to.equal(1);

      await expect(investmentFund.removeProject(project.address))
        .to.emit(investmentFund, 'ProjectRemoved')
        .withArgs(deployer.address, project.address);

      expect(await investmentFund.getProjectsCount()).to.equal(0);
    });

    it('Should revert removing project from fund if it does not exist', async () => {
      ({ investmentFund } = await setup());

      await expect(investmentFund.removeProject(ethers.constants.AddressZero)).to.be.revertedWith(
        'Project does not exist'
      );

      const project: FakeContract<Project> = await smock.fake('Project');
      await expect(investmentFund.removeProject(project.address)).to.be.revertedWith('Project does not exist');
    });
  });

  describe('#provideProfit()', () => {
    const investmentValue = toUsdc('100');

    before(async () => {
      ({ investmentFund, usdc, investmentNft, deployer, wallet, treasuryWallet } = await setup());

      await investmentFund.connect(deployer).invest(investmentValue);
      expect(await investmentFund.totalInvestment()).to.equal(investmentValue);

      await investmentFund.stopCollectingFunds();
      await investmentFund.deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft);
      usdc.transferFrom.returns(true);
      investmentNft.getUserParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getUserParticipationInBlock.returns([investmentValue, investmentValue]);
      investmentNft.getWallets.returns([deployer.address]);
    });

    [1, investmentValue.sub(1)].forEach((value) => {
      it(`Should provide profit lower than breakeven [value=${value}]`, async () => {
        await expect(investmentFund.provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value, 0, await ethers.provider.getBlockNumber());

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(1);
        expect(await investmentFund.getAvailableFunds(deployer.address)).to.equal(value);

        expect(await investmentFund.payouts(0)).to.deep.equal([
          value,
          0,
          await ethers.provider.getBlockNumber(),
          false
        ]);
      });
    });

    it('Should provide profit equal to breakeven', async () => {
      await expect(investmentFund.provideProfit(investmentValue))
        .to.emit(investmentFund, 'ProfitProvided')
        .withArgs(investmentFund.address, investmentValue, 0, await ethers.provider.getBlockNumber())
        .to.emit(investmentFund, 'BreakevenReached')
        .withArgs(investmentValue);

      expect(await investmentFund.totalIncome()).to.equal(investmentValue);
      expect(await investmentFund.getPayoutsCount()).to.equal(1);

      const blockNumber = await ethers.provider.getBlockNumber();
      expect(await investmentFund.payouts(0)).to.deep.equal([investmentValue, 0, blockNumber, false]);
    });

    // [investmentValue.add(1), constants.MaxUint256].forEach((value) => {
    [investmentValue.add(1)].forEach((value) => {
      it(`Should provide profit higher than breakeven [value=${value}]`, async () => {
        const fee = value.sub(investmentValue).div(2);
        await expect(investmentFund.provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value.sub(fee), fee, await ethers.provider.getBlockNumber())
          .to.emit(investmentFund, 'BreakevenReached')
          .withArgs(investmentValue);

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(2);

        const blockNumber = await ethers.provider.getBlockNumber();
        expect(await investmentFund.payouts(0)).to.deep.equal([investmentValue, 0, blockNumber, false]);
        expect(await investmentFund.payouts(1)).to.deep.equal([
          value.sub(investmentValue).sub(fee),
          fee,
          blockNumber,
          true
        ]);
      });
    });

    it('Should provide multiple profits', async () => {
      const profit1 = investmentValue;
      const profit2 = toUsdc('30');

      await investmentFund.provideProfit(profit1);
      await investmentFund.provideProfit(profit2);

      expect(await investmentFund.totalIncome()).to.equal(profit1.add(profit2));
      expect(await investmentFund.getPayoutsCount()).to.equal(2);

      expect((await investmentFund.payouts(0)).value).to.equal(profit1);
      expect((await investmentFund.payouts(0)).fee).to.equal(0);
      expect((await investmentFund.payouts(1)).value).to.equal(profit2);
      expect((await investmentFund.payouts(1)).fee).to.equal(toUsdc('15'));
    });

    it('Should revert providing zero profit', async () => {
      await expect(investmentFund.provideProfit(0)).to.revertedWith('Zero profit provided');
    });

    it('Should revert providing profit if transfer fails', async () => {
      usdc.transferFrom.returns(false);
      await expect(investmentFund.provideProfit(1)).to.revertedWith('Currency transfer failed');
    });
  });

  describe('State machine', async () => {
    describe('FundsIn', () => {
      before(async () => {
        ({ investmentFund } = await setup());
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should not revert adding project', async () => {
        const project: FakeContract<Project> = await smock.fake('Project');
        project.supportsInterface.returns(true);
        await expect(investmentFund.addProject(project.address)).not.to.be.reverted;
      });

      it('Should not revert removing project', async () => {
        const project: FakeContract<Project> = await smock.fake('Project');
        project.supportsInterface.returns(true);

        await investmentFund.addProject(project.address);
        await expect(investmentFund.removeProject(project.address)).not.to.be.reverted;
      });

      it('Should not revert investing', async () => {
        await expect(investmentFund.invest(1)).not.to.be.reverted;
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert stopping funds collection', async () => {
        await expect(investmentFund.stopCollectingFunds()).not.to.be.reverted;
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe('CapReached', () => {
      let project: FakeContract<Project>;

      before(async () => {
        ({ investmentFund } = await setup());
        project = await smock.fake('Project');
        project.supportsInterface.returns(true);

        await investmentFund.addProject(project.address);
        await investmentFund.stopCollectingFunds();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should revert adding project', async () => {
        const project: FakeContract<Project> = await smock.fake('Project');
        project.supportsInterface.returns(true);
        await expect(investmentFund.addProject(project.address)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.removeProject(project.address)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert funds deployment', async () => {
        await expect(investmentFund.deployFunds()).not.to.be.reverted;
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe('FundsDeployed', () => {
      const investmentValue = toUsdc('100');
      const profit = toUsdc('1');
      let project: FakeContract<Project>;

      before(async () => {
        ({ investmentFund, usdc, investmentNft } = await setup());
        project = await smock.fake('Project');
        project.supportsInterface.returns(true);

        await investmentFund.addProject(project.address);
        await investmentFund.invest(investmentValue);
        await investmentFund.stopCollectingFunds();
        await investmentFund.deployFunds();

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
        investmentNft.getUserParticipation.returns([investmentValue, investmentValue]);
        investmentNft.getUserParticipationInBlock.returns([investmentValue, investmentValue]);
      });

      it('Should revert adding project', async () => {
        const project: FakeContract<Project> = await smock.fake('Project');
        project.supportsInterface.returns(true);
        await expect(investmentFund.addProject(project.address)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.removeProject(project.address)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert withdrawing', async () => {
        await expect(investmentFund.withdraw(profit)).not.to.be.reverted;
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert providing profits', async () => {
        await expect(investmentFund.provideProfit(1)).not.to.be.reverted;
      });

      it('Should not revert closing fund', async () => {
        await expect(investmentFund.closeFund()).not.to.be.reverted;
      });
    });

    describe('Closed', () => {
      let project: FakeContract<Project>;

      before(async () => {
        ({ investmentFund } = await setup());
        project = await smock.fake('Project');
        project.supportsInterface.returns(true);

        await investmentFund.addProject(project.address);
        await investmentFund.stopCollectingFunds();
        await investmentFund.deployFunds();
        await investmentFund.closeFund();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should revert adding project', async () => {
        const project: FakeContract<Project> = await smock.fake('Project');
        project.supportsInterface.returns(true);
        await expect(investmentFund.addProject(project.address)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.removeProject(project.address)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.stopCollectingFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.provideProfit(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });
});
