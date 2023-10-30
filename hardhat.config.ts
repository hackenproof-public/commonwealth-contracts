import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import * as dotenv from 'dotenv';
import 'hardhat-abi-exporter';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'hardhat-docgen';
import 'hardhat-tracer';
import { HardhatUserConfig } from 'hardhat/config';
import { env } from 'process';
import 'solidity-coverage';

dotenv.config();

const config: HardhatUserConfig = {
  abiExporter: {
    path: './abi',
    clear: true,
    except: ['@openzeppelin', '@uniswap'],
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
    apiKey: env.ETHERSCAN_API_KEY
  },
  gasReporter: {
    coinmarketcap: env.COINMARKETCAP_API_KEY,
    enabled: env.REPORT_GAS?.toLowerCase() === 'true',
    showTimeSpent: true
  },
  networks: {
    ethereum: {
      url: env.ETHEREUM_RPC_URL || '',
      chainId: 1,
      accounts: !!env.ETHEREUM_WALLET_PRIVATE_KEY ? [env.ETHEREUM_WALLET_PRIVATE_KEY] : []
    },
    goerli: {
      url: env.GOERLI_RPC_URL || '',
      chainId: 5,
      accounts: !!env.GOERLI_WALLET_PRIVATE_KEY ? [env.GOERLI_WALLET_PRIVATE_KEY] : []
    },
    sepolia: {
      url: env.SEPOLIA_RPC_URL || '',
      chainId: 11155111,
      accounts: !!env.SEPOLIA_WALLET_PRIVATE_KEY ? [env.SEPOLIA_WALLET_PRIVATE_KEY] : []
    },
    localhost: {
      chainId: 31337
    },
    hardhat: {
      chainId: 31337
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
        enabled: true,
        details: {
          yul: true
        }
      },
      viaIR: false,
      outputSelection: {
        '*': {
          '*': ['storageLayout']
        }
      }
    }
  },
  mocha: {
    timeout: 100000000
  }
};

export default config;
