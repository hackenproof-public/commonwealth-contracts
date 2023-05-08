const { expect } = require('chai');
const { ethers } = require('hardhat');

const WETH_ADDRESS = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'; // goerli
const USDC_ADDRESS = '0x07865c6E87B9F70255377e024ace6630C1Eaa37F'; // goerli
const USDC_DECIMALS = 6;
const SWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // goerli
const ZERO_POINT_THREE_FEE_TIER = 3000;

const ercAbi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint amount) returns (bool)',
  'function deposit() public payable',
  'function approve(address spender, uint256 amount) returns (bool)'
];

describe('UniswapSwapper goerli integration tests', function () {
  const TOTAL_WETH_AMOUNT = '0.00001';
  const SWAP_WETH_AMOUNT = '0.000001';

  it('Should swap WETH for integration USDC', async function () {
    const signers = await ethers.getSigners();

    /* Deploy the UniswapSwapper contract */
    console.log(`deploying UniswapSwapper using [${signers[0].address}]...`);
    const uniswapSwapperFactory = await ethers.getContractFactory('UniswapSwapper', signers[0]);
    const uniswapSwapper = await uniswapSwapperFactory.deploy(SWAP_ROUTER_ADDRESS, ZERO_POINT_THREE_FEE_TIER);
    await uniswapSwapper.deployed();
    console.log(`UniswapSwapper deployed at: [${uniswapSwapper.address}]`);

    /* Connect to WETH and wrap some eth  */
    console.log('getting WETH...');
    const WETH = new ethers.Contract(WETH_ADDRESS, ercAbi, signers[0]);
    const deposit = await WETH.deposit({ value: ethers.utils.parseEther(TOTAL_WETH_AMOUNT) });

    await deposit.wait();

    /* Check Initial USDC Balance */
    const USDC = new ethers.Contract(USDC_ADDRESS, ercAbi, signers[0]);
    const expandedUSDCBalanceBefore = await USDC.balanceOf(signers[0].address);

    const USDCBalanceBefore = Number(ethers.utils.formatUnits(expandedUSDCBalanceBefore, USDC_DECIMALS));
    await WETH.approve(uniswapSwapper.address, ethers.utils.parseEther(SWAP_WETH_AMOUNT));

    /* Execute the swap */
    console.log('swapping WETH for USDC...');
    const amountIn = ethers.utils.parseEther(SWAP_WETH_AMOUNT);
    const swapEstimatedGas = await uniswapSwapper.estimateGas.swap(amountIn, WETH_ADDRESS, USDC_ADDRESS);
    const swap = await uniswapSwapper.swap(amountIn, WETH_ADDRESS, USDC_ADDRESS, { gasLimit: swapEstimatedGas });
    await swap.wait();

    /* Check USDC end balance */
    const expandedUSDCBalanceAfter = await USDC.balanceOf(signers[0].address);
    const USDCBalanceAfter = Number(ethers.utils.formatUnits(expandedUSDCBalanceAfter, USDC_DECIMALS));

    console.log(`got ${USDCBalanceBefore} USDC before and ${USDCBalanceAfter} after the swap!`);
    expect(USDCBalanceAfter).is.greaterThan(USDCBalanceBefore);
  });
});
