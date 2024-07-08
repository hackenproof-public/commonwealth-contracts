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
  uniswapWlthUsdcPoolAddress: string;
  poolObservationTime: number;
  uniswapSwapRouterV3Address: string;
  feeTier: string;
  wlth?: string;
  usdc?: string;
  usdt?: string;
  stakingTransactionFee: number;
  communityFundWallet: string;
  maxDiscount: number;
  periods: number[];
  coefficients: number[];
  stakingNFTRewardPerios: number;
  investmentFundTreasuryWallet: string;
  investmentFundManagementFee: number;
  nftVestingDuration: number;
  nftVestingCadence: number;
  stakingRewardsDistributionStartTimestamp: number;
  stakingRewardsLeftoversUnlockDelay: number;
  genesisNftRevenueAddress: string;
  lpPoolAddress: string;
  burnAddress: string;
  stakingRewardsAllocation: BigNumber;
  unlocker: string;
  genesisNftVestingAllocation: BigNumber;
  genesisNftVestingLeftoversUnlockDelay: number;
  genesisNftVestingStartTimestamp: number;
  defaultMinimumInvestment: BigNumber;
  pricelessFundMinimumInvestment: BigNumber;
  alphaFundMinimumInvestment: BigNumber;
  bonusStakingStartTimestamp: number;
  bonusStakingDuration: number;
  bonusStakingTotalReward: BigNumber;
  minimumBuyback: BigNumber;
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
  uniswapWlthUsdcPoolAddress: '0xC1720f91aA11f4BCDBe9e657A4850a1ab1D7d818',
  poolObservationTime: 1,
  uniswapSwapRouterV3Address: '0x18921C5bd7137eF0761909ea39FF7B6dC9A89405',
  feeTier: '3000',
  stakingTransactionFee: 100,
  communityFundWallet: '0x1B2a823B225B80a767CFA6B6c88Aff8397a57cC9',
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  investmentFundManagementFee: 1000,
  nftVestingDuration: THREE_DAYS,
  nftVestingCadence: THREE_DAYS / 24, // 50 DAYS / 100
  stakingRewardsDistributionStartTimestamp: 1699971572,
  stakingRewardsLeftoversUnlockDelay: 0,
  genesisNftRevenueAddress: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  lpPoolAddress: '0x87af795710df24a458F1D2dfbc0B961b75073BF9',
  burnAddress: '0x01C16932E9bA3bBdE28FD3Bd007E6c9B9Bbe2b56',
  stakingRewardsAllocation: parseEther('24000000'),
  unlocker: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftVestingAllocation: parseEther('24000000'),
  genesisNftVestingLeftoversUnlockDelay: 0,
  genesisNftVestingStartTimestamp: 1699971572,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('50'),
  bonusStakingStartTimestamp: 1699971572,
  bonusStakingDuration: 86400,
  bonusStakingTotalReward: parseEther('1000'),
  minimumBuyback: toUsdc('100')
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
  uniswapWlthUsdcPoolAddress: '0x543d10CE52B70534E8B48468a555647BFfF58570',
  poolObservationTime: 1,
  uniswapSwapRouterV3Address: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', //SwapRouter02
  feeTier: '500',
  stakingTransactionFee: 100,
  communityFundWallet: '0x1B2a823B225B80a767CFA6B6c88Aff8397a57cC9',
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  investmentFundManagementFee: 1000,
  nftVestingCadence: 2592000,
  nftVestingDuration: 62208000,
  stakingRewardsDistributionStartTimestamp: 1717070400,
  stakingRewardsLeftoversUnlockDelay: 604800,
  genesisNftRevenueAddress: '0x1F0c955209bf317f66562F672f71a3747D390f80',
  lpPoolAddress: '0x87af795710df24a458F1D2dfbc0B961b75073BF9',
  burnAddress: '0x01C16932E9bA3bBdE28FD3Bd007E6c9B9Bbe2b56',
  stakingRewardsAllocation: parseEther('19989036'),
  unlocker: '0xa232A34F6fbF466E54f7FB060d033B1CB53e7B63',
  genesisNftVestingAllocation: parseEther('113075416'),
  genesisNftVestingLeftoversUnlockDelay: 604800,
  genesisNftVestingStartTimestamp: 1717070400,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('20'),
  bonusStakingStartTimestamp: 1717244100,
  bonusStakingDuration: 259200,
  bonusStakingTotalReward: parseEther('63998117'),
  minimumBuyback: toUsdc('100')
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
  genesisNftRoyaltyAccount: '0xa653879692D4D0e6b6E0847ceDd58eAD2F1CC136',
  genesisNftV1TokenUri: 'ipfs://QmecFbuBURVP8fF9phJztSaaSUkPRNuhpEYsQtPRKQPxnc',
  genesisNftV2TokenUri: 'ipfs://QmdhZy5AnctWp9Rg1L4byVRNZgdkHUkodwveSG9xrv9W3R',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  wlthWallet: '0xE73e27BB167997e886060D5C6eE0ddd7B4736aC6',
  uniswapWlthUsdcPoolAddress: '', //TODO
  poolObservationTime: 1,
  uniswapSwapRouterV3Address: '0x2626664c2603336E57B271c5C0b26F421741e481',
  feeTier: '', //TODO
  stakingTransactionFee: 100,
  communityFundWallet: '0xA205fD6A798A9Ba8b107A00b8A6a5Af742d6aCb5',
  maxDiscount: 3000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 0, // Not used
  investmentFundTreasuryWallet: '0x990eCdf73704f9114Ee28710D171132b5Cfdc6f0', // RevenueWallet
  investmentFundManagementFee: 1000,
  nftVestingCadence: 2592000,
  nftVestingDuration: 62208000,
  stakingRewardsDistributionStartTimestamp: 0,
  stakingRewardsLeftoversUnlockDelay: 31536000,
  genesisNftRevenueAddress: '0x990eCdf73704f9114Ee28710D171132b5Cfdc6f0',
  lpPoolAddress: '0x9028D3620936a47D153768FfeCB490aF620C2d77',
  burnAddress: '0xa35EAc64300d551F9872A155c1F6ca48451473af', //BurnWallet
  stakingRewardsAllocation: parseEther('19989036'),
  unlocker: '0xbe7A65e6B0A252C71a666CaC8cA2e3c2D741F4aF',
  genesisNftVestingAllocation: parseEther('113075416'),
  genesisNftVestingLeftoversUnlockDelay: 31536000,
  genesisNftVestingStartTimestamp: 0,
  pricelessFundMinimumInvestment: toUsdc('50'),
  defaultMinimumInvestment: toUsdc('50'),
  alphaFundMinimumInvestment: toUsdc('20'),
  bonusStakingStartTimestamp: 1717244100,
  bonusStakingDuration: 2678400,
  bonusStakingTotalReward: parseEther('63998117'),
  minimumBuyback: toUsdc('0')
};
const baseSepoliaDevConfig: networkConfigItem = {
  ...baseSepoliaConfig,
  uniswapWlthUsdcPoolAddress: '0x543d10CE52B70534E8B48468a555647BFfF58570'
};

const baseSepoliaStageConfig: networkConfigItem = {
  ...baseSepoliaConfig
};

export const networkConfig: networkConfigInfo = {
  31337: {
    ...localConfig
  },
  84532: {
    ...baseSepoliaConfig,
    dev: { ...baseSepoliaDevConfig },
    stage: { ...baseSepoliaStageConfig }
  },

  11155111: {
    ...baseSepoliaConfig,
    dev: { ...baseSepoliaDevConfig },
    stage: { ...baseSepoliaStageConfig }
  },

  8453: {
    ...baseConfig
  }
};
