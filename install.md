# Command Helper 插件启动指南

## 如何测试插件

1. **在 VSCode 中打开项目**
   ```bash
   code /Users/daodao/work/bihu/cchelper
   ```

2. **启动调试模式**
   - 按 `F5` 或通过菜单 "Run > Start Debugging"
   - 这会打开一个新的 VSCode 扩展开发窗口

3. **测试插件功能**
   - 在新窗口中，按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac) 打开命令面板
   - 搜索 "Command Helper" 相关命令:
     - "打开命令面板"
     - "配置预置命令"

## 功能演示

### 打开命令面板
1. 使用命令面板搜索 "打开命令面板"
2. 点击执行，会看到一个包含默认预置命令的可视化面板

### 执行命令
- 点击任意命令卡片执行对应命令
- 短期命令会在输出面板显示结果
- 长期命令会在终端中运行

### 配置命令
1. 点击面板右下角的设置按钮 ⚙️
2. 或使用命令面板搜索 "配置预置命令"
3. 可以添加、编辑、删除自定义命令

## 打包发布

如果插件测试正常，可以打包发布:

```bash
# 安装 vsce
npm install -g vsce

# 打包扩展
vsce package

# 这会生成一个 .vsix 文件，可以手动安装
```

## 故障排除

如果遇到问题:
1. 检查开发者控制台 (`Help > Toggle Developer Tools`)
2. 查看输出面板中的 "Command Helper" 频道
3. 确保所有依赖都已正确安装 (`npm install`)
4. 重新编译 (`npm run compile`)