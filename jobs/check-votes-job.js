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

            const users = await prisma.user.findMany();

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
                        pollId: vote.height,
                        total: 1,
                        yes: vote.vote ? 1 : 0,
                        no: vote.vote ? 0 : 1,
                    });
                }

                return acc;
            }, []);


            for (const user of users) {
                const vote = votes.find(vote => vote.voter === user.address);
                if (vote) {
                    const totalVote = totalVotes.find(m => m.pollId === vote.pollId);
                    const noPercent = (totalVote.no / totalVote.total) * 100;

                    let preferredVoteStatus = false;
                    if (noPercent > 60) {
                        preferredVoteStatus = true;
                    }

                    if (vote.vote !== preferredVoteStatus) {
                        continue;
                    }

                    const notification = await prisma.notification.findFirst({
                        where: {
                            userId: user.userId,
                            height: vote.height,
                            pollId: vote.pollId,
                            txHash: vote.txHash,
                        }
                    });

                    if (notification) {
                        console.log('notification already sent');
                        continue;
                    }

                    const channel = await discord.channels.fetch(user.channelId);
                    await channel.send(createMessage(user.userId, vote));

                    await prisma.notification.create({
                        data: {
                            userId: user.userId,
                            height: vote.height,
                            pollId: vote.pollId,
                            txHash: vote.txHash,
                            voter: vote.voter,
                        }
                    });
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

function createMessage(userId, vote) {
    const message = `Hey <@${userId}>, voted **${vote.vote ? 'YES' : 'NO'}** for ${_.startCase(vote.chain)}.`;

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