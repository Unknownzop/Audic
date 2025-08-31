
module.exports = {
    botName: 'Audic',
    botDescription: 'Your ultimate music bot for seamless audio streaming on Discord.',
    embedColor: '#7289DA',
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy',
    botLogo: 'https://i.imgur.com/aSN4yCn.png',
    genius: {
        apiKey: process.env.GENIUS_API_KEY,
        clientToken: process.env.GENIUS_CLIENT_TOKEN,
        accessToken: process.env.GENIUS_ACCESS_TOKEN
    },
    emojis: {
        play: '',
        pause: '',
        stop: '',
        skip: '',
        previous: '',
        repeat: '',
        loading: '',
        error: '',
        success: '',
        queue: '',
        music: '',
        volume: '',
        time: '',
        user: '',
        duration: '',
        spotify: '',
        soundcloud: '',
        youtube: '',
        loopTrack: '',
        loopQueue: '',
        loopOff: ''
    },
    lavalink: {
        nodes: [
            {
                name: 'Main',
                url: 'lavalink.jirayu.net:13592',
                auth: 'youshallnotpass',
                secure: false,
                retryAmount: 5,
                retryDelay: 3000
            }
        ]
    }
};
