import axios from "axios";
import {getRpcFromNetwork} from "../config/env.js";
import pRetry from "p-retry";

export async function getPollIsFailed(height, network) {
    const response = await request(getRpcFromNetwork(network) + `/block_results?height=${height}`);
    const dataStr = JSON.stringify(response.data);

    if (dataStr.includes("POLL_STATE_FAILED") || dataStr.includes("POLL_STATE_EXPIRED")) {
        return true;
    }

    return false;
}

export async function getChainMaintainers(height, network) {
    const response = await request(getRpcFromNetwork(network) + `/block_results?height=${height}`);
    const endBlockEvents = response.data?.result?.end_block_events;
    const chainMaintainers = endBlockEvents?.filter(e => e.type === "chainMaintainer");
    if (!chainMaintainers || chainMaintainers.length === 0) {
        return [];
    }

    const result = [];
    for (const chainMaintainer of chainMaintainers) {
        const attributes = chainMaintainer.attributes.map(a => ({
            key: Buffer.from(a.key, 'base64').toString('utf8'),
            value: Buffer.from(a.value, 'base64').toString('utf8')
        }));

        const action = attributes.find(a => a.key === "action")?.value;
        const chain = attributes.find(a => a.key === "chain")?.value;
        const address = attributes.find(a => a.key === "chainMaintainerAddress")?.value;

        if (action === "register" || action === "deregister") {
            result.push({
                action: action,
                chain: chain,
                address: address
            });
        }
    }

    return result;
}

async function request(url) {
    const response = await pRetry(() => axios.get(url), {
        retries: 5,
        onFailedAttempt: error => {
            console.log(`${url} Request failed.  ${error.retriesLeft} retries left`);
        }
    });

    return response;
}