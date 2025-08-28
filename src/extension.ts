// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

		vscode.commands.registerCommand('claude-code-helper.installCLI', async () => {
			try {
				await installCLI(context);
				vscode.window.showInformationMessage('✅ cchelper CLI 已成功安装到系统PATH');
			} catch (error) {
				vscode.window.showErrorMessage(`CLI安装失败: ${error}`);
			}
		}),

		vscode.commands.registerCommand('claude-code-helper.checkCLI', async () => {
			try {
				const { exec } = require('child_process');
				exec('cchelper help', (error: any) => {
					if (error) {
						vscode.window.showWarningMessage('cchelper CLI 未安装或不在PATH中\n点击"安装CLI"按钮进行安装', '安装CLI').then(selection => {
							if (selection === '安装CLI') {
								vscode.commands.executeCommand('claude-code-helper.installCLI');
							}
						});
					} else {
						vscode.window.showInformationMessage('✅ cchelper CLI 已正确安装');
					}
				});
			} catch (error) {
				vscode.window.showErrorMessage(`检查CLI状态失败: ${error}`);
			}
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

async function installCLI(context: vscode.ExtensionContext): Promise<void> {
	const { exec } = require('child_process');
	const { promisify } = require('util');
	const execAsync = promisify(exec);

	// 获取编译后的CLI文件路径
	const cliPath = path.join(context.extensionPath, 'out', 'cli.js');
	
	if (!fs.existsSync(cliPath)) {
		throw new Error('CLI文件不存在，请重新安装扩展');
	}

	const platform = os.platform();
	const homeDir = os.homedir();
	
	try {
		if (platform === 'win32') {
			// Windows: 创建batch文件
			const binDir = path.join(homeDir, 'AppData', 'Local', 'cchelper');
			const batFile = path.join(binDir, 'cchelper.bat');
			
			// 确保目录存在
			if (!fs.existsSync(binDir)) {
				fs.mkdirSync(binDir, { recursive: true });
			}
			
			// 创建batch文件
			const batContent = `@echo off\nnode "${cliPath}" %*`;
			fs.writeFileSync(batFile, batContent);
			
			// 添加到PATH（需要用户重启终端）
			vscode.window.showInformationMessage(
				`CLI已安装到: ${batFile}\n请将 ${binDir} 添加到系统PATH环境变量中`,
				'打开目录'
			).then(selection => {
				if (selection === '打开目录') {
					exec(`explorer "${binDir}"`);
				}
			});
			
		} else {
			// macOS/Linux: 创建shell包装脚本
			const systemBinDirs = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin'];
			
			// 创建shell包装脚本，调用node执行CLI
			const shellScript = `#!/bin/bash
node "${cliPath}" "$@"`;
			const tempScriptPath = path.join(os.tmpdir(), 'cchelper');
			
			fs.writeFileSync(tempScriptPath, shellScript, 'utf8');
			fs.chmodSync(tempScriptPath, '755');
			
			let installed = false;
			
			// 尝试安装到系统目录
			for (const binDir of systemBinDirs) {
				if (!fs.existsSync(binDir)) {
					continue;
				}
				
				const symlinkPath = path.join(binDir, 'cchelper');
				
				try {
					// 检查目录权限
					await fs.promises.access(binDir, fs.constants.W_OK);
					// 直接复制（有写权限）
					fs.copyFileSync(tempScriptPath, symlinkPath);
					fs.chmodSync(symlinkPath, '755');
					vscode.window.showInformationMessage(`✅ CLI已安装到系统目录: ${symlinkPath}`);
					installed = true;
					break;
				} catch (permError) {
					// 尝试使用sudo
					try {
						await execAsync(`sudo cp "${tempScriptPath}" "${symlinkPath}"`);
						await execAsync(`sudo chmod +x "${symlinkPath}"`);
						vscode.window.showInformationMessage(`✅ CLI已安装到系统目录: ${symlinkPath}`);
						installed = true;
						break;
					} catch (sudoError) {
						// 继续尝试下一个目录
						continue;
					}
				}
			}
			
			// 如果所有系统目录都失败，安装到用户目录
			if (!installed) {
				const userBinDir = path.join(homeDir, '.local', 'bin');
				if (!fs.existsSync(userBinDir)) {
					fs.mkdirSync(userBinDir, { recursive: true });
				}
				
				const userSymlinkPath = path.join(userBinDir, 'cchelper');
				fs.copyFileSync(tempScriptPath, userSymlinkPath);
				fs.chmodSync(userSymlinkPath, '755');
				
				vscode.window.showInformationMessage(
					`CLI已安装到用户目录: ${userSymlinkPath}\n请确保 ${userBinDir} 在您的PATH中`,
					'添加到PATH'
				).then(selection => {
					if (selection === '添加到PATH') {
						vscode.window.showInformationMessage(
							`请将以下行添加到您的 ~/.bashrc 或 ~/.zshrc 文件中：\nexport PATH="$PATH:${userBinDir}"`
						);
					}
				});
			}
			
			// 清理临时文件
			if (fs.existsSync(tempScriptPath)) {
				fs.unlinkSync(tempScriptPath);
			}
		}
		
	} catch (error) {
		throw new Error(`安装过程中出错: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
