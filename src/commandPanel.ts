import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CommandManager } from './commandManager';
import { HookInstaller } from './hookInstaller';

export class CommandPanelProvider implements vscode.WebviewViewProvider {
    private webviewView?: vscode.WebviewView;
    private static instance?: CommandPanelProvider;
    
    private readonly hookInstaller: HookInstaller;
    
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly commandManager: CommandManager
    ) {
        this.hookInstaller = new HookInstaller();
        CommandPanelProvider.instance = this;
    }

    public static notifyCLIInstallation(success: boolean, message?: string) {
        console.log(`📢 通知WebView CLI安装结果: ${success ? '成功' : '失败'}, 消息: ${message}`);
        if (CommandPanelProvider.instance?.webviewView) {
            try {
                CommandPanelProvider.instance.webviewView.webview.postMessage({
                    type: 'cliInstalled',
                    success: success,
                    message: message
                });
                console.log('✅ WebView通知已发送');
            } catch (error) {
                console.error('❌ WebView通知发送失败:', error);
            }
        } else {
            console.warn('⚠️ WebView实例不存在，无法发送通知');
        }
    }

    private getAvailableAudioFiles(): Array<{name: string, value: string}> {
        try {
            const soundsDir = path.join(this.extensionUri.fsPath, 'assets', 'sounds');
            
            if (!fs.existsSync(soundsDir)) {
                console.log('音频目录不存在:', soundsDir);
                return [];
            }
            
            const files = fs.readdirSync(soundsDir);
            const audioFiles = files.filter(file => 
                file.toLowerCase().endsWith('.wav') || 
                file.toLowerCase().endsWith('.mp3') || 
                file.toLowerCase().endsWith('.ogg') ||
                file.toLowerCase().endsWith('.m4a')
            );
            
            return audioFiles.map(file => {
                const nameWithoutExt = path.parse(file).name;
                return {
                    name: nameWithoutExt.toUpperCase(),
                    value: nameWithoutExt.toLowerCase()
                };
            });
            
        } catch (error) {
            console.error('读取音频目录失败:', error);
            return [];
        }
    }


    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context?: vscode.WebviewViewResolveContext,
        token?: vscode.CancellationToken,
    ) {
        this.webviewView = webviewView;
        this.setupWebview(webviewView.webview);
    }

    public setupWebviewPanel(panel: vscode.WebviewPanel) {
        this.setupWebview(panel.webview);
    }

    private setupWebview(webview: vscode.Webview) {
        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri,
                vscode.Uri.joinPath(this.extensionUri, 'assets')
            ]
        };

        webview.html = this.getHtmlForWebview(webview);

        webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'executeCommand':
                    await this.commandManager.executeSimpleCommand(message.command, message.envVars, message.terminalPosition);
                    break;
                case 'applyEnvVars':
                    await this.commandManager.applyEnvironmentVariables(message.envVars);
                    break;
                case 'saveHistory':
                    await this.commandManager.saveCommandHistory(message.history);
                    break;
                case 'loadHistory':
                    const history = await this.commandManager.loadCommandHistory();
                    webview.postMessage({ type: 'historyLoaded', history });
                    break;
                case 'saveEnvVars':
                    await this.commandManager.saveEnvironmentVariables(message.envVars);
                    break;
                case 'saveEnvVarsSettings':
                    await this.commandManager.saveEnvironmentVariablesSettings(message.enabled);
                    break;
                case 'loadEnvVars':
                    const envVars = await this.commandManager.loadEnvironmentVariables();
                    const envVarsEnabled = await this.commandManager.loadEnvironmentVariablesSettings();
                    webview.postMessage({ type: 'envVarsLoaded', envVars, enabled: envVarsEnabled });
                    break;
                case 'saveTerminalPosition':
                    await this.commandManager.saveTerminalPosition(message.position);
                    break;
                case 'loadTerminalPosition':
                    const position = await this.commandManager.loadTerminalPosition();
                    webview.postMessage({ type: 'terminalPositionLoaded', position });
                    break;
                case 'saveSkipPermissions':
                    await this.commandManager.saveSkipPermissions(message.skipPermissions);
                    break;
                case 'loadSkipPermissions':
                    const skipPermissions = await this.commandManager.loadSkipPermissions();
                    webview.postMessage({ type: 'skipPermissionsLoaded', skipPermissions });
                    break;
                case 'saveToolSoundsStrategies':
                    await this.commandManager.saveToolSoundsStrategies(message.strategies);
                    break;
                case 'loadToolSoundsStrategies':
                    const strategies = await this.commandManager.loadToolSoundsStrategies();
                    webview.postMessage({ type: 'toolSoundsStrategiesLoaded', strategies });
                    break;
                case 'checkClaudeInstallation':
                    const isClaudeInstalled = await this.commandManager.checkClaudeInstallation();
                    webview.postMessage({ type: 'claudeInstallationChecked', installed: isClaudeInstalled });
                    break;
                case 'installSingleHook':
                    try {
                        const installed = await this.hookInstaller.installSingleHook(message.hookType, message.hooks);
                        webview.postMessage({ 
                            type: 'singleHookInstalled', 
                            success: installed,
                            hookType: message.hookType
                        });
                    } catch (error) {
                        webview.postMessage({ 
                            type: 'singleHookInstalled', 
                            success: false,
                            hookType: message.hookType
                        });
                    }
                    break;
                case 'uninstallSingleHook':
                    try {
                        const removed = await this.hookInstaller.uninstallSingleHook(message.hookType);
                        webview.postMessage({ 
                            type: 'singleHookUninstalled', 
                            success: removed,
                            hookType: message.hookType
                        });
                    } catch (error) {
                        webview.postMessage({ 
                            type: 'singleHookUninstalled', 
                            success: false,
                            hookType: message.hookType
                        });
                    }
                    break;
                case 'checkSingleHookStatus':
                    try {
                        const hookType = message.hookType;
                        const isInstalled = await this.hookInstaller.checkSingleHookStatus(hookType);
                        webview.postMessage({ 
                            type: 'singleHookStatusChecked', 
                            hookType: hookType,
                            installed: isInstalled 
                        });
                    } catch (error) {
                        webview.postMessage({ 
                            type: 'singleHookStatusChecked', 
                            hookType: message.hookType,
                            installed: false 
                        });
                    }
                    break;
                case 'playMP3':
                    try {
                        await this.playMP3File(webview, message.filePath);
                    } catch (error) {
                        console.error('播放MP3失败:', error);
                    }
                    break;
                case 'playCustomAudio':
                    try {
                        await this.playCustomAudioFile(webview, message.soundType);
                    } catch (error) {
                        console.error('播放自定义音频失败:', error);
                    }
                    break;
                case 'getAudioFiles':
                    try {
                        const audioFiles = this.getAvailableAudioFiles();
                        webview.postMessage({ 
                            type: 'audioFilesLoaded', 
                            audioFiles: audioFiles 
                        });
                    } catch (error) {
                        console.error('获取音频文件失败:', error);
                        webview.postMessage({ 
                            type: 'audioFilesLoaded', 
                            audioFiles: [] 
                        });
                    }
                    break;
                case 'checkCLI':
                    vscode.commands.executeCommand('claude-code-helper.checkCLI');
                    break;
                case 'installCLI':
                    vscode.commands.executeCommand('claude-code-helper.installCLI');
                    break;
                case 'getCLIStatus':
                    try {
                        const cliStatus = await this.hookInstaller.checkCLIStatus();
                        webview.postMessage({
                            type: 'cliStatusChecked',
                            available: cliStatus.available,
                            version: cliStatus.version,
                            commandsValid: cliStatus.commandsValid,
                            missingCommands: cliStatus.missingCommands
                        });
                    } catch (error) {
                        webview.postMessage({
                            type: 'cliStatusChecked',
                            available: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                    break;
            }
        });
    }

    private async playMP3File(webview: vscode.Webview, filePath: string): Promise<void> {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                console.error(`MP3文件不存在: ${filePath}`);
                return;
            }
            
            // 获取文件URI
            const fileUri = vscode.Uri.file(filePath);
            const webviewUri = webview.asWebviewUri(fileUri);
            
            // 发送MP3文件URI给webview
            webview.postMessage({
                type: 'mp3Ready',
                audioUri: webviewUri.toString()
            });
            
        } catch (error) {
            console.error('处理MP3文件失败:', error);
        }
    }

    private async playCustomAudioFile(webview: vscode.Webview, soundType: string): Promise<void> {
        try {
            const path = require('path');
            
            // 构建音频文件路径
            let fileName = '';
            if (soundType === 'xm3808') {
                fileName = 'xm3808.wav';
            } else if (soundType === 'xm3812') {
                fileName = 'xm3812.wav';
            } else {
                console.error(`未知的音频类型: ${soundType}`);
                return;
            }
            
            const audioFilePath = path.join(this.extensionUri.fsPath, 'assets', 'sounds', fileName);
            const fs = require('fs');
            
            // 检查文件是否存在
            if (!fs.existsSync(audioFilePath)) {
                console.error(`音频文件不存在: ${audioFilePath}`);
                // 显示错误提示
                webview.postMessage({
                    type: 'audioError',
                    message: `音频文件 ${fileName} 不存在`
                });
                return;
            }
            
            // 获取文件URI
            const fileUri = vscode.Uri.file(audioFilePath);
            const webviewUri = webview.asWebviewUri(fileUri);
            
            // 发送音频文件URI给webview
            webview.postMessage({
                type: 'customAudioReady',
                audioUri: webviewUri.toString(),
                soundType: soundType
            });
            
            console.log(`✅ 准备播放自定义音频: ${fileName}`);
            
        } catch (error) {
            console.error('处理自定义音频文件失败:', error);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Claude Code Helper</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
                    margin: 0;
                    padding: 16px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                    min-height: 100vh;
                }
                
                .container {
                    max-width: 720px;
                    margin: 0 auto;
                    background: transparent;
                    border-radius: 0;
                    box-shadow: none;
                    border: none;
                    overflow: visible;
                }
                
                .env-vars-section {
                    background: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 24px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0;
                }
                
                .env-vars-section .input-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    margin-bottom: 0;
                }
                
                .terminal-position-control {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .position-label {
                    font-size: 13px;
                    color: var(--vscode-foreground);
                    font-weight: normal;
                }
                
                .position-select {
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 4px 8px;
                    font-size: 13px;
                    min-width: 80px;
                }
                
                .position-select:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .env-vars-section input[type="checkbox"] {
                    margin: 0;
                }
                
                .env-vars-content {
                    margin-top: 15px;
                }
                
                .env-vars-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
                    font-size: 13px;
                    box-sizing: border-box;
                    resize: vertical;
                    min-height: 100px;
                    line-height: 1.4;
                }
                
                .env-vars-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .env-vars-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .claude-commands-compact {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                
                .claude-commands-compact h4 {
                    margin: 0 0 12px 0;
                    color: var(--vscode-foreground);
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .claude-commands-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                
                .claude-command-item {
                    background: var(--vscode-button-secondaryBackground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 13px;
                    text-align: left;
                    color: var(--vscode-foreground);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .claude-command-code {
                    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
                    color: var(--vscode-terminal-ansiGreen);
                    font-weight: 600;
                    font-size: 12px;
                }
                
                .claude-command-desc {
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    line-height: 1.3;
                }
                
                .claude-command-item:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }
                
                .apply-env-button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: bold;
                    transition: all 0.2s ease;
                }
                
                .apply-env-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .clear-env-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                
                .clear-env-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                h1 {
                    color: var(--vscode-foreground);
                    margin: 0 0 24px 0;
                    padding: 0;
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    text-align: center;
                }
                
                .command-input-section {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 24px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                
                .input-label {
                    display: block;
                    margin-bottom: 10px;
                    font-weight: bold;
                    color: var(--vscode-foreground);
                }
                
                .command-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
                    font-size: 14px;
                    box-sizing: border-box;
                    resize: vertical;
                    min-height: 100px;
                    line-height: 1.4;
                }
                
                .command-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .button-container {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                
                .run-button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: bold;
                    transition: all 0.2s ease;
                }
                
                .run-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .run-button:disabled {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-descriptionForeground);
                    cursor: not-allowed;
                }
                
                .clear-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                
                .clear-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .history-button, .history-dropdown-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 4px;
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                
                .history-button:hover, .history-dropdown-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .history-dropdown {
                    margin-top: 15px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    max-height: 200px;
                    overflow-y: auto;
                }
                
                .history-header {
                    padding: 10px 12px;
                    font-weight: bold;
                    color: var(--vscode-foreground);
                    border-bottom: 1px solid var(--vscode-input-border);
                    background: var(--vscode-button-secondaryBackground);
                }
                
                .history-list {
                    max-height: 160px;
                    overflow-y: auto;
                }
                
                .history-item {
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--vscode-input-border);
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
                    font-size: 13px;
                    word-break: break-all;
                }
                
                .history-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                
                .history-item:last-child {
                    border-bottom: none;
                }
                
                .no-history {
                    padding: 20px 12px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }
                
                .claude-commands-section {
                    padding: 24px;
                    background: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                
                .claude-commands-section h3 {
                    margin: 0 0 24px 0;
                    color: var(--vscode-foreground);
                    font-size: 20px;
                    font-weight: 600;
                    letter-spacing: -0.3px;
                }
                
                .command-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .command-item-new {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 20px 24px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }
                
                .command-item-new:hover {
                    background: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                    transform: translateY(-2px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.15);
                }
                
                .command-item-new:active {
                    transform: translateY(0);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .command-title {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .command-name {
                    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--vscode-terminal-ansiGreen);
                    background: var(--vscode-textPreformat-background);
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid var(--vscode-input-border);
                    letter-spacing: -0.2px;
                }
                
                .command-desc {
                    font-size: 11px;
                    color: var(--vscode-badge-foreground);
                    font-weight: 500;
                    background: var(--vscode-badge-background);
                    padding: 4px 10px;
                    border-radius: 16px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .command-description {
                    font-size: 13px;
                    color: var(--vscode-foreground);
                    line-height: 1.4;
                    margin: 0;
                    opacity: 0.9;
                }
                
                .command-item-new:hover .command-description {
                    opacity: 1;
                }
                
                .status {
                    margin-top: 15px;
                    padding: 10px;
                    border-radius: 4px;
                    display: none;
                }
                
                .status.success {
                    background: var(--vscode-inputValidation-infoBackground);
                    border: 1px solid var(--vscode-inputValidation-infoBorder);
                    color: var(--vscode-inputValidation-infoForeground);
                }
                
                .status.error {
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    color: var(--vscode-inputValidation-errorForeground);
                }
                
                .hooks-management-section {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 24px;
                    margin-bottom: 16px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }

                .sound-preview {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: 8px;
                }

                .play-button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .play-button:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: scale(1.1);
                }

                .play-button:active {
                    transform: scale(0.95);
                }

                .audio-player {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Claude Code Helper</h1>
                
                <div class="env-vars-section">
                    <div class="section-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button id="envVarsToggle" class="collapse-button" onclick="toggleEnvVarsCollapse()" style="background: none; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 4px; font-size: 14px; display: flex; align-items: center; transition: transform 0.2s ease;">
                                ▶
                            </button>
                            <label class="input-label" style="margin-bottom: 0;">
                                <input type="checkbox" id="enableEnvVars" onchange="toggleEnvVarsSection()"> 
                                环境变量 (启动终端时自动应用)
                            </label>
                        </div>
                        <div class="terminal-position-control">
                            <label class="position-label">终端位置:</label>
                            <select id="terminalPosition" class="position-select" onchange="saveTerminalPosition()">
                                <option value="right">右侧</option>
                                <option value="bottom">底部</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="envVarsContent" class="env-vars-content" style="display: none;">
                        <textarea 
                            id="envVarsInput" 
                            class="env-vars-input" 
                            placeholder="每行一个环境变量，格式：KEY=value&#10;例如：&#10;ANTHROPIC_BASE_URL=https://api.example.com&#10;API_TIMEOUT_MS=600000&#10;NODE_ENV=development&#10;&#10;注意：只支持环境变量，不支持 source、cd 等命令"
                            rows="4"
                        ></textarea>
                        
                    </div>
                </div>
                
                <div class="claude-commands-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--vscode-input-border);">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <h3 style="margin: 0; color: var(--vscode-foreground); font-size: 16px; font-weight: 600; letter-spacing: -0.2px;">
                                常用命令
                            </h3>
                            <a href="https://aicoding.sh" target="_blank" style="color: var(--vscode-textLink-foreground); text-decoration: none; font-size: 13px; opacity: 0.8; transition: opacity 0.2s ease;">
                                aicoding.sh
                            </a>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--vscode-foreground); cursor: pointer;">
                                <input type="checkbox" id="skipPermissions" onchange="toggleSkipPermissions()" style="margin: 0;">
                                跳过权限检查
                            </label>
                        </div>
                    </div>
                    
                    <!-- Claude未安装提示 -->
                    <div id="claudeNotInstalled" class="claude-install-notice" style="display: none;">
                        <div style="background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                            <div style="color: var(--vscode-inputValidation-warningForeground); font-size: 14px; margin-bottom: 12px; font-weight: 500;">
                                未检测到 Claude CLI，请先安装
                            </div>
                            <div onclick="executeCommandDirectly('npm install -g @anthropic-ai/claude-code')" style="background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 12px; cursor: pointer; transition: all 0.2s ease;">
                                <div style="font-family: var(--vscode-editor-font-family); color: var(--vscode-textPreformat-foreground); font-size: 13px; font-weight: 500;">
                                    npm install -g @anthropic-ai/claude-code
                                </div>
                                <div style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 4px;">
                                    安装 Claude CLI
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="commands-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                        <div class="command-item" onclick="executeCommandDirectly('claude')" style="background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 16px; cursor: pointer; transition: all 0.2s ease;">
                            <div style="font-family: var(--vscode-editor-font-family); color: var(--vscode-textPreformat-foreground); font-size: 14px; font-weight: 600; margin-bottom: 6px;">
                                claude
                            </div>
                            <div style="color: var(--vscode-descriptionForeground); font-size: 12px;">
                                创建新会话
                            </div>
                        </div>
                        <div class="command-item" onclick="executeCommandDirectly('claude -c')" style="background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 16px; cursor: pointer; transition: all 0.2s ease;">
                            <div style="font-family: var(--vscode-editor-font-family); color: var(--vscode-textPreformat-foreground); font-size: 14px; font-weight: 600; margin-bottom: 6px;">
                                claude -c
                            </div>
                            <div style="color: var(--vscode-descriptionForeground); font-size: 12px;">
                                继续上次对话
                            </div>
                        </div>
                        <div class="command-item" onclick="executeCommandDirectly('claude -r')" style="background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 16px; cursor: pointer; transition: all 0.2s ease;">
                            <div style="font-family: var(--vscode-editor-font-family); color: var(--vscode-textPreformat-foreground); font-size: 14px; font-weight: 600; margin-bottom: 6px;">
                                claude -r
                            </div>
                            <div style="color: var(--vscode-descriptionForeground); font-size: 12px;">
                                打开历史对话
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="hooks-management-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0; padding-bottom: 16px; border-bottom: 1px solid var(--vscode-input-border);">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button id="hooksToggle" class="collapse-button" onclick="toggleHooksCollapse()" style="background: none; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 4px; font-size: 14px; display: flex; align-items: center; transition: transform 0.2s ease;">
                                ▶
                            </button>
                            <h3 style="margin: 0; color: var(--vscode-foreground); font-size: 16px; font-weight: 600; letter-spacing: -0.2px;">
                                Hooks 管理
                            </h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div id="cliStatus" style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border);">
                                <span id="cliStatusIcon" style="font-size: 12px;">⏳</span>
                                <span id="cliStatusText" style="font-size: 12px; color: var(--vscode-foreground);">检查中</span>
                            </div>
                            <button id="cliActionBtn" onclick="handleCLIAction()" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 12px; display: none;">
                                安装CLI
                            </button>
                        </div>
                    </div>

                    <div id="hooksContent" class="hooks-list" style="display: none; flex-direction: column; gap: 16px; margin-top: 24px;">
                        <div class="hook-item" style="background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="flex: 1; margin-right: 16px;">
                                    <div style="font-weight: 600; color: var(--vscode-foreground); font-size: 15px; margin-bottom: 8px;">
                                        文件追踪
                                    </div>
                                    <div style="color: var(--vscode-descriptionForeground); font-size: 13px; line-height: 1.4;">
                                        编辑前自动在 VSCode 中打开文件
                                    </div>
                                    <div style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 4px; opacity: 0.8;">
                                        PreToolUse • Edit|MultiEdit|Write
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div id="fileTrackingStatus" style="width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-inputValidation-errorBackground); transition: background-color 0.2s ease;"></div>
                                    <button id="fileTrackingButton" onclick="toggleSingleHook('fileTracking')" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 13px; min-width: 56px; transition: all 0.2s ease;">
                                        开启
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="hook-item" style="background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="flex: 1; margin-right: 16px;">
                                    <div style="font-weight: 600; color: var(--vscode-foreground); font-size: 15px; margin-bottom: 8px;">
                                        工具声音提醒
                                    </div>
                                    <div style="color: var(--vscode-descriptionForeground); font-size: 13px; line-height: 1.4; margin-bottom: 12px;">
                                        为每个工具操作播放对应的提示音
                                    </div>
                                    
                                    <!-- 策略选择 -->
                                    <div style="margin-bottom: 8px;">
                                        <div style="color: var(--vscode-foreground); font-size: 12px; font-weight: 500; margin-bottom: 8px;">
                                            声音策略：
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 6px;">
                                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: var(--vscode-foreground);">
                                                <input type="checkbox" id="toolSoundsPreUse" style="margin: 0;" checked onchange="saveToolSoundsStrategies()">
                                                <span>PreToolUse - 工具执行前提醒</span>
                                            </label>
                                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: var(--vscode-foreground);">
                                                <input type="checkbox" id="toolSoundsPostUse" style="margin: 0;" checked onchange="saveToolSoundsStrategies()">
                                                <span>PostToolUse - 工具执行后提醒</span>
                                            </label>
                                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: var(--vscode-foreground);">
                                                <input type="checkbox" id="toolSoundsError" style="margin: 0;" checked onchange="saveToolSoundsStrategies()">
                                                <span>ToolError - 工具错误时提醒</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div id="toolSoundsStatus" style="width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-inputValidation-errorBackground); transition: background-color 0.2s ease;"></div>
                                    <button id="toolSoundsButton" onclick="toggleToolSoundsHook()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 13px; min-width: 56px; transition: all 0.2s ease;">
                                        开启
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div class="command-input-section">
                    <label class="input-label" for="commandInput">输入要执行的命令 (支持多行):</label>
                    <textarea 
                        id="commandInput" 
                        class="command-input" 
                        placeholder="claude"
                        rows="4"
                        autocomplete="off"
                    ></textarea>
                    
                    <div class="button-container">
                        <button id="runButton" class="run-button" onclick="runCommand()">
                            运行命令 (Ctrl+Enter)
                        </button>
                        <button class="clear-button" onclick="clearInput()">
                            清空
                        </button>
                        <button class="history-button" onclick="loadLastCommand()">
                            上次命令
                        </button>
                        <button class="history-dropdown-button" onclick="toggleHistoryDropdown()">
                            历史
                        </button>
                    </div>
                    
                    <div id="historyDropdown" class="history-dropdown" style="display: none;">
                        <div class="history-header">命令历史 (点击选择):</div>
                        <div id="historyList" class="history-list">
                            <div class="no-history">暂无历史命令</div>
                        </div>
                    </div>
                    
                    <div id="status" class="status"></div>
                </div>

                <!-- 隐藏的音频播放器 -->
                <audio id="audioPlayer" class="audio-player" preload="none">
                    您的浏览器不支持音频播放。
                </audio>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let commandHistory = [];
                const maxHistorySize = 20;
                let envVarsEnabled = true;
                let envVars = '';
                let terminalPosition = 'right';
                let envVarsCollapsed = true;
                let hooksCollapsed = true;
                let skipPermissions = false;
                
                // 绑定键盘事件
                document.getElementById('commandInput').addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        if (e.ctrlKey || e.metaKey) {
                            // Ctrl+Enter 或 Cmd+Enter 执行命令
                            e.preventDefault();
                            runCommand();
                        }
                        // 普通Enter键在textarea中换行，不执行命令
                    }
                });
                
                function runCommand() {
                    const input = document.getElementById('commandInput');
                    const command = input.value.trim();
                    
                    if (!command) {
                        showStatus('请输入命令', 'error');
                        return;
                    }
                    
                    // 如果勾选了跳过权限且命令是 claude 开头，则添加 --dangerously-skip-permissions 参数
                    let finalCommand = command;
                    if (skipPermissions && command.startsWith('claude') && !command.includes('--dangerously-skip-permissions')) {
                        // 在 claude 后面添加参数，保持原有的其他参数
                        if (command === 'claude') {
                            finalCommand = 'claude --dangerously-skip-permissions';
                        } else {
                            finalCommand = command.replace(/^claude/, 'claude --dangerously-skip-permissions');
                        }
                    }
                    
                    // 添加到历史记录
                    addToHistory(finalCommand);
                    
                    
                    // 获取环境变量
                    const envVarsToApply = envVarsEnabled ? document.getElementById('envVarsInput').value.trim() : '';
                    
                    console.log('Sending terminalPosition:', terminalPosition);
                    
                    vscode.postMessage({
                        type: 'executeCommand',
                        command: finalCommand,
                        envVars: envVarsToApply,
                        terminalPosition: terminalPosition
                    });
                    
                    // 保存命令历史和环境变量
                    saveHistory();
                    saveEnvVars();
                }
                
                function toggleHooksCollapse() {
                    const content = document.getElementById('hooksContent');
                    const toggleButton = document.getElementById('hooksToggle');
                    const headerDiv = toggleButton.closest('.hooks-management-section').querySelector('div[style*="border-bottom"]');
                    
                    hooksCollapsed = !hooksCollapsed;
                    
                    if (hooksCollapsed) {
                        content.style.display = 'none';
                        toggleButton.style.transform = 'rotate(0deg)';
                        toggleButton.textContent = '▶';
                        if (headerDiv) {
                            headerDiv.style.borderBottom = 'none';
                            headerDiv.style.paddingBottom = '0';
                        }
                    } else {
                        content.style.display = 'flex';
                        toggleButton.style.transform = 'rotate(90deg)';
                        toggleButton.textContent = '▼';
                        if (headerDiv) {
                            headerDiv.style.borderBottom = '1px solid var(--vscode-input-border)';
                            headerDiv.style.paddingBottom = '16px';
                        }
                    }
                }
                
                function toggleEnvVarsCollapse() {
                    const content = document.getElementById('envVarsContent');
                    const toggleButton = document.getElementById('envVarsToggle');
                    
                    envVarsCollapsed = !envVarsCollapsed;
                    
                    if (envVarsCollapsed) {
                        content.style.display = 'none';
                        toggleButton.style.transform = 'rotate(0deg)';
                        toggleButton.textContent = '▶';
                    } else {
                        // 只有在启用环境变量时才显示内容
                        if (envVarsEnabled) {
                            content.style.display = 'block';
                        }
                        toggleButton.style.transform = 'rotate(90deg)';
                        toggleButton.textContent = '▼';
                    }
                }

                function toggleEnvVarsSection() {
                    const checkbox = document.getElementById('enableEnvVars');
                    const content = document.getElementById('envVarsContent');
                    envVarsEnabled = checkbox.checked;
                    
                    // 只有在未折叠状态下才显示/隐藏内容
                    if (!envVarsCollapsed) {
                        if (envVarsEnabled) {
                            content.style.display = 'block';
                        } else {
                            content.style.display = 'none';
                        }
                    }
                    
                    saveEnvVarsSettings();
                }
                
                
                function saveEnvVars() {
                    const envVarsInput = document.getElementById('envVarsInput').value;
                    vscode.postMessage({
                        type: 'saveEnvVars',
                        envVars: envVarsInput
                    });
                }
                
                function saveEnvVarsSettings() {
                    vscode.postMessage({
                        type: 'saveEnvVarsSettings',
                        enabled: envVarsEnabled
                    });
                }
                
                function loadEnvVars() {
                    vscode.postMessage({
                        type: 'loadEnvVars'
                    });
                }
                
                function saveTerminalPosition() {
                    const select = document.getElementById('terminalPosition');
                    terminalPosition = select.value;
                    vscode.postMessage({
                        type: 'saveTerminalPosition',
                        position: terminalPosition
                    });
                }
                
                function toggleSkipPermissions() {
                    const checkbox = document.getElementById('skipPermissions');
                    skipPermissions = checkbox.checked;
                    
                    // 保存设置到扩展存储
                    vscode.postMessage({
                        type: 'saveSkipPermissions',
                        skipPermissions: skipPermissions
                    });
                }
                
                function loadTerminalPosition() {
                    vscode.postMessage({
                        type: 'loadTerminalPosition'
                    });
                }
                
                function loadSkipPermissions() {
                    vscode.postMessage({
                        type: 'loadSkipPermissions'
                    });
                }
                
                
                function loadAudioFiles() {
                    vscode.postMessage({
                        type: 'getAudioFiles'
                    });
                }
                
                function saveToolSoundsStrategies() {
                    const preUse = document.getElementById('toolSoundsPreUse').checked;
                    const postUse = document.getElementById('toolSoundsPostUse').checked;
                    const error = document.getElementById('toolSoundsError').checked;
                    
                    const strategies = {
                        preToolUse: preUse,
                        postToolUse: postUse,
                        toolError: error
                    };
                    
                    vscode.postMessage({
                        type: 'saveToolSoundsStrategies',
                        strategies: strategies
                    });
                }
                
                function loadToolSoundsStrategies() {
                    vscode.postMessage({
                        type: 'loadToolSoundsStrategies'
                    });
                }
                

                function checkCLIStatus() {
                    vscode.postMessage({
                        type: 'checkCLI'
                    });
                }

                function installCLI() {
                    console.log('📤 发送CLI安装请求到扩展');
                    vscode.postMessage({
                        type: 'installCLI'
                    });
                    
                    // 添加fallback超时检查，如果长时间没有响应就主动检查状态
                    setTimeout(() => {
                        console.log('🔍 Fallback: 主动检查CLI状态');
                        getCLIStatus();
                    }, 15000); // 15秒后fallback检查
                }

                function getCLIStatus() {
                    console.log('📤 请求CLI状态检查');
                    vscode.postMessage({
                        type: 'getCLIStatus'
                    });
                }

                // 调试函数：重置UI状态
                function resetCLIState() {
                    console.log('🔄 重置CLI UI状态');
                    const iconElement = document.getElementById('cliStatusIcon');
                    const textElement = document.getElementById('cliStatusText');
                    const actionBtn = document.getElementById('cliActionBtn');
                    
                    if (iconElement && textElement && actionBtn) {
                        iconElement.textContent = '❓';
                        textElement.textContent = 'CLI状态未知';
                        actionBtn.disabled = false;
                        actionBtn.textContent = '检查CLI';
                        actionBtn.style.display = 'inline-block';
                        actionBtn.onclick = () => getCLIStatus();
                    }
                    
                    // 清除所有超时
                    if (window.cliInstallTimeout) {
                        clearTimeout(window.cliInstallTimeout);
                        window.cliInstallTimeout = null;
                    }
                }

                // 暴露到全局，方便调试
                window.resetCLIState = resetCLIState;

                function updateCLIStatus(available, commandsValid, version) {
                    const iconElement = document.getElementById('cliStatusIcon');
                    const textElement = document.getElementById('cliStatusText');
                    const actionBtn = document.getElementById('cliActionBtn');
                    
                    if (iconElement && textElement && actionBtn) {
                        // 重新启用按钮
                        actionBtn.disabled = false;
                        
                        if (available) {
                            // CLI已安装，立即停止轮询
                            if (window.cliPollingInterval) {
                                console.log('✅ CLI已安装，停止轮询');
                                clearInterval(window.cliPollingInterval);
                                window.cliPollingInterval = null;
                            }
                            // 清除安装超时
                            if (window.cliInstallTimeout) {
                                clearTimeout(window.cliInstallTimeout);
                                window.cliInstallTimeout = null;
                            }
                            
                            if (commandsValid) {
                                iconElement.textContent = '✅';
                                textElement.textContent = 'CLI已安装';
                                actionBtn.style.display = 'none';
                                showStatus('✅ CLI安装完成', 'success');
                            } else {
                                iconElement.textContent = '⚠️';
                                textElement.textContent = 'CLI不完整';
                                actionBtn.textContent = '重装CLI';
                                actionBtn.style.display = 'inline-block';
                                showStatus('⚠️ CLI不完整，需要重装', 'warning');
                            }
                        } else {
                            // CLI未安装，继续轮询（如果正在轮询的话）
                            iconElement.textContent = '❌';
                            textElement.textContent = 'CLI未安装';
                            actionBtn.textContent = '安装CLI';
                            actionBtn.style.display = 'inline-block';
                        }
                    }
                    
                    // 清除旧的超时（如果有）
                    if (window.cliInstallTimeout) {
                        clearTimeout(window.cliInstallTimeout);
                        window.cliInstallTimeout = null;
                    }
                }

                function handleCLIAction() {
                    // 防止重复点击
                    if (window.cliPollingInterval) {
                        console.log('⚠️ CLI安装正在进行中，忽略重复请求');
                        return;
                    }
                    
                    // 显示安装中状态
                    const iconElement = document.getElementById('cliStatusIcon');
                    const textElement = document.getElementById('cliStatusText');
                    const actionBtn = document.getElementById('cliActionBtn');
                    
                    if (iconElement && textElement && actionBtn) {
                        iconElement.textContent = '⏳';
                        textElement.textContent = 'CLI安装中';
                        actionBtn.disabled = true;
                        actionBtn.textContent = '安装中...';
                    }
                    
                    // 清除之前的轮询和超时
                    if (window.cliPollingInterval) {
                        clearInterval(window.cliPollingInterval);
                        window.cliPollingInterval = null;
                    }
                    if (window.cliInstallTimeout) {
                        clearTimeout(window.cliInstallTimeout);
                        window.cliInstallTimeout = null;
                    }
                    
                    console.log('🔄 开始每秒轮询CLI状态');
                    // 每秒检测CLI状态
                    let pollCount = 0;
                    const maxPolls = 30; // 最多轮询30次 (30秒)
                    
                    const pollingInterval = setInterval(() => {
                        pollCount++;
                        console.log(\`📊 CLI状态轮询 \${pollCount}/\${maxPolls}\`);
                        getCLIStatus();
                        
                        // 30秒后停止轮询并超时处理
                        if (pollCount >= maxPolls) {
                            clearInterval(pollingInterval);
                            window.cliPollingInterval = null;
                            
                            console.log('⏰ CLI安装超时，停止轮询');
                            if (iconElement && textElement && actionBtn) {
                                iconElement.textContent = '❌';
                                textElement.textContent = 'CLI安装超时';
                                actionBtn.disabled = false;
                                actionBtn.textContent = '重试安装';
                                actionBtn.style.display = 'inline-block';
                            }
                            showStatus('⚠️ CLI安装超时，请重试', 'error');
                        }
                    }, 1000); // 每1秒轮询
                    
                    // 存储轮询ID以便后续清除
                    window.cliPollingInterval = pollingInterval;
                    
                    // 立即开始安装
                    installCLI();
                }
                
                function checkClaudeInstallation() {
                    vscode.postMessage({
                        type: 'checkClaudeInstallation'
                    });
                }
                
                function addToHistory(command) {
                    // 避免重复的连续命令
                    if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command) {
                        commandHistory.push(command);
                        
                        // 限制历史记录数量
                        if (commandHistory.length > maxHistorySize) {
                            commandHistory = commandHistory.slice(-maxHistorySize);
                        }
                        
                        updateHistoryDisplay();
                    }
                }
                
                function loadLastCommand() {
                    if (commandHistory.length > 0) {
                        const lastCommand = commandHistory[commandHistory.length - 1];
                        document.getElementById('commandInput').value = lastCommand;
                        document.getElementById('commandInput').focus();
                        hideStatus();
                    } else {
                        showStatus('没有历史命令', 'error');
                    }
                }
                
                function toggleHistoryDropdown() {
                    const dropdown = document.getElementById('historyDropdown');
                    if (dropdown.style.display === 'none') {
                        dropdown.style.display = 'block';
                        updateHistoryDisplay();
                    } else {
                        dropdown.style.display = 'none';
                    }
                }
                
                function updateHistoryDisplay() {
                    const historyList = document.getElementById('historyList');
                    
                    if (commandHistory.length === 0) {
                        historyList.innerHTML = '<div class="no-history">暂无历史命令</div>';
                        return;
                    }
                    
                    // 显示最近的命令在顶部
                    const reversedHistory = [...commandHistory].reverse();
                    historyList.innerHTML = reversedHistory.map(cmd => 
                        \`<div class="history-item" onclick="selectFromHistory('\${cmd.replace(/'/g, "\\\\'")}')">
                            \${cmd.length > 100 ? cmd.substring(0, 100) + '...' : cmd}
                        </div>\`
                    ).join('');
                }
                
                function selectFromHistory(command) {
                    document.getElementById('commandInput').value = command;
                    document.getElementById('commandInput').focus();
                    document.getElementById('historyDropdown').style.display = 'none';
                    hideStatus();
                }
                
                function clearInput() {
                    document.getElementById('commandInput').value = '';
                    hideStatus();
                }
                
                function fillCommand(command) {
                    document.getElementById('commandInput').value = command;
                    document.getElementById('commandInput').focus();
                    hideStatus();
                }
                
                function executeCommandDirectly(command) {
                    // 如果勾选了跳过权限且命令是 claude 开头，则添加 --dangerously-skip-permissions 参数
                    let finalCommand = command;
                    if (skipPermissions && command.startsWith('claude') && !command.includes('--dangerously-skip-permissions')) {
                        // 在 claude 后面添加参数，保持原有的其他参数
                        if (command === 'claude') {
                            finalCommand = 'claude --dangerously-skip-permissions';
                        } else {
                            finalCommand = command.replace(/^claude/, 'claude --dangerously-skip-permissions');
                        }
                    }
                    
                    // 添加到历史记录
                    addToHistory(finalCommand);
                    
                    
                    // 获取环境变量
                    const envVarsToApply = envVarsEnabled ? document.getElementById('envVarsInput').value.trim() : '';
                    
                    console.log('Sending terminalPosition:', terminalPosition);
                    
                    vscode.postMessage({
                        type: 'executeCommand',
                        command: finalCommand,
                        envVars: envVarsToApply,
                        terminalPosition: terminalPosition
                    });
                    
                    // 保存命令历史和环境变量
                    saveHistory();
                    saveEnvVars();
                }
                
                function showStatus(message, type) {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.className = 'status ' + type;
                    status.style.display = 'block';
                }
                
                function hideStatus() {
                    const status = document.getElementById('status');
                    status.style.display = 'none';
                }
                
                function saveHistory() {
                    // 通过VSCode状态保存历史记录
                    vscode.postMessage({
                        type: 'saveHistory',
                        history: commandHistory
                    });
                }
                
                function loadHistory() {
                    // 从VSCode状态加载历史记录
                    vscode.postMessage({
                        type: 'loadHistory'
                    });
                }
                
                // Hooks 管理功能
                let hooksState = {
                    fileTracking: false,
                    toolSounds: false
                };


                function checkSingleHookStatus(hookType) {
                    vscode.postMessage({
                        type: 'checkSingleHookStatus',
                        hookType: hookType
                    });
                }

                function initializeHooksStatus() {
                    // 检查所有hook的状态
                    checkSingleHookStatus('fileTracking');
                    checkSingleHookStatus('toolSounds');
                }

                function toggleSingleHook(hookType) {
                    hooksState[hookType] = !hooksState[hookType];
                    
                    // 安装或卸载单个 hook
                    if (hooksState[hookType]) {
                        // 安装这个 hook
                        const singleHookConfig = {};
                        singleHookConfig[hookType] = true;
                        
                        vscode.postMessage({
                            type: 'installSingleHook',
                            hookType: hookType,
                            hooks: singleHookConfig
                        });
                    } else {
                        // 卸载这个 hook
                        vscode.postMessage({
                            type: 'uninstallSingleHook',
                            hookType: hookType
                        });
                    }
                    
                    updateHookDisplay(hookType);
                }

                function toggleToolSoundsHook() {
                    hooksState.toolSounds = !hooksState.toolSounds;
                    
                    // 获取选中的策略
                    const preUse = document.getElementById('toolSoundsPreUse').checked;
                    const postUse = document.getElementById('toolSoundsPostUse').checked;
                    const error = document.getElementById('toolSoundsError').checked;
                    
                    // 检查是否至少选择了一个策略
                    if (hooksState.toolSounds && !preUse && !postUse && !error) {
                        // 如果没有选择任何策略，恢复状态并提示
                        hooksState.toolSounds = false;
                        showStatus('请至少选择一个声音策略', 'error');
                        return;
                    }
                    
                    // 保存策略设置
                    saveToolSoundsStrategies();
                    
                    if (hooksState.toolSounds) {
                        // 根据选中的策略构建配置
                        const toolSoundsConfig = {
                            toolSounds: true,
                            toolSoundsStrategies: {
                                preToolUse: preUse,
                                postToolUse: postUse,
                                toolError: error
                            }
                        };
                        
                        vscode.postMessage({
                            type: 'installSingleHook',
                            hookType: 'toolSounds',
                            hooks: toolSoundsConfig
                        });
                    } else {
                        // 卸载工具声音提醒
                        vscode.postMessage({
                            type: 'uninstallSingleHook',
                            hookType: 'toolSounds'
                        });
                    }
                    
                    updateHookDisplay('toolSounds');
                }

                function updateHookDisplay(hookType) {
                    const statusElement = document.getElementById(hookType + 'Status');
                    const buttonElement = document.getElementById(hookType + 'Button');
                    
                    if (statusElement && buttonElement) {
                        if (hooksState[hookType]) {
                            statusElement.style.background = 'var(--vscode-inputValidation-infoBackground)';
                            buttonElement.textContent = '关闭';
                            buttonElement.style.background = 'var(--vscode-button-background)';
                            buttonElement.style.color = 'var(--vscode-button-foreground)';
                        } else {
                            statusElement.style.background = 'var(--vscode-inputValidation-errorBackground)';
                            buttonElement.textContent = '开启';
                            buttonElement.style.background = 'var(--vscode-button-secondaryBackground)';
                            buttonElement.style.color = 'var(--vscode-button-secondaryForeground)';
                        }
                    }
                }



                
                function playCustomAudioFile(soundType) {
                    // 播放自定义音频文件
                    vscode.postMessage({
                        type: 'playCustomAudio',
                        soundType: soundType
                    });
                }
                
                // 添加MP3文件播放支持（未来功能）
                function playMP3File(filePath) {
                    const audioPlayer = document.getElementById('audioPlayer');
                    if (audioPlayer) {
                        try {
                            // 请求VSCode扩展处理MP3文件路径
                            vscode.postMessage({
                                type: 'playMP3',
                                filePath: filePath
                            });
                        } catch (error) {
                            console.error('播放MP3文件失败:', error);
                        }
                    }
                }
                
                function playWebAudioTone(soundType) {
                    try {
                        // 使用Web Audio API生成不同频率的提示音
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        // 根据声音类型设置不同的频率和持续时间
                        const soundConfig = {
                            'glass': { freq: 800, duration: 200, type: 'sine' },
                            'ping': { freq: 1000, duration: 150, type: 'triangle' },
                            'pop': { freq: 600, duration: 100, type: 'square' },
                            'purr': { freq: 300, duration: 300, type: 'sawtooth' },
                            'sosumi': { freq: 523, duration: 250, type: 'sine' },
                            'submarine': { freq: 200, duration: 400, type: 'sine' },
                            'blow': { freq: 400, duration: 200, type: 'triangle' },
                            'bottle': { freq: 880, duration: 120, type: 'sine' },
                            'frog': { freq: 440, duration: 180, type: 'square' },
                            'funk': { freq: 220, duration: 300, type: 'sawtooth' },
                            'hero': { freq: 659, duration: 250, type: 'triangle' },
                            'morse': { freq: 800, duration: 100, type: 'square' },
                            'tink': { freq: 1200, duration: 80, type: 'sine' }
                        };
                        
                        const config = soundConfig[soundType] || soundConfig['glass'];
                        
                        oscillator.frequency.setValueAtTime(config.freq, audioContext.currentTime);
                        oscillator.type = config.type;
                        
                        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration / 1000);
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + config.duration / 1000);
                        
                        console.log(\`🔊 播放预览音: \${soundType}\`);
                        
                    } catch (error) {
                        console.error('播放声音预览失败:', error);
                        // 降级方案：显示提示
                        showStatus(\`🔊 \${soundType} 声音预览\`, 'success');
                    }
                }


                function getHookDisplayName(hookType) {
                    const names = {
                        'fileTracking': '文件追踪',
                        'toolSounds': '工具声音提醒'
                    };
                    return names[hookType] || hookType;
                }

                // 处理来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'historyLoaded':
                            if (message.history && Array.isArray(message.history)) {
                                commandHistory = message.history;
                                updateHistoryDisplay();
                            }
                            break;
                        case 'envVarsLoaded':
                            if (message.envVars) {
                                document.getElementById('envVarsInput').value = message.envVars;
                            }
                            if (message.enabled !== undefined) {
                                envVarsEnabled = message.enabled;
                                document.getElementById('enableEnvVars').checked = envVarsEnabled;
                                toggleEnvVarsSection();
                            }
                            break;
                        case 'terminalPositionLoaded':
                            if (message.position) {
                                terminalPosition = message.position;
                                document.getElementById('terminalPosition').value = terminalPosition;
                            }
                            break;
                        case 'skipPermissionsLoaded':
                            if (message.skipPermissions !== undefined) {
                                skipPermissions = message.skipPermissions;
                                document.getElementById('skipPermissions').checked = skipPermissions;
                            }
                            break;
                        case 'toolSoundsStrategiesLoaded':
                            if (message.strategies) {
                                document.getElementById('toolSoundsPreUse').checked = message.strategies.preToolUse;
                                document.getElementById('toolSoundsPostUse').checked = message.strategies.postToolUse;
                                document.getElementById('toolSoundsError').checked = message.strategies.toolError;
                            }
                            break;
                        case 'claudeInstallationChecked':
                            const claudeNotInstalledDiv = document.getElementById('claudeNotInstalled');
                            if (!message.installed) {
                                claudeNotInstalledDiv.style.display = 'block';
                            } else {
                                claudeNotInstalledDiv.style.display = 'none';
                            }
                            break;
                        case 'singleHookInstalled':
                            if (message.success) {
                                showStatus(\`✅ \${getHookDisplayName(message.hookType)} 已开启\`, 'success');
                                hooksState[message.hookType] = true;
                                updateHookDisplay(message.hookType);
                            } else {
                                showStatus(\`❌ \${getHookDisplayName(message.hookType)} 开启失败\`, 'error');
                                hooksState[message.hookType] = false;
                                updateHookDisplay(message.hookType);
                            }
                            break;
                        case 'singleHookUninstalled':
                            if (message.success) {
                                showStatus(\`✅ \${getHookDisplayName(message.hookType)} 已关闭\`, 'success');
                                hooksState[message.hookType] = false;
                                updateHookDisplay(message.hookType);
                            } else {
                                showStatus(\`❌ \${getHookDisplayName(message.hookType)} 关闭失败\`, 'error');
                                hooksState[message.hookType] = true;
                                updateHookDisplay(message.hookType);
                            }
                            break;
                        case 'singleHookStatusChecked':
                            // 更新单个hook的状态
                            hooksState[message.hookType] = message.installed;
                            updateHookDisplay(message.hookType);
                            break;
                                case 'cliStatusChecked':
                            // 更新CLI状态显示
                            updateCLIStatus(message.available, message.commandsValid, message.version);
                            break;
                        case 'cliInstalled':
                            // 清除安装超时
                            if (window.cliInstallTimeout) {
                                clearTimeout(window.cliInstallTimeout);
                                window.cliInstallTimeout = null;
                            }
                            
                            // CLI安装成功后自动检查状态
                            if (message.success) {
                                showStatus('✅ CLI安装成功', 'success');
                                // 延迟一下再检查状态，确保安装完成
                                setTimeout(() => {
                                    getCLIStatus();
                                }, 1000);
                            } else {
                                showStatus(\`❌ CLI安装失败: \${message.message || '未知错误'}\`, 'error');
                                // 安装失败时重新启用按钮
                                const actionBtn = document.getElementById('cliActionBtn');
                                if (actionBtn) {
                                    actionBtn.disabled = false;
                                    actionBtn.textContent = '重试安装';
                                    actionBtn.style.display = 'inline-block';
                                }
                                // 更新状态显示
                                const iconElement = document.getElementById('cliStatusIcon');
                                const textElement = document.getElementById('cliStatusText');
                                if (iconElement && textElement) {
                                    iconElement.textContent = '❌';
                                    textElement.textContent = 'CLI安装失败';
                                }
                            }
                            break;
                        case 'mp3Ready':
                            // 播放MP3文件
                            if (message.audioUri) {
                                const audioPlayer = document.getElementById('audioPlayer');
                                if (audioPlayer) {
                                    audioPlayer.src = message.audioUri;
                                    audioPlayer.play().catch(error => {
                                        console.error('播放MP3失败:', error);
                                    });
                                }
                            }
                            break;
                        case 'customAudioReady':
                            // 播放自定义音频文件
                            if (message.audioUri) {
                                const audioPlayer = document.getElementById('audioPlayer');
                                if (audioPlayer) {
                                    audioPlayer.src = message.audioUri;
                                    audioPlayer.play().then(() => {
                                        console.log(\`🔊 播放自定义音频: \${message.soundType}\`);
                                    }).catch(error => {
                                        console.error('播放自定义音频失败:', error);
                                        showStatus(\`播放 \${message.soundType} 失败\`, 'error');
                                    });
                                }
                            }
                            break;
                        case 'audioFilesLoaded':
                            // 音频文件列表加载完成 - 保留用于工具声音功能
                            break;
                        case 'uploadResult':
                            // 上传结果处理
                            if (message.success) {
                                showStatus(message.message || '上传成功', 'success');
                            } else {
                                showStatus(message.message || '上传失败', 'error');
                            }
                            break;
                        case 'audioError':
                            // 音频错误处理
                            if (message.message) {
                                showStatus(message.message, 'error');
                                console.error('音频错误:', message.message);
                            }
                            break;
                    }
                });
                
                // 初始化
                document.getElementById('commandInput').focus();
                loadHistory();
                loadEnvVars();
                loadTerminalPosition();
                loadSkipPermissions();
                loadToolSoundsStrategies();
                loadAudioFiles();
                checkClaudeInstallation();
                
                // 初始化hooks状态
                initializeHooksStatus();
                
                // 初始化CLI状态检查
                getCLIStatus();
                
                // 初始化环境变量折叠状态（默认折叠）
                const envContent = document.getElementById('envVarsContent');
                const envToggleButton = document.getElementById('envVarsToggle');
                envContent.style.display = 'none';
                envToggleButton.style.transform = 'rotate(0deg)';
                envToggleButton.textContent = '▶';
                
                // 初始化Hooks管理折叠状态（默认折叠）
                const hooksContent = document.getElementById('hooksContent');
                const hooksToggleButton = document.getElementById('hooksToggle');
                const hooksHeaderDiv = hooksToggleButton.closest('.hooks-management-section').querySelector('div[style*="border-bottom"]');
                hooksContent.style.display = 'none';
                hooksToggleButton.style.transform = 'rotate(0deg)';
                hooksToggleButton.textContent = '▶';
                if (hooksHeaderDiv) {
                    hooksHeaderDiv.style.borderBottom = 'none';
                    hooksHeaderDiv.style.paddingBottom = '0';
                }
                
                // 点击外部关闭历史下拉框
                document.addEventListener('click', function(event) {
                    const dropdown = document.getElementById('historyDropdown');
                    const dropdownButton = document.querySelector('.history-dropdown-button');
                    
                    if (!dropdown.contains(event.target) && event.target !== dropdownButton) {
                        dropdown.style.display = 'none';
                    }
                });
            </script>
        </body>
        </html>`;
    }
}