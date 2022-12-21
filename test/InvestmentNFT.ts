import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../scripts/utils';
import { InvestmentNFT } from '../typechain-types';

describe('Investment NFT', function () {
  let deployer: SignerWithAddress;

  async function deployFixture() {
    [deployer] = await ethers.getSigners();

    const invNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, []);

    return { invNft };
  }

  describe('Deployment', function () {
    it('Should deploy', async () => {
      const { invNft } = await loadFixture(deployFixture);

      expect(await invNft.balanceOf(deployer.address)).to.equal(0);
    });
  });

  describe('Mint and burn', function () {
    it('Should mint and burn token', async () => {
      const { invNft } = await loadFixture(deployFixture);

      await invNft.mint(deployer.address, 1000);
      expect(await invNft.ownerOf(0)).to.equal(deployer.address);

      await invNft.burn(0);
      await expect(invNft.ownerOf(0)).to.be.revertedWith('ERC721: invalid token ID');
    });
  });
});
