import {CronJob} from "cron";
import _ from "lodash";
import {EmbedBuilder} from "discord.js";

import {getVotes} from "../lib/axelarscan.js";
import {getChannelIdFromNetwork, getNoVotePercentageFromNetwork} from "../config.js";

export default function checkVotesJob(discord, prisma) {
    let isRunning = false;
    const cronJob = new CronJob('*/30 * * * * *', async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            console.log('checkVotesJob started.');

            await Promise.all([
                process(discord, prisma, 'mainnet'),
                process(discord, prisma, 'testnet'),
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

async function process(discord, prisma, network = 'mainnet') {
    const votes = await getVotes(network);
    if (!votes) {
        console.log(`axelar (${network}) votes not found.`);
        return;
    }

    const channelId = getChannelIdFromNetwork(network);
    const noPercentageNetwork = getNoVotePercentageFromNetwork(network);

    const votesSummary = votes.reduce((acc, vote) => {
        const curr = acc.find(m => m.pollId === vote.pollId);
        if (curr) {
            curr.total += 1;
            if (vote.vote) {
                curr.yes += 1;
            } else {
                curr.no += 1;
            }
        } else {
            acc.push({
                pollId: vote.pollId,
                total: 1,
                yes: vote.vote ? 1 : 0,
                no: vote.vote ? 0 : 1,
            });
        }

        return acc;
    }, []);

    for (const voteSummary of votesSummary) {
        let preferredVoteStatus = false;

        const noPercent = (voteSummary.no / voteSummary.total) * 100;
        if (noPercent > noPercentageNetwork) {
            preferredVoteStatus = true;
        }

        const addresses = await prisma.address.findMany({
            where: {
                network: network,
            }
        });

        if (preferredVoteStatus) {
            const userIds = [];
            const addressesToSave = [];

            for (const address of addresses) {
                const vote = votes.find(m => m.pollId === voteSummary.pollId && m.voter === address.address);
                if (!vote) {
                    continue;
                }

                if (!vote.vote) {
                    continue;
                }

                const notification = await prisma.notification.findFirst({
                    where: {
                        address: address.address,
                        pollId: vote.pollId,
                        network: network,
                    }
                });

                if (notification) {
                    console.log('notification already sent');
                    continue;
                }

                addressesToSave.push(address.address);
                userIds.push(address.userIds.split(','));
            }

            const messageText = `Voting result is incompatible with the majority.\nYou may need to check. <@${userIds.join('>, <@')}>`;
            await sendMessage(discord, channelId, messageText);

            for (const address of addressesToSave) {
                await prisma.notification.create({
                    data: {
                        address: address,
                        pollId: voteSummary.pollId,
                        network: network,
                    }
                });
            }
        } else {
            for (const address of addresses) {
                const vote = votes.find(vote => vote.voter === address.address);
                if (!vote) {
                    continue;
                }
                if (vote.vote !== preferredVoteStatus) {
                    console.log('vote status yes not need to send message.');
                    continue;
                }

                const notification = await prisma.notification.findFirst({
                    where: {
                        address: address.address,
                        pollId: vote.pollId,
                        network: network,
                    }
                });

                if (notification) {
                    console.log('notification already sent');
                    continue;
                }

                await sendMessage(discord, channelId, createMessage(address.userIds.split(','), vote));

                await prisma.notification.create({
                    data: {
                        address: address.address,
                        pollId: vote.pollId,
                        network: network,
                    }
                });
            }
        }
    }

    await saveVotes(prisma, votes);
}

function createMessage(userIds, vote) {
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

async function sendMessage(discord, channelId, message) {
    try {
        const channel = await discord.channels.fetch(channelId);
        await channel.send(message);
    } catch (error) {
        console.log('sendMessage error', error);
    }
}

async function saveVotes(prisma, votes, network) {
    for (const vote of votes) {
        try {
            const existsVote = await prisma.vote.findFirst({
                where: {
                    txHash: vote.txHash,
                    height: vote.height,
                    pollId: vote.pollId,
                    voter: vote.voter,
                    network: network,
                }
            });

            if (existsVote) {
                continue;
            }

            await prisma.vote.create({
                data: {
                    ...vote,
                    network: network,
                }
            });
        } catch (error) {
            console.log(error);
        }
    }
}