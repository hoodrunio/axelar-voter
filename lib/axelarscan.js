import axios from "axios";

export async function getVotes() {
    try {
        const response = await axios.get('https://api.axelarscan.io/evm-votes');
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