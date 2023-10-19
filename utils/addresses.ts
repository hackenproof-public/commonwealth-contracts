import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getEnvironment } from './environment';

const CONSTANTS_DIRECTORY = './constants';
const CONTRACT_ADDRESSES_FILE = `${CONSTANTS_DIRECTORY}/addresses.json`;

interface IContractAddresses {
  [chainId: string]: Record<string, string> | Record<string, any>;
}

export async function updateAddress(chainId: number, contractName: string, contractAddress: string) {
  if (!existsSync(CONSTANTS_DIRECTORY)) {
    mkdirSync(CONSTANTS_DIRECTORY);
  }
  const environment = getEnvironment();

  let contractsAddresses: IContractAddresses = existsSync(CONTRACT_ADDRESSES_FILE)
    ? JSON.parse(readFileSync(CONTRACT_ADDRESSES_FILE, 'utf-8'))
    : {};

  console.log(`Updating ${contractName} address...`);

  contractsAddresses[chainId] = contractsAddresses[chainId] || {};

  if (!environment) {
    contractsAddresses[chainId][contractName] = contractAddress;
  } else {
    contractsAddresses[chainId][environment] = contractsAddresses[chainId][environment] || {};
    contractsAddresses[chainId][environment][contractName] = contractAddress;
  }

  writeFileSync(CONTRACT_ADDRESSES_FILE, JSON.stringify(contractsAddresses, null, 2));

  console.log('Addresses updated!');
}

export async function getContractAddress(chainId: number, contractName: string): Promise<string> {
  const environment = getEnvironment();

  let contractsAddresses: IContractAddresses = existsSync(CONTRACT_ADDRESSES_FILE)
    ? JSON.parse(readFileSync(CONTRACT_ADDRESSES_FILE, 'utf-8'))
    : {};

  const contractAddress = !environment
    ? contractsAddresses[chainId][contractName]
    : contractsAddresses[chainId][environment][contractName];

  if (!contractAddress || contractAddress === '') {
    throw Error(`Contract address for ${contractName} not found.`);
  }
  return contractAddress;
}
