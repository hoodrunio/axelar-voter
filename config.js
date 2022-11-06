import * as dotenv from 'dotenv';

dotenv.config()

export const DiscordToken = process.env.DISCORD_TOKEN;
export const MainnetChannelId = process.env.MAINNET_CHANNEL_ID;
export const TestnetChannelId = process.env.TESTNET_CHANNEL_ID;
export const MainnetNoVotePercentage = process.env.MAINNET_NO_VOTE_PERCENTAGE || 60;
export const TestnetNoVotePercentage = process.env.TESTNET_NO_VOTE_PERCENTAGE || 60;


export function getChannelIdFromNetwork(network) {
    if (network === 'mainnet') {
        return MainnetChannelId;
    } else if (network === 'testnet') {
        return TestnetChannelId;
    }

    return null;
}

export function getNoVotePercentageFromNetwork(network) {
    if (network === 'mainnet') {
        return isNaN(parseInt(MainnetNoVotePercentage)) ? 60 : MainnetNoVotePercentage;
    } else if (network === 'testnet') {
        return isNaN(parseInt(TestnetNoVotePercentage)) ? 60 : TestnetNoVotePercentage;
    }

    return 60;
}