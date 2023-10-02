import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { SimpleVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

// TODO: fix timestamp manipulation crashes next tests issue
describe('Simple vesting unit tests', () => {
  const TWENTY_FOUR_BILIONS = '24000000';
  const SECONDS_IN_YEAR = 31536000;
  const TWO_YEARS = 2 * SECONDS_IN_YEAR;
  const ONE_MONTH = SECONDS_IN_YEAR / 12;
  const ONE_SECOND = 1000;
  const ONE_TOKEN = toWlth('1');
  const allocation = toWlth(TWENTY_FOUR_BILIONS);
  const duration = TWO_YEARS;
  const cadence = ONE_MONTH;
  const allocationGroupId = 1;

  const deploySimpleVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

    const [deployer, beneficiary, owner] = await ethers.getSigners();
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const simpleVesting: SimpleVesting = await deploy(
      'SimpleVesting',
      [
        owner.address,
        wlth.address,
        allocationGroupId,
        allocation,
        duration,
        cadence,
        vestingStartTimestamp,
        beneficiary.address
      ],
      deployer
    );

    return {
      owner,
      simpleVesting,
      wlth,
      deployer,
      beneficiary,
      allocation,
      duration,
      cadence,
      vestingStartTimestamp
    };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const { simpleVesting, wlth, beneficiary, allocation, duration, vestingStartTimestamp, cadence } =
        await loadFixture(deploySimpleVesting);

      expect(await simpleVesting.getVestedToken()).to.equal(wlth.address);
      expect(await simpleVesting.beneficiary()).to.equal(beneficiary.address);
      expect(await simpleVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await simpleVesting.allocation()).to.equal(allocation);
      expect(await simpleVesting.duration()).to.equal(duration);
      expect(await simpleVesting.cadence()).to.equal(cadence);
    });
  });

  describe('getReleasableAmount()', () => {
    it('Should return no releaseable tokens if timestamp before vesting start', async () => {
      const { simpleVesting, wlth, allocation, beneficiary, vestingStartTimestamp } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

      expect(await simpleVesting.connect(beneficiary).releaseableAmount()).to.equal(0);
    });

    it('Should return releaseable tokens after first cadence from vesting start moment', async () => {
      const { simpleVesting, vestingStartTimestamp, wlth, allocation, beneficiary, cadence } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + cadence);
      expect(await simpleVesting.connect(beneficiary).releaseableAmount()).to.equal(toWlth('1000000'));
    });

    it('Should return releaseable tokens for two cadences at start of second cadence', async () => {
      const { simpleVesting, cadence, vestingStartTimestamp, wlth, beneficiary } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + 2 * cadence);

      expect(await simpleVesting.connect(beneficiary).releaseableAmount()).to.equal(toWlth('2000000'));
    });

    it('Should return whole token allocation at duration pass moment', async () => {
      const { simpleVesting, duration, vestingStartTimestamp, wlth, beneficiary } = await loadFixture(
        deploySimpleVesting
      );
      wlth.balanceOf.returns(allocation);
      await time.increaseTo(vestingStartTimestamp + duration);

      expect(await simpleVesting.connect(beneficiary).releaseableAmount()).to.equal(toWlth('24000000'));
    });

    describe('release()', () => {
      it('Should not release tokens before vesting time', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth } = await loadFixture(deploySimpleVesting);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address)
        ).to.be.revertedWith('Vesting has not started yet!');
      });

      it('Should release tokens within vesting time', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, cadence, wlth, allocation, duration } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);

        await time.increaseTo(vestingStartTimestamp + cadence);
        await simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address);
        expect(await simpleVesting.connect(beneficiary).released()).to.equal(toWlth('1000000'));
        wlth.balanceOf.returns(allocation);

        await time.increaseTo(vestingStartTimestamp + 2 * cadence);
        await simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address);
        expect(await simpleVesting.connect(beneficiary).released()).to.equal(toWlth('2000000'));

        await time.increaseTo(vestingStartTimestamp + duration);
        await simpleVesting.connect(beneficiary).release(toWlth('22000000'), beneficiary.address);
        expect(await simpleVesting.connect(beneficiary).released()).to.equal(toWlth('24000000'));
      });

      it('Should revert releasing tokens if not enough vested', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth } = await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000').add(ONE_TOKEN), beneficiary.address)
        ).to.be.revertedWith('Not enough tokens vested!');
      });

      it('Should revert releasing tokens if not beneficiary', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth, deployer } = await loadFixture(
          deploySimpleVesting
        );
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          simpleVesting.connect(deployer).release(toWlth('1000000'), beneficiary.address)
        ).to.be.revertedWith('Unauthorized access!');
      });

      it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth, cadence } = await loadFixture(
          deploySimpleVesting
        );
        wlth.balanceOf.returns(0);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address)
        ).to.be.revertedWith('Not enough currency to process the release!');
      });

      it('Should revert releasing tokens if transfer fails', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth, deployer } = await loadFixture(
          deploySimpleVesting
        );
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address)
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
      });
    });
  });
});
