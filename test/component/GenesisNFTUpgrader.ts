import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFTV1, GenesisNFTUpgrader, GenNFT, GenNFTV2 } from '../../typechain-types';
import { keccak256, missing_role } from '../utils';

describe('GenesisNFTUpgrader component tests', () => {
  const minterRole = keccak256('MINTER_ROLE');
  const burnerRole = keccak256('BURNER_ROLE');
  const erc1155ContractUri = 'ipfs://contract-uri';
  const erc1155Royalty = 650;
  const erc1155TokenURI = 'ipfs://token-uri';
  const erc1155TokenId = 1;
  const royaltyWallet = ethers.Wallet.createRandom().address;

  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  const deployFixture = async () => {
    [deployer, owner, user] = await ethers.getSigners();

    const genNft: GenNFT = await deployProxy(
      'GenNFT',
      [owner.address, royaltyWallet, erc1155Royalty, erc1155ContractUri],
      deployer
    );

    const GenNFTV2Factory = await ethers.getContractFactory('GenNFTV2');
    const sourceNft = (await upgrades.upgradeProxy(genNft.address, GenNFTV2Factory)) as GenNFTV2;

    const targetNft: GenesisNFTV1 = await deployProxy(
      'GenesisNFTV1',
      ['Common Wealth Genesis NFT', 'CWOGNFT', 1, owner.address, royaltyWallet, erc1155Royalty, erc1155TokenURI],
      deployer
    );

    const upgrader: GenesisNFTUpgrader = await deployProxy(
      'GenesisNFTUpgrader',
      [owner.address, sourceNft.address, targetNft.address],
      deployer
    );

    return { upgrader, sourceNft, targetNft, owner, user };
  };

  describe('Deployment', () => {
    it('Should deploy', async () => {
      const { upgrader, sourceNft, targetNft } = await loadFixture(deployFixture);

      expect(await upgrader.owner()).to.equal(owner.address);
      expect(await upgrader.sourceNft()).to.equal(sourceNft.address);
      expect(await upgrader.targetNft()).to.equal(targetNft.address);
      expect(await sourceNft.balanceOf(deployer.address, erc1155TokenId)).to.equal(0);
      expect(await sourceNft.hasRole(burnerRole, upgrader.address)).to.equal(false);
      expect(await targetNft.hasRole(minterRole, upgrader.address)).to.equal(false);
    });
  });

  describe('Upgrade NFTs', () => {
    const defaultMintAmount = 10;

    [1, 2, 200].forEach((amount) => {
      it(`Should upgrade NFT [amount=${amount}]`, async () => {
        const { upgrader, sourceNft, targetNft } = await loadFixture(deployFixture);

        await sourceNft.connect(owner).mint(user.address, erc1155TokenId, amount, erc1155TokenURI);
        await sourceNft.connect(owner).grantRole(burnerRole, upgrader.address);
        await targetNft.connect(owner).grantRole(minterRole, upgrader.address);

        expect(await sourceNft.balanceOf(user.address, erc1155TokenId)).to.equal(amount);

        await upgrader.connect(user).upgrade(user.address, amount);

        expect(await targetNft.balanceOf(user.address)).to.equal(amount);
      });
    });

    it('Should revert upgrading if upgrader has no burner role', async () => {
      const { upgrader, sourceNft, targetNft } = await loadFixture(deployFixture);

      await sourceNft.connect(owner).mint(user.address, erc1155TokenId, defaultMintAmount, erc1155TokenURI);
      await targetNft.connect(owner).grantRole(minterRole, upgrader.address);

      await expect(upgrader.connect(user).upgrade(user.address, defaultMintAmount)).to.be.revertedWith(
        missing_role(upgrader.address, burnerRole)
      );
    });

    it('Should revert upgrading if upgrader has no minter role', async () => {
      const { upgrader, sourceNft } = await loadFixture(deployFixture);

      await sourceNft.connect(owner).mint(user.address, erc1155TokenId, defaultMintAmount, erc1155TokenURI);
      await sourceNft.connect(owner).grantRole(burnerRole, upgrader.address);

      await expect(upgrader.connect(user).upgrade(user.address, defaultMintAmount)).to.be.revertedWith(
        missing_role(upgrader.address, minterRole)
      );
    });

    it('Should revert upgrading if user has insufficient number of tokens', async () => {
      const { upgrader, sourceNft, targetNft } = await loadFixture(deployFixture);

      await sourceNft.connect(owner).grantRole(burnerRole, upgrader.address);
      await targetNft.connect(owner).grantRole(minterRole, upgrader.address);

      await expect(upgrader.connect(user).upgrade(user.address, defaultMintAmount)).to.be.revertedWith(
        'Insufficient number of tokens'
      );
    });
  });
});
