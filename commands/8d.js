const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { applyFilter, getActiveFilter } = require('../utils/filters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8d')
        .setDescription('Apply 8D audio filter to the music'),
    
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
            
            // Check if this filter is already active
            const activeFilter = getActiveFilter(player);
            
            if (activeFilter === '8d') {
                return interaction.editReply({ embeds: [errorEmbed('8D audio is already active!')] });
            }
            
            // Apply the filter
            const success = await applyFilter(player, '8d');
            
            if (success) {
                const successEmbed = createEmbed({
                    title: `Filter Applied`,
                    description: `8D audio filter has been applied to the music. You'll hear a rotating audio effect.`,
                    fields: [
                        { name: 'Now Playing', value: player.queue.current ? player.queue.current.title : 'Nothing playing', inline: true },
                        { name: 'Filter', value: '8D Audio', inline: true }
                    ],
                    footer: `Requested by ${interaction.user.tag}`,
                    timestamp: true
                });
                
                return interaction.editReply({ embeds: [successEmbed] });
            } else {
                return interaction.editReply({ embeds: [errorEmbed('Failed to apply the 8D audio filter. Please try again.')] });
            }
        } catch (error) {
            console.error('Error in 8d command:', error);
            
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)] });
            } else {
                return interaction.reply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)], ephemeral: true });
            }
        }
    },
};