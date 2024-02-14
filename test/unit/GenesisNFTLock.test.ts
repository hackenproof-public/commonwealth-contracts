import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFTLock, GenesisNFTMirror, GenesisNFTV1, GenesisNFTV2, IZkSync } from '../../typechain-types';

describe('GenesisNFTLock unit tests', () => {
  const deployGensisNFTLock = async () => {
    const [deployer, owner, user1, user2] = await ethers.getSigners();

    const zkSyncGasPerPubDataLimit = 800;

    const genesisNftSeries1: FakeContract<GenesisNFTV1> = await smock.fake('GenesisNFTV1');
    const genesisNftSeries2: FakeContract<GenesisNFTV2> = await smock.fake('GenesisNFTV2');

    const genesisNFTLock: GenesisNFTLock = (await deployProxy(
      'GenesisNFTLock',
      [owner.address, genesisNftSeries1.address, genesisNftSeries2.address, zkSyncGasPerPubDataLimit],
      deployer
    )) as GenesisNFTLock;

    const genesisNFT1Mirror: FakeContract<GenesisNFTMirror> = await smock.fake('GenesisNFTMirror');
    const genesisNFT2Mirror: FakeContract<GenesisNFTMirror> = await smock.fake('GenesisNFTMirror');
    const zkSyncBridge: FakeContract<IZkSync> = await smock.fake('IZkSync');

    const bridgeTransactionHash = utils.keccak256(utils.toUtf8Bytes('bridgeTransactionHash'));
    zkSyncBridge.requestL2Transaction.returns(bridgeTransactionHash);
    const zkSyncTransactionGasLimit = 200000;

    return {
      deployer,
      owner,
      user1,
      user2,
      zkSyncGasPerPubDataLimit,
      genesisNFTLock,
      genesisNftSeries1,
      genesisNftSeries2,
      genesisNFT1Mirror,
      genesisNFT2Mirror,
      zkSyncBridge,
      bridgeTransactionHash,
      zkSyncTransactionGasLimit
    };
  };

  describe('Deployment', () => {
    it('Should deploy the contract with initial params', async () => {
      const { genesisNFTLock, owner, genesisNftSeries1, genesisNftSeries2, zkSyncGasPerPubDataLimit } =
        await loadFixture(deployGensisNFTLock);

      expect(await genesisNFTLock.owner()).to.be.equal(owner.address);
      expect(await genesisNFTLock.series1Nft()).to.be.equal(genesisNftSeries1.address);
      expect(await genesisNFTLock.series2Nft()).to.be.equal(genesisNftSeries2.address);
      expect(await genesisNFTLock.zkSyncGasPerPubdataLimit()).to.be.equal(zkSyncGasPerPubDataLimit);
      expect(await genesisNFTLock.zkSyncBridge()).to.be.equal(constants.AddressZero);
      expect(await genesisNFTLock.zkSyncGenesisNFT1Mirror()).to.be.equal(constants.AddressZero);
      expect(await genesisNFTLock.zkSyncGenesisNFT2Mirror()).to.be.equal(constants.AddressZero);
    });

    it('Should revert when owner address is zero address', async () => {
      const { genesisNFTLock, deployer, zkSyncGasPerPubDataLimit, genesisNftSeries1, genesisNftSeries2 } =
        await loadFixture(deployGensisNFTLock);

      await expect(
        deployProxy(
          'GenesisNFTLock',
          [constants.AddressZero, genesisNftSeries1.address, genesisNftSeries2.address, zkSyncGasPerPubDataLimit],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__OwnerZeroAddress');
    });

    it('Should revert when genesis nft series 1 address is zero address', async () => {
      const { genesisNFTLock, deployer, owner, zkSyncGasPerPubDataLimit, genesisNftSeries2 } = await loadFixture(
        deployGensisNFTLock
      );

      await expect(
        deployProxy(
          'GenesisNFTLock',
          [owner.address, constants.AddressZero, genesisNftSeries2.address, zkSyncGasPerPubDataLimit],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__NFTSeries1ZeroAddress');
    });

    it('Should revert when genesis nft series 2 address is zero address', async () => {
      const { genesisNFTLock, deployer, owner, zkSyncGasPerPubDataLimit, genesisNftSeries1, genesisNftSeries2 } =
        await loadFixture(deployGensisNFTLock);

      await expect(
        deployProxy(
          'GenesisNFTLock',
          [owner.address, genesisNftSeries1.address, constants.AddressZero, zkSyncGasPerPubDataLimit],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__NFTSeries2ZeroAddress');
    });

    it('Should revert when zk sync gas per pub data limit is zero', async () => {
      const { genesisNFTLock, deployer, owner, genesisNftSeries1, genesisNftSeries2 } = await loadFixture(
        deployGensisNFTLock
      );

      await expect(
        deployProxy(
          'GenesisNFTLock',
          [owner.address, genesisNftSeries1.address, genesisNftSeries2.address, 0],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__GasPerPubDataLimitZero');
    });
  });

  describe('Set zk sync bridge', () => {
    it('Should set zk sync bridge', async () => {
      const { genesisNFTLock, owner, zkSyncBridge } = await loadFixture(deployGensisNFTLock);

      await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);
      expect(await genesisNFTLock.zkSyncBridge()).to.be.equal(zkSyncBridge.address);
    });

    it("Should revert when set with zero address as zk sync bridge's address", async () => {
      const { genesisNFTLock, owner } = await loadFixture(deployGensisNFTLock);

      await expect(genesisNFTLock.connect(owner).setZkSyncBridge(constants.AddressZero)).to.revertedWithCustomError(
        genesisNFTLock,
        'GenesisNFTLock__ZkSyncBridgeZeroAddress'
      );
    });
  });

  describe("Set zk sync genesis nft series 1's mirror", () => {
    it('Should set zk sync genesis nft series 1 mirror', async () => {
      const { genesisNFTLock, owner, genesisNFT1Mirror } = await loadFixture(deployGensisNFTLock);

      await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror.address);
      expect(await genesisNFTLock.zkSyncGenesisNFT1Mirror()).to.be.equal(genesisNFT1Mirror.address);
    });

    it("Should revert when set with zero address as zk sync genesis nft series 1's mirror address", async () => {
      const { genesisNFTLock, owner } = await loadFixture(deployGensisNFTLock);

      await expect(
        genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(constants.AddressZero)
      ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__ZkSyncMirrorZeroAddress');
    });
  });

  describe("Set zk sync genesis nft series 2's mirror", () => {
    it('Should set zk sync genesis nft series 2 mirror', async () => {
      const { genesisNFTLock, owner, genesisNFT2Mirror } = await loadFixture(deployGensisNFTLock);

      await genesisNFTLock.connect(owner).setZkSyncGenesisNFT2Mirror(genesisNFT2Mirror.address);
      expect(await genesisNFTLock.zkSyncGenesisNFT2Mirror()).to.be.equal(genesisNFT2Mirror.address);
    });

    it("Should revert when set with zero address as zk sync genesis nft series 2's mirror address", async () => {
      const { genesisNFTLock, owner } = await loadFixture(deployGensisNFTLock);

      await expect(
        genesisNFTLock.connect(owner).setZkSyncGenesisNFT2Mirror(constants.AddressZero)
      ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__ZkSyncMirrorZeroAddress');
    });
  });

  describe('Set zk sync gas per pub data limit', () => {
    it('Should set zk sync gas per pub data limit', async () => {
      const { genesisNFTLock, owner } = await loadFixture(deployGensisNFTLock);
      const newGasPerPubDataLimit = 1000;

      await genesisNFTLock.connect(owner).setZkSyncGasPerPubdataLimit(newGasPerPubDataLimit);
      expect(await genesisNFTLock.zkSyncGasPerPubdataLimit()).to.be.equal(newGasPerPubDataLimit);
    });

    it('Should revert when set with zero as zk sync gas per pub data limit', async () => {
      const { genesisNFTLock, owner } = await loadFixture(deployGensisNFTLock);

      await expect(genesisNFTLock.connect(owner).setZkSyncGasPerPubdataLimit(0)).to.revertedWithCustomError(
        genesisNFTLock,
        'GenesisNFTLock__GasPerPubDataLimitZero'
      );
    });
  });

  describe('Lock series 1 tokens', () => {
    beforeEach(async () => {
      const { genesisNftSeries1 } = await loadFixture(deployGensisNFTLock);
      genesisNftSeries1['safeTransferFrom(address,address,uint256)'].reset();
    });

    describe('Reverts', () => {
      it('Should revert when not enough ether sent', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = [1];

        await expect(
          genesisNFTLock.lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit)
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__NotEnoughGas');
      });

      it('Should revert when more tokens then limit', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = Array(180).fill(0);
        await expect(
          genesisNFTLock.lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensLimitReached');
      });

      it('Should revert when a token transfered failed', async () => {
        const { genesisNftSeries1, genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(
          deployGensisNFTLock
        );
        const tokenIds = [1];
        genesisNftSeries1['safeTransferFrom(address,address,uint256)'].reverts('Transfered failed');
        await expect(
          genesisNFTLock.lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.be.reverted;
      });

      it('Should revert when zk sync mirror for series 1 is not set', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, genesisNftSeries1, user1 } = await loadFixture(
          deployGensisNFTLock
        );
        const tokenIds = [1];

        await expect(
          genesisNFTLock.lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__ZkSyncMirrorZeroAddress');
      });

      it('Should revert when zk sync bridge is not set', async () => {
        const { owner, genesisNFTLock, genesisNFT1Mirror, zkSyncTransactionGasLimit, genesisNftSeries1, user1 } =
          await loadFixture(deployGensisNFTLock);
        const tokenIds = [1];

        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror.address);

        await expect(
          genesisNFTLock.lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__ZkSyncBridgeZeroAddress');
      });

      it("Should revert when empty token's array", async () => {
        const { genesisNFT1Mirror, owner, zkSyncBridge, genesisNFTLock, zkSyncTransactionGasLimit, user1 } =
          await loadFixture(deployGensisNFTLock);
        const tokenIds: number[] = [];

        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        await expect(
          genesisNFTLock.lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensEmptyIds');
      });
    });

    describe('Lock tokens', () => {
      const setup = async () => {
        const {
          owner,
          genesisNFTLock,
          genesisNFT1Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash
        } = await loadFixture(deployGensisNFTLock);
        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        return {
          owner,
          genesisNFTLock,
          genesisNFT1Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash
        };
      };

      it('Should lock series 1 tokens', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, bridgeTransactionHash } = await loadFixture(setup);
        const tokenIds = [1, 2, 3];

        await expect(
          genesisNFTLock.connect(user1).lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(0, 1, tokenIds, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series1LockedTokens(user1.address)).to.deep.eq(tokenIds);
        expect(await genesisNFTLock.series1LockedTokenOwner(1)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(3)).to.be.eq(user1.address);
      });

      it('Should second user lock series 1 tokens', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, user2, bridgeTransactionHash } = await loadFixture(
          setup
        );
        const user1TokenIds = [1, 2, 3];
        const user2TokensIds = [4, 5, 6];

        await genesisNFTLock.lockSeries1Tokens(user1TokenIds, user1.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });

        await expect(
          genesisNFTLock.connect(user2).lockSeries1Tokens(user2TokensIds, user2.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(0, 1, user2TokensIds, user2.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series1LockedTokens(user2.address)).to.deep.eq(user2TokensIds);
        expect(await genesisNFTLock.series1LockedTokenOwner(4)).to.be.eq(user2.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(5)).to.be.eq(user2.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(6)).to.be.eq(user2.address);

        expect(await genesisNFTLock.series1LockedTokenOwner(1)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(3)).to.be.eq(user1.address);
      });

      it('Should lock next tokens', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, bridgeTransactionHash } = await loadFixture(setup);
        const tokenIds = [1, 2, 3];
        await genesisNFTLock.connect(user1).lockSeries1Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });
        const nextTokenIds = [4, 5, 6];

        await expect(
          genesisNFTLock.connect(user1).lockSeries1Tokens(nextTokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(0, 1, nextTokenIds, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series1LockedTokens(user1.address)).to.deep.eq(tokenIds.concat(nextTokenIds));
        expect(await genesisNFTLock.series1LockedTokenOwner(1)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(3)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(4)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(5)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(6)).to.be.eq(user1.address);
      });
    });
  });

  describe('Unlock series 1 tokens', () => {
    beforeEach(async () => {
      const { genesisNftSeries1 } = await loadFixture(deployGensisNFTLock);
      genesisNftSeries1['safeTransferFrom(address,address,uint256)'].reset();
    });

    describe('Reverts', () => {
      it('Should revert when not enough ether sent', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = [1];

        await expect(
          genesisNFTLock.unlockSeries1Tokens(tokenIds, zkSyncTransactionGasLimit)
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__NotEnoughGas');
      });

      it('Should revert when more tokens then limit', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = Array(180).fill(0);
        await expect(
          genesisNFTLock.unlockSeries1Tokens(tokenIds, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensLimitReached');
      });

      it('Should revert when a token transfered failed', async () => {
        const { genesisNftSeries1, genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(
          deployGensisNFTLock
        );
        const tokenIds = [1];
        genesisNftSeries1['safeTransferFrom(address,address,uint256)'].reverts('Transfered failed');
        await expect(
          genesisNFTLock.unlockSeries1Tokens(tokenIds, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.be.reverted;
      });

      it("Should revert when empty token's array", async () => {
        const { genesisNFT1Mirror, owner, zkSyncBridge, genesisNFTLock, zkSyncTransactionGasLimit, user1 } =
          await loadFixture(deployGensisNFTLock);
        const tokenIds: number[] = [];

        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        await expect(
          genesisNFTLock.unlockSeries1Tokens(tokenIds, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensEmptyIds');
      });
    });

    describe('Unlock tokens', () => {
      const setup = async () => {
        const {
          owner,
          genesisNFTLock,
          genesisNFT1Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash
        } = await loadFixture(deployGensisNFTLock);
        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        const user1Tokens = [1, 2, 3];
        const user2Tokens = [4, 5, 6];
        await genesisNFTLock.connect(user1).lockSeries1Tokens(user1Tokens, user1.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });

        await genesisNFTLock.connect(user2).lockSeries1Tokens(user2Tokens, user2.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });

        return {
          owner,
          genesisNFTLock,
          genesisNFT1Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash,
          user1Tokens,
          user2Tokens
        };
      };

      it("Should unlock all user1's tokens", async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, user1Tokens, bridgeTransactionHash } =
          await loadFixture(setup);

        await expect(
          genesisNFTLock.connect(user1).unlockSeries1Tokens(user1Tokens, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 1, user1Tokens, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series1LockedTokens(user1.address)).to.be.empty;
        expect(await genesisNFTLock.series1LockedTokenOwner(1)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(2)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(3)).to.be.eq(constants.AddressZero);
      });

      it("Should unlock some user1's tokens", async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, user1Tokens, bridgeTransactionHash } =
          await loadFixture(setup);

        const tokensToUnlock = [3, 1];

        await expect(
          genesisNFTLock.connect(user1).unlockSeries1Tokens(tokensToUnlock, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 1, tokensToUnlock, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series1LockedTokens(user1.address)).to.deep.eq([2]);
        expect(await genesisNFTLock.series1LockedTokenOwner(1)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series1LockedTokenOwner(3)).to.be.eq(constants.AddressZero);
      });

      it("Should unlock user1's tokens and user2's tokens", async () => {
        const {
          genesisNFTLock,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          user1Tokens,
          user2Tokens,
          bridgeTransactionHash
        } = await loadFixture(setup);

        await expect(
          genesisNFTLock.connect(user1).unlockSeries1Tokens(user1Tokens, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 1, user1Tokens, user1.address, bridgeTransactionHash);

        await expect(
          genesisNFTLock.connect(user2).unlockSeries1Tokens(user2Tokens, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 1, user2Tokens, user2.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series1LockedTokens(user1.address)).to.be.empty;
        expect(await genesisNFTLock.series1LockedTokenOwner(1)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(2)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(3)).to.be.eq(constants.AddressZero);

        expect(await genesisNFTLock.series1LockedTokens(user2.address)).to.be.empty;
        expect(await genesisNFTLock.series1LockedTokenOwner(4)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(5)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series1LockedTokenOwner(6)).to.be.eq(constants.AddressZero);
      });

      it("Should revert when not caller's tokens", async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user2, user1Tokens } = await loadFixture(setup);
        const tokensToUnlock = user1Tokens.slice(0, 1);

        await expect(
          genesisNFTLock.connect(user2).unlockSeries1Tokens(tokensToUnlock, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock_NotTokenOwner')
          .withArgs(tokensToUnlock[0], user2.address);
      });
    });
  });

  describe('Lock series 2 tokens', () => {
    beforeEach(async () => {
      const { genesisNftSeries2 } = await loadFixture(deployGensisNFTLock);
      genesisNftSeries2['safeTransferFrom(address,address,uint256)'].reset();
    });
    describe('Reverts', () => {
      it('Should revert when not enough ether sent', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = [1];

        await expect(
          genesisNFTLock.lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit)
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__NotEnoughGas');
      });

      it('Should revert when more tokens then limit', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = Array(180).fill(0);
        await expect(
          genesisNFTLock.lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensLimitReached');
      });

      it('Should revert when a token transfered failed', async () => {
        const { genesisNftSeries2, genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(
          deployGensisNFTLock
        );
        const tokenIds = [1];
        genesisNftSeries2['safeTransferFrom(address,address,uint256)'].reverts('Transfered failed');
        await expect(
          genesisNFTLock.lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.be.reverted;
      });

      it('Should revert when zk sync mirror for series 2 is not set', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(deployGensisNFTLock);
        const tokenIds = [1];
        await expect(
          genesisNFTLock.lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__ZkSyncMirrorZeroAddress');
      });

      it('Should revert when zk sync bridge is not set', async () => {
        const { owner, genesisNFTLock, genesisNFT1Mirror, zkSyncTransactionGasLimit, user1 } = await loadFixture(
          deployGensisNFTLock
        );
        const tokenIds = [1];
        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT2Mirror(genesisNFT1Mirror.address);

        await expect(
          genesisNFTLock.lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__ZkSyncBridgeZeroAddress');
      });

      it("Should revert when empty token's array", async () => {
        const { genesisNFT2Mirror, owner, zkSyncBridge, genesisNFTLock, zkSyncTransactionGasLimit, user1 } =
          await loadFixture(deployGensisNFTLock);
        const tokenIds: number[] = [];

        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT2Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        await expect(
          genesisNFTLock.lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensEmptyIds');
      });
    });

    describe('Lock tokens', () => {
      const setup = async () => {
        const {
          owner,
          genesisNFTLock,
          genesisNFT2Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash
        } = await loadFixture(deployGensisNFTLock);
        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT2Mirror(genesisNFT2Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        return {
          owner,
          genesisNFTLock,
          genesisNFT2Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash
        };
      };

      it('Should lock series 2 tokens', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, bridgeTransactionHash } = await loadFixture(setup);
        const tokenIds = [1, 2, 3];

        await expect(
          genesisNFTLock.connect(user1).lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(0, 2, tokenIds, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series2LockedTokens(user1.address)).to.deep.eq(tokenIds);
        expect(await genesisNFTLock.series2LockedTokenOwner(1)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(3)).to.be.eq(user1.address);
      });

      it('Should second user lock series 2 tokens', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, user2, bridgeTransactionHash } = await loadFixture(
          setup
        );
        const user1TokenIds = [1, 2, 3];
        const user2TokensIds = [4, 5, 6];

        await genesisNFTLock.lockSeries2Tokens(user1TokenIds, user1.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });

        await expect(
          genesisNFTLock.connect(user2).lockSeries2Tokens(user2TokensIds, user2.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(0, 2, user2TokensIds, user2.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series2LockedTokens(user2.address)).to.deep.eq(user2TokensIds);
        expect(await genesisNFTLock.series2LockedTokenOwner(4)).to.be.eq(user2.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(5)).to.be.eq(user2.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(6)).to.be.eq(user2.address);

        expect(await genesisNFTLock.series2LockedTokenOwner(1)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(3)).to.be.eq(user1.address);
      });

      it('Should lock next tokens', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, bridgeTransactionHash } = await loadFixture(setup);
        const tokenIds = [1, 2, 3];
        await genesisNFTLock.connect(user1).lockSeries2Tokens(tokenIds, user1.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });
        const nextTokenIds = [4, 5, 6];

        await expect(
          genesisNFTLock.connect(user1).lockSeries2Tokens(nextTokenIds, user1.address, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(0, 2, nextTokenIds, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series2LockedTokens(user1.address)).to.deep.eq(tokenIds.concat(nextTokenIds));
        expect(await genesisNFTLock.series2LockedTokenOwner(1)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(3)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(4)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(5)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(6)).to.be.eq(user1.address);
      });
    });
  });

  describe('Unlock series 2 tokens', () => {
    beforeEach(async () => {
      const { genesisNftSeries2 } = await loadFixture(deployGensisNFTLock);
      genesisNftSeries2['safeTransferFrom(address,address,uint256)'].reset();
    });
    describe('Reverts', () => {
      it('Should revert when not enough ether sent', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit } = await loadFixture(deployGensisNFTLock);
        const tokenIds = [1];

        await expect(
          genesisNFTLock.unlockSeries2Tokens(tokenIds, zkSyncTransactionGasLimit)
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__NotEnoughGas');
      });

      it('Should revert when more tokens then limit', async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit } = await loadFixture(deployGensisNFTLock);
        const tokenIds = Array(180).fill(0);
        await expect(
          genesisNFTLock.unlockSeries2Tokens(tokenIds, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensLimitReached');
      });

      it('Should revert when a token transfered failed', async () => {
        const { genesisNftSeries2, genesisNFTLock, zkSyncTransactionGasLimit, user1 } = await loadFixture(
          deployGensisNFTLock
        );
        const tokenIds = [1];
        genesisNftSeries2['safeTransferFrom(address,address,uint256)'].reverts('Transfered failed');
        await expect(
          genesisNFTLock.unlockSeries2Tokens(tokenIds, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.be.reverted;
      });
      it("Should revert when empty token's array", async () => {
        const { genesisNFT2Mirror, owner, zkSyncBridge, genesisNFTLock, zkSyncTransactionGasLimit, user1 } =
          await loadFixture(deployGensisNFTLock);
        const tokenIds: number[] = [];

        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT1Mirror(genesisNFT2Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        await expect(
          genesisNFTLock.unlockSeries2Tokens(tokenIds, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        ).to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock__TokensEmptyIds');
      });
    });

    describe('Unlock tokens', () => {
      const setup = async () => {
        const {
          owner,
          genesisNFTLock,
          genesisNFT2Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash
        } = await loadFixture(deployGensisNFTLock);
        await genesisNFTLock.connect(owner).setZkSyncGenesisNFT2Mirror(genesisNFT2Mirror.address);
        await genesisNFTLock.connect(owner).setZkSyncBridge(zkSyncBridge.address);

        const user1Tokens = [1, 2, 3];
        const user2Tokens = [4, 5, 6];
        await genesisNFTLock.connect(user1).lockSeries2Tokens(user1Tokens, user1.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });

        await genesisNFTLock.connect(user2).lockSeries2Tokens(user2Tokens, user2.address, zkSyncTransactionGasLimit, {
          value: zkSyncTransactionGasLimit
        });

        return {
          owner,
          genesisNFTLock,
          genesisNFT2Mirror,
          zkSyncBridge,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          bridgeTransactionHash,
          user1Tokens,
          user2Tokens
        };
      };

      it("Should unlock all user1's tokens", async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, user1Tokens, bridgeTransactionHash } =
          await loadFixture(setup);

        await expect(
          genesisNFTLock.connect(user1).unlockSeries2Tokens(user1Tokens, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 2, user1Tokens, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series2LockedTokens(user1.address)).to.be.empty;
        expect(await genesisNFTLock.series2LockedTokenOwner(1)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(2)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(3)).to.be.eq(constants.AddressZero);
      });

      it("Should unlock some user1's tokens", async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user1, bridgeTransactionHash } = await loadFixture(setup);

        const tokensToUnlock = [3, 1];

        await expect(
          genesisNFTLock.connect(user1).unlockSeries2Tokens(tokensToUnlock, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 2, tokensToUnlock, user1.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series2LockedTokens(user1.address)).to.deep.eq([2]);
        expect(await genesisNFTLock.series2LockedTokenOwner(1)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(2)).to.be.eq(user1.address);
        expect(await genesisNFTLock.series2LockedTokenOwner(3)).to.be.eq(constants.AddressZero);
      });

      it("Should unlock user1's tokens and user2's tokens", async () => {
        const {
          genesisNFTLock,
          zkSyncTransactionGasLimit,
          user1,
          user2,
          user1Tokens,
          user2Tokens,
          bridgeTransactionHash
        } = await loadFixture(setup);

        await expect(
          genesisNFTLock.connect(user1).unlockSeries2Tokens(user1Tokens, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 2, user1Tokens, user1.address, bridgeTransactionHash);

        await expect(
          genesisNFTLock.connect(user2).unlockSeries2Tokens(user2Tokens, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.emit(genesisNFTLock, 'ZkSyncNotified')
          .withArgs(1, 2, user2Tokens, user2.address, bridgeTransactionHash);

        expect(await genesisNFTLock.series2LockedTokens(user1.address)).to.be.empty;
        expect(await genesisNFTLock.series2LockedTokenOwner(1)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(2)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(3)).to.be.eq(constants.AddressZero);

        expect(await genesisNFTLock.series2LockedTokens(user2.address)).to.be.empty;
        expect(await genesisNFTLock.series2LockedTokenOwner(4)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(5)).to.be.eq(constants.AddressZero);
        expect(await genesisNFTLock.series2LockedTokenOwner(6)).to.be.eq(constants.AddressZero);
      });

      it("Should revert when not caller's tokens", async () => {
        const { genesisNFTLock, zkSyncTransactionGasLimit, user2, user1Tokens } = await loadFixture(setup);
        const tokensToUnlock = user1Tokens.slice(0, 1);

        await expect(
          genesisNFTLock.connect(user2).unlockSeries2Tokens(tokensToUnlock, zkSyncTransactionGasLimit, {
            value: zkSyncTransactionGasLimit
          })
        )
          .to.revertedWithCustomError(genesisNFTLock, 'GenesisNFTLock_NotTokenOwner')
          .withArgs(tokensToUnlock[0], user2.address);
      });
    });
  });
});
