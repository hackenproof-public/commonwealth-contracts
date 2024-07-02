import { network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { deploy } from '../utils/deployment';

const deployMarketplace: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');

  const parameters = [
    { name: '_owner', value: deploymentCofing.ownerAccount },
    { name: '_paymentToken', value: wlth },
    { name: '_feeAddress', value: deploymentCofing.communityFundWallet },
    { name: '_royaltyAddress', value: deploymentCofing.genesisNftRoyaltyAccount },
  ];

  await deploy(hre, 'Marketplace', parameters);
};

export default deployMarketplace;
deployMarketplace.tags = ['tge', 'marketplace', 'all'];
