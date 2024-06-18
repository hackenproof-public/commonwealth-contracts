import parse from 'csv-parser';
import fs from 'fs';
import { NonceManager } from '@ethersproject/experimental';
import { ethers, network } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toWlth } from '../test/utils';
import { Wlth } from '../typechain-types';
import { getContractAddress } from '../utils/addresses';

const deployStakingGenNFTVesting: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const wlthAddress = await getContractAddress(network.config.chainId!, 'Wlth');

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const csvFilePath = __dirname + '/../data/freeFundAirdopAddresses.csv';
  const delimiter = ',';
  const addresses: string[] = [];

  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const wlth: Wlth = (await ethers.getContractAt('Wlth', wlthAddress, wallet)) as Wlth;

  console.log(wallet);
  console.log(await provider.getBalance(await wallet.getAddress()));

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['address'];

      if (address !== 'NULL') {
        addresses.push(address);
      }
    });

  for await (const chunk of readStream) {
  }

  for (const receiver of addresses) {
    console.log('Wlth airdrop');
    const wlthTx = await wlth.transfer(receiver, toWlth('1000'));
    await wlthTx.wait();
  }
};

export default deployStakingGenNFTVesting;
deployStakingGenNFTVesting.tags = ['tge', 'airdropTier4FreeFund', 'all'];
