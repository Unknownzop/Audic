const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Adjust volume (0-100)')
        .addIntegerOption(option => 
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        const volumeLevel = interaction.options.getInteger('level');
        
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
        
        // If no volume level is specified, return the current volume
        if (volumeLevel === null) {
            const currentVolumeEmbed = createEmbed({
                title: `Current Volume`,
                description: `The current volume is set to **${player.volume}%**`,
                footer: `Use /volume <level> to change the volume`,
                timestamp: true
            });
            
            return interaction.reply({ embeds: [currentVolumeEmbed] });
        }
        
        // Set the volume
        await player.setVolume(volumeLevel);
        
        // Create volume bar visualization
        const volumeBar = createVolumeBar(volumeLevel);
        
        const volumeEmbed = createEmbed({
            title: `Volume Adjusted`,
            description: `Volume has been set to **${volumeLevel}%**\n\n${volumeBar}`,
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [volumeEmbed] });
    },
};

// Helper function to create a volume bar visualization
function createVolumeBar(volume) {
    const barLength = 10;
    const filledBars = Math.round((volume / 100) * barLength);
    const emptyBars = barLength - filledBars;
    
    // Use original volume bar characters
    return `[${volume}%] ${'▓'.repeat(filledBars)}${'░'.repeat(emptyBars)}`;
}
