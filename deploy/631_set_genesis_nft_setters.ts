import { NonceManager } from '@ethersproject/experimental';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT, GenNFTV2 } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';
import { toWlth } from '../test/utils';

const setupGenesisNFTSetters: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  // const genesisNftSeries1Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1');
  // const genesisNftSeries2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');
  // const genesisNftVestingAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTVesting');
  const genesisNftSeries1Address = "0xCB0Ef07D6cFFEc9490c15E39a0a029B0B9F84587";
  const genesisNftSeries2Address = "0xFF20595Ed2e2281E07f07CDe40898D695410eFFE";
  const genesisNftVestingAddress = "0x90D636Bb5B95FA3c4e31f5Aa485316cd2930D8D5";
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
    externalUrl: 'https://app.joincommonwealth.xyz/community/treasury#GenesisNFT',
    id: "1",
    percentage: "12%"
  };

  const series2Metadata = {
    name: "Common Wealth Genesis NFT Series 2",
    description: "Common Wealth OG. Welcome to All Street",
    externalUrl: 'https://app.joincommonwealth.xyz/community/treasury#GenesisNFT',
    id: "2",
    percentage: "3%"
  };

  const series1Allocation = toWlth("44000");
  const series2Allocation = toWlth("6444");

  const series1Bool = true;
  const series2Bool = false;

  const series1Images = ["https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-0%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-10%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-20%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-30%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-40%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-50%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-60%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-70%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-80%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-90%.png",
                         "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s1/s1-100%.png"
  ];
  const series2Images = ["https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-0%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-10%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-20%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-30%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-40%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-50%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-60%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-70%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-80%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-90%.png",
                        "https://ipfs.io/ipfs/QmNSxCA1gBMHG5i8qBMjUYyu5MdbxtH5MUfyR3HwMPS58X/s2/s2-100%.png"
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
