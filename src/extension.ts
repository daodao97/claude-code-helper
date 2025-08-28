// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommandPanelProvider } from './commandPanel';
import { CommandManager } from './commandManager';
import { HookInstaller } from './hookInstaller';
import { HttpServer } from './httpServer';

export function activate(context: vscode.ExtensionContext) {
	console.log('🚀 Claude Code Helper extension is now active!');
	vscode.window.showInformationMessage('Claude Code Helper extension activated!');

	const commandManager = new CommandManager(context);
	const commandPanelProvider = new CommandPanelProvider(context.extensionUri, commandManager);
	const hookInstaller = new HookInstaller();
	const httpServer = new HttpServer();

	// 启动 HTTP 服务器
	httpServer.start().then(() => {
		console.log('HTTP 服务器启动成功');
	}).catch((error) => {
		console.error('HTTP 服务器启动失败:', error);
	});

	// 检查 Claude Code hooks 状态，但不自动安装
	hookInstaller.checkHooksStatus().then((status) => {
		if (!status.installed) {
			console.log('ℹ️ Claude Code hooks 未安装，可通过插件面板进行配置');
		} else {
			console.log('✅ Claude Code hooks 已安装');
		}
	});

	const disposables = [
		vscode.commands.registerCommand('claude-code-helper.openCommandPanel', () => {
			const panel = vscode.window.createWebviewPanel(
				'commandPanel',
				'Claude Code Helper',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);
			commandPanelProvider.setupWebviewPanel(panel);
		}),

		vscode.commands.registerCommand('claude-code-helper.openClaudeCode', async () => {
			// 快速执行常用命令中的第一个：claude
			const command = 'claude';
			
			// 获取已保存的环境变量
			const envVars = await commandManager.loadEnvironmentVariables();
			const envVarsEnabled = await commandManager.loadEnvironmentVariablesSettings();
			const terminalPosition = await commandManager.loadTerminalPosition();
			
			// 执行命令
			const envVarsToApply = envVarsEnabled ? envVars : '';
			await commandManager.executeSimpleCommand(command, envVarsToApply, terminalPosition);
			
			vscode.window.showInformationMessage(`执行命令: ${command}`);
		}),

		vscode.commands.registerCommand('claude-code-helper.installHooks', async () => {
			const installed = await hookInstaller.installHooks();
			if (installed) {
				vscode.window.showInformationMessage('✅ Claude Code Helper hooks 已安装到 ~/.claude/settings.json');
			} else {
				vscode.window.showInformationMessage('ℹ️ Claude Code Helper hooks 已经安装');
			}
		}),

		vscode.commands.registerCommand('claude-code-helper.uninstallHooks', async () => {
			const removed = await hookInstaller.uninstallHooks();
			if (removed) {
				vscode.window.showInformationMessage('✅ Claude Code Helper hooks 已从 ~/.claude/settings.json 中移除');
			} else {
				vscode.window.showInformationMessage('ℹ️ 没有找到需要移除的 hooks');
			}
		}),

		vscode.commands.registerCommand('claude-code-helper.checkHooksStatus', async () => {
			const status = await hookInstaller.checkHooksStatus();
			const statusText = status.installed ? '已安装' : '未安装';
			vscode.window.showInformationMessage(`Claude Code Helper hooks 状态: ${statusText}\n配置文件: ${status.path}`);
		}),

		commandManager,
		{
			dispose: () => httpServer.stop()
		}
	];

	context.subscriptions.push(...disposables);

	// 自动打开 Claude Code Helper 面板
	setTimeout(() => {
		vscode.commands.executeCommand('claude-code-helper.openCommandPanel');
	}, 1000); // 延迟1秒确保VSCode完全加载
}

// This method is called when your extension is deactivated
export function deactivate() {}
