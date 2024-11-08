import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenNFTV2 } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

type GenesisLegacyData = {
  account: string;
  amount: number;
};

const burnLegacy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const genesisLegacyAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTV1Legacy');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const genesisLegacy = (await ethers.getContractAt('GenNFTV2', genesisLegacyAddress, wallet)) as GenNFTV2;

  const genesisLegacyData: GenesisLegacyData[] = [];

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];
      const legacyAmount = parseInt(row['GenLegacy']);

      if (legacyAmount > 0) {
        genesisLegacyData.push({
          account: address,
          amount: legacyAmount
        });
      }
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    console.log('Unpausing Genesis Legacy');
    const tx = await genesisLegacy.unpause();
    await tx.wait();
    console.log('Genesis Legacy unpaused');

    console.log('Burning Genesis NFT Legacy');

    for (let i = 0; i < genesisLegacyData.length; i++) {
      const gas = await wallet.getGasPrice();
      if (gas.gt(ethers.BigNumber.from(20000000000))) {
        throw new Error('Gas price too high');
      }

      const { account, amount } = genesisLegacyData[i];
      console.log('Burning for ', account, amount);
      await genesisLegacy.burn(account, 1, amount);
    }
  };

  await out();
  console.log('Done');
};

export default burnLegacy;
burnLegacy.tags = ['burnLegacy'];
