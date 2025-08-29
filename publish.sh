#!/bin/bash

# Claude Code Helper - 发布脚本
# 用于打包和发布 VSCode 扩展到市场

set -e

echo "🚀 开始发布 Claude Code Helper 扩展..."

# 检查是否安装了 vsce
if ! command -v vsce &> /dev/null; then
    echo "❌ 未安装 vsce，正在安装..."
    npm install -g @vscode/vsce
fi

# 检查是否安装了 ovsx
if ! command -v ovsx &> /dev/null; then
    echo "❌ 未安装 ovsx，正在安装..."
    npm install -g ovsx
fi

# 检查是否配置了发布者信息
if grep -q "your-publisher-name" package.json; then
    echo "⚠️  请先在 package.json 中配置发布者信息 (publisher)"
    echo "   访问 https://marketplace.visualstudio.com/manage 创建发布者账号"
    exit 1
fi

# 加载环境变量
if [ -f .env ]; then
    echo "📋 加载环境变量..."
    source .env
fi

# 检查是否有 Personal Access Token
if [ -z "$VSCE_PAT" ]; then
    echo "⚠️  请设置环境变量 VSCE_PAT (Personal Access Token)"
    echo "   export VSCE_PAT=your_personal_access_token"
    echo "   获取 Token: https://dev.azure.com/"
    exit 1
fi

# 检查是否有 Open VSX Token
if [ -z "$OVSX_PAT" ]; then
    echo "⚠️  请设置环境变量 OVSX_PAT (Open VSX Personal Access Token)"
    echo "   export OVSX_PAT=your_open_vsx_token"
    echo "   获取 Token: https://open-vsx.org/"
    exit 1
fi

# 清理之前的构建
echo "🧹 清理构建文件..."
rm -rf out/
rm -f *.vsix

# 安装依赖
echo "📦 安装依赖..."
npm install

# 运行代码检查
echo "🔍 运行代码检查..."
npm run lint

# 编译 TypeScript
echo "🔨 编译 TypeScript..."
npm run compile

# 打包扩展
echo "📦 打包扩展..."
vsce package

# 获取版本号
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME="claude-code-helper-$VERSION.vsix"

echo "✅ 扩展已打包为: $PACKAGE_NAME"

# 询问是否发布
read -p "是否现在发布到 VSCode 市场和 Open VSX? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 发布到 VSCode 市场..."
    vsce publish -p $VSCE_PAT
    echo "✅ VSCode 市场发布成功！"
    
    echo "🚀 发布到 Open VSX Registry..."
    ovsx publish $PACKAGE_NAME -p $OVSX_PAT
    echo "✅ Open VSX 发布成功！"
    
    echo "🎉 发布完成！"
    echo "📍 VSCode 市场: https://marketplace.visualstudio.com/items?itemName=$(node -p "require('./package.json').publisher").$(node -p "require('./package.json').name")"
    echo "📍 Open VSX: https://open-vsx.org/extension/$(node -p "require('./package.json').publisher")/$(node -p "require('./package.json').name")"
else
    echo "📦 扩展已打包，可手动上传到各个市场"
    echo "   VSCode 市场: https://marketplace.visualstudio.com/manage"
    echo "   Open VSX: https://open-vsx.org/user-settings/namespaces"
    echo "   文件: $PACKAGE_NAME"
fi

echo "✨ 完成！"