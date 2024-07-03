import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFT, IERC721Mintable__factory, IGenesisNFT__factory, GenesisNFTVesting } from '../../typechain-types';
import { getInterfaceId, keccak256, missing_role, toWlth } from '../utils';
import { FakeContract, smock } from '@defi-wonderland/smock';

describe.only('Genesis NFT unit tests', () => {
  const DEFAULT_ADMIN_ROLE = constants.HashZero;
  const MINTER_ROLE = keccak256('MINTER_ROLE');
  const PAUSER_ROLE = keccak256('PAUSER_ROLE');
  const name = 'Common Wealth Genesis NFT Series 1';
  const symbol = 'CWOGS1';
  const series = 1;
  const royalty = 650;
  const defaultTokenURI = 'ipfs://token-uri';
  const IERC721MintableId = utils.arrayify(getInterfaceId(IERC721Mintable__factory.createInterface()));
  const IGenesisNFTId = utils.arrayify(getInterfaceId(IGenesisNFT__factory.createInterface()));
  const mName = 'Name';
  const description = 'Description';
  const externalUrl = 'External Url';
  const id = '1';
  const token_allocation = toWlth("44000");
  const series1 = true;
  const percentage = "12%";
 


  const metadata = {
    name: mName,
    description: description,
    externalUrl: externalUrl,
    id: id,
    percentage: percentage
  };

  const images = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]

  const deployGenesisNft = async () => {
    const [deployer, owner, admin, minter, pauser, royaltyWallet] = await ethers.getSigners();

    const vestingContractMock: FakeContract<GenesisNFTVesting> = await smock.fake('GenesisNFTVesting');

    const genesisNft: GenesisNFT = await deployProxy(
      'GenesisNFT',
      [name, symbol, series, owner.address, royaltyWallet.address, royalty, defaultTokenURI, metadata, token_allocation, series1, images],
      deployer
    );
    await genesisNft.connect(owner).grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await genesisNft.connect(owner).grantRole(MINTER_ROLE, minter.address);
    await genesisNft.connect(owner).grantRole(PAUSER_ROLE, pauser.address);

    return { genesisNft, deployer, owner, admin, minter, pauser, vestingContractMock };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { genesisNft, deployer, owner, admin, minter, pauser } = await loadFixture(deployGenesisNft);

      const validateRoles = (account: string, withRoles: string[], withoutRoles: string[]) => {
        withRoles.forEach(async (role) => {
          expect(await genesisNft.hasRole(role, account)).to.equal(true);
        });

        withoutRoles.forEach(async (role) => {
          expect(await genesisNft.hasRole(role, account)).to.equal(false);
        });
      };

      expect(await genesisNft.name()).to.equal(name);
      expect(await genesisNft.symbol()).to.equal(symbol);
      expect(await genesisNft.getSeries()).to.equal(series);
      expect(await genesisNft.supportsInterface(IGenesisNFTId)).to.equal(true);
      expect(await genesisNft.supportsInterface(IERC721MintableId)).to.equal(true);
      validateRoles(owner.address, [DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE], []);
      validateRoles(deployer.address, [], [DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE]);
      validateRoles(admin.address, [DEFAULT_ADMIN_ROLE], [MINTER_ROLE, PAUSER_ROLE]);
      validateRoles(minter.address, [MINTER_ROLE], [DEFAULT_ADMIN_ROLE, PAUSER_ROLE]);
      validateRoles(pauser.address, [PAUSER_ROLE], [DEFAULT_ADMIN_ROLE, MINTER_ROLE]);
      await expect(genesisNft.tokenURI(0)).to.be.revertedWith('ERC721: invalid token ID');
    });

    it('Should revert when already initialized', async () => {
      const { genesisNft, deployer, owner, admin, minter, pauser } = await loadFixture(deployGenesisNft);

      await expect(
        genesisNft.initialize(name, symbol, series, owner.address, owner.address, royalty, defaultTokenURI, metadata, token_allocation, series1, images)
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });

    it('Should revert deployment if owner is zero address', async () => {
      const { genesisNft } = await loadFixture(deployGenesisNft);
      const [deployer, royaltyAccount] = await ethers.getSigners();

      await expect(
        deployProxy(
          'GenesisNFT',
          [name, symbol, series, constants.AddressZero, royaltyAccount.address, royalty, defaultTokenURI, metadata, token_allocation, series1, images],
          deployer
        )
      ).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__ZeroAddress');
    });

    it('Should revert deployment if invalid royalty parameters', async () => {
      const [deployer, owner, royaltyAccount] = await ethers.getSigners();

      await expect(
        deployProxy(
          'GenesisNFT',
          [name, symbol, series, owner.address, constants.AddressZero, royalty, defaultTokenURI, metadata, token_allocation, series1, images],
          deployer
        )
      ).to.be.revertedWith('ERC2981: invalid receiver');

      await expect(
        deployProxy(
          'GenesisNFT',
          [name, symbol, series, owner.address, royaltyAccount.address, 10001, defaultTokenURI, metadata, token_allocation, series1, images],
          deployer
        )
      ).to.be.revertedWith('ERC2981: royalty fee will exceed salePrice');
    });
  });

  describe('#setOwner()', () => {
    it('Should set owner', async () => {
      const { genesisNft, deployer, owner, admin } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.owner()).to.equal(owner.address);
      await genesisNft.connect(admin).setOwner(deployer.address);

      expect(await genesisNft.owner()).to.equal(deployer.address);

      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(false);
    });

    it('Should set owner if paused', async () => {
      const { genesisNft, deployer, admin, pauser } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(pauser).pause();
      await genesisNft.connect(admin).setOwner(deployer.address);

      expect(await genesisNft.owner()).to.equal(deployer.address);
    });

    it('Should revert setting owner if not admin', async () => {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(minter).setOwner(minter.address)).to.be.revertedWith(
        missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it('Should revert setting owner if new owner is zero address', async () => {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(admin).setOwner(constants.AddressZero)).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__ZeroAddress'
      );
    });
  });

  describe('#revokeRole()', () => {
    it('Should revoke minter and pauser roles if admin', async () => {
      const { genesisNft, admin, minter, pauser } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await genesisNft.hasRole(MINTER_ROLE, minter.address)).to.equal(true);
      expect(await genesisNft.hasRole(PAUSER_ROLE, pauser.address)).to.equal(true);

      await genesisNft.connect(admin).revokeRole(MINTER_ROLE, minter.address);
      expect(await genesisNft.hasRole(MINTER_ROLE, minter.address)).to.equal(false);

      await genesisNft.connect(admin).revokeRole(PAUSER_ROLE, pauser.address);
      expect(await genesisNft.hasRole(PAUSER_ROLE, pauser.address)).to.equal(false);

      await genesisNft.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, admin.address);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(false);
    });

    it('Should revoke permanently all admin roles if admin', async () => {
      const { genesisNft, owner, admin } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await genesisNft.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).to.equal(2);

      await genesisNft.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, owner.address);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(false);
      expect(await genesisNft.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).to.equal(1);

      await genesisNft.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, admin.address);
      expect(await genesisNft.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(false);
      expect(await genesisNft.getRoleMemberCount(DEFAULT_ADMIN_ROLE)).to.equal(0);

      await expect(genesisNft.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.reverted;
    });

    it('Should revert revoking role if not role admin', async () => {
      const { genesisNft, admin, minter, pauser } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(minter).revokeRole(MINTER_ROLE, minter.address)).to.be.revertedWith(
        missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );

      await expect(genesisNft.connect(pauser).revokeRole(PAUSER_ROLE, pauser.address)).to.be.revertedWith(
        missing_role(pauser.address, DEFAULT_ADMIN_ROLE)
      );

      await expect(genesisNft.connect(minter).revokeRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.revertedWith(
        missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });
  });

  describe('#mint()', () => {
    it('Should mint NFTs', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(1);
      expect(await genesisNft.ownerOf(0)).to.equal(deployer.address);

      await genesisNft.connect(owner).mint(deployer.address, 2);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(3);
      expect(await genesisNft.ownerOf(1)).to.equal(deployer.address);
      expect(await genesisNft.ownerOf(2)).to.equal(deployer.address);
    });

    it('Should mint NFT to one recipient multiple times', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1);
      await genesisNft.connect(owner).mint(deployer.address, 1);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(2);
    });

    it('Should revert minting if not minter', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).mint(deployer.address, 1)).to.be.revertedWith(
        missing_role(deployer.address, MINTER_ROLE)
      );
    });

    it('Should revert minting if paused and mint after unpaused', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await expect(genesisNft.connect(owner).mint(deployer.address, 1)).to.be.revertedWith('Pausable: paused');

      await genesisNft.connect(owner).unpause();
      await genesisNft.connect(owner).mint(deployer.address, 1);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(1);
    });

    it('Should revert minting if recipient is zero address', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mint(constants.AddressZero, 1)).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__ZeroAddress'
      );
    });

    it('Should revert minting if amount is zero', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mint(owner.address, 0)).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__ZeroAmount'
      );
    });
  });

  describe('#mintWithIds()', () => {
    it('Should mint NFTs', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintWithIds(deployer.address, [0, 5]);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(2);
      expect(await genesisNft.ownerOf(0)).to.equal(deployer.address);
      expect(await genesisNft.ownerOf(5)).to.equal(deployer.address);
    });

    it('Should revert minting if not minter', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).mintWithIds(deployer.address, [1])).to.be.revertedWith(
        missing_role(deployer.address, MINTER_ROLE)
      );
    });

    it('Should revert minting if paused and mint after unpaused', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await expect(genesisNft.connect(owner).mintWithIds(deployer.address, [1])).to.be.revertedWith('Pausable: paused');

      await genesisNft.connect(owner).unpause();
      await genesisNft.connect(owner).mintWithIds(deployer.address, [1]);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(1);
    });

    it('Should revert minting if recipient is zero address', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintWithIds(constants.AddressZero, [1])).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__ZeroAddress'
      );
    });

    it('Should revert minting if id has been already minted', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);
      await genesisNft.connect(owner).mintWithIds(owner.address, [0, 1, 2, 3, 4]);

      await expect(genesisNft.connect(owner).mintWithIds(owner.address, [3])).to.be.revertedWith(
        'ERC721: token already minted'
      );
    });
  });

  describe('#mintBatch()', () => {
    const defaultAmount = 10;

    it('Should mint NFTs in batch', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintBatch([deployer.address], [defaultAmount]);

      for (let i = 0; i < defaultAmount; i++) {
        expect(await genesisNft.ownerOf(i)).to.equal(deployer.address);
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

        await genesisNft.connect(owner).mintBatch(data.recipients, data.amounts);

        data.recipients.forEach(async (account, index) => {
          expect(await genesisNft.balanceOf(account)).to.equal(data.amounts[index]);
        });
      });
    });

    it('Should mint NFTs in batch to recipient multiple times', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintBatch([deployer.address], [1]);
      await genesisNft.connect(owner).mintBatch([deployer.address], [2]);
      expect(await genesisNft.balanceOf(deployer.address)).to.equal(3);
    });

    it('Should not mint in batch if no recipients passed', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mintBatch([], []);
      expect(await genesisNft.totalSupply()).to.equal(0);
    });

    it('Should revert minting in batch if not minter', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).mintBatch([deployer.address], [defaultAmount])).to.be.revertedWith(
        missing_role(deployer.address, MINTER_ROLE)
      );
    });

    it('Should revert minting in batch if paused and mint after unpaused', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [defaultAmount])).to.be.revertedWith(
        'Pausable: paused'
      );

      await genesisNft.connect(owner).unpause();
      await genesisNft.connect(owner).mintBatch([deployer.address], [defaultAmount]);

      expect(await genesisNft.balanceOf(deployer.address)).to.equal(defaultAmount);
    });

    it('Should revert minting in batch if recipients and amount length mismatch', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([], [1])).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__LengthMismatch'
      );

      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [])).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__LengthMismatch'
      );
    });

    it('Should revert minting in batch if recipient is zero address', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([constants.AddressZero], [1])).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__ZeroAddress'
      );

      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address, constants.AddressZero], [1, 1])
      ).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__ZeroAddress');
    });

    it('Should revert minting in batch if amount is zero', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [0])).to.be.revertedWithCustomError(
        genesisNft,
        'GenesisNFT__ZeroAmount'
      );

      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address, deployer.address], [1, 0])
      ).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__ZeroAmount');
    });
  });

  describe('#burn()', () => {
    it('Should burn token', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1);
      expect(await genesisNft.totalSupply()).to.equal(1);

      await genesisNft.connect(owner).burn(0);
      expect(await genesisNft.totalSupply()).to.equal(0);
    });

    it('Should revert burning token if not contract owner', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1);
      await expect(genesisNft.connect(deployer).burn(0)).to.be.revertedWith(
        missing_role(deployer.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it('Should revert burning token if it does not exist', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).burn(0)).to.be.revertedWith('ERC721: invalid token ID');
    });
  });

  describe('#pause()', () => {
    it('Should pause contract', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      expect(await genesisNft.paused()).to.true;
    });

    it("Should revert pausing contract if it's already paused", async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await expect(genesisNft.connect(owner).pause()).to.be.revertedWith('Pausable: paused');
    });

    it('Should revert when pausing contract if not the pauser role', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).pause()).to.be.revertedWith(
        missing_role(deployer.address, PAUSER_ROLE)
      );
    });
  });

  describe('#pause()', () => {
    it('Should unpause contract', async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).pause();
      await genesisNft.connect(owner).unpause();
      expect(await genesisNft.paused()).to.false;
    });

    it("Should revert pausing contract if it's already paused", async () => {
      const { genesisNft, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).unpause()).to.be.revertedWith('Pausable: not paused');
    });

    it('Should revert when pausing contract if not the pauser role', async () => {
      const { genesisNft, deployer } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(deployer).unpause()).to.be.revertedWith(
        missing_role(deployer.address, PAUSER_ROLE)
      );
    });
  });

  describe('#balanceOfBatch()', () => {
    it('Should return balance of multiple accounts', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.balanceOfBatch([])).to.deep.equal([]);

      await genesisNft.connect(owner).mintBatch([deployer.address, owner.address], [1, 3]);
      expect(await genesisNft.balanceOfBatch([deployer.address, owner.address])).to.deep.equal([1, 3]);
    });
  });

  describe('#exists()', () => {
    it('Should NFT exist', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);
      await genesisNft.connect(owner).mintWithIds(deployer.address, [1]);
      expect(await genesisNft.exists(1)).to.true;
    });

    it('Should NFT not exist', async () => {
      const { genesisNft } = await loadFixture(deployGenesisNft);
      expect(await genesisNft.exists(1)).to.false;
    });
  });

  describe("setMetadataName", function () {
    it("Should set the metadata name", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = "new";
      await expect(genesisNft.connect(admin).setMetadataName(newName))
        .to.emit(genesisNft, 'MetadataNameChanged')
        .withArgs(newName);

      const metadata = await genesisNft.metadata();
      expect(metadata.name).to.equal(newName);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setMetadataName("")).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if the name is empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(admin).setMetadataName("")).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__EmptyString');
    });
  });

  describe("setMetadataDescription", function () {
    it("Should set the metadata description", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = "new";
      await expect(genesisNft.connect(admin).setMetadataDescription(newName))
        .to.emit(genesisNft, 'MetadataDescriptionChanged')
        .withArgs(newName);

      const metadata = await genesisNft.metadata();
      expect(metadata.description).to.equal(newName);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setMetadataDescription("")).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if the description is empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(admin).setMetadataDescription("")).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__EmptyString');
    });
  });

  describe("setMetadataExternalUrl", function () {
    it("Should set the metadata externalUrl", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = "new";
      await expect(genesisNft.connect(admin).setMetadataExternalUrl(newName))
        .to.emit(genesisNft, 'MetadataExternalUrlChanged')
        .withArgs(newName);

      const metadata = await genesisNft.metadata();
      expect(metadata.externalUrl).to.equal(newName);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setMetadataExternalUrl("")).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if the externalUrl is empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(admin).setMetadataExternalUrl("")).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__EmptyString');
    });
  });

  describe("setMetadataId", function () {
    it("Should set the metadata id", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = "new";
      await expect(genesisNft.connect(admin).setMetadataId(newName))
        .to.emit(genesisNft, 'MetadataIdChanged')
        .withArgs(newName);

      const metadata = await genesisNft.metadata();
      expect(metadata.id).to.equal(newName);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setMetadataId("")).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if the id is empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(admin).setMetadataId("")).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__EmptyString');
    });
  });

  describe("setMetadataPercentage", function () {
    it("Should set the metadata percentage", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = "new";
      await expect(genesisNft.connect(admin).setMetadataPercentage(newName))
        .to.emit(genesisNft, 'MetadataPercentageChanged')
        .withArgs(newName);

      const metadata = await genesisNft.metadata();
      expect(metadata.percentage).to.equal(newName);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setMetadataPercentage("")).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if the percentage is empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(admin).setMetadataPercentage("")).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__EmptyString');
    });
  });

  describe("setVestingAddress", function () {
    it("Should set the vesting contract address correctly", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = "0xCB0Ef07D6cFFEc9490c15E39a0a029B0B9F84587";
      await genesisNft.connect(admin).setVestingAddress(newName);
      const setAddress = await genesisNft.genesisNFTVesting();
      expect(setAddress).to.equal(newName);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setVestingAddress("0xCB0Ef07D6cFFEc9490c15E39a0a029B0B9F84587")).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert when setting the zero address", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(admin).setVestingAddress(ethers.constants.AddressZero))
        .to.be.revertedWithCustomError(genesisNft, "GenesisNFT__ZeroAddress");
    });
  });

  describe("setMetadataImage", function () {
    it("Should set the metadata image", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newImages = ["image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url"];

      await expect(genesisNft.connect(admin).setMetadataImage(newImages))
        .to.emit(genesisNft, 'MetadataImageChanged')

      for (let i = 0; i < newImages.length; i++) {
        const metadataImage = await genesisNft.getMetadataImageAtIndex(i);
        expect(metadataImage).to.equal(newImages[i]);
      }
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setMetadataImage([])).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if the name is empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newName = Array(5).fill("image_url");
      await expect(genesisNft.connect(admin).setMetadataImage(newName)).to.be.revertedWithCustomError(genesisNft, 'GenesisNFT__LengthMismatch');
    });
  });

  describe("setTokenAllocation", function () {
    it("Should set the token allocation and emit TokenAllocationChanged event", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newTokenAllocation = ethers.BigNumber.from(1000000);

      await expect(genesisNft.connect(admin).setTokenAllocation(newTokenAllocation))
        .to.emit(genesisNft, 'TokenAllocationChanged')
        .withArgs(newTokenAllocation);

      const tokenAllocation = await genesisNft.getTokenAllocation();
      expect(tokenAllocation).to.equal(newTokenAllocation);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setTokenAllocation(ethers.BigNumber.from(1000000))).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });
  });

  describe("setSeries1", function () {
    it("Should set the series 1 and emit Series1Changed event", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newSeries1Value = false;

      await expect(genesisNft.connect(admin).setSeries1(newSeries1Value))
        .to.emit(genesisNft, 'Series1Changed')
        .withArgs(newSeries1Value);

      const tokenAllocation = await genesisNft.getSeries1();
      expect(tokenAllocation).to.equal(newSeries1Value);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      await expect(genesisNft.connect(minter).setSeries1(true)).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });
  });

  

  describe("setAllMetadata", function () {
    it("Should set all metadata fields and emit MetadataChanged event", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);
      const newMetadata = {
        name: "Name",
        description: "Description",
        externalUrl: "https://example.com",
        id: "ID123",
        percentage: "50%"
      };

      await expect(genesisNft.connect(admin).setAllMetadata(newMetadata))
        .to.emit(genesisNft, 'MetadataChanged')
        .withArgs(newMetadata.name, newMetadata.description, newMetadata.externalUrl, newMetadata.id, newMetadata.percentage);

      const metadata = await genesisNft.metadata();
      expect(metadata.name).to.equal(newMetadata.name);
      expect(metadata.description).to.equal(newMetadata.description);
      expect(metadata.externalUrl).to.equal(newMetadata.externalUrl);
      expect(metadata.id).to.equal(newMetadata.id);
      expect(metadata.percentage).to.equal(newMetadata.percentage);
    });

    it("Should revert if caller is not admin", async function () {
      const { genesisNft, minter } = await loadFixture(deployGenesisNft);
      const newMetadata = {
        name: "Name",
        description: "Description",
        externalUrl: "https://example.com",
        id: "ID123",
        percentage: "50%"
      };
      await expect(genesisNft.connect(minter).setAllMetadata(newMetadata)).revertedWith(missing_role(minter.address, DEFAULT_ADMIN_ROLE)
      );
    });

    it("Should revert if any of the metadata fields are empty", async function () {
      const { genesisNft, admin } = await loadFixture(deployGenesisNft);

      const invalidMetadata = {
        name: "",
        description: "Description",
        externalUrl: "https://example.com",
        id: "ID123",
        percentage: "50%"
      };
      await expect(genesisNft.connect(admin).setAllMetadata(invalidMetadata))
        .to.be.revertedWithCustomError(genesisNft, "GenesisNFT__EmptyString");

      invalidMetadata.name = "Name";
      invalidMetadata.description = "";
      await expect(genesisNft.connect(admin).setAllMetadata(invalidMetadata))
        .to.be.revertedWithCustomError(genesisNft, "GenesisNFT__EmptyString");

      invalidMetadata.description = "Description";
      invalidMetadata.externalUrl = "";
      await expect(genesisNft.connect(admin).setAllMetadata(invalidMetadata))
        .to.be.revertedWithCustomError(genesisNft, "GenesisNFT__EmptyString");

      invalidMetadata.externalUrl = "https://example.com";
      invalidMetadata.id = "";
      await expect(genesisNft.connect(admin).setAllMetadata(invalidMetadata))
        .to.be.revertedWithCustomError(genesisNft, "GenesisNFT__EmptyString");

      invalidMetadata.id = "ID123";
      invalidMetadata.percentage = "";
      await expect(genesisNft.connect(admin).setAllMetadata(invalidMetadata))
        .to.be.revertedWithCustomError(genesisNft, "GenesisNFT__EmptyString");
    });
  });

  describe('#fetchTokenDetails()', () => {
    it('Should return slice', async () => {
      const { genesisNft, owner, vestingContractMock } = await loadFixture(deployGenesisNft); 
      const tokenDetails = {
        series1 : false,
        tokenId : 0,
        vested: toWlth("200"), // 200
        unvested: toWlth("100"), // 100
        released : 0,
        claimed: toWlth("50"), // 50
        releasable : 0,
        penalty: toWlth("10"), // 10
        bonus : 0,
        lost : false,
        gamified : false
      };
      await genesisNft.connect(owner).setVestingAddress(vestingContractMock.address);
      await genesisNft.connect(owner).setSeries1(series1);
      await genesisNft.connect(owner).mintWithIds(owner.address, [0, 1]);
      const owner2 = await genesisNft.ownerOf(1);
      await vestingContractMock.getTokenDetails.whenCalledWith(true, 1).returns(tokenDetails);
      const result = await genesisNft.fetchTokenDetails(1);
      expect(result).to.equal("240");
  });
    
    it('Should revert if token details are not set', async () => {
        const { genesisNft, owner } = await loadFixture(deployGenesisNft);

        // Attempt to fetch details for a token that doesn't exist
        const tokenId = 2;
        await expect(genesisNft.fetchTokenDetails(tokenId)).to.be.reverted;
    });
  });

  describe('#getSlices()', () => {
    it('Should return slice', async () => {
      const { genesisNft, owner, vestingContractMock } = await loadFixture(deployGenesisNft); 
      const tokenDetails = {
        series1 : false,
        tokenId : 0,
        vested: toWlth("20000"), // 200
        unvested: toWlth("10000"), // 100
        released : 0,
        claimed: toWlth("5000"), // 50
        releasable : 0,
        penalty: toWlth("1000"), // 10
        bonus : 0,
        lost : false,
        gamified : false
      };
      await genesisNft.connect(owner).setVestingAddress(vestingContractMock.address);
      await genesisNft.connect(owner).setSeries1(series1);
      await genesisNft.connect(owner).setTokenAllocation(toWlth("44000"));
      await genesisNft.connect(owner).mintWithIds(owner.address, [0, 1]);
      const owner2 = await genesisNft.ownerOf(1);
      await vestingContractMock.getTokenDetails.whenCalledWith(true, 1).returns(tokenDetails);
      const result = await genesisNft.getSlices(1);
      expect(result).to.equal(5);
  });
  it('Should return max 10', async () => {
    const { genesisNft, owner, vestingContractMock } = await loadFixture(deployGenesisNft); 
    const tokenDetails = {
      series1 : false,
      tokenId : 0,
      vested: toWlth("2000000"), // 200
      unvested: toWlth("10000"), // 100
      released : 0,
      claimed: toWlth("5000"), // 50
      releasable : 0,
      penalty: toWlth("1000"), // 10
      bonus : 0,
      lost : false,
      gamified : false
    };
    await genesisNft.connect(owner).setVestingAddress(vestingContractMock.address);
    await genesisNft.connect(owner).setSeries1(series1);
    await genesisNft.connect(owner).setTokenAllocation(toWlth("44000"));
    await genesisNft.connect(owner).mintWithIds(owner.address, [0, 1]);
    const owner2 = await genesisNft.ownerOf(1);
    await vestingContractMock.getTokenDetails.whenCalledWith(true, 1).returns(tokenDetails);
    const result = await genesisNft.getSlices(1);
    expect(result).to.equal(10);
    });
    it('Should revert if token details are not set', async () => {
        const { genesisNft, owner } = await loadFixture(deployGenesisNft);

        // Attempt to fetch details for a token that doesn't exist
        const tokenId = 2;
        await expect(genesisNft.connect(owner).getSlices(tokenId)).to.be.reverted;
    });

  });

  describe('#tokenURI()', () => {
    it('Should return uri', async () => {
      const { genesisNft, owner, vestingContractMock } = await loadFixture(deployGenesisNft); 
      const tokenDetails = {
        series1 : false,
        tokenId : 0,
        vested: toWlth("2000000"), // 200
        unvested: toWlth("10000"), // 100
        released : 0,
        claimed: toWlth("5000"), // 50
        releasable : 0,
        penalty: toWlth("1000"), // 10
        bonus : 0,
        lost : false,
        gamified : false
      };
      const newMetadata = {
        name: "Name",
        description: "Description",
        externalUrl: "https://example.com",
        id: "ID123",
        percentage: "50%"
      };

      const newImages = ["image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url"];

      await genesisNft.connect(owner).setVestingAddress(vestingContractMock.address);
      await genesisNft.connect(owner).setSeries1(series1);
      await genesisNft.connect(owner).setTokenAllocation(toWlth("44000"));
      await genesisNft.connect(owner).setAllMetadata(newMetadata);
      await genesisNft.connect(owner).setMetadataImage(newImages);
      await genesisNft.connect(owner).mintWithIds(owner.address, [0, 1]);
      const owner2 = await genesisNft.ownerOf(1);
      await vestingContractMock.getTokenDetails.whenCalledWith(true, 1).returns(tokenDetails);
      const result = await genesisNft.tokenURI(1);
      expect(result).to.equal("data:application/json;base64,eyJuYW1lIjogIk5hbWUiLCJkZXNjcmlwdGlvbiI6ICJEZXNjcmlwdGlvbiIsImltYWdlIjogImltYWdlX3VybCIsImV4dGVybmFsX3VybCI6ICJodHRwczovL2V4YW1wbGUuY29tIiwic2VyaWVzX2lkIjogIklEMTIzIiwiYXR0cmlidXRlcyI6IFt7InRyYWl0X3R5cGUiOiJXTFRIX3Rva2VucyIsInZhbHVlIjoiMjAwNDAwMCJ9LHsidHJhaXRfdHlwZSI6IlByb2ZpdF9TaGFyZSIsInZhbHVlIjoiNTAlIn1dfQ==");
      });

    it('Should revert if token details are not set', async () => {
        const { genesisNft, owner } = await loadFixture(deployGenesisNft);

        // Attempt to fetch details for a token that doesn't exist
        const tokenId = 2;
        await expect(genesisNft.connect(owner).tokenURI(tokenId)).to.be.reverted;
    });
  });
  describe('#getMetadataImageAtIndex()', () => {
    it('Should return image', async () => {
      const { genesisNft, owner, vestingContractMock } = await loadFixture(deployGenesisNft); 
      const newImages = ["image_url","image_url1","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url"];

      await genesisNft.connect(owner).setMetadataImage(newImages);
      const result = await genesisNft.getMetadataImageAtIndex(1);
      expect(result).to.equal("image_url1");
      });

      it('Should revert with out of bounds', async () => {
        const { genesisNft, owner, vestingContractMock } = await loadFixture(deployGenesisNft); 
        const newImages = ["image_url","image_url1","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url","image_url"];
  
        await genesisNft.connect(owner).setMetadataImage(newImages);
        await expect(genesisNft.getMetadataImageAtIndex(15)).to.be.revertedWith("Index out of bounds");
        });
  });
});
