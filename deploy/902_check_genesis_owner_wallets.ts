import fs from 'fs';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getEnvByNetwork } from '../scripts/utils';
import { GenesisNFT } from '../typechain-types';

//This scrip needs to be run separetly for every tier
const checkGenesisOwnerWallets: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const genesisNFT = (await ethers.getContractAt(
    'GenesisNFT',
    '0xAE2DfbDDEF17998a638b26B38AAfD7e4625cA41A'
  )) as GenesisNFT;

  const rpc = getEnvByNetwork('RPC_URL', hre.network.name)!;
  const provider = new ethers.providers.JsonRpcProvider(rpc);

  const data: any = { owners: [] };

  let counter = 0;
  try {
    for (let i = 0; i < 1; i++) {
      let owner = await genesisNFT.ownerOf(i);
      console.log(`Owner ${owner} of token: ${i}`);

      //The staking contract
      if (owner === '0xAB14624691d0D1b62F9797368104Ef1F8C20dF83') {
        continue;
      } else {
        const code = await provider.getCode(owner);
        if (code !== '0x') {
          console.log(`Owner ${owner} of token: ${i} has code`);
          data.owners.push({ owner, token: i });
          counter++;
        }
      }
    }
  } catch (error) {
    console.log('Error', error);
  }
  console.log(counter);

  fs.writeFileSync('genesisOwnerAddressesCheck.json', JSON.stringify(data, null, 2), 'utf8');
};
export default checkGenesisOwnerWallets;
checkGenesisOwnerWallets.tags = ['checkGenesisOwnerWallets'];
