import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { InvestmentFund, InvestmentFundRegistry } from '../../typechain-types';

describe('Investment fund registry unit tests', () => {
  const deployFixture = async () => {
    const [deployer, owner] = await ethers.getSigners();

    const investmentFundRegistry: InvestmentFundRegistry = await deployProxy(
      'InvestmentFundRegistry',
      [owner.address],
      deployer
    );

    return { investmentFundRegistry, deployer, owner };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

      expect(await investmentFundRegistry.getFundsCount()).to.equal(0);
      expect(await investmentFundRegistry.owner()).to.equal(owner.address);
    });
  });

  describe('#addFund()', () => {
    it('Should add investment fund if owner', async () => {
      const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await expect(investmentFundRegistry.connect(owner).addFund(investmentFund.address))
        .to.emit(investmentFundRegistry, 'FundAddedToRegistry')
        .withArgs(investmentFund.address);
    });

    it('Should revert adding investment fund if not owner', async () => {
      const { investmentFundRegistry, deployer } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await expect(investmentFundRegistry.connect(deployer).addFund(investmentFund.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert adding investment fund if fund is zero address', async () => {
      const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

      await expect(investmentFundRegistry.connect(owner).addFund(constants.AddressZero)).to.be.revertedWith(
        'Invalid fund address'
      );
    });

    it('Should revert adding investment fund if fund is already added', async () => {
      const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await investmentFundRegistry.connect(owner).addFund(investmentFund.address);
      await expect(investmentFundRegistry.connect(owner).addFund(investmentFund.address)).to.be.revertedWith(
        'Adding fund to registry failed'
      );
    });
  });

  describe('#listFunds()', () => {
    [0, 1, 10].forEach((amount: number) => {
      it(`Should list all investment funds [amount=${amount}]`, async () => {
        const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

        for (let i = 0; i < amount; i++) {
          const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
          investmentFund.supportsInterface.returns(true);

          await investmentFundRegistry.connect(owner).addFund(investmentFund.address);
        }

        expect((await investmentFundRegistry.listFunds()).length).to.equal(amount);
      });
    });
  });

  describe('#removeFund()', () => {
    it('Should remove existing fund if owner', async () => {
      const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await investmentFundRegistry.connect(owner).addFund(investmentFund.address);

      expect(await investmentFundRegistry.getFundsCount()).to.equal(1);

      await expect(investmentFundRegistry.connect(owner).removeFund(investmentFund.address)).to.emit(
        investmentFundRegistry,
        'FundRemovedFromRegistry'
      );
      expect(await investmentFundRegistry.getFundsCount()).to.equal(0);
    });

    it('Should revert removing existing fund if not owner', async () => {
      const { investmentFundRegistry, deployer, owner } = await loadFixture(deployFixture);

      const investmentFund: FakeContract<InvestmentFund> = await smock.fake('InvestmentFund');
      investmentFund.supportsInterface.returns(true);

      await investmentFundRegistry.connect(owner).addFund(investmentFund.address);

      await expect(investmentFundRegistry.connect(deployer).removeFund(investmentFund.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert removing fund if it does not exist', async () => {
      const { investmentFundRegistry, owner } = await loadFixture(deployFixture);

      await expect(investmentFundRegistry.connect(owner).removeFund(constants.AddressZero)).to.be.revertedWith(
        'Removing fund from registry failed'
      );
    });
  });
});
