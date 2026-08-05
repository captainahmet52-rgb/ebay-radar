import { produceDigitalPattern } from './pattern-engine.js';

export async function generateAmigurumiPattern(storeId, storeCurrency = 'USD') {
    return await produceDigitalPattern(storeId, 'amigurumi', storeCurrency);
}
