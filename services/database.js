import {PrismaClient} from "@prisma/client";
import _ from "lodash";

export const prisma = new PrismaClient();

export async function getAddressesByNetwork(network) {
    return await prisma.address.findMany({
        where: {
            network: network,
        }
    });
}

export async function getAddress(filter, network) {
    return await prisma.address.findFirst({
        where: {
            network: network,
            ...filter,
        }
    });
}

export async function saveAddress(address, network) {
    await prisma.address.create({
        data: {
            voterAddress: address.voterAddress,
            operatorAddress: address.operatorAddress,
            userIds: address.userIds,
            network: network,
        }
    });
}

export async function deleteAddress(addressId) {
    await prisma.address.delete({
        where: {
            id: addressId
        }
    });
}

export async function getExistsPoll(pollId, network) {
    return prisma.poll.findFirst({
        where: {
            pollId: pollId,
            network: network,
        }
    });
}

export async function savePoll(poll, network) {
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
}

export async function getAddressVotes(address, network) {
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
}

export async function getVotersStats(network) {
    const groupNoVotes = await prisma.vote.groupBy({
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
    });

    const groupYesVotes = await prisma.vote.groupBy({
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
    });

    const groupFailedNoVotes = await prisma.vote.groupBy({
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
    });

    const groupFailedYesVotes = await prisma.vote.groupBy({
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
    });

    const stats = {};
    for (const groupNoVote of groupNoVotes) {
        if (!stats[groupNoVote.voter]) {
            stats[groupNoVote.voter] = {
                failedNo: 0,
                failedYes: 0,
                no: groupNoVote._count.vote,
                yes: 0,
            };

        } else {
            stats[groupNoVote.voter].no = groupNoVote._count.vote;
        }
    }

    for (const groupYesVote of groupYesVotes) {
        if (!stats[groupYesVote.voter]) {
            stats[groupYesVote.voter] = {
                failedNo: 0,
                failedYes: 0,
                no: 0,
                yes: groupYesVote._count.vote,
            };

        } else {
            stats[groupYesVote.voter].yes = groupYesVote._count.vote;
        }
    }

    for (const groupFailedNoVote of groupFailedNoVotes) {
        if (!stats[groupFailedNoVote.voter]) {
            stats[groupFailedNoVote.voter] = {
                failedNo: groupFailedNoVote._count.vote,
                failedYes: 0,
                no: 0,
                yes: 0,
            };

        } else {
            stats[groupFailedNoVote.voter].failedNo = groupFailedNoVote._count.vote;
        }
    }

    for (const groupFailedYesVote of groupFailedYesVotes) {
        if (!stats[groupFailedYesVote.voter]) {
            stats[groupFailedYesVote.voter] = {
                failedNo: 0,
                failedYes: groupFailedYesVote._count.vote,
                no: 0,
                yes: 0,
            };

        } else {
            stats[groupFailedYesVote.voter].failedYes = groupFailedYesVote._count.vote;
        }
    }

    return stats;
}