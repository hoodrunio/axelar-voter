import {CronJob} from "cron";
import _ from "lodash";
import {EmbedBuilder} from "discord.js";
import axelarscan from "../lib/axelarscan.js";
import {getChannelIdFromNetwork, PollFailedNotifyUsers} from "../config/env.js";
import {sendMessage} from "../services/discord.js";
import db from "../services/database.js";
import settings from "../config/settings.js";

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

    for (const poll of polls) {
        const existsPoll = await db.getExistsPoll(poll.id, network);
        if (existsPoll) {
            //console.log(`[${network}] poll ${poll.id} already exists.`);
            continue;
        }

        console.log(`[${network}] poll ${poll.id} not exists. Saving...`);
        await db.savePoll(poll, network);

        const addresses = await db.getAddressesByNetwork(network);

        if (poll.failed) {
            console.log(`[${network}] poll ${poll.id} failed. Sending message...`);
            await sendPollFailedMessage(poll.id, network);
            await sendYesVotersMessage(poll, addresses, channelId, network);
            continue;
        }

        console.log(`[${network}] poll ${poll.id} sending no votes message...`);
        for (const address of addresses) {
            const vote = poll.votes.find(vote => vote.voter === address.voterAddress);
            if (!vote || vote.vote) {
                continue;
            }
            await sendMessage(channelId, createVoteResultMessage(address.userIds.split(','), vote, network));
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
    console.log(`[${network}] poll ${poll.id} failed. Sending message all yes votes...`);
    const userIds = addresses
        .filter(address => poll.votes.find(vote => vote.voter === address.voterAddress && vote.vote))
        .flatMap(address => address.userIds.split(','));

    const messageText = `Poll ${poll.id} had failed and you voted yes. <@${userIds.join('>, <@')}>`;
    await sendMessage(channelId, messageText);
}

function createVoteResultMessage(userIds, vote, network = 'mainnet') {
    const message = `Hey <@${userIds.join('>, <@')}>, voted **${vote.vote ? 'YES' : 'NO'}** for ${_.startCase(vote.chain)}.`;

    const embed = new EmbedBuilder()
        .setTitle('Axelarscan Link')
        .setURL(`https://${network === 'testnet' ? 'testnet.' : ''}axelarscan.io/evm-votes?pollId=${vote.pollId}`)
        .setColor(0xFF0000)
        .setAuthor({name: 'Axelar Vote', iconURL: 'https://axelarscan.io/logos/logo_white.png'})
        .addFields(
            {name: 'Poll ID', value: vote.pollId.toString(), inline: true},
            {name: 'Height', value: vote.height.toString(), inline: true},
            {name: 'Tx Hash', value: vote.txHash.toString()},
            {name: 'Voter Address', value: vote.voter.toString()},
        );

    return {
        content: message,
        embeds: [embed]
    };
}