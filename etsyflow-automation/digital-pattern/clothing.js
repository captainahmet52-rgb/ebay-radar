import { produceDigitalPattern } from './pattern-engine.js';

export async function generateClothingPattern(storeId, storeCurrency = 'USD') {
    return await produceDigitalPattern(storeId, 'clothing', storeCurrency);
}
