import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFT, IERC721Mintable__factory } from '../../typechain-types';
import { getInterfaceId, keccak256, missing_role } from '../utils';

describe('Common Wealth Genesis NFT unit tests', () => {
  const DEFAULT_ADMIN_ROLE = constants.HashZero;
  const MINTER_ROLE = keccak256('MINTER_ROLE');
  const PAUSER_ROLE = keccak256('PAUSER_ROLE');
  const royalty = 650;
  const defaultTokenURI = 'ipfs://token-uri.json';
  const IERC721MintableId = utils.arrayify(getInterfaceId(IERC721Mintable__factory.createInterface()));

  const deployGenesisNft = async () => {
    const [deployer, owner, royaltyWallet] = await ethers.getSigners();

    const genesisNft: GenesisNFT = await deployProxy('GenesisNFT', deployer, [
      owner.address,
      royaltyWallet.address,
      royalty
    ]);

    return { genesisNft, deployer, owner };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.name()).to.equal('Common Wealth Genesis NFT');
      expect(await genesisNft.symbol()).to.equal('CWGNFT');
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
      expect(await genesisNft.hasRole(MINTER_ROLE, owner.address)).to.equal(true);
      expect(await genesisNft.hasRole(PAUSER_ROLE, owner.address)).to.equal(true);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(false);
      expect(await genesisNft.hasRole(MINTER_ROLE, deployer.address)).to.equal(false);
      expect(await genesisNft.hasRole(PAUSER_ROLE, deployer.address)).to.equal(false);
      expect(await genesisNft.supportsInterface(IERC721MintableId)).to.equal(true);
    });

    it('Should revert deployment if owner is zero address', async () => {
      const [deployer, owner, royaltyAccount] = await ethers.getSigners();

      await expect(
        deployProxy('GenesisNFT', deployer, [constants.AddressZero, royaltyAccount.address, royalty])
      ).to.be.revertedWith('Owner account is zero address');
    });

    it('Should revert deployment if invalid royalty parameters', async () => {
      const [deployer, owner, royaltyAccount] = await ethers.getSigners();

      await expect(
        deployProxy('GenesisNFT', deployer, [owner.address, constants.AddressZero, royalty])
      ).to.be.revertedWith('ERC2981: invalid receiver');

      await expect(
        deployProxy('GenesisNFT', deployer, [owner.address, royaltyAccount.address, 10001])
      ).to.be.revertedWith('ERC2981: royalty fee will exceed salePrice');
    });
  });

  describe('#transferOwnership()', () => {
    it('Should transfer ownership', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).transferOwnership(deployer.address);

      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.hasRole(MINTER_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.hasRole(PAUSER_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
      expect(await genesisNft.hasRole(MINTER_ROLE, deployer.address)).to.equal(true);
      expect(await genesisNft.hasRole(PAUSER_ROLE, deployer.address)).to.equal(true);
    });

    it('Should transfer ownership if paused', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await genesisNft.connect(owner).transferOwnership(deployer.address);

      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.hasRole(MINTER_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.hasRole(PAUSER_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
      expect(await genesisNft.hasRole(MINTER_ROLE, deployer.address)).to.equal(true);
      expect(await genesisNft.hasRole(PAUSER_ROLE, deployer.address)).to.equal(true);
    });

    it('Should revert transferring ownership if not owner', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).transferOwnership(deployer.address)).to.be.revertedWith(
        missing_role(deployer.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it('Should revert transferring ownership new owner is zero address', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).transferOwnership(constants.AddressZero)).to.be.revertedWith(
        'New owner is zero address'
      );
    });
  });

  describe('#mint()', () => {
    it('Should mint NFTs', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1, defaultTokenURI);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(1);
      expect(await genesisNft.ownerOf(0)).to.equal(deployer.address);
      expect(await genesisNft.tokenURI(0)).to.equal(defaultTokenURI);

      await genesisNft.connect(owner).mint(deployer.address, 2, defaultTokenURI);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(3);
      expect(await genesisNft.ownerOf(1)).to.equal(deployer.address);
      expect(await genesisNft.ownerOf(2)).to.equal(deployer.address);
    });

    it('Should mint NFT to one recipient multiple times', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1, defaultTokenURI);
      await genesisNft.connect(owner).mint(deployer.address, 1, defaultTokenURI);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(2);
    });

    it('Should revert minting if not minter', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).mint(deployer.address, 1, defaultTokenURI)).to.be.revertedWith(
        missing_role(deployer.address, MINTER_ROLE)
      );
    });

    it('Should revert minting if paused and mint after unpaused', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await expect(genesisNft.connect(owner).mint(deployer.address, 1, defaultTokenURI)).to.be.revertedWith(
        'Pausable: paused'
      );

      await genesisNft.connect(owner).unpause();
      await genesisNft.connect(owner).mint(deployer.address, 1, defaultTokenURI);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(1);
    });

    it('Should revert minting if recipient is zero address', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mint(constants.AddressZero, 1, defaultTokenURI)).to.be.revertedWith(
        'Recipient is zero address'
      );
    });
  });

  describe('#mintBatch()', () => {
    const defaultAmount = 10;

    it('Should mint NFTs in batch', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintBatch([deployer.address], [defaultAmount], defaultTokenURI);

      for (let i = 0; i < defaultAmount; i++) {
        expect(await genesisNft.ownerOf(i)).to.equal(deployer.address);
        expect(await genesisNft.tokenURI(i)).to.equal(defaultTokenURI);
      }
      expect(await genesisNft.balanceOf(deployer.address)).to.equal(defaultAmount);
    });

    [
      { recipients: ['0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'], amounts: [1] },
      {
        recipients: ['0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', '0xdD2FD4581271e230360230F9337D5c0430Bf44C0'],
        amounts: [1, 3]
      },
      {
        recipients: ['0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', '0xdD2FD4581271e230360230F9337D5c0430Bf44C0'],
        amounts: [2, 2]
      }
    ].forEach((data) => {
      it('Should mint NFTs in batch to multiple recipients', async () => {
        const { genesisNft, owner } = await loadFixture(deployGenesisNft);

        await genesisNft.connect(owner).mintBatch(data.recipients, data.amounts, defaultTokenURI);

        data.recipients.forEach(async (account, index) => {
          expect(await genesisNft.balanceOf(account)).to.equal(data.amounts[index]);
        });
      });
    });

    it('Should mint NFTs in batch to recipient multiple times', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintBatch([deployer.address], [1], defaultTokenURI);
      await genesisNft.connect(owner).mintBatch([deployer.address], [2], defaultTokenURI);
      expect(await genesisNft.balanceOf(deployer.address)).to.equal(3);
    });

    it('Should not mint in batch if no recipients passed', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintBatch([], [], defaultTokenURI);
      expect(await genesisNft.totalSupply()).to.equal(0);
    });

    it('Should revert minting in batch if not minter', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(
        genesisNft.connect(deployer).mintBatch([deployer.address], [defaultAmount], defaultTokenURI)
      ).to.be.revertedWith(missing_role(deployer.address, MINTER_ROLE));
    });

    it('Should revert minting in batch if paused and mint after unpaused', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address], [defaultAmount], defaultTokenURI)
      ).to.be.revertedWith('Pausable: paused');

      await genesisNft.connect(owner).unpause();
      await genesisNft.connect(owner).mintBatch([deployer.address], [defaultAmount], defaultTokenURI);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(defaultAmount);
    });

    it('Should revert minting in batch if recipients and amount length mismatch', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([], [1], defaultTokenURI)).to.be.revertedWith(
        'Recipients and amounts length mismatch'
      );

      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [], defaultTokenURI)).to.be.revertedWith(
        'Recipients and amounts length mismatch'
      );
    });

    it('Should revert minting in batch if recipient is zero address', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(
        genesisNft.connect(owner).mintBatch([constants.AddressZero], [1], defaultTokenURI)
      ).to.be.revertedWith('Recipient is zero address');

      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address, constants.AddressZero], [1, 1], defaultTokenURI)
      ).to.be.revertedWith('Recipient is zero address');
    });

    it('Should revert minting in batch if amount is zero', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [0], defaultTokenURI)).to.be.revertedWith(
        'Tokens amount is equal to zero'
      );

      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address, deployer.address], [1, 0], defaultTokenURI)
      ).to.be.revertedWith('Tokens amount is equal to zero');
    });
  });

  describe('#balanceOfBatch()', () => {
    it('Should return balance of multiple accounts', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.balanceOfBatch([])).to.deep.equal([]);

      await genesisNft.connect(owner).mintBatch([deployer.address, owner.address], [1, 3], defaultTokenURI);
      expect(await genesisNft.balanceOfBatch([deployer.address, owner.address])).to.deep.equal([1, 3]);
    });
  });
});
