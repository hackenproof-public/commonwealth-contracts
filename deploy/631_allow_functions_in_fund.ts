import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { InvestmentFund } from '../typechain-types';

const allowFunctionsInFund: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const investmentFundAddress = undefined;

  if (!investmentFundAddress) {
    throw new Error('Please provide investment fund address.');
  }

  const investmentFund = (await ethers.getContractAt(
    'InvestmentFund',
    investmentFundAddress,
    wallet
  )) as InvestmentFund;

  console.log('Upgrading rules...');
  const allowFunctionTx = await investmentFund.allowFunctionsInStates();
  await allowFunctionTx.wait();
  console.log('Rules are upgraded.', allowFunctionTx.hash);

  console.log('Done');
};

export default allowFunctionsInFund;
allowFunctionsInFund.tags = ['allowFunctionsInFund'];
