import axios from "axios";
import {getRpcFromNetwork} from "../config/env.js";
import pRetry from "p-retry";

export async function getPollIsFailed(height, network) {
    const response = await request(getRpcFromNetwork(network) + `/block_results?height=${height}`);
    const dataStr = JSON.stringify(response.data);

    return dataStr.includes("POLL_STATE_FAILED") || dataStr.includes("POLL_STATE_EXPIRED");
}

export async function getChainMaintainers(height, network) {
    const response = await request(getRpcFromNetwork(network) + `/block_results?height=${height}`);

    const exportChainMaintainers = (chainMaintainer) => {
        const attributes = chainMaintainer.attributes.map(a => ({
            key: Buffer.from(a.key, 'base64').toString('utf8'),
            value: Buffer.from(a.value, 'base64').toString('utf8')
        }));

        const action = attributes.find(a => a.key === "action")?.value;
        const chain = attributes.find(a => a.key === "chain")?.value;
        const address = attributes.find(a => a.key === "chainMaintainerAddress")?.value;

        if (action === "register" || action === "deregister") {
            return {
                action: action,
                chain: chain,
                address: address
            };
        }

        return null;
    };

    const result = [];

    const txsResults = response.data?.result?.txs_results?.flatMap(m => m?.events) || [];
    result.push(...(txsResults?.filter(e => e.type === "chainMaintainer") || []).map(exportChainMaintainers).filter(e => e !== null));

    const endBlockEvents = response.data?.result?.end_block_events || [];
    result.push(...(endBlockEvents?.filter(e => e.type === "chainMaintainer") || []).map(exportChainMaintainers).filter(e => e !== null));

    return result;
}

async function request(url) {
    return await pRetry(() => axios.get(url), {
        retries: 5,
        onFailedAttempt: error => {
            console.log(`${url} Request failed.  ${error.retriesLeft} retries left`);
        }
    });
}