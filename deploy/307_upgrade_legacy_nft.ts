import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { upgrade } from '../utils/deployment';

const deployStakingGenNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNftLegacy = await getContractAddress(network.config.chainId!, 'GenesisNFTV1Legacy');

  await upgrade(hre, 'GenNFTV3', genesisNftLegacy);
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['tge', 'genTest', 'all'];
