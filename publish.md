# Claude Code Helper 发布指南

## 发布前准备

### 1. 创建发布者账号
1. 访问 [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
2. 使用 Microsoft 账号登录
3. 创建新的发布者 (Publisher)
4. 记住发布者 ID

### 2. 获取 Personal Access Token
1. 访问 [Azure DevOps](https://dev.azure.com/)
2. 登录并进入 User Settings > Personal Access Tokens
3. 创建新 Token，权限选择 "Marketplace (manage)"
4. 复制并保存 Token

### 3. 配置项目信息
编辑 `package.json` 中的以下字段：
```json
{
  "publisher": "你的发布者ID",
  "repository": {
    "type": "git", 
    "url": "https://github.com/你的用户名/claude-code-helper"
  }
}
```

## 发布方法

### 方法一：使用发布脚本 (推荐)
```bash
# 设置环境变量
export VSCE_PAT=你的_Personal_Access_Token

# 运行发布脚本
chmod +x publish.sh
./publish.sh
```

### 方法二：手动发布
```bash
# 安装 vsce
npm install -g @vscode/vsce

# 安装依赖并编译
npm install
npm run compile

# 打包
npm run package

# 发布 (需要先登录)
vsce login 你的发布者ID
vsce publish
```

### 方法三：手动上传
```bash
# 仅打包，不发布
npm run build

# 手动上传 .vsix 文件到市场
# 访问: https://marketplace.visualstudio.com/manage
```

## NPM 脚本说明

- `npm run compile` - 编译 TypeScript
- `npm run package` - 打包成 .vsix 文件
- `npm run publish` - 发布到市场
- `npm run build` - 编译 + 打包

## 版本管理

### 更新版本号
```bash
# 补丁版本 (0.0.1 -> 0.0.2)
npm version patch

# 次版本 (0.0.1 -> 0.1.0)  
npm version minor

# 主版本 (0.0.1 -> 1.0.0)
npm version major
```

### 发布新版本
```bash
# 更新版本并发布
npm version patch
npm run publish
```

## 注意事项

1. **图标格式**: 确保 `icon.jpeg` 是有效的图片文件
2. **代码检查**: 发布前会自动运行 `npm run lint`
3. **编译检查**: 确保 TypeScript 编译无错误
4. **权限设置**: Personal Access Token 需要 Marketplace manage 权限
5. **唯一性**: 扩展名称在市场中必须唯一

## 发布后

- 扩展链接: `https://marketplace.visualstudio.com/items?itemName=发布者.扩展名`
- 管理面板: https://marketplace.visualstudio.com/manage
- 统计信息: 可在管理面板查看下载量、评分等

## 常见问题

### 发布失败
- 检查 Personal Access Token 是否有效
- 确认发布者信息是否正确配置
- 检查扩展名是否与现有扩展冲突

### 打包失败
- 运行 `npm run compile` 检查编译错误
- 检查 package.json 配置是否完整
- 确保所有必要文件都包含在项目中

---

**祝发布成功！🎉**