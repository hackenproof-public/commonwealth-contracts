import { BaseProvider } from '@ethersproject/providers';
import { load } from 'csv-load-sync';
import { BigNumber, Wallet } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
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

const deployGenesisNftContract = async (
  deployer: Wallet,
  migrator: Wallet,
  royaltyWallet: string
): Promise<GenesisNFT> => {
  const tokenURI = env.GENESIS_NFT_TOKEN_URI!;
  process.stdout.write('Deploying Genesis NFT contract... ');
  const genesisNftFactory = await ethers.getContractFactory('GenesisNFT');
  const genesisNft = (await upgrades.deployProxy(genesisNftFactory, [
    deployer.address,
    royaltyWallet,
    650,
    tokenURI
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
  let totalCostLower = BigNumber.from(0);
  let totalCostUpper = BigNumber.from(0);

  for (const chunk of chunks) {
    console.log(`\nSimulate ${chunk.label}`);

    const gasUsed = await genesisNft.connect(migrator).estimateGas.mintBatch(chunk.accounts, chunk.balances);
    console.log(` gasUsed: ${gasUsed}`);

    const feeData = await provider.getFeeData();
    const lastBaseFeePerGas = (feeData.lastBaseFeePerGas || 0) as BigNumber;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0) as BigNumber;

    const fee = lastBaseFeePerGas.add(maxPriorityFeePerGas);
    const gasFeeLower = fee.sub(lastBaseFeePerGas.div(8));
    const gasFeeUpper = fee.add(lastBaseFeePerGas.div(8));
    const estimatedTxCostLower = gasFeeLower.mul(gasUsed);
    const estimatedTxCostUpper = gasFeeUpper.mul(gasUsed);

    console.log(` gasPrice: ${formatEther(gasFeeLower)} ETH - ${formatEther(gasFeeUpper)} ETH`);
    console.log(` txCost: ${formatEther(estimatedTxCostLower)} ETH - ${formatEther(estimatedTxCostUpper)} ETH`);

    totalGasUsed = totalGasUsed.add(gasUsed);
    totalCostLower = totalCostLower.add(estimatedTxCostLower);
    totalCostUpper = totalCostUpper.add(estimatedTxCostUpper);

    sleep(500);
  }

  console.log('\nSimulation finished');
  console.log(`Total gas used: ${totalGasUsed}`);
  console.log(`Estimated migration cost: ${formatEther(totalCostLower)} ETH - ${formatEther(totalCostUpper)} ETH`);
};

async function main() {
  const chainId = hre.network.config.chainId!;
  const { genesisNft, migrator, provider } = await setup(chainId);

  console.log(`Running migration script on chain: ${hre.network.name}, chainId: ${chainId}`);
  console.log(`\nMigrator wallet: ${migrator.address}`);
  console.log(`Genesis NFT address: ${genesisNft.address}`);

  let migratorBalanceBefore = await provider.getBalance(migrator.address);
  console.log(`Initial migrator balance: ${formatEther(migratorBalanceBefore)} ETH`);

  const preprocessedChunks = getPreprocessedChunks();

  console.log('\nSimulation can estimate gas usage and avoid transaction failure.');
  if (await confirmYesOrNo('Do you want to start simulation? [y - simulate / n - skip] ')) {
    await simulateMigration(preprocessedChunks, genesisNft, migrator, provider);
  }

  const filesMigrated = [];
  if (await confirmYesOrNo('\nDo you want to start migration? [y/n] ')) {
    createDirIfNotExist(MIGRATED_DIR);

    let totalGasUsed = 0;
    let totalMigrationCost = BigNumber.from(0);
    for (const chunk of preprocessedChunks) {
      console.log(`\nMigrating ${chunk.label}`);
      console.log(`Migrator balance: ${formatEther(await provider.getBalance(migrator.address))} ETH`);

      if (await confirmYesOrNo('Do you want to continue? [y/n] ')) {
        try {
          const tx = await genesisNft.connect(migrator).mintBatch(chunk.accounts, chunk.balances);
          console.log(`Transaction hash: ${tx.hash}`);

          process.stdout.write('Waiting for transaction to be mined... ');
          while (true) {
            const txReceipt = await ethers.provider.getTransactionReceipt(tx.hash);
            if (txReceipt) {
              const txCost = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

              console.log('Done');
              console.log('Receipt');
              console.log(` status: ${txReceipt.status}`);
              console.log(` gasUsed: ${txReceipt.gasUsed}`);
              console.log(` effectiveGasPrice: ${formatEther(txReceipt.effectiveGasPrice)} ETH`);
              console.log(` txCost: ${formatEther(txCost)} ETH`);

              totalGasUsed += txReceipt.gasUsed.toNumber();
              totalMigrationCost = totalMigrationCost.add(txCost);
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
    console.log(`Total migration cost: ${formatEther(totalMigrationCost)} ETH`);

    const migratorBalanceAfter = await provider.getBalance(migrator.address);
    console.log(`Migrator balance after migration: ${formatEther(migratorBalanceAfter)} ETH`);
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
