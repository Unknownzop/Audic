const config = require('../config');

module.exports = {
    /**
     * Create a basic embed with consistent styling
     * @param {Object} options Embed options
     * @returns {Object} Embed object
     */
    createEmbed: (options = {}) => {
        return {
            title: options.title || 'Music',
            description: options.description === undefined ? 'No description provided' : options.description,
            fields: options.fields || [],
            color: parseInt((options.color || config.embedColor).replace('#', ''), 16),
            footer: options.footer ? {
                text: options.footer
            } : null,
            thumbnail: options.thumbnail ? {
                url: options.thumbnail,
                height: 250,
                width: 250
            } : null,
            image: options.image ? {
                url: options.image
            } : null,
            author: options.author ? {
                name: options.author.name,
                icon_url: options.author.icon || null,
                url: options.author.url || null
            } : null,
            timestamp: options.timestamp ? new Date() : null
        };
    },
    
    /**
     * Create an error embed
     * @param {String} message Error message
     * @returns {Object} Error embed
     */
    errorEmbed: (message) => {
        return {
            title: 'Error',
            description: message,
            color: 0xED4245, // Discord red color
            timestamp: new Date()
        };
    },
    
    /**
     * Create a success embed
     * @param {String} message Success message
     * @returns {Object} Success embed
     */
    successEmbed: (message) => {
        return {
            title: 'Success',
            description: message,
            color: 0x57F287, // Discord green color
            timestamp: new Date()
        };
    }
};
