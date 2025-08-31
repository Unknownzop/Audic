require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const config = require('./config');
const { formatDuration } = require('./utils/formatters');
const { createEmbed } = require('./utils/embeds');
const logger = require('./utils/logger');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Add startup debugging logs
console.log('Starting Discord Music Bot...');
console.log('Environment variables present:');
console.log('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
console.log('DISCORD_TOKEN length:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0);
console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('CLIENT_ID length:', process.env.CLIENT_ID ? process.env.CLIENT_ID.length : 0);
console.log('LAVALINK_HOST:', process.env.LAVALINK_HOST);
console.log('LAVALINK_PORT:', process.env.LAVALINK_PORT);

// Set timeout to detect if login takes too long
setTimeout(() => {
    console.log('Login is taking longer than expected (10 seconds)...');
}, 10000);

// Create client instance with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Store commands in a collection
client.commands = new Collection();
client.twentyFourSeven = new Collection();
client.nowPlayingMessages = new Map(); // Map to store Now Playing messages (guildId -> messageId)
client.inactivityTimeouts = new Map(); // Map to store inactivity timeouts for each guild

// Initialize Shoukaku and Kazagumo with more robust error handling
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), config.lavalink.nodes, {
    moveOnDisconnect: false,
    resume: true,
    resumeTimeout: 60, // Increased from 30 to 60
    reconnectTries: 5, // Increased from 2 to 5
    restTimeout: 15000, // Increased from 10000 to 15000
    userAgent: 'Audic/1.0.0',
    structures: {
        // Set debug to false to disable all WebSocket debug logs
        debug: false
    }
});

client.kazagumo = new Kazagumo({
    defaultSearchEngine: 'youtube_music', // Use YouTube Music as default search engine
    defaultYoutubeThumbnail: 'mqdefault', // Use mobile quality for thumbnails
    sources: {
        youtube: false,     // Disable regular YouTube source
        youtube_music: true, // Enable YouTube Music source
        soundcloud: false   // Disable SoundCloud source
    },
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    plugins: [
        new Plugins.PlayerMoved(client)
    ]
}, new Connectors.DiscordJS(client), config.lavalink.nodes);

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Shoukaku events
shoukaku.on('ready', (name) => console.log(`Lavalink ${name}: Ready!`));
shoukaku.on('close', (name, code, reason) => {
    // Only log server closure for non-normal close codes
    if (code !== 1000 && code < 4000) {
        console.warn(`Lavalink ${name}: Closed, Code ${code}`);
        setTimeout(() => {
            try {
                shoukaku.reconnect();
            } catch (reconnectErr) {
                // Only log critical reconnection errors
                console.error(`Reconnection failed`);
            }
        }, 5000);
    }
});
// Removed debug event listener to reduce log spam
shoukaku.on('disconnect', (name, players, moved) => {
    if (moved) return;
    players.map(player => player.connection.disconnect());

    setTimeout(() => {
        try {
            shoukaku.reconnect();
        } catch (reconnectErr) {
            // Only log critical errors
            console.error(`Reconnection failed`);
        }
    }, 5000);
});
shoukaku.on('error', (name, error) => {
    console.error(`Lavalink ${name} Error:`, error.message || 'Unknown error');

    // Handle various error types with customized reconnection strategies
    if (error && error.message) {
        // Prepare for reconnection
        let reconnectDelay = 10000; // Default 10 seconds

        if (error.message.includes('AbortError')) {
            console.log('Connection aborted, will try again shortly...');
            reconnectDelay = 5000; // Shorter delay for abort errors
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Connection refused')) {
            console.log('Connection refused, server may be down. Will retry in a moment...');
            reconnectDelay = 15000; // Longer delay for refused connections
        } else if (error.message.includes('Transport failed') || error.message.includes('Connection reset')) {
            console.log('Transport error detected, reconnecting...');
            reconnectDelay = 7500; // Medium delay for transport issues
        }

        // Schedule reconnection with the appropriate delay
        setTimeout(() => {
            try {
                shoukaku.reconnect();
                console.log(`Attempting to reconnect to Lavalink ${name}...`);
            } catch (reconnectErr) {
                console.error(`Failed to reconnect to Lavalink ${name}:`, reconnectErr.message || 'Unknown error');
            }
        }, reconnectDelay);
    }
});

// Kazagumo events
// Event when a track ends
client.kazagumo.on('playerEnd', async (player) => {
    try {
        // Log the player end event
        logger.player('end', player, player.queue.previous || null, 'Track playback ended');
        
        // Find and edit the now playing message to remove components
        const storedMessage = client.nowPlayingMessages.get(player.guildId);
        if (storedMessage) {
            const channel = client.channels.cache.get(storedMessage.channelId);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(storedMessage.messageId);
                    if (message && message.editable) {
                        await message.edit({ components: [] }).catch(() => {});
                    }
                } catch (error) {
                    // Silent catch for message fetching errors
                }
            }
        }
    } catch (error) {
        // Log the error to webhook and silence console error
        logger.error('playerEnd event', error);
    }
});

client.kazagumo.on('playerStart', async (player, track) => {
    // Log track start to webhook instead of console
    logger.player('start', player, track, 'Track playback started');
    
    // Clear any inactivity timeout when playback starts
    if (client.inactivityTimeouts && client.inactivityTimeouts.has(player.guildId)) {
        clearTimeout(client.inactivityTimeouts.get(player.guildId));
        client.inactivityTimeouts.delete(player.guildId);
    }

    // Set bot activity, but don't show track name (per user request)
    client.user.setActivity('/help', { type: 2 }); // Type 2 is "Listening to"
    
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        try {
            // Use the music card image for Now Playing
            const { createMusicCard, formatDuration } = require('./utils/formatters');
            const { createEmbed } = require('./utils/embeds');
            
            // Generate music card with track info
            // Create a modified track with zero duration for index.js per user request
            const trackWithZeroDuration = {...track, length: 0};
            const musicCard = await createMusicCard(trackWithZeroDuration, true);
            
            // Prepare message content based on whether we got an image or fallback embed
            let messageContent = {};
            
            if (Buffer.isBuffer(musicCard)) {
                // For the image buffer, we'll create an attachment using AttachmentBuilder
                const attachment = new AttachmentBuilder(musicCard, { name: 'nowplaying.png' });
                
                // Create an embed with the track name and requester and image
                // Duration set to 0 in index.js per user request
                const { EmbedBuilder } = require('discord.js');
                // Get track duration for the formatted description
                const duration = track.isStream ? 'LIVE' : formatDuration(track.length);
                
                const nowPlayingEmbed = new EmbedBuilder()
                    .setTitle('Now Playing')
                    .setDescription(`**[${track.title}](${config.supportServer})** • \`${duration}\`\n<@${track.requester.id}>`)
                    .setColor('#87CEEB') // Sky blue to match the card
                    .setImage('attachment://nowplaying.png');
                
                messageContent = {
                    embeds: [nowPlayingEmbed],
                    files: [attachment]
                };
            } else {
                // Fallback to the embed if image creation failed
                messageContent = {
                    embeds: [musicCard]
                };
            }

            // Add buttons and filter select menu for now playing message

            // Button row with essential controls - using combined pause/resume button
            // Initial label is "Pause" because the player is playing when this is created
            // Label will dynamically change to "Resume" when paused and back to "Pause" when resumed
            const nowPlayingRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pauseresume')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replay')
                        .setLabel('Replay')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Create a dropdown menu for filters
            const filtersSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('filter_select')
                .setPlaceholder('Select a filter')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions([
                    {
                        label: 'No Filter',
                        description: 'Remove all filters',
                        value: 'none'
                    },
                    {
                        label: 'Bass Boost',
                        description: 'Enhance the bass frequencies',
                        value: 'bassboost'
                    },
                    {
                        label: '8D Audio',
                        description: 'Creates a spatial rotation effect',
                        value: '8d'
                    },
                    {
                        label: 'Nightcore',
                        description: 'Faster with tremolo effect',
                        value: 'nightcore'
                    },
                    {
                        label: 'Vaporwave',
                        description: 'Slowed down with reverb-like effect',
                        value: 'vaporwave'
                    },
                    {
                        label: 'Karaoke',
                        description: 'Reduces vocals for karaoke',
                        value: 'karaoke'
                    },
                    {
                        label: 'Low Pass',
                        description: 'Reduces high frequencies',
                        value: 'lowpass'
                    },
                    {
                        label: 'Slow Mode',
                        description: 'Slows down the playback',
                        value: 'slowmode'
                    }
                ]);

            // Create filter dropdown row
            const filtersDropdownRow = new ActionRowBuilder()
                .addComponents(filtersSelectMenu);

            // Add additional control buttons
            const controlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setLabel('Shuffle')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger)
                );

                        // Send the message with music card and controls
            const message = await channel.send({
                ...messageContent,
                components: [filtersDropdownRow, nowPlayingRow, controlsRow]
            });

            // Store the message ID in the map
            client.nowPlayingMessages.set(player.guildId, { 
                channelId: channel.id, 
                messageId: message.id 
            });

        } catch (error) {
            // Silent error handling - create fallback embed
            const { createEmbed } = require('./utils/embeds');
            
            // Get track duration for the formatted description
            const duration = track.isStream ? 'LIVE' : formatDuration(track.length);
            
            const embed = createEmbed({
                title: `Now Playing`,
                description: `**[${track.title}](${process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy'})** • \`${duration}\``,
                color: '#87CEEB'
            });

            // Create a simplified dropdown for fallback

            const fallbackFilterMenu = new StringSelectMenuBuilder()
                .setCustomId('filter_select')
                .setPlaceholder('Select a filter')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions([
                    {
                        label: 'No Filter',
                        description: 'Remove all filters',
                        value: 'none'
                    },
                    {
                        label: 'Bass Boost',
                        description: 'Enhance the bass frequencies',
                        value: 'bassboost'
                    },
                    {
                        label: '8D Audio',
                        description: 'Creates a spatial rotation effect',
                        value: '8d'
                    },
                    {
                        label: 'Nightcore',
                        description: 'Faster with tremolo effect',
                        value: 'nightcore'
                    },
                    {
                        label: 'Vaporwave',
                        description: 'Slowed down effect',
                        value: 'vaporwave'
                    },
                    {
                        label: 'Karaoke',
                        description: 'Reduces vocals for karaoke',
                        value: 'karaoke'
                    },
                    {
                        label: 'Low Pass',
                        description: 'Reduces high frequencies',
                        value: 'lowpass'
                    },
                    {
                        label: 'Slow Mode',
                        description: 'Slows down the playback',
                        value: 'slowmode'
                    }
                ]);

            const fallbackFilterRow = new ActionRowBuilder()
                .addComponents(fallbackFilterMenu);

            // Add a basic controls row as well for fallback - using combined pause/resume
            // Using "Pause/Resume" as a toggle button
            const fallbackControlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pauseresume')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setLabel('Shuffle')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Send fallback embed with components
            channel.send({ 
                embeds: [embed],
                components: [fallbackFilterRow, fallbackControlsRow]
            }).then(message => {
                // Store the message ID in the map
                client.nowPlayingMessages.set(player.guildId, { 
                    channelId: channel.id, 
                    messageId: message.id 
                });
            }).catch(() => {});
        }
    }
});

client.kazagumo.on('playerEmpty', async (player) => {
    // Log the queue empty event
    logger.player('empty', player, null, 'Queue is now empty');
    
    // Reset bot activity when queue is empty
    client.user.setActivity('/help', { type: 2 });
    
    const channel = client.channels.cache.get(player.textId);
    const guildId = player.guildId;

    // First, remove components from the now playing message if it exists
    try {
        const messageInfo = client.nowPlayingMessages.get(guildId);
        if (messageInfo) {
            const messageChannel = client.channels.cache.get(messageInfo.channelId);
            if (messageChannel) {
                try {
                    const message = await messageChannel.messages.fetch(messageInfo.messageId);
                    if (message && message.editable) {
                        // Remove all components (buttons)
                        await message.edit({ components: [] }).catch(() => {});
                    }
                } catch (fetchError) {
                    // Silent catch - no need to log
                }
            }
        }
    } catch (error) {
        // Silent catch - no need to log
    }

    // When player is empty, send a message with working buttons to inform users
    if (channel) {
        // Create buttons that work even with no active player
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play')
                    .setLabel('Play Music')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('leave')
                    .setLabel('Leave Channel')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Send a simple queue ended message with buttons
        try {
            const { createEmbed } = require('./utils/embeds');
            const queueEndedEmbed = createEmbed({
                title: 'Queue Ended',
                description: 'Use the buttons below or type `/play` to play more music!'
            });

            await channel.send({
                embeds: [queueEndedEmbed],
                components: [actionRow]
            });
        } catch (error) {
            // Silent catch - no need to log
        }
    }

    // Autoplay functionality
    if (client.autoplay && client.autoplay.has(guildId) && player.queue.previous) {
        try {
            // Get a random genre/mood to search for completely different tracks
            const genres = ['pop', 'rock', 'hip hop', 'dance', 'electronic', 'chill', 'top hits', 'popular', 'trending', 'new music', 'music mix'];
            const randomGenre = genres[Math.floor(Math.random() * genres.length)];

            // Get the last played track (just for the requester)
            const lastTrack = player.queue.previous.length > 0 ? 
                player.queue.previous[player.queue.previous.length - 1] : null;

            const requester = lastTrack ? lastTrack.requester : null;

            // Search for completely new tracks on YouTube Music using a random genre
            const result = await client.kazagumo.search(randomGenre, {
                engine: 'youtube_music', // Use YouTube Music for autoplay
                requester: requester
            });

            if (result && result.tracks.length > 0) {
                // Mix up the results to get more variety
                const shuffledTracks = result.tracks.sort(() => Math.random() - 0.5);

                // Get completely different tracks - take 5 random ones 
                const tracksToAdd = shuffledTracks.slice(0, 5);
                player.queue.add(tracksToAdd);

                // Start playing if not already playing
                if (!player.playing && !player.paused) {
                    await player.play();
                }

                // Send an autoplay message with information about the upcoming tracks
                if (channel) {
                    try {
                        // Get the next track to play (first in queue)
                        const nextTrack = player.queue.tracks[0];
                        
                        if (nextTrack) {
                            const { createEmbed } = require('./utils/embeds');
                            
                            // Get track duration for the formatted description
                            const duration = nextTrack.isStream ? 'LIVE' : formatDuration(nextTrack.length);
                            
                            // Create a simple embed for autoplay with track name • duration • author format
                            const autoplayEmbed = createEmbed({
                                title: 'Autoplay Continues',
                                description: `Added tracks to keep the music going.\n\n**Next:** **[${nextTrack.title}](${config.supportServer})** • \`${duration}\``,
                                color: '#87CEEB'
                            });
                            
                            const messageContent = {
                                embeds: [autoplayEmbed]
                            };
                            
                            await channel.send(messageContent);
                        } else {
                            // Fallback if no next track is available
                            const { createEmbed } = require('./utils/embeds');
                            const autoplayEmbed = createEmbed({
                                title: 'Autoplay',
                                description: 'Music will continue playing automatically.',
                                color: '#87CEEB'
                            });
                            
                            await channel.send({ embeds: [autoplayEmbed] });
                        }
                    } catch (error) {
                        // Simple fallback in case of error
                        const { createEmbed } = require('./utils/embeds');
                        const fallbackEmbed = createEmbed({
                            title: 'Autoplay',
                            description: 'Music will continue playing automatically.',
                            color: '#87CEEB'
                        });
                        
                        await channel.send({ embeds: [fallbackEmbed] }).catch(() => {});
                    }
                }

                // Return early since we're continuing playback
                return;
            }
        } catch (error) {
            // Handle error silently without logging to console
        }
    }

    // Don't disconnect if 24/7 mode is enabled
    if (client.twentyFourSeven.has(guildId)) return;

    if (channel) {
        // Set a timeout to destroy the player with no second message

        // Set a timeout to destroy the player if no new songs are added AND the player is still empty
        const inactivityTimeout = setTimeout(() => {
            const currentPlayer = client.kazagumo.players.get(guildId);
            // Only destroy if: player exists, queue is empty, player is not playing, and 24/7 mode is off
            if (currentPlayer && 
                (!currentPlayer.queue.current || currentPlayer.queue.isEmpty) && 
                !currentPlayer.playing && 
                !client.twentyFourSeven.has(guildId)) {

                currentPlayer.destroy();
                const { createEmbed } = require('./utils/embeds');
                const leaveEmbed = createEmbed({
                    title: 'Channel Left',
                    description: 'Left voice channel due to inactivity.'
                });

                channel.send({ 
                    embeds: [leaveEmbed]
                }).catch(() => {});
            }
        }, 180000); // Extended to 3 minutes for better user experience

        // Store the timeout so we can clear it if playback resumes
        if (!client.inactivityTimeouts) client.inactivityTimeouts = new Map();
        client.inactivityTimeouts.set(guildId, inactivityTimeout);
    }
});

client.kazagumo.on('playerException', (player, error) => {
    // Log to webhook instead of console
    logger.error('playerException', error, [
        { name: 'Guild ID', value: player.guildId, inline: true },
        { name: 'Voice Channel ID', value: player.voiceId || 'N/A', inline: true }
    ]);

    const channel = client.channels.cache.get(player.textId);

    // Determine if we need to recover the player
    let needsRecovery = false;
    let errorMessage = `**An error occurred while playing**: ${error.message || 'Unknown error'}`;

    if (error.message) {
        if (error.message.includes('destroyed') || error.message.includes('not found')) {
            // Player was destroyed or not found
            errorMessage = `**Connection Error**: Music player was disconnected unexpectedly. Use a command to reconnect.`;
            needsRecovery = false; // Let the user reconnect manually
        } else if (error.message.includes('Track stuck') || error.message.includes('load failed')) {
            // Track playback issues
            errorMessage = `**Playback Error**: The current track failed to load or got stuck. Skipping to the next song...`;
            needsRecovery = true;
        } else if (error.message.includes('Connection') || error.message.includes('WebSocket')) {
            // Connection issues
            errorMessage = `**Connection Error**: Lost connection to the music server. Attempting to reconnect...`;
            needsRecovery = true;
        }
    }

    if (channel) {
        const { createEmbed } = require('./utils/embeds');
        const errorEmbed = createEmbed({
            title: 'Playback Error',
            description: errorMessage.replace(/\*\*/g, ''),
            color: 0xff0000 // Red color for errors
        });

        channel.send({ embeds: [errorEmbed] }).catch(() => {});
    }

    // Try to recover the player if needed
    if (needsRecovery && player) {
        try {
            // Skip to next song if available, otherwise stop
            if (player.queue.length > 0) {
                player.skip().catch(() => {
                    // If skip fails, try to stop and destroy
                    player.destroy().catch(() => {});
                });
            } else {
                player.destroy().catch(() => {});
            }
        } catch (recoveryError) {
            // Silent catch
        }
    }
});

client.kazagumo.on('playerError', (player, error) => {
    // Log to webhook instead of console
    logger.error('playerError', error, [
        { name: 'Guild ID', value: player.guildId, inline: true },
        { name: 'Voice Channel ID', value: player.voiceId || 'N/A', inline: true }
    ]);

    const channel = client.channels.cache.get(player.textId);

    // Build a more detailed error message
    let errorMessage = `**Player Error**: ${error.message || 'Unknown error'}`;

    if (error.message) {
        if (error.message.includes('No available nodes')) {
            errorMessage = `**Connection Error**: Cannot connect to the music server. Please try again later.`;
        } else if (error.message.includes('Failed to decode')) {
            errorMessage = `**Playback Error**: This track cannot be played due to format issues. Please try another song.`;
        } else if (error.message.includes('Track information not available')) {
            errorMessage = `**Track Error**: Could not retrieve track information. The source may be unavailable.`;
        }
    }

    if (channel) {
        const { createEmbed } = require('./utils/embeds');
        const errorEmbed = createEmbed({
            title: 'Player Error',
            description: errorMessage.replace(/\*\*/g, ''),
            color: 0xff0000 // Red color for errors
        });

        channel.send({ embeds: [errorEmbed] }).catch(() => {});
    }

    // Attempt to reconnect if needed
    if (error.message && 
        (error.message.includes('No available nodes') || 
         error.message.includes('Connection') || 
         error.message.includes('WebSocket'))) {

        setTimeout(() => {
            try {
                // Check if Lavalink nodes are available
                const nodesAvailable = shoukaku.nodes.filter(node => node.state === 1);

                if (nodesAvailable.length > 0) {
                    const guildId = player.guildId;
                    const voiceId = player.voiceId;
                    const textId = player.textId;

                    // Destroy current player
                    player.destroy().catch(() => {});

                    // Create a new player after a short delay
                    setTimeout(() => {
                        if (voiceId && guildId) {
                            try {
                                client.kazagumo.createPlayer({
                                    guildId: guildId,
                                    voiceId: voiceId,
                                    textId: textId,
                                    deaf: true
                                });

                                if (channel) {
                                    const { createEmbed } = require('./utils/embeds');
                                    const reconnectEmbed = createEmbed({
                                        title: 'Reconnected',
                                        description: 'Successfully reconnected to the voice channel.'
                                    });

                                    channel.send({ embeds: [reconnectEmbed] }).catch(() => {});
                                }
                            } catch (e) {
                                // Silent catch for failed player creation
                            }
                        }
                    }, 2000);
                }
            } catch (reconnectError) {
                // Silent catch
            }
        }, 5000);
    }
});

// Login to Discord
// Add interactionCreate handler for buttons and filter buttons
client.on('interactionCreate', async (interaction) => {
    // Handle command not found errors gracefully
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            const { createEmbed } = require('./utils/embeds');
            return interaction.reply({
                embeds: [createEmbed({
                    title: 'Command Not Found',
                    description: `The command \`${interaction.commandName}\` was not found. Use \`/help\` to see available commands.`,
                    color: '#ff0000'
                })],
                ephemeral: true
            });
        }
    }

    // Handle special button interactions
    if (interaction.isButton()) {
        // Handle info/utility buttons
        if (interaction.customId === 'help') {
            const helpText = `**Bot Help**
Here are the main commands you can use:

• \`/play\` - Play a song by name or URL
• \`/queue\` - View the current queue
• \`/skip\` - Skip the current track
• \`/stop\` - Stop playback and clear queue
• \`/247\` - Toggle 24/7 mode
• \`/help\` - Show detailed help`;

            return interaction.reply({ content: helpText, ephemeral: true });
        }

        if (interaction.customId === 'play') {
            return interaction.reply({ 
                content: 'Please use the `/play` command followed by a song name or URL to add a track to the queue.', 
                ephemeral: true 
            });
        }

        if (interaction.customId === '247toggle') {
            const guild = interaction.guild;
            const member = interaction.member;

            if (!member.voice.channel) {
                return interaction.reply({ 
                    content: 'You must be in a voice channel to toggle 24/7 mode!', 
                    ephemeral: true 
                });
            }

            // Toggle 24/7 mode
            if (client.twentyFourSeven.has(guild.id)) {
                client.twentyFourSeven.delete(guild.id);
                return interaction.reply({ 
                    content: '24/7 mode has been disabled. I will disconnect after inactivity.', 
                    ephemeral: true 
                });
            } else {
                client.twentyFourSeven.set(guild.id, member.voice.channel.id);
                return interaction.reply({ 
                    content: '24/7 mode has been enabled. I will stay in the voice channel indefinitely.', 
                    ephemeral: true 
                });
            }
        }

        if (interaction.customId === 'leave') {
            const guild = interaction.guild;
            const player = client.kazagumo.players.get(guild.id);

            if (!player) {
                return interaction.reply({ 
                    content: 'I am not in a voice channel!', 
                    ephemeral: true 
                });
            }

            // Force the player to disconnect
            player.destroy();
            return interaction.reply({ 
                content: 'Left the voice channel.', 
                ephemeral: true 
            });
        }
        
        // Music control buttons
        if (['pauseresume', 'skip', 'replay', 'shuffle', 'stop'].includes(interaction.customId)) {
            const guild = interaction.guild;
            const player = client.kazagumo.players.get(guild.id);
            const member = interaction.member;
            
            if (!player) {
                return interaction.reply({ 
                    content: 'There is no active player in this server!', 
                    ephemeral: true 
                });
            }
            
            // Check if user is in the same voice channel
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                // For all buttons except stop (which has its own validation)
                if (interaction.customId !== 'stop') {
                    return interaction.reply({ 
                        content: "You must be in the same voice channel as the bot to use the music controls!", 
                        ephemeral: true 
                    });
                }
            }
            
            // Handle each button type
            switch (interaction.customId) {
                case 'pause':
                    // Check if user is the requestor for pause button
                    const pauseTrack = player.queue.current;
                    if (pauseTrack && pauseTrack.requester.id !== interaction.user.id) {
                        return interaction.reply({
                            content: 'You cannot use this button! Only the person who requested this song can control it.',
                            ephemeral: true
                        });
                    }
                
                    // Explicitly pause the music
                    console.log("Pause button clicked, pausing music.");
                    
                    // Set the player state to paused
                    player.pause(true);
                    
                    // Log actual state after update for verification
                    console.log(`Player state after pause: paused=${player.paused}`);
                    
                    // Return appropriate message
                    return interaction.reply({ 
                        content: 'Paused the music! Click Resume to continue playback.', 
                        ephemeral: true 
                    });
                    
                case 'resume':
                    // Check if user is the requestor for resume button
                    const resumeTrack = player.queue.current;
                    if (resumeTrack && resumeTrack.requester.id !== interaction.user.id) {
                        return interaction.reply({
                            content: 'You cannot use this button! Only the person who requested this song can control it.',
                            ephemeral: true
                        });
                    }
                
                    // Explicitly resume the music
                    console.log("Resume button clicked, resuming music.");
                    
                    // Set the player state to not paused (playing)
                    player.pause(false);
                    
                    // Log actual state after update for verification
                    console.log(`Player state after resume: paused=${player.paused}`);
                    
                    // Return appropriate message
                    return interaction.reply({ 
                        content: 'Resumed the music! Click Pause to pause playback.', 
                        ephemeral: true 
                    });
                    
                // Keep backward compatibility with old 'pauseresume' button for a while
                case 'pauseresume':
                    // Legacy handler removed. All pause/resume logic is now in events/interactionCreate.js for reliability.
                    return interaction.reply({
                        content: 'Pause/Resume button logic has been updated. Please use the new controls.',
                        ephemeral: true
                    });
                    
                case 'skip':
                    // Check if user is the requestor for skip button
                    const skipTrack = player.queue.current;
                    if (skipTrack && skipTrack.requester.id !== interaction.user.id) {
                        return interaction.reply({
                            content: 'You cannot use this button! Only the person who requested this song can control it.',
                            ephemeral: true
                        });
                    }
                    
                    player.skip();
                    return interaction.reply({ 
                        content: 'Skipped to the next track!', 
                        ephemeral: true 
                    });
                    
                case 'replay':
                    // Stop the current track and restart it
                    const currentTrack = player.queue.current;
                    if (!currentTrack) {
                        return interaction.reply({ 
                            content: 'No track is currently playing!', 
                            ephemeral: true 
                        });
                    }
                    
                    // Check if user is the requestor for replay button
                    if (currentTrack.requester.id !== interaction.user.id) {
                        return interaction.reply({
                            content: 'You cannot use this button! Only the person who requested this song can control it.',
                            ephemeral: true
                        });
                    }
                    
                    // Stop the player and restart the same track
                    await player.seek(0);
                    await player.pause(true); // Pause first
                    setTimeout(() => {
                        player.pause(false); // Resume after a short delay
                    }, 500);
                    
                    return interaction.reply({ 
                        content: 'Stopped and restarted the current track!', 
                        ephemeral: true 
                    });
                    
                case 'shuffle':
                    // Get current track
                    const currentSong = player.queue.current;
                    if (!currentSong) {
                        return interaction.reply({ 
                            content: 'No track is currently playing!', 
                            ephemeral: true 
                        });
                    }
                    
                    // Check if user is the requestor for shuffle button
                    if (currentSong.requester.id !== interaction.user.id) {
                        return interaction.reply({
                            content: 'You cannot use this button! Only the person who requested this song can control it.',
                            ephemeral: true
                        });
                    }
                    
                    // Even if there are no additional tracks, we'll just give a specific message
                    if (player.queue.length === 0) {
                        return interaction.reply({ 
                            content: 'No additional tracks in queue. Add more songs to create a shuffle mix!', 
                            ephemeral: true 
                        });
                    }
                    
                    try {
                        // First shuffle the upcoming tracks
                        player.queue.shuffle();
                        
                        // Create an array with current song and all other tracks
                        const tracksToShuffle = [currentSong, ...player.queue.tracks];
                        
                        // Shuffle all tracks including current
                        for (let i = tracksToShuffle.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [tracksToShuffle[i], tracksToShuffle[j]] = [tracksToShuffle[j], tracksToShuffle[i]];
                        }
                        
                        // Clear the queue and add all shuffled tracks except the first one
                        player.queue.clear();
                        player.queue.add(tracksToShuffle.slice(1)); // Add all except first
                        
                        // Only skip if the first track is different from current
                        if (tracksToShuffle[0].uri !== currentSong.uri) {
                            // Add the first shuffled track to the beginning of the queue and skip
                            player.queue.add(tracksToShuffle[0], 0); // Insert at position 0
                            player.skip();
                        }
                        
                        return interaction.reply({ 
                            content: 'Shuffled all tracks including the current one!', 
                            ephemeral: true 
                        });
                    } catch (error) {
                        console.error("Error during shuffle:", error);
                        // If shuffle fails, send an error message
                        return interaction.reply({ 
                            content: 'Failed to shuffle the queue. Please try again.',
                            ephemeral: true 
                        });
                    }
                    break;
                    
                case 'stop':
                    // Get current track to check requestor
                    const trackToStop = player.queue.current;
                    if (!trackToStop) {
                        return interaction.reply({
                            content: 'No track is currently playing!',
                            ephemeral: true
                        });
                    }

                    // Check if user is the requestor
                    if (trackToStop.requester.id !== interaction.user.id) {
                        return interaction.reply({
                            content: 'You cannot use this button! Only the person who requested this song can stop it.',
                            ephemeral: true
                        });
                    }

                    try {
                        // Track if we've already shown the queue end message
                        let queueEndMessageShown = false;
                        
                        // Send queue end message before destroying
                        try {
                            const channel = client.channels.cache.get(player.textId);
                            if (channel) {
                                const { createEmbed } = require('./utils/embeds');
                                const queueEndEmbed = createEmbed({
                                    title: 'Queue Ended',
                                    description: `Music playback has been stopped by ${interaction.user}`,
                                    color: '#ff0000'
                                });
                                await channel.send({ embeds: [queueEndEmbed] });
                                queueEndMessageShown = true;
                            }
                        } catch (messageError) {
                            console.error("Error sending queue end message:", messageError);
                        }

                        // We'll destroy the player only if it hasn't been destroyed yet and exists
                        if (player && !player.destroyed) {
                            try {
                                console.log("Executing player.destroy()");
                                // Let's use a custom approach to destroy
                                await player.queue.clear(); // First clear the queue
                                
                                if (player.node && player.node.send) {
                                    // Attempt to send a stop instruction to the node
                                    try {
                                        await player.node.send({
                                            op: 'stop',
                                            guildId: player.guildId
                                        });
                                        console.log('Stop signal sent to node');
                                    } catch (stopError) {
                                        console.log('Could not send stop signal:', stopError.message);
                                    }
                                }
                                
                                // DO NOT directly call player.destroy() as it may cause race conditions
                                // Instead, let's just clear the queue and disconnect
                                try {
                                    if (player.voiceId && client.guilds.cache.get(player.guildId)) {
                                        const guild = client.guilds.cache.get(player.guildId);
                                        if (guild && guild.members && guild.members.me && guild.members.me.voice.channel) {
                                            await guild.members.me.voice.disconnect();
                                            console.log("Disconnected from voice channel");
                                        }
                                    }
                                } catch (disconnectError) {
                                    console.log("Error disconnecting from voice:", disconnectError.message);
                                }
                                console.log("Player destroyed successfully");
                            } catch (destroyError) {
                                console.log("Error destroying player (handled):", destroyError.message);
                                // Player is likely already destroyed, so we'll continue
                            }
                        } else {
                            console.log("Player already destroyed or doesn't exist");
                        }
                        
                        // Always respond to the interaction
                        return interaction.reply({
                            content: `Music playback has been stopped and the queue has been cleared.`,
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error("Error in stop button:", error);
                        return interaction.reply({
                            content: `Music playback has been stopped.`,
                            ephemeral: true
                        });
                    }
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        // Handle filter select menu (legacy support)
        if (interaction.customId === 'filter_select') {
            const selectedFilter = interaction.values[0];
            const guild = interaction.guild;
            const member = interaction.member;

            // Get the player instance for this server
            const player = client.kazagumo.players.get(guild.id);

            if (!player) {
                return interaction.reply({ 
                    content: 'There is no active player in this server!', 
                    ephemeral: true 
                });
            }
            
            // Check if user is in the same voice channel
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                return interaction.reply({ 
                    content: "You must be in the same voice channel as the bot to use filters!", 
                    ephemeral: true 
                });
            }
            
            // Check if user is the requestor for filter controls
            const currentTrack = player.queue.current;
            if (currentTrack && currentTrack.requester.id !== interaction.user.id) {
                return interaction.reply({
                    content: 'You cannot use this menu! Only the person who requested this song can apply filters.',
                    ephemeral: true
                });
            }

            try {
                // Import filter utilities
                const { applyFilter, clearFilters, getFilterDisplayName } = require('./utils/filters');

                // Handle 'none' selection (clear filters)
                if (selectedFilter === 'none') {
                    await clearFilters(player);
                    await interaction.reply({
                        content: 'All filters have been cleared!',
                        ephemeral: true
                    });
                } else {
                    // Apply the selected filter
                    const success = await applyFilter(player, selectedFilter);

                    if (success) {
                        await interaction.reply({
                            content: `Applied the ${getFilterDisplayName(selectedFilter)} filter!`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `Failed to apply the filter. Please try again.`,
                            ephemeral: true
                        });
                    }
                }
            } catch (error) {
                // Silent error handling
                await interaction.reply({
                    content: 'An error occurred while applying the filter. Please try again.',
                    ephemeral: true
                });
            }
        }
    }
});

// Add more detailed error handling for login
console.log('Attempting to log in to Discord...');

// Add a 30-second timeout for login
const loginTimeout = setTimeout(() => {
    console.error('Discord login timeout after 30 seconds. Possible network issue or invalid token.');
    console.error('Please check your internet connection and verify the bot token is valid.');
    console.error('The process will now exit to prevent hanging.');
    process.exit(1); // Exit with error code
}, 30000);

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        clearTimeout(loginTimeout); // Clear the timeout if login succeeds
        console.log('Successfully logged in to Discord!');
        
        // Log successful bot startup to webhook
        logger.system('Bot Startup', `Bot successfully started and logged in as ${client.user.tag}`, [
            { name: 'Guilds', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Users', value: `${client.users.cache.size}`, inline: true },
            { name: 'Lavalink Status', value: 'Connected', inline: true }
        ]);
    })
    .catch(error => {
        clearTimeout(loginTimeout); // Clear the timeout if login fails with an error
        console.error('Failed to log in to Discord:', error.message);

        // Create a detailed error message
        let errorDetails = 'Unknown login error';
        if (error.message.includes('token')) {
            errorDetails = 'DISCORD_TOKEN is invalid. Please check your environment variables.';
            console.error(errorDetails);
        } else if (error.message.includes('network') || error.message.includes('connect')) {
            errorDetails = 'Network error. Please check your internet connection.';
            console.error(errorDetails);
        } else {
            errorDetails = 'Unknown error occurred during login. Please try again later.';
            console.error(errorDetails);
        }

        // Log login error to webhook (if available)
        try {
            logger.error('Discord Login', `Failed to log in: ${error.message}`, [
                { name: 'Error Details', value: errorDetails, inline: false }
            ]);
        } catch (logError) {
            // Silent catch - if webhook logging fails during login
        }

        process.exit(1); // Exit with error code
    });

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));
