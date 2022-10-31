import {CronJob} from "cron";
import _ from "lodash";

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
                const height = acc.find(m => m.height === vote.height);
                if (height) {
                    height.total += 1;
                    if (vote.vote) {
                        height.yes += 1;
                    } else {
                        height.no += 1;
                    }
                } else {
                    acc.push({
                        height: vote.height,
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
                    const totalVote = totalVotes.find(m => m.height === vote.height);
                    const noPercent = (totalVote.no / totalVote.total) * 100;

                    let waitingVote = false;
                    if (noPercent > 60) {
                        waitingVote = true;
                    }

                    if (vote.vote !== waitingVote) {
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
    let message = '';

    message += `<@${userId}> `;
    message += `, ${_.startCase(vote.chain)} için "${vote.vote ? "Yes" : "No"}" oyu verdi!.\n`;
    message += `Tx Hash: \`${vote.txHash}\`\n`;
    message += `Height: \`${vote.height}\`, Poll Id: \`${vote.pollId}\``;

    return message;
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