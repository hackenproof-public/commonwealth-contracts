import '@matterlabs/hardhat-zksync-deploy';
import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-verify';
import '@matterlabs/hardhat-zksync-upgradable';
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
    apiKey: env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org/"
        }
      }
    ]
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

    zkSync: {
      url: env.ZKSYNC_RPC_URL || '',
      ethNetwork: env.ETHEREUM_RPC_URL || '',
      zksync: true,
      chainId: 324,
      gas: 21000000,
      accounts: !!env.ZKSYNC_WALLET_PRIVATE_KEY ? [env.ZKSYNC_WALLET_PRIVATE_KEY] : [],
      verifyURL: env.ZKSYNC_VERIFY_URL || ''
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

    sepoliaZkTestnet: {
      url: env.SEPOLIAZKTESTNET_RPC_URL || '',
      ethNetwork: env.SEPOLIA_RPC_URL || '',
      zksync: true,
      chainId: 300,
      gas: 21000000,
      accounts: !!env.SEPOLIAZKTESTNET_WALLET_PRIVATE_KEY ? [env.SEPOLIAZKTESTNET_WALLET_PRIVATE_KEY] : [],
      verifyURL: env.SEPOLIAZKTESTNET_VERIFY_URL || ''
    },

    zkTestnet: {
      url: env.ZKTESTNET_RPC_URL || '',
      ethNetwork: env.ETHEREUM_RPC_URL || '',
      zksync: true,
      chainId: 280,
      gas: 21000000,
      accounts: !!env.ZKTESTNET_WALLET_PRIVATE_KEY ? [env.ZKTESTNET_WALLET_PRIVATE_KEY] : [],
      verifyURL: env.ZKTESTNET_VERIFY_URL || ''
    },
    baseSepolia: {
      url: env.BASESEPOLIA_RPC_URL || '',
      chainId: 84532,
      accounts: !!env.BASESEPOLIA_WALLET_PRIVATE_KEY ? [env.BASESEPOLIA_WALLET_PRIVATE_KEY] : [],
    },
    base: {
      url: env.BASE_RPC_URL || '',
      chainId: 8453,
      accounts: !!env.BASE_WALLET_PRIVATE_KEY ? [env.BASE_WALLET_PRIVATE_KEY] : [],
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
  zksolc: {
    version: '1.3.23',
    settings: {}
  },
  mocha: {
    timeout: 100000000
  }
};

export default config;