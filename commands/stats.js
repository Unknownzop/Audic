const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics'),
    
    async execute(interaction) {
        const { client } = interaction;
        
        // Collect general stats
        const serverCount = client.guilds.cache.size;
        const channelCount = client.channels.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const activeVoiceConnections = client.kazagumo.players.size;
        
        // Collect uptime stats
        const botUptime = formatUptime(client.uptime);
        const systemUptime = formatUptime(os.uptime() * 1000);
        
        // Collect system stats
        const memoryUsage = process.memoryUsage();
        const memoryUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const memoryTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const cpuCount = os.cpus().length;
        const cpuModel = os.cpus()[0].model;
        const cpuUsage = process.cpuUsage();
        const cpuUsagePercent = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2);
        
        // Get Lavalink node stats if available
        let lavalinkStats = 'No data available';
        let playersCount = 'Unknown';
        let memoryUsedLavalink = 'Unknown';
        let uptimeLavalink = 'Unknown';
        
        try {
            const { shoukaku } = client.kazagumo;
            // Use the first node from nodes.size as 'Main Node' might not be the correct name
            const nodeEntry = shoukaku.nodes.entries().next().value;
            const node = nodeEntry ? nodeEntry[1] : null;
            
            if (node) {
                console.log('Found Lavalink node:', node.name);
                
                // Even if node.stats isn't fully populated, we can still show some information
                playersCount = node.stats && node.stats.players ? node.stats.players : client.kazagumo.players.size;
                
                // Get memory info if available
                if (node.stats && node.stats.memory) {
                    memoryUsedLavalink = `${(node.stats.memory.used / 1024 / 1024).toFixed(2)} MB`;
                } else {
                    memoryUsedLavalink = "Active";
                }
                
                // Get uptime if available
                if (node.stats && node.stats.uptime) {
                    uptimeLavalink = formatUptime(node.stats.uptime);
                } else {
                    uptimeLavalink = "Active";
                }
                
                // Node status info
                const connectedStatus = node.state === 1 ? "Connected" : "Connecting";
                
                lavalinkStats = `Status: ${connectedStatus}\nMemory: ${memoryUsedLavalink}\nPlayers: ${playersCount}\nUptime: ${uptimeLavalink}`;
            } else {
                // If no node found, check if we have players which means Lavalink is working
                if (client.kazagumo.players.size > 0) {
                    lavalinkStats = `Status: Connected\nPlayers: ${client.kazagumo.players.size}\nNode information not available`;
                }
            }
        } catch (error) {
            console.error('Error getting Lavalink stats:', error);
            
            // Even if we encounter an error, try to show the player count which should be accurate
            if (client.kazagumo.players.size > 0) {
                lavalinkStats = `Status: Connected\nPlayers: ${client.kazagumo.players.size}\nAdditional information not available`;
            }
        }
        
        // Create and send the stats embed
        const statsEmbed = createEmbed({
            title: `${config.botName} Statistics`,
            description: "", // Explicitly set to empty string to ensure a blank description
            fields: [
                {
                    name: 'Bot Stats',
                    value: [
                        `Servers: ${serverCount}`,
                        `Channels: ${channelCount}`,
                        `Users: ${userCount}`,
                        `Active Players: ${activeVoiceConnections}`,
                        `Uptime: ${botUptime}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'System Stats',
                    value: [
                        `Memory: ${memoryUsed} MB / ${memoryTotal} GB`,
                        `CPU: ${cpuModel}`,
                        `CPU Cores: ${cpuCount}`,
                        `CPU Usage: ${cpuUsagePercent}%`,
                        `Uptime: ${systemUptime}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Lavalink Stats',
                    value: lavalinkStats,
                    inline: false
                }
            ],
            footer: `Discord.js v${require('discord.js').version} • Node.js ${process.version}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [statsEmbed] });
    },
};

// Helper function to format uptime
function formatUptime(ms) {
    if (!ms || isNaN(ms)) return 'Unknown';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
}
