import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, mine, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';

import {
  IERC721EnumerableUpgradeable__factory,
  IPerpetualFund,
  IPerpetualNFT__factory,
  PerpetualNFT
} from '../../typechain-types';
import { getInterfaceIdWithBase, toUsdc } from '../utils';

describe('PerpetualNFT', () => {
  const deployPerpetualNFT = async () => {
    const [deployer, owner, user1, user2, royaltyWallet, profitDistributor] = await ethers.getSigners();
    const IPerpetualNFTId = utils.arrayify(
      getInterfaceIdWithBase([
        IPerpetualNFT__factory.createInterface(),
        IERC721EnumerableUpgradeable__factory.createInterface()
      ])
    );
    const name = 'Perpetual NFT';
    const symbol = 'PNFT';
    const minimumValue = toUsdc('50');
    const royalty = 650;

    const metadataName = 'Perpetual';
    const metadatsaDescription = 'Perpetual description';
    const metadataImage = 'ipfs://image';
    const metadataExternalUrl = 'https://perpetual.com';

    const metadata = {
      name: metadataName,
      description: metadatsaDescription,
      image: metadataImage,
      externalUrl: metadataExternalUrl
    };

    const perpetualFund: FakeContract<IPerpetualFund> = await smock.fake('PerpetualFund');
    owner.sendTransaction({ to: perpetualFund.address, value: ethers.utils.parseEther('100') });

    const perpetualNFT: PerpetualNFT = await deployProxy(
      'PerpetualNFT',
      [name, symbol, owner.address, royaltyWallet.address, royalty, minimumValue, profitDistributor.address, metadata],
      deployer
    );

    return {
      deployer,
      owner,
      user1,
      user2,
      royaltyWallet,
      royalty,
      metadata,
      perpetualNFT,
      name,
      symbol,
      IPerpetualNFTId,
      minimumValue,
      profitDistributor,
      perpetualFund
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy and return initial parameters', async () => {
        const {
          owner,
          royaltyWallet,
          royalty,
          metadata,
          perpetualNFT,
          name,
          symbol,
          IPerpetualNFTId,
          minimumValue,
          profitDistributor
        } = await loadFixture(deployPerpetualNFT);

        expect(await perpetualNFT.name()).to.be.equal(name);
        expect(await perpetualNFT.symbol()).to.be.equal(symbol);
        expect(await perpetualNFT.isMinter(owner.address)).to.be.true;
        expect(await perpetualNFT.getTotalInvestmentValue()).to.equal(0);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([]);
        expect(await perpetualNFT.supportsInterface(IPerpetualNFTId)).to.equal(true);
        expect(await perpetualNFT.royaltyInfo(0, 10000)).to.deep.equal([royaltyWallet.address, royalty]);
        expect(await perpetualNFT.minimumValue()).to.be.equal(minimumValue);
        expect((await perpetualNFT.metadata()).name).to.deep.equal(metadata.name);
        expect((await perpetualNFT.metadata()).description).to.deep.equal(metadata.description);
        expect((await perpetualNFT.metadata()).image).to.deep.equal(metadata.image);
        expect((await perpetualNFT.metadata()).externalUrl).to.deep.equal(metadata.externalUrl);
        expect(await perpetualNFT.profitDistributor()).to.be.equal(profitDistributor.address);
        expect(await perpetualNFT.splittingEnabled()).to.be.true;
      });
    });
    describe('Revert', () => {
      it('Should revert deployment if owner is zero address', async () => {
        const {
          deployer,
          royaltyWallet,
          royalty,
          metadata,
          perpetualNFT,
          name,
          symbol,
          minimumValue,
          profitDistributor
        } = await loadFixture(deployPerpetualNFT);
        await expect(
          deployProxy(
            'PerpetualNFT',
            [
              name,
              symbol,
              ethers.constants.AddressZero,
              royaltyWallet.address,
              royalty,
              minimumValue,
              profitDistributor.address,
              metadata
            ],
            deployer
          )
        ).to.be.revertedWithCustomError(perpetualNFT, 'OwnablePausable__OwnerAccountZeroAddress');
      });

      it('Should revert initialize again', async () => {
        const { owner, royaltyWallet, royalty, metadata, perpetualNFT, name, symbol, minimumValue, profitDistributor } =
          await loadFixture(deployPerpetualNFT);
        await expect(
          perpetualNFT.initialize(
            name,
            symbol,
            owner.address,
            royaltyWallet.address,
            royalty,
            minimumValue,
            profitDistributor.address,
            metadata
          )
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });

      it('Should revert deployment if invalid royalty parameters', async () => {
        const { owner, deployer, royaltyWallet, metadata, name, symbol, minimumValue, profitDistributor } =
          await loadFixture(deployPerpetualNFT);
        await expect(
          deployProxy(
            'PerpetualNFT',
            [
              name,
              symbol,
              owner.address,
              royaltyWallet.address,
              10001,
              minimumValue,
              profitDistributor.address,
              metadata
            ],
            deployer
          )
        ).to.be.revertedWith('ERC2981: royalty fee will exceed salePrice');
      });
    });
  });

  describe('AddMinter', async () => {
    describe('Success', async () => {
      it('Should add minter', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(owner).addMinter(user1.address))
          .to.emit(perpetualNFT, 'MinterAdded')
          .withArgs(user1.address);
        expect(await perpetualNFT.isMinter(user1.address)).to.be.true;
      });
    });
    describe('Revert', async () => {
      it('Should revert if caller is not owner', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).addMinter(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert if minter already exists', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).addMinter(user1.address);
        await expect(perpetualNFT.connect(owner).addMinter(user1.address)).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__MinterAlreadyRegistered'
        );
      });
    });
  });

  describe('Remove minter', async () => {
    describe('Success', async () => {
      it('Should remove minter', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).addMinter(user1.address);
        await expect(perpetualNFT.connect(owner).removeMinter(user1.address))
          .to.emit(perpetualNFT, 'MinterRemoved')
          .withArgs(user1.address);
        expect(await perpetualNFT.isMinter(user1.address)).to.be.false;
      });
    });
    describe('Revert', async () => {
      it('Should revert if caller is not owner', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).addMinter(user1.address);
        await expect(perpetualNFT.connect(user1).removeMinter(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });

      it('Should revert if minter does not exist', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(owner).removeMinter(user1.address)).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__MinterNotRegistered'
        );
      });
    });
  });

  describe('Mint', async () => {
    describe('Success', async () => {
      it('Should mint NFT', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('100');
        const tokenId = 0;

        await expect(perpetualNFT.connect(owner).mint(user1.address, investmentValue))
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, tokenId);
        expect(await perpetualNFT.ownerOf(tokenId)).to.be.equal(user1.address);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([user1.address]);
        expect(await perpetualNFT.getTotalInvestmentValue()).to.be.equal(investmentValue);
        expect(await perpetualNFT.currentPrincipal(tokenId)).to.be.equal(investmentValue);
        expect(await perpetualNFT.tokenValue(tokenId)).to.be.equal(investmentValue);
        expect(await perpetualNFT.getInvestmentValue(user1.address)).to.be.equal(investmentValue);
        expect(await perpetualNFT.getCurrentTokenValueDetails(tokenId)).to.deep.equal([
          investmentValue,
          investmentValue
        ]);
      });

      it("Should mint NFT's with different values", async () => {
        const { owner, perpetualNFT, user1, user2 } = await loadFixture(deployPerpetualNFT);

        const investmentValue1 = toUsdc('100');
        const investmentValue2 = toUsdc('200');
        const totalInvestmentValue = investmentValue1.add(investmentValue2);
        const tokenId1 = 0;
        const tokenId2 = 1;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue1);
        await perpetualNFT.connect(owner).mint(user2.address, investmentValue2);

        expect(await perpetualNFT.ownerOf(tokenId1)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(tokenId2)).to.be.equal(user2.address);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([user1.address, user2.address]);
        expect(await perpetualNFT.getTotalInvestmentValue()).to.be.equal(investmentValue1.add(investmentValue2));
        expect(await perpetualNFT.currentPrincipal(tokenId1)).to.be.equal(investmentValue1);
        expect(await perpetualNFT.currentPrincipal(tokenId2)).to.be.equal(investmentValue2);
        expect(await perpetualNFT.tokenValue(tokenId1)).to.be.equal(investmentValue1);
        expect(await perpetualNFT.tokenValue(tokenId2)).to.be.equal(investmentValue2);
        expect(await perpetualNFT.getInvestmentValue(user1.address)).to.be.equal(investmentValue1);
        expect(await perpetualNFT.getInvestmentValue(user2.address)).to.be.equal(investmentValue2);

        const user1Pariticipation = await perpetualNFT.getParticipation(user1.address);
        expect(user1Pariticipation[0]).to.be.equal(investmentValue1);
        expect(user1Pariticipation[1]).to.be.equal(totalInvestmentValue);
        const user2Pariticipation = await perpetualNFT.getParticipation(user2.address);
        expect(user2Pariticipation[0]).to.be.equal(investmentValue2);
        expect(user2Pariticipation[1]).to.be.equal(totalInvestmentValue);
      });
    });
    describe('Revert', async () => {
      it('Should revert when paused', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).pause();
        await expect(perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'))).to.be.revertedWith(
          'Pausable: paused'
        );
      });

      it('Should revernt when caller is not minter', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).mint(user1.address, toUsdc('100'))).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__MinterNotRegistered'
        );
      });

      it('Should revert when value less then minimum value', async () => {
        const { owner, perpetualNFT, user1, minimumValue } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).addMinter(user1.address);
        await expect(
          perpetualNFT.connect(user1).mint(user1.address, minimumValue.sub(1))
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT__ValueToLow');
      });

      it('Should revert when values is 0', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).setMinimumValue(0);
        await expect(perpetualNFT.connect(owner).mint(user1.address, 0)).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__InvalidTokenValue'
        );
      });
    });
  });

  describe('Split', async () => {
    describe('Success', async () => {
      it('Should split an NFT to equal two', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('100');
        const tokenId = 0;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);

        const splitValue = toUsdc('50');

        await expect(perpetualNFT.connect(user1).split(tokenId, [splitValue, splitValue]))
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(user1.address, ethers.constants.AddressZero, tokenId)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 1)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 2);
        expect(await perpetualNFT.ownerOf(1)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(2)).to.be.equal(user1.address);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([user1.address]);
        expect(await perpetualNFT.getTotalInvestmentValue()).to.be.equal(investmentValue);
        expect(await perpetualNFT.currentPrincipal(tokenId)).to.be.equal(0);
        expect(await perpetualNFT.currentPrincipal(1)).to.be.equal(splitValue);
        expect(await perpetualNFT.currentPrincipal(2)).to.be.equal(splitValue);
        expect(await perpetualNFT.tokenValue(1)).to.be.equal(splitValue);
        expect(await perpetualNFT.tokenValue(2)).to.be.equal(splitValue);
        expect(await perpetualNFT.getCurrentTokenValueDetails(1)).to.deep.equal([splitValue, splitValue]);
        expect(await perpetualNFT.getCurrentTokenValueDetails(2)).to.deep.equal([splitValue, splitValue]);
      });

      it("Should split to few NFT's", async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('1000');
        const tokenId = 0;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);

        const firstTokenValue = toUsdc('600');
        const secondTokenValue = toUsdc('300');
        const thirdTokenValue = toUsdc('100');

        await expect(perpetualNFT.connect(user1).split(tokenId, [firstTokenValue, secondTokenValue, thirdTokenValue]))
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(user1.address, ethers.constants.AddressZero, tokenId)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 1)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 2)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 3);
        expect(await perpetualNFT.ownerOf(1)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(2)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(3)).to.be.equal(user1.address);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([user1.address]);
        expect(await perpetualNFT.getTotalInvestmentValue()).to.be.equal(investmentValue);
        expect(await perpetualNFT.currentPrincipal(tokenId)).to.be.equal(0);
        expect(await perpetualNFT.currentPrincipal(1)).to.be.equal(firstTokenValue);
        expect(await perpetualNFT.currentPrincipal(2)).to.be.equal(secondTokenValue);
        expect(await perpetualNFT.currentPrincipal(3)).to.be.equal(thirdTokenValue);
        expect(await perpetualNFT.tokenValue(1)).to.be.equal(firstTokenValue);
        expect(await perpetualNFT.tokenValue(2)).to.be.equal(secondTokenValue);
        expect(await perpetualNFT.tokenValue(3)).to.be.equal(thirdTokenValue);
        expect(await perpetualNFT.getCurrentTokenValueDetails(1)).to.deep.equal([firstTokenValue, firstTokenValue]);
        expect(await perpetualNFT.getCurrentTokenValueDetails(2)).to.deep.equal([secondTokenValue, secondTokenValue]);
        expect(await perpetualNFT.getCurrentTokenValueDetails(3)).to.deep.equal([thirdTokenValue, thirdTokenValue]);
      });

      it('Should split to few NFTs after principal is changed', async () => {
        const { owner, perpetualNFT, user1, profitDistributor } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('1000');
        const tokenId = 0;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);

        const firstTokenValue = toUsdc('600');
        const secondTokenValue = toUsdc('300');
        const thirdTokenValue = toUsdc('100');

        const principal = { tokenId: tokenId, value: toUsdc('500') };

        await perpetualNFT.connect(profitDistributor).updatePrincipals([principal]);

        await expect(perpetualNFT.connect(user1).split(tokenId, [firstTokenValue, secondTokenValue, thirdTokenValue]))
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(user1.address, ethers.constants.AddressZero, tokenId)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 1)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 2)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 3);
        expect(await perpetualNFT.ownerOf(1)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(2)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(3)).to.be.equal(user1.address);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([user1.address]);
        expect(await perpetualNFT.getTotalInvestmentValue()).to.be.equal(investmentValue);
        expect(await perpetualNFT.currentPrincipal(tokenId)).to.be.equal(0);
        expect(await perpetualNFT.currentPrincipal(1)).to.be.equal(toUsdc('300'));
        expect(await perpetualNFT.currentPrincipal(2)).to.be.equal(toUsdc('150'));
        expect(await perpetualNFT.currentPrincipal(3)).to.be.equal(toUsdc('50'));
        expect(await perpetualNFT.tokenValue(1)).to.be.equal(firstTokenValue);
        expect(await perpetualNFT.tokenValue(2)).to.be.equal(secondTokenValue);
        expect(await perpetualNFT.tokenValue(3)).to.be.equal(thirdTokenValue);
        expect(await perpetualNFT.getCurrentTokenValueDetails(1)).to.deep.equal([firstTokenValue, toUsdc('300')]);
        expect(await perpetualNFT.getCurrentTokenValueDetails(2)).to.deep.equal([secondTokenValue, toUsdc('150')]);
        expect(await perpetualNFT.getCurrentTokenValueDetails(3)).to.deep.equal([thirdTokenValue, toUsdc('50')]);
      });

      it('Should split to few NFTs after principal is withdrawn', async () => {
        const { owner, perpetualNFT, user1, profitDistributor } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('1000');
        const tokenId = 0;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);

        const firstTokenValue = toUsdc('600');
        const secondTokenValue = toUsdc('300');
        const thirdTokenValue = toUsdc('100');

        const principal = { tokenId: tokenId, value: 0 };

        await perpetualNFT.connect(profitDistributor).updatePrincipals([principal]);

        await expect(perpetualNFT.connect(user1).split(tokenId, [firstTokenValue, secondTokenValue, thirdTokenValue]))
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(user1.address, ethers.constants.AddressZero, tokenId)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 1)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 2)
          .to.emit(perpetualNFT, 'Transfer')
          .withArgs(ethers.constants.AddressZero, user1.address, 3);
        expect(await perpetualNFT.ownerOf(1)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(2)).to.be.equal(user1.address);
        expect(await perpetualNFT.ownerOf(3)).to.be.equal(user1.address);
        expect(await perpetualNFT.getInvestors()).to.deep.equal([user1.address]);
        expect(await perpetualNFT.getTotalInvestmentValue()).to.be.equal(investmentValue);
        expect(await perpetualNFT.currentPrincipal(tokenId)).to.be.equal(0);
        expect(await perpetualNFT.currentPrincipal(1)).to.be.equal(0);
        expect(await perpetualNFT.currentPrincipal(2)).to.be.equal(0);
        expect(await perpetualNFT.currentPrincipal(3)).to.be.equal(0);
        expect(await perpetualNFT.tokenValue(1)).to.be.equal(firstTokenValue);
        expect(await perpetualNFT.tokenValue(2)).to.be.equal(secondTokenValue);
        expect(await perpetualNFT.tokenValue(3)).to.be.equal(thirdTokenValue);
      });
    });
    describe('Revert', async () => {
      it('Should revert when paused', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        await perpetualNFT.connect(owner).pause();
        await expect(perpetualNFT.connect(user1).split(0, [toUsdc('50'), toUsdc('50')])).to.be.revertedWith(
          'Pausable: paused'
        );
      });

      it('Should revert when splitting is disabled', async () => {
        const { owner, perpetualNFT, user1, profitDistributor } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        await perpetualNFT.connect(profitDistributor).enableSplitting(false);
        await expect(perpetualNFT.connect(user1).split(0, [toUsdc('50'), toUsdc('50')])).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__SplittingDisabled'
        );
      });

      it('Should revert when caller is not a token owner', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        await expect(perpetualNFT.connect(owner).split(0, [toUsdc('50'), toUsdc('50')])).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__NotTokenOwner'
        );
      });

      it('Should revert when exceed split limit', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        await expect(
          perpetualNFT
            .connect(user1)
            .split(0, [
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('10'),
              toUsdc('9'),
              toUsdc('1')
            ])
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT__SplitLimitExceeded');
      });

      it('Should revert when new total tokens value exceeds the original token value', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        await expect(perpetualNFT.connect(user1).split(0, [toUsdc('51'), toUsdc('50')])).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__TokenValuesBeforeAfterSplitMismatch'
        );
      });

      it('Should revert when one of the new token value is less than minimum value', async () => {
        const { owner, perpetualNFT, user1, minimumValue } = await loadFixture(deployPerpetualNFT);
        const tokenValue = toUsdc('100');
        await perpetualNFT.connect(owner).mint(user1.address, tokenValue);
        await expect(
          perpetualNFT.connect(user1).split(0, [minimumValue.sub(1), tokenValue.sub(minimumValue).add(1)])
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT__ValueToLow');
      });
    });
  });

  describe('Enable splitting', async () => {
    describe('Success', async () => {
      it('Should enable splitting when caller is profit distributor', async () => {
        const { profitDistributor, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(profitDistributor).enableSplitting(true);
        expect(await perpetualNFT.splittingEnabled()).to.be.true;
      });
      it('Should disable splitting when caller is profit distributor', async () => {
        const { profitDistributor, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(profitDistributor).enableSplitting(false);
        expect(await perpetualNFT.splittingEnabled()).to.be.false;
      });

      it('Should enable spllitng when caller is perpetualFund', async () => {
        const { perpetualFund, perpetualNFT, owner } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).setPerpetualFund(perpetualFund.address);
        await perpetualNFT.connect(perpetualFund.wallet).enableSplitting(true);
        expect(await perpetualNFT.splittingEnabled()).to.be.true;
      });

      it('Should disable splitting when caller is perpetualFund', async () => {
        const { perpetualFund, perpetualNFT, owner } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).setPerpetualFund(perpetualFund.address);
        await perpetualNFT.connect(perpetualFund.wallet).enableSplitting(false);
        expect(await perpetualNFT.splittingEnabled()).to.be.false;
      });
    });

    describe('Revert', async () => {
      it('Should revert if caller not an perpetualFund nor profitDistributor', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).enableSplitting(true)).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__OperationNotAllowed'
        );
      });
    });
  });

  describe('Update principal', async () => {
    describe('Success', async () => {
      it('Should update principal for a single nft', async () => {
        const { owner, perpetualNFT, user1, profitDistributor } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('1000');
        const tokenId = 0;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);
        const principal = { tokenId: tokenId, value: toUsdc('500') };
        await expect(perpetualNFT.connect(profitDistributor).updatePrincipals([principal]))
          .to.emit(perpetualNFT, 'PrincipalUpdated')
          .withArgs(tokenId, principal.value);

        expect(await perpetualNFT.currentPrincipal(tokenId)).to.be.equal(principal.value);
      });

      it('Should update principal for few NFTs', async () => {
        const { owner, perpetualNFT, user1, profitDistributor } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('1000');

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);
        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);

        const firstTokenNewPrincipal = toUsdc('600');
        const secondTokenNewPrincipal = toUsdc('300');

        const principal = [
          { tokenId: 0, value: firstTokenNewPrincipal },
          { tokenId: 1, value: secondTokenNewPrincipal }
        ];

        await expect(perpetualNFT.connect(profitDistributor).updatePrincipals(principal))
          .to.emit(perpetualNFT, 'PrincipalUpdated')
          .withArgs(0, firstTokenNewPrincipal)
          .to.emit(perpetualNFT, 'PrincipalUpdated')
          .withArgs(1, secondTokenNewPrincipal);

        expect(await perpetualNFT.currentPrincipal(0)).to.be.equal(firstTokenNewPrincipal);
        expect(await perpetualNFT.currentPrincipal(1)).to.be.equal(secondTokenNewPrincipal);
      });
    });

    describe('Revert', async () => {
      it('Should revert when caller is not profit distributor', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(
          perpetualNFT.connect(user1).updatePrincipals([{ tokenId: 0, value: toUsdc('100') }])
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT__OperationNotAllowed');
      });

      it('Should revert when new princiapl exceeds the previous one', async () => {
        const { owner, perpetualNFT, user1, profitDistributor } = await loadFixture(deployPerpetualNFT);

        const investmentValue = toUsdc('1000');
        const tokenId = 0;

        await perpetualNFT.connect(owner).mint(user1.address, investmentValue);
        const principal = { tokenId: tokenId, value: investmentValue.add(1) };

        await expect(
          perpetualNFT.connect(profitDistributor).updatePrincipals([principal])
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT__NewPrincipalExceedsPrevious');
      });
    });
  });

  describe('Set perpetual fund', async () => {
    describe('Success', async () => {
      it('Should set perpetual fund', async () => {
        const { perpetualFund, perpetualNFT, owner } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(owner).setPerpetualFund(perpetualFund.address))
          .to.emit(perpetualNFT, 'PerpetualFundSet')
          .withArgs(perpetualFund.address);
        expect(await perpetualNFT.perpetualFund()).to.be.equal(perpetualFund.address);
      });
    });
    describe('Revert', async () => {
      it('Should revert when caller is not owner', async () => {
        const { perpetualFund, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).setPerpetualFund(perpetualFund.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert when given address is zero', async () => {
        const { perpetualNFT, owner } = await loadFixture(deployPerpetualNFT);
        await expect(
          perpetualNFT.connect(owner).setPerpetualFund(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT__ZeroAddress');
      });
      it('Should revert when perpetual fund is already set', async () => {
        const { perpetualFund, perpetualNFT, owner } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).setPerpetualFund(perpetualFund.address);
        await expect(
          perpetualNFT.connect(owner).setPerpetualFund(ethers.Wallet.createRandom().address)
        ).to.be.revertedWithCustomError(perpetualNFT, 'PerpetualNFT_PerpetualFundAlreadySet');
      });
    });
  });

  describe('Set metadata', async () => {
    describe('Success', async () => {
      it('Should set metadata name', async () => {
        const { owner, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        const newName = 'New Name';
        await expect(perpetualNFT.connect(owner).setMetadataName(newName))
          .to.emit(perpetualNFT, 'MetadataNameChanged')
          .withArgs(newName);
        expect((await perpetualNFT.metadata()).name).to.be.equal(newName);
      });

      it('Should set metadata description', async () => {
        const { owner, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        const newDescription = 'New Description';
        await expect(perpetualNFT.connect(owner).setMetadataDescription(newDescription))
          .to.emit(perpetualNFT, 'MetadataDescriptionChanged')
          .withArgs(newDescription);
        expect((await perpetualNFT.metadata()).description).to.be.equal(newDescription);
      });
      it('Should set metadata image', async () => {
        const { owner, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        const newImage = 'New Image';
        await expect(perpetualNFT.connect(owner).setMetadataImage(newImage))
          .to.emit(perpetualNFT, 'MetadataImageChanged')
          .withArgs(newImage);
        expect((await perpetualNFT.metadata()).image).to.be.equal(newImage);
      });

      it('Should set metadaata external url', async () => {
        const { owner, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        const newExternalUrl = 'New External Url';
        await expect(perpetualNFT.connect(owner).setMetadataExternalUrl(newExternalUrl))
          .to.emit(perpetualNFT, 'MetadataExternalUrlChanged')
          .withArgs(newExternalUrl);
        expect((await perpetualNFT.metadata()).externalUrl).to.be.equal(newExternalUrl);
      });

      it("Should set all metadata's", async () => {
        const { owner, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        const newName = 'New Name';
        const newDescription = 'New Description';
        const newImage = 'New Image';
        const newExternalUrl = 'New External Url';

        const metadata = {
          name: newName,
          description: newDescription,
          image: newImage,
          externalUrl: newExternalUrl
        };

        await expect(perpetualNFT.connect(owner).setAllMetadata(metadata))
          .to.emit(perpetualNFT, 'MetadataChanged')
          .withArgs(newName, newDescription, newImage, newExternalUrl);

        expect((await perpetualNFT.metadata()).name).to.be.equal(newName);
        expect((await perpetualNFT.metadata()).description).to.be.equal(newDescription);
        expect((await perpetualNFT.metadata()).image).to.be.equal(newImage);
        expect((await perpetualNFT.metadata()).externalUrl).to.be.equal(newExternalUrl);
      });
    });

    describe('Revert', async () => {
      it('Should revert when set metadata name and caller is not owner', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).setMetadataName('New Name')).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert when set metadata description and caller is not owner', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).setMetadataDescription('New Description')).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert when set metadata image and caller is not owner', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).setMetadataImage('New Image')).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert when set metadata external url and caller is not owner', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).setMetadataExternalUrl('New External Url')).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
      it('Should revert when set all metadata and caller is not owner', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(
          perpetualNFT.connect(user1).setAllMetadata({
            name: 'New Name',
            description: 'New Description',
            image: 'New Image',
            externalUrl: 'New External Url'
          })
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  });

  describe('Set minimum value', async () => {
    describe('Success', async () => {
      it('Should set minimum value', async () => {
        const { owner, perpetualNFT } = await loadFixture(deployPerpetualNFT);
        const newMinimumValue = toUsdc('100');
        await expect(perpetualNFT.connect(owner).setMinimumValue(newMinimumValue))
          .to.emit(perpetualNFT, 'MinimumValueChanged')
          .withArgs(newMinimumValue);
        expect(await perpetualNFT.minimumValue()).to.be.equal(newMinimumValue);
      });
    });
    describe('Revert', async () => {
      it('Should revert when caller is not owner', async () => {
        const { perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.connect(user1).setMinimumValue(toUsdc('100'))).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Get information', () => {
    describe('Success', () => {
      it('Should return correct token uri', async function () {
        const { perpetualNFT, user1, owner, metadata } = await loadFixture(deployPerpetualNFT);

        const tokenValue = toUsdc('50');
        await perpetualNFT.connect(owner).mint(user1.address, tokenValue);

        expect(await perpetualNFT.tokenURI(0)).to.equal(
          'data:application/json;base64,eyJuYW1lIjogIlBlcnBldHVhbCIsImRlc2NyaXB0aW9uIjogIlBlcnBldHVhbCBkZXNjcmlwdGlvbiIsImltYWdlIjogImlwZnM6Ly9pbWFnZSIsImV4dGVybmFsX3VybCI6ICJodHRwczovL3BlcnBldHVhbC5jb20iLCJhdHRyaWJ1dGVzIjogW3sidHJhaXRfdHlwZSI6InZhbHVlIiwidmFsdWUiOiIxMDAuMDAwMCUifV19'
        );
      });

      it('Should return correct share for tokens', async function () {
        const { perpetualNFT, user1, owner, profitDistributor } = await loadFixture(deployPerpetualNFT);

        const firstInvestment = toUsdc('6');
        const secondInvestment = toUsdc('4');
        const thirdInvestment = toUsdc('1000');
        const firstTokenId = 0;
        const secondTokenId = 1;
        const thirdTokenId = 2;

        await perpetualNFT.connect(owner).setMinimumValue(toUsdc('1'));
        await perpetualNFT.connect(owner).mint(user1.address, firstInvestment);
        expect(await perpetualNFT.getSharePercentage(firstTokenId)).to.be.equal('100.0000%');

        await perpetualNFT.connect(owner).mint(user1.address, secondInvestment);
        expect(await perpetualNFT.getSharePercentage(firstTokenId)).to.be.equal('60.0000%');
        expect(await perpetualNFT.getSharePercentage(secondTokenId)).to.be.equal('40.0000%');

        await perpetualNFT.connect(owner).mint(user1.address, thirdInvestment);
        expect(await perpetualNFT.getSharePercentage(firstTokenId)).to.be.equal('0.5940%');
        expect(await perpetualNFT.getSharePercentage(secondTokenId)).to.be.equal('0.3960%');
        expect(await perpetualNFT.getSharePercentage(thirdTokenId)).to.be.equal('99.0099%');
      });
    });
    describe('Revert', () => {
      it('Should revert when token uri call and token does not exist', async function () {
        const { perpetualNFT } = await loadFixture(deployPerpetualNFT);
        await expect(perpetualNFT.tokenURI(0)).to.be.revertedWithCustomError(
          perpetualNFT,
          'PerpetualNFT__TokenNotExists'
        );
      });
    });
  });

  describe('History change', async () => {
    describe('Success', async () => {
      it('Should properly track history', async () => {
        const { owner, perpetualNFT, user1, user2 } = await loadFixture(deployPerpetualNFT);

        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        const blockAfterFirstMint = await time.latestBlock();

        await perpetualNFT.connect(owner).mint(user2.address, toUsdc('200'));
        const blockAfterSecondMint = await time.latestBlock();
        await mine();
        const totalInvestmentValue = toUsdc('300');

        expect(await perpetualNFT.getPastInvestmentValue(user1.address, blockAfterFirstMint)).to.be.equal(
          toUsdc('100')
        );
        expect(await perpetualNFT.getPastInvestmentValue(user2.address, blockAfterSecondMint)).to.be.equal(
          toUsdc('200')
        );
        expect(await perpetualNFT.getPastTotalInvestmentValue(blockAfterFirstMint)).to.be.equal(toUsdc('100'));
        expect(await perpetualNFT.getPastTotalInvestmentValue(blockAfterSecondMint)).to.be.equal(totalInvestmentValue);

        await perpetualNFT.connect(user1).transferFrom(user1.address, user2.address, 0);

        await mine(2);

        expect(await perpetualNFT.getPastParticipation(user1.address, blockAfterSecondMint)).to.deep.equal([
          toUsdc('100'),
          totalInvestmentValue
        ]);
        expect(await perpetualNFT.getPastParticipation(user1.address, (await time.latestBlock()) - 1)).to.deep.equal([
          0,
          totalInvestmentValue
        ]);

        await perpetualNFT.connect(user2).transferFrom(user2.address, user2.address, 1);

        expect(await perpetualNFT.getInvestmentValue(user1.address)).to.be.equal(0);
        expect(await perpetualNFT.getInvestmentValue(user2.address)).to.be.equal(totalInvestmentValue);
      });
    });
    describe('Revert', async () => {
      it('Should transfer revert when paused', async () => {
        const { owner, perpetualNFT, user1 } = await loadFixture(deployPerpetualNFT);
        await perpetualNFT.connect(owner).mint(user1.address, toUsdc('100'));
        await perpetualNFT.connect(owner).pause();
        await expect(perpetualNFT.connect(user1).transferFrom(user1.address, owner.address, 0)).to.be.revertedWith(
          'Pausable: paused'
        );
      });
    });
  });
});
