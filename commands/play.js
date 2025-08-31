const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { createMusicCard, formatDuration } = require('../utils/formatters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from name/URL')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('Song name or URL')
                .setRequired(true)),
    
    async execute(interaction) {
        // Store reference to helpers
        const sendInitialError = async (message) => {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        embeds: [errorEmbed(message)], 
                        ephemeral: true 
                    });
                }
            } catch (e) {
                console.error('Failed to send initial error:', e);
            }
        };

        // Get essential data
        const { client } = interaction;
        const query = interaction.options.getString('query');
        const source = 'youtube_music'; // Use YouTube Music
        const guildId = interaction.guildId;
        const textChannel = interaction.channel;
        
        // Check if the user is in a voice channel
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel) {
            return sendInitialError('You need to be in a voice channel to use this command!');
        }
        
        // Check bot permissions for the voice channel
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return sendInitialError('I need permissions to join and speak in your voice channel!');
        }
        
        // Defer the reply to prevent timeout
        let interactionHandled = false;
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply();
            }
            
            // Resolve the track/playlist with better error handling
            const result = await client.kazagumo.search(query, { 
                engine: source, // Use YouTube Music
                requester: interaction.user 
            }).catch(error => {
                console.error('Search error in play command:', error);
                if (error.message && error.message.includes('AbortError')) {
                    throw new Error('Connection to music server was interrupted. Please try again.');
                } else if (error.message && error.message.includes('fetch failed')) {
                    throw new Error('Unable to connect to music server. Please try again later.');
                } else {
                    throw new Error(`Unable to search: ${error.message || 'Unknown error'}`);
                }
            });
            
            if (!result || !result.tracks.length) {
                interactionHandled = true;
                return await interaction.editReply({ 
                    embeds: [errorEmbed('No results found for your query!')] 
                });
            }
            
            // Create or get the player
            const player = client.kazagumo.players.get(guildId) || 
                await client.kazagumo.createPlayer({
                    guildId: guildId,
                    voiceId: voiceChannel.id,
                    textId: textChannel.id,
                    deaf: true
                });
            
            // Handle different result types
            if (result.type === 'PLAYLIST') {
                // Add all tracks from playlist
                player.queue.add(result.tracks);
                
                // Create a playlist added embed with the first track thumbnail
                const playlistEmbed = createEmbed({
                    title: `Playlist Added`,
                    description: `**[${result.playlistName}](${config.supportServer})**\n${result.tracks.length} tracks • ${calculatePlaylistDuration(result.tracks)}`,
                    thumbnail: result.tracks[0]?.thumbnail || null
                });
                
                interactionHandled = true;
                await interaction.editReply({ 
                    embeds: [playlistEmbed], 
                    components: [] 
                });
            } else {
                // Add single track
                const track = result.tracks[0];
                player.queue.add(track);
                
                // Create a simple embed for the track
                const trackEmbed = createEmbed({
                    title: 'Added to Queue',
                    description: `**[${track.title}](${config.supportServer})**`,
                    color: '#f47fff'
                });
                
                const replyContent = {
                    embeds: [trackEmbed],
                    components: []
                };
                
                interactionHandled = true;
                await interaction.editReply(replyContent);
            }
            
            // Start playback if not already playing
            if (!player.playing && !player.paused) {
                try {
                    await player.play();
                } catch (playbackError) {
                    console.error('Error starting playback:', playbackError);
                    
                    // Handle specific errors with user-friendly messages
                    let errorMsg = 'Failed to play the track';
                    
                    if (playbackError.message) {
                        if (playbackError.message.includes('load failed')) {
                            errorMsg = 'This track could not be loaded. It may be unavailable or restricted.';
                        } else if (playbackError.message.includes('No available nodes')) {
                            errorMsg = 'Music servers are currently unavailable. Please try again later.';
                        } else if (playbackError.message.includes('Connection')) {
                            errorMsg = 'Connection to the voice channel was lost. Please try again.';
                        } else {
                            errorMsg = `Playback error: ${playbackError.message}`;
                        }
                    }
                    
                    // Only attempt to edit if we haven't already provided a final response
                    if (!interactionHandled && interaction.deferred) {
                        await interaction.editReply({ 
                            embeds: [errorEmbed(errorMsg)]
                        }).catch(e => console.error('Failed to send playback error:', e));
                        interactionHandled = true;
                    }
                }
            }
        } catch (error) {
            console.error('Error in play command:', error);
            
            // Create a user-friendly error message based on the error type
            let errorMessage = 'An unknown error occurred while processing your request.';
            
            if (error.message) {
                if (error.message.includes('No results found')) {
                    errorMessage = 'No tracks were found for your search query. Please try a different query.';
                } else if (error.message.includes('invalid URL')) {
                    errorMessage = 'The URL you provided is invalid or not supported.';
                } else if (error.message.includes('ERR_UNHANDLED_ERROR')) {
                    errorMessage = 'An unexpected error occurred. This has been logged for investigation.';
                } else if (error.message.includes('Timeout')) {
                    errorMessage = 'The request timed out. Please check your connection and try again.';
                } else if (error.message.includes('rate limit')) {
                    errorMessage = 'Too many requests. Please wait a moment before trying again.';
                } else {
                    // For other errors, use a sanitized message
                    const safeMessage = error.message.replace(/[^\w\s.,!?:;-]/g, '');
                    errorMessage = `Error: ${safeMessage.slice(0, 150)}${safeMessage.length > 150 ? '...' : ''}`;
                }
            }
            
            // Only respond if we haven't already provided a final response
            if (!interactionHandled) {
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({ 
                            embeds: [errorEmbed(errorMessage)]
                        });
                    } else if (!interaction.replied) {
                        await interaction.reply({ 
                            embeds: [errorEmbed(errorMessage)], 
                            ephemeral: true 
                        });
                    }
                } catch (responseError) {
                    console.error('Failed to send error response:', responseError);
                }
            }
        }
    },
};

// Helper functions for this file are imported from utils/formatters.js

function calculatePlaylistDuration(tracks) {
    const totalMs = tracks.reduce((acc, track) => {
        if (track.isStream) return acc;
        return acc + track.length;
    }, 0);
    
    const seconds = Math.floor((totalMs / 1000) % 60);
    const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
    
    return parts.join(', ');
}

function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}
