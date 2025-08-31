const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { getFilter, getActiveFilter } = require('../utils/filters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timescale')
        .setDescription('Apply time scaling filter to the music with custom parameters')
        .addNumberOption(option => 
            option.setName('speed')
                .setDescription('Playback speed (0.5-2.0)')
                .setMinValue(0.5)
                .setMaxValue(2)
                .setRequired(false))
        .addNumberOption(option => 
            option.setName('pitch')
                .setDescription('Audio pitch (0.5-2.0)')
                .setMinValue(0.5)
                .setMaxValue(2)
                .setRequired(false))
        .addNumberOption(option => 
            option.setName('rate')
                .setDescription('Playback rate (0.5-2.0)')
                .setMinValue(0.5)
                .setMaxValue(2)
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const { client } = interaction;
            const guildId = interaction.guildId;
            
            // Get user options or use defaults
            const speed = interaction.options.getNumber('speed') || 1.0;
            const pitch = interaction.options.getNumber('pitch') || 1.0;
            const rate = interaction.options.getNumber('rate') || 1.0;
            
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
            
            if (activeFilter === 'timescale' && 
                speed === 1.0 && pitch === 1.0 && rate === 1.0) {
                return interaction.editReply({ embeds: [errorEmbed('Default timescale filter is already active!')] });
            }
            
            // Create a custom timescale filter
            const timescaleFilter = {
                timescale: { speed, pitch, rate }
            };
            
            // Apply the custom filter
            try {
                player.data.set('activeFilter', 'timescale');
                await player.shoukaku.setFilters(timescaleFilter);
                
                const successEmbed = createEmbed({
                    title: `Filter Applied`,
                    description: `Timescale filter has been applied with custom parameters.`,
                    fields: [
                        { name: 'Now Playing', value: player.queue.current ? player.queue.current.title : 'Nothing playing', inline: true },
                        { name: 'Filter', value: 'Timescale', inline: true },
                        { name: 'Parameters', value: `Speed: ${speed}x | Pitch: ${pitch}x | Rate: ${rate}x`, inline: false }
                    ],
                    footer: `Requested by ${interaction.user.tag}`,
                    timestamp: true
                });
                
                return interaction.editReply({ embeds: [successEmbed] });
            } catch (error) {
                console.error('Error applying timescale filter:', error);
                return interaction.editReply({ embeds: [errorEmbed('Failed to apply the timescale filter. Please try again.')] });
            }
        } catch (error) {
            console.error('Error in timescale command:', error);
            
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)] });
            } else {
                return interaction.reply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)], ephemeral: true });
            }
        }
    },
};