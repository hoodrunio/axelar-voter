import {Client, Events, GatewayIntentBits} from 'discord.js';
import {PrismaClient} from '@prisma/client';
import checkVotesJob from "./jobs/check-votes-job.js";
import {DiscordToken, MainnetChannelId, setNoVotePercentage, TestnetChannelId} from "./config.js";

if (!DiscordToken) {
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
    const channelId = message.channelId;
    if (channelId !== MainnetChannelId || channelId !== TestnetChannelId) {
        return;
    }

    const channelNetwork = channelId === MainnetChannelId ? 'mainnet' : 'testnet';

    if (message.content.startsWith('$add')) {
        const voterAddress = message.content.split(' ')[1];
        if (!voterAddress || !voterAddress.startsWith('axelar')) {
            await message.reply('Please provide a valid voter address.');
            return;
        }

        const userIds = message.mentions.users.map(m => m.id);
        if (userIds.length === 0) {
            userIds.push(message.author.id);
        }

        const address = await prisma.address.findFirst({
            where: {
                address: voterAddress,
                network: channelNetwork
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
                network: channelNetwork,
                userIds: userIds.join(','),
            }
        });

        await message.reply('Your registration has been successful!\nI will send you a message any changes in your voting status.');
    } else if (message.content.startsWith('$delete')) {
        const voterAddress = message.content.split(' ')[1];
        if (!voterAddress || !voterAddress.startsWith('axelar')) {
            await message.reply('Please provide a valid voter address.');
            return;
        }

        const address = await prisma.address.findFirst({
            where: {
                address: voterAddress,
                channel: channelNetwork
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

await discord.login(DiscordToken);