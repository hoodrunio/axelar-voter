import {PrismaClient} from "@prisma/client";

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
   const result =  await prisma.poll.create({
        data: {
            pollId: poll.id,
            height: poll.height,
            network: network,
            chain: poll.chain,
            txHash: poll.txHash,
            success: poll.success,
            failed: poll.failed,
            data: JSON.stringify(poll),
            votes: {
                create: poll.votes.map(vote => ({
                    voter: vote.voter,
                    vote: vote.vote,
                }))
            },
        }
    });
   console.log(result);
}

export async function getAddressVotes(address, network) {
    return await prisma.vote.findMany({
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