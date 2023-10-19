import { network } from 'hardhat';
import { networkConfig } from '../helper-hardhat-config';
import { getEnvironment } from './environment';

export function getDeploymentConfig() {
  const chainId = network.config.chainId!;
  const environment = getEnvironment();
  return environment ? networkConfig[chainId][environment]! : networkConfig[chainId];
}
