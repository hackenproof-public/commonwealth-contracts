import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe('Common Wealth Token unit tests', () => {
  const setup = async () => {
    const initialTokenAmount = toWlth('1000000000');
    const name = 'Common Wealth Token';
    const symbol = 'WLTH';
    const [deployer, burner, holder] = await ethers.getSigners();

    const wlth: Wlth = (await deploy('Wlth', [name, symbol, holder.address], deployer)) as Wlth;

    return { wlth, deployer, holder, burner, initialTokenAmount, name, symbol };
  };

  describe('Deployment', () => {
    it('Should deploy the contract with initial parameters', async () => {
      const { wlth, name, symbol, initialTokenAmount, deployer, holder } = await loadFixture(setup);

      expect(await wlth.name()).to.equal(name);
      expect(await wlth.symbol()).to.equal(symbol);
      expect(await wlth.totalSupply()).to.equal(initialTokenAmount);
      expect(await wlth.balanceOf(deployer.address)).to.equal(0);
      expect(await wlth.balanceOf(holder.address)).to.equal(initialTokenAmount);
      expect(await wlth.burned()).to.equal(0);
    });
  });

  describe('Burn', () => {
    it('Should burn owned tokens', async () => {
      const { wlth, deployer, holder } = await loadFixture(setup);
      const toBurn = 300;
      const balance = await wlth.balanceOf(holder.address);
      const totalSupplyBeforeBurn = await wlth.totalSupply();

      await expect(wlth.connect(holder).burn(toBurn))
        .to.emit(wlth, 'Transfer')
        .withArgs(holder.address, constants.AddressZero, toBurn);

      expect(await wlth.balanceOf(holder.address)).to.equal(balance.sub(toBurn));
      expect(await wlth.burned()).to.be.equal(toBurn);
      expect(await wlth.totalSupply()).to.be.equal(totalSupplyBeforeBurn.sub(toBurn));
    });
  });
});
