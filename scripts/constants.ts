import { utils } from 'ethers';

export const DEFAULT_GAS_MULTIPLIER = 1.1;
export const DEFAULT_MAX_FEE_PER_GAS_MULTIPLIER = 1.2; // Should be at least 1.125 since base fee can increase by 1.125x each block
export const DEFAULT_MAX_PRIORITY_FEE_PER_GAS_MULTIPLIER = 1;

export const ERC721_TRANSFER_EVENT_TOPIC = utils.id('Transfer(address,address,uint256)');
