import * as vscode from 'vscode';
import { CommandManager } from './commandManager';

export class CommandPanelProvider implements vscode.WebviewViewProvider {
    private webviewView?: vscode.WebviewView;
    
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly commandManager: CommandManager
    ) {}

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
            localResourceRoots: [this.extensionUri]
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
                case 'checkClaudeInstallation':
                    const isClaudeInstalled = await this.commandManager.checkClaudeInstallation();
                    webview.postMessage({ type: 'claudeInstallationChecked', installed: isClaudeInstalled });
                    break;
            }
        });
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
                    padding: 32px;
                    background: linear-gradient(135deg, var(--vscode-editor-background) 0%, var(--vscode-sideBar-background) 100%);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                    min-height: 100vh;
                }
                
                .container {
                    max-width: 720px;
                    margin: 0 auto;
                    background: var(--vscode-editor-background);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                    border: 1px solid var(--vscode-input-border);
                    overflow: hidden;
                }
                
                .env-vars-section {
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-input-border);
                    padding: 24px 32px;
                    margin: 0;
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
                    border-bottom: 1px solid var(--vscode-input-border);
                    padding: 16px 32px;
                    margin: 0;
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
                    margin: 0;
                    padding: 32px 32px 0 32px;
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    background: linear-gradient(90deg, var(--vscode-foreground) 0%, var(--vscode-descriptionForeground) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .command-input-section {
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-input-border);
                    padding: 32px;
                    margin: 0;
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
                    padding: 12px 24px;
                    cursor: pointer;
                    font-size: 14px;
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
                    padding: 12px 24px;
                    cursor: pointer;
                    font-size: 14px;
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
                    padding: 12px 16px;
                    cursor: pointer;
                    font-size: 14px;
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
                    padding: 32px;
                    background: var(--vscode-sideBar-background);
                    margin: 0;
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
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Claude Code Helper</h1>
                
                <div class="env-vars-section">
                    <div class="section-header">
                        <label class="input-label">
                            <input type="checkbox" id="enableEnvVars" onchange="toggleEnvVarsSection()"> 
                            环境变量 (启动终端时自动应用)
                        </label>
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
                
                <div class="claude-commands-compact">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h4 style="margin: 0;">常用命令</h4>
                        <a href="https://aicoding.sh" target="_blank" style="color: var(--vscode-textLink-foreground); text-decoration: none; font-size: 12px;">aicoding.sh</a>
                    </div>
                    
                    <!-- Claude未安装提示 -->
                    <div id="claudeNotInstalled" class="claude-install-notice" style="display: none;">
                        <div style="background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                            <div style="color: var(--vscode-inputValidation-warningForeground); font-size: 13px; margin-bottom: 8px;">
                                未检测到 Claude CLI，请先安装：
                            </div>
                            <div class="claude-command-item" onclick="executeCommandDirectly('npm install -g @anthropic-ai/claude-code')" style="margin: 0; cursor: pointer;">
                                <div class="claude-command-code">npm install -g @anthropic-ai/claude-code</div>
                                <div class="claude-command-desc">安装 Claude CLI</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="claude-commands-grid">
                        <div class="claude-command-item" onclick="executeCommandDirectly('claude')">
                            <div class="claude-command-code">claude</div>
                            <div class="claude-command-desc">启动 Claude Code</div>
                        </div>
                        <div class="claude-command-item" onclick="executeCommandDirectly('claude -c')">
                            <div class="claude-command-code">claude -c</div>
                            <div class="claude-command-desc">继续上次对话</div>
                        </div>
                        <div class="claude-command-item" onclick="executeCommandDirectly('claude -r')">
                            <div class="claude-command-code">claude -r</div>
                            <div class="claude-command-desc">打开历史对话</div>
                        </div>
                        <div class="claude-command-item" onclick="executeCommandDirectly('claude --dangerously-skip-permissions')">
                            <div class="claude-command-code">claude --skip</div>
                            <div class="claude-command-desc">跳过权限检查</div>
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
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let commandHistory = [];
                const maxHistorySize = 20;
                let envVarsEnabled = true;
                let envVars = '';
                let terminalPosition = 'right';
                
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
                    
                    // 添加到历史记录
                    addToHistory(command);
                    
                    
                    // 获取环境变量
                    const envVarsToApply = envVarsEnabled ? document.getElementById('envVarsInput').value.trim() : '';
                    
                    console.log('Sending terminalPosition:', terminalPosition);
                    
                    vscode.postMessage({
                        type: 'executeCommand',
                        command: command,
                        envVars: envVarsToApply,
                        terminalPosition: terminalPosition
                    });
                    
                    // 保存命令历史和环境变量
                    saveHistory();
                    saveEnvVars();
                }
                
                function toggleEnvVarsSection() {
                    const checkbox = document.getElementById('enableEnvVars');
                    const content = document.getElementById('envVarsContent');
                    envVarsEnabled = checkbox.checked;
                    
                    if (envVarsEnabled) {
                        content.style.display = 'block';
                    } else {
                        content.style.display = 'none';
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
                
                function loadTerminalPosition() {
                    vscode.postMessage({
                        type: 'loadTerminalPosition'
                    });
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
                    // 添加到历史记录
                    addToHistory(command);
                    
                    
                    // 获取环境变量
                    const envVarsToApply = envVarsEnabled ? document.getElementById('envVarsInput').value.trim() : '';
                    
                    console.log('Sending terminalPosition:', terminalPosition);
                    
                    vscode.postMessage({
                        type: 'executeCommand',
                        command: command,
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
                        case 'claudeInstallationChecked':
                            const claudeNotInstalledDiv = document.getElementById('claudeNotInstalled');
                            if (!message.installed) {
                                claudeNotInstalledDiv.style.display = 'block';
                            } else {
                                claudeNotInstalledDiv.style.display = 'none';
                            }
                            break;
                    }
                });
                
                // 初始化
                document.getElementById('commandInput').focus();
                loadHistory();
                loadEnvVars();
                loadTerminalPosition();
                checkClaudeInstallation();
                
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