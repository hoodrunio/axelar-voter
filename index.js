import * as dotenv from 'dotenv';

dotenv.config()

import {Client, Events, GatewayIntentBits} from 'discord.js';
import {PrismaClient} from '@prisma/client';
import checkVotesJob from "./jobs/check-votes-job.js";

if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN is not set');
    process.exit(1);
}

const prisma = new PrismaClient();
const discord = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,]});

discord.on(Events.ClientReady, () => {
    console.log(`Logged in as ${discord.user.tag}!`);

    checkVotesJob(discord, prisma);
});

discord.on(Events.MessageCreate, async message => {
    if (message.content.startsWith('$add')) {
        const voterAddress = message.content.split(' ')[1];
        if (!voterAddress || !voterAddress.startsWith('axelar')) {
            await message.reply('Please provide a valid voter address.');
            return;
        }

        const channelId = message.channel.id;
        const userIds = message.mentions.users.map(m => m.id);
        if (userIds.length === 0) {
            userIds.push(message.author.id);
        }

        const address = await prisma.address.findFirst({
            where: {
                address: voterAddress,
                channelId: channelId
            }
        });

        if (address) {
            console.log('address already registered');
            await message.reply('Address already registered.');
            return;
        }

        await prisma.address.create({
            data: {
                address: voterAddress,
                channelId: channelId,
                userIds: userIds.join(','),
            }
        });

        await message.reply('Your registration has been successful!\nI will send you a message any changes in your voting status.');
    } else if (message.content.startsWith('$delete') && message.mentions.users.size > 0) {
        const voterAddress = message.content.split(' ')[1];
        if (!voterAddress || !voterAddress.startsWith('axelar')) {
            await message.reply('Please provide a valid voter address.');
            return;
        }

        const channelId = message.channel.id;

        const address = await prisma.address.findFirst({
            where: {
                address: voterAddress,
                channelId: channelId
            }
        });

        if (!address) {
            console.log('address not found');
            await message.reply('This address not registered!');
            return;
        }

        await prisma.address.delete({
            where: {
                id: address.id
            }
        });

        await message.reply('Your unregistration has been successful!');
    }
});

await discord.login(process.env.DISCORD_TOKEN);