import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { USDC, Wlth, WlthFund } from '../../typechain-types';
import { generateRandomBytes32Array, toUsdc, toWlth } from '../utils';

describe('WlthFund', () => {
  const deployWlthFund = async () => {
    const [deployer, owner, secondarySalesWallet, writer] = await ethers.getSigners();

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const usdc: FakeContract<USDC> = await smock.fake('USDC');

    const wlthFund = (await deployProxy(
      'WlthFund',
      [owner.address, wlth.address, usdc.address, secondarySalesWallet.address, writer.address],
      deployer
    )) as WlthFund;

    return {
      deployer,
      owner,
      secondarySalesWallet,
      wlth,
      usdc,
      wlthFund,
      writer
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with initial params', async () => {
        const { wlthFund, owner, secondarySalesWallet, wlth, usdc, writer } = await loadFixture(deployWlthFund);

        expect(await wlthFund.wlth()).to.equal(wlth.address);
        expect(await wlthFund.usdc()).to.equal(usdc.address);
        expect(await wlthFund.secondarySalesWallet()).to.equal(secondarySalesWallet.address);
        expect(await wlthFund.owner()).to.equal(owner.address);
        expect(await wlthFund.writer()).to.equal(writer.address);
      });
    });

    describe('Reverts', () => {
      it("Should revert if the owner's address is the zero address", async () => {
        const { wlthFund, deployer, secondarySalesWallet, wlth, usdc, writer } = await loadFixture(deployWlthFund);

        await expect(
          deployProxy(
            'WlthFund',
            [constants.AddressZero, wlth.address, usdc.address, secondarySalesWallet.address, writer.address],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__OwnerZeroAddress');
      });

      it("Should revert if the wlth address is the zero address", async () => {
        const { wlthFund, owner, deployer, secondarySalesWallet, usdc, writer } = await loadFixture(deployWlthFund);

        await expect(
          deployProxy(
            'WlthFund',
            [owner.address, constants.AddressZero, usdc.address, secondarySalesWallet.address, writer.address],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__WlthZeroAddress');
      });

      it("Should revert if the usdc address is the zero address", async () => {
        const { wlthFund, owner, deployer, secondarySalesWallet, wlth, writer } = await loadFixture(deployWlthFund);

        await expect(
          deployProxy(
            'WlthFund',
            [owner.address, wlth.address, constants.AddressZero, secondarySalesWallet.address, writer.address],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__UsdcZeroAddress');
      });

      it("Should revert if the secondary sales wallet address is the zero address", async () => {
        const { wlthFund, owner, deployer, usdc, wlth, writer } = await loadFixture(deployWlthFund);

        await expect(
          deployProxy(
            'WlthFund',
            [owner.address, wlth.address, usdc.address, constants.AddressZero, writer.address],
            deployer
          )
        ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__SecondarySalesWalletZeroAddress');
      });

      it("Should revert if the writer's address is the zero address", async () => {
        const { wlthFund, owner, deployer, wlth, usdc, secondarySalesWallet } = await loadFixture(deployWlthFund);

        await expect(
          deployProxy('WlthFund', [owner.address, wlth.address, usdc.address, secondarySalesWallet.address, constants.AddressZero], deployer)
        ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__WriterZeroAddress');
      });

      it("Should revert when reinitializing the contract's params", async () => {
        const { wlthFund, owner, secondarySalesWallet, wlth, usdc, writer } = await loadFixture(deployWlthFund);

        await expect(
          wlthFund.initialize(owner.address, wlth.address, usdc.address, secondarySalesWallet.address, writer.address)
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('Put Proposal Hash', () => {
    describe('Success', () => {
      it('should get proposal hash based on id', async () => {
        const { wlthFund, owner } = await loadFixture(deployWlthFund);

        const proposalHash = utils.formatBytes32String('proposalHash');
        const proposalId = 1;

        await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);
        expect(await wlthFund.connect(owner).getProposalHash(proposalId)).to.deep.equal(proposalHash);
      });
      it('Should put proposal hash successfully by both owner and writer', async () => {
        const { wlthFund, owner, deployer } = await loadFixture(deployWlthFund);

        const firstProposalHash = utils.formatBytes32String('proposalHash');
        const firstProposalId = 1;
        const secondProposalHash = utils.formatBytes32String('proposalHash2');
        const secondProposalId = 2;

        await expect(wlthFund.connect(owner).putProposalHash(firstProposalId, firstProposalHash))
          .to.emit(wlthFund, 'ProposalHashStored')
          .withArgs(firstProposalId, firstProposalHash);

        await wlthFund.connect(owner).setWriter(deployer.address);

        await expect(wlthFund.connect(deployer).putProposalHash(secondProposalId, secondProposalHash))
          .to.emit(wlthFund, 'ProposalHashStored')
          .withArgs(secondProposalId, secondProposalHash);
      });
    });
    describe('Reverts', () => {
      it('Should revert when hash with given proposal id already exists', async () => {
        const { wlthFund, owner } = await loadFixture(deployWlthFund);

        const proposalHash = utils.formatBytes32String('proposalHash');
        const proposalId = 1;

        await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);
        await expect(wlthFund.connect(owner).putProposalHash(proposalId, proposalHash)).to.be.revertedWithCustomError(
          wlthFund,
          'WlthFund__ProposalAlreadyExist'
        );
      });

      it('Should revert when not called by the owner or writer', async () => {
        const { wlthFund, deployer } = await loadFixture(deployWlthFund);

        const proposalHash = utils.formatBytes32String('proposalHash');
        const proposalId = 1;

        await expect(wlthFund.connect(deployer).putProposalHash(proposalId, proposalHash)).to.be.revertedWithCustomError(
          wlthFund,
          'WlthFund__NotWriterOrOwner'
        );
      });
    });
  });

  describe('Put Top 50 Stakers', () => {
    describe('Success', () => {
      it('should get top 50 stakers based on id', async () => {
        const { wlthFund, owner } = await loadFixture(deployWlthFund);

        const top50StakersList = generateRandomBytes32Array(50);
        const id = 1;

        await wlthFund.connect(owner).putTop50Stakers(id, top50StakersList);
        expect(await wlthFund.connect(owner).getTop50Stakers(id)).to.deep.equal(top50StakersList);
      });
      it('Should put top 50 stakers list successfully by both owner and writer', async () => {
        const { wlthFund, owner, deployer } = await loadFixture(deployWlthFund);

        const firstTop50StakersList = generateRandomBytes32Array(50);
        const firstId = 1;
        const secondTop50StakersList = generateRandomBytes32Array(50);
        const secondId = 2;

        expect(await wlthFund.connect(owner).putTop50Stakers(firstId, firstTop50StakersList))
          .to.emit(wlthFund, 'Top50StakersStored')
          .withArgs(firstId, firstTop50StakersList);

          await wlthFund.connect(owner).setWriter(deployer.address);

        expect(await wlthFund.connect(owner).putTop50Stakers(secondId, secondTop50StakersList))
          .to.emit(wlthFund, 'Top50StakersStored')
          .withArgs(secondId, secondTop50StakersList);

      });
    });
    describe('Reverts', () => {
      it('Should revert when list with given proposal id already exists', async () => {
        const { wlthFund, owner } = await loadFixture(deployWlthFund);

        const top50StakersList = generateRandomBytes32Array(50);
        const id = 1;

        await wlthFund.connect(owner).putTop50Stakers(id, top50StakersList);
        await expect(wlthFund.connect(owner).putTop50Stakers(id, top50StakersList)).to.be.revertedWithCustomError(
          wlthFund,
          'WlthFund__Top50StakersEntityAlreadyExist'
        );
      });

      it('Should revert when not called by the owner or writer', async () => {
        const { wlthFund, deployer } = await loadFixture(deployWlthFund);

        const top50StakersList = generateRandomBytes32Array(50);
        const id = 1;

        await expect(wlthFund.connect(deployer).putTop50Stakers(id, top50StakersList)).to.be.revertedWithCustomError(
          wlthFund,
          'WlthFund__NotWriterOrOwner'
        );
      });
    });
  });

  describe('Fund Investee', () => {
    describe('Success', () => {
      it('should fund the investee', async () => {
        const { wlthFund, owner, wlth, usdc } = await loadFixture(deployWlthFund);

        const proposalHash = utils.formatBytes32String('proposalHash');
        const proposalId = 1;
        const [investee] = await ethers.getSigners();
        const fundAmount = toUsdc('1000');
        const burnAmount = toWlth('1000');

        wlth.approve.returns(true);
        wlth.transferFrom.returns(true);
        usdc.approve.returns(true);
        usdc.transferFrom.returns(true);

        await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);

        await expect(wlthFund.connect(owner).fundInvestee(proposalId, investee.address, fundAmount, burnAmount))
          .to.emit(wlthFund, 'InvesteeFunded')
          .withArgs(proposalId, investee.address, fundAmount, burnAmount);
      });
      describe('Reverts', () => {
        it('Should revert when investee is zero address', async () => {
          const { wlthFund, owner, wlth, usdc } = await loadFixture(deployWlthFund);

          const proposalHash = utils.formatBytes32String('proposalHash');
          const proposalId = 1;
          const [investee] = await ethers.getSigners();
          const fundAmount = toUsdc('1000');
          const burnAmount = toWlth('1000');

          wlth.approve.returns(true);
          wlth.transferFrom.returns(true);
          usdc.approve.returns(true);
          usdc.transferFrom.returns(true);

          await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);

          await expect(
            wlthFund.connect(owner).fundInvestee(proposalId, constants.AddressZero, fundAmount, burnAmount)
          ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__InvesteeZeroAddress');
        });
        
        it('Should revert when investee already funded', async () => {
          const { wlthFund, owner, wlth, usdc } = await loadFixture(deployWlthFund);

          const proposalHash = utils.formatBytes32String('proposalHash');
          const proposalId = 1;
          const [investee] = await ethers.getSigners();
          const fundAmount = toUsdc('1000');
          const burnAmount = toWlth('1000');

          wlth.approve.returns(true);
          wlth.transferFrom.returns(true);
          usdc.approve.returns(true);
          usdc.transferFrom.returns(true);

          await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);
          await wlthFund.connect(owner).fundInvestee(proposalId, investee.address, fundAmount, burnAmount);

          await expect(
            wlthFund.connect(owner).fundInvestee(proposalId, investee.address, fundAmount, burnAmount)
          ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__InvesteeAlreadyFunded');
        });

        it('Should revert when invalid proposal id provided', async () => {
          const { wlthFund, owner, wlth, usdc } = await loadFixture(deployWlthFund);

          const proposalId = 1;
          const [investee] = await ethers.getSigners();
          const fundAmount = toUsdc('1000');
          const burnAmount = toWlth('1000');

          wlth.approve.returns(true);
          wlth.transferFrom.returns(true);
          usdc.approve.returns(true);
          usdc.transferFrom.returns(true);

          await expect(
            wlthFund.connect(owner).fundInvestee(proposalId, investee.address, fundAmount, burnAmount)
          ).to.be.revertedWithCustomError(wlthFund, 'WlthFund__InvalidProposal');
        });

        it('Should revert when not approved usdc or wlth on secondary sales wallet', async () => {
          const { wlthFund, owner, wlth, usdc } = await loadFixture(deployWlthFund);

          const proposalHash = utils.formatBytes32String('proposalHash');
          const proposalId = 1;
          const [investee] = await ethers.getSigners();
          const fundAmount = toUsdc('1000');
          const burnAmount = toWlth('1000');

          wlth.transferFrom.returns(false);
          usdc.transferFrom.returns(true);

          await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);
          await expect(
            wlthFund.connect(owner).fundInvestee(proposalId, investee.address, fundAmount, burnAmount)
          ).to.be.revertedWithCustomError(wlthFund, 'Utils__CurrencyTransferFailed');
        });

        it('Should revert when not called by owner', async () => {
          const { wlthFund, owner, deployer, wlth, usdc } = await loadFixture(deployWlthFund);

          const proposalHash = utils.formatBytes32String('proposalHash');
          const proposalId = 1;
          const [investee] = await ethers.getSigners();
          const fundAmount = toUsdc('1000');
          const burnAmount = toWlth('1000');

          wlth.approve.returns(true);
          wlth.transferFrom.returns(true);
          usdc.approve.returns(true);
          usdc.transferFrom.returns(true);

          await wlthFund.connect(owner).putProposalHash(proposalId, proposalHash);

          await expect(
            wlthFund.connect(deployer).fundInvestee(proposalId, investee.address, fundAmount, burnAmount)
          ).to.be.revertedWithCustomError(
            wlthFund,
            'WlthFund__NotWriterOrOwner'
          );
        });
      });
    });
  });

  describe('Set writer', () => {
    describe('Success', () => {
      it('should set writer', async () => {
        const { wlthFund, owner, deployer } = await loadFixture(deployWlthFund);

        await wlthFund.connect(owner).setWriter(deployer.address);
        expect(await wlthFund.connect(owner).writer()).to.equals(deployer.address);
      });
    });
    describe('Reverts', () => {
      it('Should revert when zero address provided', async () => {
        const { wlthFund, owner} = await loadFixture(deployWlthFund);

        await expect(wlthFund.connect(owner).setWriter(constants.AddressZero)).to.be.revertedWithCustomError(
          wlthFund,
          'WlthFund__WriterZeroAddress'
        );
      });

      it('Should revert when not called by the owner', async () => {
        const { wlthFund, deployer } = await loadFixture(deployWlthFund);

        await expect(wlthFund.connect(deployer).setWriter(deployer.address)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  });
});