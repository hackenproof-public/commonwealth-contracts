import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { Crowdsale, GenesisNFT, USDC } from '../../typechain-types';
import { toUsdc } from '../utils';

describe('Crowdsale unit tests', () => {
  const supply = 1000;
  const nftPrice = toUsdc('1000');
  const txTokenLimit = 100;
  const tokenUri = 'ipfs://token-uri';

  let restorer: SnapshotRestorer;

  const setup = async () => {
    const [deployer, owner, user, treasury, royaltyWallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const genesisNft: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');
    const crowdsale: Crowdsale = await deployProxy('Crowdsale', deployer, [
      owner.address,
      treasury.address,
      usdc.address,
      genesisNft.address,
      0,
      0,
      tokenUri
    ]);

    return { crowdsale, genesisNft, usdc, deployer, owner, user, treasury, royaltyWallet };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { crowdsale, genesisNft, usdc, owner, treasury } = await loadFixture(setup);

      expect(await crowdsale.owner()).to.equal(owner.address);
      expect(await crowdsale.token()).to.equal(genesisNft.address);
      expect(await crowdsale.currency()).to.equal(usdc.address);
      expect(await crowdsale.wallet()).to.equal(treasury.address);
      expect(await crowdsale.fundsRaised()).to.equal(0);
      expect(await crowdsale.tokenUri()).to.equal(tokenUri);
      expect(await crowdsale.paused()).to.equal(true);

      expect(await crowdsale.getTranchesCount()).to.equal(1);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([0, 0, 0, 0, 0]);
      expect(await crowdsale.supply()).to.equal(0);
      expect(await crowdsale.TOKEN_LIMIT_PER_PURCHASE()).to.equal(txTokenLimit);
    });

    it('Should deploy with initial tranche', async () => {
      const [deployer, owner, treasury] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const genesisNft: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');
      const crowdsale: Crowdsale = await deployProxy('Crowdsale', deployer, [
        owner.address,
        treasury.address,
        usdc.address,
        genesisNft.address,
        supply,
        nftPrice,
        tokenUri
      ]);

      expect(await crowdsale.owner()).to.equal(owner.address);
      expect(await crowdsale.token()).to.equal(genesisNft.address);
      expect(await crowdsale.currency()).to.equal(usdc.address);
      expect(await crowdsale.wallet()).to.equal(treasury.address);
      expect(await crowdsale.fundsRaised()).to.equal(0);
      expect(await crowdsale.tokenUri()).to.equal(tokenUri);
      expect(await crowdsale.paused()).to.equal(true);

      expect(await crowdsale.getTranchesCount()).to.equal(1);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([nftPrice, supply, 0, 0, 0]);
      expect(await crowdsale.supply()).to.equal(supply);
      expect(await crowdsale.TOKEN_LIMIT_PER_PURCHASE()).to.equal(txTokenLimit);
    });
  });

  describe('#transferOwnership()', async () => {
    it('Should transfer ownership', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      expect(await crowdsale.owner()).to.equal(owner.address);

      await crowdsale.connect(owner).transferOwnership(user.address);
      expect(await crowdsale.owner()).to.equal(user.address);

      await expect(crowdsale.connect(owner).setToken(user.address)).to.be.reverted;
      await expect(crowdsale.connect(user).setToken(user.address)).not.to.be.reverted;
    });

    it('Should revert transfering ownership if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).transferOwnership(user.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#addTranche()', async () => {
    it('Should add tokens for sale', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);
      expect(await crowdsale.getTranchesCount()).to.equal(1);

      const tranche1 = { supply: 1, price: toUsdc('650') };
      await crowdsale.connect(owner).addTranche(tranche1.supply, tranche1.price);
      expect(await crowdsale.getTranchesCount()).to.equal(2);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche1.price, tranche1.supply, 0, 0, 0]);
      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect(await crowdsale.available(user.address)).to.equal(tranche1.supply);

      const tranche2 = { supply: 100, price: toUsdc('750') };
      await crowdsale.connect(owner).addTranche(tranche2.supply, tranche2.price);
      expect(await crowdsale.getTranchesCount()).to.equal(3);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche2.price, tranche2.supply, 0, 0, 0]);
      expect(await crowdsale.supply()).to.equal(tranche2.supply);
      expect(await crowdsale.available(user.address)).to.equal(tranche2.supply);
    });

    it('Should revert putting tokens on sale if amount is zero', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).addTranche(0, nftPrice)).to.be.revertedWith(
        'Invalid token amount for sale'
      );
    });

    it('Should revert putting tokens on sale if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).addTranche(supply, nftPrice)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#addWhitelistedTranche()', async () => {
    it('Should add tokens for sale with whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);
      expect(await crowdsale.getTranchesCount()).to.equal(1);

      const tranche1 = { supply, price: nftPrice };
      await crowdsale.connect(owner).addWhitelistedTranche(tranche1.supply, tranche1.price, [user.address], [10]);
      expect(await crowdsale.getTranchesCount()).to.equal(2);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche1.price, tranche1.supply - 10, 0, 10, 0]);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.isAccountWhitelisted(owner.address)).to.equal(false);
      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect(await crowdsale.available(user.address)).to.equal(tranche1.supply - 10 + 10);

      const tranche2 = { supply: 100, price: toUsdc('750') };
      await crowdsale
        .connect(owner)
        .addWhitelistedTranche(tranche2.supply, tranche2.price, [user.address, owner.address], [10, 20]);
      expect(await crowdsale.getTranchesCount()).to.equal(3);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche2.price, tranche2.supply - 30, 0, 30, 0]);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.isAccountWhitelisted(owner.address)).to.equal(true);
      expect(await crowdsale.supply()).to.equal(tranche2.supply);
      expect(await crowdsale.available(user.address)).to.equal(tranche2.supply - 30 + 10);
    });

    it('Should revert adding tokens for sale with whitelist if amount is zero', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).addWhitelistedTranche(0, nftPrice, [], [])).to.be.revertedWith(
        'Invalid token amount for sale'
      );
    });

    it('Should revert adding tokens for sale with whitelist if arrays length mismatch', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(
        crowdsale.connect(owner).addWhitelistedTranche(supply, nftPrice, [owner.address], [])
      ).to.be.revertedWith('Accounts and caps length mismatch');
    });

    it('Should revert adding tokens for sale with whitelist if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).addWhitelistedTranche(supply, nftPrice, [], [])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#addToWhitelist()', async () => {
    it('Should add accounts to whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      const tranche1 = { supply, price: nftPrice };

      await crowdsale.connect(owner).addTranche(tranche1.supply, tranche1.price);

      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect((await crowdsale.getTrancheDetails()).whitelistedSupply).to.equal(0);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(false);

      await crowdsale.connect(owner).addToWhitelist([user.address], [10]);

      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect((await crowdsale.getTrancheDetails()).whitelistedSupply).to.equal(10);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(true);
    });

    it('Should revert adding accounts to whitelist if whitelist supply exceeds total supply', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      const tranche1 = { supply, price: nftPrice };
      await crowdsale.connect(owner).addTranche(tranche1.supply, tranche1.price);

      await expect(crowdsale.connect(owner).addToWhitelist([owner.address], [tranche1.supply + 1])).to.be.revertedWith(
        'Whitelist supply exceeds total supply'
      );
    });

    it('Should revert adding accounts to whitelist if arrays length mismatch', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).addToWhitelist([owner.address], [])).to.be.revertedWith(
        'Accounts and caps length mismatch'
      );
    });

    it('Should revert adding accounts to whitelist if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).addToWhitelist([user.address], [10])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#removeFromWhitelist()', async () => {
    it('Should remove accounts from whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      const tranche1 = { supply, price: nftPrice };

      await crowdsale
        .connect(owner)
        .addWhitelistedTranche(tranche1.supply, tranche1.price, [user.address, owner.address], [10, 20]);

      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect((await crowdsale.getTrancheDetails()).whitelistedSupply).to.equal(30);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.isAccountWhitelisted(owner.address)).to.equal(true);

      await crowdsale.connect(owner).removeFromWhitelist([user.address]);

      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect((await crowdsale.getTrancheDetails()).whitelistedSupply).to.equal(20);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.isAccountWhitelisted(owner.address)).to.equal(true);
    });

    it('Should remove accounts from whitelist if tokens sold from whitelist', async () => {
      const { crowdsale, usdc, owner, user } = await loadFixture(setup);
      usdc.transferFrom.returns(true);

      const tranche1 = { supply, price: nftPrice };

      await crowdsale
        .connect(owner)
        .addWhitelistedTranche(tranche1.supply, tranche1.price, [user.address, owner.address], [10, 20]);

      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect((await crowdsale.getTrancheDetails()).whitelistedSupply).to.equal(30);

      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(user).buyTokens(5);
      await crowdsale.connect(owner).removeFromWhitelist([user.address]);

      expect(await crowdsale.supply()).to.equal(tranche1.supply);
      expect((await crowdsale.getTrancheDetails()).whitelistedSupply).to.equal(25);
      expect(await crowdsale.isAccountWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.isAccountWhitelisted(owner.address)).to.equal(true);
    });

    it('Should revert removing accounts from whitelist if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).addToWhitelist([user.address], [10])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#buyTokens()', async () => {
    const tranche1 = { supply, price: nftPrice };
    let crowdsale: Crowdsale;
    let usdc: FakeContract<USDC>;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    before(async () => {
      ({ crowdsale, usdc, owner, user } = await loadFixture(setup));
      await crowdsale.connect(owner).unpause();
      await crowdsale.connect(owner).addTranche(tranche1.supply, tranche1.price);

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      usdc.transferFrom.returns(true);
    });

    [1, txTokenLimit].forEach((tokenAmount) => {
      it(`Should buy tokens if no whitelist [amount=${tokenAmount}]`, async () => {
        const expectedFundsRaised = tranche1.price.mul(tokenAmount);

        await expect(crowdsale.connect(user).buyTokens(tokenAmount))
          .to.emit(crowdsale, 'TokensPurchased')
          .withArgs(user.address, expectedFundsRaised, tokenAmount);

        expect(await crowdsale.sold()).to.equal(tokenAmount);
        expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche1.price, tranche1.supply, tokenAmount, 0, 0]);
        expect(await crowdsale.fundsRaised()).to.equal(expectedFundsRaised);
      });
    });

    it('Should buy tokens if multiple tranches', async () => {
      const amount1 = 1;
      let expectedFundsRaised = tranche1.price.mul(amount1);
      await crowdsale.connect(user).buyTokens(amount1);

      expect(await crowdsale.sold()).to.equal(amount1);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche1.price, tranche1.supply, amount1, 0, 0]);
      expect(await crowdsale.fundsRaised()).to.equal(expectedFundsRaised);

      const tranche2 = { supply: 500, price: toUsdc('750') };
      const amount2 = 100;
      expectedFundsRaised = expectedFundsRaised.add(tranche2.price.mul(amount2));

      await crowdsale.connect(owner).addTranche(tranche2.supply, tranche2.price);
      await crowdsale.connect(user).buyTokens(amount2);

      expect(await crowdsale.sold()).to.equal(amount2);
      expect(await crowdsale.getTrancheDetails()).to.deep.equal([tranche2.price, tranche2.supply, amount2, 0, 0]);
      expect(await crowdsale.fundsRaised()).to.equal(expectedFundsRaised);
    });

    it('Should buy tokens if user is whitelisted', async () => {
      const tranche = { supply: 100, price: toUsdc('750') };
      const cap = 10;
      await crowdsale.connect(owner).addWhitelistedTranche(tranche.supply, tranche.price, [user.address], [cap]);

      const amount = tranche.supply;
      await crowdsale.connect(user).buyTokens(amount);

      expect(await crowdsale.sold()).to.equal(amount);
      expect((await crowdsale.getTrancheDetails()).whitelistedSold).to.equal(cap);
    });

    it('Should revert buying tokens if claimed amount exceeds public pool and user is not whitelisted', async () => {
      const tranche = { supply: 100, price: toUsdc('750') };
      const cap = 10;
      await crowdsale.connect(owner).addWhitelistedTranche(tranche.supply, tranche.price, [user.address], [cap]);

      const amount = tranche.supply;
      await expect(crowdsale.connect(owner).buyTokens(amount)).to.be.revertedWith('Too many tokens claimed');
    });

    it('Should revert buying tokens exceeding limit', async () => {
      const amount = txTokenLimit + 1;

      await expect(crowdsale.connect(user).buyTokens(amount)).to.be.revertedWith('Too many tokens claimed');
    });

    it('Should revert buying tokens if crowdsale is paused', async () => {
      await expect(crowdsale.buyTokens(1)).not.to.be.reverted;

      await crowdsale.connect(owner).pause();
      await expect(crowdsale.buyTokens(1)).to.be.revertedWith('Pausable: paused');
    });

    it('Should revert buying tokens if amount exceeds the sale supply', async () => {
      await expect(crowdsale.buyTokens(supply + 1)).to.be.revertedWith('Too many tokens claimed');
    });

    it('Should revert buying tokens if amount is zero', async () => {
      await expect(crowdsale.buyTokens(0)).to.be.revertedWith('Invalid token amount claimed');
    });

    it('Should revert buying tokens if currency transfer fails', async () => {
      usdc.transferFrom.returns(false);

      await expect(crowdsale.buyTokens(1)).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
    });
  });

  describe('#setWallet()', async () => {
    it('Should change fundraising wallet address', async () => {
      const { crowdsale, owner, treasury } = await loadFixture(setup);

      expect(await crowdsale.wallet()).to.equal(treasury.address);

      await crowdsale.connect(owner).setWallet(owner.address);
      expect(await crowdsale.wallet()).to.equal(owner.address);
    });

    it('Should revert changing fundraising wallet if new one is zero address', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).setWallet(constants.AddressZero)).to.be.revertedWith(
        'Wallet is the zero address'
      );
    });

    it('Should revert changing fundraising wallet address if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).setWallet(user.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#setCurrency()', async () => {
    it('Should change currency address', async () => {
      const { crowdsale, usdc, owner } = await loadFixture(setup);

      expect(await crowdsale.currency()).to.equal(usdc.address);

      await crowdsale.connect(owner).setCurrency(owner.address);
      expect(await crowdsale.currency()).to.equal(owner.address);
    });

    it('Should revert changing currency if new one is zero address', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).setCurrency(constants.AddressZero)).to.be.revertedWith(
        'Currency is the zero address'
      );
    });

    it('Should revert changing currency address if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).setCurrency(user.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#setToken()', async () => {
    it('Should change token address', async () => {
      const { crowdsale, genesisNft, owner } = await loadFixture(setup);

      expect(await crowdsale.token()).to.equal(genesisNft.address);

      await crowdsale.connect(owner).setToken(owner.address);
      expect(await crowdsale.token()).to.equal(owner.address);
    });

    it('Should revert changing token if new one is zero address', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).setToken(constants.AddressZero)).to.be.revertedWith(
        'Token is the zero address'
      );
    });

    it('Should revert changing token address if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).setToken(user.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#setTokenUri()', async () => {
    const newTokenUri = 'ipfs;//new-token-uri.json';

    it('Should change token URI', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      expect(await crowdsale.tokenUri()).to.equal(tokenUri);

      await crowdsale.connect(owner).setTokenUri(newTokenUri);
      expect(await crowdsale.tokenUri()).to.equal(newTokenUri);
    });

    it('Should revert changing token address if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).setTokenUri(newTokenUri)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#pause() / #unpause()', async () => {
    it('Should pause and unpause crowdsale', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      expect(await crowdsale.paused()).to.equal(true);

      await crowdsale.connect(owner).unpause();
      expect(await crowdsale.paused()).to.equal(false);

      await crowdsale.connect(owner).pause();
      expect(await crowdsale.paused()).to.equal(true);
    });

    it('Should revert pausing and unpausing crowdsale if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).unpause()).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(crowdsale.connect(user).pause()).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
