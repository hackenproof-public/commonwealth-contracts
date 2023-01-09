import { FakeContract, MockContract } from '@defi-wonderland/smock';
import { BigNumber, Contract } from 'ethers';
import { InvestmentFund, InvestmentNFT, USDC } from '../typechain-types';

export enum FundState {
  Empty = 'Empty',
  FundsIn = 'FundsIn',
  CapReached = 'CapReached',
  FundsDeployed = 'FundsDeployed',
  Active = 'Active',
  Breakeven = 'Breakeven',
  Closed = 'Closed'
}

export type SetupNamedParameters = {
  fundName?: string;
  managementFee?: number;
  cap?: BigNumber;
};

export type GetFixtureNamedParameters = {
  fundName?: string;
  treasuryWallet?: string;
  managementFee?: number;
  cap?: BigNumber;
};

export type SetupResult = {
  investmentFund: InvestmentFund;
  usdc: FakeContract<USDC>;
  investmentNft: FakeContract<InvestmentNFT>;
};

export type Fixture = () => Promise<SetupResult>;
