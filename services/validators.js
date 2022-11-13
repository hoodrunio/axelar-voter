import {getRpcValidators} from "../lib/axelarscan.js";

const validators = {};

export async function setupValidators() {
    const [mainnetValidators, testnetValidators] = await Promise.all([
        getRpcValidators('mainnet'),
        getRpcValidators('testnet')
    ]);


    validators['mainnet'] = mainnetValidators;
    validators['testnet'] = testnetValidators;
}

export function getValidators(network = 'mainnet') {
    if (!validators[network]) {
        return [];
    }

    return validators[network];
}