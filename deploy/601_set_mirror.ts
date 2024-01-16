import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, Provider } from 'zksync-web3';
import NFT_ABI from '../artifacts/contracts/GenesisNFTV1.sol/GenesisNFTV1.json';
import { getEnvByNetwork } from '../scripts/utils';
import { getContractAddress } from '../utils/addresses';

const upgradeBridge: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const GEN1NFT_ADDRESS = await getContractAddress(11155111, 'GenesisNFTV1');
  const MIRROR_ADDRESS = await getContractAddress(network.config.chainId!, 'GenesisNFTV1mirror');

  const GEN2NFT_ADDRESS = await getContractAddress(11155111, 'GenesisNFTV2');
  const MIRROR2_ADDRESS = await getContractAddress(network.config.chainId!, 'GenesisNFTV2mirror');

  const l1Provider = new ethers.providers.JsonRpcProvider(
    'https://eth-sepolia.g.alchemy.com/v2/kaJnbyOsoAMnNzsiCjwfcZR69GwHiUAZ'
  );
  // Set up the Governor wallet to be the same as the one that deployed the governance contract.
  const wallet = new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', 'sepolia')!, l1Provider);
  // Set a constant that accesses the Layer 1 contract.
  const nftV1 = new Contract(GEN1NFT_ADDRESS, NFT_ABI.abi, wallet);
  const nftV2 = new Contract(GEN2NFT_ADDRESS, NFT_ABI.abi, wallet);

  const l2Provider = new Provider('https://sepolia.era.zksync.dev');
  const zkSyncAddress = await l2Provider.getMainContractAddress();

  const tx1 = await nftV1.setZkSyncBridge(zkSyncAddress, { gasPrice: 100000000000 });
  await tx1.wait(1);
  const tx2 = await nftV1.setZkSyncMirror(MIRROR_ADDRESS, { gasPrice: 100000000000 });
  await tx2.wait(1);

  const tx3 = await nftV2.setZkSyncBridge(zkSyncAddress, { gasPrice: 100000000000 });
  await tx3.wait(1);
  const tx4 = await nftV2.setZkSyncMirror(MIRROR2_ADDRESS, { gasPrice: 100000000000 });
  await tx4.wait(1);

  console.log('Done');
};

export default upgradeBridge;

upgradeBridge.tags = ['setMirror'];
