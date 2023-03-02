import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../scripts/utils';
import { USDC } from '../typechain-types';

describe('USDC', function () {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', deployer, []);

    return { usdc };
  }

  describe('Deployment', function () {
    it('Should deploy', async () => {
      const { usdc } = await loadFixture(deployFixture);

      expect(await usdc.decimals()).to.equal(6);
    });
  });
});
