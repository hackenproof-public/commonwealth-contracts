import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { deployProxy } from '../../scripts/utils';
import { Wlth } from '../../typechain-types';
import { BURNER_ROLE, DEFAULT_ADMIN_ROLE } from '../constants';
import { missing_role, toWlth } from '../utils';

describe('Common Wealth Token unit tests', () => {
  const initialTokenAmount = toWlth('1000000000');
  const name = 'Common Wealth Token';
  const symbol = 'WLTH';

  const setup = async () => {
    const [deployer, admin, burner, user] = await ethers.getSigners();

    const wlth: Wlth = await deployProxy('Wlth', [name, symbol, admin.address], deployer);
    await wlth.connect(admin).grantRole(BURNER_ROLE, burner.address);
    await wlth.connect(deployer).transfer(admin.address, toWlth('1000000'));
    await wlth.connect(deployer).transfer(burner.address, toWlth('1000000'));
    await wlth.connect(deployer).transfer(user.address, toWlth('1000000'));

    return { wlth, deployer, admin, user, burner };
  };

  describe('Deployment', () => {
    it('Should return initial parameters', async () => {
      const [deployer, admin] = await ethers.getSigners();

      const wlth: Wlth = await deployProxy('Wlth', [name, symbol, admin.address], deployer);

      expect(await wlth.name()).to.equal(name);
      expect(await wlth.symbol()).to.equal(symbol);
      expect(await wlth.totalSupply()).to.equal(initialTokenAmount);
      expect(await wlth.balanceOf(deployer.address)).to.equal(initialTokenAmount);
      expect(await wlth.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });
  });

  describe('#burn', () => {
    it('Should burn owned tokens if burner', async () => {
      const { wlth, burner, deployer } = await loadFixture(setup);
      const toBurn = 300;
      const balance = await wlth.balanceOf(burner.address);

      await expect(wlth.connect(burner).burn(toBurn))
        .to.emit(wlth, 'Transfer')
        .withArgs(burner.address, constants.AddressZero, toBurn);

      expect(await wlth.balanceOf(burner.address)).to.equal(balance.sub(toBurn));
    });

    it('Should revert burning tokens if not burner', async () => {
      const { wlth, deployer } = await loadFixture(setup);

      await expect(wlth.connect(deployer).burn(300)).to.be.revertedWith(missing_role(deployer.address, BURNER_ROLE));
    });
  });
});
