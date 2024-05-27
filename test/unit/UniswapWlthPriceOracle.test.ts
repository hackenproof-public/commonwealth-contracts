import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { UniswapWlthPriceOracle } from '../../typechain-types';

describe('UniswapWlthPriceOracle unit tests', () => {
  const observationTime = 60; //1 minute, ~~

  const deployOracle = async () => {
    const [deployer, owner, wlth, usdc] = await ethers.getSigners();
    const uniswapPool: FakeContract<any> = await smock.fake('IUniswapV3Pool');
    const UniswapWlthPriceOracle: UniswapWlthPriceOracle = await deployProxy(
      'UniswapWlthPriceOracle',
      [owner.address, wlth.address, usdc.address, uniswapPool.address, observationTime],
      deployer
    );

    return { UniswapWlthPriceOracle, deployer, owner, wlth, usdc, observationTime, uniswapPool };
  };

  it('Should deploy', async () => {
    const [deployer, owner, poolAddress, wlth, usdc] = await ethers.getSigners();

    expect(
      await deployProxy(
        'UniswapWlthPriceOracle',
        [owner.address, wlth.address, usdc.address, poolAddress.address, observationTime],
        deployer
      )
    ).not.to.be.reverted;
  });

  it("Should revert when reinitializing the contract's proxy", async () => {
    const { UniswapWlthPriceOracle, owner } = await loadFixture(deployOracle);

    await expect(
      UniswapWlthPriceOracle.initialize(owner.address, owner.address, owner.address, owner.address, 0)
    ).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('Should revert deploying if WLTH token is zero address', async () => {
    const { UniswapWlthPriceOracle } = await loadFixture(deployOracle);
    const [deployer, owner, usdc, pool] = await ethers.getSigners();

    await expect(
      deployProxy(
        'UniswapWlthPriceOracle',
        [owner.address, constants.AddressZero, usdc.address, pool.address, observationTime],
        deployer
      )
    ).to.be.revertedWithCustomError(UniswapWlthPriceOracle, 'UniswapWlthPriceOracle__WlthZeroAddress');
  });

  it('Should revert deploying if USDC is zero address', async () => {
    const { UniswapWlthPriceOracle } = await loadFixture(deployOracle);
    const [deployer, owner, wlth, pool] = await ethers.getSigners();

    await expect(
      deployProxy(
        'UniswapWlthPriceOracle',
        [owner.address, wlth.address, constants.AddressZero, pool.address, observationTime],
        deployer
      )
    ).to.be.revertedWithCustomError(UniswapWlthPriceOracle, 'UniswapWlthPriceOracle__UsdcZeroAddress');
  });

  it('Should revert deploying if pool is zero address', async () => {
    const { UniswapWlthPriceOracle } = await loadFixture(deployOracle);
    const [deployer, owner, wlth, usdc, pool] = await ethers.getSigners();

    await expect(
      deployProxy('UniswapWlthPriceOracle', [owner.address, wlth.address, usdc.address, pool.address, 0], deployer)
    ).to.be.revertedWithCustomError(UniswapWlthPriceOracle, 'UniswapWlthPriceOracle__ObservationTimeZero');
  });

  it('Should revert given zero amount', async () => {
    const { UniswapWlthPriceOracle } = await loadFixture(deployOracle);

    await expect(UniswapWlthPriceOracle.estimateAmountOut(0)).to.be.revertedWithCustomError(
      UniswapWlthPriceOracle,
      'UniswapWlthPriceOracle__ZeroAmount'
    );
  });

  it('Should return estimated WLTH price', async () => {
    const { UniswapWlthPriceOracle, uniswapPool } = await loadFixture(deployOracle);
    uniswapPool.observe.returns([1, 2, 3], [1, 2, 3]);

    await expect(UniswapWlthPriceOracle.estimateAmountOut(1000));
  });

  it('Should get WLTH token address', async () => {
    const { UniswapWlthPriceOracle, wlth } = await loadFixture(deployOracle);

    expect(await UniswapWlthPriceOracle.getWlthTokenAddress()).to.equals(wlth.address);
  });

  it('Should get USDC token address', async () => {
    const { UniswapWlthPriceOracle, usdc } = await loadFixture(deployOracle);

    expect(await UniswapWlthPriceOracle.getUsdcTokenAddress()).to.equals(usdc.address);
  });

  it('Should get pool address', async () => {
    const { UniswapWlthPriceOracle, uniswapPool } = await loadFixture(deployOracle);

    expect(await UniswapWlthPriceOracle.getPoolAddress()).to.equals(uniswapPool.address);
  });

  it('Should set observation time and emit event', async () => {
    const { UniswapWlthPriceOracle, observationTime, owner } = await loadFixture(deployOracle);
    const newObservationTime = 120;
    expect(await UniswapWlthPriceOracle.connect(owner).setObservationTime(newObservationTime))
      .to.emit(UniswapWlthPriceOracle, 'ObservationTimeSet')
      .withArgs(observationTime, newObservationTime);
  });

  it('Should revert if observation time is zero', async () => {
    const { UniswapWlthPriceOracle, owner } = await loadFixture(deployOracle);
    const newObservationTime = 0;
    await expect(
      UniswapWlthPriceOracle.connect(owner).setObservationTime(newObservationTime)
    ).to.be.revertedWithCustomError(UniswapWlthPriceOracle, 'UniswapWlthPriceOracle__ObservationTimeZero');
  });

  it('Should revert if not called by owner', async () => {
    const { UniswapWlthPriceOracle, deployer } = await loadFixture(deployOracle);
    const newObservationTime = 10;
    await expect(UniswapWlthPriceOracle.connect(deployer).setObservationTime(newObservationTime)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('Should set the pool address and emit event', async () => {
    const { UniswapWlthPriceOracle, owner } = await loadFixture(deployOracle);
    const newPoolAddress = ethers.Wallet.createRandom();

    expect(await UniswapWlthPriceOracle.connect(owner).setPoolAddress(newPoolAddress.address))
      .to.emit(UniswapWlthPriceOracle, 'PoolAddressSet')
      .withArgs(constants.AddressZero, newPoolAddress.address);
  });

  it('Should revert if pool address is zero', async () => {
    const { UniswapWlthPriceOracle, owner } = await loadFixture(deployOracle);

    await expect(
      UniswapWlthPriceOracle.connect(owner).setPoolAddress(constants.AddressZero)
    ).to.be.revertedWithCustomError(UniswapWlthPriceOracle, 'UniswapWlthPriceOracle__PoolZeroAddress');
  });

  it('Should revert if set pool not called by owner', async () => {
    const { UniswapWlthPriceOracle, deployer } = await loadFixture(deployOracle);
    const newPoolAddress = ethers.Wallet.createRandom();

    await expect(UniswapWlthPriceOracle.connect(deployer).setPoolAddress(newPoolAddress.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });
});
