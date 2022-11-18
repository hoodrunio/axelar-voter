import {Client, EmbedBuilder, Events, GatewayIntentBits} from "discord.js";
import _ from "lodash";
import {MainnetChannelId, TestnetChannelId} from "../config/env.js";
import {getVoterAddress} from "../helpers/voter.js";
import {setupJobs} from "../jobs/index.js";
import db from "./database.js";
import axelarscan, {setUnSubmittedVotes} from "../lib/axelarscan.js";
import {getMonikerByProxyAddress, getValidators} from "./validators.js";
import {addSpaces} from "../helpers/string.js";
import settings from "../config/settings.js";


export const discord = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,]});

export async function sendMessage(channelId, message) {
    try {
        const channel = await discord.channels.fetch(channelId);
        await channel.send(message);
    } catch (error) {
        console.log('sendMessage error', error);
    }
}

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


            if (message.content.startsWith('!help')) {
                const messageStr =
                    'Hello, Im a bot that will notify you of any changes in your voting status.\n' +
                    'Type `$ping` to check if the bot is running\n' +
                    'To save your address, use this command: `$add <operator address> @<user1> @<user2>` (@<users> is optional)\n' +
                    'To unregister your address, use this command: `!delete <operator address>`\n' +
                    'To get the details of a poll, use this command: `!poll <poll id>`\n' +
                    'To get statistics for your address, use this command: `!stats <operator address>`\n' +
                    'To get statistics of all addresses, use this command: `!stats all`\n';

                await message.reply(messageStr);
            } else if (message.content.startsWith('!ping')) {
                await message.reply('pong 🏓');
            } else if (message.content.startsWith('!settings')) {
                await processSettingsMessage(message, channelNetwork);
            } else if (message.content.startsWith('!add')) {
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

                const address = await db.getAddress({
                    voterAddress: voterAddress,
                    operatorAddress: operatorAddress,
                }, channelNetwork);

                if (address) {
                    console.log('address already registered');
                    await message.reply('Address already registered.');
                    return;
                }

                await db.saveAddress({
                    voterAddress: voterAddress,
                    operatorAddress: operatorAddress,
                    userIds: userIds.join(','),
                }, channelNetwork);

                const messageStr =
                    `Registration done for ${getMonikerByProxyAddress(voterAddress, channelNetwork)}!\n` +
                    `Voter Address: \`${voterAddress}\``;
                await message.reply(messageStr);
            } else if (message.content.startsWith('!delete')) {
                const operatorAddress = message.content.split(' ')[1];
                let voterAddress = '';
                try {
                    voterAddress = await getVoterAddress(operatorAddress, channelNetwork);
                } catch (error) {
                    await message.reply(error.message);
                    return;
                }

                const address = await db.getAddress({
                    voterAddress: voterAddress,
                    operatorAddress: operatorAddress,
                }, channelNetwork);

                if (!address) {
                    console.log('address not found');
                    await message.reply('This address not registered!');
                    return;
                }

                await db.deleteAddress(address.id);

                await message.reply('Your unregistration has been successful!');
            } else if (message.content.startsWith('!poll')) {
                const pollId = message.content.split(' ')[1];
                await sendPollDetailsMessage(message, pollId, channelNetwork);
            } else if (message.content === '!stats all') {
                await sendStatsAllMessage(message, channelNetwork);
            } else if (message.content.startsWith('!stats')) {
                const operatorAddress = message.content.split(' ')[1];

                let voterAddress = '';
                if (operatorAddress.startsWith('axelarvaloper')) {
                    try {
                        voterAddress = await getVoterAddress(operatorAddress, channelNetwork);
                    } catch (error) {
                        await message.reply(error.message);
                        return;
                    }
                } else if (operatorAddress.startsWith('axelar')) {
                    voterAddress = operatorAddress;
                }

                await sendVoterStatsMessage(message, voterAddress, channelNetwork);
            }
        }
    );

    await discord.login(discordBotToken);
}

async function processSettingsMessage(message, channelNetwork) {
    const commands = message.content.split(' ');
    if (commands.length !== 3 && commands.length !== 2) {
        await message.reply('Invalid command');
        return;
    }

    if (commands.length === 2) {
        switch (commands[1]) {
            case 'checkChainMaintainers':
                await message.reply(`check chain maintainers: ${settings.get(`checkChainMaintainers-${channelNetwork}`) ? 'enabled' : 'disabled'}`);
                break;
            case 'checkPolls':
                await message.reply(`check polls: ${settings.get(`checkPolls-${channelNetwork}`) ? 'enabled' : 'disabled'}`);
                break;
            default:
                await message.reply('Invalid command');
        }
    } else if (commands.length === 3)
        switch (commands[1]) {
            case 'checkChainMaintainers':
                if (commands[2] === 'enable') {
                    await settings.set('checkChainMaintainers-' + channelNetwork, true);
                    await message.reply('Checking chain maintainers is enabled');
                } else if (commands[2] === 'disable') {
                    await settings.set('checkChainMaintainers-' + channelNetwork, false);
                    await message.reply('Checking chain maintainers is disabled');
                }
                break;
            case 'checkPolls':
                if (commands[2] === 'enable') {
                    await settings.set('checkPolls-' + channelNetwork, true);
                    await message.reply('Checking polls is enabled');
                } else if (commands[2] === 'disable') {
                    await settings.set('checkPolls-' + channelNetwork, false);
                    await message.reply('Checking polls is disabled');
                }
                break;
            default:
                await message.reply('Invalid command');
        }
}

async function sendPollDetailsMessage(message, pollId, network) {
    const poll = await axelarscan.getPoll(pollId, network);
    if (!poll) {
        await message.reply('Poll not found');
        return;
    }

    // set unSubmitted votes
    const validators = await getValidators(network);
    setUnSubmittedVotes(poll, validators);

    const embed = new EmbedBuilder()
        .setTitle('Axelarscan Link')
        .setURL(`https://${network === 'testnet' ? 'testnet.' : ''}axelarscan.io/evm-poll/${pollId}`)
        .setColor(0xFF0000)
        .setAuthor({name: 'Axelar Poll', iconURL: 'https://axelarscan.io/logos/logo_white.png'})
        .addFields(
            {name: 'Poll ID', value: poll.id.toString(), inline: true},
            {name: 'Height', value: poll.height.toString(), inline: true},
            {name: 'Chain', value: _.startCase(poll.chain)},
            {name: 'Tx Hash', value: poll.txHash.toString()},
            {name: 'Status', value: getPollStatus(poll)},
            {name: 'Total Votes', value: poll.totalVotes.toString()},
            {name: 'Yes Votes', value: poll.yesVotes.toString()},
            {name: 'No Votes', value: poll.noVotes.toString()},
        );

    await sendMessage(message.channelId, {embeds: [embed]});

    for (const chunkElement of _.chunk(poll.votes, 15)) {
        const messageStr = '```' +
            '           Voter           |   Vote   \n' +
            '--------------------------------------\n' +
            chunkElement.map(m => `${addSpaces(getMonikerByProxyAddress(m.voter, network), 27)}|${addSpaces(getVoteStatus(m), 10)}`).join('\n') +
            '```';
        await sendMessage(message.channelId, messageStr);
    }
}

async function sendStatsAllMessage(message, network) {
    const votersStats = await db.getVotersStats(network);

    for (const chunkElement of _.chunk(votersStats, 15)) {
        const messageStr = '```' +
            '           Voter           | Yes | No | UnSubmit | Yes(Fail) | No(Fail) | UnSubmit(Fail) \n' +
            '-----------------------------------------------------------------------------------------\n' +
            chunkElement.map(m => `${addSpaces(getMonikerByProxyAddress(m.voter, network), 27)}|${addSpaces(m.yes.toString(), 5)}|${addSpaces(m.no.toString(), 4)}|${addSpaces(m.unSubmitted.toString(), 10)}|${addSpaces(m.failedYes.toString(), 11)}|${addSpaces(m.failedNo.toString(), 10)}|${addSpaces(m.failedUnSubmitted.toString(), 16)}`).join('\n') +
            '```';
        await sendMessage(message.channelId, messageStr);
    }
}

async function sendVoterStatsMessage(message, voterAddress, network) {
    const addressVotes = await db.getAddressVotes(voterAddress, network);
    if (!addressVotes || addressVotes.length === 0) {
        await message.reply('No votes found!');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('Axelarscan Link')
        .setURL(`https://${network === 'testnet' ? 'testnet.' : ''}axelarscan.io/validator/${voterAddress}`)
        .setColor(0xFF0000)
        .setAuthor({name: 'Axelar Validator', iconURL: 'https://axelarscan.io/logos/logo_white.png'})
        .addFields(
            {name: 'Proxy Address', value: voterAddress.toString()},
            {name: 'Total Votes', value: addressVotes.length.toString()},
            {name: 'Yes Votes', value: addressVotes.filter(m => m.vote).length.toString()},
            {name: 'No Votes', value: addressVotes.filter(m => !m.vote).length.toString()},
        );

    await sendMessage(message.channelId, {
        content: `Hey, ${getMonikerByProxyAddress(voterAddress, network)} here are your stats!`,
        embeds: [embed]
    });


    for (const chunkElement of _.chunk(addressVotes, 15)) {
        const messageStr = '```' +
            '  Poll ID  |  Poll Status  |  Vote  \n' +
            '------------------------------------\n' +
            chunkElement.map(m => `${addSpaces(m.poll.pollId.toString(), 11)}|${addSpaces(getPollStatus(m.poll), 15)}|${addSpaces(getVoteStatus(m), 8)}`).join('\n') +
            '```';
        await sendMessage(message.channelId, messageStr);
    }
}

function getPollStatus(poll) {
    if (poll.success)
        return 'Success';
    if (poll.failed)
        return 'Failed';
    return 'Pending';
}

function getVoteStatus(vote) {
    if (vote.vote)
        return '✅';

    if (vote.unSubmitted)
        return '⚠️';

    return '❌';
}