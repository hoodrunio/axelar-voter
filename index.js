import * as dotenv from 'dotenv';
dotenv.config()

import {Client, Events, GatewayIntentBits} from 'discord.js';
import {PrismaClient} from '@prisma/client';
import {exportVoterAddress} from "./utils.js";
import checkVotesJob from "./jobs/check-votes-job.js";

if(!process.env.DISCORD_TOKEN) {
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
    if (message.content.startsWith('$axelar') && message.mentions.users.size > 0) {
        console.log(message.content);

        const voterAddress = exportVoterAddress(message.content);
        const userId = message.mentions.users.first().id;
        const channelId = message.channel.id;

        const user = await prisma.user.findFirst({
            where: {
                address: voterAddress,
                userId: userId,
                channelId: channelId
            }
        });

        if (user) {
            console.log('user already registered');
            await message.reply('You already registered!');
            return;
        }

        await prisma.user.create({
            data: {
                address: voterAddress,
                userId: userId,
                channelId: channelId
            }
        });

        await message.reply('Your registration has been successful!\nI will send you a message any changes in your voting status.');
    }
});

await discord.login(process.env.DISCORD_TOKEN);