const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Genius = require('genius-lyrics');

// Initialize Genius client
const geniusClient = new Genius.Client(config.genius.apiKey);

// Fallback to LRCLib API if Genius fails
const LRCLIB_API_URL = 'https://lrclib.net/api/search';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Get lyrics for the current song or a specified song')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('Song to search for (if not provided, will use currently playing song)')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const { client } = interaction;
            const guildId = interaction.guildId;
            
            // Get the query from options
            let query = interaction.options.getString('query');
            
            // Attempt to get the player - this may be null if no player exists
            let player;
            try {
                player = client.kazagumo.players.get(guildId);
            } catch (err) {
                console.error(`Error getting player for guild ${guildId}:`, err);
                player = null;
            }
            
            console.log(`Lyrics command - Query: ${query || 'none'}, Guild ID: ${guildId}`);
            console.log(`Player exists: ${!!player}, Has queue: ${player ? !!player.queue : false}, Has current: ${player && player.queue ? !!player.queue.current : false}`);
            
            // Check if we have query OR currently playing song
            const currentTrack = player?.queue?.current;
            
            if (!query && !currentTrack) {
                return interaction.reply({ 
                    embeds: [errorEmbed('No song specified and nothing is currently playing!')] 
                });
            }
            
            await interaction.deferReply();
            
            // Extract artist and title information
            let artistName = '';
            let trackName = '';
            
            if (!query && currentTrack) {
                console.log('Using current track for lyrics search:', currentTrack.title);
                
                // Process title to extract artist and track info
                const { processedTitle, extractedArtist } = processSongTitle(currentTrack.title);
                
                trackName = processedTitle;
                
                // Use extracted artist or check all possible author/artist fields in the track object
                artistName = extractedArtist || 
                             currentTrack.author || 
                             currentTrack.artist || 
                             '';
                
                // If the title already has "Artist - Song" format, use the parts directly
                if (!extractedArtist && trackName.includes(" - ")) {
                    const parts = trackName.split(" - ");
                    if (parts.length === 2) {
                        artistName = parts[0].trim();
                        trackName = parts[1].trim();
                    }
                }
                
                console.log(`Extracted info from current track - Title: "${trackName}", Artist: "${artistName}"`);
                query = artistName ? `${trackName} ${artistName}` : trackName;
            } else if (query) {
                console.log(`Using provided query: ${query}`);
                // Try to extract artist and track from the query
                if (query.includes(" - ")) {
                    const parts = query.split(" - ");
                    artistName = parts[0].trim();
                    trackName = parts[1].trim();
                } else if (query.includes(" by ")) {
                    const parts = query.split(" by ");
                    trackName = parts[0].trim();
                    artistName = parts[1].trim();
                } else {
                    // Process the query to see if we can extract artist info
                    const { processedTitle, extractedArtist } = processSongTitle(query);
                    if (extractedArtist) {
                        artistName = extractedArtist;
                        trackName = processedTitle;
                    } else {
                        trackName = query;
                    }
                }
            }
            
            console.log(`Searching lyrics for: ${query} (Artist: ${artistName}, Track: ${trackName})`);
            
            try {
                // First, try to get lyrics from Genius API
                let lyrics = '';
                let displayTitle = trackName || query;
                let displayArtist = artistName || "Unknown Artist";
                let lyricSource = "Unknown";
                
                console.log(`Searching Genius for lyrics: ${query}`);
                
                // STEP 1: Try with full query
                try {
                    // Search using genius-lyrics NPM package
                    const searches = await geniusClient.songs.search(query);
                    
                    if (searches && searches.length > 0) {
                        // Get the first result (most relevant)
                        const firstSong = searches[0];
                        console.log(`Found song on Genius: ${firstSong.title} by ${firstSong.artist.name}`);
                        
                        // Get lyrics for this song
                        const fetchedLyrics = await firstSong.lyrics();
                        
                        if (fetchedLyrics) {
                            displayTitle = firstSong.title;
                            displayArtist = firstSong.artist.name;
                            
                            // Create the lyrics string with song info
                            lyrics = `**${displayTitle}** by **${displayArtist}**\n\n`;
                            lyrics += fetchedLyrics;
                            
                            // Add source attribution
                            lyrics += `\n\n*Lyrics provided by Genius*`;
                            lyricSource = "Genius";
                        }
                    }
                } catch (geniusError) {
                    console.error('Error with Genius API using full query:', geniusError);
                }
                
                // STEP 2: If no lyrics found, try with artist + track as separate entities
                if (!lyrics && artistName && trackName) {
                    try {
                        console.log(`Trying Genius with artist and track name separately: "${artistName}" - "${trackName}"`);
                        const formattedQuery = `${artistName} ${trackName}`;
                        const searches = await geniusClient.songs.search(formattedQuery);
                        
                        if (searches && searches.length > 0) {
                            // Get the first result
                            const firstSong = searches[0];
                            console.log(`Found song on Genius (second attempt): ${firstSong.title} by ${firstSong.artist.name}`);
                            
                            // Get lyrics for this song
                            const fetchedLyrics = await firstSong.lyrics();
                            
                            if (fetchedLyrics) {
                                displayTitle = firstSong.title;
                                displayArtist = firstSong.artist.name;
                                
                                lyrics = `**${displayTitle}** by **${displayArtist}**\n\n`;
                                lyrics += fetchedLyrics;
                                lyrics += `\n\n*Lyrics provided by Genius*`;
                                lyricSource = "Genius";
                            }
                        }
                    } catch (secondGeniusError) {
                        console.error('Error with Genius API on second attempt:', secondGeniusError);
                    }
                }
                
                // STEP 3: Fall back to LRCLib
                if (!lyrics) {
                    console.log('No lyrics found on Genius, trying LRCLib');
                    
                    try {
                        // Construct search parameters for LRCLib
                        const searchParams = new URLSearchParams();
                        if (artistName) searchParams.append('artist_name', artistName);
                        if (trackName) searchParams.append('track_name', trackName);
                        
                        // Call the LRCLib API
                        const searchUrl = `${LRCLIB_API_URL}?${searchParams.toString()}`;
                        console.log(`LRCLib API URL: ${searchUrl}`);
                        
                        const response = await fetch(searchUrl);
                        if (!response.ok) {
                            throw new Error(`LRCLib API returned ${response.status}: ${response.statusText}`);
                        }
                        
                        const results = await response.json();
                        
                        if (results && results.length > 0) {
                            // Use the first result
                            const result = results[0];
                            displayTitle = result.trackName || displayTitle;
                            displayArtist = result.artistName || displayArtist;
                            
                            // Create a header with song info
                            lyrics = `**${displayTitle}** by **${displayArtist}**\n\n`;
                            
                            if (result.plainLyrics) {
                                lyrics += result.plainLyrics;
                            } else if (result.syncedLyrics) {
                                // Convert synced lyrics to plain text by removing timestamps
                                lyrics += result.syncedLyrics
                                    .split('\n')
                                    .map(line => line.replace(/\[\d+:\d+\.\d+\]/g, ''))
                                    .join('\n');
                            } else {
                                lyrics += "Lyrics were found but could not be displayed.";
                            }
                            
                            // Add source attribution
                            lyrics += `\n\n*Lyrics provided by LRCLib*`;
                            lyricSource = "LRCLib";
                        }
                    } catch (lrcLibError) {
                        console.error('Error with LRCLib API:', lrcLibError);
                    }
                }
                
                // STEP 4: If still no lyrics, try with artist-only search
                if (!lyrics && artistName) {
                    try {
                        console.log(`Trying with artist name only: "${artistName}"`);
                        const searches = await geniusClient.songs.search(artistName);
                        
                        if (searches && searches.length > 0) {
                            // Try to find the best match by title
                            let bestMatch = null;
                            
                            if (trackName) {
                                // Find song with closest title match
                                const trackNameLower = trackName.toLowerCase();
                                for (const song of searches.slice(0, 5)) { // Check first 5 results
                                    if (song.title.toLowerCase().includes(trackNameLower)) {
                                        bestMatch = song;
                                        break;
                                    }
                                }
                            }
                            
                            // If no match found, use the first result
                            if (!bestMatch) bestMatch = searches[0];
                            
                            console.log(`Found song on Genius (artist-only): ${bestMatch.title} by ${bestMatch.artist.name}`);
                            
                            // Get lyrics for this song
                            const fetchedLyrics = await bestMatch.lyrics();
                            
                            if (fetchedLyrics) {
                                displayTitle = bestMatch.title;
                                displayArtist = bestMatch.artist.name;
                                
                                lyrics = `**${displayTitle}** by **${displayArtist}**\n\n`;
                                lyrics += fetchedLyrics;
                                lyrics += `\n\n*Lyrics provided by Genius (artist match)*`;
                                lyricSource = "Genius (Artist Match)";
                            }
                        }
                    } catch (artistOnlyError) {
                        console.error('Error with Genius API using artist only:', artistOnlyError);
                    }
                }
                
                // STEP 5: If still no lyrics, create a helpful message
                if (!lyrics) {
                    lyrics = `No lyrics found for **${displayTitle}** by **${displayArtist}**\n\n`;
                    lyrics += `I tried searching with:\n`;
                    
                    if (query) lyrics += `• Full query: "${query}"\n`;
                    if (artistName && trackName) lyrics += `• Artist + Track: "${artistName}" - "${trackName}"\n`;
                    if (artistName) lyrics += `• Artist only: "${artistName}"\n`;
                    
                    lyrics += `\nYou can try to find lyrics for this song at:\n`;
                    lyrics += `• Genius: https://genius.com/search?q=${encodeURIComponent(query || `${artistName} ${trackName}`.trim())}\n`;
                    lyrics += `• AZLyrics: https://search.azlyrics.com/search.php?q=${encodeURIComponent(query || `${artistName} ${trackName}`.trim())}\n`;
                    lyrics += `• LRCLib: https://lrclib.net/search?q=${encodeURIComponent(query || `${artistName} ${trackName}`.trim())}\n`;
                    
                    lyricSource = "Not Found";
                }
                
                // Split lyrics into chunks if they're too long for Discord embeds
                const lyricsChunks = chunkLyrics(lyrics, 4000);
                
                // Create the initial lyrics embed
                const lyricsEmbed = createEmbed({
                    title: `Lyrics`,
                    description: lyricsChunks[0],
                    footer: `Requested by ${interaction.user.tag}${lyricsChunks.length > 1 ? ` • Page 1/${lyricsChunks.length}` : ''}`,
                    timestamp: true
                });
                
                // Set up pagination if needed
                if (lyricsChunks.length > 1) {
                    await handlePagination(interaction, lyricsEmbed, lyricsChunks);
                } else {
                    await interaction.editReply({ embeds: [lyricsEmbed] });
                }
            } catch (error) {
                console.error('Error in lyrics APIs:', error);
                return interaction.editReply({ 
                    embeds: [errorEmbed(`Failed to fetch lyrics: ${error.message}`)] 
                });
            }
        } catch (error) {
            console.error('Error in lyrics command:', error);
            return interaction.editReply({ 
                embeds: [errorEmbed(`An error occurred while processing lyrics command: ${error.message}`)] 
            });
        }
    }
};

/**
 * Handle pagination for long lyrics
 * @param {Object} interaction - Discord interaction
 * @param {Object} initialEmbed - Initial embed to show
 * @param {Array} chunks - Array of lyrics chunks
 */
async function handlePagination(interaction, initialEmbed, chunks) {
    let currentPage = 0;
    
    // Create navigation buttons
    const prevButton = new ButtonBuilder()
        .setCustomId('prev_page')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true); // Disabled on first page
        
    const nextButton = new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary);
        
    const row = new ActionRowBuilder().addComponents(prevButton, nextButton);
    
    // Send the initial message with buttons
    const response = await interaction.editReply({
        embeds: [initialEmbed],
        components: [row],
        fetchReply: true
    });
    
    // Create a collector for button interactions
    const collector = response.createMessageComponentCollector({ 
        time: 120000 // 2 minutes
    });
    
    collector.on('collect', async (buttonInteraction) => {
        // Make sure it's the same user who used the command
        if (buttonInteraction.user.id !== interaction.user.id) {
            return buttonInteraction.reply({ 
                content: "You can't use these buttons as you didn't request the lyrics.", 
                ephemeral: true 
            });
        }
        
        // Handle button presses
        if (buttonInteraction.customId === 'prev_page' && currentPage > 0) {
            currentPage--;
        } else if (buttonInteraction.customId === 'next_page' && currentPage < chunks.length - 1) {
            currentPage++;
        }
        
        // Update button states
        prevButton.setDisabled(currentPage === 0);
        nextButton.setDisabled(currentPage === chunks.length - 1);
        
        // Update the embed
        const updatedEmbed = createEmbed({
            title: `Lyrics`,
            description: chunks[currentPage],
            footer: `Requested by ${interaction.user.tag} • Page ${currentPage + 1}/${chunks.length}`,
            timestamp: true
        });
        
        // Update the message
        await buttonInteraction.update({
            embeds: [updatedEmbed],
            components: [new ActionRowBuilder().addComponents(prevButton, nextButton)]
        });
    });
    
    collector.on('end', async () => {
        // Disable all buttons when the collector ends
        prevButton.setDisabled(true);
        nextButton.setDisabled(true);
        
        try {
            await interaction.editReply({
                components: [new ActionRowBuilder().addComponents(prevButton, nextButton)]
            });
        } catch (error) {
            // Message might be too old to edit
            console.error('Failed to disable buttons after timeout:', error);
        }
    });
}

/**
 * Split lyrics into chunks to fit within Discord embed limits
 * @param {string} lyrics - The full lyrics text
 * @param {number} maxLength - Maximum length per chunk
 * @returns {Array} Array of lyrics chunks
 */
function chunkLyrics(lyrics, maxLength = 4000) {
    if (lyrics.length <= maxLength) return [lyrics];
    
    const chunks = [];
    let currentChunk = '';
    
    // Split the lyrics by line
    const lines = lyrics.split('\n');
    
    for (const line of lines) {
        // If adding this line would exceed the max length, push the current chunk and start a new one
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            // Otherwise, add the line to the current chunk
            if (currentChunk.length > 0) {
                currentChunk += '\n';
            }
            currentChunk += line;
        }
    }
    
    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}

/**
 * Process a song title to clean it up and potentially extract artist information
 * @param {string} title - The raw song title
 * @returns {Object} Object containing processedTitle and possibly extractedArtist
 */
function processSongTitle(title) {
    let result = {
        processedTitle: '',
        extractedArtist: null
    };
    
    // Keep track of the original title in case our processing doesn't yield good results
    const originalTitle = title;
    
    // Step 1: Remove content in brackets and parentheses
    let processed = title
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')  // Remove content in brackets/parentheses
        .replace(/official\s*(music)?\s*video/i, '')
        .replace(/lyrics?\s*video/i, '')
        .replace(/audio/i, '')
        .replace(/official/i, '')
        .replace(/hd|hq/i, '')
        .replace(/\s{2,}/g, ' ')  // Remove extra spaces
        .trim();
    
    // Step 2: Check if the title has a common format of "Artist - Title"
    // This is a common format for YouTube music videos
    if (processed.includes(" - ")) {
        const parts = processed.split(" - ");
        
        // Simple case: "Artist - Title"
        if (parts.length === 2) {
            result.extractedArtist = parts[0].trim();
            result.processedTitle = parts[1].trim();
            return result;
        }
        
        // More complex case: Could be something like "Artist1, Artist2 - Title - Official Video"
        if (parts.length > 2) {
            // Assume first part is artist, second is title, rest is extra info we can ignore
            result.extractedArtist = parts[0].trim();
            result.processedTitle = parts[1].trim();
            return result;
        }
    }
    
    // Step 3: Check for "Title by Artist" format (common in some sources)
    if (processed.includes(" by ")) {
        const parts = processed.split(" by ");
        if (parts.length >= 2) {
            result.processedTitle = parts[0].trim();
            // The rest could be complex like "Artist1 and Artist2 and ..."
            result.extractedArtist = parts.slice(1).join(" by ").trim();
            return result;
        }
    }
    
    // Step 4: Check for "Artist - Topic" format (common in YouTube auto-generated channels)
    if (processed.includes(" - Topic")) {
        result.extractedArtist = processed.replace(" - Topic", "").trim();
        // Since we don't have a title here, we'll use the original without "- Topic"
        result.processedTitle = originalTitle.replace(/ - Topic/i, "").trim();
        return result;
    }
    
    // Step 5: Check for "Title (feat. Artist)" format
    const featMatch = originalTitle.match(/(.+?)(?:\(|\[|\s)feat(?:uring|\.)?\s+(.+?)(?:\)|\]|$)/i);
    if (featMatch) {
        result.processedTitle = featMatch[1].trim();
        result.extractedArtist = featMatch[2].trim();
        return result;
    }
    
    // If we get here, we couldn't parse in a structured way
    // Just return the cleaned title
    result.processedTitle = processed || originalTitle;
    return result;
}