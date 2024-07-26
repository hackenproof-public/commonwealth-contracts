import { Log, TransactionReceipt } from '@ethersproject/providers';
import { expect } from 'chai';
import { BigNumber, ContractTransaction, utils } from 'ethers';
import { ethers } from 'hardhat';
import { BP_MAX, DEFAULT_TRANSACTION_FEE, EVENT_TOPIC_NFT_MINTED, EVENT_TOPIC_TOKENS_STAKED } from './constants';

export const getLogs = async (
  tx: ContractTransaction,
  contractAddress: string | undefined,
  topic: string | undefined
): Promise<Log[]> => {
  const receipt: TransactionReceipt = await ethers.provider.getTransactionReceipt(tx.hash);

  let logs: Log[] = receipt.logs;
  if (contractAddress !== undefined) {
    logs = logs.filter((log) => log.address === contractAddress);
  }
  if (topic !== undefined) {
    logs = logs.filter((log) => log.topics[0] === topic);
  }
  return logs;
};

export const toUsdc = (value: string) => {
  return utils.parseUnits(value, 6);
};

export const toWlth = (value: string) => {
  return utils.parseUnits(value, 18);
};

export const getInterfaceId = (contractInterface: utils.Interface): BigNumber => {
  let interfaceId = ethers.constants.Zero;
  Object.keys(contractInterface.functions).forEach(
    (functionName) => (interfaceId = interfaceId.xor(contractInterface.getSighash(functionName)))
  );
  return interfaceId;
};

export const getInterfaceIdWithBase = (contractInterfaces: utils.Interface[]): BigNumber => {
  let interfaceId = ethers.constants.Zero;

  contractInterfaces.forEach((contractInterface: utils.Interface) => {
    interfaceId = interfaceId.xor(getInterfaceId(contractInterface));
  });

  return interfaceId;
};

export const missing_role = (account: string, role: string): string => {
  return 'AccessControl: account ' + account.toLowerCase() + ' is missing role ' + role.toLowerCase();
};

export const keccak256 = (arg: string) => {
  return utils.keccak256(utils.toUtf8Bytes(arg));
};

export const getTokenIdFromTx = async (tx: ContractTransaction, contractAddress: string): Promise<BigNumber> => {
  const logs = await getLogs(tx, contractAddress, EVENT_TOPIC_NFT_MINTED);
  expect(logs).to.have.length(1);

  const investmentNft = await ethers.getContractAt('InvestmentNFT', contractAddress);
  return investmentNft.interface.parseLog(logs[0]).args.tokenId as BigNumber;
};

export const getStakeIdFromTx = async (tx: ContractTransaction, contractAddress: string): Promise<number> => {
  const logs = await getLogs(tx, contractAddress, EVENT_TOPIC_TOKENS_STAKED);
  expect(logs).to.have.length(1);

  const staking = await ethers.getContractAt('StakingWlth', contractAddress);
  return (staking.interface.parseLog(logs[0]).args.stakeId as BigNumber).toNumber();
};

export const getStakeWithFee = (amount: number, fee: number = DEFAULT_TRANSACTION_FEE): number => {
  return Math.floor((amount * BP_MAX) / (BP_MAX - fee));
};

export const generateRandomBytes32Array = (amount: number): utils.BytesLike[] => {
  const randomBytes32Array: utils.BytesLike[] = [];
  for (let i = 0; i < amount; i++) {
    const randomBytes = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    randomBytes32Array.push(randomBytes);
  }
  return randomBytes32Array;
};
