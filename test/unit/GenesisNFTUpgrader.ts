import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFT, GenesisNFTUpgrader, GenNFTV2 } from '../../typechain-types';

describe('GenesisNFTUpgrader unit tests', () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  const deployFixture = async () => {
    [deployer, owner, user] = await ethers.getSigners();

    const sourceNft: FakeContract<GenNFTV2> = await smock.fake('GenNFT');
    const targetNft: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');
    const upgrader: GenesisNFTUpgrader = await deployProxy('GenesisNFTUpgrader', deployer, [
      owner.address,
      sourceNft.address,
      targetNft.address
    ]);

    return { upgrader, sourceNft, targetNft, deployer, owner, user };
  };

  describe('Deployment', () => {
    it('Should deploy', async () => {
      const { upgrader, sourceNft, targetNft, owner } = await loadFixture(deployFixture);

      expect(await upgrader.owner()).to.equal(owner.address);
      expect(await upgrader.sourceNft()).to.equal(sourceNft.address);
      expect(await upgrader.targetNft()).to.equal(targetNft.address);
    });

    it('Should revert deploying if owner is zero address', async () => {
      [deployer, owner, user] = await ethers.getSigners();

      const sourceNft: FakeContract<GenNFTV2> = await smock.fake('GenNFT');
      const targetNft: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');
      await expect(
        deployProxy('GenesisNFTUpgrader', deployer, [constants.AddressZero, sourceNft.address, targetNft.address])
      ).to.be.revertedWith('Owner is zero address');
    });

    it('Should revert deploying if source contract is zero address', async () => {
      [deployer, owner, user] = await ethers.getSigners();

      const targetNft: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');
      await expect(
        deployProxy('GenesisNFTUpgrader', deployer, [owner.address, constants.AddressZero, targetNft.address])
      ).to.be.revertedWith('Source contract is zero address');
    });

    it('Should revert deploying if target contract is zero address', async () => {
      [deployer, owner, user] = await ethers.getSigners();

      const sourceNft: FakeContract<GenNFTV2> = await smock.fake('GenNFT');
      await expect(
        deployProxy('GenesisNFTUpgrader', deployer, [owner.address, sourceNft.address, constants.AddressZero])
      ).to.be.revertedWith('Target contract is zero address');
    });
  });

  describe('#upgrade()', () => {
    it('Should upgrade holded tokens', async () => {
      const { upgrader, sourceNft } = await loadFixture(deployFixture);

      sourceNft.balanceOf.returns(3);
      await expect(upgrader.connect(user).upgrade(user.address, 3)).not.to.be.reverted;
    });

    it("Should upgrade somebody's tokens if owner", async () => {
      const { upgrader, sourceNft, owner } = await loadFixture(deployFixture);

      sourceNft.balanceOf.returns(3);
      await upgrader.connect(owner).upgrade(user.address, 3);
    });

    it("Should revert upgrading somebody's tokens if not owner", async () => {
      const { upgrader, sourceNft, owner } = await loadFixture(deployFixture);

      sourceNft.balanceOf.returns(3);
      await expect(upgrader.connect(user).upgrade(owner.address, 3)).to.be.revertedWith('Operation not allowed');
    });

    it('Should revert upgrading tokens if not enough holded', async () => {
      const { upgrader, sourceNft } = await loadFixture(deployFixture);

      sourceNft.balanceOf.returns(2);
      await expect(upgrader.connect(user).upgrade(user.address, 3)).to.be.revertedWith('Insufficient number of tokens');
    });

    it('Should revert upgrading tokens if paused and upgrade when unpaused', async () => {
      const { upgrader, sourceNft } = await loadFixture(deployFixture);

      sourceNft.balanceOf.returns(3);

      await upgrader.connect(owner).pause();
      await expect(upgrader.connect(user).upgrade(user.address, 3)).to.be.revertedWith('Pausable: paused');

      await upgrader.connect(owner).unpause();
      await expect(upgrader.connect(user).upgrade(user.address, 3)).not.to.be.reverted;
    });
  });
});
