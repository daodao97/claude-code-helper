// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommandPanelProvider } from './commandPanel';
import { CommandManager } from './commandManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('🚀 Claude Code Helper extension is now active!');
	vscode.window.showInformationMessage('Claude Code Helper extension activated!');

	const commandManager = new CommandManager(context);
	const commandPanelProvider = new CommandPanelProvider(context.extensionUri, commandManager);

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

		commandManager
	];

	context.subscriptions.push(...disposables);

	// 自动打开 Claude Code Helper 面板
	setTimeout(() => {
		vscode.commands.executeCommand('claude-code-helper.openCommandPanel');
	}, 1000); // 延迟1秒确保VSCode完全加载
}

// This method is called when your extension is deactivated
export function deactivate() {}
