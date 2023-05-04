import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy, deployProxy } from '../../scripts/utils';
import { Crowdsale, GenesisNFT, USDC } from '../../typechain-types';
import { keccak256, toUsdc } from '../utils';

describe('Crowdsale integration tests', () => {
  const MINTER_ROLE = keccak256('MINTER_ROLE');

  const royalty = 650;
  const tokenUri = 'ipfs://token-uri';
  const genesisNftFactor = 7;
  const txTokenLimit = 100;
  const tranche1 = { supply: 1000, price: toUsdc('1000') };
  const userInitialBalance = tranche1.price.mul(tranche1.supply);

  const setup = async () => {
    const [deployer, owner, user, treasury, royaltyWallet] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', deployer, []);
    const genesisNft: GenesisNFT = await deployProxy('GenesisNFT', deployer, [
      'Common Wealth Genesis NFT',
      'CWOGNFT',
      genesisNftFactor,
      owner.address,
      royaltyWallet.address,
      royalty,
      tokenUri
    ]);
    const crowdsale: Crowdsale = await deployProxy('Crowdsale', deployer, [
      owner.address,
      treasury.address,
      usdc.address,
      genesisNft.address,
      0,
      0
    ]);

    await usdc.mint(user.address, userInitialBalance);
    await genesisNft.connect(owner).grantRole(MINTER_ROLE, crowdsale.address);
    await crowdsale.connect(owner).addTranche(tranche1.supply, tranche1.price);

    return { crowdsale, genesisNft, usdc, deployer, owner, user, treasury, royaltyWallet };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { crowdsale, genesisNft, usdc, owner, user, treasury } = await loadFixture(setup);

      expect(await crowdsale.owner()).to.equal(owner.address);
      expect(await crowdsale.token()).to.equal(genesisNft.address);
      expect(await crowdsale.currency()).to.equal(usdc.address);
      expect(await crowdsale.wallet()).to.equal(treasury.address);
      expect(await crowdsale.fundsRaised()).to.equal(0);
      expect(await crowdsale.paused()).to.equal(true);

      expect(await crowdsale.getTranchesCount()).to.equal(2);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche1.price, tranche1.supply, 0, 0, 0]);
      expect(await crowdsale.available(owner.address)).to.equal(tranche1.supply);
      expect(await crowdsale.TOKEN_LIMIT_PER_PURCHASE()).to.equal(txTokenLimit);

      expect(await genesisNft.balanceOf(user.address)).to.equal(0);
      expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance);
    });
  });

  describe('Buy tokens', async () => {
    [1, txTokenLimit].forEach((tokenAmount) => {
      it(`Should buy tokens [amount=${tokenAmount}]`, async () => {
        const { crowdsale, genesisNft, usdc, owner, user, treasury } = await loadFixture(setup);

        await usdc.connect(user).approve(crowdsale.address, userInitialBalance);
        await crowdsale.connect(owner).unpause();

        expect(await genesisNft.balanceOf(user.address)).to.equal(0);
        expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance);
        expect(await usdc.balanceOf(treasury.address)).to.equal(0);

        const expectedFundsRaised = tranche1.price.mul(tokenAmount);

        await crowdsale.connect(user).buyTokens(tokenAmount);

        expect(await genesisNft.balanceOf(user.address)).to.equal(tokenAmount);
        expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance.sub(expectedFundsRaised));
        expect(await usdc.balanceOf(treasury.address)).to.equal(expectedFundsRaised);
      });
    });

    it('Should buy tokens from multiple token pools', async () => {
      const { crowdsale, genesisNft, usdc, owner, user, treasury } = await loadFixture(setup);

      await usdc.connect(user).approve(crowdsale.address, userInitialBalance);
      await crowdsale.connect(owner).unpause();

      expect(await genesisNft.balanceOf(user.address)).to.equal(0);
      expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance);
      expect(await usdc.balanceOf(treasury.address)).to.equal(0);

      const amount = 1;
      let expectedFundsRaised = tranche1.price.mul(amount);

      await crowdsale.connect(user).buyTokens(amount);

      expect(await genesisNft.balanceOf(user.address)).to.equal(amount);
      expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance.sub(expectedFundsRaised));
      expect(await usdc.balanceOf(treasury.address)).to.equal(expectedFundsRaised);

      const tranche2 = { supply: 500, price: toUsdc('750') };
      const amount2 = 5;
      expectedFundsRaised = expectedFundsRaised.add(tranche2.price.mul(amount2));

      await crowdsale.connect(owner).addTranche(tranche2.supply, tranche2.price);
      await crowdsale.connect(user).buyTokens(amount2);

      expect(await genesisNft.balanceOf(user.address)).to.equal(amount + amount2);
      expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance.sub(expectedFundsRaised));
      expect(await usdc.balanceOf(treasury.address)).to.equal(expectedFundsRaised);
    });

    it('Should buy hundred tokens at once', async () => {
      const { crowdsale, genesisNft, usdc, owner, user, treasury } = await loadFixture(setup);

      await usdc.connect(user).approve(crowdsale.address, userInitialBalance);
      await crowdsale.connect(owner).unpause();

      const amount = 100;
      let expectedFundsRaised = tranche1.price.mul(amount);

      await crowdsale.connect(user).buyTokens(amount);

      expect(await genesisNft.balanceOf(user.address)).to.equal(amount);
      expect(await usdc.balanceOf(user.address)).to.equal(userInitialBalance.sub(expectedFundsRaised));
      expect(await usdc.balanceOf(treasury.address)).to.equal(expectedFundsRaised);
    });

    it('Should revert buying tokens if insufficient allowance', async () => {
      const { crowdsale } = await loadFixture(setup);

      await expect(crowdsale.buyTokens(1)).to.be.reverted;
    });
  });
});
