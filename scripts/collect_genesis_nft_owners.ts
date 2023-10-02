import { Filter, Log } from '@ethersproject/providers';
import { Alchemy, Network, NftContractOwner } from 'alchemy-sdk';
import { constants } from 'ethers';
import { hexZeroPad } from 'ethers/lib/utils';
import fs from 'fs';
import hre, { ethers } from 'hardhat';
import { env } from 'process';
import { ERC721_TRANSFER_EVENT_TOPIC } from './constants';
import { confirmYesOrNo } from './utils';

type ReportData = {
  account: string;
  balance: number;
  legacySeries1Balance: number;
  series1Balance: number;
  series2Balance: number;
  staked: number;
  series1Staked: number;
  series2Staked: number;
};

const GENESIS_NFT_LEGACY_SERIES_1 = '0x2b5469931fc530aba7bf30e6f8118a9d6e37143e';
const GENESIS_NFT_SERIES_1 = '0x22318dc6DB1BA94A7A1b32437E7867cC415286a1';
const GENESIS_NFT_SERIES_2 = '0xAE2DfbDDEF17998a638b26B38AAfD7e4625cA41A';
const STAKING_GENESIS_NFT = '0xAB14624691d0D1b62F9797368104Ef1F8C20dF83';
const SCRAP_CHUNK_SIZE = 3000;
const GENESIS_NFT_SERIES_1_START_BLOCK = 17193965;
const GENESIS_NFT_SERIES_2_START_BLOCK = 17313457;
const BLOCK = Number(env.COLLECT_GENESIS_NFT_OWNERS_BLOCK as string); // block number for which generate report

const saveToCsv = (report: ReportData[], path: string) => {
  process.stdout.write(`Saving to file: ${path}... `);

  const csvData =
    'account,totalBalance,legacySeries1Balance,series1Balance,series2Balance,totalStaked,series1Staked,series2Staked\n' +
    report
      .map((item) =>
        [
          item.account,
          item.balance,
          item.legacySeries1Balance,
          item.series1Balance,
          item.series2Balance,
          item.staked,
          item.series1Staked,
          item.series2Staked
        ].join(',')
      )
      .join('\n');

  fs.writeFileSync(path, csvData);
  console.log('Done');
};

const getGenesisNFTSupply = async (): Promise<[number, number]> => {
  const [genesisNftLegacySeries1Contract, genesisNftSeries1Contract, genesisNftSeries2Contract] = await Promise.all([
    ethers.getContractAt('GenNFT', GENESIS_NFT_LEGACY_SERIES_1),
    ethers.getContractAt('GenesisNFT', GENESIS_NFT_SERIES_1),
    ethers.getContractAt('GenesisNFT', GENESIS_NFT_SERIES_2)
  ]);

  const [legacySeries1Supply, series1Supply, series2Supply, genesisNftSeries1Staked, genesisNftSeries2Staked] =
    await Promise.all([
      genesisNftLegacySeries1Contract.totalSupply(1),
      genesisNftSeries1Contract.totalSupply(),
      genesisNftSeries2Contract.totalSupply(),
      genesisNftSeries1Contract.balanceOf(STAKING_GENESIS_NFT),
      genesisNftSeries2Contract.balanceOf(STAKING_GENESIS_NFT)
    ]);

  const genesisNftTotalSupply = legacySeries1Supply.add(series1Supply).add(series2Supply);
  const genesisNftTotalStaked = genesisNftSeries1Staked.add(genesisNftSeries2Staked);

  return [genesisNftTotalSupply.toNumber(), genesisNftTotalStaked.toNumber()];
};

const collectStakingEvents = async (
  contractAddress: string,
  stakingContract: string,
  startBlock: number,
  endBlock: number,
  chunkSize: number
): Promise<Array<Log[]>> => {
  let logsStaked = Array<Log>();
  let logsUnstaked = Array<Log>();

  const filterStake = {
    address: contractAddress,
    topics: [ERC721_TRANSFER_EVENT_TOPIC, null, hexZeroPad(stakingContract, 32)],
    fromBlock: startBlock,
    toBlock: endBlock
  };

  const filterUnstake = {
    address: contractAddress,
    topics: [ERC721_TRANSFER_EVENT_TOPIC, hexZeroPad(stakingContract, 32)],
    fromBlock: startBlock,
    toBlock: endBlock
  };

  const getLogsFromRange = async (filter: Filter, start: number, end: number): Promise<Log[]> => {
    filter.fromBlock = start;
    filter.toBlock = Math.min(start + chunkSize - 1, end);

    return await ethers.provider.getLogs(filter);
  };

  let start = startBlock;
  while (start <= endBlock) {
    const toBlock = Math.min(start + chunkSize - 1, endBlock);
    logsStaked = logsStaked.concat(await getLogsFromRange(filterStake, start, toBlock));
    logsUnstaked = logsUnstaked.concat(await getLogsFromRange(filterUnstake, start, toBlock));
    start = toBlock + 1;
  }

  logsStaked = logsStaked.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));
  logsUnstaked = logsUnstaked.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));

  return [logsStaked, logsUnstaked];
};

const calculateStakedFromLogs = (logs: Log[]): Map<string, number> => {
  const tokens = new Map<string, number>();
  logs.forEach((log) => {
    const from = `0x${log.topics[1].substring(26)}`;
    const wallet = from.toLowerCase();

    const currentTokens = tokens.get(wallet) || 0;
    tokens.set(wallet, currentTokens + 1);
  });
  return tokens;
};

const calculateUnstakedFromLogs = (logs: Log[]): Map<string, number> => {
  const tokens = new Map<string, number>();
  logs.forEach((log) => {
    const to = `0x${log.topics[2].substring(26)}`;
    const wallet = to.toLowerCase();

    const currentTokens = tokens.get(wallet) || 0;
    tokens.set(wallet, currentTokens + 1);
  });
  return tokens;
};

const calculateStakesFromLogs = (logsStaked: Log[], logsUnstaked: Log[]): Map<string, number> => {
  const tokensStaked = calculateStakedFromLogs(logsStaked);
  const tokensUnstaked = calculateUnstakedFromLogs(logsUnstaked);

  let tokensBalance = new Map<string, number>();
  for (const [key, staked] of tokensStaked) {
    const unstaked = tokensUnstaked.get(key) || 0;
    tokensBalance.set(key, staked - unstaked);
  }

  tokensBalance.forEach((value, key) => {
    if (value === 0) {
      tokensBalance.delete(key);
    }
  });

  return tokensBalance;
};

const getOwners = async (alchemySdk: Alchemy, contractAddress: string, block: number): Promise<NftContractOwner[]> => {
  const result = await alchemySdk.nft.getOwnersForContract(contractAddress, {
    withTokenBalances: true,
    block: block.toString()
  });

  return result.owners.filter((item) => item.ownerAddress.toLowerCase() !== constants.AddressZero.toLowerCase());
};

const getOwnersOfERC1155 = async (
  alchemySdk: Alchemy,
  contractAddress: string,
  block: number
): Promise<Map<string, number>> => {
  const owners = await getOwners(alchemySdk, contractAddress, block);
  return new Map(
    owners.map((item) => [item.ownerAddress.toLowerCase(), item.tokenBalances[0].balance] as [string, number])
  );
};

const getOwnersOfERC721 = async (
  alchemySdk: Alchemy,
  contractAddress: string,
  block: number
): Promise<Map<string, number>> => {
  const owners = await getOwners(alchemySdk, contractAddress, block);
  return new Map(
    owners.map((item) => [item.ownerAddress.toLowerCase(), item.tokenBalances.length] as [string, number])
  );
};

const validateReport = async (report: ReportData[]) => {
  let validationSuccess = true;
  let totalBalance = 0;
  let totalStaked = 0;
  for (const data of report) {
    if (data.balance !== data.legacySeries1Balance + data.series1Balance + data.series2Balance) {
      validationSuccess = false;
      console.log(
        `Validation error! Incorrect account balance: ${data.account} - expected: ${data.balance}, actual: ${
          data.legacySeries1Balance + data.series1Balance + data.series2Balance
        }`
      );
    }
    if (data.staked !== data.series1Staked + data.series2Staked) {
      validationSuccess = false;
      console.log(
        `Validation error! Incorrect account staked: ${data.account} - expected: ${data.staked}, actual: ${
          data.series1Staked + data.series2Staked
        }`
      );
    }
    totalBalance += data.balance;
    totalStaked += data.staked;
  }

  const [genesisNftTotalSupply, genesisNftTotalStaked] = await getGenesisNFTSupply();
  if (totalBalance !== genesisNftTotalSupply) {
    validationSuccess = false;
    console.log(`Validation error! Incorrect balance - expected: ${genesisNftTotalSupply}, actual: ${totalBalance}`);
  }
  if (totalStaked !== genesisNftTotalStaked) {
    validationSuccess = false;
    console.log(
      `Validation error! Incorrect staking amount - expected: ${genesisNftTotalStaked}, actual: ${totalStaked}`
    );
  }

  console.log(`${validationSuccess ? 'Validation succeeded!' : 'Validation failed!'}`);
};

async function main() {
  const settings = {
    apiKey: env.ALCHEMY_API_KEY as string,
    network: Network.ETH_MAINNET
  };

  const alchemy = new Alchemy(settings);

  console.log(
    `Running Genesis NFT owners collecting script on network: ${hre.network.name}, chainId: ${hre.network.config.chainId}`
  );
  console.log(`\nGenesis NFT Series 1 (legacy): ${GENESIS_NFT_LEGACY_SERIES_1}`);
  console.log(`Genesis NFT Series 1: ${GENESIS_NFT_SERIES_1}`);
  console.log(`Genesis NFT Series 2: ${GENESIS_NFT_SERIES_2}`);
  console.log(`Staking Genesis NFT: ${STAKING_GENESIS_NFT}`);
  console.log(`Genesis NFT Series 1 start block: ${GENESIS_NFT_SERIES_1_START_BLOCK}`);
  console.log(`Genesis NFT Series 2 start block: ${GENESIS_NFT_SERIES_2_START_BLOCK}`);
  console.log(`Block number: ${BLOCK}`);

  if (await confirmYesOrNo('\nDo you want to continue? [y/n] ')) {
    const legacySeries1Owners = await getOwnersOfERC1155(alchemy, GENESIS_NFT_LEGACY_SERIES_1, BLOCK);
    const series1Owners = await getOwnersOfERC721(alchemy, GENESIS_NFT_SERIES_1, BLOCK);
    const series2Owners = await getOwnersOfERC721(alchemy, GENESIS_NFT_SERIES_2, BLOCK);

    const [logsSeries1Staked, logsSeries1Unstaked] = await collectStakingEvents(
      GENESIS_NFT_SERIES_1,
      STAKING_GENESIS_NFT,
      GENESIS_NFT_SERIES_1_START_BLOCK,
      BLOCK,
      SCRAP_CHUNK_SIZE
    );
    const series1Stakes = calculateStakesFromLogs(logsSeries1Staked, logsSeries1Unstaked);

    const [logsSeries2Staked, logsSeries2Unstaked] = await collectStakingEvents(
      GENESIS_NFT_SERIES_2,
      STAKING_GENESIS_NFT,
      GENESIS_NFT_SERIES_2_START_BLOCK,
      BLOCK,
      SCRAP_CHUNK_SIZE
    );
    const series2Stakes = calculateStakesFromLogs(logsSeries2Staked, logsSeries2Unstaked);

    let accountsBalance = new Map<string, number>();
    [legacySeries1Owners, series1Owners, series2Owners, series1Stakes, series2Stakes].forEach((tokenMap) => {
      for (const [key, value] of tokenMap) {
        const account = key.toLowerCase();
        const balance = accountsBalance.get(account) || 0;
        accountsBalance.set(account, balance + value);
      }
    });
    accountsBalance.delete(STAKING_GENESIS_NFT.toLowerCase());

    let report = Array<ReportData>();
    Array.from(accountsBalance).forEach(([account, balance]: [string, number]) => {
      const series1Staked = series1Stakes.get(account) || 0;
      const series2Staked = series2Stakes.get(account) || 0;
      const staked = series1Staked + series2Staked;
      const reportData = {
        account,
        balance,
        legacySeries1Balance: legacySeries1Owners.get(account) || 0,
        series1Balance: (series1Owners.get(account) || 0) + series1Staked,
        series2Balance: (series2Owners.get(account) || 0) + series2Staked,
        staked,
        series1Staked,
        series2Staked
      };
      report.push(reportData);
    });
    report = report.sort((a, b) => (a.balance > b.balance ? -1 : 1));

    await validateReport(report);

    saveToCsv(report, `./scripts/genesis-nft-owners-in-block-${BLOCK}.csv`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
