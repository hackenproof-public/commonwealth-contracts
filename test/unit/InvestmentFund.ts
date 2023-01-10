import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentNFT, USDC } from '../../typechain-types';
import { FundState, InvestmentFundDeploymentParameters } from '../types';
import { toUsdc } from '../utils';

const MAX_UINT240: BigNumber = BigNumber.from(
  '1766847064778384329583297500742918515827483896875618958121606201292619775'
);

describe('Investment Fund unit tests', () => {
  const defaultManagementFee: number = 200;
  const defaultInvestmentCap: BigNumber = toUsdc('1000000');

  const deployInvestmentFund = async ({
    fundName = 'Investment Fund',
    treasuryAddress = undefined,
    managementFee = defaultManagementFee,
    cap = defaultInvestmentCap
  }: InvestmentFundDeploymentParameters = {}) => {
    const [deployer, treasuryWallet, wallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');

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

  const setup = async () => {
    const { investmentFund, usdc, investmentNft, deployer, treasuryWallet, wallet } = await loadFixture(deployFixture);

    usdc.transferFrom.reset();
    investmentNft.mint.reset();

    usdc.transferFrom.returns(true);
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
  });

  describe('#setCurrency()', () => {
    it('Should set currency', async () => {
      const { investmentFund, usdc, wallet } = await setup();

      expect(await investmentFund.currency()).to.equal(usdc.address);

      await expect(investmentFund.connect(wallet).setCurrency(constants.AddressZero))
        .to.emit(investmentFund, 'CurrencyChanged')
        .withArgs(wallet.address, usdc.address, constants.AddressZero);
      expect(await investmentFund.currency()).to.equal(constants.AddressZero);
    });
  });

  describe('#setInvestmentNft()', () => {
    it('Should set Investment NFT', async () => {
      const { investmentFund, investmentNft, wallet } = await setup();

      expect(await investmentFund.investmentNft()).to.equal(investmentNft.address);

      await expect(investmentFund.connect(wallet).setInvestmentNft(constants.AddressZero))
        .to.emit(investmentFund, 'InvestmentNFTChanged')
        .withArgs(wallet.address, investmentNft.address, constants.AddressZero);
      expect(await investmentFund.investmentNft()).to.equal(constants.AddressZero);
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
          .withArgs(wallet.address, usdc.address, amount.sub(fee), cap);

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

      await expect(investmentFund.connect(wallet).invest(1)).to.be.revertedWith('Currency fee transfer failed');
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

  describe(`State machine`, () => {
    let investmentFund: InvestmentFund;
    let restorer: SnapshotRestorer;

    describe(`Empty`, () => {
      beforeEach(async () => {
        ({ investmentFund } = await setup());
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
        await expect(investmentFund.provideProfits()).to.be.revertedWith('Not allowed in current state');
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
        await expect(investmentFund.provideProfits()).to.be.revertedWith('Not allowed in current state');
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
        await expect(investmentFund.provideProfits()).to.be.revertedWith('Not allowed in current state');
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
        await expect(investmentFund.provideProfits()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });

    describe(`Active`, () => {
      before(async () => {
        ({ investmentFund } = await setup());
        await investmentFund.startCollectingFunds();
        await investmentFund.stopCollectingFunds();
        await investmentFund.deployFunds();
        await investmentFund.activateFund();
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
        await expect(investmentFund.provideProfits()).not.to.be.reverted;
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
        await expect(investmentFund.provideProfits()).to.be.revertedWith('Not allowed in current state');
      });

      it(`Should revert closing fund`, async () => {
        await expect(investmentFund.closeFund()).to.be.revertedWith('Not allowed in current state');
      });
    });
  });
});
