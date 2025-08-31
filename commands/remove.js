const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option => 
            option.setName('position')
                .setDescription('Position of the track in the queue (1 is next song)')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        const position = interaction.options.getInteger('position');
        
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
        
        // Check if there are tracks in the queue
        if (player.queue.length === 0) {
            return interaction.reply({ embeds: [errorEmbed('The queue is empty!')], ephemeral: true });
        }
        
        // Check if the position is valid
        if (position > player.queue.length) {
            return interaction.reply({ 
                embeds: [errorEmbed(`Invalid position! The queue only has ${player.queue.length} track${player.queue.length !== 1 ? 's' : ''}`)],
                ephemeral: true 
            });
        }
        
        // Get the track to remove (queue is 0-indexed, but command is 1-indexed for user-friendliness)
        const trackIndex = position - 1;
        const removedTrack = player.queue[trackIndex];
        
        // Remove the track
        player.queue.remove(trackIndex);
        
        const removeEmbed = createEmbed({
            title: `Track Removed`,
            description: `Removed [${removedTrack.title}](${removedTrack.uri}) from position #${position} in the queue`,
            fields: [
                {
                    name: 'Requested By',
                    value: `<@${removedTrack.requester.id}>`,
                    inline: true
                },
                {
                    name: 'Removed By',
                    value: `<@${interaction.user.id}>`,
                    inline: true
                }
            ],
            footer: `${player.queue.length} track${player.queue.length !== 1 ? 's' : ''} remaining in queue`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [removeEmbed] });
    },
};
