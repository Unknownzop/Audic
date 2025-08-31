const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Get links to vote for Audic on bot lists'),
    
    async execute(interaction) {
        const voteEmbed = createEmbed({
            title: 'Vote for Audic',
            description: 'Your votes help Audic grow and reach more communities!\n\n' +
                       '[Vote on top.gg](https://top.gg/bot/1350367956642697249/vote)\n' +
                       '[Vote on Discord Bot List](https://discordbotlist.com/bots/audic/upvote)',
            color: '#87CEEB'
        });
        
        await interaction.reply({ embeds: [voteEmbed] });
    }
};