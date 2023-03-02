import { Log, TransactionReceipt } from '@ethersproject/providers';
import { BigNumber, ContractTransaction, utils } from 'ethers';
import { ethers } from 'hardhat';

const BASIS_POINT_DIVISOR: number = 10000;

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

export function getInterfaceId(contractInterface: utils.Interface): BigNumber {
  let interfaceId = ethers.constants.Zero;
  Object.keys(contractInterface.functions).forEach(
    (functionName) => (interfaceId = interfaceId.xor(contractInterface.getSighash(functionName)))
  );
  return interfaceId;
}

export function getInterfaceIdWithBase(contractInterfaces: utils.Interface[]): BigNumber {
  let interfaceId = ethers.constants.Zero;

  contractInterfaces.forEach((contractInterface: utils.Interface) => {
    interfaceId = interfaceId.xor(getInterfaceId(contractInterface));
  });

  return interfaceId;
}
