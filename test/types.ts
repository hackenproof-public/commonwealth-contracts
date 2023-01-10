import { BigNumber } from 'ethers';

export enum FundState {
  Empty = 'Empty',
  FundsIn = 'FundsIn',
  CapReached = 'CapReached',
  FundsDeployed = 'FundsDeployed',
  Active = 'Active',
  Breakeven = 'Breakeven',
  Closed = 'Closed'
}

export type InvestmentFundDeploymentParameters = {
  fundName?: string;
  treasuryAddress?: string;
  managementFee?: number;
  cap?: BigNumber;
};
