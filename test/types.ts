import { BigNumber } from 'ethers';

export enum FundState {
  FundsIn = 'FundsIn',
  CapReached = 'CapReached',
  FundsDeployed = 'FundsDeployed',
  Closed = 'Closed'
}

export enum CrowdsalePhase {
  Whitelisted = 0,
  Public,
  Inactive
}

export type InvestmentFundDeploymentParameters = {
  fundName?: string;
  treasuryWallet?: string;
  managementFee?: number;
  cap?: BigNumber;
};

export type Tranche = {
  supply: string;
  price: BigNumber;
  accounts?: string[];
  maxContributions?: number[];
};
