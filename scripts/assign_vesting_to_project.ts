import { ethers } from 'hardhat';

async function main() {
  const projectAddress = '0x47CE036452bf2c7499AACc9B62640F8ba846AEAC';
  const vestingAddress = '0xD151EaaE6D3df219052b75a35689C08fCAEbE08B';

  const project = await ethers.getContractAt('Project', projectAddress);

  await project.setVesting(vestingAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
