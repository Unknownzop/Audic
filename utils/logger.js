/**
 * Webhook logger for Discord Music Bot
 * Sends logs of commands, player events, and system activities to a Discord channel via webhook
 */

const { WebhookClient, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// Colors for different log types
const LOG_COLORS = {
    INFO: 0x3498db,    // Blue
    COMMAND: 0x2ecc71, // Green
    PLAYER: 0xe74c3c,  // Red
    SYSTEM: 0xf1c40f,  // Yellow
    ERROR: 0x9b59b6    // Purple
};

// Configure webhook client if webhook URL is provided
let webhookClient = null;
if (process.env.LOG_WEBHOOK_URL && process.env.LOG_WEBHOOK_URL.startsWith('https://discord.com/api/webhooks/')) {
    try {
        webhookClient = new WebhookClient({ url: process.env.LOG_WEBHOOK_URL });
        console.log('Webhook logger initialized successfully');
    } catch (error) {
        console.error('Failed to initialize webhook logger:', error.message);
    }
} else {
    console.log('No valid webhook URL provided. Discord logging is disabled. Add a valid webhook URL to enable logging.');
}

/**
 * Send a log message to the Discord webhook
 * @param {String} type - Log type (INFO, COMMAND, PLAYER, SYSTEM, ERROR)
 * @param {String} title - Log title
 * @param {String} description - Log description
 * @param {Object} fields - Additional fields to include in the embed (optional)
 * @param {Object} options - Additional options for the log (optional)
 */
async function sendLog(type, title, description, fields = [], options = {}) {
    if (!webhookClient) return;

    try {
        // Create the embed for the log message
        const embed = new EmbedBuilder()
            .setColor(LOG_COLORS[type] || LOG_COLORS.INFO)
            .setTitle(`${title}`)
            .setDescription(description)
            .setTimestamp();

        // Add any additional fields
        if (fields && fields.length > 0) {
            fields.forEach(field => {
                if (field.name && field.value) {
                    embed.addFields({ name: field.name, value: field.value, inline: field.inline || false });
                }
            });
        }

        // Add footer if provided
        if (options.footer) {
            embed.setFooter({ text: options.footer });
        }

        // Add thumbnail if provided
        if (options.thumbnail) {
            embed.setThumbnail(options.thumbnail);
        }

        // Send the log message
        await webhookClient.send({
            username: options.username || 'Puzzle Music Logs',
            avatarURL: options.avatarURL || 'https://i.imgur.com/B4JMdYE.png', // Music note icon
            embeds: [embed]
        });
    } catch (error) {
        // Silent error handling - don't log errors about logging
    }
}

// Helper functions for different log types
module.exports = {
    /**
     * Log a command execution
     * @param {Object} interaction - Discord interaction object
     * @param {String} commandName - Name of the command
     * @param {String} details - Additional command details or arguments
     */
    command: async (interaction, commandName, details = '') => {
        if (!webhookClient) return;

        const user = interaction.user;
        const guild = interaction.guild;
        
        await sendLog(
            'COMMAND', 
            `/${commandName}`,
            details || 'Command executed successfully',
            [
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Guild', value: `${guild ? guild.name : 'DM'} (${guild ? guild.id : 'N/A'})`, inline: true },
                { name: 'Channel', value: `${interaction.channel ? interaction.channel.name : 'Unknown'} (${interaction.channel ? interaction.channel.id : 'N/A'})`, inline: true }
            ],
            {
                username: 'Audic Commands',
                avatarURL: 'https://cdn.discordapp.com/attachments/1098183940499591188/1356117565696508065/copilot_image_1742024927163.jpg?ex=67fa8fa7&is=67f93e27&hm=2b1da982cfa1dded35796dad50264b7d2813edc19eeba22e6c82d281ee342cb8&', // Command icon
                footer: `Command executed at ${new Date().toLocaleString()}`
            }
        );
    },

    /**
     * Log a player event
     * @param {String} event - Event name (play, pause, skip, etc.)
     * @param {Object} player - Kazagumo player instance
     * @param {Object} track - Track being played/affected (optional)
     * @param {String} details - Additional details about the event (optional)
     */
    player: async (event, player, track = null, details = '') => {
        if (!webhookClient || !player) return;

        const fields = [
            { name: 'Guild', value: `${player.guildId}`, inline: true },
            { name: 'Voice Channel', value: `${player.voiceId || 'N/A'}`, inline: true }
        ];

        if (track) {
            fields.push({ name: 'Track', value: `${track.title || 'Unknown'}`, inline: false });
            fields.push({ name: 'Author', value: `${track.author || 'Unknown'}`, inline: true });
            fields.push({ name: 'Duration', value: `${formatTime(track.length || 0)}`, inline: true });
        }

        if (details) {
            fields.push({ name: 'Details', value: details, inline: false });
        }

        await sendLog(
            'PLAYER',
            `Music Player: ${event.charAt(0).toUpperCase() + event.slice(1)}`,
            event === 'start' ? 'Started playing a new track' : 
                event === 'end' ? 'Track playback ended' : 
                event === 'empty' ? 'Queue is now empty' : 
                `A ${event} event occurred in the music player.`,
            fields,
            {
                username: 'Audic Music Player',
                avatarURL: 'https://cdn.discordapp.com/attachments/1098183940499591188/1356117565696508065/copilot_image_1742024927163.jpg?ex=67fa8fa7&is=67f93e27&hm=2b1da982cfa1dded35796dad50264b7d2813edc19eeba22e6c82d281ee342cb8&', // Music player icon
                thumbnail: track && track.thumbnail ? track.thumbnail : null
            }
        );
    },

    /**
     * Log a system event
     * @param {String} event - Event name
     * @param {String} description - Description of the event
     * @param {Array} fields - Additional fields (optional)
     */
    system: async (event, description, fields = []) => {
        if (!webhookClient) return;

        await sendLog(
            'SYSTEM',
            `${event}`,
            description,
            fields,
            {
                username: 'Audic System',
                avatarURL: 'https://cdn.discordapp.com/attachments/1098183940499591188/1356117565696508065/copilot_image_1742024927163.jpg?ex=67fa8fa7&is=67f93e27&hm=2b1da982cfa1dded35796dad50264b7d2813edc19eeba22e6c82d281ee342cb8&'  // System icon
            }
        );
    },

    /**
     * Log an error
     * @param {String} source - Source of the error (command name, player, etc.)
     * @param {Error|String} error - Error object or message
     * @param {Array} fields - Additional fields (optional)
     */
    error: async (source, error, fields = []) => {
        if (!webhookClient) return;

        const errorMessage = error instanceof Error ? error.message : error;
        const errorStack = error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available';

        await sendLog(
            'ERROR',
            `${source} Error`,
            errorMessage,
            [
                { name: 'Stack Trace', value: `\`\`\`${errorStack.substring(0, 1000)}\`\`\``, inline: false },
                ...fields
            ],
            {
                username: 'Audic Errors',
                avatarURL: 'https://cdn.discordapp.com/attachments/1098183940499591188/1356117565696508065/copilot_image_1742024927163.jpg?ex=67fa8fa7&is=67f93e27&hm=2b1da982cfa1dded35796dad50264b7d2813edc19eeba22e6c82d281ee342cb8&'  // Error icon
            }
        );
    }
};

/**
 * Format milliseconds to MM:SS or HH:MM:SS
 * @param {Number} ms - Duration in milliseconds
 * @returns {String} Formatted time string
 */
function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}