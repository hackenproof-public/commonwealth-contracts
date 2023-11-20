import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getContractAddress } from '../utils/addresses';
import { getDeploymentConfig } from '../utils/config';
import { upgrade } from '../utils/deployment';

const deployWlth: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network } = hre;
  const deploymentCofing = getDeploymentConfig();

  const wlth = await getContractAddress(network.config.chainId!, 'Wlth');
  const usdc = await getContractAddress(network.config.chainId!, 'USDC');
  const quoter = await getContractAddress(network.config.chainId!, 'UniswapQuoter');
  const staking = await getContractAddress(network.config.chainId!, 'StakingWlth');

  const parameters = [
    { name: 'owner', value: deploymentCofing.ownerAccount },
    { name: 'token', value: wlth },
    { name: 'usdc', value: usdc },
    { name: 'dexQuoter', value: quoter },
    { name: 'fee', value: deploymentCofing.stakingTransactionFee },
    { name: 'treasuryWallet', value: deploymentCofing.stakingTreasuryWallet },
    { name: 'communityFund', value: deploymentCofing.communityFundWallet },
    { name: 'maxDiscount', value: deploymentCofing.maxDiscount },
    { name: 'periods', value: deploymentCofing.periods },
    { name: 'coefficients', value: deploymentCofing.coefficients }
  ];

  await upgrade(hre, 'StakingWlth', staking);
};

export default deployWlth;
deployWlth.tags = ['upgrade', 'upgradeStakingWlth'];
