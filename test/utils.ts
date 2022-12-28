import { Log, TransactionReceipt } from '@ethersproject/providers';
import { ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';

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
