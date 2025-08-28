# Claude Code Helper Hooks 配置示例

## 自动安装

插件安装后会自动将 hooks 配置添加到 `~/.claude/settings.json`。

## 手动配置

如果需要手动配置，可以在以下文件中添加 hooks：

- `~/.claude/settings.json` - 用户全局设置
- `.claude/settings.json` - 项目设置
- `.claude/settings.local.json` - 本地项目设置（不提交到版本控制）

## 配置内容

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo '🔧 Claude Code Helper: 文件编辑开始...' && cchelper hook"
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
            "command": "echo '✅ Claude Code Helper: 文件编辑完成' && cchelper hook"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper hook"
          }
        ]
      }
    ]
  }
}
```

## CLI 工具使用

### 基本命令

```bash
# 处理来自 Claude Code hooks 的数据
cchelper hook

# 在 VSCode 中打开文件
cchelper open /path/to/file.js

# 在 VSCode 中打开文件并跳转到指定行
cchelper open /path/to/file.js 25

# 在文件管理器中显示文件
cchelper reveal /path/to/file.js

# 显示文件信息
cchelper info /path/to/file.js

# 显示帮助
cchelper help
```

### 高级 Hook 配置示例

#### 自动在 VSCode 中打开编辑的文件

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper hook | jq -r '.tool_input.file_path // empty' | while read file; do [ -n \"$file\" ] && cchelper open \"$file\"; done"
          }
        ]
      }
    ]
  }
}
```

#### 记录命令执行日志

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper hook | jq -r '\"\\(.tool_input.command) - \\(.tool_input.description // \"No description\")\"' >> ~/.claude/command-log.txt"
          }
        ]
      }
    ]
  }
}
```

#### 代码格式化

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper hook | jq -r '.tool_input.file_path // empty' | while read file; do [ -n \"$file\" ] && [[ \"$file\" == *.ts ]] && npx prettier --write \"$file\"; done"
          }
        ]
      }
    ]
  }
}
```

## VSCode 命令

插件提供以下 VSCode 命令：

- `Claude Code Helper: Open Command Panel` - 打开命令面板
- `Claude Code Helper: Open Claude Code` - 快速启动 Claude Code
- `Claude Code Helper: Install Claude Code Hooks` - 安装 hooks 配置
- `Claude Code Helper: Uninstall Claude Code Hooks` - 卸载 hooks 配置
- `Claude Code Helper: Check Hooks Status` - 检查 hooks 安装状态

可以通过 `Ctrl+Shift+P` (或 `Cmd+Shift+P`) 打开命令面板搜索使用。

## 注意事项

1. 确保已安装 `jq` 命令行工具（用于 JSON 处理）
2. 确保 `cchelper` 命令行工具已正确安装并在 PATH 中
3. hooks 会在 Claude Code 执行相应工具时自动触发
4. 可以通过日志输出查看 hooks 执行情况