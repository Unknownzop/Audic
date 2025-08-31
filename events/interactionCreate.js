const { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionResponse, StringSelectMenuBuilder } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const config = require('../config');
const logger = require('../utils/logger');

// Helper function to create volume bar for volume buttons
function createVolumeBar(volume) {
    const maxBars = 10;
    const filledBars = Math.round((volume / 100) * maxBars);
    const emptyBars = maxBars - filledBars;
    
    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
}

// Helper function to safely respond to interactions
async function safeReply(interaction, options) {
    try {
        // Use flags.ephemeral instead of ephemeral to avoid deprecation warnings
        if (options.ephemeral) {
            options.flags = { ephemeral: true };
            delete options.ephemeral;
        }
        
        // Only attempt to reply if the interaction hasn't been replied to
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options).catch(() => null);
        } else {
            return await interaction.reply(options).catch(() => null);
        }
    } catch (error) {
        // Silent error handling
        return null;
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                // Silent handling for unknown commands
                return;
            }

            try {
                // Log command usage to webhook
                let commandArgs = '';
                if (interaction.options && interaction.options.data && interaction.options.data.length > 0) {
                    commandArgs = interaction.options.data.map(option => {
                        if (option.name === 'query' || option.name === 'song') {
                            return `${option.name}: "${option.value}"`;
                        }
                        return `${option.name}: ${option.value}`;
                    }).join(', ');
                }
                logger.command(interaction, interaction.commandName, commandArgs);
                
                // Execute the command
                await command.execute(interaction);
            } catch (error) {
                // Log the error to the webhook
                try {
                    logger.error(
                        `Command /${interaction.commandName}`, 
                        error,
                        [
                            { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                            { name: 'Guild', value: `${interaction.guild ? interaction.guild.name : 'DM'} (${interaction.guild ? interaction.guild.id : 'N/A'})`, inline: true }
                        ]
                    );
                } catch (logError) {
                    // Silent error handling for logger
                }
                
                // Only handle the error if the interaction is still valid and hasn't timed out
                try {
                    const errorMessage = 'There was an error while executing this command!';
                    
                    // Try to reply depending on the current interaction state
                    if (interaction.replied) {
                        await interaction.followUp({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(() => {});
                    } else if (interaction.deferred) {
                        await interaction.editReply({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(() => {});
                    } else {
                        await interaction.reply({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(() => {});
                    }
                } catch (followUpError) {
                    // Silent error handling - can't do anything more if this fails
                }
            }
        }
        
        // Re-enabled button interactions in this file
        // since they're not fully implemented in index.js
        if (interaction.isButton()) {
            // Log button interaction
            try {
                logger.command(interaction, `Button: ${interaction.customId}`, '');
            } catch (error) {
                // Silent error for logger
            }
            
            // Handle button interactions silently
            const { client, guild } = interaction;
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                // Handle special case for buttons that don't need an active player
                if (interaction.customId === 'play' || interaction.customId === 'help' || interaction.customId === '247toggle' || interaction.customId === 'leave') {
                    // These buttons will be handled in their respective switch cases
                } else {
                    // Use safeReply for safer interaction handling
                    await safeReply(interaction, { 
                        content: 'No active player found! Start playback with the /play command.',
                        ephemeral: true
                    });
                    return;
                }
                return;
            }
            
            // Check if user is in the same voice channel
            const member = interaction.member;
            
            // Skip voice channel check for buttons that can be used from anywhere
            if (interaction.customId === 'help' || interaction.customId === 'play') {
                // These buttons don't require voice channel check
            } 
            // Check if player needs voice channel
            else if (player && (!member.voice.channel || member.voice.channel.id !== player.voiceId)) {
                await safeReply(interaction, { 
                    content: 'You must be in the same voice channel to use these controls!',
                    ephemeral: true
                });
                return;
            }
            
            try {
                switch (interaction.customId) {
                    case 'replay':
                        try {
                            // Get the current track
                            const currentTrack = player.queue.current;
                            if (!currentTrack) {
                                await interaction.reply({
                                    content: 'No track is currently playing!',
                                    ephemeral: true
                                }).catch(() => {});
                                break;
                            }

                            // Always unpause before seeking
                            if (player.paused) {
                                await player.pause(false);
                                await new Promise(res => setTimeout(res, 100));
                            }
                            // Always seek to 0 (restart track)
                            await player.seek(0);
                            await new Promise(res => setTimeout(res, 100));
                            // Explicitly call play to force playback
                            await player.play();
                            await new Promise(res => setTimeout(res, 200));

                            // Fallback: if still not playing, unpause and play again
                            if (!player.playing) {
                                await player.pause(false);
                                await player.play();
                            }

                            // Refresh the Now Playing UI controls if possible
                            const messageInfo = client.nowPlayingMessages.get(guild.id);
                            if (messageInfo) {
                                try {
                                    const messageChannel = client.channels.cache.get(messageInfo.channelId);
                                    if (messageChannel) {
                                        const message = await messageChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                                        if (message && message.editable) {
                                            const updatedRows = [];
                                            for (const row of message.components) {
                                                const newRow = new ActionRowBuilder();
                                                const newComponents = [];
                                                for (const component of row.components) {
                                                    if (component.type === 2) { // Button type
                                                        const newButton = new ButtonBuilder()
                                                            .setCustomId(component.customId)
                                                            .setStyle(component.style)
                                                            .setLabel(component.label);
                                                        newComponents.push(newButton);
                                                    } else if (component.type === 3) { // Select menu type
                                                        const selectMenu = new StringSelectMenuBuilder()
                                                            .setCustomId(component.customId)
                                                            .setPlaceholder(component.placeholder)
                                                            .addOptions(component.options);
                                                        newRow.addComponents(selectMenu);
                                                    }
                                                }
                                                if (newComponents.length > 0) {
                                                    newRow.addComponents(newComponents);
                                                }
                                                if (newRow.components && newRow.components.length > 0) {
                                                    updatedRows.push(newRow);
                                                }
                                            }
                                            if (updatedRows.length > 0) {
                                                await message.edit({ components: updatedRows }).catch(() => {});
                                            }
                                        }
                                    }
                                } catch (error) {
                                    // Silent error
                                }
                            }

                            await interaction.reply({
                                content: `Replaying track: **${currentTrack.title}**`,
                                ephemeral: true
                            }).catch(() => {});
                        } catch (error) {
                            await safeReply(interaction, {
                                content: 'Failed to replay the track. Please try again.',
                                ephemeral: true
                            });
                        }
                        break;
                        
                    // Combined pause/resume toggle button
                    case 'pauseresume':
                        try {
                            // Debug the current state
                            console.log(`Pause/Resume button clicked - Current paused state: ${player.paused}`);
                            
                            // Await the pause/resume operation and check the updated state
                            let newPausedState;
                            if (player.paused) {
                                await player.pause(false);
                                newPausedState = player.paused;
                            } else {
                                await player.pause(true);
                                newPausedState = player.paused;
                            }

                            // Wait a short moment to allow state to propagate (Kazagumo/Lavalink can be async)
                            await new Promise(res => setTimeout(res, 200));
                            // Re-fetch the player in case the state updated
                            const updatedPlayer = client.kazagumo.players.get(guild.id);
                            const actuallyPaused = updatedPlayer ? updatedPlayer.paused : newPausedState;

                            // Provide accurate feedback
                            if (actuallyPaused) {
                                await safeReply(interaction, {
                                    content: 'Music is paused.',
                                    ephemeral: true
                                });
                            } else {
                                await safeReply(interaction, {
                                    content: 'Music is resumed.',
                                    ephemeral: true
                                });
                            }

                            // Update the button's label if we have a message
                            const messageInfo = client.nowPlayingMessages.get(guild.id);
                            if (messageInfo) {
                                try {
                                    const messageChannel = client.channels.cache.get(messageInfo.channelId);
                                    if (messageChannel) {
                                        const message = await messageChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                                        if (message && message.editable) {
                                            // Keep the label as "Pause/Resume" for consistency
                                            const newLabel = "Pause/Resume";
                                            const updatedRows = [];
                                            for (const row of message.components) {
                                                const newRow = new ActionRowBuilder();
                                                const newComponents = [];
                                                for (const component of row.components) {
                                                    if (component.type === 2) { // Button type
                                                        const newButton = new ButtonBuilder()
                                                            .setCustomId(component.customId)
                                                            .setStyle(component.style);
                                                        if (component.customId === 'pauseresume') {
                                                            newButton.setLabel(newLabel);
                                                        } else {
                                                            newButton.setLabel(component.label);
                                                        }
                                                        newComponents.push(newButton);
                                                    } else if (component.type === 3) { // Select menu type
                                                        const selectMenu = new StringSelectMenuBuilder()
                                                            .setCustomId(component.customId)
                                                            .setPlaceholder(component.placeholder)
                                                            .addOptions(component.options);
                                                        newRow.addComponents(selectMenu);
                                                    }
                                                }
                                                if (newComponents.length > 0) {
                                                    newRow.addComponents(newComponents);
                                                }
                                                if (newRow.components && newRow.components.length > 0) {
                                                    updatedRows.push(newRow);
                                                }
                                            }
                                            if (updatedRows.length > 0) {
                                                await message.edit({ components: updatedRows }).catch(() => {});
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.error("Error updating pause/resume button:", error.message);
                                }
                            }
                        } catch (error) {
                            // Error handling for pause/resume
                            console.error("Error in pauseresume button:", error);
                            await safeReply(interaction, {
                                content: 'An error occurred while toggling pause/resume. Please try again.',
                                ephemeral: true
                            });
                        }
                        break;
                    
                    // Keep these for backward compatibility with any old messages
                    case 'pause':
                        try {
                            console.log("Legacy pause button used");
                            // Make sure it's not already paused
                            if (!player.paused) {
                                await player.pause(true);
                                console.log("Paused the playback");
                            } else {
                                console.log("Playback already paused");
                            }
                            await safeReply(interaction, { 
                                content: 'Paused the playback!',
                                ephemeral: true 
                            });
                        } catch (error) {
                            console.error("Error in pause button:", error);
                        }
                        break;
                        
                    case 'resume':
                        try {
                            console.log("Legacy resume button used");
                            // Make sure it's actually paused
                            if (player.paused) {
                                await player.pause(false);
                                console.log("Resumed the playback");
                            } else {
                                console.log("Playback already playing");
                            }
                            await safeReply(interaction, { 
                                content: 'Resumed the playback!',
                                ephemeral: true 
                            });
                        } catch (error) {
                            console.error("Error in resume button:", error);
                        }
                        break;
                        
                    case 'skip':
                        try {
                            // Get the current track before skipping
                            const currentTrack = player.queue.current;
                            
                            // Skip to the next track
                            await player.skip();
                            
                            // Get the now-playing track after skipping
                            const nextTrack = player.queue.current;
                            
                            // Use safe reply method
                            await safeReply(interaction, { 
                                content: 'Skipped to the next track!',
                                ephemeral: true 
                            });
                            
                            // Only refresh controls if there's a new track to play
                            if (nextTrack) {
                                // Get text channel
                                const channel = client.channels.cache.get(player.textId);
                                if (channel) {
                                    try {
                                        // This will trigger the events for the new track
                                        // which will create a new Now Playing message with controls
                                        setTimeout(() => {
                                            // Import required modules
                                            const { createMusicCard, formatDuration } = require('../utils/formatters');
                                            const { createEmbed } = require('../utils/embeds');
                                            
                                            // Create a new now playing message with buttons
                                            client.emit('refreshNowPlaying', player, nextTrack, channel);
                                        }, 500); // Small delay to ensure skip is fully processed
                                    } catch (refreshError) {
                                        console.error("Error refreshing now playing after skip:", refreshError);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error("Error in skip button:", error);
                            await safeReply(interaction, {
                                content: 'Failed to skip the track.',
                                ephemeral: true
                            });
                        }
                        break;
                        
                    case 'stop':
                        try {
                            // Get the message ID before destroying the player
                            const messageInfo = client.nowPlayingMessages.get(guild.id);
                            
                            // Make sure the user is in a voice channel and it's the same as the bot's
                            const member = interaction.member;
                            const userVoiceChannel = member.voice.channel;
                            
                            if (!userVoiceChannel) {
                                await safeReply(interaction, { 
                                    content: 'You need to be in a voice channel to stop playback.',
                                    ephemeral: true 
                                });
                                return;
                            }
                            
                            if (userVoiceChannel.id !== player.voiceId) {
                                await safeReply(interaction, { 
                                    content: 'You need to be in the same voice channel to stop playback.',
                                    ephemeral: true 
                                });
                                return;
                            }
                            
                            // Destroy the player
                            player.destroy();
                            
                            // Remove components from the now playing message
                            if (messageInfo) {
                                try {
                                    const messageChannel = client.channels.cache.get(messageInfo.channelId);
                                    if (messageChannel) {
                                        const message = await messageChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                                        if (message && message.editable) {
                                            // Remove all components (buttons)
                                            await message.edit({ components: [] }).catch(() => {});
                                        }
                                    }
                                } catch (e) {
                                    // Silent error handling
                                    console.error("Error removing buttons on stop:", e.message);
                                }
                            }
                            
                            // Send success message
                            await safeReply(interaction, { 
                                content: 'Stopped playback.',
                                ephemeral: true 
                            });
                        } catch (error) {
                            // Log error but don't break functionality
                            console.error("Error in stop button:", error.message);
                            
                            // Try to send a friendly error message
                            try {
                                await safeReply(interaction, { 
                                    content: 'Failed to stop playback. Please try again.',
                                    ephemeral: true 
                                });
                            } catch (replyError) {
                                // Silent catch
                            }
                        }
                        break;
                        
                    case 'queue':
                        try {
                            // Instead of trying to reuse the queue command's implementation,
                            // let's implement simplified queue info directly
                            const queue = player.queue;
                            if (!queue || queue.length === 0) {
                                await interaction.reply({
                                    content: 'There are no tracks in the queue',
                                    ephemeral: true
                                }).catch(() => {});
                                break;
                            }
                            
                            // Create a simplified queue display
                            let description = '';
                            // Get up to 5 tracks to show
                            const tracksToShow = Math.min(5, queue.length);
                            for (let i = 0; i < tracksToShow; i++) {
                                const track = queue[i];
                                description += `**${i+1}.** ${track.title}\n`;
                            }
                            
                            if (queue.length > tracksToShow) {
                                description += `\n... and ${queue.length - tracksToShow} more track(s)`;
                            }
                            
                            await interaction.reply({
                                content: `**Queue - ${queue.length} track(s)**\n\n${description}`,
                                ephemeral: true
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'loop':
                        try {
                            // Handle loop mode cycling: none > track > queue > none
                            // Kazagumo uses 'none', 'track', 'queue' as valid loop modes
                            const loopModes = ['none', 'track', 'queue'];
                            const currentMode = player.loop || 'none';
                            const currentIndex = loopModes.indexOf(currentMode);
                            const nextIndex = (currentIndex + 1) % loopModes.length;
                            const nextMode = loopModes[nextIndex];
                            
                            player.setLoop(nextMode);
                            
                            // Friendly mode names for the message
                            const modeNames = {
                                'none': 'disabled',
                                'track': 'current track',
                                'queue': 'entire queue'
                            };
                            
                            await interaction.reply({ 
                                content: `Loop mode set to: ${modeNames[nextMode]}`,
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'shuffle':
                        try {
                            // Make sure we have a player that's playing
                            if (!player.playing) {
                                await safeReply(interaction, { 
                                    content: 'There is no music currently playing.',
                                    ephemeral: true 
                                });
                                break;
                            }
                            
                            // Get the current queue
                            const queueSize = player.queue.size;
                            
                            // Shuffle regardless of queue size (but warn if empty)
                            if (queueSize > 0) {
                                // Preserve the current track, shuffle the rest
                                player.queue.shuffle();
                                
                                await safeReply(interaction, { 
                                    content: `Queue has been shuffled! Rearranged ${queueSize} song${queueSize === 1 ? '' : 's'}.`,
                                    ephemeral: true 
                                });
                            } else {
                                await safeReply(interaction, {
                                    content: 'No additional tracks in queue. Add more songs to create a shuffle mix!',
                                    ephemeral: true
                                });
                            }
                        } catch (error) {
                            console.error("Error in shuffle button:", error);
                            try {
                                await safeReply(interaction, { 
                                    content: 'Failed to shuffle the queue. Please try again.',
                                    ephemeral: true 
                                });
                            } catch (replyError) {
                                // Silent catch
                            }
                        }
                        break;
                        
                    case 'volume_down':
                        try {
                            const currentVolume = player.volume;
                            // Decrease by 10%, minimum volume is 0
                            const newVolume = Math.max(0, currentVolume - 10);
                            await player.setVolume(newVolume);
                            
                            // Create a volume bar
                            const volumeBar = createVolumeBar(newVolume);
                            
                            await interaction.reply({ 
                                content: `Volume set to ${newVolume}% ${volumeBar}`,
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'volume_up':
                        try {
                            const currentVolume = player.volume;
                            // Increase by 10%, maximum volume is 200
                            const newVolume = Math.min(200, currentVolume + 10);
                            await player.setVolume(newVolume);
                            
                            // Create a volume bar
                            const volumeBar = createVolumeBar(newVolume);
                            
                            await interaction.reply({ 
                                content: `Volume set to ${newVolume}% ${volumeBar}`,
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    default:
                        try {
                            await interaction.reply({ 
                                content: 'Unknown button action',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    // Handlers for queue ended buttons
                    case 'play_again':
                    case 'play':
                        try {
                            // Respond with a message directing the user to use the /play command
                            await interaction.reply({
                                content: 'Please use the `/play` command to search for and play music!',
                                ephemeral: true
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'leave':
                        try {
                            // Check if there's still an active player
                            const player = client.kazagumo.players.get(guild.id);
                            if (player) {
                                player.destroy();
                                await safeReply(interaction, {
                                    content: 'Left the voice channel and cleared the queue!',
                                    ephemeral: true
                                });
                            } else {
                                // No player, so just send a message
                                await safeReply(interaction, {
                                    content: 'I am not in a voice channel!',
                                    ephemeral: true
                                });
                            }
                        } catch (error) {
                            // Always handle errors gracefully
                            await safeReply(interaction, {
                                content: 'An error occurred while trying to leave the channel.',
                                ephemeral: true
                            });
                        }
                        break;
                        
                    case '247toggle':
                        try {
                            if (!member.voice.channel) {
                                await interaction.reply({
                                    content: 'You must be in a voice channel to toggle 24/7 mode!',
                                    ephemeral: true
                                }).catch(() => {});
                                break;
                            }
                            
                            // Toggle 24/7 mode
                            if (client.twentyFourSeven.has(guild.id)) {
                                client.twentyFourSeven.delete(guild.id);
                                await interaction.reply({
                                    content: '24/7 mode has been disabled. I will disconnect after inactivity.',
                                    ephemeral: true
                                }).catch(() => {});
                            } else {
                                client.twentyFourSeven.set(guild.id, member.voice.channel.id);
                                await interaction.reply({
                                    content: '24/7 mode has been enabled. I will stay in the voice channel indefinitely.',
                                    ephemeral: true
                                }).catch(() => {});
                            }
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'help':
                        try {
                            const helpText = `**Bot Help**
Here are the main commands you can use:

• \`/play\` - Play a song by name or URL
• \`/queue\` - View the current queue
• \`/skip\` - Skip the current track
• \`/stop\` - Stop playback and clear queue
• \`/247\` - Toggle 24/7 mode
• \`/vote\` - Vote for Audic on bot list sites
• \`/help\` - Show detailed help`;

                            await safeReply(interaction, {
                                content: helpText,
                                ephemeral: true
                            });
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                }
            } catch (error) {
                // Silent error handling for the entire button section
            }
        } else if (interaction.isStringSelectMenu()) {
            // Log select menu interaction
            try {
                const selectedValues = interaction.values.join(', ');
                logger.command(interaction, `Select Menu: ${interaction.customId}`, `Selected: ${selectedValues}`);
            } catch (error) {
                // Silent error for logger
            }

            // Handle filter select menu
            if (interaction.customId === 'filter_select') {
                const selectedFilter = interaction.values[0];
                const guild = interaction.guild;
                const member = interaction.member;

                // Get the player instance for this server
                const player = interaction.client.kazagumo.players.get(guild.id);

                if (!player) {
                    await safeReply(interaction, { 
                        content: 'There is no active player in this server!', 
                        ephemeral: true 
                    });
                    return;
                }

                // Make sure player is playing music
                if (!player.playing) {
                    await safeReply(interaction, { 
                        content: 'There is no music currently playing!', 
                        ephemeral: true 
                    });
                    return;
                }

                // Check if user is in the same voice channel
                if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                    await safeReply(interaction, { 
                        content: 'You must be in the same voice channel as the bot to use this!', 
                        ephemeral: true 
                    });
                    return;
                }

                try {
                    // Import filter utilities
                    const { applyFilter, clearFilters, getFilterDisplayName } = require('../utils/filters');

                    // Handle 'none' selection (clear filters)
                    if (selectedFilter === 'none') {
                        // Clear all filters
                        const success = await clearFilters(player);
                        // Send acknowledgment immediately
                        await safeReply(interaction, {
                            content: success ? 'All filters have been cleared! Music will continue playing.' : 'Failed to clear filters, but music will continue playing.',
                            ephemeral: true
                        });
                    } else {
                        // Apply the selected filter
                        const success = await applyFilter(player, selectedFilter);
                        // Send acknowledgment immediately
                        await safeReply(interaction, {
                            content: success ? `Applied the ${getFilterDisplayName(selectedFilter)} filter! Music will continue playing.` : `Failed to apply the filter. Music will continue playing normally.`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error("Error in filter application:", error);
                    await safeReply(interaction, {
                        content: 'An error occurred while applying the filter, but music should continue playing.',
                        ephemeral: true
                    });
                }
            }
        }
    }
};