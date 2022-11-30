import {CronJob} from "cron";
import _ from "lodash";
import {EmbedBuilder} from "discord.js";
import axelarscan, {setUnSubmittedVotes} from "../lib/axelarscan.js";
import {getChannelIdFromNetwork, PollFailedNotifyUsers} from "../config/env.js";
import {sendMessage} from "../services/discord.js";
import db from "../services/database.js";
import settings from "../config/settings.js";
import {getMonikerByProxyAddress, getValidators} from "../services/validators.js";
import {getCurrentBlock} from "../lib/rpc.js";

export default function checkPollsJob() {
    let isRunning = false;
    const cronJob = new CronJob('*/30 * * * * *', async () => {
        if (isRunning) {
            console.log('checkPollsJob is already running.');
            return;
        }

        isRunning = true;
        try {
            console.log('checkPollsJob started.');

            await Promise.all([
                processVotes('mainnet'),
                processVotes('testnet'),
            ]);

            console.log('checkPollsJob finished.');
        } catch (error) {
            console.log('checkPollsJob got error', error);
        } finally {
            isRunning = false;
        }
    });
    cronJob.start();
}

async function processVotes(network = 'mainnet') {
    if (!settings.get('checkPolls-' + network)) {
        console.log(`[${network}] checkPolls is disabled`);
        return;
    }

    const polls = await axelarscan.getPolls(network);
    if (!polls) {
        console.log(`[${network}] polls not found.`);
        return;
    }

    const channelId = getChannelIdFromNetwork(network);
    const currentBlock = await getCurrentBlock(network);
    for (const poll of polls) {
        if (poll.height + 20 > currentBlock) {
            console.log(`[${network}] poll ${poll.id} is not finished yet.`);
            continue;
        }

        const existsPoll = await db.getExistsPoll(poll.id, network);
        if (existsPoll) {
            //console.log(`[${network}] poll ${poll.id} already exists.`);
            continue;
        }

        // set unSubmitted votes
        const validators = await getValidators(network);
        setUnSubmittedVotes(poll, validators);

        console.log(`[${network}] poll ${poll.id} not exists. Saving...`);
        await db.savePoll(poll, network);

        const addresses = await db.getAddressesByNetwork(network);

        if (poll.failed) {
            console.log(`[${network}] poll ${poll.id} failed. Sending message...`);
            await sendPollFailedMessage(poll.id, network);
            // don't send message to all yes voters
            // await sendYesVotersMessage(poll, addresses, channelId, network);
            continue;
        }

        console.log(`[${network}] poll ${poll.id} sending no votes message...`);

        const noVotesUserIds = [];
        const noVotesMonikers = [];

        const unSubmittedVotesUserIds = [];
        const unSubmittedMonikers = [];

        for (const vote of poll.votes) {
            const address = addresses.find(address => address.voterAddress === vote.voter);

            if (vote.unSubmitted) {
                if (address) {
                    unSubmittedVotesUserIds.push(...address.userIds.split(','));
                }
                unSubmittedMonikers.push(await getMonikerByProxyAddress(vote.voter, network));
                continue;
            }

            if (!vote.vote) {
                noVotesMonikers.push(getMonikerByProxyAddress(vote.voter, network));
                if (address) {
                    noVotesUserIds.push(...address.userIds.split(','));
                }
            }
        }

        if (noVotesMonikers.length > 0) {
            console.log(`[${network}] poll ${poll.id} sending no vote messages...`);
            const message = createNoVoteMessage(noVotesUserIds, noVotesMonikers, poll, network);
            await sendMessage(channelId, message);
        }

        if (unSubmittedMonikers.length > 0) {
            console.log(`[${network}] poll ${poll.id} sending UnSubmitted vote messages...`);
            const message = createUnSubmittedVoteMessage(unSubmittedVotesUserIds, unSubmittedMonikers, poll, network);
            await sendMessage(channelId, message);
        }
    }
}

async function sendPollFailedMessage(pollId, network = 'mainnet') {
    if (!PollFailedNotifyUsers) {
        console.log(`[${network}] poll ${pollId} failed. No users to notify. Set env.`);
        return;
    }

    const messageText = `Poll ${pollId} had failed. <@${PollFailedNotifyUsers.split(',').join('>, <@')}>`;
    await sendMessage(getChannelIdFromNetwork(network), messageText);
}

async function sendYesVotersMessage(poll, addresses, channelId, network = 'mainnet') {
    console.log(`[${network}] poll ${poll.id} failed. Sending message all **YES** votes...`);
    const userIds = addresses
        .filter(address => poll.votes.find(vote => vote.voter === address.voterAddress && vote.vote))
        .flatMap(address => address.userIds.split(','));

    if (userIds.length > 0) {
        const messageText = `Poll ${poll.id} had failed and you voted yes. <@${userIds.join('>, <@')}>`;
        await sendMessage(channelId, messageText);
    }
}

function createNoVoteMessage(userIds, monikers, poll, network = 'mainnet') {
    let message = `Poll ${poll.id} ${monikers.join(', ')} voted **NO** for **${_.startCase(poll.chain)}**.`;
    if (userIds.length > 0) {
        message += ` <@${userIds.join('>, <@')}>`;
    }

    const embed = new EmbedBuilder()
        .setTitle('Axelarscan')
        .setURL(`https://${network === 'testnet' ? 'testnet.' : ''}axelarscan.io/evm-poll/${poll.id}`)
        .setColor(0xFF0000)
        .setAuthor({name: 'Axelar Vote', iconURL: 'https://axelarscan.io/logos/logo_white.png'})
        .addFields(
            {name: 'Poll ID', value: poll.id.toString(), inline: true},
            {name: 'Height', value: poll.height.toString(), inline: true},
            {name: 'Tx Hash', value: poll.txHash.toString()},
        );

    return {
        content: message,
        embeds: [embed]
    };
}

function createUnSubmittedVoteMessage(userIds, monikers, poll, network = 'mainnet') {
    let message = `Poll ${poll.id} ${monikers.join(', ')} **UNSUBMITTED** for **${_.startCase(poll.chain)}**.`;
    if (userIds.length > 0) {
        message += ` <@${userIds.join('>, <@')}>`;
    }

    const embed = new EmbedBuilder()
        .setTitle('Axelarscan')
        .setURL(`https://${network === 'testnet' ? 'testnet.' : ''}axelarscan.io/evm-poll/${poll.id}`)
        .setColor(0xFF0000)
        .setAuthor({name: 'Axelar Vote', iconURL: 'https://axelarscan.io/logos/logo_white.png'})
        .addFields(
            {name: 'Poll ID', value: poll.id.toString(), inline: true},
            {name: 'Height', value: poll.height.toString(), inline: true},
            {name: 'Tx Hash', value: poll.txHash.toString()},
        );

    return {
        content: message,
        embeds: [embed]
    };
}