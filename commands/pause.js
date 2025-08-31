const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume current playback'),
    
    async execute(interaction) {
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
            return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
        }
        
        // Check if the user is in the same voice channel as the bot
        if (player.voiceId !== voiceChannel.id) {
            return interaction.reply({ embeds: [errorEmbed('You need to be in the same voice channel as me!')], ephemeral: true });
        }
        
        if (player.paused) {
            // Resume the player if it's already paused
            await player.pause(false);
            
            const resumeEmbed = createEmbed({
                title: `Playback Resumed`,
                description: 'The current playback has been resumed.',
                footer: `Requested by ${interaction.user.tag}`,
                timestamp: true
            });
            
            await interaction.reply({ embeds: [resumeEmbed] });
        } else {
            // Pause the player
            await player.pause(true);
            
            const pauseEmbed = createEmbed({
                title: `Playback Paused`,
                description: 'The current playback has been paused. Use `/pause` again to resume.',
                footer: `Requested by ${interaction.user.tag}`,
                timestamp: true
            });
            
            await interaction.reply({ embeds: [pauseEmbed] });
        }
    },
};
