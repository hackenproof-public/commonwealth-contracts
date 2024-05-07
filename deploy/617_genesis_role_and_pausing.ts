import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT, GenNFTV2 } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const roleAndPausing: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNftSeries1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const genesisNftSeries2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');
  const genesisLegacyAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1Legacy');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNftSeries1 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries1Address, wallet)) as GenesisNFT;
  const genesisNftSeries2 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries2Address, wallet)) as GenesisNFT;

  const genesisLegacy = (await ethers.getContractAt('GenNFTV2', genesisLegacyAddress, wallet)) as GenNFTV2;

  const walletAddress = await wallet.getAddress();
  console.log('Granting roles');

  await genesisLegacy.grantRole(await genesisLegacy.BURNER_ROLE(), walletAddress);
  console.log('Legacy NFT - burner role granted');

  await genesisLegacy.grantRole(await genesisLegacy.PAUSER_ROLE(), walletAddress);
  console.log('Legacy NFT - pauser role granted');

  await genesisNftSeries1.grantRole(await genesisNftSeries1.PAUSER_ROLE(), walletAddress);
  console.log('Genesis NFT S1 - pauser role granted');

  await genesisNftSeries2.grantRole(await genesisNftSeries2.PAUSER_ROLE(), walletAddress);
  console.log('Genesis NFT S2 - pauser role granted');

  console.log('Pausing Genesis NFT S1');
  await genesisNftSeries1.pause();
  console.log('Genesis NFT S1 paused');

  console.log('Pausing Genesis NFT S2');
  await genesisNftSeries2.pause();
  console.log('Genesis NFT S2 paused');

  console.log('Pausing Genesis NFT Legacy');
  await genesisLegacy.pause();
  console.log('Genesis NFT Legacy paused');

  console.log('Done');
};

export default roleAndPausing;
roleAndPausing.tags = ['roleAndPausing'];
