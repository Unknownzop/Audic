const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop and disconnect'),
    
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
        
        // Check if 24/7 mode is enabled and remove it
        if (client.twentyFourSeven.has(guildId)) {
            client.twentyFourSeven.delete(guildId);
        }
        
        // Remove components from the now playing message
        const storedMessage = client.nowPlayingMessages.get(guildId);
        if (storedMessage) {
            const channel = client.channels.cache.get(storedMessage.channelId);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(storedMessage.messageId);
                    if (message && message.editable) {
                        await message.edit({ components: [] }).catch(() => {});
                    }
                } catch (error) {
                    // Silently handle any errors that occur when modifying the message
                }
            }
        }
        
        // Stop and destroy the player
        player.destroy();
        
        const stopEmbed = createEmbed({
            title: `Player Stopped`,
            description: 'The player has been stopped and I have left the voice channel.',
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [stopEmbed] });
    },
};
