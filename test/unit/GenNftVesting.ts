import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deploy } from '../../scripts/utils';
import { GenesisNFTVesting } from '../../typechain-types';

describe('Genesis NFT Vesting unit tests', function () {
  const deployFixture = async () => {
    const TWENTY_FOUR_BILIONS = 24000000;
    const SECONDS_IN_YEAR = 31536000;
    const TWO_YEARS = 2 * SECONDS_IN_YEAR;
    const ONE_MONTH = SECONDS_IN_YEAR / 12;
    const ONE_SECOND = 1000;
    const ONE_TOKEN = (1 * 10) ^ 18;
    const vestingStartTimestamp = Math.floor(Date.now() / 1000) + ONE_MONTH;
    const allocation = (TWENTY_FOUR_BILIONS * 10) ^ 18;
    const cadence = ONE_MONTH;
    const duration = TWO_YEARS;

    const wlth = '0x34ac60166247079687a2D69A526768438F3e66cC';
    const stakingGenNFT = '0x6f633eD4d3fb3D433BD14Fb776D2c4Ba23308A13';
    const genNFTseries1 = '0x3A029Bf68636f82b56FBAD2670bC7E70e2E547C4';
    const genNFTseries2 = '0x2D1B22DF4dA028A72009ae4f5d73fe25D1F4F845';
    // const addressList = { stakingGenNFT, genNftSeries2Contract: genNFTseries1, stakingGenNftContract: genNFTseries2 };
    const bonusTokenIds = [1, 3, 5, 6];
    const [deployer, owner] = await ethers.getSigners();

    const genesisNFTVesting: GenesisNFTVesting = await deploy(
      'GenesisNFTVesting',
      [owner.address, wlth, duration, cadence, vestingStartTimestamp, genNFTseries1, genNFTseries2, stakingGenNFT],
      deployer
    );

    return { genesisNFTVesting, deployer, owner };
  };

  describe('Deployment', function () {
    it('Should deploy', async () => {
      const { genesisNFTVesting, owner } = await loadFixture(deployFixture);

      expect(await genesisNFTVesting.owner()).to.equal(owner.address);
    });
  });

  describe('Bonus logic', function () {
    it('Should setup list of tokens affected by bonus', async () => {
      const { genesisNFTVesting, owner } = await loadFixture(deployFixture);

      expect(await genesisNFTVesting.connect(owner).bonusSetup([1, 12, 3, 5, 6, 63, 28]));
    });
  });
});
