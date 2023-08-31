import { HardhatUserConfig } from 'hardhat/config';

import '@matterlabs/hardhat-zksync-deploy';
import '@matterlabs/hardhat-zksync-solc';

import '@matterlabs/hardhat-zksync-verify';

// dynamically changes endpoints for local tests
const zkSyncTestnet =
  process.env.NODE_ENV == 'test'
    ? {
        url: 'http://localhost:3050',
        ethNetwork: 'http://localhost:8545',
        zksync: true
      }
    : {
        url: 'https://zksync2-testnet.zksync.dev',
        ethNetwork: 'goerli',
        zksync: true,
        // contract verification endpoint
        verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification'
      };

const config: HardhatUserConfig = {
  zksolc: {
    version: 'latest',
    settings: {}
  },
  defaultNetwork: 'zkSyncTestnet',
  networks: {
    hardhat: {
      zksync: false
    },
    zkSyncTestnet: {
      url: 'https://testnet.era.zksync.dev', // The mainnet RPC URL of zkSync Era network.
      ethNetwork: 'goerli', // The Ethereum Web3 RPC URL, or the identifier of the network (e.g. `mainnet` or `goerli`)
      zksync: true
    },
    zkSyncMainnet: {
      url: 'https://mainnet.era.zksync.dev', // The testnet RPC URL of zkSync Era network.
      ethNetwork: 'mainnet', // The Ethereum Web3 RPC URL, or the identifier of the network (e.g. `mainnet` or `goerli`)
      zksync: true
    }
  },
  solidity: {
    version: '0.8.18'
  }
};

export default config;
