import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-abi-exporter';
import 'hardhat-contract-sizer';
import { HardhatUserConfig } from 'hardhat/config';
import { etherscanApiKey, privateKey } from './.secrets.json';

const config: HardhatUserConfig = {
  etherscan: {
    apiKey: etherscanApiKey
  },
  gasReporter: {
    coinmarketcap: process.env.CMC_API_KEY,
    enabled: !!process.env.REPORT_GAS,
    showTimeSpent: true
  },
  networks: {
    ethereum: {
      url: 'https://rpc.ankr.com/eth',
      chainId: 1,
      accounts: [privateKey],
      timeout: 400000
    },
    goerli: {
      url: 'https://rpc.ankr.com/eth_goerli',
      chainId: 5,
      accounts: [privateKey],
      gas: 415426000
    },
    sepolia: {
      url: 'https://rpc.sepolia.org',
      chainId: 11155111,
      accounts: [privateKey]
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout']
        }
      },
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.8.7/metadata.html
        bytecodeHash: 'none'
      }
    }
  }
};

export default config;
