import axios from "axios";
import pRetry from "p-retry";

export async function getPolls(network = "mainnet") {
    try {
        const response = await request(getUrl(network) + '/evm-polls', 'get');
        const polls = response.data.data.map(m => formatPoll(m));
        return polls.filter(m => m.failed || m.success).sort((a, b) => b.height - a.height);
    } catch (error) {
        console.log(error);
        return null;
    }
}

export async function getPoll(pollId, network = "mainnet") {
    try {
        const response = await request(getUrl(network) + '/evm-polls', 'post', {
            "pollId": pollId
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.data.length === 0) {
            return null;
        }

        return formatPoll(response.data.data[0]);
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

function formatPoll(pollItem) {
    const poll = {
        id: pollItem.id,
        height: pollItem.height,
        chain: pollItem.sender_chain,
        txHash: pollItem.transaction_id,
        success: pollItem.success ?? false,
        failed: pollItem.failed ?? false,
        confirmation: pollItem.confirmation,
        participants: pollItem.participants,
        votes: Object.keys(pollItem).filter(v => v.startsWith('axelar')).map(v => pollItem[v]).filter(f => f !== null).map(m => ({
            voter: m.voter,
            vote: m.vote,
            confirmed: m.confirmed,
            late: m.late,
            createdAt: m.created_at,
        }))
    }

    poll.totalVotes = poll.votes.length;
    poll.yesVotes = poll.votes.filter(f => f.vote).length;
    poll.noVotes = poll.votes.filter(f => !f.vote).length;
    poll.noVotesPercentage = poll.noVotes / poll.totalVotes * 100;

    return poll;
}