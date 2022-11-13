import axios from "axios";
import pRetry from "p-retry";

export async function getPolls(network = "mainnet") {
    try {
        const response = await request(getUrl(network) + '/evm-polls', 'get');
        const polls = response.data.data.map(m => ({
            id: m.id,
            height: m.height,
            chain: m.sender_chain,
            txHash: m.transaction_id,
            success: m.success ?? false,
            failed: m.failed ?? false,
            confirmation: m.confirmation,
            votes: Object.keys(m).filter(v => v.startsWith('axelar')).map(v => m[v]).filter(f => f !== null).map(m => ({
                voter: m.voter,
                vote: m.vote,
                confirmed: m.confirmed,
                late: m.late,
                createdAt: m.created_at,
            }))
        }));

        for (const poll of polls) {
            poll.totalVotes = poll.votes.length;
            poll.yesVotes = poll.votes.filter(f => f.vote).length;
            poll.noVotes = poll.votes.filter(f => !f.vote).length;
            poll.noVotesPercentage = poll.noVotes / poll.totalVotes * 100;
        }

        return polls.filter(m => m.failed || m.success).sort((a, b) => b.height - a.height);
    } catch (error) {
        console.log(error);
        return null;
    }
}

export async function getProxyAddress(operatorAddress, network = "mainnet") {
    try {
        const response = await request(getUrl(network) + '/proxy-address', 'post', {
            "operator_address": operatorAddress
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data?.address;
    } catch (error) {
        console.log(error);
        return null;
    }
}

function getUrl(network) {
    let url = 'https://api.axelarscan.io';
    if (network === "testnet") {
        url = 'https://testnet.api.axelarscan.io';
    }

    return url;
}

async function request(url, method, data = null, config = {}) {
    return await pRetry(() => axios({
        url: url,
        method: method,
        data: data,
        ...config,
    }), {
        retries: 5,
        onFailedAttempt: error => {
            console.log(`${url} Request failed.  ${error.retriesLeft} retries left`);
        }
    });
}