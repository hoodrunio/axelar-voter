import {Client, Events, GatewayIntentBits} from "discord.js";
import {MainnetChannelId, TestnetChannelId} from "../config/env.js";
import {getVoterAddress} from "../helpers/voter.js";
import {setupJobs} from "../jobs/index.js";
import {prisma} from "./database.js";

export const discord = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,]});

export async function setupDiscord(discordBotToken) {
    discord.on(Events.ClientReady, () => {
        console.log(`Logged in as ${discord.user.tag}!`);

        setupJobs();
    });

    discord.on(Events.MessageCreate, async message => {
        const channelId = message.channelId;

        if (channelId !== MainnetChannelId && channelId !== TestnetChannelId) {
            return;
        }

        const channelNetwork = channelId === MainnetChannelId ? 'mainnet' : 'testnet';

        if (message.content.startsWith('$add')) {
            const operatorAddress = message.content.split(' ')[1];
            let voterAddress = '';
            try {
                voterAddress = await getVoterAddress(operatorAddress, channelNetwork);
            } catch (error) {
                await message.reply(error.message);
                return;
            }

            const userIds = message.mentions.users.map(m => m.id);
            if (userIds.length === 0) {
                userIds.push(message.author.id);
            }

            const address = await prisma.address.findFirst({
                where: {
                    voterAddress: voterAddress,
                    operatorAddress: operatorAddress,
                    network: channelNetwork
                }
            });

            if (address) {
                console.log('address already registered');
                await message.reply('Address already registered.');
                return;
            }

            await prisma.address.create({
                data: {
                    voterAddress: voterAddress,
                    operatorAddress: operatorAddress,
                    network: channelNetwork,
                    userIds: userIds.join(','),
                }
            });

            await message.reply('Your registration has been successful!\nI will send you a message any changes in your voting status.');
        } else if (message.content.startsWith('$delete')) {
            const operatorAddress = message.content.split(' ')[1];
            let voterAddress = '';
            try {
                voterAddress = await getVoterAddress(operatorAddress, channelNetwork);
            } catch (error) {
                await message.reply(error.message);
                return;
            }

            const address = await prisma.address.findFirst({
                where: {
                    voterAddress: voterAddress,
                    operatorAddress: operatorAddress,
                    channel: channelNetwork
                }
            });

            if (!address) {
                console.log('address not found');
                await message.reply('This address not registered!');
                return;
            }

            await prisma.address.delete({
                where: {
                    id: address.id
                }
            });

            await message.reply('Your unregistration has been successful!');
        }
    });

    await discord.login(discordBotToken);
}

export async function sendMessage(channelId, message) {
    try {
        const channel = await discord.channels.fetch(channelId);
        await channel.send(message);
    } catch (error) {
        console.log('sendMessage error', error);
    }
}

