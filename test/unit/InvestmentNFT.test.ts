import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { IERC721EnumerableUpgradeable__factory, IInvestmentNFT__factory, InvestmentNFT } from '../../typechain-types';
import { getInterfaceIdWithBase, toUsdc } from '../utils';

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
  const minimumValue = toUsdc('50');

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let minter: SignerWithAddress;
  let restorer: SnapshotRestorer;
  let royaltyWallet: SignerWithAddress;
  let investmentNft: InvestmentNFT;

  const royalty = 650;

  const deployFixture = async () => {
    const [deployer, owner, user, minter, royaltyWallet] = await ethers.getSigners();
    const minimumValue = toUsdc('50');

    const investmentNft: InvestmentNFT = await deployProxy(
      'InvestmentNFT',
      [name, symbol, owner.address, royaltyWallet.address, royalty, minimumValue],
      deployer
    );
    await investmentNft.connect(owner).addMinter(minter.address);

    return { investmentNft, deployer, owner, user, minter, royaltyWallet, royalty };
  };

  describe('Deployment', () => {
    it('Should deploy and return initial parameters', async () => {
      const { investmentNft, deployer, user, minter, royaltyWallet } = await loadFixture(deployFixture);

      expect(await investmentNft.name()).to.equal(name);
      expect(await investmentNft.symbol()).to.equal(symbol);
      expect(await investmentNft.balanceOf(deployer.address)).to.equal(0);
      expect(await investmentNft.isMinter(minter.address)).to.equal(true);
      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(0);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(0);
      expect(await investmentNft.getInvestors()).to.deep.equal([]);
      expect(await investmentNft.supportsInterface(IInvestmentNFTId)).to.equal(true);
      expect(await investmentNft.royaltyInfo(0, 1000)).to.deep.equal([royaltyWallet.address, 65]);
      expect(await investmentNft.minimumValue()).to.be.equal(minimumValue);
    });

    it('Should revert deployment if owner is zero address', async () => {
      const { investmentNft, royaltyWallet, royalty } = await loadFixture(deployFixture);
      const [deployer] = await ethers.getSigners();

      await expect(
        deployProxy(
          'InvestmentNFT',
          [name, symbol, constants.AddressZero, royaltyWallet.address, royalty, minimumValue],
          deployer
        )
      ).to.be.revertedWithCustomError(investmentNft, 'OwnablePausable__OwnerAccountZeroAddress');
    });

    it('Should revert deployment if invalid royalty parameters', async () => {
      const { owner, royaltyWallet, deployer } = await loadFixture(deployFixture);

      await expect(
        deployProxy(
          'InvestmentNFT',
          [name, symbol, owner.address, royaltyWallet.address, 10001, minimumValue],
          deployer
        )
      ).to.be.revertedWith('ERC2981: royalty fee will exceed salePrice');
    });

    it('Should revert when initialize again', async () => {
      const { owner, investmentNft, royaltyWallet, royalty } = await loadFixture(deployFixture);

      await expect(
        investmentNft.initialize(name, symbol, owner.address, royaltyWallet.address, royalty, minimumValue)
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  describe('#mint()', () => {
    it('Should mint token', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      const tokenId = 0;
      const amount = toUsdc('50');

      await expect(investmentNft.connect(minter).mint(user.address, amount, tokenUri))
        .to.emit(investmentNft, 'Transfer')
        .withArgs(constants.AddressZero, user.address, tokenId);

      expect(await investmentNft.balanceOf(user.address)).to.equal(1);
      expect(await investmentNft.ownerOf(tokenId)).to.equal(user.address);
      expect(await investmentNft.tokenValue(tokenId)).to.equal(amount);
    });

    it('Should revert minting if a value less than minimum', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await expect(
        investmentNft.connect(minter).mint(user.address, minimumValue.sub(1), tokenUri)
      ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__InvestmentTooLow');
    });

    it('Should revert minting if not minter', async () => {
      const { investmentNft, user } = await loadFixture(deployFixture);

      await expect(
        investmentNft.connect(user).mint(user.address, toUsdc('50'), tokenUri)
      ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__NotMinter');
    });

    it('Should revert minting if contract paused', async () => {
      const { investmentNft, owner, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(owner).pause();
      await expect(investmentNft.connect(minter).mint(user.address, toUsdc('50'), tokenUri)).to.be.revertedWith(
        'Pausable: paused'
      );

      await investmentNft.connect(owner).unpause();
      await expect(investmentNft.connect(minter).mint(user.address, toUsdc('50'), tokenUri)).not.to.be.reverted;
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
      const tokenValue = toUsdc('120');

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
        await expect(investmentNft.connect(user).split(tokenId, [toUsdc('50'), toUsdc('70')], [tokenUri, tokenUri]))
          .to.emit(investmentNft, 'TokenSplitted')
          .withArgs(user.address, tokenId);

        await expect(investmentNft.ownerOf(tokenId)).to.be.revertedWith('ERC721: invalid token ID');
        expect(await investmentNft.balanceOf(user.address)).to.equal(2);
        expect(await investmentNft.ownerOf(1)).to.equal(user.address);
        expect(await investmentNft.ownerOf(2)).to.equal(user.address);
        expect(await investmentNft.tokenValue(1)).to.equal(toUsdc('50'));
        expect(await investmentNft.tokenValue(2)).to.equal(toUsdc('70'));
      });

      it('Should revert splitting NFT if caller is not token owner', async () => {
        await expect(
          investmentNft.connect(minter).split(tokenId, [toUsdc('50'), toUsdc('70')], [tokenUri, tokenUri])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__NotTokenOwner');
      });

      it('Should revert splitting NFT if values length differs from token URIs length', async () => {
        await expect(
          investmentNft.connect(user).split(tokenId, [toUsdc('50'), toUsdc('70')], [tokenUri])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__TokenUrisAndValuesLengthsMismatch');
      });

      it('Should revert splitting NFT if new value differs from the old one', async () => {
        await expect(
          investmentNft
            .connect(user)
            .split(tokenId, [toUsdc('50'), toUsdc('50'), toUsdc('50')], [tokenUri, tokenUri, tokenUri])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__TokenValuesBeforeAfterSplitMismatch');
      });

      it('Should revert splitting NFT if contract paused', async () => {
        await investmentNft.connect(owner).pause();
        await expect(
          investmentNft.connect(user).split(tokenId, [toUsdc('50'), toUsdc('70')], [tokenUri, tokenUri])
        ).to.be.revertedWith('Pausable: paused');
      });

      it('Should revert splitting NFT if limit for splitting is reached', async () => {
        await expect(
          investmentNft
            .connect(user)
            .split(
              tokenId,
              [
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50'),
                toUsdc('50')
              ],
              [
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri,
                tokenUri
              ]
            )
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__SplitLimitExceeded');
      });

      it('Should revert splitting NFT if a value less than minimum', async () => {
        await expect(
          investmentNft.connect(user).split(tokenId, [minimumValue.sub(1), toUsdc('71')], [tokenUri, tokenUri])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__InvestmentTooLow');
      });
    });
  });

  describe('Investment value getters', () => {
    const tokenValue = toUsdc('50');

    it('Should return investment value', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue);
    });

    it('Should return investment value if multiple mints', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);

      const tokenValue2 = toUsdc('50');
      await investmentNft.connect(minter).mint(user.address, tokenValue2, tokenUri);
      await investmentNft.connect(minter).mint(minter.address, tokenValue2, tokenUri);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue.add(tokenValue2));
      expect(await investmentNft.getInvestmentValue(minter.address)).to.equal(tokenValue2);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue.add(tokenValue2.mul(2)));
    });

    it('Should return investment value from specific block', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(minter).mint(user.address, tokenValue, tokenUri);
      const blockNumber = await ethers.provider.getBlockNumber();

      const tokenValue2 = toUsdc('50');
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

      const tokenValue2 = toUsdc('50');
      const totalInvestmentValue = tokenValue.add(tokenValue2);
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
    const tokenValue = toUsdc('50');

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
      await expect(investmentNft.connect(owner).addMinter(user.address)).to.be.revertedWithCustomError(
        investmentNft,
        'InvestmentNft__AlreadyMinter'
      );
    });

    it('Should revert removing minter if does not exist', async () => {
      const { investmentNft, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(owner).removeMinter(minter.address);
      await expect(investmentNft.connect(owner).removeMinter(minter.address)).to.be.revertedWithCustomError(
        investmentNft,
        'InvestmentNft__NotMinter'
      );
    });
  });
});
