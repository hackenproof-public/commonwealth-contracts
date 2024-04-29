import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { IV3SwapRouter, UniswapSwapper } from '../../typechain-types';
import { toUsdc, toWlth } from '../utils';

describe('Uniswap swapper unit tests', () => {
  const ZERO_POINT_THREE_FEE_TIER = 3000;
  const deploySwapper = async () => {
    const [deployer, owner, wlth, usdc] = await ethers.getSigners();
    const swapRouter: FakeContract<IV3SwapRouter> = await smock.fake('IV3SwapRouter');

    const uniswapSwapper: UniswapSwapper = await deployProxy(
      'UniswapSwapper',
      [owner.address, swapRouter.address],
      deployer
    );

    return { uniswapSwapper, deployer, owner, swapRouter, wlth, usdc };
  };

  it('Should deploy with correct router', async () => {
    const [deployer, owner] = await ethers.getSigners();

    const router: FakeContract<IV3SwapRouter> = await smock.fake('IV3SwapRouter');
    const uniswapSwapper: UniswapSwapper = await deployProxy(
      'UniswapSwapper',
      [owner.address, router.address],
      deployer
    );

    expect(await uniswapSwapper.getIV3SwapRouterAddress()).to.equal(router.address);
  });

  it('Should revert deploying if dex swap router is zero address', async () => {
    const { uniswapSwapper } = await loadFixture(deploySwapper);
    const [deployer, owner] = await ethers.getSigners();

    await expect(
      deployProxy('UniswapSwapper', [owner.address, constants.AddressZero], deployer)
    ).to.be.revertedWithCustomError(uniswapSwapper, 'UniswapSwapper__IV3SwapRouterZeroAddress');
  });

  it('Should emit swapped event', async () => {
    const { uniswapSwapper, wlth, usdc, owner, swapRouter } = await loadFixture(deploySwapper);
    swapRouter.exactInputSingle.returns(toUsdc('40'));

    await expect(
      uniswapSwapper
        .connect(owner)
        .swap(toWlth('1000'), wlth.address, usdc.address, ZERO_POINT_THREE_FEE_TIER, toUsdc('40'), 0)
    )
      .to.emit(uniswapSwapper, 'Swapped')
      .withArgs(owner.address, toWlth('1000'), wlth.address, toUsdc('40'), usdc.address);
  });

  it('Should revert swapping if paused', async () => {
    const { uniswapSwapper, owner, wlth, usdc } = await loadFixture(deploySwapper);

    await uniswapSwapper.connect(owner).pause();
    await expect(
      uniswapSwapper.swap(toWlth('1000'), wlth.address, usdc.address, ZERO_POINT_THREE_FEE_TIER, toUsdc('33'), 0)
    ).to.be.revertedWith('Pausable: paused');
  });

  it('Should revert deploying if dex swap router is zero address', async () => {
    const { uniswapSwapper } = await loadFixture(deploySwapper);
    const [deployer, owner] = await ethers.getSigners();

    await expect(
      deployProxy('UniswapSwapper', [owner.address, constants.AddressZero], deployer)
    ).to.be.revertedWithCustomError(uniswapSwapper, 'UniswapSwapper__IV3SwapRouterZeroAddress');
  });

  it('Should set new SwapRouter02 address', async () => {
    const { uniswapSwapper, swapRouter, owner } = await loadFixture(deploySwapper);
    const [newSwapRouter] = await ethers.getSigners();

    await expect(
      uniswapSwapper.connect(owner).setIV3SwapRouterAddress(newSwapRouter.address)).to.emit(uniswapSwapper, 'SwapRouterSet').withArgs(swapRouter.address,newSwapRouter.address);
  });

  it('Should revert set new SwapRouter02 address if not owner', async () => {
    const { uniswapSwapper, deployer } = await loadFixture(deploySwapper);
    const [newSwapRouter] = await ethers.getSigners();

   await expect( 
      uniswapSwapper.connect(deployer).setIV3SwapRouterAddress(newSwapRouter.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
  });

  it('Should revert set new SwapRouter02 if address is zero', async () => {
    const { uniswapSwapper, owner } = await loadFixture(deploySwapper);
    const [newSwapRouter] = await ethers.getSigners();

    await expect(
      uniswapSwapper.connect(owner).setIV3SwapRouterAddress(constants.AddressZero)).to.be.revertedWithCustomError(uniswapSwapper, 'UniswapSwapper__IV3SwapRouterZeroAddress');
  });
});
