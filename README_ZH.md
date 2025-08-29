# Claude Code Helper

[![English](https://img.shields.io/badge/Language-English-blue.svg)](README.md) [![中文](https://img.shields.io/badge/Language-中文-red.svg)](README_ZH.md)

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/daodao97.claude-code-helper?style=for-the-badge&logo=visual-studio-code&logoColor=white&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/daodao97.claude-code-helper?style=for-the-badge&color=4CAF50)](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/daodao97.claude-code-helper?style=for-the-badge&color=FFD700)](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)

[![Open VSX Version](https://img.shields.io/open-vsx/v/daodao97/claude-code-helper?style=for-the-badge&logo=eclipse-ide&logoColor=white&color=C865B9)](https://open-vsx.org/extension/daodao97/claude-code-helper)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/daodao97/claude-code-helper?style=for-the-badge&color=4CAF50)](https://open-vsx.org/extension/daodao97/claude-code-helper)
[![Open VSX Rating](https://img.shields.io/open-vsx/rating/daodao97/claude-code-helper?style=for-the-badge&color=FFD700)](https://open-vsx.org/extension/daodao97/claude-code-helper)

专为 Claude Code 开发优化的 VSCode 扩展，集成音频反馈、Hook 系统和命令行工具，全方位提升你的 Claude Code 开发体验。

## 🚀 安装

### 通过 VSCode 市场安装（推荐）
1. 打开 VSCode
2. 前往扩展市场：[Claude Code Helper](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper)
3. 点击 "Install" 按钮

### 通过 Open VSX 安装（备选方案）
适用于 VSCodium、Gitpod 等支持 Open VSX 的编辑器：
1. 前往 [Open VSX 注册表](https://open-vsx.org/extension/daodao97/claude-code-helper)
2. 点击 "Install" 按钮或下载 `.vsix` 文件
3. 或在您的编辑器扩展市场中搜索 "Claude Code Helper"

### 通过命令面板安装
1. 按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）打开命令面板
2. 输入 `Extensions: Install Extensions`
3. 搜索 "Claude Code Helper"
4. 安装扩展

## ✨ 核心功能

### 🎵 智能音频反馈系统
- **工具特定音效**：每种 Claude Code 工具都有专属音效提示
- **状态音频反馈**：开始、成功、错误状态都有不同音效
- **自定义音频**：支持自定义音频文件，个性化你的工作环境
- **音频预览**：实时预览所选音效

### 🔧 Claude Code Hooks 集成
- **一键安装配置**：自动生成 Claude Code Hooks 配置
- **工具监听**：监听 `Edit`、`MultiEdit`、`Write` 等文件操作
- **智能文件打开**：操作文件后自动在 VSCode 中打开
- **音频通知**：操作成功或失败时播放相应音效

### 💻 强大的命令行工具 (cchelper)
安装扩展后，自动获得 `cchelper` 命令行工具：

```bash
# 播放通知音
cchelper play Read success
cchelper play Write error

# 在 VSCode 中打开文件
cchelper open /path/to/file.js
cchelper open /path/to/file.js 42  # 打开并跳转到第42行

# 在文件管理器中显示文件
cchelper reveal /path/to/file.js

# 显示文件信息
cchelper info /path/to/file.js

# 处理 Claude Code Hooks 数据
echo '{"tool_name": "Read", "tool_input": {...}}' | cchelper hook
```

### 🎯 智能终端管理
- **Claude CLI 快捷命令**：一键执行常用 Claude Code 命令
- **智能终端位置**：支持右侧分屏和底部面板两种显示模式
- **环境变量管理**：自动应用环境变量到新终端
- **多行命令支持**：支持复杂命令输入和执行
- **命令历史记录**：自动保存历史命令，便于重复使用

## 📖 详细使用指南

### 音频配置
1. 打开命令面板：`Ctrl+Shift+P` / `Cmd+Shift+P`
2. 搜索 "Claude Code Helper: Open Command Panel"
3. 在 "音频设置" 区域：
   - 为不同工具选择音频文件
   - 使用预览按钮试听音效
   - 支持 `.wav`、`.mp3`、`.ogg` 等格式

### Hooks 配置
1. 在扩展面板中点击 "安装 Claude Code Hooks"
2. 选择配置文件位置（全局或项目）：
   - **全局配置**：`~/.claude/settings.json`
   - **项目配置**：`.claude/settings.json`
3. 自动生成配置，包含：
   - 文件操作前的音频提示
   - 文件操作后的音频通知和自动打开

### CLI 工具安装
扩展安装后会自动安装 `cchelper` 命令：
- **macOS/Linux**：尝试安装到 `/usr/local/bin`、`/opt/homebrew/bin`
- **Windows**：安装到用户目录并提供 PATH 配置指导
- **降级机制**：如无系统权限，安装到用户目录

### 环境变量配置
在扩展面板中配置环境变量：
```bash
ANTHROPIC_BASE_URL=https://api.example.com
API_TIMEOUT_MS=600000
NODE_ENV=development
```
每次创建新终端时自动应用这些变量。

## 🎼 支持的音频工具映射

| 工具类型 | 开始音效 | 成功音效 | 错误音效 |
|---------|---------|---------|---------|
| Read | 文件打开 | 文件打开 | 错误提示 |
| Write | 文件创建 | 文件创建 | 构建错误 |
| Edit/MultiEdit | 文件修改 | 文件保存 | 构建错误 |
| Bash | 命令执行 | 命令完成 | 命令错误 |
| Glob/Grep | 搜索开始 | 搜索完成 | 搜索错误 |
| WebFetch/WebSearch | 网络请求 | 网络成功 | 网络错误 |

## 🛠️ Claude Code Hooks 示例配置

扩展会自动生成以下配置到你的 `.claude/settings.json`：

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

## ⚡ 快速开始

1. **安装扩展**：从 [VSCode 市场](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper) 安装
2. **打开面板**：`Ctrl+Shift+P` → "Claude Code Helper: Open Command Panel"
3. **配置音频**：选择你喜欢的音效文件
4. **安装 Hooks**：点击 "安装 Claude Code Hooks" 按钮
5. **测试 CLI**：在终端中运行 `cchelper help`

## 🔧 系统要求

- **VSCode**：1.74.0 或更高版本
- **Claude Code**：最新版本
- **Node.js**：用于 CLI 工具运行
- **操作系统**：Windows 10+、macOS 10.14+、Linux（主流发行版）

## 🎯 高级用法

### 自定义音频文件
1. 准备音频文件（推荐 < 2秒，格式：wav/mp3/ogg）
2. 在扩展面板中点击 "选择文件" 按钮
3. 为不同工具和状态分配音频

### 项目特定配置
在项目根目录创建 `.claude/settings.json` 实现项目级别的 Hooks 配置。

### CLI 工具集成
将 `cchelper` 集成到你的开发工作流：
```bash
# Git hooks 集成
echo 'cchelper play Git success' >> .git/hooks/post-commit

# 构建脚本集成  
npm run build && cchelper play Build success || cchelper play Build error
```

## 📊 版本历史

### v0.1.2 (Latest)
- 🐛 修复 CLI 安装脚本生成错误
- ✨ 改进跨平台兼容性
- 📝 完善文档说明

### v0.1.1
- ✨ 新增完整的 Claude Code Hooks 系统
- 🎵 音频反馈功能
- 💻 CLI 工具自动安装
- 🔧 工具特定音效映射

### v0.1.0
- 🎯 基础终端管理功能
- ⚙️ 环境变量管理
- 📚 命令历史记录

## 🤝 贡献与支持

- **问题反馈**：[GitHub Issues](https://github.com/daodao97/claude-code-helper/issues)
- **功能建议**：欢迎提交 Feature Request
- **代码贡献**：Fork 项目并提交 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**🎉 专为 Claude Code 开发者设计，让你的开发过程充满乐趣！**

[📥 从 VSCode 安装](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper) | [📥 从 Open VSX 安装](https://open-vsx.org/extension/daodao97/claude-code-helper) | [⭐ 给个好评](https://marketplace.visualstudio.com/items?itemName=daodao97.claude-code-helper&ssr=false#review-details) | [🐛 报告问题](https://github.com/daodao97/claude-code-helper/issues)