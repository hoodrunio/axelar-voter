import axelarscan from "../lib/axelarscan.js";

const validators = {};

export async function setupValidators() {
    const [mainnetValidators, testnetValidators] = await Promise.all([
        axelarscan.getRpcValidators('mainnet'),
        axelarscan.getRpcValidators('testnet')
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

export function getMonikerByProxyAddress(proxyAddress, network = 'mainnet') {
    const validators = getValidators(network);
    if (!validators || validators.length === 0) {
        return proxyAddress;
    }

    const validator = validators.find(validator => validator.proxy_address === proxyAddress);
    if (!validator) {
        return proxyAddress;
    }

    return validator.description.moniker;
}

export function getMonikerByOperatorAddress(operatorAddress, network = 'mainnet') {
    const validators = getValidators(network);
    if (!validators || validators.length === 0) {
        return operatorAddress;
    }

    const validator = validators.find(validator => validator.operator_address === operatorAddress);
    if (!validator) {
        return operatorAddress;
    }

    return validator.description.moniker;
}