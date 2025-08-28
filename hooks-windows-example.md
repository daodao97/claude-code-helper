# Windows平台Claude Code Helper Hooks配置指南

## Windows兼容性问题说明

Windows平台在使用Claude Code Hooks时可能遇到以下问题：

1. **Shell语法不兼容** - Windows cmd/PowerShell与Unix bash语法不同
2. **环境变量语法差异** - Windows使用`%VAR%`或`$env:VAR`，Unix使用`$VAR`
3. **字符编码问题** - Windows默认编码可能导致中文乱码
4. **路径分隔符差异** - Windows使用`\`，Unix使用`/`

## 解决方案

### v0.1.3+ 版本自动适配

从v0.1.3版本开始，扩展会自动检测Windows平台并生成兼容的hooks配置：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|LS|Bash|Task|WebFetch|WebSearch|TodoWrite|ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper play \"%TOOL_NAME%\" start"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|LS|Bash|Task|WebFetch|WebSearch|TodoWrite|ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -Command \"if ($env:TOOL_ERROR) { cchelper play '$env:TOOL_NAME' error } else { cchelper play '$env:TOOL_NAME' success }\""
          }
        ]
      }
    ]
  }
}
```

### CLI工具安装改进

Windows CLI安装已优化：

1. **UTF-8编码支持**：batch文件添加`chcp 65001`命令确保UTF-8编码
2. **路径处理**：正确处理包含空格和特殊字符的路径
3. **PowerShell集成**：音频播放使用PowerShell确保兼容性

### 手动配置（旧版本用户）

如果使用旧版本或需要手动配置，请使用以下Windows兼容的配置：

#### 基础音频通知（Windows）
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper play \"%TOOL_NAME%\" start"
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
            "command": "powershell -Command \"if ($env:TOOL_ERROR) { cchelper play '$env:TOOL_NAME' error } else { cchelper play '$env:TOOL_NAME' success }\""
          }
        ]
      }
    ]
  }
}
```

#### 文件自动打开（Windows）
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command", 
            "command": "cchelper hook-open"
          }
        ]
      }
    ]
  }
}
```

## 常见问题解决

### Q1: 出现中文乱码
**解决方案：**
1. 确保使用v0.1.3+版本
2. 或在cmd中手动执行：`chcp 65001`

### Q2: PowerShell执行策略错误
**解决方案：**
1. 以管理员身份运行PowerShell
2. 执行：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Q3: cchelper命令找不到
**解决方案：**
1. 确保已通过VSCode扩展安装CLI工具
2. 重启终端或VSCode
3. 检查PATH环境变量是否包含CLI安装目录

### Q4: 音频播放失败
**解决方案：**
1. 确保系统音频服务正常运行
2. 检查音频文件路径是否正确
3. 尝试重新安装扩展

## 升级建议

强烈建议Windows用户升级到v0.1.3+版本，享受以下改进：

- ✅ 自动Windows平台检测和适配
- ✅ UTF-8编码支持，解决中文乱码
- ✅ 改进的PowerShell集成
- ✅ 更好的错误处理和日志记录

## 手动升级现有配置

如果已有旧版本的hooks配置，可以：

1. 卸载现有hooks：在VSCode中执行`Claude Code Helper: Uninstall Claude Code Hooks`
2. 重新安装hooks：执行`Claude Code Helper: Install Claude Code Hooks`
3. 新配置将自动适配Windows平台

## 技术细节

Windows兼容性改进包括：

- **条件语句**：使用PowerShell的`if`语句替代bash语法
- **环境变量**：使用`$env:VAR`替代`$VAR`
- **编码设置**：PowerShell命令中设置UTF-8编码
- **路径处理**：正确处理Windows路径分隔符
- **错误处理**：改进的错误捕获和日志记录