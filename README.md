# commonwealth-contracts
This repository contains Common Wealth platform smart contracts, testing and deployment scripts. It includes actual smart contract description along with actual deployment addresses. Based on Hardhat development environment, backed by slither, linter, prettier tooling. It is recommended to use yarn for executing commands due to package.json definitions.

# Installation Instructions
### Install dependencies
To install necessary dependencies use the following command:
```bash
npm i
```
### Compiling Smart Contracts
In order to download proper compiler and compile run command below:
```bash
npx hardhat compile
```
To perform code analysis execute command:
```bash
yarn static-analyze
```

### Testing Smart Contracts
There are unit, component and integration tests included for Common Wealth smart contracts. You can run all tests at once by running the following command:
```bash
yarn test
```
It is also recommended to check and fix the code formatting using prettier:
```bash
yarn check-style
```
For complete code validation use this command:
```bash
yarn validate-all
```

### Deploying Smart Contracts
In order to deploy smart contracts, you need to provide proper network configuration. This repository contains configured Ethereum mainnet along with Goerli and Sepolia testnets. It is recommended to use .env configuration as a credentials holder.
```bash
npx hardhat compile
```
You can also run deployment scripts (in progress). Example command:
```bash
npx hardhat run --network goerli scripts/deploy_crowdsale.ts
```
# Smart Contracts Description

### InvestmentFundRegistry

- works as registry for investment fund contracts
- enables funds management (add, list, remove).

### InvestmentFund

- aggregates projects, enables adding, listing and removing ones
- stores InvestmentFund as composition (one fund - one investment NFT)
- handles USDC investments
- enables profit withdrawal
- receives profits from projects and calculates proper fees

### InvestmentNFT

- manages investment NFTs
- returns investment value in any block number

More information can be found here:
https://www.notion.so/common-wealth/InvestmentNFT-964c9a19aeb3437ca9421d57d101633b

### StakingWlth

- stake WTLH tokens for fees discount 
- checks actual WLTH/USDC rates
- lists investment funds available for staking WLTH
- calculates carry fee discount for user in particular timestamp

More information can be found here:
https://www.notion.so/common-wealth/WLTH-token-f9b0bc7d3e464b91b73674d906e635ce

### Project

- manages the proces of deploying funds to projects and collecting profits from their tokens
- stores project vesting contract, describing project token vesting schedule

More information can be found here:
https://www.notion.so/common-wealth/Smart-contracts-implementation-d09a39ad2e70459c85b10ef88b15281f

### PeriodicVesting

- describes vesting schedule, configurable for vesting periods
- based on block numbers instead of timestamp
- contract is excemplary, perhaps projects will deliver their own contracts with schedule

### Wlth

- main Common Wealth token, implemented as simple ERC20 standard
- will be changed to track transfers (will be necessary for governance purpose after migrating DAO to chain)

### GenesisNFT

- manages Genesis NFTs generated during fundraising

# Deployed smart contracts

Here is a list of the most actual deployed and verified smart contracts. ABIs are available in etherscan ‘Contract’ tab in ‘Contract ABI’ section on the bottom. List of actual smart contracts's addresses can be found at the link below:
https://www.notion.so/common-wealth/Deployed-smart-contracts-6ea587338d214e169207c6899f2fbfeb
