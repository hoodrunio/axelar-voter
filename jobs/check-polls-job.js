import {CronJob} from "cron";
import _ from "lodash";
import {EmbedBuilder} from "discord.js";
import {getPolls} from "../lib/axelarscan.js";
import {getChannelIdFromNetwork, getNoVotePercentageFromNetwork} from "../config/env.js";
import {sendMessage} from "../services/discord.js";
import {getAddressesByNetwork, getExistsPoll, savePoll} from "../services/database.js";

export default function checkPollsJob() {
    let isRunning = false;
    const cronJob = new CronJob('*/30 * * * * *', async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            console.log('checkVotesJob started.');

            await Promise.all([
                processVotes('mainnet'),
                processVotes('testnet'),
            ]);

            console.log('checkVotesJob finished.');
        } catch (error) {
            console.log('checkVotesJob got error', error);
        } finally {
            isRunning = false;
        }
    });
    cronJob.start();
}

async function processVotes(network = 'mainnet') {
    const polls = await getPolls(network);
    if (!polls) {
        console.log(`[${network}] polls not found.`);
        return;
    }

    const channelId = getChannelIdFromNetwork(network);
    const defaultNoPercentageNetwork = getNoVotePercentageFromNetwork(network);

    for (const poll of polls) {
        const existsPoll = getExistsPoll(poll.id, network);
        if (existsPoll) {
            console.log(`[${network}] poll ${poll.id} already exists.`);
            continue;
        }

        console.log(`[${network}] poll ${poll.id} not exists. Saving...`);
        await savePoll(poll, network);

        if (poll.failed) {
            console.log(`[${network}] poll ${poll.id} failed. Sending message...`);
            await sendPollFailedMessage(poll.id, network);
            continue;
        }

        const addresses = await getAddressesByNetwork(network);

        if (poll.noVotesPercentage > defaultNoPercentageNetwork) {
            console.log(`[${network}] poll ${poll.id} no votes percentage is greater than ${defaultNoPercentageNetwork}. Sending message all yes votes...`);
            const userIds = addresses
                .filter(address => poll.votes.find(vote => vote.voter === address.voterAddress && vote.vote))
                .flatMap(address => address.userIds.split(','));

            const messageText = `Voting result is incompatible with the majority.\nYou may need to check. <@${userIds.join('>, <@')}>`;
            await sendMessage(channelId, messageText);
            continue;
        }

        console.log(`[${network}] poll ${poll.id} sending no votes message...`);
        for (const address of addresses) {
            const vote = poll.votes.find(vote => vote.voter === address.voterAddress);
            if (!vote || vote.vote) {
                continue;
            }
            await sendMessage(channelId, createVoteResultMessage(address.userIds.split(','), vote));
        }
    }
}

async function sendPollFailedMessage(pollId, network = 'mainnet') {
    const messageText = `Voting Failed. Poll Id: ${pollId}`;
    await sendMessage(getChannelIdFromNetwork(network), messageText);
}


function createVoteResultMessage(userIds, vote) {
    const message = `Hey <@${userIds.join('>, <@')}>, voted **${vote.vote ? 'YES' : 'NO'}** for ${_.startCase(vote.chain)}.`;

    const embed = new EmbedBuilder()
        .setTitle('Axelarscan Link')
        .setURL(`https://axelarscan.io/evm-votes?pollId=${vote.pollId}`)
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