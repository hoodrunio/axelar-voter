import {CronJob} from "cron";
import _ from "lodash";
import {EmbedBuilder} from "discord.js";

import {getVotes} from "../lib/axelarscan.js";

export default function checkVotesJob(discord, prisma) {
    let isRunning = false;
    const cronJob = new CronJob('*/30 * * * * *', async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            console.log('checkVotesJob started.');

            const votes = await getVotes();
            if (!votes) {
                console.log('axelar votes not found.');
                return;
            }

            const totalVotes = votes.reduce((acc, vote) => {
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

            for (const totalVote of totalVotes) {
                let preferredVoteStatus = false;

                const noPercent = (totalVote.no / totalVote.total) * 100;
                if (noPercent > 60) {
                    preferredVoteStatus = true;
                }

                const addresses = await prisma.address.findMany();
                if (preferredVoteStatus) {
                    const messagesToChannels = [];
                    const addressesToSave = [];
                    for (const address of addresses) {
                        const vote = votes.find(m => m.pollId === totalVote.pollId && m.voter === address.address);
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
                            }
                        });

                        if (notification) {
                            console.log('notification already sent');
                            continue;
                        }

                        addressesToSave.push(address.address);

                        const messageToChannel = messagesToChannels.find(m => m.channelId === address.channelId);
                        if (messageToChannel) {
                            messageToChannel.userIds.push(address.userIds.split(','));
                        } else {
                            messagesToChannels.push({
                                channelId: address.channelId,
                                userIds: address.userIds.split(','),
                            });
                        }
                    }

                    for (const messageToChannel of messagesToChannels) {
                        const message = `Voting result is incompatible with the majority.\nYou may need to check. <@${messageToChannel.userIds.join('>, <@')}>`;
                        await sendMessage(discord, messageToChannel.channelId, message);
                    }

                    for (const address of addressesToSave) {
                        await prisma.notification.create({
                            data: {
                                address: address,
                                pollId: totalVote.pollId,
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
                            }
                        });

                        if (notification) {
                            console.log('notification already sent');
                            continue;
                        }

                        await sendMessage(discord, address.channelId, createMessage(address.userIds.split(','), vote));

                        await prisma.notification.create({
                            data: {
                                address: address.address,
                                pollId: vote.pollId,
                            }
                        });
                    }
                }
            }

            await saveVotes(prisma, votes);

            console.log('checkVotesJob finished.');
        } catch (error) {
            console.log('checkVotesJob got error', error);
        } finally {
            isRunning = false;
        }
    });
    cronJob.start();
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

async function saveVotes(prisma, votes) {
    for (const vote of votes) {
        try {
            const existsVote = await prisma.vote.findFirst({
                where: {
                    txHash: vote.txHash,
                    height: vote.height,
                    pollId: vote.pollId,
                    voter: vote.voter,
                }
            });

            if (existsVote) {
                continue;
            }

            await prisma.vote.create({
                data: vote
            });
        } catch (error) {
            console.log(error);
        }
    }
}