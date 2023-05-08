import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { ISwapRouter, UniswapSwapper } from '../../typechain-types';

describe('Uniswap swapper unit tests', () => {
  const SOME_AMOUNT = 12223;
  const SOME_OTHER_AMOUNT = 61142;
  const SOME_ADDRESS = '0xbd3Afb0bB76683eCb4225F9DBc91f998713C3b01';
  const SOME_OTHER_ADDRESS = '0x388C818CA8B9251b393131C08a736A67ccB19297';
  const ZERO_POINT_THREE_FEE_TIER = 3000;

  const deploySwapper = async () => {
    const [deployer] = await ethers.getSigners();

    const router: FakeContract<ISwapRouter> = await smock.fake('ISwapRouter');
    router.exactInputSingle.returns(SOME_OTHER_AMOUNT);

    const uniswapSwapper: UniswapSwapper = await deploy('UniswapSwapper', deployer, [
      router.address,
      ZERO_POINT_THREE_FEE_TIER
    ]);

    return { uniswapSwapper, deployer };
  };

  it('Should deploy with correct router', async () => {
    const [deployer] = await ethers.getSigners();

    const router: FakeContract<ISwapRouter> = await smock.fake('ISwapRouter');
    const uniswapSwapper: UniswapSwapper = await deploy('UniswapSwapper', deployer, [
      router.address,
      ZERO_POINT_THREE_FEE_TIER
    ]);

    expect(await uniswapSwapper.swapRouter()).to.equal(router.address);
  });

  it('Should emit swapped event', async () => {
    const { uniswapSwapper, deployer } = await loadFixture(deploySwapper);

    await expect(await uniswapSwapper.swap(SOME_AMOUNT, SOME_ADDRESS, SOME_OTHER_ADDRESS))
      .to.emit(uniswapSwapper, 'Swapped')
      .withArgs(deployer.address, SOME_AMOUNT, SOME_ADDRESS, SOME_OTHER_AMOUNT, SOME_OTHER_ADDRESS);
  });
});
