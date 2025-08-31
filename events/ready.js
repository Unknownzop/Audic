const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        const config = require('../config');
        // Set bot activity
        client.user.setActivity('/help', { type: 2 }); // 2 = Listening to
        
        // Log bot startup to webhook
        const logger = require('../utils/logger');
        logger.system('Bot Online', `Logged in as ${client.user.tag}`, [
            { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Users', value: `${client.users.cache.size}`, inline: true }
        ]);

        try {
            // Register slash commands
            const commands = [];
            const commandsPath = path.join(__dirname, '..', 'commands');
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const command = require(path.join(commandsPath, file));
                commands.push(command.data.toJSON());
            }

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
            
            logger.system('Command Registration', 'Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );

            logger.system('Command Registration', 'Successfully reloaded application (/) commands.', [
                { name: 'Commands Count', value: `${commands.length}`, inline: true }
            ]);
        } catch (error) {
            logger.error('Command Registration', error);
        }
    },
};
