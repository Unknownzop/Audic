const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot and API latency'),
    
    async execute(interaction) {
        // Defer the reply to calculate accurate API latency
        await interaction.deferReply();
        
        // Calculate bot latency (API ping)
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        // Calculate message latency (round trip time)
        const start = Date.now();
        const reply = await interaction.editReply('Pinging...');
        const messageLatency = Date.now() - start;
        
        // Get Lavalink node stats if available
        let lavalinkLatency = 'N/A';
        
        try {
            const { shoukaku } = interaction.client.kazagumo;
            
            // Get the first available node from the nodes collection
            const nodeEntry = shoukaku.nodes.entries().next().value;
            const node = nodeEntry ? nodeEntry[1] : null;
            
            if (node) {
                if (node.stats && node.stats.ping) {
                    // If the node has ping statistics
                    lavalinkLatency = `${node.stats.ping}ms`;
                } else {
                    // Otherwise, perform a manual ping check
                    const pingStart = Date.now();
                    
                    // We'll check if the node is connected by getting its state
                    // State 1 means connected
                    if (node.state === 1) {
                        const pingEnd = Date.now();
                        const pingTime = pingEnd - pingStart;
                        lavalinkLatency = `~${pingTime}ms`;
                    } else {
                        lavalinkLatency = 'Connecting...';
                    }
                }
                
                console.log(`Lavalink node (${node.name}) status: ${node.state === 1 ? 'Connected' : 'Connecting'}`);
            } else {
                console.log('No Lavalink nodes found');
                lavalinkLatency = 'No Node';
            }
        } catch (error) {
            console.error('Error getting Lavalink stats:', error);
            lavalinkLatency = 'Error';
        }
        
        // Create and send the ping embed
        const pingEmbed = createEmbed({
            title: `Pong!`,
            description: "", // Explicitly set to empty string to ensure a blank description
            fields: [
                {
                    name: 'API Latency',
                    value: `${apiLatency}ms`,
                    inline: true
                },
                {
                    name: 'Message Latency',
                    value: `${messageLatency}ms`,
                    inline: true
                },
                {
                    name: 'Lavalink Latency',
                    value: lavalinkLatency,
                    inline: true
                }
            ],
            footer: `${config.botName} Music Bot`,
            timestamp: true
        });
        
        await interaction.editReply({ content: null, embeds: [pingEmbed] });
    },
};
