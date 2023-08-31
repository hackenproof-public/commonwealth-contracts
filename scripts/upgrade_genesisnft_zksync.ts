import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { ethers } from 'hardhat';
import { Provider } from 'zksync-web3';
import { GenesisNFT } from '../typechain-types';
import { confirm, upgradeContract, verifyContract } from './utils';

async function main() {
  const l2Provider = new Provider('https://testnet.era.zksync.dev');
  const zkSyncAddress = await l2Provider.getMainContractAddress();
  const ZKSYNC_MIRROR_ADDRESS = '0xdeadbeef';

  const [deployer] = await ethers.getSigners();
  const contractToUpgrade = '0xdeadbeef';

  console.log(`Upgrading GenesisNFT on ${contractToUpgrade} using ${deployer.address}`);
  const genesisNFT: GenesisNFT = await upgradeContract('GenesisNFT', contractToUpgrade, deployer);
  console.log(`GenesisNFT upgraded on ${genesisNFT.address}`);

  await genesisNFT.setZkSyncBridge(zkSyncAddress);
  await genesisNFT.setZkSyncMirror(ZKSYNC_MIRROR_ADDRESS);

  if (await confirm('\nDo you want to verify contract? [y/N] ')) {
    const implementationAddress = await getImplementationAddress(ethers.provider, genesisNFT.address);
    console.log('Implementation address: ', implementationAddress);
    await verifyContract(implementationAddress);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
