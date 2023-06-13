import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { IERC721EnumerableUpgradeable__factory, IInvestmentNFT__factory, InvestmentNFT } from '../../typechain-types';
import { getInterfaceIdWithBase } from '../utils';

describe('Investment NFT unit tests', () => {
  const tokenUri = 'ipfs://token-uri';
  const IInvestmentNFTId = utils.arrayify(
    getInterfaceIdWithBase([
      IInvestmentNFT__factory.createInterface(),
      IERC721EnumerableUpgradeable__factory.createInterface()
    ])
  );
  const name = 'Common Wealth Investment NFT';
  const symbol = 'CWI';

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let minter: SignerWithAddress;
  let restorer: SnapshotRestorer;
  let investmentNft: InvestmentNFT;

  const deployFixture = async () => {
    const [deployer, owner, user, minter] = await ethers.getSigners();

    const investmentNft: InvestmentNFT = await deployProxy('InvestmentNFT', [name, symbol, owner.address], deployer);
    await investmentNft.connect(owner).addMinter(minter.address);

    return { investmentNft, deployer, owner, user, minter };
  };

  describe('Deployment', () => {
    it('Should deploy and return initial parameters', async () => {
      const { investmentNft, deployer, user, minter } = await loadFixture(deployFixture);

      expect(await investmentNft.name()).to.equal(name);
      expect(await investmentNft.symbol()).to.equal(symbol);
      expect(await investmentNft.balanceOf(deployer.address)).to.equal(0);
      expect(await investmentNft.isMinter(minter.address)).to.equal(true);
      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(0);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(0);
      expect(await investmentNft.getInvestors()).to.deep.equal([]);
      expect(await investmentNft.supportsInterface(IInvestmentNFTId)).to.equal(true);
    });

    it('Should revert deployment if owner is zero address', async () => {
      const [deployer] = await ethers.getSigners();

      await expect(deployProxy('InvestmentNFT', [name, symbol, constants.AddressZero], deployer)).to.be.revertedWith(
        'Owner is zero address'
      );
    });
  });

  describe('#mint()', () => {
    it('Should mint token', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      const tokenId = 0;
      const amount = 1000;

      await expect(investmentNft.connect(minter).mint(user.address, amount, tokenUri))
        .to.emit(investmentNft, 'Transfer')
        .withArgs(constants.AddressZero, user.address, tokenId);

      expect(await investmentNft.balanceOf(user.address)).to.equal(1);
      expect(await investmentNft.ownerOf(tokenId)).to.equal(user.address);
      expect(await investmentNft.tokenValue(tokenId)).to.equal(amount);
    });

    it('Should revert minting if not minter', async () => {
      const { investmentNft, user } = await loadFixture(deployFixture);

      await expect(investmentNft.connect(user).mint(user.address, 1000, tokenUri)).to.be.revertedWith(
        'Account does not have minter rights'
      );
    });

    it('Should revert minting if contract paused', async () => {
      const { investmentNft, owner, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(owner).pause();
      await expect(investmentNft.connect(minter).mint(user.address, 1000, tokenUri)).to.be.revertedWith(
        'Pausable: paused'
      );

      await investmentNft.connect(owner).unpause();
      await expect(investmentNft.connect(minter).mint(user.address, 1000, tokenUri)).not.to.be.reverted;
    });
  });

  describe('#split()', () => {
    it('Should revert splitting if token does not exist', async () => {
      ({ investmentNft, user } = await loadFixture(deployFixture));

      await expect(investmentNft.connect(user).split(0, [0, 0], [tokenUri, tokenUri])).to.be.revertedWith(
        'ERC721: invalid token ID'
      );
    });

    describe('when token exists', async () => {
      const tokenId = 0;
      const tokenValue = 1000;

      before(async () => {
        ({ investmentNft, owner, user, minter } = await loadFixture(deployFixture));

        await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);
        expect(await investmentNft.ownerOf(tokenId)).to.equal(user.address);

        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should split NFT', async () => {
        await expect(investmentNft.connect(user).split(tokenId, [300, 700], [tokenUri, tokenUri]))
          .to.emit(investmentNft, 'TokenSplitted')
          .withArgs(user.address, tokenId);

        await expect(investmentNft.ownerOf(tokenId)).to.be.revertedWith('ERC721: invalid token ID');
        expect(await investmentNft.balanceOf(user.address)).to.equal(2);
        expect(await investmentNft.ownerOf(1)).to.equal(user.address);
        expect(await investmentNft.ownerOf(2)).to.equal(user.address);
        expect(await investmentNft.tokenValue(1)).to.equal(300);
        expect(await investmentNft.tokenValue(2)).to.equal(700);
      });

      it('Should revert splitting NFT if caller is not token owner', async () => {
        await expect(investmentNft.connect(minter).split(tokenId, [300, 700], [tokenUri, tokenUri])).to.be.revertedWith(
          'Caller is not a token owner'
        );
      });

      it('Should revert splitting NFT if values length differs from token URIs length', async () => {
        await expect(investmentNft.connect(user).split(tokenId, [300, 700], [tokenUri])).to.be.revertedWith(
          'Values and tokens URIs length mismatch'
        );
      });

      it('Should revert splitting NFT if new value differs from the old one', async () => {
        await expect(
          investmentNft.connect(user).split(tokenId, [333, 333, 333], [tokenUri, tokenUri, tokenUri])
        ).to.be.revertedWith('Tokens value before and after split do not match');
      });

      it('Should revert splitting NFT if contract paused', async () => {
        await investmentNft.connect(owner).pause();
        await expect(investmentNft.connect(user).split(tokenId, [300, 700], [tokenUri, tokenUri])).to.be.revertedWith(
          'Pausable: paused'
        );
      });
    });
  });

  describe('Investment value getters', () => {
    const tokenValue = 1000;

    it('Should return investment value', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue);
    });

    it('Should return investment value if multiple mints', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);

      const tokenValue2 = 100;
      await investmentNft.connect(minter).mint(user.address, tokenValue2, tokenUri);
      await investmentNft.connect(minter).mint(minter.address, tokenValue2, tokenUri);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue + tokenValue2);
      expect(await investmentNft.getInvestmentValue(minter.address)).to.equal(tokenValue2);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue + 2 * tokenValue2);
    });

    it('Should return investment value from specific block', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);
      const blockNumber = await ethers.provider.getBlockNumber();

      const tokenValue2 = 100;
      const expectedInvestmentInBlock = tokenValue;
      await investmentNft.connect(minter).mint(user.address, tokenValue2, tokenUri);

      expect(await investmentNft.getPastInvestmentValue(user.address, blockNumber)).to.equal(expectedInvestmentInBlock);
      expect(await investmentNft.getPastTotalInvestmentValue(blockNumber)).to.equal(expectedInvestmentInBlock);
      expect(await investmentNft.getPastParticipation(user.address, blockNumber)).to.deep.equal([
        expectedInvestmentInBlock,
        expectedInvestmentInBlock
      ]);
    });

    it('Should return investment value from specific block after transfer', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);

      const tokenValue2 = 100;
      const totalInvestmentValue = tokenValue + tokenValue2;
      await investmentNft.connect(minter).mint(user.address, tokenValue2, tokenUri);

      const blockNumber = await ethers.provider.getBlockNumber();

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(totalInvestmentValue);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(totalInvestmentValue);
      expect(await investmentNft.getParticipation(user.address)).to.deep.equal([
        totalInvestmentValue,
        totalInvestmentValue
      ]);

      await investmentNft.connect(user).transferFrom(user.address, minter.address, 1);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue);
      expect(await investmentNft.getInvestmentValue(minter.address)).to.equal(tokenValue2);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(totalInvestmentValue);
      expect(await investmentNft.getParticipation(user.address)).to.deep.equal([tokenValue, totalInvestmentValue]);
      expect(await investmentNft.getParticipation(minter.address)).to.deep.equal([tokenValue2, totalInvestmentValue]);

      expect(await investmentNft.getPastInvestmentValue(user.address, blockNumber)).to.equal(totalInvestmentValue);
      expect(await investmentNft.getPastTotalInvestmentValue(blockNumber)).to.equal(totalInvestmentValue);
      expect(await investmentNft.getPastParticipation(user.address, blockNumber)).to.deep.equal([
        totalInvestmentValue,
        totalInvestmentValue
      ]);
    });
  });

  describe('#setTokenUri()', () => {
    const tokenValue = 1000;

    it('Should set new token URI', async () => {
      const { investmentNft, owner, minter } = await loadFixture(deployFixture);
      const tokenId = 0;
      const newTokenUri = 'ipfs://new-token-uri';

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);
      expect(await investmentNft.tokenURI(tokenId)).to.equal(tokenUri);

      await investmentNft.connect(owner).setTokenUri(tokenId, newTokenUri);
      expect(await investmentNft.tokenURI(tokenId)).to.equal(newTokenUri);
    });

    it('Should revert setting token URI if not owner', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);
      const newTokenUri = 'ipfs://new-token-uri';

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);
      await expect(investmentNft.connect(user).setTokenUri(0, newTokenUri)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#addMinter() / #removeMinter()', () => {
    it('Should add new minter', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);

      expect(await investmentNft.isMinter(user.address)).to.equal(false);

      await expect(investmentNft.connect(owner).addMinter(user.address))
        .to.emit(investmentNft, 'MinterAdded')
        .withArgs(owner.address, user.address);
      expect(await investmentNft.isMinter(user.address)).to.equal(true);
    });

    it('Should remove minter', async () => {
      const { investmentNft, owner, minter } = await loadFixture(deployFixture);

      expect(await investmentNft.isMinter(minter.address)).to.equal(true);

      await investmentNft.connect(owner).removeMinter(minter.address);
      expect(await investmentNft.isMinter(minter.address)).to.equal(false);
    });

    it('Should revert adding and removing minter if not owner', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await expect(investmentNft.connect(minter).addMinter(user.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(investmentNft.connect(minter).removeMinter(minter.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert adding minter if already exists', async () => {
      const { investmentNft, user } = await loadFixture(deployFixture);

      await investmentNft.connect(owner).addMinter(user.address);
      await expect(investmentNft.connect(owner).addMinter(user.address)).to.be.revertedWith(
        'Account already has minter rights'
      );
    });

    it('Should revert removing minter if does not exist', async () => {
      const { investmentNft, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(owner).removeMinter(minter.address);
      await expect(investmentNft.connect(owner).removeMinter(minter.address)).to.be.revertedWith(
        'Account does not have minter rights'
      );
    });
  });
});
