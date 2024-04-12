import { NonceManager } from '@ethersproject/experimental';
import parse from 'csv-parser';
import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { toUsdc } from '../test/utils';
import { InvestmentNFT } from '../typechain-types';

//This scrip needs to be run separetly for every tier
const airdropFreeFundNfts: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  console.log('Airdrop started');

  const csvFilePath = __dirname + '/../data/freeFundAirdrop.csv';
  const delimiter = ',';
  const addresses: string[] = [];
  const tokenUri = undefined; //'ipfs://QmT8rv43PKmqqkC5Fb9FhJWEzpUim1jU5s8bhDyw2TQG1a';

  const investmentNFTAddress = undefined;
  const amount = undefined;

  if (!investmentNFTAddress || !tokenUri || !amount) {
    throw Error(
      'Please configure investmentNFTAddress, pinataApiKey, pinataSecretApiKey and amount in the airdrop script.'
    );
  }

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new NonceManager(
    new ethers.Wallet(getEnvByNetwork('WALLET_PRIVATE_KEY', hre.network.name)!, provider)
  );

  const nft = (await ethers.getContractAt('InvestmentNFT', investmentNFTAddress, wallet)) as InvestmentNFT;

  const readStream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ separator: delimiter }))
    .on('data', (row) => {
      const address = row['Address'];

      addresses.push(address);
    });

  for await (const chunk of readStream) {
  }
  const out = async () => {
    for (let i = 0; i < addresses.length; i++) {
      try {
        console.log(`Minting NFT of for user: ${addresses[i]}`);

        const totalInvestment = await nft.getTotalInvestmentValue();

        if (totalInvestment.add(amount).gt(toUsdc('1350000'))) {
          console.log('The cap is already reached!');
          break;
        }

        const requiredGas = await nft.estimateGas.mint(addresses[i], amount, tokenUri);
        const tx = await nft.mint(addresses[i], amount, tokenUri, { gasLimit: requiredGas.mul(2) });
        await tx.wait();

        console.log(`NFT minted for user: ${addresses[i]} with amount: ${amount.toString()} and tokenUri: ${tokenUri}`);
      } catch (error) {
        console.log('Something went wrong', error);
        process.exit(1);
      }
    }

    console.log(await nft.getTotalInvestmentValue());
  };

  await out();

  console.log('Airdrop completed');
};

export default airdropFreeFundNfts;
airdropFreeFundNfts.tags = ['airdropFreeFundNfts'];
