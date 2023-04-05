import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import * as dotenv from 'dotenv';
import 'hardhat-abi-exporter';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import 'hardhat-tracer';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const config: HardhatUserConfig = {
  abiExporter: {
    path: './abi',
    clear: true,
    except: ['@openzeppelin'],
    spacing: 2,
    format: 'json'
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
    except: ['^contracts/test']
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: process.env.REPORT_GAS?.toLowerCase() === 'true',
    showTimeSpent: true
  },
  networks: {
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || '',
      chainId: 1,
      accounts: !!process.env.ETHEREUM_WALLET_PRIVATE_KEY ? [process.env.ETHEREUM_WALLET_PRIVATE_KEY] : []
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || '',
      chainId: 5,
      accounts: !!process.env.GOERLI_WALLET_PRIVATE_KEY ? [process.env.GOERLI_WALLET_PRIVATE_KEY] : [],
      gas: 415426000
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      chainId: 11155111,
      accounts: !!process.env.SEPOLIA_WALLET_PRIVATE_KEY ? [process.env.SEPOLIA_WALLET_PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  solidity: {
    version: '0.8.18',
    settings: {
      optimizer: {
        enabled: true
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout']
        }
      }
    }
  }
};

export default config;
