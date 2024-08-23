module.exports = {
  skipFiles: [
    'test',
    'migration',
    'mock',
    'tge',
    'interfaces',
    'libraries',
    'Crowdsale.sol',
    'FreeFund.sol',
    'GenesisNFT.sol',
    'GenesisNFTLock.sol',
    'GenesisNFTmirror.sol',
    'InvestmentFund.sol',
    'InvestmentFundRegistry.sol',
    'InvestmentNFT.sol',
    'OwnablePausable.sol',
    'PeriodicVesting.sol',
    'Project.sol',
    'StakingGenesisNFT.sol',
    'StakingWlth.sol',
    'StateMachine.sol',
    'Wlth.sol'
  ],
  optimizer: {
    configureYulOptimizer: true,
    solcOptimizerDetails: {
      peephole: false,
      inliner: false,
      jumpdestRemover: false,
      orderLiterals: true, // <-- TRUE! Stack too deep when false
      deduplicate: false,
      cse: false,
      constantOptimizer: false,
      yul: false
    }
  }
};
