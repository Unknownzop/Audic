const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('↕️ Move track position in the queue')
        .addIntegerOption(option => 
            option.setName('from')
                .setDescription('Current position of the track (1 is next song)')
                .setRequired(true)
                .setMinValue(1))
        .addIntegerOption(option => 
            option.setName('to')
                .setDescription('New position for the track (1 is next song)')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        const fromPosition = interaction.options.getInteger('from');
        const toPosition = interaction.options.getInteger('to');
        
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
        
        // Check if there are enough tracks in the queue
        if (player.queue.length < 2) {
            return interaction.reply({ embeds: [errorEmbed('Need at least 2 tracks in the queue to move tracks!')], ephemeral: true });
        }
        
        // Check if the positions are valid
        if (fromPosition > player.queue.length) {
            return interaction.reply({ 
                embeds: [errorEmbed(`Invalid position! The queue only has ${player.queue.length} track${player.queue.length !== 1 ? 's' : ''}`)],
                ephemeral: true 
            });
        }
        
        if (toPosition > player.queue.length) {
            return interaction.reply({ 
                embeds: [errorEmbed(`Invalid position! The queue only has ${player.queue.length} track${player.queue.length !== 1 ? 's' : ''}`)],
                ephemeral: true 
            });
        }
        
        // Convert to 0-indexed
        const fromIndex = fromPosition - 1;
        const toIndex = toPosition - 1;
        
        // Don't do anything if the positions are the same
        if (fromIndex === toIndex) {
            return interaction.reply({ embeds: [errorEmbed('The track is already at that position!')], ephemeral: true });
        }
        
        // Get the track to move
        const trackToMove = player.queue[fromIndex];
        
        // Remove the track from its current position
        player.queue.splice(fromIndex, 1);
        
        // Insert the track at the new position
        player.queue.splice(toIndex, 0, trackToMove);
        
        const moveEmbed = createEmbed({
            title: `Track Moved`,
            description: `Moved [${trackToMove.title}](${trackToMove.uri}) from position #${fromPosition} to #${toPosition}`,
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [moveEmbed] });
    },
};
