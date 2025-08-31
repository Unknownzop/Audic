const { createEmbed } = require('./embeds');

const { createCanvas, loadImage } = require('canvas');
const path = require('path');

module.exports = {
    createMusicCard: async (track, isPlaying = false, position = 0) => {
        try {
            // Creating music card for track
            
            const canvas = createCanvas(900, 250);
            const ctx = canvas.getContext('2d');

            // Sky blue gradient background 
            const gradient = ctx.createLinearGradient(0, 0, 900, 250);
            gradient.addColorStop(0, '#87CEEB'); // Sky blue
            gradient.addColorStop(1, '#4682B4'); // Steel blue for depth
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 900, 250);
            
            // Create a perfect square for the thumbnail area - YouTube Music mobile style
            // Size it to be a perfect square without any black bars
            ctx.save();
            // Create a clipping region exactly the size of the thumbnail
            const thumbX = 20;
            const thumbY = 25;
            const thumbSize = 200;
            ctx.beginPath();
            ctx.rect(thumbX, thumbY, thumbSize, thumbSize);
            ctx.closePath();
            ctx.clip();
            
            // Load and draw thumbnail
            let thumbnail;
            try {
                // Check if thumbnail exists and is a valid URL
                if (!track.thumbnail || track.thumbnail.startsWith('attachment://')) {
                    throw new Error('Invalid thumbnail URL: ' + track.thumbnail);
                }
                
                // Default fallback thumbnail URL if YouTube doesn't provide one
                if (track.thumbnail === 'https://i.ytimg.com/vi//default.jpg' || 
                    track.thumbnail === 'https://i.ytimg.com/vi/default.jpg') {
                    throw new Error('Invalid default YouTube thumbnail');
                }
                
                // Try to use a good quality thumbnail URL if it's a YouTube video
                if (track.uri && track.uri.includes('youtube.com') && track.uri.includes('v=')) {
                    const videoId = track.uri.split('v=')[1].split('&')[0];
                    if (videoId) {
                        const highQualityThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                        thumbnail = await loadImage(highQualityThumbnail);
                    } else {
                        throw new Error('Could not extract valid YouTube video ID');
                    }
                } else {
                    // For non-YouTube tracks, use the provided thumbnail
                    thumbnail = await loadImage(track.thumbnail);
                }
            } catch (imgError) {
                // Try to use a guaranteed default image hosted by Discord
                try {
                    // Discord's music icon (should be consistently available)
                    thumbnail = await loadImage('https://cdn.discordapp.com/attachments/1092885051546558574/1224143546803499089/music_note.png');
                } catch (fallbackError) {
                    // If even the Discord-hosted image fails, create a local fallback
                    const fallbackImg = createCanvas(200, 200);
                    const fctx = fallbackImg.getContext('2d');
                    fctx.fillStyle = '#36393f';
                    fctx.fillRect(0, 0, 200, 200);
                    fctx.fillStyle = '#ffffff';
                    fctx.font = 'bold 30px Arial';
                    fctx.textAlign = 'center';
                    fctx.fillText('♫', 100, 110);
                    thumbnail = fallbackImg;
                }
            }
            // YouTube Music mobile-style perfect square thumbnail
            ctx.drawImage(thumbnail, thumbX, thumbY, thumbSize, thumbSize);
            ctx.restore();
            
            // Add a subtle border to the album art
            ctx.strokeStyle = '#ffffff30';
            ctx.lineWidth = 2;
            ctx.strokeRect(thumbX, thumbY, thumbSize, thumbSize);
            
            // Playback progress bar background
            ctx.fillStyle = '#4e545c';
            ctx.fillRect(260, 170, 580, 6);
            
            // Calculate actual progress if position and length are provided
            let progressWidth = 0;
            if (position > 0 && track.length > 0) {
                // Calculate percentage of track completed
                const percentage = Math.min(position / track.length, 1);
                progressWidth = Math.floor(580 * percentage);
            } else {
                // For index.js version with zero duration, show empty progress
                progressWidth = 0;
            }
            
            // Draw the progress bar
            ctx.fillStyle = '#4682B4'; // Steel blue to match status badge
            ctx.fillRect(260, 170, progressWidth, 6);
            
            // Text styling for title
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px Arial';
            
            // Draw title (with truncation if needed)
            let title = track.title;
            if (title.length > 45) title = title.substring(0, 42) + '...';
            ctx.fillText(title, 260, 70);
            
            // Draw artist with darker color for better visibility
            ctx.font = 'bold 22px Arial';
            ctx.fillStyle = '#333333'; // Dark color for artist name
            ctx.fillText(track.author, 260, 110);
            
            // Draw duration with icon
            const duration = track.isStream ? 'LIVE' : module.exports.formatDuration(track.length);
            
            // Duration text with position if available (SoundCloud style)
            ctx.font = '18px Arial';
            ctx.fillStyle = '#ffffff';
            
            if (position > 0 && track.length > 0) {
                // Show current position / total duration for nowplaying command
                const positionText = module.exports.formatDuration(position);
                ctx.fillText(`⏱️ ${positionText}/${duration}`, 260, 210);
            } else {
                // Show "0:00/duration" for index.js (zero position) as requested
                ctx.fillText(`⏱️ 0:00/${duration}`, 260, 210);
            }
            
            // Status badge (Now Playing)
            if (isPlaying) {
                // Status badge background - create rounded rect manually
                ctx.fillStyle = '#4682B4'; // Steel blue to contrast with the sky blue background
                ctx.beginPath();
                // Draw rounded rectangle manually since roundRect may not be available
                const x = 750, y = 30, width = 120, height = 30, radius = 5;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
                
                // Status text
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('NOW PLAYING', 810, 50);
                ctx.textAlign = 'left';
                
                // Animated icon (simulated)
                ctx.fillStyle = '#ffffff';
                const bars = [10, 18, 14, 20, 12, 16];
                for (let i = 0; i < bars.length; i++) {
                    const height = bars[i];
                    ctx.fillRect(500 + i * 10, 110 - height/2, 5, height);
                }
            } else {
                // Play button icon
                ctx.fillStyle = '#ffffff80';
                ctx.beginPath();
                ctx.arc(810, 45, 20, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = '#ffffff';
                const size = 12;
                ctx.beginPath();
                ctx.moveTo(805, 35);
                ctx.lineTo(805, 55);
                ctx.lineTo(825, 45);
                ctx.closePath();
                ctx.fill();
            }
            
            // Generate the canvas buffer
            const buffer = canvas.toBuffer();
            return buffer;
        } catch (error) {
            // Fallback to embed if image creation fails - now with proper duration reference
            const duration = track.isStream ? 'LIVE' : module.exports.formatDuration(track.length);
            return createEmbed({
                title: isPlaying ? 'Now Playing' : 'Track',
                description: `**${track.title}**\n${track.author}\n\`${duration}\``,
                thumbnail: track.thumbnail
            });
        }
    },

    formatDuration: (ms) => {
        if (isNaN(ms) || ms <= 0) return '0:00';

        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        let result = '';
        if (hours > 0) {
            result += `${hours}:`;
            result += `${minutes.toString().padStart(2, '0')}:`;
        } else {
            result += `${minutes}:`;
        }
        result += `${seconds.toString().padStart(2, '0')}`;

        return result;
    },

    formatDurationLong: (ms) => {
        if (isNaN(ms) || ms <= 0) return '0 seconds';

        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        const parts = [];
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

        return parts.join(', ');
    },

    createProgressBar: (current, total, size = 15) => {
        if (isNaN(current) || isNaN(total)) return '';
        if (total <= 0) return '';

        const percentage = current / total;
        const progress = Math.round(size * percentage);
        const emptyProgress = size - progress;

        const progressText = '▓'.repeat(progress);
        const emptyProgressText = '░'.repeat(emptyProgress);

        return `[${progressText}${emptyProgressText}] (${Math.round(percentage * 100)}%)`;
    },

    formatQueuePage: (tracks, page = 1, tracksPerPage = 10) => {
        if (!tracks || !tracks.length) return 'No tracks in queue';

        const startIndex = (page - 1) * tracksPerPage;
        const endIndex = startIndex + tracksPerPage;
        const currentTracks = tracks.slice(startIndex, endIndex);

        let result = '';
        for (let i = 0; i < currentTracks.length; i++) {
            const track = currentTracks[i];
            const position = startIndex + i + 1;
            const duration = track.isStream ? 'LIVE' : module.exports.formatDuration(track.length);
            result += `**${position}.** [${track.title}](${track.uri}) \`[${duration}]\` | <@${track.requester.id}>\n`;
        }

        return result;
    }
};