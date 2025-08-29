# Claude Code Helper

[![English](https://img.shields.io/badge/Language-English-blue.svg)](README.md) [![中文](https://img.shields.io/badge/Language-中文-red.svg)](README_ZH.md)

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/daodao97.claude-code-helper?style=for-the-badge&logo=visual-studio-code&logoColor=white&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/daodao97.claude-code-helper?style=for-the-badge&color=4CAF50)](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/daodao97.claude-code-helper?style=for-the-badge&color=FFD700)](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)

[![Open VSX Version](https://img.shields.io/open-vsx/v/daodao97/claude-code-helper?style=for-the-badge&logo=eclipse-ide&logoColor=white&color=C865B9)](https://open-vsx.org/extension/daodao97/claude-code-helper)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/daodao97/claude-code-helper?style=for-the-badge&color=4CAF50)](https://open-vsx.org/extension/daodao97/claude-code-helper)
[![Open VSX Rating](https://img.shields.io/open-vsx/rating/daodao97/claude-code-helper?style=for-the-badge&color=FFD700)](https://open-vsx.org/extension/daodao97/claude-code-helper)

A VSCode extension optimized for Claude Code development, featuring audio feedback, Hook system, and command-line tools to enhance your Claude Code development experience.

## 🚀 Installation

### Install from VSCode Marketplace (Recommended)
1. Open VSCode
2. Go to the Extension Marketplace: [Claude Code Helper](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
3. Click the "Install" button

### Install from Open VSX (Alternative)
For VSCodium, Gitpod, and other editors supporting Open VSX:
1. Go to [Open VSX Registry](https://open-vsx.org/extension/daodao97/claude-code-helper)
2. Click the "Install" button or download the `.vsix` file
3. Or search for "Claude Code Helper" in your editor's extension marketplace

### Install via Command Palette
1. Press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) to open the command palette
2. Type `Extensions: Install Extensions`
3. Search for "Claude Code Helper"
4. Install the extension

## ✨ Core Features

### 🎵 Smart Audio Feedback System
- **Tool-specific sound effects**: Each Claude Code tool has its unique sound prompt
- **Status audio feedback**: Different sound effects for start, success, and error states
- **Custom audio**: Support for custom audio files to personalize your work environment
- **Audio preview**: Real-time preview of selected sound effects

### 🔧 Claude Code Hooks Integration
- **One-click installation**: Automatically generate Claude Code Hooks configuration
- **Tool monitoring**: Monitor file operations like `Edit`, `MultiEdit`, `Write`, etc.
- **Smart file opening**: Automatically open files in VSCode after operations
- **Audio notifications**: Play corresponding sound effects when operations succeed or fail

### 💻 Powerful Command Line Tool (cchelper)
After installing the extension, you automatically get the `cchelper` command-line tool:

```bash
# Play notification sounds
cchelper play Read success
cchelper play Write error

# Open files in VSCode
cchelper open /path/to/file.js
cchelper open /path/to/file.js 42  # Open and jump to line 42

# Show file in file manager
cchelper reveal /path/to/file.js

# Show file information
cchelper info /path/to/file.js

# Process Claude Code Hooks data
echo '{"tool_name": "Read", "tool_input": {...}}' | cchelper hook
```

### 🎯 Smart Terminal Management
- **Claude CLI shortcuts**: One-click execution of common Claude Code commands
- **Smart terminal positioning**: Support for both right panel and bottom panel display modes
- **Environment variable management**: Automatically apply environment variables to new terminals
- **Multi-line command support**: Support for complex command input and execution
- **Command history**: Automatically save command history for easy reuse

## 📖 Detailed Usage Guide

### Audio Configuration
1. Open command palette: `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Search for "Claude Code Helper: Open Command Panel"
3. In the "Audio Settings" area:
   - Select audio files for different tools
   - Use preview buttons to test sound effects
   - Support for `.wav`, `.mp3`, `.ogg`, and other formats

### Hooks Configuration
1. Click "Install Claude Code Hooks" in the extension panel
2. Choose configuration file location (global or project):
   - **Global configuration**: `~/.claude/settings.json`
   - **Project configuration**: `.claude/settings.json`
3. Automatically generate configuration including:
   - Audio prompts before file operations
   - Audio notifications and automatic file opening after operations

### CLI Tool Installation
After extension installation, the `cchelper` command is automatically installed:
- **macOS/Linux**: Attempts to install to `/usr/local/bin`, `/opt/homebrew/bin`
- **Windows**: Installs to user directory with PATH configuration guidance
- **Fallback mechanism**: If no system permissions, installs to user directory

### Environment Variable Configuration
Configure environment variables in the extension panel:
```bash
ANTHROPIC_BASE_URL=https://api.example.com
API_TIMEOUT_MS=600000
NODE_ENV=development
```
These variables are automatically applied when creating new terminals.

## 🎼 Supported Audio Tool Mapping

| Tool Type | Start Sound | Success Sound | Error Sound |
|-----------|-------------|---------------|-------------|
| Read | File Open | File Open | Error Alert |
| Write | File Create | File Create | Build Error |
| Edit/MultiEdit | File Modify | File Save | Build Error |
| Bash | Command Execute | Command Complete | Command Error |
| Glob/Grep | Search Start | Search Complete | Search Error |
| WebFetch/WebSearch | Network Request | Network Success | Network Error |

## 🛠️ Claude Code Hooks Configuration Example

The extension automatically generates the following configuration to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper play \"$TOOL_NAME\" start"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [ -n \"$TOOL_ERROR\" ]; then cchelper play \"$TOOL_NAME\" error; else cchelper play \"$TOOL_NAME\" success; fi"
          }
        ]
      }
    ]
  }
}
```

## ⚡ Quick Start

1. **Install Extension**: Install from [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
2. **Open Panel**: `Ctrl+Shift+P` → "Claude Code Helper: Open Command Panel"
3. **Configure Audio**: Select your preferred sound effect files
4. **Install Hooks**: Click the "Install Claude Code Hooks" button
5. **Test CLI**: Run `cchelper help` in terminal

## 🔧 System Requirements

- **VSCode**: 1.74.0 or higher
- **Claude Code**: Latest version
- **Node.js**: Required for CLI tool operation
- **Operating System**: Windows 10+, macOS 10.14+, Linux (mainstream distributions)

## 🎯 Advanced Usage

### Custom Audio Files
1. Prepare audio files (recommended < 2 seconds, formats: wav/mp3/ogg)
2. Click the "Select File" button in the extension panel
3. Assign audio to different tools and states

### Project-specific Configuration
Create `.claude/settings.json` in your project root to implement project-level Hooks configuration.

### CLI Tool Integration
Integrate `cchelper` into your development workflow:
```bash
# Git hooks integration
echo 'cchelper play Git success' >> .git/hooks/post-commit

# Build script integration  
npm run build && cchelper play Build success || cchelper play Build error
```

## 📊 Version History

### v0.1.2 (Latest)
- 🐛 Fix CLI installation script generation error
- ✨ Improve cross-platform compatibility
- 📝 Complete documentation

### v0.1.1
- ✨ Added complete Claude Code Hooks system
- 🎵 Audio feedback functionality
- 💻 CLI tool auto-installation
- 🔧 Tool-specific sound effect mapping

### v0.1.0
- 🎯 Basic terminal management functionality
- ⚙️ Environment variable management
- 📚 Command history recording

## 🤝 Contributing & Support

- **Issue Reports**: [GitHub Issues](https://github.com/daodao97/claude-code-helper/issues)
- **Feature Requests**: Welcome to submit Feature Requests
- **Code Contributions**: Fork the project and submit Pull Requests

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

**🎉 Designed specifically for Claude Code developers to make your development process enjoyable!**

[📥 Install from VSCode](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper) | [📥 Install from Open VSX](https://open-vsx.org/extension/daodao97/claude-code-helper) | [⭐ Rate Us](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper&ssr=false#review-details) | [🐛 Report Issues](https://github.com/daodao97/claude-code-helper/issues)