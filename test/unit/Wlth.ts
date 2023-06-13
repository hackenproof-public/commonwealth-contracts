import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { Wlth } from '../../typechain-types';

describe('Common Wealth Token unit tests', () => {
  const initialTokenAmount = BigNumber.from('1000000000000000000000000000');

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const [deployer] = await ethers.getSigners();

      const wlth: Wlth = await deployProxy('Wlth', ['Common Wealth Token', 'WLTH'], deployer);

      expect(await wlth.name()).to.equal('Common Wealth Token');
      expect(await wlth.symbol()).to.equal('WLTH');
      expect(await wlth.totalSupply()).to.equal(initialTokenAmount);
      expect(await wlth.balanceOf(deployer.address)).to.equal(initialTokenAmount);
    });
  });
});
