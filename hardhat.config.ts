import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-abi-exporter';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import { HardhatUserConfig } from 'hardhat/config';
import { etherscanApiKey, privateKey } from './.secrets.json';

const config: HardhatUserConfig = {
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
    except: ['^contracts/test']
  },
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
      accounts: [privateKey]
    },
    goerli: {
      url: 'https://rpc.ankr.com/eth_goerli',
      chainId: 5,
      accounts: [privateKey]
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
      }
    }
  }
};

export default config;
