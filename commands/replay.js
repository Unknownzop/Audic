const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Restart the current track from the beginning'),
    
    async execute(interaction) {
        // Defer reply to prevent timeout
        await interaction.deferReply();
        
        // Get client instance from the interaction
        const client = interaction.client;
        
        // Check if the user is in a voice channel
        if (!interaction.member.voice.channel) {
            return interaction.editReply({
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description: 'You need to be in a voice channel to use this command.',
                        color: '#ED4245'
                    })
                ]
            });
        }
        
        // Get the guild ID and check if there's a player
        const guildId = interaction.guild.id;
        const player = client.kazagumo.players.get(guildId);
        
        // Check if there's an active player
        if (!player) {
            return interaction.editReply({
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description: 'No music is currently playing.',
                        color: '#ED4245'
                    })
                ]
            });
        }
        
        // Check if the user is in the same voice channel as the bot
        if (interaction.member.voice.channel.id !== player.voiceId) {
            return interaction.editReply({
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description: 'You need to be in the same voice channel as the bot to replay the track.',
                        color: '#ED4245'
                    })
                ]
            });
        }
        
        // Get the current track
        const currentTrack = player.queue.current;
        
        // Check if there's a track to replay
        if (!currentTrack) {
            return interaction.editReply({
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description: 'There is no track currently playing.',
                        color: '#ED4245'
                    })
                ]
            });
        }
        
        try {
            // Seek to the beginning of the track (position 0)
            await player.seek(0);
            
            // Send a confirmation message with track info
            return interaction.editReply({
                embeds: [
                    createEmbed({
                        title: 'Replaying Track',
                        description: `Restarted [${currentTrack.title}](${currentTrack.uri || 'https://discord.com'}) from the beginning.`,
                        thumbnail: currentTrack.thumbnail || null,
                        color: '#57F287'
                    })
                ]
            });
        } catch (error) {
            console.error('Error replaying track:', error);
            
            // Send an error message
            return interaction.editReply({
                embeds: [
                    createEmbed({
                        title: 'Error',
                        description: `Failed to replay the track: ${error.message || 'Unknown error'}`,
                        color: '#ED4245'
                    })
                ]
            });
        }
    },
};