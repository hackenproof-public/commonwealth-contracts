import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { BuybackAndBurn, IUniswapV3Pool, UniswapSwapper, USDC, Wlth } from '../../typechain-types';
import { toUsdc } from '../utils';

describe('BuybackAndBurn', () => {
  const deployBuybackAndBurn = async () => {
    const [deployer, owner] = await ethers.getSigners();
    const minimumBuyback = toUsdc('10');

    const wlth: FakeContract<Wlth> = await smock.fake('Wlth');
    const usdc: FakeContract<USDC> = await smock.fake('USDC');
    const swapper: FakeContract<UniswapSwapper> = await smock.fake('UniswapSwapper');
    const pool: FakeContract<IUniswapV3Pool> = await smock.fake('IUniswapV3Pool');

    const buybackAndBurn = (await deployProxy(
      'BuybackAndBurn',
      [owner.address, wlth.address, usdc.address, swapper.address, pool.address, minimumBuyback],
      deployer
    )) as BuybackAndBurn;

    return {
      deployer,
      owner,
      wlth,
      usdc,
      swapper,
      pool,
      minimumBuyback,
      buybackAndBurn
    };
  };

  describe('Deployment', () => {
    describe('Success', () => {
      it('Should deploy the contract with initial params', async () => {
        const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
          deployBuybackAndBurn
        );

        expect(await buybackAndBurn.owner()).to.equal(owner.address);
        expect(await buybackAndBurn.wlth()).to.equal(wlth.address);
        expect(await buybackAndBurn.usdc()).to.equal(usdc.address);
        expect(await buybackAndBurn.swapper()).to.equal(swapper.address);
        expect(await buybackAndBurn.pool()).to.equal(pool.address);
        expect(await buybackAndBurn.minimumBuyback()).to.equal(minimumBuyback);
        expect(await buybackAndBurn.checkUpkeep('0x')).to.deep.equal([false, '0x']);
      });

      describe('Reverts', () => {
        it("Should revert if the owner's address is the zero address", async () => {
          const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
            deployBuybackAndBurn
          );
          await expect(
            deployProxy(
              'BuybackAndBurn',
              [ethers.constants.AddressZero, wlth.address, usdc.address, swapper.address, pool.address, minimumBuyback],
              deployer
            )
          ).to.be.revertedWithCustomError(buybackAndBurn, 'BuybackAndBurn__OwnerZeroAddress');
        });
      });

      it("Should revert if the wlth's address is the zero address", async () => {
        const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
          deployBuybackAndBurn
        );
        await expect(
          deployProxy(
            'BuybackAndBurn',
            [owner.address, ethers.constants.AddressZero, usdc.address, swapper.address, pool.address, minimumBuyback],
            deployer
          )
        ).to.be.revertedWithCustomError(buybackAndBurn, 'BuybackAndBurn__WlthZeroAddress');
      });

      it("Should revert if the usdc's address is the zero address", async () => {
        const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
          deployBuybackAndBurn
        );
        await expect(
          deployProxy(
            'BuybackAndBurn',
            [owner.address, wlth.address, ethers.constants.AddressZero, swapper.address, pool.address, minimumBuyback],
            deployer
          )
        ).to.be.revertedWithCustomError(buybackAndBurn, 'BuybackAndBurn__UsdcZeroAddress');
      });

      it("Should revert if the swapper's address is the zero address", async () => {
        const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
          deployBuybackAndBurn
        );
        await expect(
          deployProxy(
            'BuybackAndBurn',
            [owner.address, wlth.address, usdc.address, ethers.constants.AddressZero, pool.address, minimumBuyback],
            deployer
          )
        ).to.be.revertedWithCustomError(buybackAndBurn, 'BuybackAndBurn__SwapperZeroAddress');
      });

      it("Should revert if the pool's address is the zero address", async () => {
        const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
          deployBuybackAndBurn
        );
        await expect(
          deployProxy(
            'BuybackAndBurn',
            [owner.address, wlth.address, usdc.address, swapper.address, ethers.constants.AddressZero, minimumBuyback],
            deployer
          )
        ).to.be.revertedWithCustomError(buybackAndBurn, 'BuybackAndBurn__PoolZeroAddress');
      });

      it('Should revert when reinitialize the contract', async () => {
        const { deployer, owner, wlth, usdc, swapper, pool, minimumBuyback, buybackAndBurn } = await loadFixture(
          deployBuybackAndBurn
        );
        await expect(
          buybackAndBurn.initialize(
            owner.address,
            wlth.address,
            usdc.address,
            swapper.address,
            pool.address,
            minimumBuyback
          )
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });

    describe('Set minimum buyback', () => {
      describe('Success', () => {
        it('Should set the minimum buyback', async () => {
          const { buybackAndBurn, owner } = await loadFixture(deployBuybackAndBurn);

          const newMinimumBuyback = toUsdc('2000');

          await expect(buybackAndBurn.connect(owner).setMinimumBuyback(newMinimumBuyback))
            .to.emit(buybackAndBurn, 'MinimumBuybackSet')
            .withArgs(newMinimumBuyback);
          expect(await buybackAndBurn.minimumBuyback()).to.equal(newMinimumBuyback);
        });
      });

      describe('Reverts', () => {
        it('Should revert if the caller is not the owner', async () => {
          const { buybackAndBurn, deployer } = await loadFixture(deployBuybackAndBurn);

          await expect(buybackAndBurn.connect(deployer).setMinimumBuyback(toUsdc('2000'))).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        });
      });
    });

    describe('Check upkeep', () => {
      describe('Success', () => {
        it('Should the upkeep function return true if balance equal then minimum buyback', async () => {
          const { buybackAndBurn, usdc, minimumBuyback } = await loadFixture(deployBuybackAndBurn);

          usdc.balanceOf.whenCalledWith(buybackAndBurn.address).returns(minimumBuyback);

          const results = await buybackAndBurn.checkUpkeep('0x');
          expect(results[0]).to.be.true;
          expect(results[1]).to.equal('0x');
        });

        it('Should the upkeep function return true if balance greater then minimum buyback', async () => {
          const { buybackAndBurn, usdc, minimumBuyback } = await loadFixture(deployBuybackAndBurn);

          usdc.balanceOf.whenCalledWith(buybackAndBurn.address).returns(minimumBuyback.add(1));

          const results = await buybackAndBurn.checkUpkeep('0x');
          expect(results[0]).to.be.true;
          expect(results[1]).to.equal('0x');
        });
      });

      it('Should the upkeep function return false if balance less then minimum buyback', async () => {
        const { buybackAndBurn, usdc, minimumBuyback } = await loadFixture(deployBuybackAndBurn);

        usdc.balanceOf.whenCalledWith(buybackAndBurn.address).returns(minimumBuyback.sub(1));

        const results = await buybackAndBurn.checkUpkeep('0x');
        expect(results[0]).to.be.false;
        expect(results[1]).to.equal('0x');
      });
    });

    describe('Perform upkeep', () => {
      describe('Success', () => {
        it('Should perform buyback and burn', async () => {
          const { buybackAndBurn, usdc, wlth, swapper, pool, minimumBuyback } = await loadFixture(deployBuybackAndBurn);

          usdc.balanceOf.whenCalledWith(buybackAndBurn.address).returns(minimumBuyback);
          usdc.approve.returns(true);
          wlth.balanceOf.whenCalledWith(buybackAndBurn.address).returns(100);
          pool.slot0.returns([100, 0, 0, 0, 0, 0, 0]);
          swapper.swap.returns(100);

          await expect(buybackAndBurn.performUpkeep('0x'))
            .to.emit(buybackAndBurn, 'BuybackAndBurnPerformed')
            .withArgs(100, minimumBuyback);
        });
      });
      describe('Reverts', () => {
        it('Should revert when balance less then minimum buyback', async () => {
          const { buybackAndBurn, usdc, minimumBuyback } = await loadFixture(deployBuybackAndBurn);

          usdc.balanceOf.whenCalledWith(buybackAndBurn.address).returns(minimumBuyback.sub(1));

          await expect(buybackAndBurn.performUpkeep('0x')).to.be.revertedWithCustomError(
            buybackAndBurn,
            'BuybackAndBurn__InvalidBalance'
          );
        });

        it('Should revert when balance equal 0', async () => {
          const { buybackAndBurn, usdc, minimumBuyback } = await loadFixture(deployBuybackAndBurn);

          usdc.balanceOf.whenCalledWith(buybackAndBurn.address).returns(0);

          await expect(buybackAndBurn.performUpkeep('0x')).to.be.revertedWithCustomError(
            buybackAndBurn,
            'BuybackAndBurn__InvalidBalance'
          );
        });
      });
    });
  });
});
