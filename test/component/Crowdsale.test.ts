import { loadFixture, mineUpTo } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { deploy, deployProxy } from '../../scripts/utils';
import { Crowdsale, GenesisNFTV1, USDC } from '../../typechain-types';
import { keccak256 } from '../utils';

describe.skip('Crowdsale component tests', () => {
  const MINTER_ROLE = keccak256('MINTER_ROLE');
  const PHASE_INACTIVE = 2;
  const USER_INITIAL_BALANCE: BigNumber = BigNumber.from(1_000_000 * 10e6);
  const MAX_KOL_TOKENS_TO_BUY = 5;
  const PUBLIC_PRICE = 99000000;
  const KOL_PRICE = 69000000;
  const WHITELIST_DURATION = 300; // 60 minutes in blocks
  const PUBLIC_DURATION = 300 * 9; // 9 hours in blocks
  const DURATION_BETWEEN_TRANCHES = 300 * 24; // 24 hours in blocks

  const royalty = 650;
  const tokenUri = 'ipfs://token-uri';
  const treasuryWallet = ethers.Wallet.createRandom().address;
  const royaltyWallet = ethers.Wallet.createRandom().address;
  let tranche1: { start: number; price: BigNumber };

  const setup = async () => {
    const [deployer, owner, user] = await ethers.getSigners();

    const usdc: USDC = await deploy('USDC', [], deployer);
    const genesisNft: GenesisNFTV1 = await deployProxy(
      'GenesisNFTV1',
      ['Common Wealth Genesis NFT', 'CWOGNFT', 1, owner.address, royaltyWallet, royalty, tokenUri],
      deployer
    );
    const crowdsale: Crowdsale = await deployProxy(
      'Crowdsale',
      [
        owner.address,
        treasuryWallet,
        usdc.address,
        genesisNft.address,
        0,
        0,
        WHITELIST_DURATION,
        PUBLIC_DURATION,
        DURATION_BETWEEN_TRANCHES
      ],
      deployer
    );

    tranche1 = { start: (await ethers.provider.getBlockNumber()) + 10, price: BigNumber.from(KOL_PRICE) };

    await usdc.mint(user.address, USER_INITIAL_BALANCE);
    await genesisNft.connect(owner).grantRole(MINTER_ROLE, crowdsale.address);
    await crowdsale.connect(owner).addTranche(tranche1.start, tranche1.price);

    return { crowdsale, genesisNft, usdc, deployer, owner, user, royaltyWallet };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      expect(await crowdsale.owner()).to.equal(owner.address);
      expect(await crowdsale.token()).to.equal(genesisNft.address);
      expect(await crowdsale.currency()).to.equal(usdc.address);
      expect(await crowdsale.wallet()).to.equal(treasuryWallet);
      expect(await crowdsale.fundsRaised()).to.equal(0);
      expect(await crowdsale.paused()).to.equal(true);

      expect(await crowdsale.getTranchesCount()).to.equal(1);
      expect((await crowdsale.getCurrentTrancheDetails()).details).to.deep.equal([0, 0, 0, 0, 0, 0, 0]);
      expect((await crowdsale.getCurrentTrancheDetails()).phase).to.deep.equal(PHASE_INACTIVE);
      expect(await crowdsale.available(owner.address)).to.equal(0);

      expect(await genesisNft.balanceOf(user.address)).to.equal(0);
      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
    });
  });

  describe('Buy tokens', async () => {
    it(`Should get free mint for free`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await usdc.connect(user).approve(crowdsale.address, USER_INITIAL_BALANCE);
      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + 1);

      await crowdsale.connect(user).buyTokens(1);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(1);
      expect(await crowdsale.connect(user).boughtCountFreeMint(user.address)).to.equal(1);
    });

    it(`Should not allow getting more than one free mint`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + 1);

      await expect(crowdsale.connect(user).buyTokens(2)).to.be.revertedWith('Too many tokens claimed');
    });

    it(`Should buy kol whitelist tokens`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await usdc.connect(user).approve(crowdsale.address, MAX_KOL_TOKENS_TO_BUY * KOL_PRICE);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + 1);

      await crowdsale.connect(user).buyTokens(MAX_KOL_TOKENS_TO_BUY);

      expect(await usdc.balanceOf(user.address)).to.equal(
        USER_INITIAL_BALANCE.sub(BigNumber.from(MAX_KOL_TOKENS_TO_BUY).mul(BigNumber.from(KOL_PRICE)))
      );
      expect(await genesisNft.balanceOf(user.address)).to.equal(MAX_KOL_TOKENS_TO_BUY);
      expect(await crowdsale.connect(user).boughtCountKol(user.address)).to.equal(MAX_KOL_TOKENS_TO_BUY);
    });

    it(`Should first claim free mints and then buy kol whitelist tokens`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await usdc.connect(user).approve(crowdsale.address, MAX_KOL_TOKENS_TO_BUY * KOL_PRICE);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + 1);

      await crowdsale.connect(user).buyTokens(3);

      expect(await usdc.balanceOf(user.address)).to.equal(
        USER_INITIAL_BALANCE.sub(BigNumber.from(2).mul(BigNumber.from(KOL_PRICE)))
      );
      expect(await genesisNft.balanceOf(user.address)).to.equal(3);
    });

    it(`Should buy tokens on a public price`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).unpause();
      await usdc.connect(user).approve(crowdsale.address, 44 * PUBLIC_PRICE);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + WHITELIST_DURATION + 1);

      await crowdsale.connect(user).buyTokens(44);

      expect(await usdc.balanceOf(user.address)).to.equal(
        USER_INITIAL_BALANCE.sub(BigNumber.from(44).mul(BigNumber.from(PUBLIC_PRICE)))
      );
      expect(await genesisNft.balanceOf(user.address)).to.equal(44);
    });

    it(`Should ignore whitelists if in public phase`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await usdc.connect(user).approve(crowdsale.address, 44 * PUBLIC_PRICE);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + WHITELIST_DURATION + 1);

      await crowdsale.connect(user).buyTokens(44);

      expect(await usdc.balanceOf(user.address)).to.equal(
        USER_INITIAL_BALANCE.sub(BigNumber.from(44).mul(BigNumber.from(PUBLIC_PRICE)))
      );
      expect(await genesisNft.balanceOf(user.address)).to.equal(44);
    });

    it(`Should not allow to buy if its inactive`, async () => {
      const { crowdsale, genesisNft, usdc, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await usdc.connect(user).approve(crowdsale.address, 44 * PUBLIC_PRICE);

      expect(await usdc.balanceOf(user.address)).to.equal(USER_INITIAL_BALANCE);
      expect(await genesisNft.balanceOf(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + WHITELIST_DURATION + PUBLIC_DURATION + 1);

      await expect(crowdsale.connect(user).buyTokens(1)).to.be.revertedWith('Too many tokens claimed');
    });
  });
});
