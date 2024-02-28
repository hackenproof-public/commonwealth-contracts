import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, mineUpTo, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { Crowdsale, GenesisNFTV1, USDC } from '../../typechain-types';
import { CrowdsalePhase } from '../types';
import { toUsdc } from '../utils';

describe('Crowdsale unit tests', () => {
  let startBlock: number;
  const nftPrice = toUsdc('1000');
  const tranchesCount = 9;
  const whitelistDuration = 55;
  const publicDuration = 77;
  const durationBetweenTranches = 200;
  const maxKolTokensToBuy = 5;
  const trancheSupply = 999;
  const someTrancheNumber = 3;

  let restorer: SnapshotRestorer;

  const setup = async () => {
    startBlock = (await ethers.provider.getBlockNumber()) + 10;

    const [deployer, owner, user, treasury, royaltyWallet] = await ethers.getSigners();

    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const genesisNft: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
    const crowdsale: Crowdsale = await deployProxy(
      'Crowdsale',
      [
        owner.address,
        treasury.address,
        usdc.address,
        genesisNft.address,
        startBlock,
        tranchesCount,
        whitelistDuration,
        publicDuration,
        durationBetweenTranches
      ],
      deployer
    );

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
      expect(await crowdsale.paused()).to.equal(true);

      expect(await crowdsale.getTranchesCount()).to.equal(tranchesCount);
      expect(await crowdsale.getCurrentTrancheDetails()).to.deep.equal([
        [0, 0, 0, 0, 0, 0, 0],
        CrowdsalePhase.Inactive,
        0
      ]);
      expect(await crowdsale.supply()).to.equal(0);
    });

    it('Should deploy with no tranches', async () => {
      const [deployer, owner, treasury] = await ethers.getSigners();

      const usdc: FakeContract<USDC> = await smock.fake('USDC');
      const genesisNft: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
      const crowdsale: Crowdsale = await deployProxy(
        'Crowdsale',
        [
          owner.address,
          treasury.address,
          usdc.address,
          genesisNft.address,
          startBlock,
          0,
          whitelistDuration,
          publicDuration,
          durationBetweenTranches
        ],
        deployer
      );

      expect(await crowdsale.getTranchesCount()).to.equal(0);
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

      const supply = await crowdsale.TRANCHE_SUPPLY();
      const publicPrice = await crowdsale.PUBLIC_PRICE();
      const blockNumber = await ethers.provider.getBlockNumber();

      const tranche1 = {
        start: blockNumber + 10 + durationBetweenTranches * (tranchesCount + 1),
        kolPrice: toUsdc('650')
      };
      await crowdsale.connect(owner).addTranche(tranche1.start, tranche1.kolPrice);
      expect(await crowdsale.getTranchesCount()).to.equal(10);

      await mineUpTo(tranche1.start - 1);
      expect((await crowdsale.getCurrentTrancheDetails()).phase).to.equal(CrowdsalePhase.Inactive);
      expect(await crowdsale.supply()).to.equal(0);
      expect(await crowdsale.available(user.address)).to.equal(0);

      await mineUpTo(tranche1.start);
      expect(await crowdsale.getCurrentTrancheDetails()).to.deep.equal([
        [tranche1.start, supply, tranche1.kolPrice, publicPrice, 0, 0, 0],
        CrowdsalePhase.Whitelisted,
        tranchesCount + 1
      ]);
      expect(await crowdsale.supply()).to.equal(supply);
      expect(await crowdsale.available(user.address)).to.equal(0);

      await mineUpTo(tranche1.start + whitelistDuration);
      expect(await crowdsale.getCurrentTrancheDetails()).to.deep.equal([
        [tranche1.start, supply, tranche1.kolPrice, publicPrice, 0, 0, 0],
        CrowdsalePhase.Public,
        tranchesCount + 1
      ]);
      expect(await crowdsale.supply()).to.equal(supply);

      await mineUpTo(tranche1.start + whitelistDuration + publicDuration);
      expect((await crowdsale.getCurrentTrancheDetails()).phase).to.equal(CrowdsalePhase.Inactive);
      expect(await crowdsale.supply()).to.equal(0);
      expect(await crowdsale.available(user.address)).to.equal(0);
    });

    it('Should revert putting tokens on sale if overlaps with other tranches', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await expect(crowdsale.connect(owner).addTranche(startBlock + 1, 0)).to.be.revertedWith(
        'Tranche start cannot overlap another ones'
      );
    });

    it('Should revert putting tokens on sale if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).addTranche(9999999999, nftPrice)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#addToWhitelist()', async () => {
    it('Should add accounts to free mints whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      expect(await crowdsale.isAccountFreeMintsWhitelisted(user.address)).to.equal(false);

      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);

      expect(await crowdsale.isAccountFreeMintsWhitelisted(user.address)).to.equal(true);
    });

    it('Should add accounts to kol mints whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      expect(await crowdsale.isAccountKolWhitelisted(user.address)).to.equal(false);

      await crowdsale.connect(owner).addToKolWhitelist([user.address]);

      expect(await crowdsale.isAccountKolWhitelisted(user.address)).to.equal(true);
    });

    it('Should append to free mint whitelist instead of overwriting', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      expect(await crowdsale.isAccountFreeMintsWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.isAccountKolWhitelisted(user.address)).to.equal(false);

      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);

      await mineUpTo(startBlock + 1);
      expect(await crowdsale.connect(user).isAccountFreeMintsWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.connect(user).isAccountKolWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.connect(user).available(user.address)).to.equal(3);
    });

    it('Should keep kole whitelist max when overwriting', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      expect(await crowdsale.isAccountFreeMintsWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.isAccountKolWhitelisted(user.address)).to.equal(false);

      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);

      await mineUpTo(startBlock + 1);
      expect(await crowdsale.connect(user).isAccountFreeMintsWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.connect(user).isAccountKolWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.connect(user).available(user.address)).to.equal(trancheSupply);
    });

    it('Should revert adding accounts to whitelist if not owner', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).addToFreeMintsWhitelist([user.address])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#removeFromWhitelist()', async () => {
    it('Should remove accounts from free mint whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address, owner.address]);

      expect(await crowdsale.isAccountFreeMintsWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.isAccountFreeMintsWhitelisted(owner.address)).to.equal(true);

      await crowdsale.connect(owner).removeFromFreeMintsWhitelist([user.address]);

      expect(await crowdsale.isAccountFreeMintsWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.isAccountFreeMintsWhitelisted(owner.address)).to.equal(true);
    });

    it('Should remove accounts from kol whitelist', async () => {
      const { crowdsale, owner, user } = await loadFixture(setup);

      await crowdsale.connect(owner).addToKolWhitelist([user.address, owner.address]);

      expect(await crowdsale.isAccountKolWhitelisted(user.address)).to.equal(true);
      expect(await crowdsale.isAccountKolWhitelisted(owner.address)).to.equal(true);

      await crowdsale.connect(owner).removeFromKolWhitelist([user.address]);

      expect(await crowdsale.isAccountKolWhitelisted(user.address)).to.equal(false);
      expect(await crowdsale.isAccountKolWhitelisted(owner.address)).to.equal(true);
    });
  });

  describe('#buyTokens()', async () => {
    let crowdsale: Crowdsale;
    let usdc: FakeContract<USDC>;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;

    before(async () => {
      ({ crowdsale, usdc, owner, user } = await loadFixture(setup));
      await crowdsale.connect(owner).unpause();

      restorer = await takeSnapshot();
    });

    beforeEach(async () => {
      await restorer.restore();

      usdc.transferFrom.returns(true);
    });

    [1, 55, 999].forEach((tokenAmount) => {
      it(`Should buy tokens in public phase [amount=${tokenAmount}]`, async () => {
        const expectedFundsRaised = (await crowdsale.PUBLIC_PRICE()).mul(tokenAmount);

        await mineUpTo(startBlock + whitelistDuration + 1);

        await expect(crowdsale.connect(user).buyTokens(tokenAmount))
          .to.emit(crowdsale, 'TokensPurchased')
          .withArgs(user.address, expectedFundsRaised, tokenAmount);

        expect(await crowdsale.sold()).to.equal(tokenAmount);
        expect(await crowdsale.fundsRaised()).to.equal(expectedFundsRaised);
      });
    });

    it('Should buy kol tokens', async () => {
      await mineUpTo(startBlock + 1);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);

      await crowdsale.connect(user).buyTokens(maxKolTokensToBuy);

      expect(await crowdsale.sold()).to.equal(maxKolTokensToBuy);
      expect((await crowdsale.getCurrentTrancheDetails()).details.kolSold).to.equal(maxKolTokensToBuy);
      expect(await crowdsale.connect(user).boughtCountKol(user.address)).to.equal(maxKolTokensToBuy);
    });

    it('Should buy free mint tokens', async () => {
      await mineUpTo(startBlock + 1);
      await crowdsale.connect(owner).addToFreeMintsWhitelist([user.address]);

      await crowdsale.connect(user).buyTokens(1);

      expect(await crowdsale.sold()).to.equal(1);
      expect((await crowdsale.getCurrentTrancheDetails()).details.freeMintsSold).to.equal(1);
      expect(await crowdsale.connect(user).boughtCountFreeMint(user.address)).to.equal(1);
    });

    it('Should revert buying KOL tokens if claimed amount exceeds max', async () => {
      await mineUpTo(startBlock + 1);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);

      await expect(crowdsale.connect(owner).buyTokens(maxKolTokensToBuy + 1)).to.be.revertedWith(
        'Too many tokens claimed'
      );
    });

    it('Should revert buying tokens if crowdsale is paused', async () => {
      await mineUpTo(startBlock + 1);
      await crowdsale.connect(owner).addToKolWhitelist([user.address]);
      await expect(crowdsale.connect(user).buyTokens(1)).not.to.be.reverted;

      await crowdsale.connect(owner).pause();
      await expect(crowdsale.connect(user).buyTokens(1)).to.be.revertedWith('Pausable: paused');
    });

    it('Should revert buying tokens if amount exceeds the sale supply', async () => {
      await mineUpTo(startBlock + whitelistDuration + 1);

      await expect(crowdsale.connect(user).buyTokens(trancheSupply + 1)).to.be.revertedWith('Too many tokens claimed');
    });

    it('Should revert buying tokens if amount is zero', async () => {
      await expect(crowdsale.buyTokens(0)).to.be.revertedWith('Invalid token amount claimed');
    });

    it('Should revert buying tokens if currency transfer fails', async () => {
      await mineUpTo(startBlock + whitelistDuration + 1);
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

  describe('#updateTrancheStartBlock', async () => {
    it('Should not allow non-owner to update tranche start block', async () => {
      const { crowdsale, user } = await loadFixture(setup);

      await expect(crowdsale.connect(user).updateTrancheStartBlock(0, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should not allow to update tranche start block to one in the past', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      await mineUpTo(startBlock);

      await expect(crowdsale.connect(owner).updateTrancheStartBlock(3, startBlock - 1)).to.be.revertedWith(
        'Cannot update start block to one in the past'
      );
    });

    it('Should update tranche start block', async () => {
      const { crowdsale, owner } = await loadFixture(setup);

      const oldTranche = await crowdsale.tranches(someTrancheNumber);
      await mineUpTo(startBlock);
      await crowdsale.connect(owner).updateTrancheStartBlock(someTrancheNumber, startBlock + 1);
      const newTranche = await crowdsale.tranches(someTrancheNumber);

      expect(newTranche.start).to.equal(startBlock + 1);
      expect(newTranche.supply).to.equal(oldTranche.supply);
      expect(newTranche.kolPrice).to.equal(oldTranche.kolPrice);
      expect(newTranche.publicPrice).to.equal(oldTranche.publicPrice);
      expect(newTranche.freeMintsSold).to.equal(oldTranche.freeMintsSold);
      expect(newTranche.kolSold).to.equal(oldTranche.kolSold);
      expect(newTranche.publicSold).to.equal(oldTranche.publicSold);
    });
  });
});
