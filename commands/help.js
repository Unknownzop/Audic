const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const config = require('../config');
const { createEmbed } = require('../utils/embeds');
const { getAvailableFilters, getFilterDisplayName } = require('../utils/filters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    
    async execute(interaction) {
        // Define all commands
        const allCommands = [
            // Music Commands
            { name: 'play', description: 'Play a song from name/URL', category: 'Music' },
            { name: 'search', description: 'Search for a song and choose one to play', category: 'Music' },
            { name: 'pause', description: 'Pause current playback', category: 'Music' },
            { name: 'resume', description: 'Resume playback', category: 'Music' },
            { name: 'stop', description: 'Stop and disconnect', category: 'Music' },
            { name: 'skip', description: 'Skip to next song', category: 'Music' },
            { name: 'replay', description: 'Replay the current song from the beginning', category: 'Music' },
            { name: 'join', description: 'Make the bot join your voice channel', category: 'Music' },
            { name: 'leave', description: 'Make the bot leave your voice channel', category: 'Music' },
            { name: 'volume', description: 'Adjust volume (0-100)', category: 'Music' },
            { name: 'queue', description: 'View current queue', category: 'Music' },
            { name: 'nowplaying', description: 'Show current track', category: 'Music' },
            { name: 'shuffle', description: 'Shuffle the queue', category: 'Music' },
            { name: 'loop', description: 'Set loop mode', category: 'Music' },
            { name: 'remove', description: 'Remove a song', category: 'Music' },
            { name: 'move', description: 'Move track position', category: 'Music' },
            { name: 'lyrics', description: 'Get lyrics for the current or specified song', category: 'Music' },
            
            // Filter Commands
            { name: '8d', description: 'Toggle 8D audio effect', category: 'Filters' },
            { name: 'bassboost', description: 'Enhance bass frequencies', category: 'Filters' },
            { name: 'nightcore', description: 'Apply nightcore effect (faster with higher pitch)', category: 'Filters' },
            { name: 'vaporwave', description: 'Apply vaporwave effect (slower with lower pitch)', category: 'Filters' },
            { name: 'karaoke', description: 'Apply karaoke effect (reduces vocals)', category: 'Filters' },
            { name: 'lowpass', description: 'Apply lowpass filter (reduces high frequencies)', category: 'Filters' },
            { name: 'slowmode', description: 'Slow down the music playback', category: 'Filters' },
            { name: 'timescale', description: 'Adjust playback speed and pitch', category: 'Filters' },
            { name: 'clearfilter', description: 'Remove all active filters', category: 'Filters' },
            
            // Utility Commands
            { name: '247', description: 'Toggle 24/7 mode', category: 'Utility' },
            { name: 'ping', description: 'Check bot latency', category: 'Utility' },
            { name: 'stats', description: 'View bot statistics', category: 'Utility' },
            { name: 'invite', description: 'Invite bot to server', category: 'Utility' },
            { name: 'support', description: 'Join support server', category: 'Utility' },
            { name: 'vote', description: 'Vote for the bot on listing sites', category: 'Utility' },
            { name: 'help', description: 'Display this help menu', category: 'Utility' }
        ];
        
        // Group commands by category for counting
        const musicCommands = allCommands.filter(cmd => cmd.category === 'Music');
        const filterCommands = allCommands.filter(cmd => cmd.category === 'Filters');
        const utilityCommands = allCommands.filter(cmd => cmd.category === 'Utility');
        
        // Create help embed with all commands
        const helpEmbed = createEmbed({
            title: `${config.botName} - Commands`,
            description: `${config.botDescription}\n\nHere are all available commands:`,
            thumbnail: config.botLogo,
            fields: [
                {
                    name: 'Music Commands',
                    value: musicCommands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n'),
                    inline: false
                },
                {
                    name: 'Audio Filter Commands',
                    value: filterCommands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n'),
                    inline: false
                },
                {
                    name: 'Utility Commands',
                    value: utilityCommands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n'),
                    inline: false
                },
                {
                    name: 'Invite Bot',
                    value: `[Click here to invite ${config.botName} to your server](https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID || '123456789012345678'}&permissions=277083450432&scope=bot%20applications.commands)`,
                    inline: false
                },
                {
                    name: 'Support Server',
                    value: `[Join our support server](${config.supportServer}) for help and updates.`,
                    inline: false
                }
            ],
            footer: `${config.botName} • Developed by Unknownz`
        });
        
        // Send the embed without any components
        await interaction.reply({ 
            embeds: [helpEmbed]
        });
    },
};
