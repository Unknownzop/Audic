const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createMusicCard } = require('../utils/formatters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for a song and choose one to play')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('The song to search for')
                .setRequired(true)),
    
    async execute(interaction) {
        const { client, member } = interaction;
        const guildId = interaction.guildId;
        const query = interaction.options.getString('query');
        
        // Check if user is in a voice channel
        if (!member.voice.channel) {
            return interaction.reply({ 
                content: 'You need to be in a voice channel to use this command!',
                ephemeral: true 
            });
        }
        
        await interaction.deferReply();
        
        try {
            // Wait for a brief moment to ensure nodes are properly registered
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if there are any available nodes before searching
            if (!client.kazagumo.shoukaku.nodes.size) {
                console.log('No Lavalink nodes are connected. Attempting to reconnect...');
                // Try to reconnect to nodes
                try {
                    await client.kazagumo.shoukaku.reconnect();
                    // Wait a brief moment for reconnection
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (reconnectError) {
                    console.error('Reconnection attempt failed:', reconnectError);
                }
                
                // Check again if nodes are available
                if (!client.kazagumo.shoukaku.nodes.size) {
                    return interaction.editReply({ 
                        embeds: [errorEmbed('Music server is currently unavailable. Please try again later.')]
                    });
                }
            }
            
            // Search for tracks with better error handling
            const searchResult = await client.kazagumo.search(query, { 
                engine: 'youtube_music', // Use YouTube Music as the source
                requester: interaction.user 
            }).catch(error => {
                console.error('Search error:', error);
                // Display a more user-friendly error message
                if (error.message && error.message.includes('Connect Timeout Error')) {
                    throw new Error('Connection to music server timed out. Please try again later.');
                } else if (error.message && error.message.includes('fetch failed')) {
                    throw new Error('Unable to connect to music server. Please try again soon.');
                } else if (error.message && error.message.includes('AbortError')) {
                    throw new Error('Search was interrupted. Please try again.');
                } else {
                    throw new Error(`Unable to search: ${error.message || 'Unknown error'}`);
                }
            });
            
            if (!searchResult || !searchResult.tracks || !searchResult.tracks.length) {
                return interaction.editReply({ 
                    content: `No results found for: ${query}`
                });
            }
            
            // Limit to 10 results maximum and filter out videos
            const tracks = searchResult.tracks
                .filter(track => track && track.title && !track.title.toLowerCase().includes('video'))
                .slice(0, 10);
            
            if (!tracks.length) {
                return interaction.editReply({ 
                    content: `No music results found for: ${query} (filtered out videos)`
                });
            }
            
            // Create select menu with search results
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('search-select')
                .setPlaceholder('Select a track to play');
                
            // Add each track as an option
            tracks.forEach((track, index) => {
                selectMenu.addOptions({
                    label: `${track.title.substring(0, 90)}${track.title.length > 90 ? '...' : ''}`,
                    description: ' ', // Non-empty space to satisfy Discord.js requirement
                    value: index.toString()
                });
            });
            
            const row = new ActionRowBuilder().addComponents(selectMenu);
            
            // Create embed with search results, but don't include song names
            const searchEmbed = createEmbed({
                title: 'Search Results',
                description: `Here are the search results for: **${query}**\n\nSelect a track to play from the dropdown menu below.`,
                thumbnail: client.user.displayAvatarURL()
            });
            
            const response = await interaction.editReply({
                embeds: [searchEmbed],
                components: [row]
            });
            
            // Create collector for select menu interaction
            const collector = response.createMessageComponentCollector({ 
                componentType: ComponentType.StringSelect,
                time: 30000 // 30 seconds
            });
            
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ 
                        content: 'This menu is not for you!', 
                        ephemeral: true 
                    });
                }
                
                // Get selected track
                const selectedIndex = parseInt(i.values[0]);
                const selectedTrack = tracks[selectedIndex];
                
                try {
                    // Get existing player or create a new one
                    let player = client.kazagumo.players.get(guildId);
                    
                    if (!player) {
                        player = await client.kazagumo.createPlayer({
                            guildId: guildId,
                            voiceId: member.voice.channel.id,
                            textId: interaction.channelId,
                            deaf: true
                        });
                        
                        // Wait briefly to ensure the player is fully initialized
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    // Verify player is properly initialized before accessing queue
                    if (!player || !player.queue) {
                        throw new Error('Unable to initialize player. Please try again.');
                    }
                    
                    // Play the selected track
                    player.queue.add(selectedTrack);
                    
                    if (!player.playing && !player.paused) {
                        await player.play();
                    }
                    
                    // Create a simple embed for the selected track
                    const trackEmbed = createEmbed({
                        title: 'Added to Queue',
                        description: `**[${selectedTrack.title}](${config.supportServer})**`,
                        color: '#f47fff'
                    });
                    
                    const replyContent = {
                        content: '',
                        embeds: [trackEmbed],
                        components: []
                    };
                    
                    await i.update(replyContent);
                } catch (error) {
                    console.error('Error playing selected track:', error);
                    await i.update({ 
                        content: `Error playing track: ${error.message || 'Unknown error'}. Please try again.`, 
                        embeds: [], 
                        components: [] 
                    });
                }
                
                // End collector after selection
                collector.stop();
            });
            
            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply({ 
                        content: 'Search selection timed out.', 
                        embeds: [], 
                        components: [] 
                    }).catch(() => {});
                }
            });
            
        } catch (error) {
            console.error('Error in search command:', error);
            return interaction.editReply({ 
                content: `An error occurred while searching: ${error.message}` 
            });
        }
    },
};