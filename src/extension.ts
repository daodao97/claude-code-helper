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

	const commandManager = new CommandManager(context);
	const commandPanelProvider = new CommandPanelProvider(context.extensionUri, commandManager);
	const hookInstaller = new HookInstaller();
	const httpServer = new HttpServer();
	
	// 存储当前活跃的面板实例
	let currentPanel: vscode.WebviewPanel | undefined;

	// 启动 HTTP 服务器
	httpServer.start().then(() => {
		console.log('HTTP 服务器启动成功');
	}).catch((error) => {
		console.error('HTTP 服务器启动失败:', error);
	});

	// 自动检测并显示系统状态
	checkAndDisplaySystemStatus(hookInstaller);

	const disposables = [
		vscode.commands.registerCommand('claude-code-helper.openCommandPanel', () => {
			// 如果面板已存在且可见，则激活它
			if (currentPanel) {
				currentPanel.reveal();
				return;
			}
			
			// 创建新面板
			currentPanel = vscode.window.createWebviewPanel(
				'commandPanel',
				'Claude Code Helper',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);
			
			// 当面板被关闭时清除引用
			currentPanel.onDidDispose(() => {
				currentPanel = undefined;
			});
			
			commandPanelProvider.setupWebviewPanel(currentPanel);
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
			// 先检查CLI状态
			const cliStatus = await hookInstaller.checkCLIStatus();
			if (!cliStatus.available) {
				vscode.window.showWarningMessage(
					`无法安装 hooks：cchelper CLI 未安装\n${cliStatus.error || ''}`,
					'安装 CLI'
				).then(selection => {
					if (selection === '安装 CLI') {
						vscode.commands.executeCommand('claude-code-helper.installCLI');
					}
				});
				return;
			}

			if (!cliStatus.commandsValid) {
				vscode.window.showWarningMessage(
					`CLI工具缺少hooks所需的命令：${cliStatus.missingCommands?.join(', ')}`,
					'重新安装 CLI'
				).then(selection => {
					if (selection === '重新安装 CLI') {
						vscode.commands.executeCommand('claude-code-helper.installCLI');
					}
				});
				return;
			}

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
			console.log('🔧 开始CLI安装过程...');
			try {
				await installCLI(context);
				console.log('✅ CLI安装成功');
				vscode.window.showInformationMessage('✅ cchelper CLI 已成功安装到系统PATH');
				
				// 通知WebView更新状态
				CommandPanelProvider.notifyCLIInstallation(true, 'CLI安装成功');
				
				// 安装成功后重新检查状态
				setTimeout(() => {
					checkAndDisplaySystemStatus(hookInstaller);
				}, 1000);
			} catch (error) {
				console.error('❌ CLI安装失败:', error);
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`CLI安装失败: ${errorMessage}`);
				// 通知WebView安装失败
				CommandPanelProvider.notifyCLIInstallation(false, `安装失败: ${errorMessage}`);
			}
		}),

		vscode.commands.registerCommand('claude-code-helper.checkCLI', async () => {
			try {
				const cliStatus = await hookInstaller.checkCLIStatus();
				
				if (cliStatus.available) {
					if (cliStatus.commandsValid) {
						vscode.window.showInformationMessage(`✅ cchelper CLI 已正确安装\n版本: ${cliStatus.version || 'unknown'}\n所有hooks命令可用`);
					} else {
						vscode.window.showWarningMessage(
							`⚠️ cchelper CLI 已安装但缺少某些命令\n版本: ${cliStatus.version || 'unknown'}\n缺少命令: ${cliStatus.missingCommands?.join(', ')}`,
							'重新安装 CLI'
						).then(selection => {
							if (selection === '重新安装 CLI') {
								vscode.commands.executeCommand('claude-code-helper.installCLI');
							}
						});
					}
				} else {
					vscode.window.showWarningMessage(
						`❌ cchelper CLI 未安装或不在PATH中\n错误: ${cliStatus.error || 'Unknown error'}`,
						'安装 CLI'
					).then(selection => {
						if (selection === '安装 CLI') {
							vscode.commands.executeCommand('claude-code-helper.installCLI');
						}
					});
				}
			} catch (error) {
				vscode.window.showErrorMessage(`检查CLI状态失败: ${error}`);
			}
		}),

		vscode.commands.registerCommand('claude-code-helper.checkStatus', async () => {
			try {
				const cliStatus = await hookInstaller.checkCLIStatus();
				const hooksStatus = await hookInstaller.checkHooksStatus();
				
				let statusMessage = '📊 Claude Code Helper 状态报告\n\n';
				
				// CLI状态
				statusMessage += '🔧 CLI工具状态:\n';
				if (cliStatus.available) {
					statusMessage += `✅ 已安装 (版本: ${cliStatus.version || 'unknown'})\n`;
					if (cliStatus.commandsValid) {
						statusMessage += '✅ 所有hooks命令可用\n';
					} else {
						statusMessage += `⚠️ 缺少命令: ${cliStatus.missingCommands?.join(', ')}\n`;
					}
				} else {
					statusMessage += `❌ 未安装: ${cliStatus.error}\n`;
				}
				
				// Hooks状态
				statusMessage += '\n🎣 Hooks状态:\n';
				if (hooksStatus.installed) {
					statusMessage += `✅ 已安装到: ${hooksStatus.path}\n`;
				} else {
					statusMessage += '❌ 未安装\n';
				}
				
				// 建议
				statusMessage += '\n💡 建议:\n';
				if (!cliStatus.available) {
					statusMessage += '• 先安装CLI工具\n';
				}
				if (!cliStatus.commandsValid && cliStatus.available) {
					statusMessage += '• 重新安装CLI工具以获取完整功能\n';
				}
				if (!hooksStatus.installed && cliStatus.available && cliStatus.commandsValid) {
					statusMessage += '• 可以安装hooks以获得完整体验\n';
				}
				
				vscode.window.showInformationMessage(statusMessage);
			} catch (error) {
				vscode.window.showErrorMessage(`检查状态失败: ${error}`);
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
			
			// 创建batch文件，使用UTF-8编码避免中文乱码
			const batContent = `@echo off\nchcp 65001 >nul 2>&1\nnode "${cliPath}" %*`;
			fs.writeFileSync(batFile, batContent, { encoding: 'utf8' });
			
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

// 自动检测并显示系统状态
async function checkAndDisplaySystemStatus(hookInstaller: HookInstaller): Promise<void> {
	try {
		console.log('🔍 正在检测系统状态...');
		
		// 同时检查CLI和hooks状态
		const [cliStatus, hooksStatus] = await Promise.all([
			hookInstaller.checkCLIStatus(),
			hookInstaller.checkHooksStatus()
		]);

		// 构建状态消息
		let statusMessage = '📊 Claude Code Helper 系统状态\n\n';
		let hasIssues = false;

		// CLI状态
		statusMessage += '🔧 CLI工具: ';
		if (cliStatus.available) {
			if (cliStatus.commandsValid) {
				statusMessage += `✅ 已安装 (v${cliStatus.version || 'unknown'})\n`;
			} else {
				statusMessage += `⚠️ 已安装但不完整 (缺少: ${cliStatus.missingCommands?.join(', ')})\n`;
				hasIssues = true;
			}
		} else {
			statusMessage += '❌ 未安装\n';
			hasIssues = true;
		}

		// Hooks状态
		statusMessage += '🎣 Hooks配置: ';
		if (hooksStatus.installed) {
			statusMessage += '✅ 已配置\n';
		} else {
			statusMessage += '❌ 未配置\n';
			hasIssues = true;
		}

		// 根据状态显示相应的提示
		if (!hasIssues) {
			// 一切正常，显示成功消息
			statusMessage += '\n🎉 系统配置完整，可以开始使用！';
			console.log('✅ 系统状态检查完成：配置完整');
			vscode.window.showInformationMessage('✅ Claude Code Helper 配置完整，已就绪！');
		} else {
			// 有问题，显示详细状态和解决建议
			statusMessage += '\n💡 配置建议:\n';
			
			if (!cliStatus.available) {
				statusMessage += '• 点击下方按钮安装CLI工具\n';
			} else if (!cliStatus.commandsValid) {
				statusMessage += '• 重新安装CLI工具以获取完整功能\n';
			}
			
			if (!hooksStatus.installed && cliStatus.available && cliStatus.commandsValid) {
				statusMessage += '• 安装hooks配置以获得完整体验\n';
			} else if (!hooksStatus.installed && (!cliStatus.available || !cliStatus.commandsValid)) {
				statusMessage += '• 先安装CLI工具，然后配置hooks\n';
			}

			console.log('⚠️ 系统状态检查完成：需要配置');
			
			// 显示状态和快速操作按钮
			if (!cliStatus.available) {
				vscode.window.showWarningMessage(
					'Claude Code Helper 需要安装CLI工具才能正常工作',
					'安装CLI工具',
					'查看详细状态'
				).then(selection => {
					if (selection === '安装CLI工具') {
						vscode.commands.executeCommand('claude-code-helper.installCLI');
					} else if (selection === '查看详细状态') {
						vscode.window.showInformationMessage(statusMessage);
					}
				});
			} else if (!cliStatus.commandsValid) {
				vscode.window.showWarningMessage(
					'CLI工具不完整，某些功能可能无法使用',
					'重新安装CLI',
					'查看详细状态'
				).then(selection => {
					if (selection === '重新安装CLI') {
						vscode.commands.executeCommand('claude-code-helper.installCLI');
					} else if (selection === '查看详细状态') {
						vscode.window.showInformationMessage(statusMessage);
					}
				});
			} else if (!hooksStatus.installed) {
				vscode.window.showInformationMessage(
					'CLI工具已安装，是否配置hooks以获得完整体验？',
					'安装Hooks',
					'稍后配置'
				).then(selection => {
					if (selection === '安装Hooks') {
						vscode.commands.executeCommand('claude-code-helper.installHooks');
					}
				});
			}
		}

		// 记录详细状态到控制台
		console.log('📋 详细状态报告:');
		console.log(`   CLI可用: ${cliStatus.available}`);
		console.log(`   CLI版本: ${cliStatus.version || 'N/A'}`);
		console.log(`   命令完整: ${cliStatus.commandsValid}`);
		console.log(`   Hooks配置: ${hooksStatus.installed}`);
		if (cliStatus.missingCommands && cliStatus.missingCommands.length > 0) {
			console.log(`   缺少命令: ${cliStatus.missingCommands.join(', ')}`);
		}

	} catch (error) {
		console.error('❌ 状态检测失败:', error);
		vscode.window.showErrorMessage('Claude Code Helper 状态检测失败，请检查插件安装');
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
