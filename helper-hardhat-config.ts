import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { toUsdc } from './test/utils';

export const developmentChains = [31337];

const SECONDS_IN_DAY = 86400;
const ONE_DAY = 1 * SECONDS_IN_DAY;
const THREE_DAYS = 3 * ONE_DAY;
const TWELVE_DAYS = 12 * ONE_DAY;
const FIFTY_DAYS = 50 * ONE_DAY;

const SECONDS_IN_WEEK = 604800;
const ONE_WEEK = 1 * SECONDS_IN_WEEK;
const TWO_WEEKS = 2 * SECONDS_IN_WEEK;
const THREE_WEEKS = 3 * SECONDS_IN_WEEK;
const FOUR_WEEKS = 4 * SECONDS_IN_WEEK;

const SECONDS_IN_YEAR = 31536000;
const ONE_YEAR = 1 * SECONDS_IN_YEAR;
const TWO_YEARS = 2 * SECONDS_IN_YEAR;
const THREE_YEARS = 3 * SECONDS_IN_YEAR;
const FOUR_YEARS = 4 * SECONDS_IN_YEAR;

export const zkNetworksIds = [280, 300, 324];
export const environments = ['dev', 'stage', 'beta'] as const;
export type environmentType = (typeof environments)[number];
interface L2ToL1item {
  [key: number]: { chainId: number; name: string };
}

export const l2Tol1: L2ToL1item = {
  300: { chainId: 11155111, name: 'sepolia' },
  280: { chainId: 5, name: 'goerli' },
  324: { chainId: 1, name: 'ethereum' }
} as const;

export const l1Tol2: L2ToL1item = {
  11155111: { chainId: 300, name: 'sepoliaZkTestnet' },
  5: { chainId: 280, name: 'zkTestnet' },
  1: { chainId: 324, name: 'zkSync' }
} as const;

export interface networkConfigItem {
  genesisNftS1Name: string;
  genesisNFTS1Symbol: string;
  genesisNftS2Name: string;
  genesisNFTS2Symbol: string;
  genesisNftV1Series: number;
  genesisNftV2Series: number;
  ownerAccount: string;
  genesisNftRoyalty: number;
  genesisNftRoyaltyAccount: string;
  genesisNftV1TokenUri: string;
  genesisNftV2TokenUri: string;
  wlthName: string;
  wlthSymbol: string;
  wlthWallet: string;
  uniswapQuaterV2Address: string;
  uniswapSwapRouterV2Address: string;
  zeroPointThreeFeeTier: string;
  wlth?: string;
  usdc?: string;
  usdt?: string;
  stakingTransactionFee: number;
  stakingTreasuryWallet: string;
  communityFundWallet: string;
  maxDiscount: number;
  periods: number[];
  coefficients: number[];
  stakingNFTRewardPerios: number;
  investmentFundTreasuryWallet: string;
  investmentFundManagementFee: number;
  nftVestingDuration: number;
  nftVestingCadence: number;
  nftVestingStartTimestamp: number;
  stakingRewardsDistributionStartTimestamp: number;
  stakingRewardsLeftoversUnlockDelay: number;
  genesisNftRevenueAddress: string;
  lpPoolAddress: string;
  burnAddress: string;
  stakingRewardsAllocation: BigNumber;
  unlocker: string;
  zkSyncGasPerPubdataLimit: number;
  genesisNftVestingAllocation: BigNumber;
  genesisNftVestingLeftoversUnlockDelay: number;
  genesisNftVestingStartTimestamp: number;
  defaultMinimumInvestment: BigNumber;
  pricelessFundMinimumInvestment: BigNumber;
  alphaFundMinimumInvestment: BigNumber;
}

export interface networkConfigItemWithDev extends networkConfigItem {
  dev?: networkConfigItem;
  stage?: networkConfigItem;
  beta?: networkConfigItem;
}

export interface networkConfigInfo {
  [key: string]: networkConfigItemWithDev;
}
//TODO define values per an environment
const localConfig: networkConfigItem = {
  genesisNftS1Name: 'Common Wealth Genesis NFT Series 1',
  genesisNFTS1Symbol: 'CWOGS1',
  genesisNftS2Name: 'Common Wealth Genesis NFT Series 2 ',
  genesisNFTS2Symbol: 'CWOGS2',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftRoyalty: 650,
  genesisNftRoyaltyAccount: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftV1TokenUri: 'ipfs://QmecFbuBURVP8fF9phJztSaaSUkPRNuhpEYsQtPRKQPxnc',
  genesisNftV2TokenUri: 'ipfs://QmdhZy5AnctWp9Rg1L4byVRNZgdkHUkodwveSG9xrv9W3R',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  wlthWallet: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  uniswapQuaterV2Address: '0xC1720f91aA11f4BCDBe9e657A4850a1ab1D7d818',
  uniswapSwapRouterV2Address: '0x18921C5bd7137eF0761909ea39FF7B6dC9A89405',
  zeroPointThreeFeeTier: '3000',
  stakingTransactionFee: 100,
  stakingTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  communityFundWallet: '0x1B2a823B225B80a767CFA6B6c88Aff8397a57cC9',
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  investmentFundManagementFee: 1000,
  nftVestingDuration: THREE_DAYS,
  nftVestingCadence: THREE_DAYS / 24, // 50 DAYS / 100
  nftVestingStartTimestamp: 1699971572,
  stakingRewardsDistributionStartTimestamp: 1699971572,
  stakingRewardsLeftoversUnlockDelay: 0,
  genesisNftRevenueAddress: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  lpPoolAddress: '0x87af795710df24a458F1D2dfbc0B961b75073BF9',
  burnAddress: '0x01C16932E9bA3bBdE28FD3Bd007E6c9B9Bbe2b56',
  stakingRewardsAllocation: parseEther('24000000'),
  unlocker: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  zkSyncGasPerPubdataLimit: 800,
  genesisNftVestingAllocation: parseEther('24000000'),
  genesisNftVestingLeftoversUnlockDelay: 0,
  genesisNftVestingStartTimestamp: 1699971572,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('50')
};

const goerliConfig: networkConfigItem = {
  genesisNftS1Name: 'Common Wealth Genesis NFT Series 1',
  genesisNFTS1Symbol: 'CWOGS1',
  genesisNftS2Name: 'Common Wealth Genesis NFT Series 2 ',
  genesisNFTS2Symbol: 'CWOGS2',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0x', //TODO define the address
  genesisNftRoyalty: 650,
  genesisNftRoyaltyAccount: '', //TODO define the address
  genesisNftV1TokenUri: 'ipfs://Qmc1EkoCMy3mzNqeLVddCwPw9CYmwfr2KQxkyWnDdVCRYk',
  genesisNftV2TokenUri: 'ipfs://QmdhZy5AnctWp9Rg1L4byVRNZgdkHUkodwveSG9xrv9W3R',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  wlthWallet: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  uniswapQuaterV2Address: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  uniswapSwapRouterV2Address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  zeroPointThreeFeeTier: '3000',
  stakingTransactionFee: 200,
  stakingTreasuryWallet: '0x', //TODO define the address
  communityFundWallet: '0x',
  maxDiscount: 4000,
  periods: [ONE_WEEK, TWO_WEEKS, THREE_WEEKS, FOUR_WEEKS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x', //TODO define the address
  investmentFundManagementFee: 1000,
  nftVestingDuration: 1,
  nftVestingCadence: 1,
  nftVestingStartTimestamp: 1,
  stakingRewardsDistributionStartTimestamp: 1699971572,
  stakingRewardsLeftoversUnlockDelay: 0,
  genesisNftRevenueAddress: '0x',
  lpPoolAddress: '0x',
  burnAddress: '0x',
  stakingRewardsAllocation: parseEther('24000000'),
  unlocker: '0x',
  zkSyncGasPerPubdataLimit: 800,
  genesisNftVestingAllocation: parseEther('24000000'),
  genesisNftVestingLeftoversUnlockDelay: 0,
  genesisNftVestingStartTimestamp: 1700049600,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('50')

};

const zkSyncTestnet: networkConfigItem = {
  genesisNftS1Name: 'Common Wealth Genesis NFT Series 1',
  genesisNFTS1Symbol: 'CWOGS1',
  genesisNftS2Name: 'Common Wealth Genesis NFT Series 2 ',
  genesisNFTS2Symbol: 'CWOGS2',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftRoyalty: 650,
  genesisNftRoyaltyAccount: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftV1TokenUri: 'ipfs://QmecFbuBURVP8fF9phJztSaaSUkPRNuhpEYsQtPRKQPxnc',
  genesisNftV2TokenUri: 'ipfs://QmdhZy5AnctWp9Rg1L4byVRNZgdkHUkodwveSG9xrv9W3R',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  wlthWallet: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  uniswapQuaterV2Address: '0xC1720f91aA11f4BCDBe9e657A4850a1ab1D7d818',
  uniswapSwapRouterV2Address: '0x18921C5bd7137eF0761909ea39FF7B6dC9A89405',
  zeroPointThreeFeeTier: '3000',
  stakingTransactionFee: 100,
  stakingTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  communityFundWallet: '0x1B2a823B225B80a767CFA6B6c88Aff8397a57cC9',
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  investmentFundManagementFee: 1000,
  nftVestingCadence: FIFTY_DAYS / 100,
  nftVestingDuration: FIFTY_DAYS,
  nftVestingStartTimestamp: 1711324800,
  stakingRewardsDistributionStartTimestamp: 1711324800,
  stakingRewardsLeftoversUnlockDelay: 604800,
  genesisNftRevenueAddress: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  lpPoolAddress: '0x87af795710df24a458F1D2dfbc0B961b75073BF9',
  burnAddress: '0x01C16932E9bA3bBdE28FD3Bd007E6c9B9Bbe2b56',
  stakingRewardsAllocation: parseEther('24000000'),
  unlocker: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  zkSyncGasPerPubdataLimit: 800,
  genesisNftVestingAllocation: parseEther('24000000'),
  genesisNftVestingLeftoversUnlockDelay: 604800,
  genesisNftVestingStartTimestamp: 1711411200,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('50')

};

const zkTestnetDevConfig: networkConfigItem = {
  ...zkSyncTestnet
};

const zkTestnetStageConfig: networkConfigItem = {
  ...zkSyncTestnet,
  uniswapQuaterV2Address: '0x0a1c2C1794A32FfD51Fd3f983C936B695539c47C',
  uniswapSwapRouterV2Address: '0x7f1c5573D44FA5F8B128a2f2a13A0dF29fcafd15',
  stakingTreasuryWallet: '0xD5Ae6D3Bc8e778aC4Da0e5219CB0341DfC69cfce',
  communityFundWallet: '0xC5B32F534fa3586bC3e200d1bE104b92d0B38e3E',
  investmentFundTreasuryWallet: '0xD5Ae6D3Bc8e778aC4Da0e5219CB0341DfC69cfce',
  genesisNftRevenueAddress: '0xD5Ae6D3Bc8e778aC4Da0e5219CB0341DfC69cfce',
  lpPoolAddress: '0x09ca397106b9519c8F98bE6d106813D82562b58e',
  burnAddress: '0xd969736e88De00F2e8c964d23659674e2c58F6b4'
};

const sepoliaZkTestnetDevConfig: networkConfigItem = {
  ...zkSyncTestnet,
  uniswapQuaterV2Address: '0x36dE03984CB77473A5d2DC2C3F4c6aB8191dA486',
  uniswapSwapRouterV2Address: '0xE48E42b938ED8F47046Aa7E8085A054c8d45A990'
};

const sepoliaZkTestnetStageConfig: networkConfigItem = {
  ...zkSyncTestnet,
  uniswapQuaterV2Address: '0x36dE03984CB77473A5d2DC2C3F4c6aB8191dA486',
  uniswapSwapRouterV2Address: '0xE48E42b938ED8F47046Aa7E8085A054c8d45A990',
  stakingTreasuryWallet: '0xD5Ae6D3Bc8e778aC4Da0e5219CB0341DfC69cfce',
  communityFundWallet: '0xC5B32F534fa3586bC3e200d1bE104b92d0B38e3E',
  investmentFundTreasuryWallet: '0xD5Ae6D3Bc8e778aC4Da0e5219CB0341DfC69cfce',
  genesisNftRevenueAddress: '0xD5Ae6D3Bc8e778aC4Da0e5219CB0341DfC69cfce',
  lpPoolAddress: '0x09ca397106b9519c8F98bE6d106813D82562b58e',
  burnAddress: '0xd969736e88De00F2e8c964d23659674e2c58F6b4'
};

const baseSepoliaConfig: networkConfigItem = {
  genesisNftS1Name: 'Common Wealth Genesis NFT Series 1',
  genesisNFTS1Symbol: 'CWOGS1',
  genesisNftS2Name: 'Common Wealth Genesis NFT Series 2 ',
  genesisNFTS2Symbol: 'CWOGS2',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftRoyalty: 650,
  genesisNftRoyaltyAccount: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftV1TokenUri: 'ipfs://QmecFbuBURVP8fF9phJztSaaSUkPRNuhpEYsQtPRKQPxnc',
  genesisNftV2TokenUri: 'ipfs://QmdhZy5AnctWp9Rg1L4byVRNZgdkHUkodwveSG9xrv9W3R',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  wlthWallet: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  uniswapQuaterV2Address: '0xe49E4Eb94646ae12287DA0deaA8C2009BE3B2F71',
  uniswapSwapRouterV2Address: '0x405B79393225fdc5E41628d7787E18E5EEA54A1C',
  zeroPointThreeFeeTier: '3000',
  stakingTransactionFee: 100,
  stakingTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  communityFundWallet: '0x1B2a823B225B80a767CFA6B6c88Aff8397a57cC9',
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  investmentFundManagementFee: 1000,
  nftVestingCadence: (ONE_DAY * 5) / 120,
  nftVestingDuration: ONE_DAY * 5,
  nftVestingStartTimestamp: 1711324800,
  stakingRewardsDistributionStartTimestamp: 1713508866,
  stakingRewardsLeftoversUnlockDelay: 604800,
  genesisNftRevenueAddress: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  lpPoolAddress: '0x87af795710df24a458F1D2dfbc0B961b75073BF9',
  burnAddress: '0x01C16932E9bA3bBdE28FD3Bd007E6c9B9Bbe2b56',
  stakingRewardsAllocation: parseEther('24000000'),
  unlocker: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  zkSyncGasPerPubdataLimit: 800,
  genesisNftVestingAllocation: parseEther('24000000'),
  genesisNftVestingLeftoversUnlockDelay: 604800,
  genesisNftVestingStartTimestamp: 1713343202,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('50')

};

const baseConfig: networkConfigItem = {
  genesisNftS1Name: 'Common Wealth Genesis NFT Series 1',
  genesisNFTS1Symbol: 'CWOGS1',
  genesisNftS2Name: 'Common Wealth Genesis NFT Series 2 ',
  genesisNFTS2Symbol: 'CWOGS2',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0xbe7A65e6B0A252C71a666CaC8cA2e3c2D741F4aF',
  genesisNftRoyalty: 650,
  genesisNftRoyaltyAccount: '', //TODO
  genesisNftV1TokenUri: 'ipfs://QmecFbuBURVP8fF9phJztSaaSUkPRNuhpEYsQtPRKQPxnc',
  genesisNftV2TokenUri: 'ipfs://QmdhZy5AnctWp9Rg1L4byVRNZgdkHUkodwveSG9xrv9W3R',
  wlthName: '', //TODO
  wlthSymbol: '', //TODO
  wlthWallet: '', //TODO
  uniswapQuaterV2Address: '', //Not used
  uniswapSwapRouterV2Address: '0x2626664c2603336E57B271c5C0b26F421741e481',
  zeroPointThreeFeeTier: '', //TODO
  stakingTransactionFee: 100,
  stakingTreasuryWallet: '',
  communityFundWallet: '', //TODO
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 0, // Not used
  investmentFundTreasuryWallet: '', //TODO
  investmentFundManagementFee: 1000,
  nftVestingCadence: 0, //TODO
  nftVestingDuration: 0, //TODO,
  nftVestingStartTimestamp: 0, //TODO
  stakingRewardsDistributionStartTimestamp: 0, //TODO
  stakingRewardsLeftoversUnlockDelay: 0, //TODO
  genesisNftRevenueAddress: '', //TODO
  lpPoolAddress: '', //TODO
  burnAddress: '', //TODO
  stakingRewardsAllocation: parseEther('0'), //TODO
  unlocker: '', //TODO
  zkSyncGasPerPubdataLimit: 0, //Not used
  genesisNftVestingAllocation: parseEther('0'), //TODO
  genesisNftVestingLeftoversUnlockDelay: 0, //TODO
  genesisNftVestingStartTimestamp: 0, //TODO,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('50')

};
const baseSepoliaDevConfig: networkConfigItem = {
  ...baseSepoliaConfig
};

const baseSepoliaStageConfig: networkConfigItem = {
  ...baseSepoliaConfig
};

export const networkConfig: networkConfigInfo = {
  31337: {
    ...localConfig
  },
  11155111: {
    ...localConfig,
    dev: { ...sepoliaZkTestnetDevConfig },
    stage: { ...sepoliaZkTestnetStageConfig }
  },
  5: {
    ...localConfig,
    dev: { ...zkTestnetDevConfig },
    stage: { ...zkTestnetStageConfig },
    beta: { ...zkSyncTestnet }
  },
  280: {
    ...zkSyncTestnet,
    dev: { ...zkTestnetDevConfig },
    stage: { ...zkTestnetStageConfig }
  },
  300: {
    ...zkSyncTestnet,
    dev: { ...sepoliaZkTestnetDevConfig },
    stage: { ...sepoliaZkTestnetStageConfig }
  },

  245022926: {
    ...zkSyncTestnet,
    dev: { ...sepoliaZkTestnetDevConfig },
    stage: { ...sepoliaZkTestnetStageConfig }
  },

  84532: {
    ...baseSepoliaConfig,
    dev: { ...baseSepoliaDevConfig },
    stage: { ...baseSepoliaStageConfig }
  },

  8453: {
    ...baseConfig
  }
};
