const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode'),
    
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
        
        // Toggle 24/7 mode
        const is247Enabled = client.twentyFourSeven.has(guildId);
        
        if (is247Enabled) {
            client.twentyFourSeven.delete(guildId);
        } else {
            client.twentyFourSeven.set(guildId, voiceChannel.id);
        }
        
        const newState = !is247Enabled;
        
        const modeEmbed = createEmbed({
            title: `24/7 Mode`,
            description: `24/7 mode is now **${newState ? 'enabled' : 'disabled'}**\n\n${newState ? 'I will stay in the voice channel even when the queue is empty' : 'I will leave the voice channel after a period of inactivity'}`,
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [modeEmbed] });
    },
};
