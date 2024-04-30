import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFTVesting } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const genesisNftBonusSetup: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const csvFilePath = __dirname + '/../data/stakingRewards.csv';
  const delimiter = ',';
  const vestingAddress = await getContractAddress(hre.network.config.chainId!, 'GenesisNFTVesting');
  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const bonusNftIds: number[] = [];

  const genesisNftVesting = (await ethers.getContractAt(
    'GenesisNFTVesting',
    vestingAddress,
    wallet
  )) as GenesisNFTVesting;

  const readStream = await fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const ids = row['BonusNFTs'] as string;

      if (ids.length > 2) {
        const values = ids
          .slice(1, ids.length - 1)
          .split(',')
          .forEach((id) => {
            bonusNftIds.push(parseInt(id));
          });
      }
    });

  for await (const chunk of readStream) {
  }

  const out = async () => {
    console.log('Setting up Genesis NFT Bonus');

    const tx = await genesisNftVesting.setupBonus(bonusNftIds, true);
    await tx.wait();

    console.log('Bonus is set up', tx.hash);
  };

  await out();
  console.log('Done');
};

export default genesisNftBonusSetup;
genesisNftBonusSetup.tags = ['genesisNftBonusSetup'];
