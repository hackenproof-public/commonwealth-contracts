import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

type GenesisSeries1Data = {
  account: string;
  ids: number[];
};

const burnGenesisNftSeries2: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const genesisNftSeries2Address = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV2');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisNftSeries2 = (await ethers.getContractAt('GenesisNFT', genesisNftSeries2Address, wallet)) as GenesisNFT;

  const genesisSeries2Data: GenesisSeries1Data[] = [];

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const ids = row['Gen2Unstaked'] as string;

      if (ids.length > 2) {
        const values = ids
          .slice(1, ids.length - 1)
          .split(',')
          .map((id) => parseInt(id));
        genesisSeries2Data.push({
          account: address,
          ids: values
        });
      }
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    console.log('Burning Genesis NFT Series 2');

    for (let i = 0; i < genesisSeries2Data.length; i++) {
      const { account, ids } = genesisSeries2Data[i];
      for (let j = 0; j < ids.length; j++) {
        console.log('Burning for ', account, ids[j]);
        await genesisNftSeries2.burn(ids[j]);
      }
    }
  };

  await out();
  console.log('Done');
};

export default burnGenesisNftSeries2;
burnGenesisNftSeries2.tags = ['burnGenesisNftSeries2'];
