module.exports = {
  skipFiles: [
    'test',
    'migration',
    'mock',
    'Crowdsale.sol',
    'GenesisNFT.sol',
    'GenesisNFTV1.sol',
    'GenesisNFTV2.sol',
    'InvestmentFundRegistry.sol',
    'InvestmentNFT.sol',
    'OwnablePausable.sol',
    'PeriodicVesting.sol',
    'Project.sol',
    'StateMachine.sol',
    'UniswapQuoter.sol',
    'UniswapSwapper.sol',
    'interfaces',
    'libraries',
    'StakingGenesisNFT.sol',
    'Wlth.sol',
    'GenesisNFTLock.sol',
    'GenesisNFTmirror.sol',
    'StakingWlth.sol',
    'FreeFund.sol',
    'InvestmentFund.sol'
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
