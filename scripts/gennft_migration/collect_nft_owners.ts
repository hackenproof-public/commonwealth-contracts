import { BaseProvider, Log } from '@ethersproject/providers';
import { constants, utils } from 'ethers';
import fs from 'fs';
import hre, { ethers } from 'hardhat';
import { abort, env } from 'process';
import { confirmYesOrNo, createDirIfNotExist } from '../utils';

type AccountBalance = { account: string; balance: number };
type AccountBalanceList = Array<{ account: string; balance: number }>;

const saveToCsv = (associationList: AccountBalanceList, path: string) => {
  process.stdout.write(`Saving to file: ${path}... `);

  const csvData =
    'account,balance\n' + associationList.map((item) => [item.account, item.balance].join(',')).join('\n');

  fs.writeFileSync(path, csvData);
  console.log('Done');
};

const collectTransferEvents = async (
  provider: BaseProvider,
  contractAddress: string,
  startBlock: number,
  endBlock: number,
  chunkSize: number
): Promise<Log[]> => {
  let logs = Array<Log>();

  const filter = {
    address: contractAddress,
    topics: [utils.id('TransferSingle(address,address,address,uint256,uint256)')],
    fromBlock: startBlock,
    toBlock: endBlock
  };

  console.log('Collecting transfer events...');
  let start = startBlock;
  while (start <= endBlock) {
    filter.fromBlock = start;
    filter.toBlock = Math.min(start + chunkSize - 1, endBlock);

    console.log(`Scrapping blocks: ${filter.fromBlock}-${filter.toBlock}`);

    logs = logs.concat(await provider.getLogs(filter));
    start = filter.toBlock + 1;
  }

  process.stdout.write('\nSorting events by block number... ');
  logs = logs.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));
  console.log('Done');

  return logs;
};

const processTransferEvents = (logs: Log[]): AccountBalanceList => {
  const transferDataRegex = new RegExp(/^0[xX]([0-9a-fA-F]{64})([0-9a-fA-F]{64})$/);

  process.stdout.write('Processing events...');
  const tokens = new Map<string, number>();
  logs.forEach((log) => {
    const from = `0x${log.topics[2].substring(26)}`;
    const to = `0x${log.topics[3].substring(26)}`;

    const transferData = transferDataRegex.exec(log.data);
    const value = Number(`0x${transferData?.[2] || '0'}`);

    if (to != constants.AddressZero) {
      // Transfer to account -> increment number of account's tokens
      const currentTokens = tokens.get(to) || 0;
      tokens.set(to, currentTokens + value);
    }

    if (from != constants.AddressZero) {
      // Transfer from account -> decrement number of account's tokens
      const currentTokens = tokens.get(from) || 0;
      if (currentTokens == 0) {
        console.log('\nSomething wrong happened while calculating tokens! Abort.');
        abort();
      }
      tokens.set(from, currentTokens - value);
    }
  });
  console.log('Done');

  process.stdout.write('Filtering results...');
  const filteredTokens = Array<AccountBalance>();
  Array.from(tokens).forEach((data: [string, number]) => {
    if (data[1] > 0) {
      filteredTokens.push({ account: data[0], balance: data[1] });
    }
  });
  console.log('Done');

  return filteredTokens;
};

const putTokensToChunks = (associationList: AccountBalanceList, maxChunkSize: number) => {
  let chunks = Array<AccountBalanceList>();
  let currentChunk = Array<AccountBalance>();

  let currentChunkSize = 0;
  associationList.map((item) => {
    let remainingTokens = item.balance;
    while (remainingTokens > 0) {
      const tokensToChunk = Math.min(remainingTokens, maxChunkSize - currentChunkSize);

      currentChunk.push({ account: item.account, balance: tokensToChunk });
      remainingTokens -= tokensToChunk;
      currentChunkSize += tokensToChunk;

      if (currentChunkSize >= maxChunkSize) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkSize = 0;
      }
    }
  });
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  chunks.forEach((chunk, index) => {
    saveToCsv(chunk, `./files/chunk-${String(index).padStart(3, '0')}.csv`);
  });

  return chunks;
};

const getRpcUrl = (chainId: number) => {
  if (chainId === 1) {
    return env.ETHEREUM_RPC_URL;
  } else if (chainId === 5) {
    return env.GOERLI_RPC_URL;
  } else if (chainId === 31337) {
    return env.LOCALHOST_RPC_URL;
  } else if (chainId === 11155111) {
    return env.SEPOLIA_RPC_URL;
  } else {
    throw new Error('Cannot retrieve RPC URL - unknown network');
  }
};

async function main() {
  const migrateRemainingSeries1 = (env.MIGRATE_REMAINING_SERIES1_NFT || '').toLowerCase() === 'true';
  const remainingSeries1NftWallet = env.REMAINING_SERIES1_NFTS_WALLET!;
  const desiredSeries1NftNumber = 2000;
  const genesisNftV1 = '0x2b5469931fc530aba7bf30e6f8118a9d6e37143e';
  const scrapChunkSize = 3000;
  const migrationChunkSize = Number(env.MIGRATION_CHUNK_SIZE);
  const startBlock = Number(env.START_BLOCK);
  const endBlock = Number(env.END_BLOCK);

  console.log(
    `Running collecting NFT owners script on network: ${hre.network.name}, chainId: ${hre.network.config.chainId}`
  );
  console.log('Parameters');
  console.log(` Source Genesis NFT contract (v1): ${genesisNftV1}`);
  console.log(` Start block: ${startBlock}`);
  console.log(` End block: ${endBlock}`);
  console.log(` Migration chunk size: ${migrationChunkSize}`);
  console.log(' Unsold Series 1 NFTs');
  console.log(`  mint: ${migrateRemainingSeries1}`);
  if (migrateRemainingSeries1 === true) {
    console.log(`  to wallet: ${remainingSeries1NftWallet}`);
    console.log(`  total Series 1 NFTs: ${desiredSeries1NftNumber}`);
  }

  if (await confirmYesOrNo('\nDo you want to continue? [y/n] ')) {
    const rpcUrl = getRpcUrl(hre.network.config.chainId!);
    const provider = ethers.getDefaultProvider(rpcUrl);

    process.chdir('./scripts/gennft_migration');

    const logs = await collectTransferEvents(provider, genesisNftV1, startBlock, endBlock, scrapChunkSize);
    const tokens = processTransferEvents(logs);

    const totalTokensNumber = tokens.reduce((previous, current) => {
      return { account: '', balance: previous.balance + current.balance };
    }).balance;
    console.log(`\nTokens collected: ${totalTokensNumber}`);

    if (migrateRemainingSeries1 === true) {
      tokens.push({ account: remainingSeries1NftWallet, balance: desiredSeries1NftNumber - totalTokensNumber });
    }

    createDirIfNotExist('./files');
    saveToCsv(tokens, `./files/migration-nft-holders.csv`);
    putTokensToChunks(tokens, migrationChunkSize);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
