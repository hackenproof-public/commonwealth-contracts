import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { InvestmentFund, StakingWlth } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const registerStaking: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const stakingWlthAddress = await getContractAddress(hre.network.config.chainId!, 'StakingWlth');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  // Priceless fund address
  const pricelessFundAddress = undefined; //'';

  // Alpha fund address
  const alphaFundAddress = undefined; //'';

  if (!pricelessFundAddress || !alphaFundAddress) {
    throw new Error('Priceless fund address and alpha fund address are required');
  }

  const pricelesFund = (await ethers.getContractAt('InvestmentFund', pricelessFundAddress, wallet)) as InvestmentFund;
  const alphaFund = (await ethers.getContractAt('InvestmentFund', alphaFundAddress, wallet)) as InvestmentFund;
  const staking = (await ethers.getContractAt('StakingGenesisNFTVesting', stakingWlthAddress, wallet)) as StakingWlth;

  console.log('Setting up staking');

  console.log('Registering staking contract in funds');

  console.log('Setting staking contract in Priceless fund');
  const setStakingInPricelessTx = await pricelesFund.setStakingWlth(stakingWlthAddress);
  await setStakingInPricelessTx.wait();
  console.log('Staking contract set in Priceless fund', setStakingInPricelessTx.hash);

  console.log('Setting staking contract in Alpha fund');
  const setStakingInAlphaTx = await alphaFund.setStakingWlth(stakingWlthAddress);
  await setStakingInAlphaTx.wait();
  console.log('Staking contract set in Alpha fund', setStakingInAlphaTx.hash);

  console.log('Registering funds in staking contract');

  console.log('Registering Priceless fund in staking contract');
  const registerPricelessFundTx = await staking.registerFund(pricelessFundAddress);
  await registerPricelessFundTx.wait();
  console.log('Priceless fund registered in staking contract', registerPricelessFundTx.hash);

  console.log('Registering Alpha fund in staking contract');
  const registerAlphaFundTx = await staking.registerFund(alphaFundAddress);
  await registerAlphaFundTx.wait();
  console.log('Alpha fund registered in staking contract', registerAlphaFundTx.hash);

  console.log('Done');
};

export default registerStaking;
registerStaking.tags = ['registerStaking'];
