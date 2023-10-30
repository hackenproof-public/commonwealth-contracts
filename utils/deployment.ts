import { FeeData, Provider, TransactionRequest } from '@ethersproject/providers';
import { DeployProxyOptions, UpgradeProxyOptions } from '@openzeppelin/hardhat-upgrades/src/utils';
import { getImplementationAddress } from '@openzeppelin/upgrades-core';

import { BigNumber, Contract, Signer } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
import { ethers, network, upgrades } from 'hardhat';
import { env } from 'process';
import readline from 'readline';
import {
  DEFAULT_GAS_MULTIPLIER,
  DEFAULT_MAX_FEE_PER_GAS_MULTIPLIER,
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS_MULTIPLIER
} from './constants';

import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet } from 'zksync-web3';
import { zkNetworksIds } from '../helper-hardhat-config';
import { updateAddress } from './addresses';
import verify from './verify';

export type DeploymentParam = {
  name: string;
  value: unknown;
};

export type ProviderParams = {
  gasMultiplier: number;
  maxFeePerGasMultiplier: number;
  maxPriorityFeePerGasMultiplier: number;
};

export async function deploy<Type extends Contract>(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  deploymentParams: DeploymentParam[],
  proxy: boolean = false,
  updateAddressesFile = true,
  adressesFileContractName?: string,
  providerParams?: ProviderParams,
  opts?: DeployProxyOptions
): Promise<Type | undefined> {
  console.log(
    `Running ${contractName} deployment script on network ${network.name} (chainId: ${network.config.chainId})`
  );

  const chainId = network.config.chainId!;

  if (zkNetworksIds.includes(chainId)) {
    return deployZkSync(
      hre,
      chainId,
      contractName,
      deploymentParams,
      proxy,
      updateAddressesFile,
      adressesFileContractName,
      opts
    );
  } else {
    return deployEvm(
      chainId,
      contractName,
      deploymentParams,
      proxy,
      updateAddressesFile,
      adressesFileContractName,
      providerParams,
      opts
    );
  }
}

export async function deployEvm<Type extends Contract>(
  chainId: number,
  contractName: string,
  deploymentParams: DeploymentParam[],
  proxy: boolean = false,
  updateAddressesFile = true,
  adressesFileContractName?: string,
  providerParams?: ProviderParams,
  opts?: DeployProxyOptions
): Promise<Type | undefined> {
  const provider = getProvider(providerParams);
  const deployer = await getEvmDeployer(provider);

  const contractParams = extractDeploymentParams(deploymentParams);

  if (chainId === 31337 || (await confirmYesOrNo('Do you want to deploy contract? [y/N] '))) {
    console.log(`Deploying ${contractName} contract...`);

    let contract;
    if (proxy) {
      contract = await deployProxy(contractName, contractParams, deployer, opts);
    } else {
      contract = await deployContract(contractName, contractParams, deployer);
    }

    console.log(`${contractName} deployed to ${contract.address}`);

    if (updateAddressesFile) {
      await updateAddress(chainId, adressesFileContractName || contractName, contract.address);
    }

    await verifyContract(chainId, contract, contractParams, proxy);

    return <Type>contract;
  }
}

export async function deployZkSync<Type extends Contract>(
  hre: HardhatRuntimeEnvironment,
  chainId: number,
  contractName: string,
  deploymentParams: DeploymentParam[],
  proxy: boolean = false,
  updateAddressesFile = true,
  adressesFileContractName?: string,
  opts?: DeployProxyOptions
): Promise<Type | undefined> {
  const deployer = await getZkDeployer(hre);

  const contractParams = extractDeploymentParams(deploymentParams);

  if (chainId === 31337 || (await confirmYesOrNo('Do you want to deploy contract? [y/N] '))) {
    console.log(`Deploying ${contractName} contract...`);

    let contract;
    if (proxy) {
      contract = await deployZkProxy(hre, contractName, contractParams, deployer, opts);
    } else {
      contract = await deployZkContract(contractName, contractParams, deployer);
    }

    console.log(`${contractName} deployed to ${contract.address}`);

    if (updateAddressesFile) {
      await updateAddress(chainId, adressesFileContractName || contractName, contract.address);
    }

    await verifyContract(chainId, contract, contractParams, proxy);

    return <Type>contract;
  }
}

async function deployContract<Type extends Contract>(
  contractName: string,
  parameters: any[],
  signer: Signer
): Promise<Type> {
  const contract = await ethers.deployContract(contractName, parameters, signer);
  await contract.deployed();
  return <Type>contract;
}

async function deployZkContract<Type extends Contract>(
  contractName: string,
  parameters: any[],
  deployer: Deployer
): Promise<Type> {
  console.log('Deploy nie prosxy');
  const artifact = await deployer.loadArtifact(contractName);
  const contract = await deployer.deploy(artifact, parameters);
  return <Type>contract;
}

async function deployProxy<Type extends Contract>(
  contractName: string,
  parameters: any[],
  signer: Signer,
  opts?: DeployProxyOptions
): Promise<Type> {
  const contractFactory = await ethers.getContractFactory(contractName, signer);
  const contract = await upgrades.deployProxy(contractFactory, parameters, opts);

  await contract.deployed();

  return <Type>contract;
}

async function deployZkProxy<Type extends Contract>(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  parameters: any[],
  deployer: Deployer,
  opts?: DeployProxyOptions
): Promise<Type> {
  const artifact = await deployer.loadArtifact(contractName);
  const contract = await hre.zkUpgrades.deployProxy(deployer.zkWallet, artifact, parameters, {
    initializer: 'initialize'
  });
  return <Type>contract;
}

export async function upgradeContract<Type extends Contract>(
  contractName: string,
  proxyAddress: string,
  providerParams?: ProviderParams,
  options?: UpgradeProxyOptions
) {
  console.log(`Running ${contractName} upgrade script on network ${network.name} (chainId: ${network.config.chainId})`);
  const chainId = network.config.chainId!;

  const provider = getProvider(providerParams);
  const deployer = await getEvmDeployer(provider);

  if (chainId === 31337 || (await confirmYesOrNo('Do you want to upgrade contract? [y/N] '))) {
    console.log(`Upgrading ${contractName} contract...`);

    const contract = await upgradeProxy(contractName, proxyAddress, deployer, options);

    console.log(`${contractName} upgraded at ${contract.address}`);

    await verifyContract(chainId, contract, [], true);
  }
}

async function upgradeProxy<Type extends Contract>(
  contractName: string,
  proxyAddress: string,
  signer: Signer,
  options?: UpgradeProxyOptions
): Promise<Type> {
  const contractFactory = await ethers.getContractFactory(contractName, signer);

  await upgrades.validateUpgrade(proxyAddress, contractFactory);

  const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory);
  await contract.deployed();

  return <Type>contract;
}

function getProvider(
  params: ProviderParams = {
    gasMultiplier: DEFAULT_GAS_MULTIPLIER,
    maxFeePerGasMultiplier: DEFAULT_MAX_FEE_PER_GAS_MULTIPLIER,
    maxPriorityFeePerGasMultiplier: DEFAULT_MAX_PRIORITY_FEE_PER_GAS_MULTIPLIER
  }
) {
  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.estimateGas = getEstimateGasFunction(params.gasMultiplier);
  provider.getFeeData = getFeeDataFunction(params.maxFeePerGasMultiplier, params.maxPriorityFeePerGasMultiplier);
  return provider;
}

async function getEvmDeployer(provider: Provider): Promise<Signer> {
  let deployer: Signer;
  if (network.config.chainId === 31337) {
    deployer = ethers.provider.getSigner();
  } else {
    const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', network.name);
    console.log(deployerPrivateKey, 'test');
    if (deployerPrivateKey === undefined || deployerPrivateKey === '') {
      throw Error('Invalid private key');
    }
    deployer = new ethers.Wallet(deployerPrivateKey, provider);
  }

  console.log('\nDeployer');
  console.log(` address: ${await deployer.getAddress()}`);
  console.log(` balance: ${formatEther(await provider.getBalance(await deployer.getAddress()))} ETH`);

  return deployer;
}

async function getZkDeployer(hre: HardhatRuntimeEnvironment): Promise<Deployer> {
  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', network.name);
  console.log(network.name);
  if (deployerPrivateKey === undefined || deployerPrivateKey === '') {
    throw Error('Invalid private key');
  }

  const wallet = new Wallet(deployerPrivateKey);
  const deployer = new Deployer(hre, wallet);

  console.log('\nDeployer');
  console.log(` address: ${await deployer.zkWallet.getAddress()}`);
  console.log(` balance: ${formatEther(await deployer.zkWallet.getBalance())} ETH`);

  return deployer;
}

export function getEnvByNetwork(contractVariable: string, networkName: string): string | undefined {
  const name = networkName.toUpperCase() + '_' + contractVariable;
  return env[name];
}

export function getEstimateGasFunction(gasMultiplier: number) {
  return async (_tx: TransactionRequest): Promise<BigNumber> => {
    const blockGasLimit = 30_000_000;

    const estimatedGas = await ethers.provider.estimateGas(_tx);
    const estimatedGasMultiplied = Math.min(Math.floor(estimatedGas.toNumber() * gasMultiplier), blockGasLimit);

    return BigNumber.from(estimatedGasMultiplied);
  };
}

export function getFeeDataFunction(maxFeePerGasMultiplier: number, maxPriorityFeePerGasMultiplier: number) {
  return async (): Promise<FeeData> => {
    const feeData = await ethers.provider.getFeeData();

    const maxFeePerGas =
      feeData.maxFeePerGas == null
        ? feeData.maxFeePerGas
        : BigNumber.from(Math.floor(feeData.maxFeePerGas.toNumber() * maxFeePerGasMultiplier));

    const maxPriorityFeePerGas =
      feeData.maxPriorityFeePerGas == null
        ? feeData.maxPriorityFeePerGas
        : BigNumber.from(Math.floor(feeData.maxPriorityFeePerGas.toNumber() * maxPriorityFeePerGasMultiplier));

    return {
      gasPrice: feeData.gasPrice,
      lastBaseFeePerGas: feeData.lastBaseFeePerGas,
      maxFeePerGas,
      maxPriorityFeePerGas
    };
  };
}

export function extractDeploymentParams(params: DeploymentParam[]): any[] {
  if (params.length > 0) {
    console.log('\nParameters');
    params.forEach((entry) => {
      console.log(` ${entry.name}: ${entry.value}`);
    });
  }
  return params.map((param) => param.value);
}

export async function confirmYesOrNo(
  question: string,
  yes: string[] = ['y', 'yes'],
  no: string[] = ['n', 'no']
): Promise<boolean> {
  while (true) {
    const answer = await ask(question);
    if (yes.includes(answer.trim().toLowerCase())) {
      return true;
    } else if (no.includes(answer.trim().toLowerCase())) {
      return false;
    }
    console.log(`Wrong answer. Possible options: ${[yes.join(', '), no.join(', ')].join(', ')}`);
  }
}

export function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) =>
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    })
  );
}

async function verifyContract(chainId: number, contract: Contract, contractParams: any[], proxy: boolean) {
  if (chainId !== 31337 && (await confirmYesOrNo('\nDo you want to verify contract? [y/n] '))) {
    if (proxy) {
      const implementationAddress = await getImplementationAddress(ethers.provider, contract.address);
      console.log('Implementation address: ', implementationAddress);
      await verify(implementationAddress);
    } else {
      await verify(contract.address, contractParams);
    }
  }
}
