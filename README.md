## Audit scope

### Contracts list

-   FreeFund.sol
-   GenesisNFTLock.sol
-   GenesisNFTmirror.sol
-   InvestmentFund.sol
-   StakingGenesisNFT.sol
-   StakingWlth.sol
-   Wlth.sol
-   GenesisNFTVesting.sol
-   SimpleVesting.sol
-   StakingGenesisNFTVesting.sol
-   WhitelistedVesting.sol

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

### Smart Contract code coverage

In order to check the code coverage, please rune the commend:

```bash
npm run coverage
```
