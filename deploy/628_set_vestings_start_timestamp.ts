import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFTVesting, StakingGenesisNFTVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const setVestingsStartTimestamp: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const stakingGenesisNftVestingAddress = await getContractAddress(
    hre.network.config.chainId!,
    'StakingGenesisNFTVesting'
  );
  const genesisNftVestingAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTVesting');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  //TODO define rest of vestings

  const startTimestamp = undefined;

  if (!startTimestamp) {
    throw new Error('Please define vesting start timestamp');
  }

  const stakingGenesisNftVesting = (await ethers.getContractAt(
    'StakingGenesisNFTVesting',
    stakingGenesisNftVestingAddress,
    wallet
  )) as StakingGenesisNFTVesting;
  const genesisNftVesting = (await ethers.getContractAt(
    'GenesisNFTVesting',
    genesisNftVestingAddress,
    wallet
  )) as GenesisNFTVesting;

  console.log('Setting up vestings start timestamp');

  console.log('Setting up StakingGenesisNFTVesting rewards distribution timestamp');
  const stakingGenesisNftVestingTx = await stakingGenesisNftVesting.setDistributionStartTimestamp(startTimestamp);
  await stakingGenesisNftVestingTx.wait();
  console.log('StakingGenesisNFTVesting rewards distribution timestamp is set', stakingGenesisNftVestingTx.hash);

  console.log('Setting up GenesisNFTVesting vesting start timestamp');
  const genesisNftVestingTx = await genesisNftVesting.setVestingStartTimestamp(startTimestamp);
  await genesisNftVestingTx.wait();
  console.log('GenesisNFTVesting vesting start timestamp is set', genesisNftVestingTx.hash);

  console.log('Done');
};

export default setVestingsStartTimestamp;
setVestingsStartTimestamp.tags = ['setVestingsStartTimestamp'];
