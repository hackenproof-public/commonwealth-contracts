import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentFund, InvestmentFundRegistry } from '../../typechain-types';

describe('Investment fund registry unit tests', () => {
  const deployFixture = async () => {
    const [deployer] = await ethers.getSigners();

    const investmentFundRegistry: InvestmentFundRegistry = await deploy('InvestmentFundRegistry', deployer, []);

    return { investmentFundRegistry, deployer };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { investmentFundRegistry } = await loadFixture(deployFixture);

      expect(await investmentFundRegistry.getFundsCount()).to.equal(0);
    });
  });

  describe('#addFund()', () => {
    it('Should add investment fund', async () => {
      const { investmentFundRegistry } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await expect(investmentFundRegistry.addFund(investmentFund.address))
        .to.emit(investmentFundRegistry, 'FundAddedToRegistry')
        .withArgs(investmentFund.address);
    });

    it('Should revert adding investment fund if fund is zero address', async () => {
      const { investmentFundRegistry } = await loadFixture(deployFixture);

      await expect(investmentFundRegistry.addFund(constants.AddressZero)).to.be.revertedWith('Invalid fund address');
    });

    it('Should revert adding investment fund if fund is already added', async () => {
      const { investmentFundRegistry } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await investmentFundRegistry.addFund(investmentFund.address);
      await expect(investmentFundRegistry.addFund(investmentFund.address)).to.be.revertedWith(
        'Adding fund to registry failed'
      );
    });
  });

  describe('#listFunds()', () => {
    [0, 1, 10].forEach((amount: number) => {
      it(`Should list all investment funds [amount=${amount}]`, async () => {
        const { investmentFundRegistry } = await loadFixture(deployFixture);

        for (let i = 0; i < amount; i++) {
          const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
          investmentFund.supportsInterface.returns(true);

          await investmentFundRegistry.addFund(investmentFund.address);
        }

        expect((await investmentFundRegistry.listFunds()).length).is.equal(amount);
      });
    });
  });

  describe('#removeFund()', () => {
    it('Should remove existing fund', async () => {
      const { investmentFundRegistry } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await investmentFundRegistry.addFund(investmentFund.address);

      expect(await investmentFundRegistry.getFundsCount()).to.equal(1);

      await expect(investmentFundRegistry.removeFund(investmentFund.address)).to.emit(
        investmentFundRegistry,
        'FundRemovedFromRegistry'
      );
      expect(await investmentFundRegistry.getFundsCount()).to.equal(0);
    });

    it('Should revert removing fund if it does not exist', async () => {
      const { investmentFundRegistry } = await loadFixture(deployFixture);

      await expect(investmentFundRegistry.removeFund(constants.AddressZero)).to.be.revertedWith(
        'Removing fund from registry failed'
      );
    });
  });
});
