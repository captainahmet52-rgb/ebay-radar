import { produceDigitalPattern } from './pattern-engine.js';

export async function generateBagPattern(storeId, storeCurrency = 'USD') {
    return await produceDigitalPattern(storeId, 'bags', storeCurrency);
}
