import { FeeData, TransactionRequest } from '@ethersproject/providers';
import { DeployProxyOptions, UpgradeProxyOptions } from '@openzeppelin/hardhat-upgrades/src/utils';
import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { BigNumber, Contract, Signer } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
import fs from 'fs';
import hre, { ethers, upgrades } from 'hardhat';
import { env } from 'process';
import readline from 'readline';
import {
  DEFAULT_GAS_MULTIPLIER,
  DEFAULT_MAX_FEE_PER_GAS_MULTIPLIER,
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS_MULTIPLIER
} from './constants';

export type DeploymentParam = {
  name: string;
  value: unknown;
};

export async function deploy<Type extends Contract>(
  contractName: string,
  signer: Signer,
  parameters: any[]
): Promise<Type> {
  const contract = await ethers.deployContract(contractName, parameters, signer);
  await contract.deployed();

  return <Type>contract;
}

export async function deployProxy<Type extends Contract>(
  contractName: string,
  signer: Signer,
  parameters: any[],
  opts?: DeployProxyOptions
): Promise<Type> {
  const contractFactory = await ethers.getContractFactory(contractName, signer);
  const contract = await upgrades.deployProxy(contractFactory, parameters, opts);
  await contract.deployed();

  return <Type>contract;
}

export async function deployProxyAndVerify(
  contractName: string,
  params: DeploymentParam[],
  opts?: DeployProxyOptions,
  gasMultiplier: number = DEFAULT_GAS_MULTIPLIER,
  maxFeePerGasMultiplier: number = DEFAULT_MAX_FEE_PER_GAS_MULTIPLIER,
  maxPriorityFeePerGasMultiplier: number = DEFAULT_MAX_PRIORITY_FEE_PER_GAS_MULTIPLIER
) {
  console.log(
    `Running ${contractName} deployment script on network ${hre.network.name} (chainId: ${hre.network.config.chainId})`
  );

  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.estimateGas = getEstimateGasFunction(gasMultiplier);
  provider.getFeeData = getFeeDataFunction(maxFeePerGasMultiplier, maxPriorityFeePerGasMultiplier);

  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name);
  if (deployerPrivateKey === undefined) {
    throw Error('Invalid private key');
  }

  const deployer = new ethers.Wallet(deployerPrivateKey, provider);

  console.log('\nDeployer');
  console.log(` address: ${deployer.address}`);
  console.log(` balance: ${formatEther(await provider.getBalance(deployer.address))} ETH`);

  if (params.length > 0) {
    console.log('\nParameters');
    params.forEach((entry) => {
      console.log(` ${entry.name}: ${entry.value}`);
    });
  }

  const paramsList = params.map((entry) => entry.value);

  if (await confirm('\nDo you want to continue? [y/N] ')) {
    console.log(`Deploying ${contractName} contract...`);

    const contract = await deployProxy(contractName, deployer, paramsList, opts);

    console.log(`${contractName} deployed to ${contract.address}`);

    if (await confirmYesOrNo('\nDo you want to verify contract? [y/n] ')) {
      const implementationAddress = await getImplementationAddress(ethers.provider, contract.address);
      console.log('Implementation address: ', implementationAddress);
      await verifyContract(implementationAddress);
    }
  }
}

export async function upgradeContract<Type extends Contract>(
  contractName: string,
  proxyAddress: string,
  signer: Signer,
  options?: UpgradeProxyOptions
) {
  const contractFactory = await ethers.getContractFactory(contractName, signer);
  const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory, options);
  await contract.deployed();

  return <Type>contract;
}

export async function verifyContract(address: string, constructorArguments: any[] = []) {
  await hre.run('verify:verify', {
    address,
    constructorArguments
  });
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

export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(question);
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

export async function confirmYes(question: string): Promise<boolean> {
  const answer = await ask(question);
  return ['y', 'yes', ''].includes(answer.trim().toLowerCase());
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDirIfNotExist(filename: string) {
  if (!fs.existsSync(filename)) {
    fs.mkdirSync(filename);
  }
}

export function moveFile(oldPath: string, newPath: string) {
  fs.renameSync(oldPath, newPath);
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
