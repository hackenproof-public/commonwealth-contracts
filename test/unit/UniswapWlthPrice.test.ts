import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { UniswapWlthPrice } from '../../typechain-types';

describe('UniswapWlthPrice unit tests', () => {
  const observationTime = 60; //1 minute, ~~

  const deployOracle = async () => {
    const [deployer, owner, wlth, usdc] = await ethers.getSigners();
    const uniswapPool: FakeContract<any> = await smock.fake('IUniswapV3Pool');
    const uniswapWlthPrice: UniswapWlthPrice = await deployProxy(
      'UniswapWlthPrice',
      [owner.address, wlth.address, usdc.address, uniswapPool.address, observationTime],
      deployer
    );

    return { uniswapWlthPrice, deployer, owner, wlth, usdc, observationTime, uniswapPool };
  };

  it('Should deploy', async () => {
    const [deployer, owner, poolAddress, wlth, usdc] = await ethers.getSigners();

    expect(
      await deployProxy(
        'UniswapWlthPrice',
        [owner.address, wlth.address, usdc.address, poolAddress.address, observationTime],
        deployer
      )
    ).not.to.be.reverted;
  });

  it('Should revert deploying if WLTH token is zero address', async () => {
    const { uniswapWlthPrice } = await loadFixture(deployOracle);
    const [deployer, owner, usdc, pool] = await ethers.getSigners();

    await expect(
      deployProxy(
        'UniswapWlthPrice',
        [owner.address, constants.AddressZero, usdc.address, pool.address, observationTime],
        deployer
      )
    ).to.be.revertedWithCustomError(uniswapWlthPrice, 'UniswapWlthPrice__WlthZeroAddress');
  });

  it('Should revert deploying if USDC is zero address', async () => {
    const { uniswapWlthPrice } = await loadFixture(deployOracle);
    const [deployer, owner, wlth, pool] = await ethers.getSigners();

    await expect(
      deployProxy(
        'UniswapWlthPrice',
        [owner.address, wlth.address, constants.AddressZero, pool.address, observationTime],
        deployer
      )
    ).to.be.revertedWithCustomError(uniswapWlthPrice, 'UniswapWlthPrice__UsdcZeroAddress');
  });

  it('Should revert deploying if pool is zero address', async () => {
    const { uniswapWlthPrice } = await loadFixture(deployOracle);
    const [deployer, owner, wlth, usdc, pool] = await ethers.getSigners();

    await expect(
      deployProxy('UniswapWlthPrice', [owner.address, wlth.address, usdc.address, pool.address, 0], deployer)
    ).to.be.revertedWithCustomError(uniswapWlthPrice, 'UniswapWlthPrice__ObservationTimeZero');
  });

  it('Should revert deploying if observation time is zero', async () => {
    const { uniswapWlthPrice } = await loadFixture(deployOracle);
    const [deployer, owner, wlth, usdc] = await ethers.getSigners();

    await expect(
      deployProxy('UniswapWlthPrice', [owner.address, wlth.address, usdc.address, constants.AddressZero, 0], deployer)
    ).to.be.revertedWithCustomError(uniswapWlthPrice, 'UniswapWlthPrice__PoolZeroAddress');
  });

  it('Should revert given zero amount', async () => {
    const { uniswapWlthPrice } = await loadFixture(deployOracle);

    await expect(uniswapWlthPrice.estimateAmountOut(0)).to.be.revertedWithCustomError(
      uniswapWlthPrice,
      'UniswapWlthPrice__ZeroAmount'
    );
  });

  it('Should return estimated WLTH price', async () => {
    const { uniswapWlthPrice, uniswapPool } = await loadFixture(deployOracle);
    uniswapPool.observe.returns([1, 2, 3], [1, 2, 3]);

    await expect(uniswapWlthPrice.estimateAmountOut(1000));
  });

  it('Should get WLTH token address', async () => {
    const { uniswapWlthPrice, wlth } = await loadFixture(deployOracle);

    expect(await uniswapWlthPrice.getWlthTokenAddress()).to.equals(wlth.address);
  });

  it('Should get USDC token address', async () => {
    const { uniswapWlthPrice, usdc } = await loadFixture(deployOracle);

    expect(await uniswapWlthPrice.getUsdcTokenAddress()).to.equals(usdc.address);
  });

  it('Should get pool address', async () => {
    const { uniswapWlthPrice, uniswapPool } = await loadFixture(deployOracle);

    expect(await uniswapWlthPrice.getPoolAddress()).to.equals(uniswapPool.address);
  });

  it('Should set observation time and emit event', async () => {
    const { uniswapWlthPrice, observationTime, owner } = await loadFixture(deployOracle);
    const newObservationTime = 120;
    expect(await uniswapWlthPrice.connect(owner).setObservationTime(newObservationTime))
      .to.emit(uniswapWlthPrice, 'ObservationTimeSet')
      .withArgs(observationTime, newObservationTime);
  });

  it('Should revert if observation time is zero', async () => {
    const { uniswapWlthPrice, owner } = await loadFixture(deployOracle);
    const newObservationTime = 0;
    await expect(uniswapWlthPrice.connect(owner).setObservationTime(newObservationTime)).to.be.revertedWithCustomError(
      uniswapWlthPrice,
      'UniswapWlthPrice__ObservationTimeZero'
    );
  });

  it('Should revert if not called by owner', async () => {
    const { uniswapWlthPrice, deployer } = await loadFixture(deployOracle);
    const newObservationTime = 10;
    await expect(uniswapWlthPrice.connect(deployer).setObservationTime(newObservationTime)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });
});
