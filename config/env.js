import 'dotenv/config';

export const DiscordToken = process.env.DISCORD_TOKEN;
export const MainnetChannelId = process.env.MAINNET_CHANNEL_ID;
export const TestnetChannelId = process.env.TESTNET_CHANNEL_ID;
export const PollFailedNotifyUsers = process.env.POLL_FAILED_NOTIFY_USERS;
export const MainnetWebsocket = process.env.MAINNET_WEBSOCKET;
export const TestnetWebsocket = process.env.TESTNET_WEBSOCKET;
export const MainnetRpc = process.env.MAINNET_RPC;
export const TestnetRpc = process.env.TESTNET_RPC;
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

export function getWebsocketFromNetwork(network) {
    if (network === 'mainnet') {
        return MainnetWebsocket;
    } else if (network === 'testnet') {
        return TestnetWebsocket;
    }

    return null;
}

export function getRpcFromNetwork(network) {
    if (network === 'mainnet') {
        return MainnetRpc;
    } else if (network === 'testnet') {
        return TestnetRpc;
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