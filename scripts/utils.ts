import { UpgradeProxyOptions } from '@openzeppelin/hardhat-upgrades/src/utils';
import { Contract, ContractFactory, Signer } from 'ethers';
import fs from 'fs';
import hre, { ethers, upgrades } from 'hardhat';
import readline from 'readline';

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
