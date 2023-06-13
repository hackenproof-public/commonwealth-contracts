import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { USDC } from '../../typechain-types';

describe('USDC', function () {
  const deployFixture = async () => {
    const [deployer] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', [], deployer);

    return { usdc, deployer };
  };

  describe('Deployment', function () {
    it('Should deploy', async () => {
      const { usdc } = await loadFixture(deployFixture);

      expect(await usdc.decimals()).to.equal(6);
    });
  });

  describe('#mint()', function () {
    it('Should mint token', async () => {
      const { usdc, deployer } = await loadFixture(deployFixture);

      const amount = 10;

      await usdc.mint(deployer.address, amount);
      expect(await usdc.balanceOf(deployer.address)).to.equal(amount);
    });
  });
});
