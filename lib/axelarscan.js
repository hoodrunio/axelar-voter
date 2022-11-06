import axios from "axios";

export async function getVotes(network = "mainnet") {
    try {
        let url = 'https://api.axelarscan.io/evm-votes';
        if (network === "testnet") {
            url = 'https://testnet.api.axelarscan.io/evm-votes';
        }

        const response = await axios.get(url);
        return response.data.data.map(m => ({
            pollId: m.poll_id,
            voter: m.voter,
            vote: m.vote,
            txHash: m.txhash,
            height: m.height,
            chain: m.sender_chain,
        }));
    } catch (error) {
        console.log(error);
        return null;
    }
}