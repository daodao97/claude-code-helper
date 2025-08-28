# CLI依赖管理说明

## 概述

从v0.1.3版本开始，Claude Code Helper 实现了CLI依赖管理，确保用户在安装hooks之前必须先安装CLI工具。

## 依赖检查流程

### 1. 自动检查
- 用户尝试安装hooks时，系统自动检查CLI状态
- 如果CLI不可用，显示错误信息并引导用户安装CLI
- 如果CLI缺少必要命令，提示重新安装

### 2. CLI状态验证
系统检查以下方面：

**基本可用性**
- `cchelper help` 命令是否可执行
- 命令是否在系统PATH中

**版本检查**  
- `cchelper --version` 是否返回版本信息
- 版本兼容性验证

**命令完整性**
验证hooks所需的关键命令：
- `play` - 音频播放功能
- `hook` - 基础hook数据处理
- `hook-open` - 文件打开集成

### 3. 用户体验优化

**安装引导**
- 自动检测CLI状态
- 提供一键安装选项
- 安装失败时提供详细错误信息

**状态报告**
- `Check CLI Tool Status` - 检查CLI工具状态
- `Check Overall Status` - 检查整体系统状态
- 提供安装建议和问题解决方案

## 使用场景

### 场景1：首次使用用户
1. 安装VSCode扩展
2. 尝试安装hooks
3. 系统提示需要先安装CLI
4. 点击"安装CLI"按钮
5. CLI安装完成后，重新安装hooks

### 场景2：CLI损坏或不完整
1. 用户CLI工具损坏或版本过旧
2. 尝试安装hooks时检测到命令缺失
3. 系统提示重新安装CLI
4. 用户选择重新安装，覆盖旧版本

### 场景3：状态检查
1. 用户怀疑系统配置有问题
2. 运行 `Check Overall Status` 命令
3. 查看详细的系统状态报告
4. 根据建议解决问题

## 错误信息说明

### CLI不可用
```
❌ 无法安装 hooks：cchelper CLI 未安装或不可用
错误：cchelper command not found in PATH

请先安装 CLI 工具后再尝试安装 hooks。
```

### CLI命令缺失
```
⚠️ CLI工具缺少hooks所需的命令：play, hook-open

请重新安装或升级 CLI 工具。
```

### 状态报告示例
```
📊 Claude Code Helper 状态报告

🔧 CLI工具状态:
✅ 已安装 (版本: 0.1.3)
✅ 所有hooks命令可用

🎣 Hooks状态:
✅ 已安装到: ~/.claude/settings.json

💡 建议:
• 系统配置正常，可以正常使用
```

## 开发者说明

### 新增组件

**CLIChecker类** (`src/cliChecker.ts`)
- 负责CLI状态检查和验证
- 提供异步检查方法
- 支持命令级别的验证

**依赖检查集成**
- HookInstaller类集成CLI检查
- 安装前自动验证依赖
- 提供友好的错误处理

### API方法

```typescript
// 检查CLI是否可用
CLIChecker.isCLIAvailable(): Promise<boolean>

// 获取CLI版本
CLIChecker.getCLIVersion(): Promise<string | null>

// 获取完整CLI状态
CLIChecker.getCLIStatus(): Promise<CLIStatus>

// 验证hooks所需命令
CLIChecker.validateHookCommands(): Promise<CommandValidation>
```

## 测试指南

### 手动测试CLI依赖
1. 确保CLI未安装：`where cchelper` (Windows) / `which cchelper` (Unix)
2. 尝试安装hooks，验证错误提示
3. 安装CLI工具
4. 重新尝试安装hooks，验证成功

### 命令验证测试
1. 安装不完整的CLI版本
2. 运行状态检查命令
3. 验证缺失命令检测
4. 重新安装完整版本

## 向后兼容性

- 现有用户升级后，系统会自动检查CLI状态
- 如果CLI已安装，正常运行不受影响
- 如果CLI有问题，会在下次操作时提示用户

## 最佳实践

1. **安装顺序**：先安装VSCode扩展，再通过扩展安装CLI，最后安装hooks
2. **故障排除**：使用 `Check Overall Status` 命令诊断问题
3. **升级维护**：定期检查CLI和hooks状态，确保系统正常运行