import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import {
  IERC721EnumerableUpgradeable__factory,
  IInvestmentNFT__factory,
  InvestmentNFT,
  Marketplace
} from '../../typechain-types';
import { getInterfaceIdWithBase, toUsdc, toWlth } from '../utils';

describe('Investment NFT unit tests', () => {
  const IInvestmentNFTId = utils.arrayify(
    getInterfaceIdWithBase([
      IInvestmentNFT__factory.createInterface(),
      IERC721EnumerableUpgradeable__factory.createInterface()
    ])
  );
  const name = 'Common Wealth Investment NFT';
  const symbol = 'CWI';
  const minimumValue = toUsdc('50');

  const mName = 'Name';
  const description = 'Description';
  const image = 'Image';
  const externalUrl = 'External Url';

  const metadata = {
    name: mName,
    description: description,
    image: image,
    externalUrl: externalUrl
  };

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

    const marketplace: FakeContract<Marketplace> = await smock.fake('Marketplace');

    const investmentNft: InvestmentNFT = await deployProxy(
      'InvestmentNFT',
      [name, symbol, owner.address, royaltyWallet.address, royalty, minimumValue, metadata, marketplace.address],
      deployer
    );
    await investmentNft.connect(owner).addMinter(minter.address);
    await investmentNft.connect(owner).setMarketplaceAddress(marketplace.address);

    return { investmentNft, deployer, owner, user, minter, royaltyWallet, royalty, marketplace };
  };

  describe('Deployment', () => {
    it('Should deploy and return initial parameters', async () => {
      const { investmentNft, deployer, user, minter, royaltyWallet, marketplace } = await loadFixture(deployFixture);

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
      expect((await investmentNft.metadata()).name).to.deep.equal(metadata.name);
      expect((await investmentNft.metadata()).description).to.deep.equal(metadata.description);
      expect((await investmentNft.metadata()).image).to.deep.equal(metadata.image);
      expect((await investmentNft.metadata()).externalUrl).to.deep.equal(metadata.externalUrl);
      expect(await investmentNft.marketplace()).to.be.equal(marketplace.address);
    });

    it('Should revert deployment if owner is zero address', async () => {
      const { investmentNft, royaltyWallet, royalty, marketplace } = await loadFixture(deployFixture);
      const [deployer] = await ethers.getSigners();

      await expect(
        deployProxy(
          'InvestmentNFT',
          [
            name,
            symbol,
            constants.AddressZero,
            royaltyWallet.address,
            royalty,
            minimumValue,
            metadata,
            marketplace.address
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(investmentNft, 'OwnablePausable__OwnerAccountZeroAddress');
    });

    it('Should revert deployment if invalid royalty parameters', async () => {
      const { owner, royaltyWallet, deployer, marketplace } = await loadFixture(deployFixture);

      await expect(
        deployProxy(
          'InvestmentNFT',
          [name, symbol, owner.address, royaltyWallet.address, 10001, minimumValue, metadata, marketplace.address],
          deployer
        )
      ).to.be.revertedWith('ERC2981: royalty fee will exceed salePrice');
    });

    it('Should revert when initialize again', async () => {
      const { owner, investmentNft, royaltyWallet, royalty, marketplace } = await loadFixture(deployFixture);

      await expect(
        investmentNft.initialize(
          name,
          symbol,
          owner.address,
          royaltyWallet.address,
          royalty,
          minimumValue,
          metadata,
          marketplace.address
        )
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  describe('#mint()', () => {
    it('Should mint token', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      const tokenId = 0;
      const amount = toUsdc('50');
      const percentage = '100.0000%';

      await expect(investmentNft.connect(minter).mint(user.address, amount))
        .to.emit(investmentNft, 'Transfer')
        .withArgs(constants.AddressZero, user.address, tokenId);

      expect(await investmentNft.balanceOf(user.address)).to.equal(1);
      expect(await investmentNft.ownerOf(tokenId)).to.equal(user.address);
      expect(await investmentNft.tokenValue(tokenId)).to.equal(amount);
      expect(await investmentNft.getSharePercentage(tokenId)).to.equal(percentage);
    });

    it('Should revert minting if a value less than minimum', async () => {
      const { investmentNft, user, minter } = await loadFixture(deployFixture);

      await expect(investmentNft.connect(minter).mint(user.address, minimumValue.sub(1))).to.be.revertedWithCustomError(
        investmentNft,
        'InvestmentNft__InvestmentTooLow'
      );
    });

    it('Should revert minting if not minter', async () => {
      const { investmentNft, user } = await loadFixture(deployFixture);

      await expect(investmentNft.connect(user).mint(user.address, toUsdc('50'))).to.be.revertedWithCustomError(
        investmentNft,
        'InvestmentNft__NotMinter'
      );
    });

    it('Should revert minting if contract paused', async () => {
      const { investmentNft, owner, user, minter } = await loadFixture(deployFixture);

      await investmentNft.connect(owner).pause();
      await expect(investmentNft.connect(minter).mint(user.address, toUsdc('50'))).to.be.revertedWith(
        'Pausable: paused'
      );

      await investmentNft.connect(owner).unpause();
      await expect(investmentNft.connect(minter).mint(user.address, toUsdc('50'))).not.to.be.reverted;
    });
  });

  describe('#split()', () => {
    it('Should revert splitting if token does not exist', async () => {
      ({ investmentNft, user } = await loadFixture(deployFixture));

      await expect(investmentNft.connect(user).split(0, [0, 0])).to.be.revertedWith('ERC721: invalid token ID');
    });

    describe('when token exists', async () => {
      const tokenId = 0;
      const tokenValue = toUsdc('120');

      before(async () => {
        ({ investmentNft, owner, user, minter } = await loadFixture(deployFixture));

        await investmentNft.connect(minter).mint(user.address, tokenValue);
        expect(await investmentNft.ownerOf(tokenId)).to.equal(user.address);

        restorer = await takeSnapshot();
      });

      beforeEach(async () => {
        await restorer.restore();
      });

      it('Should split NFT', async () => {
        await expect(investmentNft.connect(user).split(tokenId, [toUsdc('50'), toUsdc('70')]))
          .to.emit(investmentNft, 'TokenSplitted')
          .withArgs(user.address, tokenId);

        await expect(investmentNft.ownerOf(tokenId)).to.be.revertedWith('ERC721: invalid token ID');
        expect(await investmentNft.balanceOf(user.address)).to.equal(2);
        expect(await investmentNft.ownerOf(1)).to.equal(user.address);
        expect(await investmentNft.ownerOf(2)).to.equal(user.address);
        expect(await investmentNft.tokenValue(1)).to.equal(toUsdc('50'));
        expect(await investmentNft.tokenValue(2)).to.equal(toUsdc('70'));
        expect(await investmentNft.getSharePercentage(1)).to.equal('41.6666%');
        expect(await investmentNft.getSharePercentage(2)).to.equal('58.3333%');
      });

      it('Should revert splitting NFT if caller is not token owner', async () => {
        await expect(
          investmentNft.connect(minter).split(tokenId, [toUsdc('50'), toUsdc('70')])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__NotTokenOwner');
      });

      it('Should revert splitting NFT if new value differs from the old one', async () => {
        await expect(
          investmentNft.connect(user).split(tokenId, [toUsdc('50'), toUsdc('50'), toUsdc('50')])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__TokenValuesBeforeAfterSplitMismatch');
      });

      it('Should revert splitting NFT if contract paused', async () => {
        await investmentNft.connect(owner).pause();
        await expect(investmentNft.connect(user).split(tokenId, [toUsdc('50'), toUsdc('70')])).to.be.revertedWith(
          'Pausable: paused'
        );
      });

      it('Should revert splitting NFT if limit for splitting is reached', async () => {
        await expect(
          investmentNft
            .connect(user)
            .split(tokenId, [
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
            ])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__SplitLimitExceeded');
      });

      it('Should revert splitting NFT if a value less than minimum', async () => {
        await expect(
          investmentNft.connect(user).split(tokenId, [minimumValue.sub(1), toUsdc('71')])
        ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__InvestmentTooLow');
      });

      it('Should revert when a token is listed on the marketplace', async () => {
        const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);
        const tokenValue = toUsdc('100');
        await investmentNft.connect(owner).mint(user.address, tokenValue);

        marketplace.isAllowedContract.returns(true);
        marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, toWlth('500')]);

        await expect(investmentNft.connect(user).split(0, [toUsdc('50'), toUsdc('50')])).to.be.revertedWithCustomError(
          investmentNft,
          'InvestmentNft__TokenListed'
        );
      });
    });
  });

  describe('Investment value getters', () => {
    const tokenValue = toUsdc('50');

    it('Should return investment value', async () => {
      const { investmentNft, user, minter, marketplace } = await loadFixture(deployFixture);
      marketplace.isAllowedContract.returns(true);
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);
      await investmentNft.connect(minter).mint(user.address, tokenValue);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue);
    });

    it('Should return investment value if multiple mints', async () => {
      const { investmentNft, user, minter, marketplace } = await loadFixture(deployFixture);
      marketplace.isAllowedContract.returns(true);
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);

      await investmentNft.connect(minter).mint(user.address, tokenValue);

      const tokenValue2 = toUsdc('50');
      await investmentNft.connect(minter).mint(user.address, tokenValue2);
      await investmentNft.connect(minter).mint(minter.address, tokenValue2);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue.add(tokenValue2));
      expect(await investmentNft.getInvestmentValue(minter.address)).to.equal(tokenValue2);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue.add(tokenValue2.mul(2)));
    });

    it('Should return investment value if multiple mints', async () => {
      const { investmentNft, user, minter, marketplace } = await loadFixture(deployFixture);
      marketplace.isAllowedContract.returns(true);
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);

      await investmentNft.connect(minter).mint(user.address, tokenValue);

      const tokenValue2 = toUsdc('50');
      await investmentNft.connect(minter).mint(user.address, tokenValue2);
      await investmentNft.connect(minter).mint(minter.address, tokenValue2);

      expect(await investmentNft.getInvestmentValue(user.address)).to.equal(tokenValue.add(tokenValue2));
      expect(await investmentNft.getInvestmentValue(minter.address)).to.equal(tokenValue2);
      expect(await investmentNft.getTotalInvestmentValue()).to.equal(tokenValue.add(tokenValue2.mul(2)));
    });

    it('Should return investment value from specific block', async () => {
      const { investmentNft, user, minter, marketplace } = await loadFixture(deployFixture);
      marketplace.isAllowedContract.returns(true);
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);

      await investmentNft.connect(minter).mint(user.address, tokenValue);
      const blockNumber = await ethers.provider.getBlockNumber();

      const tokenValue2 = toUsdc('50');
      const expectedInvestmentInBlock = tokenValue;
      await investmentNft.connect(minter).mint(user.address, tokenValue2);

      expect(await investmentNft.getPastInvestmentValue(user.address, blockNumber)).to.equal(expectedInvestmentInBlock);
      expect(await investmentNft.getPastTotalInvestmentValue(blockNumber)).to.equal(expectedInvestmentInBlock);
      expect(await investmentNft.getPastParticipation(user.address, blockNumber)).to.deep.equal([
        expectedInvestmentInBlock,
        expectedInvestmentInBlock
      ]);
    });

    it('Should return investment value from specific block after transfer', async () => {
      const { investmentNft, user, minter, marketplace } = await loadFixture(deployFixture);
      marketplace.isAllowedContract.returns(true);
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);

      await investmentNft.connect(minter).mint(user.address, tokenValue);

      const tokenValue2 = toUsdc('50');
      const totalInvestmentValue = tokenValue.add(tokenValue2);
      await investmentNft.connect(minter).mint(user.address, tokenValue2);

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

  describe('#setMinimumValue', () => {
    it('Should set new minimum value', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newValue = 20;

      await expect(investmentNft.connect(owner).setMinimumValue(newValue))
        .to.emit(investmentNft, 'MinimumValueChanged')
        .withArgs(newValue);

      const minimumValue = await investmentNft.minimumValue();
      expect(minimumValue).to.equal(newValue);
    });
    it('should not allow non-owner to set metadata name', async function () {
      const newValue = 20;

      await expect(investmentNft.connect(user).setMinimumValue(newValue)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });
  describe('#metadatasetters', () => {
    it('Should set new metadata name', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newName = 'Name2';

      await expect(investmentNft.connect(owner).setMetadataName(newName))
        .to.emit(investmentNft, 'MetadataNameChanged')
        .withArgs(newName);

      const metadata = await investmentNft.metadata();
      expect(metadata.name).to.equal(newName);
    });

    it('should not allow non-owner to set metadata name', async function () {
      const newName = 'New Name';

      await expect(investmentNft.connect(user).setMetadataName(newName)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should set new metadata description', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newDescription = 'Description2';

      await expect(investmentNft.connect(owner).setMetadataDescription(newDescription))
        .to.emit(investmentNft, 'MetadataDescriptionChanged')
        .withArgs(newDescription);

      const metadata = await investmentNft.metadata();
      expect(metadata.description).to.equal(newDescription);
    });

    it('should not allow non-owner to set metadata description', async function () {
      const newDescription = 'New Description';

      await expect(investmentNft.connect(user).setMetadataDescription(newDescription)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should set new metadata image', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newImage = 'New Image';

      await expect(investmentNft.connect(owner).setMetadataImage(newImage))
        .to.emit(investmentNft, 'MetadataImageChanged')
        .withArgs(newImage);

      const metadata = await investmentNft.metadata();
      expect(metadata.image).to.equal(newImage);
    });

    it('should not allow non-owner to set metadata image', async function () {
      const newImage = 'New Image';

      await expect(investmentNft.connect(user).setMetadataImage(newImage)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should set new metadata url', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newUrl = 'New Url';

      await expect(investmentNft.connect(owner).setMetadataExternalUrl(newUrl))
        .to.emit(investmentNft, 'MetadataExternalUrlChanged')
        .withArgs(newUrl);

      const metadata = await investmentNft.metadata();
      expect(metadata.externalUrl).to.equal(newUrl);
    });

    it('should not allow non-owner to set metadata url', async function () {
      const newUrl = 'New Url';

      await expect(investmentNft.connect(user).setMetadataExternalUrl(newUrl)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should set new metadata', async () => {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newName = 'New Name';
      const newDescription = 'New Description';
      const newImage = 'New Image';
      const newUrl = 'New Url';
      const newMetadata = {
        name: newName,
        description: newDescription,
        image: newImage,
        externalUrl: newUrl
      };

      await expect(investmentNft.connect(owner).setAllMetadata(newMetadata))
        .to.emit(investmentNft, 'MetadataChanged')
        .withArgs(newMetadata.name, newMetadata.description, newMetadata.image, newMetadata.externalUrl);

      const metadata = await investmentNft.metadata();
      expect(metadata.name).to.equal(newMetadata.name);
      expect(metadata.description).to.equal(newMetadata.description);
      expect(metadata.image).to.equal(newMetadata.image);
      expect(metadata.externalUrl).to.equal(newMetadata.externalUrl);
    });

    it('should not allow non-owner to set metadata url', async function () {
      const newName = 'New Name';
      const newDescription = 'New Description';
      const newImage = 'New Image';
      const newUrl = 'New Url';
      const newMetadata = {
        name: newName,
        description: newDescription,
        image: newImage,
        externalUrl: newUrl
      };

      await expect(investmentNft.connect(user).setAllMetadata(newMetadata)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('#getSharePercentage', () => {
    it('should revert if token does not exist', async function () {
      const { investmentNft } = await loadFixture(deployFixture);

      await expect(investmentNft.getSharePercentage(0)).to.be.revertedWithCustomError(
        investmentNft,
        'InvestmentNft__TokenNotExists'
      );
    });
    it('should give correct percentages', async function () {
      const { investmentNft, user, minter, marketplace } = await loadFixture(deployFixture);
      const tokenValue = toUsdc('50');
      marketplace.isAllowedContract.returns(true);
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);

      await investmentNft.connect(minter).mint(user.address, tokenValue);
      expect(await investmentNft.getSharePercentage(0)).to.equal('100.0000%');

      const tokenValue2 = toUsdc('100');
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue2]);
      await investmentNft.connect(minter).mint(user.address, tokenValue2);
      expect(await investmentNft.getSharePercentage(0)).to.equal('33.3333%');
      expect(await investmentNft.getSharePercentage(1)).to.equal('66.6666%');

      const tokenValue3 = toUsdc('150');
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue3]);
      await investmentNft.connect(minter).mint(minter.address, tokenValue3);
      expect(await investmentNft.getSharePercentage(0)).to.equal('16.6666%');
      expect(await investmentNft.getSharePercentage(1)).to.equal('33.3333%');
      expect(await investmentNft.getSharePercentage(2)).to.equal('50.0000%');

      const tokenValue4 = toUsdc('200');
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue4]);
      await investmentNft.connect(minter).mint(minter.address, tokenValue4);
      expect(await investmentNft.getSharePercentage(0)).to.equal('10.0000%');
      expect(await investmentNft.getSharePercentage(1)).to.equal('20.0000%');
      expect(await investmentNft.getSharePercentage(2)).to.equal('30.0000%');
      expect(await investmentNft.getSharePercentage(3)).to.equal('40.0000%');
    });
  });

  describe('#tokenUri', () => {
    it('should return correct metadata', async function () {
      const { investmentNft, user, minter, owner, marketplace } = await loadFixture(deployFixture);
      const newName = 'New Name';
      const newDescription = 'New Description';
      const newImage = 'New Image';
      const newUrl = 'New Url';
      const newMetadata = {
        name: newName,
        description: newDescription,
        image: newImage,
        externalUrl: newUrl
      };
      
      await expect(investmentNft.connect(owner).setAllMetadata(newMetadata))
        .to.emit(investmentNft, 'MetadataChanged')
        .withArgs(newMetadata.name, newMetadata.description, newMetadata.image, newMetadata.externalUrl);

      const tokenValue = toUsdc('50');
      marketplace.getListingByTokenId
          .whenCalledWith(investmentNft.address, 0)
          .returns([true, false, user.address, investmentNft.address, 0, tokenValue]);
      await investmentNft.connect(minter).mint(user.address, tokenValue);

      expect(await investmentNft.tokenURI(0)).to.equal(
        'data:application/json;base64,eyJuYW1lIjogIk5ldyBOYW1lIiwiZGVzY3JpcHRpb24iOiAiTmV3IERlc2NyaXB0aW9uIiwiaW1hZ2UiOiAiTmV3IEltYWdlIiwiZXh0ZXJuYWxfdXJsIjogIk5ldyBVcmwiLCJhdHRyaWJ1dGVzIjogW3sidHJhaXRfdHlwZSI6InZhbHVlIiwidmFsdWUiOiIxMDAuMDAwMCUifV19'
      );
    });
  });

  describe('#NftMarketplaceInteractions', () => {
    beforeEach(async () => {
      const { marketplace } = await loadFixture(deployFixture);
      marketplace.getListingByListingId.reset();
      marketplace['cancelListing(address,uint256)'].reset();
    });

    it('Should cancel marketplace listing when a token is transfered', async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const tokenId = 0;
      const tokenValue = toUsdc('100');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, tokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, tokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, tokenId)
        .returns([true, false, user.address, investmentNft.address, tokenId, toWlth('500')]);

      await investmentNft.connect(user).transferFrom(user.address, owner.address, tokenId);

      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledOnce;
      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledWith(investmentNft.address, tokenId);
    });

    it('Should cancel marketplace listing when a token approval is revoked', async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const tokenId = 0;
      const tokenValue = toUsdc('100');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, tokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, tokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, tokenId)
        .returns([true, false, user.address, investmentNft.address, tokenId, toWlth('500')]);

      await investmentNft.connect(user).approve(owner.address, tokenId);

      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledOnce;
      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledWith(investmentNft.address, tokenId);
    });

    it("Shouldn't cancel marketplace listing when a token approved to the marketplace", async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const tokenId = 0;
      const tokenValue = toUsdc('100');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, tokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, tokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, tokenId)
        .returns([true, false, user.address, investmentNft.address, tokenId, toWlth('500')]);

      await investmentNft.connect(user).approve(marketplace.address, tokenId);

      expect(marketplace['cancelListing(address,uint256)']).to.not.have.been.called;
    });

    it("Should cancel marketplace listing when all user's approvals revoked from marketplace", async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const firstTokenId = 0;
      const fistTokenValue = toUsdc('100');
      const secondTokenId = 1;
      const secondTokenValue = toUsdc('200');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, fistTokenValue);
      await investmentNft.connect(owner).mint(user.address, secondTokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([true, false, user.address, investmentNft.address, firstTokenId, toWlth('500')]);
      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([true, false, user.address, investmentNft.address, secondTokenId, toWlth('500')]);

      await investmentNft.connect(user).setApprovalForAll(marketplace.address, false);

      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledTwice;
      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledWith(
        investmentNft.address,
        firstTokenId
      );
      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledWith(
        investmentNft.address,
        secondTokenId
      );
    });

    it("Shouldn't cancel all user's marketplace listings when revoke all approvales and a token is not listed", async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const firstTokenId = 0;
      const fistTokenValue = toUsdc('100');
      const secondTokenId = 1;
      const secondTokenValue = toUsdc('200');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, fistTokenValue);
      await investmentNft.connect(owner).mint(user.address, secondTokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([true, false, user.address, investmentNft.address, firstTokenId, toWlth('500')]);
      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(user).setApprovalForAll(marketplace.address, false);

      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledOnce;
      expect(marketplace['cancelListing(address,uint256)']).to.have.been.calledWith(
        investmentNft.address,
        firstTokenId
      );
    });

    it("Shouldn't cancel marketplace listing when set approval for all to marketplace", async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const firstTokenId = 0;
      const fistTokenValue = toUsdc('100');
      const secondTokenId = 1;
      const secondTokenValue = toUsdc('200');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, fistTokenValue);
      await investmentNft.connect(owner).mint(user.address, secondTokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([true, false, user.address, investmentNft.address, firstTokenId, toWlth('500')]);
      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(user).setApprovalForAll(marketplace.address, true);

      expect(marketplace['cancelListing(address,uint256)']).to.not.have.been.calledOnce;
    });

    it("Shouldn't cancel marketplace listing when set approval for all not to marketplace", async () => {
      const { owner, investmentNft, user, marketplace } = await loadFixture(deployFixture);

      const firstTokenId = 0;
      const fistTokenValue = toUsdc('100');
      const secondTokenId = 1;
      const secondTokenValue = toUsdc('200');

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([false, false, ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0]);

      await investmentNft.connect(owner).mint(user.address, fistTokenValue);
      await investmentNft.connect(owner).mint(user.address, secondTokenValue);

      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, firstTokenId)
        .returns([true, false, user.address, investmentNft.address, firstTokenId, toWlth('500')]);
      marketplace.getListingByTokenId
        .whenCalledWith(investmentNft.address, secondTokenId)
        .returns([true, false, user.address, investmentNft.address, secondTokenId, toWlth('500')]);

      await investmentNft.connect(user).setApprovalForAll(owner.address, true);

      expect(marketplace['cancelListing(address,uint256)']).to.not.have.been.calledOnce;
    });

    it('should revert set nft marketplace when not called by owner', async function () {
      const { investmentNft, user } = await loadFixture(deployFixture);

      const newMarketplace = ethers.Wallet.createRandom().address;

      await expect(investmentNft.connect(user).setMarketplaceAddress(newMarketplace)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should revert set nft marketplace when address zero provided', async function () {
      const { investmentNft, owner } = await loadFixture(deployFixture);

      await expect(
        investmentNft.connect(owner).setMarketplaceAddress(constants.AddressZero)
      ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNft__InvalidMarketplaceAddress');
    });
  });

  describe('#setRoyalty', function () {
    it('Should set the royalty parameters correctly', async function () {
      const { investmentNft, owner } = await loadFixture(deployFixture);
      const newAddress = '0xCB0Ef07D6cFFEc9490c15E39a0a029B0B9F84587';
      await expect(investmentNft.connect(owner).setRoyalty(newAddress, 1300))
        .to.emit(investmentNft, 'RoyaltyChanged')
        .withArgs(newAddress, 1300);
      expect(await investmentNft.connect(owner).royaltyInfo(0, toWlth('1000'))).to.deep.equal([
        newAddress,
        toWlth('130')
      ]);
    });

    it('Should revert if caller is not admin', async function () {
      const { investmentNft, deployer } = await loadFixture(deployFixture);
      const newAddress = '0xCB0Ef07D6cFFEc9490c15E39a0a029B0B9F84587';
      await expect(investmentNft.connect(deployer).setRoyalty(newAddress, 650)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert when setting the zero address', async function () {
      const { investmentNft, owner } = await loadFixture(deployFixture);

      await expect(
        investmentNft.connect(owner).setRoyalty(ethers.constants.AddressZero, 650)
      ).to.be.revertedWithCustomError(investmentNft, 'InvestmentNFT__ZeroAddress');
    });
  });
});
