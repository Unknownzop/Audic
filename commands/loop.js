const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set loop mode or cycle through modes (none → track → queue)')
        .addStringOption(option => 
            option.setName('mode')
                .setDescription('Loop mode to set (optional - will cycle if not specified)')
                .setRequired(false)
                .addChoices(
                    { name: 'Off', value: 'none' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        let loopMode = interaction.options.getString('mode');
        
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
        
        // If no loop mode specified, cycle through modes
        if (!loopMode) {
            const currentLoop = player.loop;
            
            // Cycle through modes: none → track → queue → none
            switch (currentLoop) {
                case 'none':
                    loopMode = 'track';
                    break;
                case 'track':
                    loopMode = 'queue';
                    break;
                case 'queue':
                    loopMode = 'none';
                    break;
                default:
                    loopMode = 'none';
            }
        }
        
        // Set the loop mode
        player.setLoop(loopMode);
        
        // Set the mode text based on loop mode
        let modeText;
        
        switch (loopMode) {
            case 'none':
                modeText = 'Disabled';
                break;
            case 'track':
                modeText = 'Current Track';
                break;
            case 'queue':
                modeText = 'Queue';
                break;
            default:
                modeText = 'Unknown';
        }
        
        const loopEmbed = createEmbed({
            title: `Loop Mode: ${modeText}`,
            description: `Loop mode has been set to **${modeText}**`,
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [loopEmbed] });
    },
};
