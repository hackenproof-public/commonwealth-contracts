import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT, GenNFTV2 } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { toWlth } from '../test/utils';

const setupGenesisNFTSetters: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNftSeries1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  const genesisNftSeries2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');
  const genesisNftVestingAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTVesting');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNftSeries1 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries1Address, wallet)) as GenesisNFT;
  const genesisNftSeries2 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries2Address, wallet)) as GenesisNFT;

  const walletAddress = await wallet.getAddress();

  const series1Metadata = {
    name: "Common Wealth Genesis NFT Series 1",
    description: "Common Wealth OG. Welcome to All Street",
    externalUrl: 'https://joincommonwealth.xyz/genesis-nft.html',
    id: "1",
    percentage: "12%"
  };

  const series2Metadata = {
    name: "Common Wealth Genesis NFT Series 2",
    description: "Common Wealth OG. Welcome to All Street",
    externalUrl: 'https://joincommonwealth.xyz/genesis-nft.html',
    id: "2",
    percentage: "3%"
  };

  const series1Allocation = toWlth("44000");
  const series2Allocation = toWlth("6400");

  const series1Bool = true;
  const series2Bool = false;

  const series1Images = ["https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-1.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-2.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-3.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-4.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-5.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-6.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-7.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-8.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-9.png",
                         "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s1/S1-10.png"
  ];
  const series2Images = ["https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-1.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-2.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-3.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-4.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-5.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-6.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-7.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-8.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-9.png",
                        "https://ipfs.io/ipfs/QmNSHxiPshwm2GSax4sM6hFJCrVmB9wctJdPaWFXttQhvV/s2/S2-10.png"
];


  await genesisNftSeries1.setVestingAddress(genesisNftVestingAddress);
  console.log('Genesis NFT S1 - vesting address is set');

  await genesisNftSeries2.setVestingAddress(genesisNftVestingAddress);
  console.log('Genesis NFT S2 - vesting address is set');

  await genesisNftSeries1.setAllMetadata(series1Metadata);
  console.log('Genesis NFT S1 - metadata is set');

  await genesisNftSeries2.setAllMetadata(series2Metadata);
  console.log('Genesis NFT S2 - metadata is set');

  await genesisNftSeries1.setTokenAllocation(series1Allocation);
  console.log('Genesis NFT S1 - token allocation is set');

  await genesisNftSeries2.setTokenAllocation(series2Allocation);
  console.log('Genesis NFT S2 - token allocation is set');

  await genesisNftSeries1.setSeries1(series1Bool);
  console.log('Genesis NFT S1 - series bool is set');

  await genesisNftSeries2.setSeries1(series2Bool);
  console.log('Genesis NFT S2 - series bool is set');

  await genesisNftSeries1.setMetadataImage(series1Images);
  console.log('Genesis NFT S1 - images are set');

  await genesisNftSeries2.setMetadataImage(series2Images);
  console.log('Genesis NFT S2 - images are set');

  console.log('Done');
};

export default setupGenesisNFTSetters;
setupGenesisNFTSetters.tags = ['setupGenesisNFTSetters'];
