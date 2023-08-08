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

  const deployInvestmentFund = async ({
    fundName = 'Investment Fund',
    treasuryWallet = defaultTreasury,
    managementFee = defaultManagementFee,
    cap = defaultInvestmentCap
  }: InvestmentFundDeploymentParameters = {}) => {
    const [deployer, owner, wallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
    const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
    const project: FakeContract<Project> = await smock.fake('Project');

    await owner.sendTransaction({
      to: project.address,
      value: ethers.utils.parseEther('1000')
    });

    investmentNft.supportsInterface.returns(true);

    const investmentFund: InvestmentFund = await deployProxy(
      'InvestmentFund',
      [
        owner.address,
        fundName,
        usdc.address,
        investmentNft.address,
        staking.address,
        treasuryWallet,
        managementFee,
        cap
      ],
      deployer
    );

    return { investmentFund, usdc, investmentNft, staking, deployer, treasuryWallet, wallet, owner, project };
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
    staking.getDiscountInTimestamp.reset();
  };

  const setup = async () => {
    const { investmentFund, usdc, investmentNft, staking, deployer, treasuryWallet, wallet, owner, project } =
      await loadFixture(deployFixture);

    resetFakes(usdc, investmentNft, staking);

    usdc.transferFrom.returns(true);
    investmentNft.supportsInterface.returns(true);
    investmentNft.mint.returns(1);

    return { investmentFund, usdc, investmentNft, staking, deployer, treasuryWallet, wallet, owner, project };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { investmentFund, usdc, investmentNft } = await setup();

      expect(await investmentFund.supportsInterface(IInvestmentFundId)).to.equal(true);
      expect(await investmentFund.name()).to.equal('Investment Fund');
      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);
      expect(await investmentFund.currency()).to.equal(usdc.address);
      expect(await investmentFund.treasuryWallet()).to.equal(defaultTreasury);
      expect(await investmentFund.managementFee()).to.equal(defaultManagementFee);
      expect(await investmentFund.cap()).to.equal(defaultInvestmentCap);
      expect(parseBytes32String(await investmentFund.currentState())).to.equal(FundState.FundsIn);

      expect(await investmentFund.getDetails()).to.deep.equal([
        'Investment Fund',
        usdc.address,
        investmentNft.address,
        defaultTreasury,
        defaultManagementFee,
        defaultInvestmentCap,
        BigNumber.from(0),
        BigNumber.from(0),
        [],
        formatBytes32String(FundState.FundsIn)
      ]);
    });

    it('Should revert deployment if invalid owner', async () => {
      const [deployer] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      const project: FakeContract<Project> = await smock.fake('Project');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            constants.AddressZero,
            'Investment Fund',
            usdc.address,
            investmentNft.address,
            staking.address,
            defaultTreasury,
            defaultManagementFee,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Owner is zero address');
    });

    it('Should revert deployment if invalid currency', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            constants.AddressZero,
            investmentNft.address,
            staking.address,
            defaultTreasury,
            defaultManagementFee,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Invalid currency address');
    });

    it('Should revert deployment if invalid NFT address', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            usdc.address,
            constants.AddressZero,
            staking.address,
            defaultTreasury,
            defaultManagementFee,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Invalid NFT address');
    });

    it('Should revert deployment if invalid staking address', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            usdc.address,
            investmentNft.address,
            constants.AddressZero,
            defaultTreasury,
            defaultManagementFee,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Invalid staking contract address');
    });

    it('Should revert deployment if invalid treasury wallet address', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            usdc.address,
            investmentNft.address,
            staking.address,
            constants.AddressZero,
            defaultManagementFee,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Invalid treasury wallet address');
    });

    it('Should revert deployment if invalid management fee', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            usdc.address,
            investmentNft.address,
            staking.address,
            defaultTreasury,
            10000,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Invalid management fee');
    });

    it('Should revert deployment if invalid investment cap', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            usdc.address,
            investmentNft.address,
            staking.address,
            defaultTreasury,
            defaultManagementFee,
            0
          ],
          deployer
        )
      ).to.be.revertedWith('Invalid investment cap');
    });

    it('Should revert deployment if NFT contract does not support proper interface', async () => {
      const [deployer, owner] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');
      const staking: FakeContract<StakingWlth> = await smock.fake('StakingWlth');
      investmentNft.supportsInterface.returns(false);
      await expect(
        deployProxy(
          'InvestmentFund',
          [
            owner.address,
            'Investment Fund',
            usdc.address,
            investmentNft.address,
            staking.address,
            defaultTreasury,
            defaultManagementFee,
            defaultInvestmentCap
          ],
          deployer
        )
      ).to.be.revertedWith('Required interface not supported');
    });
  });

  describe('#invest()', () => {
    [BigNumber.from(1), defaultInvestmentCap.sub(1)].forEach((amount: BigNumber) => {
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

      await expect(investmentFund.connect(wallet).invest(amount, tokenUri)).to.be.revertedWith(
        'Total invested funds exceed cap'
      );
    });

    it('Should revert investing if amount is 0', async () => {
      const { investmentFund, wallet } = await setup();

      await expect(investmentFund.connect(wallet).invest(0, tokenUri)).to.be.revertedWith('Invalid amount invested');
    });

    it('Should revert investing if currency fee transfer fails', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      usdc.transferFrom.returnsAtCall(0, false);
      usdc.transferFrom.returnsAtCall(1, true);

      await expect(investmentFund.connect(wallet).invest(1, tokenUri)).to.be.revertedWith('Currency transfer failed');
    });

    it('Should revert investing if currency transfer fails', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      usdc.transferFrom.returnsAtCall(0, true);
      usdc.transferFrom.returnsAtCall(1, false);

      await expect(investmentFund.connect(wallet).invest(1, tokenUri)).to.be.revertedWith('Currency transfer failed');
    });

    [0, 1].forEach((call) => {
      it('Should revert investing if currency transfer reverts', async () => {
        const { investmentFund, usdc, wallet } = await setup();

        usdc.transferFrom.revertsAtCall(call);

        await expect(investmentFund.connect(wallet).invest(1, tokenUri)).to.be.reverted;
      });
    });

    it('Should revert investing if investment NFT mint reverts', async () => {
      const { investmentFund, investmentNft, wallet } = await setup();

      investmentNft.mint.reverts();

      await expect(investmentFund.connect(wallet).invest(1, tokenUri)).to.be.reverted;
    });
  });

  describe('#withdraw()', () => {
    const investmentValue = toUsdc('100');
    const defaultProfit = BigNumber.from(10);

    before(async () => {
      ({ investmentFund, usdc, investmentNft, staking, deployer, wallet, owner, project } = await setup());
      await investmentFund.invest(investmentValue, tokenUri);
      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft, staking);

      investmentNft.getParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      staking.getDiscountInTimestamp.returns(0);
    });

    describe('if no profit provided', () => {
      it('Should revert withdrawing if no profit provided', async () => {
        await expect(investmentFund.connect(wallet).withdraw(1)).to.be.revertedWith('Payout does not exist');
      });
    });

    describe('if profit provided', () => {
      before(async () => {
        usdc.transferFrom.returns(true);
        await investmentFund.connect(project.wallet).provideProfit(defaultProfit);

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
      ({ investmentFund, usdc, investmentNft, staking, deployer, wallet, owner, project } = await setup());
      await investmentFund.invest(investmentValue, tokenUri);
      await investmentFund.connect(owner).addProject(project.address);
      await investmentFund.connect(owner).stopCollectingFunds();
      await investmentFund.connect(owner).deployFunds();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      resetFakes(usdc, investmentNft, staking);

      investmentNft.getParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      usdc.transferFrom.returns(true);
      usdc.transfer.returns(true);
      staking.getDiscountInTimestamp.returns(0);
    });

    it('Should revert retrieving carry fee if no profit provided', async () => {
      await expect(investmentFund.getWithdrawalCarryFee(wallet.address, 1)).to.be.revertedWith('Payout does not exist');
    });

    it('Should retrieve carry fee equal to 0 for payouts before or equal to breakeven', async () => {
      usdc.transferFrom.returns(true);
      await investmentFund.connect(project.wallet).provideProfit(investmentValue);

      expect(await investmentFund.isInProfit()).to.equal(false);
      expect(await investmentFund.getWithdrawalCarryFee(wallet.address, investmentValue)).to.equal(0);
    });

    [
      { amount: investmentValue.add(1), profit: investmentValue.add(1), fee: 0 },
      { amount: toUsdc('20'), profit: toUsdc('15'), fee: toUsdc('5') }
    ].forEach(async (data) => {
      it('Should retrieve carry fee for payouts after breakeven', async () => {
        usdc.transferFrom.returns(true);
        await investmentFund.connect(project.wallet).provideProfit(defaultProfit);

        expect(await investmentFund.isInProfit()).to.equal(true);
        expect(await investmentFund.getWithdrawalCarryFee(wallet.address, data.amount)).to.deep.equal(data.fee);
      });
    });

    [
      { amount: toUsdc('20'), discount: 0, fee: toUsdc('5') },
      { amount: toUsdc('20'), discount: 1, fee: toUsdc('4.999') },
      { amount: toUsdc('20'), discount: maxStakingDiscount, fee: toUsdc('1') }
    ].forEach((data) => {
      it('Should retrieve carry fee for payouts after breakeven if user staked for discount', async () => {
        usdc.transferFrom.returns(true);
        staking.getDiscountInTimestamp.returns(data.discount);
        await investmentFund.connect(project.wallet).provideProfit(defaultProfit);

        expect(await investmentFund.isInProfit()).to.equal(true);
        expect(await investmentFund.getWithdrawalCarryFee(wallet.address, data.amount)).to.deep.equal(data.fee);
      });
    });

    it('Should revert retrieving carry fee if no investment is done', async () => {
      investmentNft.getParticipation.returns([0, 0]);
      investmentNft.getPastParticipation.returns([0, 0]);
      usdc.transferFrom.returns(true);
      await investmentFund.connect(project.wallet).provideProfit(defaultProfit);

      await expect(investmentFund.getWithdrawalCarryFee(wallet.address, 1)).to.be.revertedWith(
        'Withdrawal amount exceeds available funds'
      );
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

      await expect(investmentFund.connect(owner).addProject(ethers.constants.AddressZero)).to.be.revertedWith(
        'Project is zero address'
      );
    });

    it('Should revert adding project to fund if already exists', async () => {
      ({ investmentFund, owner } = await setup());

      const project: FakeContract<Project> = await smock.fake('Project');
      await investmentFund.connect(owner).addProject(project.address);

      await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWith(
        'Project already exists'
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

      await expect(investmentFund.connect(owner).removeProject(ethers.constants.AddressZero)).to.be.revertedWith(
        'Project does not exist'
      );

      const project: FakeContract<Project> = await smock.fake('Project');
      await expect(investmentFund.connect(owner).removeProject(project.address)).to.be.revertedWith(
        'Project does not exist'
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
      investmentNft.getParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getPastParticipation.returns([investmentValue, investmentValue]);
      investmentNft.getInvestors.returns([deployer.address]);
      investmentNft.getTotalInvestmentValue.returns(investmentValue);
      staking.getDiscountInTimestamp.returns(0);
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
        expect(await investmentFund.getAvailableFunds(deployer.address)).to.equal(value);

        const block = await ethers.provider.getBlock(profitBlock);
        expect(await investmentFund.payouts(0)).to.deep.equal([value, 0, [block.number, block.timestamp], false]);
      });
    });

    it('Should provide profit equal to breakeven', async () => {
      const profitBlock = (await time.latestBlock()) + 10;
      await mineUpTo(profitBlock - 1);

      await expect(investmentFund.connect(project.wallet).provideProfit(investmentValue))
        .to.emit(investmentFund, 'ProfitProvided')
        .withArgs(investmentFund.address, investmentValue, 0, profitBlock)
        .to.emit(investmentFund, 'BreakevenReached')
        .withArgs(investmentValue);

      expect(await investmentFund.totalIncome()).to.equal(investmentValue);
      expect(await investmentFund.getPayoutsCount()).to.equal(1);

      const block = await ethers.provider.getBlock(profitBlock);
      expect(await investmentFund.payouts(0)).to.deep.equal([
        investmentValue,
        0,
        [block.number, block.timestamp],
        false
      ]);
    });

    // [investmentValue.add(1), constants.MaxUint256].forEach((value) => {
    [investmentValue.add(1)].forEach((value) => {
      it(`Should provide profit higher than breakeven [value=${value}]`, async () => {
        const profitBlock = (await time.latestBlock()) + 10;
        await mineUpTo(profitBlock - 1);

        const fee = value.sub(investmentValue).div(2);
        await expect(investmentFund.connect(project.wallet).provideProfit(value))
          .to.emit(investmentFund, 'ProfitProvided')
          .withArgs(investmentFund.address, value.sub(fee), fee, profitBlock)
          .to.emit(investmentFund, 'BreakevenReached')
          .withArgs(investmentValue);

        expect(await investmentFund.totalIncome()).to.equal(value);
        expect(await investmentFund.getPayoutsCount()).to.equal(2);

        const block = await ethers.provider.getBlock(profitBlock);
        expect(await investmentFund.payouts(0)).to.deep.equal([
          investmentValue,
          0,
          [block.number, block.timestamp],
          false
        ]);
        expect(await investmentFund.payouts(1)).to.deep.equal([
          value.sub(investmentValue).sub(fee),
          fee,
          [block.number, block.timestamp],
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
      expect((await investmentFund.payouts(0)).fee).to.equal(0);
      expect((await investmentFund.payouts(1)).value).to.equal(profit2);
      expect((await investmentFund.payouts(1)).fee).to.equal(toUsdc('15'));
    });

    it('Should revert providing zero profit', async () => {
      await expect(investmentFund.connect(project.wallet).provideProfit(0)).to.revertedWith('Zero profit provided');
    });

    it('Should revert providing profit if addres is not registered as project', async () => {
      await expect(investmentFund.connect(owner).provideProfit(toUsdc('20'))).to.revertedWith('Access Denied');
    });

    it('Should revert providing profit if transfer fails', async () => {
      usdc.transferFrom.returns(false);
      await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.revertedWith('Currency transfer failed');
    });
  });

  describe('State machine', async () => {
    describe('FundsIn', () => {
      before(async () => {
        ({ investmentFund, owner, project } = await setup());
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
        await expect(investmentFund.invest(1, tokenUri)).not.to.be.reverted;
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).not.to.be.reverted;
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert providing profits', async () => {
        await investmentFund.connect(owner).addProject(project.address);
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe('CapReached', () => {
      before(async () => {
        ({ investmentFund, owner, project } = await setup());

        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.connect(owner).stopCollectingFunds();
        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should revert adding project', async () => {
        await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.connect(owner).removeProject(project.address)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1, tokenUri)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should not revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).not.to.be.reverted;
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe('FundsDeployed', () => {
      const investmentValue = toUsdc('100');
      const profit = toUsdc('1');

      before(async () => {
        ({ investmentFund, usdc, investmentNft, owner, project } = await setup());

        await investmentFund.connect(owner).addProject(project.address);
        await investmentFund.invest(investmentValue, tokenUri);
        await investmentFund.connect(owner).stopCollectingFunds();
        await investmentFund.connect(owner).deployFunds();

        usdc.transferFrom.returns(true);
        usdc.transfer.returns(true);

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
        await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.connect(owner).removeProject(project.address)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1, tokenUri)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert withdrawing', async () => {
        await expect(investmentFund.withdraw(profit)).not.to.be.reverted;
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should not revert providing profits', async () => {
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).not.to.be.reverted;
      });

      it('Should not revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).not.to.be.reverted;
      });
    });

    describe('Closed', () => {
      before(async () => {
        ({ investmentFund, owner, project } = await setup());

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
        await expect(investmentFund.connect(owner).addProject(project.address)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert removing project', async () => {
        await expect(investmentFund.connect(owner).removeProject(project.address)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert investing', async () => {
        await expect(investmentFund.invest(1, tokenUri)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert withdrawing', async () => {
        await expect(investmentFund.withdraw(1)).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert stopping funds collection', async () => {
        await expect(investmentFund.connect(owner).stopCollectingFunds()).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert funds deployment', async () => {
        await expect(investmentFund.connect(owner).deployFunds()).to.be.revertedWith('Not allowed in current state');
      });

      it('Should revert providing profits', async () => {
        await expect(investmentFund.connect(project.wallet).provideProfit(1)).to.be.revertedWith(
          'Not allowed in current state'
        );
      });

      it('Should revert closing fund', async () => {
        await expect(investmentFund.connect(owner).closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });
});
