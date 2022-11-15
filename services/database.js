import {PrismaClient} from "@prisma/client";

export const prisma = new PrismaClient();

export default {
    async getAddressesByNetwork(network) {
        return await prisma.address.findMany({
            where: {
                network: network,
            }
        });
    },
    async getAddress(filter, network) {
        return await prisma.address.findFirst({
            where: {
                network: network,
                ...filter,
            }
        });
    },
    async saveAddress(address, network) {
        await prisma.address.create({
            data: {
                voterAddress: address.voterAddress,
                operatorAddress: address.operatorAddress,
                userIds: address.userIds,
                network: network,
            }
        });
    },
    async deleteAddress(addressId) {
        await prisma.address.delete({
            where: {
                id: addressId
            }
        });
    },
    async getExistsPoll(pollId, network) {
        return await prisma.poll.findFirst({
            where: {
                pollId: pollId,
                network: network,
            }
        });
    },
    async savePoll(poll, network) {
        await prisma.poll.create({
            data: {
                pollId: poll.id,
                height: poll.height,
                network: network,
                chain: poll.chain,
                txHash: poll.txHash,
                success: poll.success,
                failed: poll.failed,
                votes: {
                    create: poll.votes.map(vote => ({
                        voter: vote.voter,
                        vote: vote.vote,
                    }))
                },
            }
        });
    },
    async getAddressVotes(address, network) {
        return await prisma.vote.findMany({
            take: 50,
            orderBy: {
                poll: {
                    pollId: 'desc',
                },
            },
            where: {
                voter: address,
                poll: {
                    network: network,
                }
            },
            select: {
                voter: true,
                vote: true,
                poll: {
                    select: {
                        pollId: true,
                        height: true,
                        chain: true,
                        txHash: true,
                        success: true,
                        failed: true,
                    }
                }
            }
        });
    },
    async getVotersStats(network) {
        const [yesVotes, noVotes, failedYesVotes, failednoVotes] = await Promise.all([
            // yes votes
            prisma.vote.groupBy({
                by: ['voter'],
                where: {
                    vote: true,
                    poll: {
                        network: network,
                        failed: false,
                        success: true,
                    },
                },
                _count: {
                    vote: true,
                },
            }),
            // no votes
            prisma.vote.groupBy({
                by: ['voter'],
                where: {
                    vote: false,
                    poll: {
                        network: network,
                        failed: false,
                        success: true,
                    },
                },
                _count: {
                    vote: true,
                },
            }),
            // failed yes votes
            prisma.vote.groupBy({
                by: ['voter'],
                where: {
                    vote: true,
                    poll: {
                        network: network,
                        failed: true,
                        success: false,
                    },
                },
                _count: {
                    vote: true,
                },
            }),
            // failed no votes
            prisma.vote.groupBy({
                by: ['voter'],
                where: {
                    vote: false,
                    poll: {
                        network: network,
                        failed: true,
                        success: false,
                    },
                },
                _count: {
                    vote: true,
                },
            })
        ]);

        const voters = {};
        const processVotes = (votes, field) => {
            for (const vote of votes) {
                if (!voters[vote.voter]) {
                    voters[vote.voter] = {
                        yes: 0,
                        no: 0,
                        failedYes: 0,
                        failedNo: 0,
                    };
                }
                voters[vote.voter][field] = vote._count.vote;
            }
        };

        processVotes(yesVotes, 'yes');
        processVotes(noVotes, 'no');
        processVotes(failedYesVotes, 'failedYes');
        processVotes(failednoVotes, 'failedNo');

        return Object.keys(voters).map(key => ({voter: key, ...voters[key]}));
    },
}