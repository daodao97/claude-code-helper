import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export interface PresetCommand {
    id: string;
    name: string;
    command: string;
    description?: string;
    icon?: string;
    workingDirectory?: string;
}

export class CommandManager implements vscode.Disposable {
    private commands: PresetCommand[] = [];
    private terminal?: vscode.Terminal;
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Claude Code Helper');
        this.loadCommands();
    }

    private async loadCommands(): Promise<void> {
        const savedCommands = this.context.globalState.get<PresetCommand[]>('presetCommands');
        if (savedCommands) {
            this.commands = savedCommands;
        } else {
            this.commands = this.getDefaultCommands();
            await this.saveCommands();
        }
    }

    private getDefaultCommands(): PresetCommand[] {
        return [
            {
                id: '1',
                name: 'npm 安装',
                command: 'npm install',
                description: '安装项目依赖',
                icon: '📦'
            },
            {
                id: '2', 
                name: '启动开发服务器',
                command: 'npm run dev',
                description: '启动开发环境',
                icon: '🚀'
            },
            {
                id: '3',
                name: '构建项目',
                command: 'npm run build',
                description: '构建生产版本',
                icon: '🔨'
            },
            {
                id: '4',
                name: '运行测试',
                command: 'npm test',
                description: '运行单元测试',
                icon: '✅'
            },
            {
                id: '5',
                name: 'Git 状态',
                command: 'git status',
                description: '查看Git仓库状态',
                icon: '📊'
            },
            {
                id: '6',
                name: '清理缓存',
                command: 'npm run clean',
                description: '清理构建缓存',
                icon: '🧹'
            }
        ];
    }

    private async saveCommands(): Promise<void> {
        await this.context.globalState.update('presetCommands', this.commands);
    }

    public async getCommands(): Promise<PresetCommand[]> {
        return this.commands;
    }

    public async executeSimpleCommand(commandString: string, envVars?: string, terminalPosition?: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath || process.cwd();

        if (envVars && envVars.trim()) {
        }

        // 处理多行命令 - 过滤掉环境变量相关的行，只保留真正的命令
        const commands = commandString.split('\n')
            .map(cmd => cmd.trim())
            .filter(cmd => {
                // 跳过空行和注释
                if (cmd.length === 0 || cmd.startsWith('#') || cmd.startsWith('//')) {
                    return false;
                }
                
                // 过滤掉环境变量设置（export VARIABLE=value 或 VARIABLE=value 格式）
                if (cmd.startsWith('export ') && cmd.includes('=')) {
                    return false;
                }
                if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(cmd)) {
                    return false;
                }
                
                // 过滤掉其他不应该在命令中出现的环境相关命令
                if (cmd.startsWith('source ') || cmd.startsWith('cd ') && cmd.includes('&&') === false) {
                    return false;
                }
                
                return true;
            });

        if (commands.length === 0) {
            vscode.window.showWarningMessage('没有有效的命令需要执行');
            return;
        }

        // 执行命令（包含环境变量）
        this.executeCommandInTerminalOptimized(commands, cwd, envVars, false, terminalPosition);
    }

    public async saveCommandHistory(history: string[]): Promise<void> {
        await this.context.globalState.update('commandHistory', history);
    }

    public async loadCommandHistory(): Promise<string[]> {
        return this.context.globalState.get<string[]>('commandHistory', []);
    }

    public async saveEnvironmentVariables(envVars: string): Promise<void> {
        await this.context.globalState.update('environmentVariables', envVars);
    }

    public async loadEnvironmentVariables(): Promise<string> {
        return this.context.globalState.get<string>('environmentVariables', '');
    }

    public async saveEnvironmentVariablesSettings(enabled: boolean): Promise<void> {
        await this.context.globalState.update('envVarsEnabled', enabled);
    }

    public async loadEnvironmentVariablesSettings(): Promise<boolean> {
        return this.context.globalState.get<boolean>('envVarsEnabled', true);
    }

    public async saveTerminalPosition(position: string): Promise<void> {
        await this.context.globalState.update('terminalPosition', position);
    }

    public async loadTerminalPosition(): Promise<string> {
        return this.context.globalState.get<string>('terminalPosition', 'right');
    }

    public async checkClaudeInstallation(): Promise<boolean> {
        return new Promise((resolve) => {
            cp.exec('claude --version', (error) => {
                resolve(!error);
            });
        });
    }

    public async applyEnvironmentVariables(envVars: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath || process.cwd();

        this.outputChannel.appendLine(`环境变量: ${envVars.replace(/\n/g, ', ')}`);

        this.executeCommandInTerminalOptimized([], cwd, envVars, true);
    }

    private executeCommandInTerminalOptimized(commands: string[], cwd: string, envVars?: string, onlyEnvVars = false, terminalPosition?: string): void {
        const terminalName = 'Claude Code Helper';
        console.log('Terminal position:', terminalPosition);
        
        // 为了避免位置冲突，每次都创建新的终端
        // 先关闭同名的现有终端
        const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (existingTerminal) {
            existingTerminal.dispose();
        }
        
        let terminal: vscode.Terminal;
        
        // 根据位置设置创建终端
        if (terminalPosition === 'right') {
            // 右侧模式：在编辑器区域创建终端
            terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: cwd,
                location: vscode.TerminalLocation.Editor
            });
        } else {
            // 底部模式：在面板创建终端
            terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: cwd,
                location: vscode.TerminalLocation.Panel
            });
        }

        // 显示终端
        terminal.show();
        
        // 如果选择右侧显示，进行分割操作
        if (terminalPosition === 'right') {
            setTimeout(async () => {
                try {
                    // 1. 分割编辑器到右侧（这会创建一个右侧编辑器组）
                    await vscode.commands.executeCommand('workbench.action.splitEditorRight');
                    
                    // 2. 聚焦到终端确保它是活动编辑器
                    terminal.show();
                    
                    // 3. 将终端移动到右侧编辑器组
                    setTimeout(async () => {
                        try {
                            await vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup');
                        } catch (e) {
                            console.log('Move to next group error:', e);
                        }
                    }, 200);
                    
                } catch (error) {
                    console.log('Split editor right error:', error);
                }
            }, 300);
        }
        
        
        // 给终端一些时间完成初始化
        const delay = terminal.creationOptions ? 1000 : 500; // 新终端1秒，现有终端0.5秒
        
        setTimeout(() => {
            // 应用环境变量
            if (envVars && envVars.trim()) {
                const envVarLines = envVars.split('\n')
                    .map(line => line.trim())
                    .filter(line => {
                        // 跳过空行、注释行
                        if (line.length === 0 || line.startsWith('#') || line.startsWith('//')) {
                            return false;
                        }
                        
                        // 排除常见的非环境变量命令
                        const nonEnvCommands = ['source', 'cd', 'ls', 'echo', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown', 'sudo', 'npm', 'git', 'python', 'node', 'yarn', 'pip'];
                        if (nonEnvCommands.some(cmd => line.startsWith(cmd + ' ') || line === cmd)) {
                            return false;
                        }
                        
                        // 只接受环境变量格式
                        if (line.startsWith('export ')) {
                            const envPart = line.substring(7).trim();
                            // export后面必须是 KEY=value 格式，且KEY只能包含字母数字下划线
                            return /^[A-Za-z_][A-Za-z0-9_]*=.*$/.test(envPart);
                        }
                        
                        // 直接的 KEY=value 格式，KEY只能包含字母数字下划线
                        return /^[A-Za-z_][A-Za-z0-9_]*=.*$/.test(line);
                    });
                
                if (envVarLines.length > 0) {
                    for (const envVar of envVarLines) {
                        // 检查是否已经包含export前缀，避免重复
                        if (envVar.startsWith('export ')) {
                            terminal.sendText(envVar);
                        } else {
                            terminal.sendText(`export ${envVar}`);
                        }
                    }
                }
            }
            
            // 执行其他操作
            this.executeDelayedCommands(terminal, commands, cwd, onlyEnvVars);
        }, delay);
    }

    private executeDelayedCommands(terminal: vscode.Terminal, commands: string[], cwd: string, onlyEnvVars: boolean): void {
        // 如果只是应用环境变量，不执行其他命令
        if (onlyEnvVars) {
            return;
        }
        
        // 执行命令
        if (commands.length === 0) {
            return;
        }
        
        // 简化的输出信息
        if (commands.length === 1) {
            // 单个命令直接执行
            terminal.sendText(`cd "${cwd}" && ${commands[0]}`);
        } else {
            // 多个命令，使用 && 连接一次性执行
            const combinedCommand = commands.join(' && ');
            terminal.sendText(`cd "${cwd}" && ${combinedCommand}`);
        }
    }

    // 保留原方法以备不时之需
    private executeCommandInTerminal(commandString: string, cwd: string): void {
        const terminalName = 'Claude Code Helper';
        
        let terminal = vscode.window.terminals.find(t => t.name === terminalName);
        
        if (!terminal) {
            terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: cwd
            });
        }

        terminal.show();
        terminal.sendText(`cd "${cwd}" && ${commandString}`);
    }

    public async executeCommand(command: PresetCommand): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = command.workingDirectory || workspaceFolder?.uri.fsPath || process.cwd();


        // 所有命令都在终端中执行，提供更好的用户体验
        // 注意：预设命令暂时使用默认位置，因为没有传递terminalPosition参数
        this.executeInTerminal(command, cwd);
    }

    private isInteractiveCommand(command: string): boolean {
        const interactiveCommands = ['npm run dev', 'yarn dev', 'npm start', 'yarn start', 'serve', 'python -m http.server'];
        return interactiveCommands.some(cmd => command.toLowerCase().includes(cmd));
    }

    private executeInTerminal(command: PresetCommand, cwd: string, terminalPosition?: string): void {
        // 为每个命令创建新的终端，或者复用现有的
        const terminalName = `Claude Code Helper: ${command.name}`;
        
        // 为了避免位置冲突，每次都创建新的终端
        // 先关闭同名的现有终端
        const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (existingTerminal) {
            existingTerminal.dispose();
        }
        
        // 根据位置设置创建终端
        if (terminalPosition === 'right') {
            // 右侧模式：在编辑器区域创建终端
            this.terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: cwd,
                location: vscode.TerminalLocation.Editor
            });
        } else {
            // 底部模式：在面板创建终端
            this.terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: cwd,
                location: vscode.TerminalLocation.Panel
            });
        }

        this.terminal.show();
        
        // 如果选择右侧显示，进行分割操作
        if (terminalPosition === 'right') {
            setTimeout(async () => {
                try {
                    // 1. 分割编辑器到右侧（这会创建一个右侧编辑器组）
                    await vscode.commands.executeCommand('workbench.action.splitEditorRight');
                    
                    // 2. 聚焦到终端确保它是活动编辑器
                    this.terminal!.show();
                    
                    // 3. 将终端移动到右侧编辑器组
                    setTimeout(async () => {
                        try {
                            await vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup');
                        } catch (e) {
                            console.log('Move to next group error:', e);
                        }
                    }, 200);
                    
                } catch (error) {
                    console.log('Split editor right error:', error);
                }
            }, 300);
        }
        
        
        // 给终端一些时间完成初始化
        const delay = existingTerminal ? 500 : 1000; // 现有终端0.5秒，新终端1秒
        
        setTimeout(() => {
            // 显示执行的命令信息
            
            // 确保在正确的目录下执行命令
            this.terminal!.sendText(`cd "${cwd}"`);
            this.terminal!.sendText(command.command);
        }, delay);
    }

    private executeInBackground(command: PresetCommand, cwd: string): void {
        const child = cp.exec(command.command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                this.outputChannel.appendLine(`错误: ${error.message}`);
                vscode.window.showErrorMessage(`命令执行失败: ${command.name}`);
                return;
            }

            if (stderr) {
                this.outputChannel.appendLine(`警告: ${stderr}`);
            }

            this.outputChannel.appendLine('输出:');
            this.outputChannel.appendLine(stdout);
                
            vscode.window.showInformationMessage(`命令执行完成: ${command.name}`);
        });

        child.stdout?.on('data', (data) => {
            this.outputChannel.append(data.toString());
        });

        child.stderr?.on('data', (data) => {
            this.outputChannel.append(data.toString());
        });
    }

    public async openConfigDialog(): Promise<void> {
        const options = [
            '添加新命令',
            '编辑现有命令',
            '删除命令',
            '重置为默认命令'
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: '选择操作'
        });

        switch (selection) {
            case '添加新命令':
                await this.addNewCommand();
                break;
            case '编辑现有命令':
                await this.editCommand();
                break;
            case '删除命令':
                await this.deleteCommand();
                break;
            case '重置为默认命令':
                await this.resetToDefault();
                break;
        }
    }

    private async addNewCommand(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: '输入命令名称',
            placeHolder: '例如: 启动服务器'
        });

        if (!name) {return;}

        const command = await vscode.window.showInputBox({
            prompt: '输入要执行的命令',
            placeHolder: '例如: npm run dev'
        });

        if (!command) {return;}

        const description = await vscode.window.showInputBox({
            prompt: '输入命令描述（可选）',
            placeHolder: '例如: 启动开发服务器'
        });

        const icon = await vscode.window.showInputBox({
            prompt: '输入命令图标（可选）',
            placeHolder: '例如: 🚀'
        });

        const newCommand: PresetCommand = {
            id: Date.now().toString(),
            name,
            command,
            description: description || '',
            icon: icon || '⚡'
        };

        this.commands.push(newCommand);
        await this.saveCommands();
        
        vscode.window.showInformationMessage(`命令 "${name}" 已添加`);
    }

    private async editCommand(): Promise<void> {
        const commandItems = this.commands.map(cmd => ({
            label: cmd.name,
            description: cmd.command,
            command: cmd
        }));

        const selected = await vscode.window.showQuickPick(commandItems, {
            placeHolder: '选择要编辑的命令'
        });

        if (!selected) {return;}

        const command = selected.command;
        
        const name = await vscode.window.showInputBox({
            prompt: '修改命令名称',
            value: command.name
        });

        if (!name) {return;}

        const commandStr = await vscode.window.showInputBox({
            prompt: '修改要执行的命令',
            value: command.command
        });

        if (!commandStr) {return;}

        const description = await vscode.window.showInputBox({
            prompt: '修改命令描述',
            value: command.description || ''
        });

        const icon = await vscode.window.showInputBox({
            prompt: '修改命令图标',
            value: command.icon || '⚡'
        });

        command.name = name;
        command.command = commandStr;
        command.description = description || '';
        command.icon = icon || '⚡';

        await this.saveCommands();
        vscode.window.showInformationMessage(`命令 "${name}" 已更新`);
    }

    private async deleteCommand(): Promise<void> {
        const commandItems = this.commands.map(cmd => ({
            label: cmd.name,
            description: cmd.command,
            command: cmd
        }));

        const selected = await vscode.window.showQuickPick(commandItems, {
            placeHolder: '选择要删除的命令'
        });

        if (!selected) {return;}

        const confirmed = await vscode.window.showWarningMessage(
            `确定要删除命令 "${selected.command.name}" 吗？`,
            { modal: true },
            '删除'
        );

        if (confirmed === '删除') {
            this.commands = this.commands.filter(cmd => cmd.id !== selected.command.id);
            await this.saveCommands();
            vscode.window.showInformationMessage(`命令 "${selected.command.name}" 已删除`);
        }
    }

    private async resetToDefault(): Promise<void> {
        const confirmed = await vscode.window.showWarningMessage(
            '确定要重置为默认命令吗？这将删除所有自定义命令。',
            { modal: true },
            '重置'
        );

        if (confirmed === '重置') {
            this.commands = this.getDefaultCommands();
            await this.saveCommands();
            vscode.window.showInformationMessage('已重置为默认命令');
        }
    }

    public dispose(): void {
        this.outputChannel.dispose();
        if (this.terminal) {
            this.terminal.dispose();
        }
    }
}