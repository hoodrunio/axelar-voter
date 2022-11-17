import axios from "axios";
import pRetry from "p-retry";

export default {
    async getPolls(network = "mainnet") {
        try {
            const response = await request(getUrl(network) + '/evm-polls', 'get');
            return response.data.data
                .map(m => formatPoll(m))
                .filter(m => m.failed || m.success)
                .sort((a, b) => a.height - b.height || a.id - b.id);
        } catch (error) {
            console.log(error);
            return null;
        }
    },

    async getPoll(pollId, network = "mainnet") {
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
    },

    async getProxyAddress(operatorAddress, network = "mainnet") {
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
    },

    async getRpcValidators(network = "mainnet") {
        try {
            const response = await request(getUrl(network), 'post', {
                path: "/cosmos/staking/v1beta1/validators",
                module: "lcd",
                'pagination.limit': 10000,
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const proxyAddresses = await this.getRpcRegisterProxy(network);

            const validators = response.data.validators;
            for (const validator of validators) {
                const proxyAddress = proxyAddresses.find(f => f.operatorAddress === validator.operator_address);
                if (proxyAddress) {
                    validator.proxy_address = proxyAddress.proxyAddress;
                }
            }

            return validators;
        } catch (error) {
            console.log(error);
            return null;
        }
    },

    async getRpcRegisterProxy(network = "mainnet") {
        try {
            const pageResp = await request(getUrl(network), 'post',
                {
                    "events": "message.action='RegisterProxy'",
                    "pagination.limit": 1,
                    "pagination.offset": 0,
                    "path": "/cosmos/tx/v1beta1/txs",
                    "module": "lcd"
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const proxyAddresses = [];

            const totalPage = Math.ceil(parseFloat(pageResp.data.pagination.total) / 50);
            for (let page = 0; page < totalPage; page++) {
                const response = await request(getUrl(network), 'post', {
                    "events": "message.action='RegisterProxy'",
                    "pagination.limit": 50,
                    "pagination.offset": page * 50,
                    "path": "/cosmos/tx/v1beta1/txs",
                    "module": "lcd"
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                for (const tx of response.data.txs) {
                    const registerProxyRequest = tx.body.messages.find(f => f["@type"].includes("RegisterProxyRequest"));
                    if (registerProxyRequest) {
                        proxyAddresses.push({
                            operatorAddress: registerProxyRequest.sender,
                            proxyAddress: registerProxyRequest.proxy_addr,
                        });
                    }
                }
            }

            return proxyAddresses;
        } catch (error) {
            console.log(error);
            return null;
        }
    },
}

export function setUnSubmittedVotes(poll, validators) {
    if (Array.isArray(poll.participants) && poll.participants.length > 0) {
        for (const participant of poll.participants) {
            const validator = validators.find(validator => validator.operator_address === participant);
            if (!validator && !validator.proxy_address) {
                continue;
            }

            const vote = poll.votes.find(vote => vote.voter === validator.proxy_address);
            if (!vote) {
                poll.votes.push({
                    voter: validator.proxy_address,
                    vote: false,
                    confirmed: false,
                    late: false,
                    createdAt: null,
                    unSubmitted: true,
                })
            }
        }
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
        id: parseInt(pollItem.id),
        height: pollItem.height,
        chain: pollItem.sender_chain,
        txHash: pollItem.transaction_id,
        success: pollItem.success ?? false,
        failed: pollItem.failed ?? false,
        confirmation: pollItem.confirmation,
        participants: pollItem.participants,
        createdAt: new Date(pollItem.created_at.ms),
        votes: Object.keys(pollItem).filter(v => v.startsWith('axelar')).map(v => pollItem[v]).filter(f => f !== null).map(m => ({
            voter: m.voter,
            vote: m.vote,
            confirmed: m.confirmed,
            late: m.late,
            createdAt: m.created_at,
            unSubmitted: false,
        }))
    }

    poll.totalVotes = poll.votes.length;
    poll.yesVotes = poll.votes.filter(f => f.vote).length;
    poll.noVotes = poll.votes.filter(f => !f.vote).length;
    poll.noVotesPercentage = poll.noVotes / poll.totalVotes * 100;

    return poll;
}