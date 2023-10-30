export const developmentChains = [31337];

const SECONDS_IN_YEAR = 31536000;
const ONE_YEAR = 1 * SECONDS_IN_YEAR;
const TWO_YEARS = 2 * SECONDS_IN_YEAR;
const THREE_YEARS = 3 * SECONDS_IN_YEAR;
const FOUR_YEARS = 4 * SECONDS_IN_YEAR;

export const zkNetworksIds = [280, 324];
export const environments = ['dev', 'stage', 'beta'] as const;
export type environmentType = (typeof environments)[number];

export interface networkConfigItem {
  genesisNftName: string;
  genesisNFTSymbol: string;
  genesisNftV1Series: number;
  genesisNftV2Series: number;
  ownerAccount: string;
  genesisNftRoyalty: number;
  genesisNftRoyaltyAccount: string;
  genesisNftV1TokenUri: string;
  genesisNftV2TokenUri: string;
  wlthName: string;
  wlthSymbol: string;
  uniswapQuaterV2Address: string;
  uniswapSwapRouterV2Address: string;
  zeroPointThreeFeeTier: string;
  wlth?: string;
  usdc?: string;
  usdt?: string;
  stakingTransactionFee: number;
  stakingTreasuryWallet: string;
  maxDiscount: number;
  periods: number[];
  coefficients: number[];
  stakingNFTRewardPerios: number;
  investmentFundTreasuryWallet: string;
  investmentFundManagementFee: number;
  nftVestingDuration: number;
  nftVestingCadence: number;
  nftVestingStartTimestamp: number;
  genesisNftRevenueAddress: string;
  lpPoolAddress: string;
  burnAddress: string;
  genesisNftStakingAllocation: number
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
  genesisNftName: 'Common Wealth Genesis NFT',
  genesisNFTSymbol: 'CWOGNFT',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  genesisNftRoyalty: 1000,
  genesisNftRoyaltyAccount: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  genesisNftV1TokenUri: 'ipfs://Qmc1EkoCMy3mzNqeLVddCwPw9CYmwfr2KQxkyWnDdVCRYk',
  genesisNftV2TokenUri: 'ipfs://Qmc1EkoCMy3mzNqeLVddCwPw9CYmwfr2KQxkyWnDdVCRYk',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  uniswapQuaterV2Address: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  uniswapSwapRouterV2Address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  zeroPointThreeFeeTier: '3000',
  stakingTransactionFee: 200,
  stakingTreasuryWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  maxDiscount: 4000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  investmentFundManagementFee: 1000,
  nftVestingDuration: 1,
  nftVestingCadence: 1,
  nftVestingStartTimestamp: 1,
  genesisNftRevenueAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  lpPoolAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  burnAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  genesisNftStakingAllocation: 24000000
};

const goerliConfig: networkConfigItem = {
  genesisNftName: 'Common Wealth Genesis NFT',
  genesisNFTSymbol: 'CWOGNFT',
  genesisNftV1Series: 1,
  genesisNftV2Series: 2,
  ownerAccount: '0x', //TODO define the address
  genesisNftRoyalty: 1000,
  genesisNftRoyaltyAccount: '', //TODO define the address
  genesisNftV1TokenUri: 'ipfs://Qmc1EkoCMy3mzNqeLVddCwPw9CYmwfr2KQxkyWnDdVCRYk',
  genesisNftV2TokenUri: 'ipfs://Qmc1EkoCMy3mzNqeLVddCwPw9CYmwfr2KQxkyWnDdVCRYk',
  wlthName: 'Common Wealth Token',
  wlthSymbol: 'WLTH',
  uniswapQuaterV2Address: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  uniswapSwapRouterV2Address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  zeroPointThreeFeeTier: '3000',
  stakingTransactionFee: 200,
  stakingTreasuryWallet: '0x', //TODO define the address
  maxDiscount: 4000,
  periods: [ONE_YEAR, TWO_YEARS, THREE_YEARS, FOUR_YEARS],
  coefficients: [5000, 3750, 3125, 2500],
  stakingNFTRewardPerios: 86400,
  investmentFundTreasuryWallet: '0x', //TODO define the address
  investmentFundManagementFee: 1000,
  nftVestingDuration: 1,
  nftVestingCadence: 1,
  nftVestingStartTimestamp: 1,
  genesisNftRevenueAddress: "0x",
  lpPoolAddress: "0x",
  burnAddress: "0x",
  genesisNftStakingAllocation: 24000000
};

const devConfig: networkConfigItem = {
  ...goerliConfig
};

const stageConfig: networkConfigItem = {
  ...goerliConfig
};

const betaConfig: networkConfigItem = {
  ...localConfig
};

export const networkConfig: networkConfigInfo = {
  31337: {
    ...localConfig
  },
  5: {
    ...localConfig,
    dev: { ...devConfig },
    stage: { ...stageConfig },
    beta: { ...betaConfig }
  },
  280: {
    ...localConfig
  }
};
