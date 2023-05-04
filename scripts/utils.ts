import { UpgradeProxyOptions } from '@openzeppelin/hardhat-upgrades/src/utils';
import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { Contract, ContractFactory, Signer } from 'ethers';
import fs from 'fs';
import hre, { ethers, upgrades } from 'hardhat';
import { env } from 'process';
import readline from 'readline';

export type DeploymentParam = {
  name: string;
  value: unknown;
};

export async function deploy<Type extends Contract>(
  contractName: string,
  signer: Signer,
  parameters: Array<any>
): Promise<Type> {
  const contractFactory: ContractFactory = await ethers.getContractFactory(contractName, signer);
  const contract: Contract = await contractFactory.deploy(...parameters);
  await contract.deployed();

  return <Type>contract;
}

export async function deployProxy<Type extends Contract>(
  contractName: string,
  signer: Signer,
  parameters: Array<any>
): Promise<Type> {
  const contractFactory: ContractFactory = await ethers.getContractFactory(contractName, signer);
  const contract: Contract = await upgrades.deployProxy(contractFactory, parameters);
  await contract.deployed();

  return <Type>contract;
}

export async function deployProxyAndVerify(contractName: string, params: DeploymentParam[]) {
  const [deployer] = await ethers.getSigners();

  console.log(
    `Running ${contractName} deployment script on network ${hre.network.name} (chainId: ${hre.network.config.chainId})`
  );
  if (params.length > 0) {
    console.log('\nParameters');
    params.forEach((entry) => {
      console.log(` ${entry.name}: ${entry.value}`);
    });
  }

  const paramsList = params.map((entry) => entry.value);
  if (await confirm('\nDo you want to continue? [y/N] ')) {
    console.log(`Deploying ${contractName} contract...`);

    const contract = await deployProxy(contractName, deployer, paramsList);

    console.log(`${contractName} deployed to ${contract.address}`);

    if (await confirmYesOrNo('\nDo you want to verify contract? [y/N] ')) {
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
  const contractFactory: ContractFactory = await ethers.getContractFactory(contractName, signer);
  const contract: Contract = await upgrades.upgradeProxy(proxyAddress, contractFactory, options);
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
