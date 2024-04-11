import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFTMirror } from '../../typechain-types';
describe('GenesisNFTMirror', () => {
  const deployGenesisNFTMirror = async () => {
    const [deployer, owner, governor, user1, user2] = await ethers.getSigners();

    const name = 'Common Wealth Genesis NFT';
    const symbol = 'CWOGNFT';

    const genesisNFTLock: GenesisNFTMirror = (await deployProxy(
      'GenesisNFTMirror',
      [owner.address, governor.address, name, symbol],
      deployer
    )) as GenesisNFTMirror;

    return { deployer, owner, governor, user1, user2, genesisNFTLock, name, symbol };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contran with initial params', async () => {
        const { owner, governor, genesisNFTLock, name, symbol } = await loadFixture(deployGenesisNFTMirror);

        expect(await genesisNFTLock.name()).to.equal(name);
        expect(await genesisNFTLock.symbol()).to.equal(symbol);
        expect(await genesisNFTLock.owner()).to.equal(owner.address);
        expect(await genesisNFTLock.governor()).to.equal(governor.address);
      });
    });

    describe('Reverts', () => {
      it('Should revert when owner address is zero address', async () => {
        const { deployer, governor, genesisNFTLock, name, symbol } = await loadFixture(deployGenesisNFTMirror);

        await expect(
          deployProxy('GenesisNFTMirror', [constants.AddressZero, governor.address, name, symbol], deployer)
        ).to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNftMirror__OwnerZeroAddress');
      });

      it('Should revert when governor address is zero address', async () => {
        const { deployer, owner, genesisNFTLock, name, symbol } = await loadFixture(deployGenesisNFTMirror);

        await expect(
          deployProxy('GenesisNFTMirror', [owner.address, constants.AddressZero, name, symbol], deployer)
        ).to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNftMirror__GovernorZeroAddress');
      });

      it('Should revert when initialize again', async () => {
        const { deployer, owner, governor, genesisNFTLock, name, symbol } = await loadFixture(deployGenesisNFTMirror);

        await expect(genesisNFTLock.initialize(owner.address, governor.address, name, symbol)).to.be.revertedWith(
          'Initializable: contract is already initialized'
        );
      });
    });
  });

  describe('Governor change', () => {
    describe('Success', () => {
      it("Should change goverorn's address", async () => {
        const { governor, owner, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const newGovernor = ethers.Wallet.createRandom();

        await expect(genesisNFTLock.connect(owner).changeGovernor(newGovernor.address))
          .to.emit(genesisNFTLock, 'GovernorChanged')
          .withArgs(newGovernor.address);
        expect(await genesisNFTLock.governor()).to.equal(newGovernor.address);
      });
    });

    describe('Success', () => {
      it("Should revert when new governor's address is zero address", async () => {
        const { governor, owner, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);

        await expect(genesisNFTLock.connect(owner).changeGovernor(constants.AddressZero)).to.be.revertedWithCustomError(
          genesisNFTLock,
          'GenesisNftMirror__GovernorZeroAddress'
        );
      });

      it('Should revert when not the owner', async () => {
        const { user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const newGovernor = ethers.Wallet.createRandom();

        await expect(genesisNFTLock.connect(user1).changeGovernor(newGovernor.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('Getters reverts', () => {
    it('Should revert when the token index is out of range', async () => {
      const { genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);

      await expect(genesisNFTLock.tokenByIndex(0)).to.be.revertedWithCustomError(
        genesisNFTLock,
        'GenesisNFTMirror__IndexOutOfBounds'
      );
    });

    it("Should revert when a user's token index is out of range", async () => {
      const { user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);

      await expect(genesisNFTLock.tokenOfOwnerByIndex(user1.address, 0)).to.be.revertedWithCustomError(
        genesisNFTLock,
        'GenesisNFTMirror__OwnerIndexOutOfBounds'
      );
    });

    it('Should revert when noone owns a token', async () => {
      const { user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);

      await expect(genesisNFTLock.ownedTokensIndex(user1.address, 0))
        .to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTMirror_NotTokenOwner')
        .withArgs(0, user1.address);
    });
  });

  describe('Assigning', () => {
    describe('Reverts', () => {
      it('Should revert when not owner or governor', async () => {
        const { user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1];

        await expect(genesisNFTLock.connect(user1).assign(tokenIds, user1.address)).to.be.revertedWithCustomError(
          genesisNFTLock,
          'GenesisNftMirror__AccessDenied'
        );
      });

      it('Should revert when more tokens than the limit', async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = Array(180).fill(0);

        await expect(genesisNFTLock.connect(governor).assign(tokenIds, user1.address)).to.be.revertedWithCustomError(
          genesisNFTLock,
          'GenesisNFTMirror__TokensLimitReached'
        );
      });

      it('Should revert when a token has already an owner', async () => {
        const { governor, user1, user2, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1];

        await genesisNFTLock.connect(governor).assign(tokenIds, user1.address);

        await expect(genesisNFTLock.connect(governor).assign(tokenIds, user2.address))
          .to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTMirror__NotTokenOwner')
          .withArgs(tokenIds[0], user1.address);
      });

      it('Should revert when the token is already assign to the user', async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1];

        await genesisNFTLock.connect(governor).assign(tokenIds, user1.address);

        await expect(genesisNFTLock.connect(governor).assign(tokenIds, user1.address))
          .to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTMirror__TokenAlreadyAssigned')
          .withArgs(tokenIds[0]);
      });
    });

    describe('Success', () => {
      it('Should assign the tokens to the user', async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1, 2, 3];

        await expect(genesisNFTLock.connect(governor).assign(tokenIds, user1.address))
          .to.emit(genesisNFTLock, 'TokensAssigned')
          .withArgs(tokenIds, user1.address);

        expect(await genesisNFTLock.ownerOf(tokenIds[0])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(tokenIds[1])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(tokenIds[2])).to.equal(user1.address);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(tokenIds.length);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 0)).to.equal(tokenIds[0]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 1)).to.equal(tokenIds[1]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 2)).to.equal(tokenIds[2]);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[0])).to.equal(0);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[1])).to.equal(1);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[2])).to.equal(2);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[2])).to.equal(true);
        expect(await genesisNFTLock.totalSupply()).to.equal(tokenIds.length);

        expect(await genesisNFTLock.tokenByIndex(0)).to.equal(tokenIds[0]);
        const owners = await genesisNFTLock.ownersOf(tokenIds.concat([4]));

        expect(owners[0][0]).to.equal(tokenIds[0]);
        expect(owners[0][1]).to.equal(user1.address);
        expect(owners[1][0]).to.equal(tokenIds[1]);
        expect(owners[1][1]).to.equal(user1.address);
        expect(owners[2][0]).to.equal(tokenIds[2]);
        expect(owners[2][1]).to.equal(user1.address);
        expect(owners[3][0]).to.equal(4);
        expect(owners[3][1]).to.equal(constants.AddressZero);
      });

      it('Should assign other tokens to the second user', async () => {
        const { governor, user1, user2, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const user1TokenIds = [1, 2, 3];
        const user2TokenIds = [4, 5, 6];

        await genesisNFTLock.connect(governor).assign(user1TokenIds, user1.address);

        await expect(genesisNFTLock.connect(governor).assign(user2TokenIds, user2.address))
          .to.emit(genesisNFTLock, 'TokensAssigned')
          .withArgs(user2TokenIds, user2.address);

        expect(await genesisNFTLock.ownerOf(user1TokenIds[0])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(user1TokenIds[1])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(user1TokenIds[2])).to.equal(user1.address);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(user1TokenIds.length);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 0)).to.equal(user1TokenIds[0]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 1)).to.equal(user1TokenIds[1]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 2)).to.equal(user1TokenIds[2]);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, user1TokenIds[0])).to.equal(0);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, user1TokenIds[1])).to.equal(1);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, user1TokenIds[2])).to.equal(2);
        expect(await genesisNFTLock.isTokenExisted(user1TokenIds[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1TokenIds[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1TokenIds[2])).to.equal(true);

        expect(await genesisNFTLock.ownerOf(user2TokenIds[0])).to.equal(user2.address);
        expect(await genesisNFTLock.ownerOf(user2TokenIds[1])).to.equal(user2.address);
        expect(await genesisNFTLock.ownerOf(user2TokenIds[2])).to.equal(user2.address);
        expect(await genesisNFTLock.balanceOf(user2.address)).to.equal(user2TokenIds.length);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user2.address, 0)).to.equal(user2TokenIds[0]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user2.address, 1)).to.equal(user2TokenIds[1]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user2.address, 2)).to.equal(user2TokenIds[2]);
        expect(await genesisNFTLock.ownedTokensIndex(user2.address, user2TokenIds[0])).to.equal(0);
        expect(await genesisNFTLock.ownedTokensIndex(user2.address, user2TokenIds[1])).to.equal(1);
        expect(await genesisNFTLock.ownedTokensIndex(user2.address, user2TokenIds[2])).to.equal(2);
        expect(await genesisNFTLock.isTokenExisted(user2TokenIds[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user2TokenIds[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user2TokenIds[2])).to.equal(true);

        expect(await genesisNFTLock.totalSupply()).to.equal(user1TokenIds.length + user2TokenIds.length);

        const owners = await genesisNFTLock.ownersOf(user1TokenIds.concat(user2TokenIds));

        expect(owners[0][0]).to.equal(user1TokenIds[0]);
        expect(owners[0][1]).to.equal(user1.address);
        expect(owners[1][0]).to.equal(user1TokenIds[1]);
        expect(owners[1][1]).to.equal(user1.address);
        expect(owners[2][0]).to.equal(user1TokenIds[2]);
        expect(owners[2][1]).to.equal(user1.address);
        expect(owners[3][0]).to.equal(user2TokenIds[0]);
        expect(owners[3][1]).to.equal(user2.address);
        expect(owners[4][0]).to.equal(user2TokenIds[1]);
        expect(owners[4][1]).to.equal(user2.address);
        expect(owners[5][0]).to.equal(user2TokenIds[2]);
        expect(owners[5][1]).to.equal(user2.address);
      });

      it('Should assign next tokens to the user', async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1, 2, 3];
        await genesisNFTLock.connect(governor).assign(tokenIds, user1.address);

        const nextTokens = [4, 5, 6];

        await expect(genesisNFTLock.connect(governor).assign(nextTokens, user1.address))
          .to.emit(genesisNFTLock, 'TokensAssigned')
          .withArgs(nextTokens, user1.address);

        expect(await genesisNFTLock.ownerOf(tokenIds[0])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(tokenIds[1])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(tokenIds[2])).to.equal(user1.address);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(tokenIds.length + nextTokens.length);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 0)).to.equal(tokenIds[0]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 1)).to.equal(tokenIds[1]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 2)).to.equal(tokenIds[2]);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[0])).to.equal(0);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[1])).to.equal(1);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[2])).to.equal(2);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[2])).to.equal(true);

        expect(await genesisNFTLock.ownerOf(nextTokens[0])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(nextTokens[1])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(nextTokens[2])).to.equal(user1.address);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 3)).to.equal(nextTokens[0]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 4)).to.equal(nextTokens[1]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 5)).to.equal(nextTokens[2]);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, nextTokens[0])).to.equal(3);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, nextTokens[1])).to.equal(4);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, nextTokens[2])).to.equal(5);
        expect(await genesisNFTLock.isTokenExisted(nextTokens[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(nextTokens[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(nextTokens[2])).to.equal(true);

        expect(await genesisNFTLock.totalSupply()).to.equal(tokenIds.length + nextTokens.length);
      });

      it("Should assign a token which exists and isn't owned by anyone", async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1];

        await genesisNFTLock.connect(governor).assign(tokenIds, user1.address);
        await genesisNFTLock.connect(governor).unassign(tokenIds, user1.address);

        expect(await genesisNFTLock.connect(governor).assign(tokenIds, user1.address))
          .to.emit(genesisNFTLock, 'TokensAssigned')
          .withArgs(tokenIds, user1.address);
        expect(await genesisNFTLock.ownerOf(tokenIds[0])).to.equal(user1.address);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(tokenIds.length);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user1.address, 0)).to.equal(tokenIds[0]);
        expect(await genesisNFTLock.ownedTokensIndex(user1.address, tokenIds[0])).to.equal(0);
        expect(await genesisNFTLock.isTokenExisted(tokenIds[0])).to.equal(true);
        expect(await genesisNFTLock.totalSupply()).to.equal(tokenIds.length);
      });
    });
  });

  describe('Unassigning', () => {
    describe('Reverts', () => {
      it('Should revert when not owner or governor', async () => {
        const { user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1];

        await expect(genesisNFTLock.connect(user1).unassign(tokenIds, user1.address)).to.be.revertedWithCustomError(
          genesisNFTLock,
          'GenesisNftMirror__AccessDenied'
        );
      });

      it('Should revert when more tokens than the limit', async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = Array(180).fill(0);

        await expect(genesisNFTLock.connect(governor).unassign(tokenIds, user1.address)).to.be.revertedWithCustomError(
          genesisNFTLock,
          'GenesisNFTMirror__TokensLimitReached'
        );
      });
      it('Should revert when the user is not the token owner', async () => {
        const { governor, user1, user2, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const user1TokenIds = [1];
        const user2TokenIds = [2];

        await genesisNFTLock.connect(governor).assign(user1TokenIds, user1.address);
        await genesisNFTLock.connect(governor).assign(user2TokenIds, user2.address);

        await expect(genesisNFTLock.connect(governor).unassign(user2TokenIds, user1.address))
          .to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTMirror_NotTokenOwner')
          .withArgs(user2TokenIds[0], user1.address);
      });

      it("Should revert when a users doesn't own the token", async () => {
        const { governor, user1, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const tokenIds = [1];

        await expect(genesisNFTLock.connect(governor).unassign(tokenIds, user1.address))
          .to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTMirror__NoTokensAssigned')
          .withArgs(user1.address);
      });
    });

    describe('Success', () => {
      const setup = async () => {
        const { governor, user1, user2, genesisNFTLock } = await loadFixture(deployGenesisNFTMirror);
        const user1Tokens = [1, 2, 3];
        const user2Tokens = [4, 5, 6];
        const totalSupply = user1Tokens.length + user2Tokens.length;

        await genesisNFTLock.connect(governor).assign(user1Tokens, user1.address);
        await genesisNFTLock.connect(governor).assign(user2Tokens, user2.address);

        return { governor, user1, user2, genesisNFTLock, user1Tokens, user2Tokens, totalSupply };
      };

      it('Should unassign the tokens from the user', async () => {
        const { governor, user1, user2, genesisNFTLock, user1Tokens, user2Tokens, totalSupply } = await loadFixture(
          setup
        );

        await expect(genesisNFTLock.connect(governor).unassign(user1Tokens, user1.address))
          .to.emit(genesisNFTLock, 'TokensUnassigned')
          .withArgs(user1Tokens, user1.address);

        expect(await genesisNFTLock.ownerOf(user1Tokens[0])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user1Tokens[1])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user1Tokens[2])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(0);
        expect(await genesisNFTLock.totalSupply()).to.equal(totalSupply);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[2])).to.equal(true);

        expect(await genesisNFTLock.ownerOf(user2Tokens[0])).to.equal(user2.address);
        expect(await genesisNFTLock.ownerOf(user2Tokens[1])).to.equal(user2.address);
        expect(await genesisNFTLock.ownerOf(user2Tokens[2])).to.equal(user2.address);
        expect(await genesisNFTLock.balanceOf(user2.address)).to.equal(user2Tokens.length);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user2.address, 0)).to.equal(user2Tokens[0]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user2.address, 1)).to.equal(user2Tokens[1]);
        expect(await genesisNFTLock.tokenOfOwnerByIndex(user2.address, 2)).to.equal(user2Tokens[2]);
        expect(await genesisNFTLock.ownedTokensIndex(user2.address, user2Tokens[0])).to.equal(0);
        expect(await genesisNFTLock.ownedTokensIndex(user2.address, user2Tokens[1])).to.equal(1);
        expect(await genesisNFTLock.ownedTokensIndex(user2.address, user2Tokens[2])).to.equal(2);
        expect(await genesisNFTLock.isTokenExisted(user2Tokens[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user2Tokens[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user2Tokens[2])).to.equal(true);
      });

      it('Should unassign some tokens from the user', async () => {
        const { governor, user1, user2, genesisNFTLock, user1Tokens, totalSupply } = await loadFixture(setup);

        await expect(genesisNFTLock.connect(governor).unassign([user1Tokens[0], user1Tokens[2]], user1.address))
          .to.emit(genesisNFTLock, 'TokensUnassigned')
          .withArgs([user1Tokens[0], user1Tokens[2]], user1.address);

        expect(await genesisNFTLock.ownerOf(user1Tokens[0])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user1Tokens[1])).to.equal(user1.address);
        expect(await genesisNFTLock.ownerOf(user1Tokens[2])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(1);
        expect(await genesisNFTLock.totalSupply()).to.equal(totalSupply);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[2])).to.equal(true);
      });

      it('Should unassign tokens from user1 and then from user2', async () => {
        const { governor, user1, user2, genesisNFTLock, user1Tokens, user2Tokens, totalSupply } = await loadFixture(
          setup
        );

        await expect(genesisNFTLock.connect(governor).unassign(user1Tokens, user1.address))
          .to.emit(genesisNFTLock, 'TokensUnassigned')
          .withArgs(user1Tokens, user1.address);
        await expect(genesisNFTLock.connect(governor).unassign(user2Tokens, user2.address))
          .to.emit(genesisNFTLock, 'TokensUnassigned')
          .withArgs(user2Tokens, user2.address);

        expect(await genesisNFTLock.ownerOf(user1Tokens[0])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user1Tokens[1])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user1Tokens[2])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.balanceOf(user1.address)).to.equal(0);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user1Tokens[2])).to.equal(true);

        expect(await genesisNFTLock.ownerOf(user2Tokens[0])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user2Tokens[1])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.ownerOf(user2Tokens[2])).to.equal(constants.AddressZero);
        expect(await genesisNFTLock.balanceOf(user2.address)).to.equal(0);
        expect(await genesisNFTLock.isTokenExisted(user2Tokens[0])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user2Tokens[1])).to.equal(true);
        expect(await genesisNFTLock.isTokenExisted(user2Tokens[2])).to.equal(true);

        expect(await genesisNFTLock.totalSupply()).to.equal(totalSupply);
      });
    });
  });
});
