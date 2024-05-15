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

  const investmentNFTAddress = '0x47E48acD43841fc454fad197e37EcB14f782bA69';

  // TOKEN URIS FOR DIFFERENT TIERS
  // const tokenUri = 'ipfs://QmPYRnKnwT989AWUC2EWGNYbLxvwYvp6sghmAqUcMJy52N';       // TIER1
  // const tokenUri = 'ipfs://QmYfwXRC3BEPz2dHcFLK1MKrF9SwcnH9A5TrkJoyMp3eQQ';       // TIER2
  const tokenUri = 'ipfs://QmNoQCWdHtxWtG8cqHA13kRGA7FEeS8QKcdSGmEokW4fsk'; // TIER3

  // AMOUNTS FOR DIFFERENT TIERS
  // const amount = toUsdc('10000');    // TIER1
  // const amount = toUsdc('5000');     // TIER2
  const amount = toUsdc('1000'); // TIER3

  if (!investmentNFTAddress || !tokenUri || !amount) {
    throw Error('Please configure investmentNFTAddress and amount in the airdrop script.');
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

        console.log(
          `NFT minted for user: ${addresses[i]} with amount: ${amount} and tokenUri: ${tokenUri} and tx hash: ${tx.hash}`
        );
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
