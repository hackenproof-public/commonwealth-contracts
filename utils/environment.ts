import { network } from 'hardhat';
import { environments, environmentType } from '../helper-hardhat-config';

export function getEnvironment(): undefined | environmentType {
  const environment = process.env.ENVIRONMENT;

  if (network.config.chainId === 31337) {
    return undefined;
  }
  if (environment && !checkIfEnvironmentExists(environment)) {
    throw new Error(`Unknown environment ${environment}.`);
  }

  return process.env.ENVIRONMENT as environmentType | undefined;
}

function checkIfEnvironmentExists(value: string) {
  return environments.map((e) => e.toString()).includes(value);
}
