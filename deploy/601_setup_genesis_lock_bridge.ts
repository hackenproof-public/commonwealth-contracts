import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import GENESIS_NFT_LOCK from '../artifacts/contracts/GenesisNFTLock.sol/GenesisNFTLock.json';

import { Contract, Provider } from 'zksync-web3';
import { l1Tol2 } from '../helper-hardhat-config';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFTLock } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const upgradeBridge: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Setting up the bridge');

  const chainId = network.config.chainId!;
  const genesisNftLock = await getContractAddress(chainId, 'GenesisNFTLock');
  const genesisNFT1Mirror = await getContractAddress(l1Tol2[chainId].chainId, 'GenesisNFTV1Mirror');
  const genesisNFT2Mirror = await getContractAddress(l1Tol2[chainId].chainId, 'GenesisNFTV2Mirror');

  const l1Rpc = getEnvByNetwork('RPC_URL', network.name)!;

  const l1Provider = new ethers.providers.JsonRpcProvider(l1Rpc);

  const wallet = new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, l1Provider);
  const nftLock = new Contract(genesisNftLock, GENESIS_NFT_LOCK.abi, wallet) as GenesisNFTLock;

  const l2Rpc = getEnvByNetwork('RPC_URL', l1Tol2[network.config.chainId!].name)!;

  const l2Provider = new Provider(l2Rpc);
  const zkSyncAddress = await l2Provider.getMainContractAddress();

  const gasPrice = await ethers.getDefaultProvider().getGasPrice();

  const tx1 = await nftLock.setZkSyncBridge(zkSyncAddress, { gasPrice: gasPrice.mul(10) });
  await tx1.wait(1);
  console.log('ZkSync bridge address set to', zkSyncAddress);

  const tx2 = await nftLock.setZkSyncGenesisNFT1Mirror(genesisNFT1Mirror, { gasPrice: gasPrice.mul(10) });
  await tx2.wait(1);
  console.log('GenesisNFTV1Mirror address set to', genesisNFT1Mirror);

  const tx3 = await nftLock.setZkSyncGenesisNFT2Mirror(genesisNFT2Mirror, { gasPrice: gasPrice.mul(10) });
  await tx3.wait(1);
  console.log('GenesisNFTV2Mirror address set to', genesisNFT2Mirror);

  console.log('Done');
};

export default upgradeBridge;

upgradeBridge.tags = ['setupGenesisNftBridge', 'all'];
