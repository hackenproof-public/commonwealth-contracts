import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFTV2, IERC721Mintable__factory, IGenesisNFT__factory } from '../../typechain-types';
import { getInterfaceId, keccak256, missing_role } from '../utils';

describe('Common Wealth Genesis NFT unit tests', () => {
  const DEFAULT_ADMIN_ROLE = constants.HashZero;
  const MINTER_ROLE = keccak256('MINTER_ROLE');
  const PAUSER_ROLE = keccak256('PAUSER_ROLE');
  const name = 'Common Wealth Genesis NFT Series 2';
  const symbol = 'CWOGS2';
  const series = 1;
  const royalty = 650;
  const defaultTokenURI = 'ipfs://token-uri';
  const IERC721MintableId = utils.arrayify(getInterfaceId(IERC721Mintable__factory.createInterface()));
  const IGenesisNFTId = utils.arrayify(getInterfaceId(IGenesisNFT__factory.createInterface()));

  const deployGenesisNft = async () => {
    const [deployer, owner, admin, minter, pauser, royaltyWallet] = await ethers.getSigners();

    const genesisNft: GenesisNFTV2 = await deployProxy(
      'GenesisNFTV2',
      [name, symbol, series, owner.address, royaltyWallet.address, royalty, defaultTokenURI],
      deployer
    );
    await genesisNft.connect(owner).grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await genesisNft.connect(owner).grantRole(MINTER_ROLE, minter.address);
    await genesisNft.connect(owner).grantRole(PAUSER_ROLE, pauser.address);

    return { genesisNft, deployer, owner, admin, minter, pauser };
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

    it('Should revert deployment if owner is zero address', async () => {
      const [deployer, royaltyAccount] = await ethers.getSigners();

      await expect(
        deployProxy(
          'GenesisNFTV2',
          [name, symbol, series, constants.AddressZero, royaltyAccount.address, royalty, defaultTokenURI],
          deployer
        )
      ).to.be.revertedWith('Owner account is zero address');
    });

    it('Should revert deployment if invalid royalty parameters', async () => {
      const [deployer, owner, royaltyAccount] = await ethers.getSigners();

      await expect(
        deployProxy(
          'GenesisNFTV2',
          [name, symbol, series, owner.address, constants.AddressZero, royalty, defaultTokenURI],
          deployer
        )
      ).to.be.revertedWith('ERC2981: invalid receiver');

      await expect(
        deployProxy(
          'GenesisNFTV2',
          [name, symbol, series, owner.address, royaltyAccount.address, 10001, defaultTokenURI],
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

      await expect(genesisNft.connect(admin).setOwner(constants.AddressZero)).to.be.revertedWith(
        'New owner is zero address'
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
      expect(await genesisNft.tokenURI(0)).to.equal(defaultTokenURI);

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

      await expect(genesisNft.connect(owner).mint(constants.AddressZero, 1)).to.be.revertedWith(
        'Recipient is zero address'
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

      await expect(genesisNft.connect(owner).mintBatch([], [1])).to.be.revertedWith(
        'Recipients and amounts length mismatch'
      );

      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [])).to.be.revertedWith(
        'Recipients and amounts length mismatch'
      );
    });

    it('Should revert minting in batch if recipient is zero address', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([constants.AddressZero], [1])).to.be.revertedWith(
        'Recipient is zero address'
      );

      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address, constants.AddressZero], [1, 1])
      ).to.be.revertedWith('Recipient is zero address');
    });

    it('Should revert minting in batch if amount is zero', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.connect(owner).mintBatch([deployer.address], [0])).to.be.revertedWith(
        'Tokens amount is equal to zero'
      );

      await expect(
        genesisNft.connect(owner).mintBatch([deployer.address, deployer.address], [1, 0])
      ).to.be.revertedWith('Tokens amount is equal to zero');
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

  describe('#balanceOfBatch()', () => {
    it('Should return balance of multiple accounts', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      expect(await genesisNft.balanceOfBatch([])).to.deep.equal([]);

      await genesisNft.connect(owner).mintBatch([deployer.address, owner.address], [1, 3]);
      expect(await genesisNft.balanceOfBatch([deployer.address, owner.address])).to.deep.equal([1, 3]);
    });
  });

  describe('#setTokenURI()', () => {
    it('Should revert getting token URI if token does not exist', async () => {
      const { genesisNft } = await loadFixture(deployGenesisNft);

      await expect(genesisNft.tokenURI(0)).to.be.revertedWith('ERC721: invalid token ID');
    });

    it('Should set token URI', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      const newTokenURI = 'ipfs://new-token-uri';

      await genesisNft.connect(owner).mint(deployer.address, 1);
      expect(await genesisNft.tokenURI(0)).to.equal(defaultTokenURI);

      await expect(genesisNft.connect(owner).setTokenURI(newTokenURI))
        .to.emit(genesisNft, 'TokenURIChanged')
        .withArgs(owner.address, newTokenURI);
      expect(await genesisNft.tokenURI(0)).to.equal(newTokenURI);
    });

    it('Should revert setting token URI if not contract owner', async () => {
      const { genesisNft, deployer, owner } = await loadFixture(deployGenesisNft);

      await genesisNft.connect(owner).mint(deployer.address, 1);

      await expect(genesisNft.connect(deployer).setTokenURI('ipfs://new-token-uri')).to.be.revertedWith(
        missing_role(deployer.address, DEFAULT_ADMIN_ROLE)
      );
    });
  });
});
