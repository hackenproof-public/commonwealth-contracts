import { ethers, network } from 'hardhat';
import { Provider, Wallet } from 'zksync-web3';
import { l2Tol1 } from '../helper-hardhat-config';
import { getEnvByNetwork } from './deployment';

export function getZkSyncSingerWallet() {
  const deployerPrivateKey = getEnvByNetwork('WALLET_PRIVATE_KEY', network.name)!;

  const rpc = getEnvByNetwork('RPC_URL', network.name);
  const zkSyncProvider = new Provider(rpc);
  const ethereumProvider = ethers.getDefaultProvider(l2Tol1[network.config.chainId!].name);

  return new Wallet(deployerPrivateKey, zkSyncProvider, ethereumProvider);
}
