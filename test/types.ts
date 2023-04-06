import { BigNumber } from 'ethers';

export enum FundState {
  FundsIn = 'FundsIn',
  CapReached = 'CapReached',
  FundsDeployed = 'FundsDeployed',
  Closed = 'Closed'
}

export type InvestmentFundDeploymentParameters = {
  fundName?: string;
  treasuryAddress?: string;
  managementFee?: number;
  cap?: BigNumber;
};

export type Tranche = {
  supply: string;
  price: BigNumber;
  accounts?: string[];
  maxContributions?: number[];
};
