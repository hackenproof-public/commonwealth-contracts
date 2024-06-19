import { NonceManager } from '@ethersproject/experimental';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { InvestmentFund } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const profitProvider: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentConfig = getDeploymentConfig();

  const usdcAddress = await getContractAddress(network.config.chainId!, 'USDC');

  const investmentFundAddress = undefined;
  const minimumProfit = undefined;

  if (!investmentFundAddress || minimumProfit === undefined) {
    throw new Error('Please provide investment fund address and minimum profit.');
  }

  const parameters = [
    { name: 'owner', value: deploymentConfig.ownerAccount },
    { name: 'investmentFund', value: investmentFundAddress },
    { name: 'currency', value: usdcAddress },
    { name: 'minimumProfit', value: minimumProfit }
  ];

  const profitProvider = await deploy(hre, 'ProfitProvider', parameters, true, true, 'PricelessProfitProvider');

  console.log('Setting profit provider in fund...');
  await setProfitProviderInFund(hre, investmentFundAddress, profitProvider!.address);
  console.log('Profit provider set in fund.');

  console.log('Done');
};

export default profitProvider;
profitProvider.tags = ['profitProvider', 'all'];

async function setProfitProviderInFund(
  hre: HardhatRuntimeEnvironment,
  investmentFundAddress: string,
  profitProviderAddress: string
) {
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const investmentFund = (await ethers.getContractAt(
    'InvestmentFund',
    investmentFundAddress,
    wallet
  )) as InvestmentFund;

  const tx = await investmentFund.setProfitProvider(profitProviderAddress);
  await tx.wait();
}
