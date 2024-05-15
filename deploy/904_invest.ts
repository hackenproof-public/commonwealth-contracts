import { NonceManager } from '@ethersproject/experimental';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toUsdc } from '../test/utils';
import { InvestmentFund, USDC } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const deployStakingGenNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const investmentFundAddress = '0x7aaF57abC7fA385572D9d569BF0a39d997BDc1a6';
  const usdcAddress = await getContractAddress(network.config.chainId!, 'USDC');
  const amount = toUsdc('100');
  const investmentAmount = 1000;

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );
  const investmentFund: InvestmentFund = (await ethers.getContractAt(
    'InvestmentFund',
    investmentFundAddress,
    wallet
  )) as InvestmentFund;
  const usdc: USDC = (await ethers.getContractAt('USDC', usdcAddress, wallet)) as USDC;

  const tx = await usdc.approve(investmentFundAddress, amount.mul(investmentAmount));
  await tx.wait();
  await usdc.mint(await wallet.getAddress(), amount.mul(investmentAmount));

  for (let i = 0; i < investmentAmount; i++) {
    console.log(i);
    await investmentFund.invest(amount, 'ipfs://QmPYRnKnwT989AWUC2EWGNYbLxvwYvp6sghmAqUcMJy52N');
  }
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['invest'];
