import WebSocket from 'ws';
import {getChainMaintainers} from "../lib/rpc.js";
import {getChannelIdFromNetwork, getWebsocketFromNetwork} from "../config/env.js";
import {getAddress} from "../services/database.js";
import {sendMessage} from "../services/discord.js";
import {EmbedBuilder} from "discord.js";
import {getMonikerByOperatorAddress} from "../services/validators.js";

export default function chainMaintainersJob() {
    process('mainnet');
    process('testnet');
}

function process(network = 'mainnet') {
    const websocketUrl = getWebsocketFromNetwork(network);
    if (!websocketUrl) {
        console.error(`Websocket url is not set for ${network}`);
        return;
    }

    const ws = new WebSocket(websocketUrl);

    ws.on('open', () => {
        console.log(`Websocket connection opened for ${network}`);
        ws.send(JSON.stringify({
            "jsonrpc": "2.0",
            "method": "subscribe",
            "params": ["tm.event='NewBlock'"],
            "id": 2
        }));
    });

    ws.on('message', async (data) => {
        try {
            const dataJson = JSON.parse(data.toString());
            if (dataJson.result?.data?.value?.block?.header?.height) {
                const height = dataJson.result.data.value.block.header.height;
                console.log(`[${network}] new block height: ${height}`);

                await checkChainMaintainers(height, network);
            }
        } catch (error) {
            console.log(error);
        }
    });
}

async function checkChainMaintainers(height, network = 'mainnet') {
    const chainMaintainers = await getChainMaintainers(height, network);
    if (!chainMaintainers) {
        return;
    }

    for (const chainMaintainer of chainMaintainers) {
        const address = await getAddress({operatorAddress: chainMaintainer.address}, network);

        let messageText = `**${getMonikerByOperatorAddress(chainMaintainer.address)}}** ${chainMaintainer.action === "register" ? "registered" : "deregistered"} as **${chainMaintainer.chain}** maintainer!`;
        if (address) {
            messageText += ` <@${address.userIds.join('>, <@')}>`;
        }

        const embed = new EmbedBuilder()
            .setTitle('Chain Maintainer Register')
            .setColor(chainMaintainer.action === "register" ? 0x4BB543 : 0xF32013)
            .addFields(
                {
                    name: `${chainMaintainer.action === "register" ? "Registration" : "Deregistration"} Notification`,
                    value: `**${getMonikerByOperatorAddress(chainMaintainer.address)}** ${chainMaintainer.action === "register" ? "registered" : "deregistered"} as **${chainMaintainer.chain}** maintainer!`
                },
                {
                    name: 'Axelar Scan Link',
                    value: `https://${network === 'testnet' ? 'testnet.' : ''}axelarscan.io/validator/${chainMaintainer.address}`
                },
            );

        await sendMessage(getChannelIdFromNetwork(network), {
            content: messageText,
            embeds: [embed]
        });
    }
}