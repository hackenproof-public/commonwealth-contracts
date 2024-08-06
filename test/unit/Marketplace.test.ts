import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { GenesisNFT, Marketplace, Wlth } from '../../typechain-types';

describe('Marketplace', () => {
  const deployMarketplace = async () => {
    const [deployer, owner, secondarySalesWallet, genesisNftRoyaltyAccount, user1, user2] = await ethers.getSigners();

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const genNft: FakeContract<GenesisNFT> = await smock.fake('GenesisNFT');

    const totalReward = parseEther('1000');

    const marketplace = (await deployProxy(
      'Marketplace',
      [owner.address, wlth.address, secondarySalesWallet.address, genesisNftRoyaltyAccount.address],
      deployer
    )) as Marketplace;

    wlth.balanceOf.returns(totalReward);
    wlth.transfer.returns(true);
    wlth.transferFrom.returns(true);

    return {
      deployer,
      owner,
      secondarySalesWallet,
      genesisNftRoyaltyAccount,
      user1,
      user2,
      wlth,
      totalReward,
      marketplace,
      genNft
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with initial params', async () => {
        const { marketplace, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } = await loadFixture(
          deployMarketplace
        );

        expect(await marketplace.paymentToken()).to.equal(wlth.address);
        expect(await marketplace.feeAddress()).to.equal(secondarySalesWallet.address);
        expect(await marketplace.royaltyAddress()).to.equal(genesisNftRoyaltyAccount.address);
        expect(await marketplace.owner()).to.equal(owner.address);
      });
    });

    describe('Reverts', () => {
      it("Should revert if the owner's address is the zero address", async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          deployProxy(
            'Marketplace',
            [constants.AddressZero, wlth.address, secondarySalesWallet.address, genesisNftRoyaltyAccount.address],
            deployer
          )
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__OwnerZeroAddress');
      });

      it("Should revert if the wlth's address is the zero address", async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          deployProxy(
            'Marketplace',
            [owner.address, constants.AddressZero, secondarySalesWallet.address, genesisNftRoyaltyAccount.address],
            deployer
          )
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__TokenZeroAddress');
      });

      it("Should revert if the secondarySalesWallet's address is the zero address", async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          deployProxy(
            'Marketplace',
            [owner.address, wlth.address, constants.AddressZero, genesisNftRoyaltyAccount.address],
            deployer
          )
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__FeeZeroAddress');
      });

      it('Should revert if the royaltyFund address is zero address', async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          deployProxy(
            'Marketplace',
            [owner.address, wlth.address, secondarySalesWallet.address, constants.AddressZero],
            deployer
          )
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__RoyaltyZeroAddress');
      });

      it("Should revert when reinitializing the contract's params", async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          marketplace.initialize(owner.address, wlth.address, secondarySalesWallet.address, constants.AddressZero)
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('#addAllowedContract', () => {
    describe('Success', () => {
      it('Should add allowed ERC721 contract', async () => {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        // Add allowed contract
        await marketplace.connect(owner).addAllowedContract(genNft.address);

        expect(await marketplace.isAllowedContract(genNft.address)).to.be.true;
      });
    });

    describe('Reverts', () => {
      it('Should revert when trying to add zero address', async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          marketplace.connect(owner).addAllowedContract('0x0000000000000000000000000000000000000000')
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__ERC721ZeroAddress');
      });

      it('Should not add ERC721 contract if exists', async () => {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        // Add allowed contract
        await marketplace.connect(owner).addAllowedContract(genNft.address);
        await expect(marketplace.connect(owner).addAllowedContract(genNft.address)).to.be.revertedWithCustomError(
          marketplace,
          'Marketplace__ERC721AddressExists'
        );
      });

      it('Should revert when non-owner tries to add', async () => {
        const { marketplace, deployer, owner, wlth, user1, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);
        await expect(marketplace.connect(user1).addAllowedContract(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('#removeAllowedContract', () => {
    describe('Success', () => {
      it('Should remove ERC721 contract', async () => {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        // Add allowed contract
        await marketplace.connect(owner).addAllowedContract(genNft.address);
        await marketplace.connect(owner).removeAllowedContract(genNft.address);

        expect(await marketplace.isAllowedContract(genNft.address)).to.be.false;
      });
    });

    describe('Reverts', () => {
      it('Should revert when trying to add zero address', async () => {
        const { marketplace, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(
          marketplace.connect(owner).removeAllowedContract('0x0000000000000000000000000000000000000000')
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__ERC721ZeroAddress');
      });

      it('Should not remove ERC721 contract if not exists', async () => {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        // Add allowed contract
        await expect(marketplace.connect(owner).removeAllowedContract(genNft.address)).to.be.revertedWithCustomError(
          marketplace,
          'Marketplace__ERC721AddressNotAdded'
        );
      });

      it('Should revert when non-owner tries to remove', async () => {
        const { marketplace, genNft, deployer, owner, wlth, user1, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);
        await expect(marketplace.connect(user1).removeAllowedContract(genNft.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });

  describe('#listNft', () => {
    describe('Success', () => {
      it('should list the NFT if all conditions are met', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await expect(marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1')))
          .to.emit(marketplace, 'Listed')
          .withArgs(1, owner.address, genNft.address, 1, ethers.utils.parseEther('1'));

        const listing = await marketplace.getListingByListingId(1);
        expect(listing.seller).to.equal(owner.address);
        expect(listing.nftContract).to.equal(genNft.address);
        expect(listing.tokenId).to.equal(1);
        expect(listing.price).to.equal(ethers.utils.parseEther('1'));
      });
    });

    describe('Reverts', () => {
      it('should revert if the contract is not allowed', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        genNft.getApproved.returns(marketplace.address);
        await expect(
          marketplace.listNFT(genNft.address, 1, ethers.utils.parseEther('1'))
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__ERC721AddressNotAllowed');
      });

      it('should revert if the NFT is not owned by the sender', async function () {
        const { marketplace, genNft, deployer, owner, wlth, user1, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);
        // Ensure the function is called by the owner
        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return a different address
        genNft.ownerOf.whenCalledWith(1).returns(user1.address);
        genNft.getApproved.returns(marketplace.address);

        await expect(
          marketplace.listNFT(genNft.address, 1, ethers.utils.parseEther('1'))
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__NFTNotOwnedByMsgSender');
      });

      it('should revert if price is zero', async function () {
        const { marketplace, genNft, deployer, owner, wlth, user1, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);
        // Ensure the function is called by the owner
        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await expect(
          marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('0'))
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__ZeroPrice');
      });

      it('should revert if marketplace contract is not approved by user', async function () {
        const { marketplace, genNft, deployer, owner, wlth, user1, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(constants.AddressZero);

        await expect(
          marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'))
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__NFTNotApprovedForMarketplaceContract');
      });
    });
  });

  describe('#cancelListing', () => {
    describe('Success', () => {
      it('should cancel the listing if all conditions are met', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        await expect(marketplace.connect(owner)['cancelListing(uint256)'](1))
          .to.emit(marketplace, 'Canceled')
          .withArgs(1, owner.address);

        const listing = await marketplace.getListingByListingId(1);
        expect(listing.listed).to.equal(false);
        expect(listing.sold).to.equal(false);
      });

      it('should cancel the listing if owner', async function () {
        const { marketplace, genNft, deployer, user1, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(user1.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(user1).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        await expect(marketplace.connect(owner)['cancelListing(uint256)'](1))
          .to.emit(marketplace, 'Canceled')
          .withArgs(1, owner.address);

        const listing = await marketplace.getListingByListingId(1);
        expect(listing.listed).to.equal(false);
        expect(listing.sold).to.equal(false);
      });
    });

    describe('Reverts', () => {
      it('should revert if the caller is not the owner or the seller', async function () {
        const { marketplace, genNft, user1, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        await expect(marketplace.connect(user1)['cancelListing(uint256)'](1)).to.be.revertedWithCustomError(
          marketplace,
          'Marketplace__NotOwnerSellerAllowedContracts'
        );
      });

      it('should decrease the listing count by 1 after cancellation', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        const initialListingCount = await marketplace.getListingCount();

        await marketplace.connect(owner)['cancelListing(uint256)'](1);
        const finalListingCount = await marketplace.getListingCount();

        expect(finalListingCount).to.equal(0);
      });
    });
  });

  describe('#updateListingPrice', () => {
    describe('Success', () => {
      it('should update listing price', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        await expect(marketplace.connect(owner).updateListingPrice(1, ethers.utils.parseEther('2')))
          .to.emit(marketplace, 'PriceUpdated')
          .withArgs(1, ethers.utils.parseEther('2'));
      });
    });

    describe('Reverts', () => {
      it('should revert update listing price if the caller is not the owner or the seller', async function () {
        const { marketplace, genNft, user1, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(user1.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(user1).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        await expect(
          marketplace.connect(owner).updateListingPrice(1, ethers.utils.parseEther('2'))
        ).to.be.revertedWithCustomError(marketplace, 'Marketplace__NotSeller');
      });
    });
  });

  describe('#buyNFT', () => {
    describe('Success', () => {
      it('should buy nft if all conditions are met', async function () {
        const { marketplace, genNft, user1, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const FEE_PERCENTAGE = 2;
        const ROYALTY_PERCENTAGE = 65;

        const listingPrice = ethers.utils.parseEther('100');
        const fee = listingPrice.mul(FEE_PERCENTAGE).div(100);
        const transactionFee = listingPrice.div(100);
        const royalty = listingPrice.mul(ROYALTY_PERCENTAGE).div(1000);
        const sellerAmount = listingPrice.sub(fee).sub(royalty).sub(transactionFee);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);
        wlth.allowance.whenCalledWith(user1.address, marketplace.address).returns(listingPrice);

        await marketplace.connect(owner).listNFT(genNft.address, 1, listingPrice);

        await wlth.transferFrom.whenCalledWith(user1.address, secondarySalesWallet.address, fee).returns(true);
        await wlth.transferFrom
          .whenCalledWith(user1.address, genesisNftRoyaltyAccount.address, royalty.add(transactionFee))
          .returns(true);
        await wlth.transferFrom.whenCalledWith(user1.address, owner.address, sellerAmount).returns(true);

        await expect(marketplace.connect(user1).buyNFT(1))
          .to.emit(marketplace, 'Sale')
          .withArgs(1, user1.address, owner.address, listingPrice);

        expect(wlth.transferFrom).to.have.been.calledWith(user1.address, secondarySalesWallet.address, fee);
        expect(wlth.transferFrom).to.have.been.calledWith(
          user1.address,
          genesisNftRoyaltyAccount.address,
          royalty.add(transactionFee)
        );
        expect(wlth.transferFrom).to.have.been.calledWith(user1.address, owner.address, sellerAmount);
        expect(genNft['safeTransferFrom(address,address,uint256)']).to.have.been.calledWith(
          owner.address,
          user1.address,
          1
        );
      });

      it('should cancel the listing after purchase', async function () {
        const { marketplace, genNft, user1, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const FEE_PERCENTAGE = 2;
        const ROYALTY_PERCENTAGE = 65;

        const listingPrice = ethers.utils.parseEther('100');
        const fee = listingPrice.mul(FEE_PERCENTAGE).div(100);
        const royalty = listingPrice.mul(ROYALTY_PERCENTAGE).div(1000);
        const sellerAmount = listingPrice.sub(fee).sub(royalty);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, listingPrice);

        await wlth.transferFrom.whenCalledWith(user1.address, secondarySalesWallet.address, fee).returns(true);
        await wlth.transferFrom.whenCalledWith(user1.address, genesisNftRoyaltyAccount.address, royalty).returns(true);
        await wlth.transferFrom.whenCalledWith(user1.address, owner.address, sellerAmount).returns(true);

        await marketplace.connect(user1).buyNFT(1);

        const listing = await marketplace.getListingByListingId(1);
        expect(listing.listed).to.equal(false);
        expect(listing.sold).to.equal(true);
      });

      it('should decrease the listing count by 1 after purchase', async function () {
        const { marketplace, genNft, user1, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const FEE_PERCENTAGE = 2;
        const ROYALTY_PERCENTAGE = 65;

        const listingPrice = ethers.utils.parseEther('100');
        const fee = listingPrice.mul(FEE_PERCENTAGE).div(100);
        const royalty = listingPrice.mul(ROYALTY_PERCENTAGE).div(1000);
        const sellerAmount = listingPrice.sub(fee).sub(royalty);

        const initialListingCount = await marketplace.getListingCount();

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, listingPrice);

        await wlth.transferFrom.whenCalledWith(user1.address, secondarySalesWallet.address, fee).returns(true);
        await wlth.transferFrom.whenCalledWith(user1.address, genesisNftRoyaltyAccount.address, royalty).returns(true);
        await wlth.transferFrom.whenCalledWith(user1.address, owner.address, sellerAmount).returns(true);

        await marketplace.connect(user1).buyNFT(1);

        const finalListingCount = await marketplace.getListingCount();
        expect(finalListingCount).to.equal(initialListingCount);
      });
    });

    describe('Reverts', () => {
      it('should revert if the listing does not exist', async function () {
        const { marketplace, genNft, user1, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await expect(marketplace.connect(user1).buyNFT(999)).to.be.revertedWithCustomError(
          marketplace,
          'Marketplace__ListingNotActive'
        );
      });
    });
  });

  describe('#getOneListing', () => {
    describe('Success', () => {
      it('should return empty array when no listings are present', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        // Fake the ownerOf function to return the correct address
        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));

        const listing = await marketplace.getListingByListingId(1);

        // Assertions
        expect(listing.seller).to.equal(owner.address);
        expect(listing.nftContract).to.equal(genNft.address);
        expect(listing.tokenId).to.equal(1);
        expect(listing.price).to.equal(ethers.utils.parseEther('1'));
      });
    });
  });
  describe('#getAllowedContract', () => {
    describe('Success', () => {
      it('should return true if the contract is allowed', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        const isAllowed = await marketplace.isAllowedContract(genNft.address);

        expect(isAllowed).to.be.true;
      });

      it('should return false if the contract is not allowed', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const isAllowed = await marketplace.isAllowedContract(genNft.address);

        expect(isAllowed).to.be.false;
      });
    });
  });

  describe('#getListingCount', () => {
    describe('Success', () => {
      it('should return true if the contract is allowed', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);

        genNft.ownerOf.whenCalledWith(1).returns(owner.address);
        genNft.ownerOf.whenCalledWith(2).returns(owner.address);
        genNft.getApproved.returns(marketplace.address);

        await marketplace.connect(owner).listNFT(genNft.address, 1, ethers.utils.parseEther('1'));
        await marketplace.connect(owner).listNFT(genNft.address, 2, ethers.utils.parseEther('1'));

        const count = await marketplace.getListingCount();

        expect(count).to.equal(2);
      });
    });
  });

  describe('#paymentToken', () => {
    describe('Success', () => {
      it('should return the payment token address', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const tokenAddress = await marketplace.paymentToken();
        expect(tokenAddress).to.equal(wlth.address);
      });
    });
  });

  describe('#feeAddress', () => {
    describe('Success', () => {
      it('should return the fee address', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const tokenAddress = await marketplace.feeAddress();
        expect(tokenAddress).to.equal(secondarySalesWallet.address);
      });
    });
  });

  describe('#royaltyAddress', () => {
    describe('Success', () => {
      it('should return the royalty address', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        const tokenAddress = await marketplace.royaltyAddress();
        expect(tokenAddress).to.equal(genesisNftRoyaltyAccount.address);
      });
    });
  });

  describe('#isAllowedContract', () => {
    describe('Success', () => {
      it('should return true if the contract is allowed', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);

        await marketplace.connect(owner).addAllowedContract(genNft.address);
        const isAllowed = await marketplace.isAllowedContract(genNft.address);
        expect(isAllowed).to.be.true;
      });
      it('should return false if the contract is not allowed', async function () {
        const { marketplace, genNft, deployer, owner, wlth, secondarySalesWallet, genesisNftRoyaltyAccount } =
          await loadFixture(deployMarketplace);
        const isAllowed = await marketplace.isAllowedContract(genNft.address);
        expect(isAllowed).to.be.false;
      });
    });
  });
});
