import { FakeContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { IQuoterV2, UniswapQuoter } from '../../typechain-types';

describe('Uniswap Quoter unit tests', () => {
  const SOME_AMOUNT = 12223;
  const SOME_OTHER_AMOUNT = 61142;
  const SOME_ADDRESS = '0xbd3Afb0bB76683eCb4225F9DBc91f998713C3b01';
  const SOME_OTHER_ADDRESS = '0x388C818CA8B9251b393131C08a736A67ccB19297';
  const ZERO_POINT_THREE_FEE_TIER = 3000;

  const deployQuoter = async () => {
    const [deployer, owner] = await ethers.getSigners();

    const quoterInterface: FakeContract<IQuoterV2> = await smock.fake('IQuoterV2');

    const uniswapQuoter: UniswapQuoter = await deployProxy(
      'UniswapQuoter',
      [quoterInterface.address, ZERO_POINT_THREE_FEE_TIER],
      deployer
    );

    return { uniswapQuoter, deployer, owner, quoterInterface };
  };

  it('Should deploy', async () => {
    const [deployer, owner, quoterInterface] = await ethers.getSigners();

    expect(await deployProxy('UniswapQuoter', [quoterInterface.address, ZERO_POINT_THREE_FEE_TIER], deployer)).not.to.be
      .reverted;
  });

  it('Should revert deploying if origin quoter is zero address', async () => {
    const { uniswapQuoter } = await loadFixture(deployQuoter);
    const [deployer, owner] = await ethers.getSigners();

    await expect(
      deployProxy('UniswapQuoter', [constants.AddressZero, ZERO_POINT_THREE_FEE_TIER], deployer)
    ).to.be.revertedWithCustomError(uniswapQuoter, 'UniswapQuoter__OriginQuoterZeroAddress');
  });

  it('Should revert quote if tokenIn is zero address', async () => {
    const { uniswapQuoter } = await loadFixture(deployQuoter);
    const [tokenOut] = await ethers.getSigners();

    expect(await uniswapQuoter.quote(constants.AddressZero, tokenOut.address, 1)).to.be.reverted;
  });

  it('Should revert quote if tokenOut is zero address', async () => {
    const { uniswapQuoter } = await loadFixture(deployQuoter);
    const [tokenIn] = await ethers.getSigners();

    expect(await uniswapQuoter.quote(tokenIn.address, constants.AddressZero, 1)).to.be.reverted;
  });

  it('Should revert quote if amountIn is zero', async () => {
    const { uniswapQuoter } = await loadFixture(deployQuoter);
    const [tokenIn, tokenOut] = await ethers.getSigners();

    expect(await uniswapQuoter.quote(tokenIn.address, tokenOut.address, 0)).to.be.reverted;
  });

  it('Should not revert quote', async () => {
    const { uniswapQuoter } = await loadFixture(deployQuoter);
    const [tokenIn, tokenOut] = await ethers.getSigners();

    expect(await uniswapQuoter.quote(tokenIn.address, tokenOut.address, 1)).not.to.be.reverted;
  });
});
