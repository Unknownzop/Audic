const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { clearFilters, hasActiveFilter, getActiveFilter, getFilterDisplayName } = require('../utils/filters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearfilter')
        .setDescription('Clear all active audio filters'),
    
    async execute(interaction) {
        try {
            const { client } = interaction;
            const guildId = interaction.guildId;
            
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
            
            await interaction.deferReply();
            
            // Check if there are any active filters
            if (!hasActiveFilter(player)) {
                return interaction.editReply({ embeds: [errorEmbed('There are no active filters to clear!')] });
            }
            
            // Get the name of the active filter for the response message
            const activeFilter = getActiveFilter(player);
            const filterName = activeFilter ? getFilterDisplayName(activeFilter) : 'Unknown';
            
            // Clear all filters
            const success = await clearFilters(player);
            
            if (success) {
                const successEmbed = createEmbed({
                    title: `Filters Cleared`,
                    description: `All audio filters have been cleared. The audio will now play without any effects.`,
                    fields: [
                        { name: 'Now Playing', value: player.queue.current ? player.queue.current.title : 'Nothing playing', inline: true },
                        { name: 'Removed Filter', value: filterName, inline: true }
                    ],
                    footer: `Requested by ${interaction.user.tag}`,
                    timestamp: true
                });
                
                return interaction.editReply({ embeds: [successEmbed] });
            } else {
                return interaction.editReply({ embeds: [errorEmbed('Failed to clear filters. Please try again.')] });
            }
        } catch (error) {
            console.error('Error in clearfilter command:', error);
            
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)] });
            } else {
                return interaction.reply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)], ephemeral: true });
            }
        }
    },
};