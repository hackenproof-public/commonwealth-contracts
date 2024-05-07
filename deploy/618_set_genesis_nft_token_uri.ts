import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const setupUri: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNftSeries1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const genesisNftSeries2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNftSeries1 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries1Address, wallet)) as GenesisNFT;
  const genesisNftSeries2 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries2Address, wallet)) as GenesisNFT;

  const s1Uri = undefined;
  const s2Uri = undefined;

  if (s1Uri === undefined || s2Uri === undefined) {
    throw new Error('Please set the token URIs for the Genesis NFTs');
  }
  const walletAddress = await wallet.getAddress();
  console.log('Setting token URIs');

  await genesisNftSeries1.setTokenURI(s1Uri);
  console.log('Genesis NFT S1 - uri set');

  await genesisNftSeries2.setTokenURI(s2Uri);
  console.log('Genesis NFT S2 - uri set');

  console.log('Done');
};

export default setupUri;
setupUri.tags = ['setupUri'];
