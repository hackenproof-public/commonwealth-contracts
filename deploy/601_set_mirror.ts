import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, Provider } from 'zksync-web3';
import NFT_ABI from '../artifacts/contracts/GenesisNFTV1.sol/GenesisNFTV1.json';

const upgradeBridge: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const GEN1NFT_ADDRESS = '0xfFD89A3F528D8808456E1617A29561a30Dd8FC36';
  const MIRROR_ADDRESS = '0xD240675DafAcc5401D1Db0d1292a5Bf9Db39936A';

  const l1Provider = new ethers.providers.JsonRpcProvider(
    'https://goerli.infura.io/v3/2f4ac8af68784bbc8d72e264047d723b'
  );
  // Set up the Governor wallet to be the same as the one that deployed the governance contract.
  const wallet = new ethers.Wallet('', l1Provider);
  // Set a constant that accesses the Layer 1 contract.
  const nftV1 = new Contract(GEN1NFT_ADDRESS, NFT_ABI.abi, wallet);

  const l2Provider = new Provider('https://testnet.era.zksync.dev');
  const zkSyncAddress = await l2Provider.getMainContractAddress();

  const tx1 = await nftV1.setZkSyncBridge(zkSyncAddress, { gasPrice: 10000000000 });
  await tx1.wait(1);
  const tx2 = await nftV1.setZkSyncMirror(MIRROR_ADDRESS, { gasPrice: 10000000000 });
  await tx2.wait(1);

  console.log('Done');
};

export default upgradeBridge;

upgradeBridge.tags = ['setMirror'];
