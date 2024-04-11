import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { SimpleVesting, Wlth } from '../../typechain-types';
import { toWlth } from '../utils';

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
  const leftoversUnlockDelay = SECONDS_IN_YEAR;

  const deploySimpleVesting = async () => {
    const referenceTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vestingStartTimestamp = referenceTimestamp + ONE_MONTH;

    const [deployer, beneficiary, owner] = await ethers.getSigners();
    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const simpleVesting: SimpleVesting = await deploy(
      'SimpleVesting',
      [owner.address, wlth.address, beneficiary.address, allocation, duration, cadence, leftoversUnlockDelay, 0],
      deployer
    );

    await simpleVesting.connect(owner).setVestingStartTimestamp(vestingStartTimestamp);

    return {
      owner,
      simpleVesting,
      wlth,
      deployer,
      beneficiary,
      allocation,
      duration,
      cadence,
      vestingStartTimestamp,
      leftoversUnlockDelay
    };
  };

  describe('Deployment', () => {
    it('Should revert deployment when owner is zero address', async () => {
      const { simpleVesting, wlth, beneficiary, allocation, duration, vestingStartTimestamp, cadence, deployer } =
        await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
          'SimpleVesting',
          [
            constants.AddressZero,
            wlth.address,
            beneficiary.address,
            allocation,
            duration,
            cadence,
            leftoversUnlockDelay,
            vestingStartTimestamp
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__OwnerZeroAddress');
    });

    it('Should revert deployment when wlth is zero address', async () => {
      const { simpleVesting, beneficiary, allocation, duration, vestingStartTimestamp, cadence, owner, deployer } =
        await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
          'SimpleVesting',
          [
            owner.address,
            constants.AddressZero,
            beneficiary.address,
            allocation,
            duration,
            cadence,
            leftoversUnlockDelay,
            vestingStartTimestamp
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__WlthZeroAddress');
    });

    it('Should revert deployment when beneficiary is zero address', async () => {
      const { simpleVesting, wlth, allocation, duration, vestingStartTimestamp, cadence, owner, deployer } =
        await loadFixture(deploySimpleVesting);

      await expect(
        deploy(
          'SimpleVesting',
          [
            owner.address,
            wlth.address,
            constants.AddressZero,
            allocation,
            duration,
            cadence,
            leftoversUnlockDelay,
            vestingStartTimestamp
          ],
          deployer
        )
      ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__BeneficiaryZeroAddress');
    });

    it('Should revert deployment when invalid vesting start timestamp provided', async () => {
      const { simpleVesting, wlth, allocation, duration, beneficiary, cadence, owner, deployer } = await loadFixture(
        deploySimpleVesting
      );

      await expect(
        deploy(
          'SimpleVesting',
          [owner.address, wlth.address, beneficiary.address, allocation, duration, cadence, leftoversUnlockDelay, 1],
          deployer
        )
      ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__PastVestingStartTimestamp');
    });

    it('Should return initial parameters', async () => {
      const {
        simpleVesting,
        wlth,
        beneficiary,
        allocation,
        duration,
        vestingStartTimestamp,
        cadence,
        leftoversUnlockDelay,
        owner
      } = await loadFixture(deploySimpleVesting);

      expect(await simpleVesting.owner()).to.equal(owner.address);
      expect(await simpleVesting.wlth()).to.equal(wlth.address);
      expect(await simpleVesting.beneficiary()).to.equal(beneficiary.address);
      expect(await simpleVesting.vestingStartTimestamp()).to.equal(vestingStartTimestamp);
      expect(await simpleVesting.leftoversUnlockDelay()).to.equal(leftoversUnlockDelay);
      expect(await simpleVesting.allocation()).to.equal(allocation);
      expect(await simpleVesting.duration()).to.equal(duration);
      expect(await simpleVesting.cadence()).to.equal(cadence);
    });

    it('Should set new beneficiary', async () => {
      const { simpleVesting, owner, beneficiary } = await loadFixture(deploySimpleVesting);
      await expect(simpleVesting.connect(owner).setBeneficiary(owner.address))
        .to.emit(simpleVesting, 'BeneficiaryChanged')
        .withArgs(beneficiary.address, owner.address);
    });

    it('Should revert set new beneficiary if not called by owner', async () => {
      const { simpleVesting, owner, beneficiary } = await loadFixture(deploySimpleVesting);
      await expect(simpleVesting.connect(beneficiary).setBeneficiary(owner.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert if try to set zero address as new beneficiary', async () => {
      const { simpleVesting, owner, beneficiary } = await loadFixture(deploySimpleVesting);
      await expect(simpleVesting.connect(owner).setBeneficiary(constants.AddressZero)).to.be.revertedWithCustomError(
        simpleVesting,
        'SimpleVesting__BeneficiaryZeroAddress'
      );
    });

    it('Should revert already defined vesting start timestamp', async () => {
      const {
        wlth,
        allocation,
        duration,
        cadence,
        owner,
        deployer,
        beneficiary,
        leftoversUnlockDelay,
        vestingStartTimestamp
      } = await loadFixture(deploySimpleVesting);

      const simpleVesting = await deploy(
        'SimpleVesting',
        [
          owner.address,
          wlth.address,
          beneficiary.address,
          allocation,
          duration,
          cadence,
          leftoversUnlockDelay,
          vestingStartTimestamp
        ],
        deployer
      );

      const desiredVestingStartTimestmap = vestingStartTimestamp + ONE_MONTH;
      await expect(
        simpleVesting.connect(owner).setVestingStartTimestamp(desiredVestingStartTimestmap)
      ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__VestingStartTimestampAlreadyDefined');
    });

    it('Should revert if vesting start timestamp is past, lower than block timestamp', async () => {
      const {
        wlth,
        allocation,
        duration,
        cadence,
        owner,
        deployer,
        beneficiary,
        leftoversUnlockDelay,
        vestingStartTimestamp
      } = await loadFixture(deploySimpleVesting);

      const simpleVesting = await deploy(
        'SimpleVesting',
        [owner.address, wlth.address, beneficiary.address, allocation, duration, cadence, leftoversUnlockDelay, 0],
        deployer
      );

      const desiredVestingStartTimestmap = vestingStartTimestamp + ONE_MONTH;
      time.increaseTo(desiredVestingStartTimestmap + 1);
      await expect(
        simpleVesting.connect(owner).setVestingStartTimestamp(desiredVestingStartTimestmap)
      ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__PastVestingStartTimestamp');
    });

    it('Should revert if not called by owner', async () => {
      const {
        wlth,
        allocation,
        duration,
        cadence,
        owner,
        deployer,
        beneficiary,
        leftoversUnlockDelay,
        vestingStartTimestamp
      } = await loadFixture(deploySimpleVesting);

      const simpleVesting = await deploy(
        'SimpleVesting',
        [owner.address, wlth.address, beneficiary.address, allocation, duration, cadence, leftoversUnlockDelay, 0],
        deployer
      );

      const desiredVestingStartTimestmap = vestingStartTimestamp + ONE_MONTH;
      await expect(
        simpleVesting.connect(deployer).setVestingStartTimestamp(desiredVestingStartTimestmap)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should set vesting start timestamp after contract deployment', async () => {
      const {
        wlth,
        allocation,
        duration,
        cadence,
        owner,
        deployer,
        beneficiary,
        leftoversUnlockDelay,
        vestingStartTimestamp
      } = await loadFixture(deploySimpleVesting);

      const simpleVesting = await deploy(
        'SimpleVesting',
        [owner.address, wlth.address, beneficiary.address, allocation, duration, cadence, leftoversUnlockDelay, 0],
        deployer
      );

      const desiredVestingStartTimestmap = vestingStartTimestamp + ONE_MONTH;
      await expect(simpleVesting.connect(owner).setVestingStartTimestamp(desiredVestingStartTimestmap))
        .to.emit(simpleVesting, 'VestingStartTimestampSetted')
        .withArgs(desiredVestingStartTimestmap);
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
        ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__VestingNotStarted');
      });

      it('Should release tokens within vesting time', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, cadence, wlth, allocation, duration } =
          await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);
        const amount = toWlth('1000000');

        await time.increaseTo(vestingStartTimestamp + cadence);
        await expect(simpleVesting.connect(beneficiary).release(amount, beneficiary.address))
          .to.emit(simpleVesting, 'Released')
          .withArgs(beneficiary.address, wlth.address, amount);
        expect(await simpleVesting.connect(beneficiary).released()).to.equal(toWlth('1000000'));
        wlth.balanceOf.returns(allocation);

        await time.increaseTo(vestingStartTimestamp + 2 * cadence);
        await expect(simpleVesting.connect(beneficiary).release(amount, beneficiary.address))
          .to.emit(simpleVesting, 'Released')
          .withArgs(beneficiary.address, wlth.address, amount);
        expect(await simpleVesting.connect(beneficiary).released()).to.equal(toWlth('2000000'));

        await time.increaseTo(vestingStartTimestamp + duration);
        await expect(simpleVesting.connect(beneficiary).release(amount.mul(22), beneficiary.address))
          .to.emit(simpleVesting, 'Released')
          .withArgs(beneficiary.address, wlth.address, amount.mul(22));
        expect(await simpleVesting.connect(beneficiary).released()).to.equal(toWlth('24000000'));
      });

      it('Should revert releasing tokens if not enough vested', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth } = await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(true);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000').add(ONE_TOKEN), beneficiary.address)
        ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__NotEnoughTokensVested');
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
        ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__UnauthorizedAccess');
      });

      it('Should revert releasing tokens if not enough tokens on vesting contract', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth, cadence } = await loadFixture(
          deploySimpleVesting
        );
        wlth.balanceOf.returns(0);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address)
        ).to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__NotEnoughTokensOnContract');
      });

      it('Should revert releasing tokens if transfer fails', async () => {
        const { simpleVesting, vestingStartTimestamp, beneficiary, wlth } = await loadFixture(deploySimpleVesting);
        wlth.transfer.returns(false);
        wlth.balanceOf.returns(allocation);
        await time.increaseTo(vestingStartTimestamp + cadence);

        await expect(
          simpleVesting.connect(beneficiary).release(toWlth('1000000'), beneficiary.address)
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
      });
    });

    describe('Getters', () => {
      it('Should return zero vestedAmount before vestingStartTimestamp', async () => {
        const { simpleVesting, owner, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

        await time.increaseTo(vestingStartTimestamp - ONE_SECOND);

        expect(await simpleVesting.connect(owner).vestedAmount()).to.equal(0);
      });

      it('Should return proper vestedAmount', async () => {
        const { simpleVesting, owner, vestingStartTimestamp, cadence } = await loadFixture(deploySimpleVesting);

        await time.increaseTo(vestingStartTimestamp + cadence);

        expect(await simpleVesting.connect(owner).vestedAmount()).to.equal(toWlth('1000000'));
      });

      it('Should return whole allocation as vestedAmount after vesting end', async () => {
        const { simpleVesting, owner, vestingStartTimestamp, allocation } = await loadFixture(deploySimpleVesting);

        await time.increaseTo(vestingStartTimestamp + duration);

        expect(await simpleVesting.connect(owner).vestedAmount()).to.equal(allocation);
      });

      it('Should return actual cadence', async () => {
        const { simpleVesting, owner, vestingStartTimestamp } = await loadFixture(deploySimpleVesting);

        await time.increaseTo(vestingStartTimestamp + cadence * 3);

        expect(await simpleVesting.connect(owner).actualCadence()).to.equal(3);
      });

      it('Should return false if not benecifiary', async () => {
        const { simpleVesting, owner } = await loadFixture(deploySimpleVesting);

        expect(await simpleVesting.connect(owner).accessCheck()).to.equal(false);
      });

      it('Should true if benecifiary', async () => {
        const { simpleVesting, beneficiary } = await loadFixture(deploySimpleVesting);

        expect(await simpleVesting.connect(beneficiary).accessCheck()).to.equal(true);
      });
    });

    describe('Leftovers withdraw', () => {
      describe('Success', () => {
        it("Should withdraw all wlth from the contract's balance", async () => {
          const {
            simpleVesting,
            owner,
            wlth,
            allocation,
            leftoversUnlockDelay,
            vestingStartTimestamp,
            duration,
            beneficiary
          } = await loadFixture(deploySimpleVesting);
          wlth.transferFrom.reset();
          wlth.transfer.reset();
          wlth.transfer(simpleVesting.address, allocation);
          wlth.transfer.returns(true);
          wlth.balanceOf.returns(allocation);

          await time.increaseTo(vestingStartTimestamp + duration + leftoversUnlockDelay);

          await expect(simpleVesting.connect(owner).withdrawLeftovers(beneficiary.address))
            .to.emit(simpleVesting, 'LeftoversWithdrawn')
            .withArgs(beneficiary.address, allocation);

          expect(wlth.transfer).to.have.been.calledWith(beneficiary.address, allocation);
        });
      });

      describe('Reverts', () => {
        it('Should revert when not owner', async () => {
          const { simpleVesting, beneficiary } = await loadFixture(deploySimpleVesting);

          await expect(simpleVesting.connect(beneficiary).withdrawLeftovers(simpleVesting.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });

        it('Should revert when locked', async () => {
          const { simpleVesting, owner } = await loadFixture(deploySimpleVesting);

          await expect(simpleVesting.connect(owner).withdrawLeftovers(owner.address)).to.be.revertedWithCustomError(
            simpleVesting,
            'SimpleVesting__LeftoversWithdrawalLocked'
          );
        });

        it('Should revert when locked due to not setted vesting start timestamp', async () => {
          const { owner, wlth, beneficiary, allocation, duration, cadence, leftoversUnlockDelay, deployer } =
            await loadFixture(deploySimpleVesting);

          const simpleVesting = await deploy(
            'SimpleVesting',
            [owner.address, wlth.address, beneficiary.address, allocation, duration, cadence, leftoversUnlockDelay, 0],
            deployer
          );

          await expect(simpleVesting.connect(owner).withdrawLeftovers(owner.address)).to.be.revertedWithCustomError(
            simpleVesting,
            'SimpleVesting__LeftoversWithdrawalLocked'
          );
        });
      });
    });

    describe('Surplus withdraw', () => {
      describe('Success', () => {
        it('Should withdraw surplus from the contract', async () => {
          const { simpleVesting, owner, wlth, allocation, beneficiary } = await loadFixture(deploySimpleVesting);

          const surplus = toWlth('1000');
          wlth.balanceOf.reset();
          wlth.balanceOf.whenCalledWith(simpleVesting.address).returns(allocation.add(surplus));

          await expect(simpleVesting.connect(owner).withdrawSurplus(beneficiary.address))
            .to.emit(simpleVesting, 'SurplusWithdrawn')
            .withArgs(beneficiary.address, surplus);

          expect(wlth.transfer).to.have.been.calledWith(beneficiary.address, surplus);
        });
      });
      describe('Reverts', () => {
        it('Should revert when not owner', async () => {
          const { simpleVesting, beneficiary } = await loadFixture(deploySimpleVesting);

          await expect(simpleVesting.connect(beneficiary).withdrawSurplus(beneficiary.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });

        it('Should revert when no surplus', async () => {
          const { simpleVesting, owner, wlth, allocation, beneficiary } = await loadFixture(deploySimpleVesting);
          wlth.balanceOf.reset();
          wlth.balanceOf.whenCalledWith(simpleVesting.address).returns(allocation);

          await expect(simpleVesting.connect(owner).withdrawSurplus(beneficiary.address))
            .to.be.revertedWithCustomError(simpleVesting, 'SimpleVesting__NoSurplus')
            .withArgs(allocation, 0, allocation);
        });
      });
    });
  });
});
