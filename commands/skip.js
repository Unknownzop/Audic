const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip to next song')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of tracks to skip (default: 1)')
                .setRequired(false)
                .setMinValue(1)),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        const skipAmount = interaction.options.getInteger('amount') || 1;
        
        // Check if the user is in a voice channel
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel) {
            return interaction.reply({ embeds: [errorEmbed('You need to be in a voice channel to use this command!')], ephemeral: true });
        }
        
        // Get the player for this guild
        const player = client.kazagumo.players.get(guildId);
        
        if (!player) {
            return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
        }
        
        // Check if the user is in the same voice channel as the bot
        if (player.voiceId !== voiceChannel.id) {
            return interaction.reply({ embeds: [errorEmbed('You need to be in the same voice channel as me!')], ephemeral: true });
        }
        
        // Check if there's a track playing
        if (!player.queue.current) {
            return interaction.reply({ embeds: [errorEmbed('There is no track currently playing!')], ephemeral: true });
        }
        
        // Check if there are enough tracks to skip
        if (skipAmount > 1 && player.queue.size < skipAmount - 1) {
            return interaction.reply({ 
                embeds: [errorEmbed(`Cannot skip ${skipAmount} tracks because there are only ${player.queue.size} tracks in the queue!`)],
                ephemeral: true 
            });
        }
        
        // Store current track for the response
        const currentTrack = player.queue.current;
        
        // Skip multiple tracks if requested
        if (skipAmount > 1) {
            for (let i = 0; i < skipAmount - 1; i++) {
                player.queue.remove(0);
            }
        }
        
        // Remove components from the now playing message
        try {
            const messageInfo = client.nowPlayingMessages.get(guildId);
            if (messageInfo) {
                const messageChannel = client.channels.cache.get(messageInfo.channelId);
                if (messageChannel) {
                    try {
                        const message = await messageChannel.messages.fetch(messageInfo.messageId);
                        if (message && message.editable) {
                            await message.edit({ components: [] }).catch(() => {});
                        }
                    } catch (fetchError) {
                        // Silent catch, no need to log
                    }
                }
            }
        } catch (error) {
            // Silent catch, no need to log
        }
        
        // Skip the current track
        await player.skip();
        
        // Get the next track (now playing) for the response, if available
        const nextTrack = player.queue.current;
        
        let description = `Skipped [${currentTrack.title}](${currentTrack.uri})`;
        
        // If skipping to a specific track, mention that track
        if (skipAmount > 1) {
            description += `\nSkipped ${skipAmount} tracks in total`;
        }
        
        // Add info about the now playing track if available
        if (nextTrack) {
            description += `\n\nNow playing: [${nextTrack.title}](${nextTrack.uri})`;
        } else {
            description += '\n\nThe queue is now empty';
        }
        
        const skipEmbed = createEmbed({
            title: `Track Skipped`,
            description: description,
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [skipEmbed] });
    },
};
