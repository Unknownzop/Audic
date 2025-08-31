const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar, createMusicCard } = require('../utils/formatters');
const { getActiveFilter, getFilterDisplayName, hasActiveFilter } = require('../utils/filters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show currently playing track'),
    
    async execute(interaction) {
        try {
            const { client } = interaction;
            const guildId = interaction.guildId;
            
            // Get the player for this guild
            const player = client.kazagumo.players.get(guildId);
            
            if (!player) {
                return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
            }
            
            // Get current track
            const current = player.queue.current;
            
            if (!current) {
                return interaction.reply({ embeds: [errorEmbed('There is no track currently playing!')], ephemeral: true });
            }
            
            // Get position and track info
            const position = player.position;
            const duration = current.length;
            const isStream = current.isStream;
            
            // Format duration string to match "0:00/duration" format with no space
            const durationText = isStream ? 'LIVE' : formatDuration(duration);
            const positionText = formatDuration(position);
            const durationDisplay = `${positionText}/${durationText}`;
            
            // Generate music card image with current position for progress bar
            const musicCard = await createMusicCard(current, true, position);
            
            // Create progress bar
            const progressBar = isStream ? 'LIVE' : createProgressBar(position, duration);
            
            // Check if there's an active filter
            const activeFilter = hasActiveFilter(player) ? getFilterDisplayName(getActiveFilter(player)) : 'None';
            
            // Prepare the reply based on whether music card is an image or fallback embed
            let reply;
            
            if (Buffer.isBuffer(musicCard)) {
                // For the image buffer, we'll create an attachment using AttachmentBuilder
                const attachment = new AttachmentBuilder(musicCard, { name: 'nowplaying.png' });
                
                // Create the embed properly
                const embed = new EmbedBuilder()
                    .setTitle('Now Playing')
                    .setDescription(`**[${current.title}](${config.supportServer})** • \`${durationDisplay}\`\n<@${current.requester.id}>\n\n**Progress**: ${progressBar}\n**Volume**: ${player.volume}% | **Filter**: ${activeFilter} | **Loop**: ${getLoopModeName(player.loop)}`)
                    .setColor('#87CEEB') // Sky blue to match the card
                    .setImage('attachment://nowplaying.png');
                
                reply = {
                    embeds: [embed],
                    files: [attachment]
                };
            } else {
                // Fallback to the embed if image creation failed
                // Make sure the description follows the correct format (track name • duration)
                musicCard.description = `**[${current.title}](${config.supportServer})** • \`${durationDisplay}\`\n<@${current.requester.id}>\n\n${progressBar}`;
                
                // Add minimal fields for additional info that should still be shown
                musicCard.fields = [
                    {
                        name: 'Volume',
                        value: `${player.volume}%`,
                        inline: true
                    },
                    {
                        name: 'Filter',
                        value: activeFilter,
                        inline: true
                    },
                    {
                        name: 'Loop',
                        value: getLoopModeName(player.loop),
                        inline: true
                    }
                ];
                
                reply = { embeds: [musicCard] };
            }
            
            // No interactive components in nowplaying command per user request
            
            // Reply with the music card and controls
            await interaction.reply(reply);
        } catch (error) {
            console.error("Error in nowplaying command:", error);
            return interaction.reply({ embeds: [errorEmbed('An error occurred while getting the now playing information!')], ephemeral: true });
        }
    }
};

// Helper function to get loop mode display name
function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}


