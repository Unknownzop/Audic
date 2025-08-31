const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite bot to server'),
    
    async execute(interaction) {
        try {
            // Defer the reply to give us more time to respond
            await interaction.deferReply({ ephemeral: false }).catch(err => {
                console.error('Failed to defer reply in invite command:', err);
                throw err; // Re-throw to be caught by the outer try/catch
            });
            
            // Get client ID from environment or use interaction.client.user.id as fallback
            let clientId = process.env.CLIENT_ID;
            
            if (!clientId) {
                try {
                    clientId = interaction.client.user.id;
                    console.log(`Using client user ID: ${clientId}`);
                } catch (idError) {
                    console.error('Error getting client ID:', idError);
                    clientId = '1095642714854182912'; // Fallback to a hardcoded ID as last resort
                }
            }
            
            // Use a fixed permission code instead of calculating it
            // This fixed value covers all the permissions we need (277083450432)
            const permissions = 277083450432;
            
            // Generate the invite link
            const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
            
            // Check if support server link is valid
            const supportServer = config.supportServer || 'https://discord.gg/76W85cu3Uy';
            
            const inviteEmbed = createEmbed({
                title: `Invite ${config.botName}`,
                description: `Thank you for your interest in ${config.botName}!\n\nClick the buttons below to invite the bot or join our support server:`,
                fields: [
                    {
                        name: 'Invite Link',
                        value: `[Click here to invite ${config.botName}](${inviteLink})`,
                        inline: false
                    },
                    {
                        name: 'Support Server',
                        value: `[Join our support server](${supportServer})`,
                        inline: false
                    }
                ],
                footer: 'Thanks for using our bot!',
                timestamp: true
            });
            
            // Create buttons for invite and support server
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Invite Bot')
                        .setStyle(ButtonStyle.Link)
                        .setURL(inviteLink),
                    new ButtonBuilder()
                        .setLabel('Join Support Server')
                        .setStyle(ButtonStyle.Link)
                        .setURL(supportServer)
                );
            
            // Edit the deferred reply - with graceful error handling
            return await interaction.editReply({ embeds: [inviteEmbed], components: [row] }).catch(err => {
                console.error('Failed to edit reply in invite command:', err);
                throw err; // Re-throw to be caught by the outer try/catch
            });
        } catch (error) {
            console.error('Error in invite command:', error);
            
            try {
                // If interaction hasn't been acknowledged, acknowledge it
                if (!interaction.replied && !interaction.deferred) {
                    return await interaction.reply({ 
                        content: 'Sorry, there was an error processing your invite request.', 
                        ephemeral: true 
                    }).catch(e => console.error('Failed to send error reply:', e));
                } else if (interaction.deferred) {
                    return await interaction.editReply({ 
                        content: 'Sorry, there was an error processing your invite request.',
                        embeds: [],
                        components: []
                    }).catch(e => console.error('Failed to edit reply with error:', e));
                } else {
                    return await interaction.followUp({ 
                        content: 'Sorry, there was an error processing your invite request.', 
                        ephemeral: true 
                    }).catch(e => console.error('Failed to follow up with error:', e));
                }
            } catch (responseError) {
                console.error('Failed to send error response for invite command:', responseError);
                // Nothing more we can do if we can't respond
                return;
            }
        }
    },
};
