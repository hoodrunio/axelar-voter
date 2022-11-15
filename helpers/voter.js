import axelarscan from "../lib/axelarscan.js";

export async function getVoterAddress(operatorAddress, network) {
    if (!operatorAddress || !operatorAddress.startsWith('axelar')) {
        throw new Error('Please provide a valid operator address.');
    }

    const voterAddress = await axelarscan.getProxyAddress(operatorAddress, network);
    if (!voterAddress) {
        throw new Error('No voter address found.');
    }

    return voterAddress;
}
