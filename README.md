# Audic 🎧

Audic is a modern, high-performance Discord music bot built for clarity, control, and immersive audio experiences. Powered by Lavalink, Shoukaku, and Kazagumo, it delivers seamless playback, advanced filters, and intelligent queue handling—all wrapped in a clean, modular codebase.

Whether you're running a chill community or a high-traffic server, Audic stays responsive, scalable, and easy to manage.

---

## 🚀 Features

- 🎶 Stream music from YouTube and other sources via Lavalink
- 🎛️ Apply real-time audio filters (bass boost, vaporwave, etc.)
- 📜 Full slash command support with autocomplete
- 📦 Lightweight and modular codebase using Shoukaku + Kazagumo
- 🔒 Permission-aware command execution
- 🧠 Smart queue with skip, loop, shuffle, and more
- 📊 Live now-playing embeds with controls
- 🌐 Multi-guild support with isolated queues
- ⚙️ Easy config via `.env` and `config.js`

---

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/Unknownzop/Audic.git
cd Audic
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
- Copy `.env.example` to `.env`
- Fill in your bot token, client ID, Lavalink host/port/password, and other required fields

### 4. Start the bot
```bash
node index.js
```

---

## 📁 Folder Structure

| Folder        | Purpose                                 |
|---------------|------------------------------------------|
| `commands/`   | Slash command definitions                |
| `events/`     | Discord event listeners                  |
| `utils/`      | Helper functions and shared logic        |
| `config.js`   | Bot configuration                        |
| `index.js`    | Entry point and client initialization    |

---

## ✅ Requirements

- Node.js v16 or higher
- A running Lavalink server (self-hosted or remote)
- Discord bot token with proper intents enabled

---

## 🔗 Useful Links

- [Audic GitHub Repository](https://github.com/Unknownzop/Audic)
- [Lavalink Setup Guide](https://github.com/freyacodes/Lavalink)
- [Shoukaku Documentation](https://github.com/Deivu/Shoukaku)
- [Kazagumo Documentation](https://kazagumo.js.org/)
- [Discord.js Guide](https://discordjs.guide/)
- [Node.js Official Site](https://nodejs.org/)

---

## 🤝 Contributing

We welcome clean, minimal, and production-ready contributions. Please:

- Follow the existing code style
- Avoid bloated or derivative features
- Submit clear pull requests with concise descriptions

---

## 🙏 Special Thanks

Massive thanks to **[hxdev](https://github.com/hxdev-is-here)** for helping resolve critical bot issues and debugging persistent errors during early development. Their deep understanding of Lavalink integration and Discord.js helped stabilize Audic’s architecture and ensured smooth playback across multiple environments.

---

## 📄 License

This project is licensed under the MIT License.  
© [Unknownzop](https://github.com/Unknownzop)
