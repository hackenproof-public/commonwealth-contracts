import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { InvestmentNFT } from '../../typechain-types';

describe('Investment NFT', function () {
  let deployer: SignerWithAddress;

  async function deployFixture() {
    [deployer] = await ethers.getSigners();

    const investmentNft: InvestmentNFT = await deploy('InvestmentNFT', deployer, []);

    return { investmentNft };
  }

  describe('Deployment', function () {
    it('Should deploy', async () => {
      const { investmentNft } = await loadFixture(deployFixture);

      expect(await investmentNft.balanceOf(deployer.address)).to.equal(0);
    });
  });

  describe('Mint and burn', function () {
    it('Should mint and burn token', async () => {
      const { investmentNft } = await loadFixture(deployFixture);

      await investmentNft.mint(deployer.address, 1000);
      expect(await investmentNft.ownerOf(0)).to.equal(deployer.address);

      await investmentNft.burn(0);
      await expect(investmentNft.ownerOf(0)).to.be.revertedWith('ERC721: invalid token ID');
    });
  });
});
