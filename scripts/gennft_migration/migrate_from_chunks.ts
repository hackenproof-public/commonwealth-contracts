import { BaseProvider } from '@ethersproject/providers';
import { load } from 'csv-load-sync';
import { BigNumber, utils, Wallet } from 'ethers';
import fs from 'fs';
import hre, { ethers, upgrades } from 'hardhat';
import { env } from 'process';
import { keccak256 } from '../../test/utils';
import { GenesisNFT } from '../../typechain-types';
import { confirmYesOrNo, createDirIfNotExist, moveFile, sleep } from '../utils';

type LabeledAccountBalance = {
  accounts: string[];
  balances: number[];
  label: string;
};

const MIGRATED_DIR = './files/migrated';
const TOKEN_URI = env.GENESIS_NFT_TOKEN_URI!;

const deployGenesisNftContract = async (
  deployer: Wallet,
  migrator: Wallet,
  royaltyWallet: string
): Promise<GenesisNFT> => {
  process.stdout.write('Deploying Genesis NFT contract... ');
  const genesisNftFactory = await ethers.getContractFactory('GenesisNFT');
  const genesisNft = (await upgrades.deployProxy(genesisNftFactory, [
    deployer.address,
    royaltyWallet,
    650
  ])) as GenesisNFT;
  await genesisNft.deployed();

  console.log('Done');

  await genesisNft.connect(deployer).grantRole(keccak256('MINTER_ROLE'), migrator.address);

  return genesisNft;
};

const getSortedChunkFiles = (): string[] => {
  const chunkFileRegex = new RegExp(/^chunk-.*\.csv$/);

  const chunksFiles = [];
  const dir = fs.opendirSync('./files');
  let dirent;
  while ((dirent = dir.readSync()) !== null) {
    if (chunkFileRegex.test(dirent.name)) {
      chunksFiles.push(dirent.name);
    }
  }
  dir.closeSync();

  return chunksFiles.sort((a, b) => (a < b ? -1 : 1));
};

const setup = async (chainId: number) => {
  let genesisNft: GenesisNFT;
  let provider: BaseProvider;
  let migrator: Wallet;

  if (chainId === 1) {
    provider = ethers.getDefaultProvider(env.ETHEREUM_RPC_URL);
    migrator = new ethers.Wallet(env.MIGRATOR_PRIVATE_KEY!, provider);
    genesisNft = await ethers.getContractAt('GenesisNFT', env.ETHEREUM_GENESIS_NFT_CONTRACT!);
  } else if (chainId === 5) {
    provider = ethers.getDefaultProvider(env.GOERLI_RPC_URL);
    migrator = new ethers.Wallet(env.MIGRATOR_PRIVATE_KEY!, provider);
    genesisNft = await ethers.getContractAt('GenesisNFT', env.GOERLI_GENESIS_NFT_CONTRACT!);
  } else if (chainId === 31337) {
    provider = ethers.getDefaultProvider(env.LOCALHOST_RPC_URL);
    migrator = new ethers.Wallet(env.MIGRATOR_PRIVATE_KEY!, provider);
    genesisNft = await deployGenesisNftContract(
      new ethers.Wallet(env.LOCALHOST_DEPLOYER_PRIVATE_KEY!, provider),
      migrator,
      env.LOCALHOST_ROYALTY_WALLET!
    );
  } else if (chainId === 11155111) {
    provider = ethers.getDefaultProvider(env.SEPOLIA_RPC_URL);
    migrator = new ethers.Wallet(env.MIGRATOR_PRIVATE_KEY!, provider);
    genesisNft = await ethers.getContractAt('GenesisNFT', env.SEPOLIA_GENESIS_NFT_CONTRACT!);
  } else {
    throw new Error('Cannot retrieve Genesis NFT contract - unknown network');
  }

  return { genesisNft, migrator, provider };
};

const getPreprocessedChunks = (): LabeledAccountBalance[] => {
  const preprocessedChunks = [];

  process.chdir('./scripts/gennft_migration');
  const chunksFiles = getSortedChunkFiles();

  for (const chunkFile of chunksFiles) {
    const chunk = load(`files/${chunkFile}`, {
      convert: {
        amount: parseInt
      }
    });

    let accounts = [];
    let balances = [];
    for (const association of chunk) {
      accounts.push(association.account);
      balances.push(association.balance);
    }
    preprocessedChunks.push({ accounts, balances, label: chunkFile });
  }

  return preprocessedChunks;
};

const printError = (message: string, error: unknown) => {
  type InternalErrorType = {
    body: string;
  };
  type ErrorType = {
    error: {
      error: InternalErrorType;
    };
  };
  let parsed = error as InternalErrorType;
  if (parsed.body == undefined) {
    const parsedError = error as ErrorType;
    parsed = parsedError.error.error as InternalErrorType;
  }

  try {
    const body = JSON.parse(parsed.body);
    console.log(`${message}\n  message: ${body.error.message}`);
  } catch (exception) {
    console.log(`Error while parsing error message: ${exception}`);
  }
};

const simulateMigration = async (
  chunks: LabeledAccountBalance[],
  genesisNft: GenesisNFT,
  migrator: Wallet,
  provider: BaseProvider
) => {
  let totalGasUsed = BigNumber.from(0);
  let totalGasCost = BigNumber.from(0);

  for (const chunk of chunks) {
    console.log(`\nSimulate ${chunk.label}`);

    const gasPrice = await provider.getGasPrice();
    console.log(`Gas price: ${utils.formatEther(gasPrice)} ETH`);

    const gasUsed = await genesisNft.connect(migrator).estimateGas.mintBatch(chunk.accounts, chunk.balances, TOKEN_URI);
    console.log(`Gas used: ${gasUsed}`);

    const estimatedTxCost = gasUsed.mul(gasPrice);
    console.log(`Estimated tx cost: ${utils.formatEther(estimatedTxCost)} ETH`);

    totalGasUsed = totalGasUsed.add(gasUsed);
    totalGasCost = totalGasCost.add(estimatedTxCost);
  }

  console.log('\nSimulation finished');
  console.log(`Total gas used: ${utils.formatEther(totalGasUsed)}`);
  console.log(`Estimated total gas cost: ${utils.formatEther(totalGasCost)} ETH`);
};

async function main() {
  const chainId = hre.network.config.chainId!;
  const { genesisNft, migrator, provider } = await setup(chainId);

  console.log(`Running migration script on chain: ${hre.network.name}, chainId: ${chainId}`);
  console.log(`\nMigrator wallet: ${migrator.address}`);
  console.log(`Genesis NFT address: ${genesisNft.address}`);

  let migratorBalanceBefore = await provider.getBalance(migrator.address);
  console.log(`Initial migrator balance: ${utils.formatEther(migratorBalanceBefore)} ETH`);

  const preprocessedChunks = getPreprocessedChunks();

  console.log('\nSimulation can estimate gas usage and avoid transaction failure.');
  if (await confirmYesOrNo('Do you want to start simulation? [y - simulate / n - skip] ')) {
    await simulateMigration(preprocessedChunks, genesisNft, migrator, provider);
  }

  const filesMigrated = [];
  if (await confirmYesOrNo('\nDo you want to start migration? [y/n] ')) {
    createDirIfNotExist(MIGRATED_DIR);

    let totalGasUsed = 0;
    let migratorBalance = await provider.getBalance(migrator.address);

    for (const chunk of preprocessedChunks) {
      console.log(`\nMigrating ${chunk.label}`);

      if (await confirmYesOrNo('Do you want to continue? [y/n] ')) {
        const gasPrice = await provider.getGasPrice();
        console.log(`Gas price: ${utils.formatEther(gasPrice)}`);

        try {
          const tx = await genesisNft.connect(migrator).mintBatch(chunk.accounts, chunk.balances, TOKEN_URI);
          console.log(`Transaction hash: ${tx.hash}`);

          process.stdout.write('Waiting for transaction to be mined... ');
          while (true) {
            const txReceipt = await ethers.provider.getTransactionReceipt(tx.hash);
            if (txReceipt) {
              console.log('Done');
              const newBalance = await provider.getBalance(migrator.address);
              console.log(
                `Receipt\n status: ${txReceipt.status}\n gas used: ${txReceipt.gasUsed}\n tx cost: ${utils.formatEther(
                  migratorBalance.sub(newBalance)
                )} ETH`
              );
              totalGasUsed += txReceipt.gasUsed.toNumber();
              migratorBalance = newBalance;
              break;
            }
            sleep(1000);
          }
          filesMigrated.push(chunk.label);
          moveFile(`./files/${chunk.label}`, `./files/migrated/${chunk.label}`);
        } catch (error) {
          printError('Error occurred!', error);
          if (await confirmYesOrNo('\nDo you want to stop migration? [y/n] ')) {
            console.log('Migration aborted');
            console.log(`Following files were migrated successfully: ${filesMigrated.join(', ')}\n`);
            throw new Error('Execution aborted');
          }
        }
      }
    }

    console.log('\nMigration completed');
    console.log(`Following files were migrated successfully: ${filesMigrated.join(', ')}\n`);
    console.log(`Total gas used: ${totalGasUsed}`);

    const migratorBalanceAfter = await provider.getBalance(migrator.address);
    console.log(`Migrator balance after migration: ${utils.formatEther(migratorBalanceAfter)} ETH`);
    console.log(`Migration cost: ${utils.formatEther(migratorBalanceBefore.sub(migratorBalanceAfter))} ETH`);
  }

  if (await confirmYesOrNo('\nDo you want to validate migration? [y/n] ')) {
    console.log('Validating migration...');
    const balances = load('files/migration-nft-holders.csv', {
      convert: {
        amount: parseInt
      }
    });

    let validationSuccess = true;
    for (const tokenBalance of balances) {
      const balance = await genesisNft.balanceOf(tokenBalance.account);
      if (Number(balance) !== Number(tokenBalance.balance)) {
        validationSuccess = false;
        console.log(
          `Validation error! Account: ${tokenBalance.account}, expected: ${tokenBalance.balance}, actual: ${balance}`
        );
      }
    }
    console.log(`${validationSuccess ? 'Validation succeeded!' : 'Validation failed!'}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
