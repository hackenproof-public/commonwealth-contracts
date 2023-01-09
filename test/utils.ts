import { FakeContract, smock } from '@defi-wonderland/smock';
import { Log, TransactionReceipt } from '@ethersproject/providers';
import { ContractTransaction } from 'ethers';
import { parseBytes32String } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { InvestmentFund, InvestmentFund__factory, InvestmentNFT, USDC } from '../typechain-types';
import { Fixture, FundState, GetFixtureNamedParameters, SetupResult } from './types';

export const getLogs = async (
  tx: ContractTransaction,
  contractAddress: string | undefined,
  topic: string | undefined
): Promise<Log[]> => {
  const receipt: TransactionReceipt = await ethers.provider.getTransactionReceipt(tx.hash);

  let logs: Log[] = receipt.logs;
  if (contractAddress !== undefined) {
    logs = logs.filter((log) => log.address === contractAddress);
  }
  if (topic !== undefined) {
    logs = logs.filter((log) => log.topics[0] === topic);
  }
  return logs;
};

export const createFixtureFactory = () => {
  const fixtures: Map<string, Fixture> = new Map<string, Fixture>();

  return {
    getFixture: async (params: GetFixtureNamedParameters) => {
      const key = [params.fundName, params.treasuryWallet, params.managementFee, params.cap].join(',');
      let fixture = fixtures.get(key);

      if (fixture === undefined) {
        fixture = async (): Promise<SetupResult> => {
          const usdc: FakeContract<USDC> = await smock.fake('USDC');
          const investmentNft: FakeContract<InvestmentNFT> = await smock.fake('InvestmentNFT');

          const investmentFundFactory: InvestmentFund__factory = await ethers.getContractFactory('InvestmentFund');
          const investmentFund = await investmentFundFactory.deploy(
            params.fundName!,
            usdc.address,
            investmentNft.address,
            params.treasuryWallet!,
            params.managementFee!,
            params.cap!
          );

          return { investmentFund, usdc, investmentNft };
        };
        fixtures.set(key, fixture);
      }
      return fixture;
    }
  };
};

const getAllowedStatesForTransition = (destinationState: FundState): FundState[] => {
  switch (destinationState) {
    case FundState.FundsIn:
      return [FundState.Empty];
    case FundState.CapReached:
      return [FundState.FundsIn];
    case FundState.FundsDeployed:
      return [FundState.CapReached];
    case FundState.Active:
      return [FundState.FundsDeployed];
    case FundState.Breakeven:
      return [FundState.Active];
    case FundState.Closed:
      return [FundState.Active, FundState.Breakeven];

    default:
      return [];
  }
};

export const setCurrentState = async (fundContract: InvestmentFund, state: FundState) => {
  const makeTransition = async () => {
    switch (state) {
      case FundState.FundsIn:
        await fundContract.startCollectingFunds();
        break;
      case FundState.CapReached:
        await fundContract.stopCollectingFunds();
        break;
      case FundState.FundsDeployed:
        await fundContract.deployFunds();
        break;
      case FundState.Active:
        await fundContract.activateFund();
        break;
      case FundState.FundsIn:
        await fundContract.startCollectingFunds();
        break;
      case FundState.Closed:
        await fundContract.closeFund();
        break;
      default:
        throw new Error('State does not exist');
    }
  };
  const allowedStates = getAllowedStatesForTransition(state);
  if (allowedStates.length !== 0) {
    const allowed = allowedStates[0];
    const current = <FundState>parseBytes32String(await fundContract.currentState());
    if (current !== allowed) {
      await setCurrentState(fundContract, allowed);
    }
    await makeTransition();
  }
};
