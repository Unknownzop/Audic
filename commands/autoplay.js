const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay mode to automatically add related tracks when queue ends'),
    
    async execute(interaction) {
        try {
            const { client } = interaction;
            const guildId = interaction.guildId;
            
            // Autoplay command executed
            
            // Check if the user is in a voice channel
            const member = interaction.member;
            const voiceChannel = member.voice.channel;
            
            if (!voiceChannel) {
                return interaction.reply({ embeds: [errorEmbed('You need to be in a voice channel to use this command!')], ephemeral: true });
            }
            
            // Get the player for this guild
            const player = client.kazagumo.players.get(guildId);
            
            if (!player) {
                return interaction.reply({ embeds: [errorEmbed('There is no active player in this server! Play a song first.')], ephemeral: true });
            }
            
            // Check if the user is in the same voice channel as the bot
            if (player.voiceId !== voiceChannel.id) {
                return interaction.reply({ embeds: [errorEmbed('You need to be in the same voice channel as me!')], ephemeral: true });
            }
            
            // Make sure the autoplay collection exists
            if (!client.autoplay) {
                client.autoplay = new Set();
            }
            
            // Check current autoplay status
            const autoplayEnabled = client.autoplay.has(guildId);
            
            if (autoplayEnabled) {
                client.autoplay.delete(guildId);
                
                const disabledEmbed = createEmbed({
                    title: `Autoplay Disabled`,
                    description: `Autoplay mode has been **disabled**. The queue will end normally without adding new tracks.`
                });
                
                await interaction.reply({ embeds: [disabledEmbed] });
            } else {
                client.autoplay.add(guildId);
                
                const enabledEmbed = createEmbed({
                    title: `Autoplay Enabled`,
                    description: `Autoplay mode has been **enabled**. When the queue ends, similar tracks will be automatically added.`
                });
                
                await interaction.reply({ embeds: [enabledEmbed] });
            }
        } catch (error) {
            console.error('Error in autoplay command:', error);
            
            // Handle different types of errors
            let errorMessage = 'An unexpected error occurred while toggling autoplay.';
            
            if (error.message.includes('Cannot read properties of undefined')) {
                errorMessage = 'Cannot access player properties. Try playing a song first and then enabling autoplay.';
            } else if (error.message.includes('not connected') || error.message.includes('voice')) {
                errorMessage = 'There seems to be an issue with the voice connection. Try rejoining the voice channel or using the play command first.';
            } else if (error.message.includes('permission')) {
                errorMessage = 'I don\'t have permission to perform this action. Please check my permissions in your server.';
            } else {
                errorMessage = `An error occurred: ${error.message}`;
            }
            
            return interaction.reply({ 
                embeds: [errorEmbed(errorMessage)],
                ephemeral: true
            }).catch(err => {
                console.error('Failed to send error response:', err);
                // Try to respond with a simpler message if the embed fails
                interaction.reply({ content: `Error: ${errorMessage}`, ephemeral: true }).catch(() => {});
            });
        }
    },
};