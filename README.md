# 🎵 Audic Discord Music Bot

A powerful, modern Discord music bot for seamless audio streaming, advanced filters, and interactive controls.

---

## ✨ Features

- ⏯️ **Pause/Resume Button**: Instantly and reliably pause or resume music playback with clear feedback.
- 🔁 **Replay Button**: Always restarts the current song from the beginning, regardless of previous state.
- 🎚️ **Instant Audio Filters**: Apply audio filters (Nightcore, Bass Boost, 8D, etc.) with near-instant effect and immediate user feedback.
- 🚪 **Robust Leave Button**: Leave channel button never crashes the bot and always responds gracefully.
- 🎶 **Queue & Playback Controls**: Skip, shuffle, stop, and more, all with interactive buttons.
- 🖼️ **Now Playing Panel**: Beautiful music card with progress bar, controls, and filter selection.
- 💬 **Slash Commands**: Modern, easy-to-use slash commands for all major features.
- 🛡️ **Error Handling**: All user actions are acknowledged, and errors are handled gracefully.

---

## 🚀 Getting Started

1. 📥 **Clone the repository**
   ```bash
   git clone https://github.com/Unknownzop/Audic.git
   cd Audic
   ```
2. 📦 **Install dependencies**
   ```bash
   npm install
   ```
3. ⚙️ **Set up your environment variables**
   - Create a file named `.env` in the project root.
   - Add the following variables (see below for how to get them):
     ```env
     DISCORD_TOKEN=your_discord_bot_token
     CLIENT_ID=your_discord_client_id
     LAVALINK_HOST=your_lavalink_host
     LAVALINK_PORT=your_lavalink_port
     LAVALINK_PASSWORD=your_lavalink_password
     SUPPORT_SERVER=your_support_server_url (optional)
     ```
   - **How to get these:**
     - `DISCORD_TOKEN` and `CLIENT_ID`: [Create a Discord bot application](https://discord.com/developers/applications), copy the token and client ID from the "Bot" and "General Information" tabs.
     - `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`: [Set up your own Lavalink server](https://github.com/freyacodes/Lavalink) or use a public Lavalink host (if available). Enter the host, port, and password as provided by your Lavalink instance.
     - `SUPPORT_SERVER`: (Optional) Your Discord support server invite link.
4. ▶️ **Run the bot**
   ```bash
   node index.js
   ```

---

## 📖 Usage Guide

### 1. 🤖 **Invite the Bot to Your Server**
- Use the OAuth2 URL generator in the Discord Developer Portal to create an invite link with the `bot` and `applications.commands` scopes, and permissions for reading, sending messages, and managing voice channels.

### 2. 🎤 **Play Music**
- Join a voice channel.
- Use `/play <song name or URL>` to start playing music.
- Use the interactive buttons (Pause/Resume, Replay, Skip, Shuffle, Stop) or slash commands to control playback.

### 3. 🎚️ **Apply Filters**
- Use the filter dropdown in the Now Playing panel or slash commands like `/nightcore`, `/bassboost`, etc.
- Filters are applied instantly and acknowledged in chat.

### 4. ⏯️ **Pause/Resume**
- Use the Pause/Resume button or `/pause` and `/resume` commands.

### 5. 🚪 **Leave Channel**
- Use the Leave Channel button or `/leave` command to disconnect the bot from voice.

### 6. 🆘 **Help & Support**
- Use `/help` to see all available commands and features.
- For support, contact [Unknownz](https://discordapp.com/users/1092773378101882951) on Discord.

---

## 🙏 Thanks To

Special thanks to **HX Dev** for their help in fixing, optimizing, and improving the bot's features and user experience! 💡

You can reach out to [HX Dev](https://discordapp.com/users/655010590980309013) on Discord. 💬

---

Enjoy your music experience! 🎧
