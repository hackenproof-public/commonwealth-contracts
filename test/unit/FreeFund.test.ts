// import { FundState, InvestmentFundDeploymentParameters } from '../types';
// import { getInterfaceId, toUsdc } from '../utils';
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { Contract, ContractFactory } from "ethers";

// describe("FreeFund2", function () {
//   let FreeFund2Factory: ContractFactory;
//   let freeFund2: Contract;
//   let owner: string;

//   beforeEach(async function () {
//     [owner] = await ethers.getSigners();
//     FreeFund2Factory = await ethers.getContractFactory("FreeFund2");
//     freeFund2 = await FreeFund2Factory.deploy();
//     await freeFund2.deployed();
//   });

//   it("should set initial state correctly", async function () {
//     expect(await freeFund2.owner()).to.equal(owner.address);
//   });

//   it("should initialize contract correctly", async function () {
//     // Initialize parameters
//     const unlocker = "0x0000000000000000000000000000000000000001";
//     const name = "My Fund";
//     const currency = "0x0000000000000000000000000000000000000002";
//     const investmentNft = "0x0000000000000000000000000000000000000003";
//     const stakingWlth = "0x0000000000000000000000000000000000000004";
//     const feeDistributionAddresses = [owner.address];
//     const cap = ethers.utils.parseEther("100");

//     // Call initialize function
//     await freeFund2.initialize(
//       owner.address,
//       unlocker,
//       name,
//       currency,
//       investmentNft,
//       stakingWlth,
//       feeDistributionAddresses,
//       cap
//     );

//     // Check initialized values
//     expect(await freeFund2.name()).to.equal(name);
//     expect(await freeFund2.currency()).to.equal(currency);
//     expect(await freeFund2.cap()).to.equal(cap);
//   });

//   it("should set user allocation correctly", async function () {
//     // Set allocation
//     const user = "0x0000000000000000000000000000000000000005";
//     const amount = ethers.utils.parseEther("10");
//     await freeFund2.setToAmountMapping([user], [amount]);

//     // Check allocation
//     expect(await freeFund2.s_amountMapping(user)).to.equal(amount);
//   });

//   it("should invest for allowed user", async function () {
//     // Set allocation
//     const user = "0x0000000000000000000000000000000000000006";
//     const amount = ethers.utils.parseEther("10");
//     await freeFund2.setToAmountMapping([user], [amount]);

//     // Invest
//     const tokenUri = "http://example.com";
//     await expect(freeFund2.connect(ethers.provider.getSigner(user)).invest(amount, tokenUri)).to.not.be.reverted;

//     // Check investment
//     const investmentNft = await ethers.getContractAt("IInvestmentNFT", await freeFund2.investmentNft());
//     const totalInvestment = await investmentNft.getTotalInvestmentValue();
//     expect(totalInvestment).to.equal(amount);
//   });

//   it("should revert investment for user with zero allocation", async function () {
//     // Attempt to invest with zero allocation
//     const user = "0x0000000000000000000000000000000000000007";
//     const amount = ethers.utils.parseEther("0");
//     const tokenUri = "http://example.com";
//     await expect(freeFund2.connect(ethers.provider.getSigner(user)).invest(amount, tokenUri)).to.be.revertedWith("FreeFund__ZeroAmountInvested");
//   });

//   it("should revert investment if cap is reached", async function () {
//     // Set allocation
//     const user = "0x0000000000000000000000000000000000000008";
//     const amount = ethers.utils.parseEther("100");
//     await freeFund2.setToAmountMapping([user], [amount]);

//     // Invest
//     const tokenUri = "http://example.com";
//     await expect(freeFund2.connect(ethers.provider.getSigner(user)).invest(amount, tokenUri)).to.be.revertedWith("InvestmentFund__TotalInvestmentAboveCap");
//   });
// });
