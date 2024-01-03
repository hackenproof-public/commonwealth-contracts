import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { WhitelistedVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

describe.skip('Whitelisted vesting unit tests', () => {
  const TWENTY_FOUR_BILIONS = '24000000';
  const SECONDS_IN_YEAR = 31536000;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const ONE_MONTH = Math.floor(SECONDS_IN_YEAR / 12);
  const ONE_SECOND = 1;
  const ONE_TOKEN = toWlth('1');
  const allocation = toWlth(TWENTY_FOUR_BILIONS);
  const duration = TWO_YEARS;
  const cadence = ONE_MONTH;
  const allocationGroupId = 1;

  const deploySimpleVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

    const [deployer, beneficiary1, beneficiary2, owner] = await ethers.getSigners();
    const whitelist = [beneficiary1.address];
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const whitelistedVesting: WhitelistedVesting = await deploy(
      'WhitelistedVesting',
      [owner.address, wlth.address, allocationGroupId, allocation, duration, cadence, vestingStartTimestamp, whitelist],
      deployer
    );

    return {
      owner,
      whitelistedVesting,
      wlth,
      deployer,
      whitelist,
      allocation,
      duration,
      cadence,
      vestingStartTimestamp,
      beneficiary1,
      beneficiary2
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const {
        whitelistedVesting,
        wlth,
        allocation,
        duration,
        vestingStartTimestamp,
        cadence,
        beneficiary1,
        beneficiary2
      } = await loadFixture(deploySimpleVesting);

      expect(await whitelistedVesting.getVestedToken()).to.equal(wlth.address);
      expect(await whitelistedVesting.whitelist(beneficiary1.address)).to.equal(true);
      expect(await whitelistedVesting.whitelist(beneficiary2.address)).to.equal(false);
      expect(await whitelistedVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await whitelistedVesting.allocation()).to.equal(allocation);
      expect(await whitelistedVesting.duration()).to.equal(duration);
      expect(await whitelistedVesting.cadence()).to.equal(cadence);
      expect(await whitelistedVesting.whitelistedAddressesAmount()).to.equal(1);
    });
  });

  describe('getReleasableAmount()', () => {
    it('Should return no releaseable tokens if timestamp before vesting start', async () => {
      const { whitelistedVesting, wlth, vestingStartTimestamp, allocation, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(0);
    });

    it('Should return releaseable tokens after first cadence from vesting start moment', async () => {
      const { whitelistedVesting, vestingStartTimestamp, wlth, allocation, beneficiary1, cadence } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + cadence);
      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('1000000'));
    });

    it('Should return releaseable tokens for two cadences at start of second cadence', async () => {
      const { whitelistedVesting, cadence, vestingStartTimestamp, wlth, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + 2 * cadence);

      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('2000000'));
    });

    it('Should return whole token allocation at duration pass moment', async () => {
      const { whitelistedVesting, duration, vestingStartTimestamp, wlth, beneficiary1 } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + duration);

      expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('24000000'));
    });

    describe('release()', () => {
      it('Should not release tokens before vesting time', async () => {
        const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth } = await loadFixture(
          deploySimpleVesting
        );
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp - ONE_SECOND * 10);

        await expect(
          whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
        ).to.be.revertedWith('Vesting has not started yet!');
      });

      it('Should release tokens within vesting time', async () => {
        const { whitelistedVesting, vestingStartTimestamp, beneficiary1, cadence, wlth, allocation, duration } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);

        await time.increaseTo(vestingStartTimestamp + cadence);
        await whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address);
        expect(wlth.transfer.atCall(0)).to.have.been.calledWith(beneficiary1.address, toWlth('1000000'));
        expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('1000000'));
        wlth.balanceOf.returns(allocation);

        await time.increaseTo(vestingStartTimestamp + 2 * cadence);
        await whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address);
        expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('2000000'));

        await time.increaseTo(vestingStartTimestamp + duration);
        await whitelistedVesting.connect(beneficiary1).release(toWlth('22000000'), beneficiary1.address);
        expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('24000000'));
      });

      it('Should equally release tokens between whitelisted addresses within vesting time', async () => {
        const {
          whitelistedVesting,
          vestingStartTimestamp,
          beneficiary1,
          beneficiary2,
          cadence,
          wlth,
          allocation,
          duration,
          owner
        } = await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);
        await whitelistedVesting.connect(owner).addAddressToWhitelist(beneficiary2.address);
        expect(await whitelistedVesting.connect(owner).whitelistedAddressesAmount()).to.equal(2);
        wlth.balanceOf.returns(allocation);

        await time.increaseTo(vestingStartTimestamp + cadence);
        expect(await whitelistedVesting.connect(beneficiary1).releaseableAmount()).to.equal(toWlth('500000'));
        await whitelistedVesting.connect(beneficiary1).release(toWlth('500000'), beneficiary1.address);
        await whitelistedVesting.connect(beneficiary2).release(toWlth('500000'), beneficiary2.address);
        expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('1000000'));
        expect(await whitelistedVesting.connect(beneficiary1).amountReleasedByAddress(beneficiary1.address)).to.equal(
          toWlth('500000')
        );

        await time.increaseTo(vestingStartTimestamp + 2 * cadence);
        await whitelistedVesting.connect(beneficiary1).release(toWlth('500000'), beneficiary1.address);
        expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('1500000'));

        await time.increaseTo(vestingStartTimestamp + duration);
        await whitelistedVesting.connect(beneficiary1).release(toWlth('11000000'), beneficiary1.address);
        expect(await whitelistedVesting.connect(beneficiary2).releaseableAmount()).to.equal(toWlth('11500000'));
        expect(await whitelistedVesting.connect(beneficiary1).released()).to.equal(toWlth('12500000'));
      });

      it('Should revert releasing tokens if not enough vested', async () => {
        const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth } = await loadFixture(
          deploySimpleVesting
        );
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          whitelistedVesting.connect(beneficiary1).release(toWlth('1000000').add(ONE_TOKEN), beneficiary1.address)
        ).to.be.revertedWith('Not enough tokens vested!');
      });

      it('Should revert releasing tokens if not beneficiary', async () => {
        const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth, deployer } = await loadFixture(
          deploySimpleVesting
        );
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          whitelistedVesting.connect(deployer).release(toWlth('1000000'), beneficiary1.address)
        ).to.be.revertedWith('Unauthorized access!');
      });

      it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
        const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth, cadence } = await loadFixture(
          deploySimpleVesting
        );
        wlth.balanceOf.returns(0);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
        ).to.be.revertedWith('Not enough tokens to process the release!');
      });

      it('Should revert releasing tokens if transfer fails', async () => {
        const { whitelistedVesting, vestingStartTimestamp, beneficiary1, wlth, deployer } = await loadFixture(
          deploySimpleVesting
        );
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          whitelistedVesting.connect(beneficiary1).release(toWlth('1000000'), beneficiary1.address)
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
      });
    });
  });

  describe('Whitelist management', () => {
    it('Should revert if non-owner address try to perform whitelist management action', async () => {
      const { whitelistedVesting, deployer } = await loadFixture(deploySimpleVesting);
      const [newBenefitiary1] = await ethers.getSigners();
      await expect(
        whitelistedVesting.connect(deployer).addAddressToWhitelist(newBenefitiary1.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        whitelistedVesting.connect(deployer).removeAddressFromWhitelist(newBenefitiary1.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should add single address to the whitelist', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);
      const [newBenefitiary1] = await ethers.getSigners();
      expect(await whitelistedVesting.connect(owner).addAddressToWhitelist(newBenefitiary1.address));
      expect(await whitelistedVesting.whitelist(newBenefitiary1.address)).to.equal(true);
    });

    it('Should remove single address from the whitelist', async () => {
      const { whitelistedVesting, owner } = await loadFixture(deploySimpleVesting);
      const [newBenefitiary1] = await ethers.getSigners();
      expect(await whitelistedVesting.connect(owner).addAddressToWhitelist(newBenefitiary1.address));
      expect(await whitelistedVesting.connect(owner).removeAddressFromWhitelist(newBenefitiary1.address));
      expect(await whitelistedVesting.whitelist(newBenefitiary1.address)).to.equal(false);
    });
  });
});
