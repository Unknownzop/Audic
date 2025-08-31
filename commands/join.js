const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your voice channel'),
    
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
            
            // Check if the bot is already in a voice channel in this guild
            const player = client.kazagumo.players.get(guildId);
            
            if (player && player.voiceId) {
                // If the bot is already in the same voice channel as the user
                if (player.voiceId === voiceChannel.id) {
                    return interaction.reply({ embeds: [errorEmbed('I am already in your voice channel!')], ephemeral: true });
                } 
                // If the bot is in a different voice channel
                else {
                    // Move to the user's voice channel
                    try {
                        player.setVoiceChannel(voiceChannel.id);
                        
                        const successEmbed = createEmbed({
                            title: `Voice Channel Changed`,
                            description: `I've moved to <#${voiceChannel.id}>!`,
                            footer: `Requested by ${interaction.user.tag}`,
                            timestamp: true
                        });
                        
                        return interaction.reply({ embeds: [successEmbed] });
                    } catch (error) {
                        return interaction.reply({ embeds: [errorEmbed(`Failed to move to your voice channel: ${error.message}`)], ephemeral: true });
                    }
                }
            }
            
            // Create a new player if one doesn't exist
            await interaction.deferReply();
            
            try {
                // Create a new player
                const newPlayer = await client.kazagumo.createPlayer({
                    guildId: guildId,
                    textId: interaction.channelId,
                    voiceId: voiceChannel.id,
                    deaf: true, // Bot joins deafened
                    volume: config.defaultVolume
                });
                
                const successEmbed = createEmbed({
                    title: `Connected to Voice Channel`,
                    description: `I've joined <#${voiceChannel.id}>!\nUse </play:0> to start playing music.`,
                    footer: `Requested by ${interaction.user.tag}`,
                    timestamp: true
                });
                
                return interaction.editReply({ embeds: [successEmbed] });
            } catch (error) {
                console.error('Error creating player:', error);
                return interaction.editReply({ embeds: [errorEmbed(`Failed to join your voice channel: ${error.message}`)] });
            }
        } catch (error) {
            console.error('Error in join command:', error);
            
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)] });
            } else {
                return interaction.reply({ embeds: [errorEmbed(`An error occurred: ${error.message}`)], ephemeral: true });
            }
        }
    },
};