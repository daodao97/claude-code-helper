import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { CLIChecker } from './cliChecker';

interface HookConfig {
    matcher: string;
    hooks: Array<{
        type: string;
        command: string;
    }>;
}

interface ClaudeSettings {
    hooks?: {
        PreToolUse?: HookConfig[];
        PostToolUse?: HookConfig[];
        Stop?: HookConfig[];
        Notification?: HookConfig[];
        [key: string]: HookConfig[] | undefined;
    };
    [key: string]: any;
}

export class HookInstaller {
    private isWindows(): boolean {
        return process.platform === 'win32';
    }

    private generateCrossPlatformCommand(errorVar: string, toolVar: string): string {
        if (this.isWindows()) {
            // Windows batch/PowerShell compatible command
            return `powershell -Command "if ($env:TOOL_ERROR) { cchelper play '$env:TOOL_NAME' error } else { cchelper play '$env:TOOL_NAME' success }"`;
        } else {
            // Unix/Linux bash command
            return `if [ -n "${errorVar}" ]; then cchelper play "${toolVar}" error; else cchelper play "${toolVar}" success; fi`;
        }
    }
    private readonly claudeSettingsPath: string;

    constructor() {
        this.claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    }

    public async installHooks(hooksConfig?: any): Promise<boolean> {
        // 首先检查CLI是否可用
        const cliStatus = await CLIChecker.getCLIStatus();
        if (!cliStatus.available) {
            const message = `无法安装 hooks：cchelper CLI 未安装或不可用\n错误：${cliStatus.error}\n\n请先安装 CLI 工具后再尝试安装 hooks。`;
            vscode.window.showErrorMessage(message, '安装 CLI').then(selection => {
                if (selection === '安装 CLI') {
                    vscode.commands.executeCommand('claude-code-helper.installCLI');
                }
            });
            return false;
        }

        // 验证hooks需要的CLI命令
        const commandValidation = await CLIChecker.validateHookCommands();
        if (!commandValidation.valid) {
            const message = `CLI工具缺少hooks所需的命令：${commandValidation.missingCommands.join(', ')}\n\n请重新安装或升级 CLI 工具。`;
            vscode.window.showErrorMessage(message, '重新安装 CLI').then(selection => {
                if (selection === '重新安装 CLI') {
                    vscode.commands.executeCommand('claude-code-helper.installCLI');
                }
            });
            return false;
        }

        try {
            // 确保 .claude 目录存在
            const claudeDir = path.dirname(this.claudeSettingsPath);
            if (!fs.existsSync(claudeDir)) {
                fs.mkdirSync(claudeDir, { recursive: true });
            }

            // 读取现有设置
            let settings: ClaudeSettings = {};
            if (fs.existsSync(this.claudeSettingsPath)) {
                try {
                    const content = fs.readFileSync(this.claudeSettingsPath, 'utf8');
                    settings = JSON.parse(content);
                } catch (error) {
                    console.log('创建新的 Claude 设置文件');
                }
            }

            // 初始化 hooks 对象
            if (!settings.hooks) {
                settings.hooks = {};
            }
            if (!settings.hooks.PreToolUse) {
                settings.hooks.PreToolUse = [];
            }
            if (!settings.hooks.PostToolUse) {
                settings.hooks.PostToolUse = [];
            }

            let installed = false;

            // 根据配置安装选中的 hooks
            const config = hooksConfig || { fileTracking: true };


            // 先清除现有的 cchelper hooks（只有在明确指定配置时）
            this.removeExistingHooks(settings);

            if (config.fileTracking !== false) {
                // 1. 文件追踪 - PreToolUse Edit|MultiEdit|Write 事件
                settings.hooks.PreToolUse.push({
                    matcher: "Edit|MultiEdit|Write",
                    hooks: [
                        {
                            type: "command",
                            command: "cchelper hook-open"
                        }
                    ]
                });
                installed = true;
            }


            if (config.toolSounds) {
                // 4. 工具声音提醒 - PreToolUse 和 PostToolUse 事件
                // PreToolUse - 工具开始执行时
                const startCommand = this.isWindows() 
                    ? 'cchelper play "%TOOL_NAME%" start'
                    : 'cchelper play "$TOOL_NAME" start';
                    
                settings.hooks.PreToolUse.push({
                    matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|LS|Bash|Task|WebFetch|WebSearch|TodoWrite|ExitPlanMode",
                    hooks: [
                        {
                            type: "command",
                            command: startCommand
                        }
                    ]
                });
                
                // PostToolUse - 工具执行完成时
                settings.hooks.PostToolUse.push({
                    matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|LS|Bash|Task|WebFetch|WebSearch|TodoWrite|ExitPlanMode",
                    hooks: [
                        {
                            type: "command", 
                            command: this.generateCrossPlatformCommand("$TOOL_ERROR", "$TOOL_NAME")
                        }
                    ]
                });
                installed = true;
            }

            // 保存设置
            if (installed) {
                fs.writeFileSync(
                    this.claudeSettingsPath, 
                    JSON.stringify(settings, null, 2),
                    'utf8'
                );
                
                console.log(`✅ Claude Code Helper hooks 已安装到: ${this.claudeSettingsPath}`);
                return true;
            } else {
                console.log('ℹ️ Claude Code Helper hooks 已经安装');
                return false;
            }

        } catch (error) {
            console.error('❌ 安装 hooks 失败:', error);
            vscode.window.showErrorMessage(`安装 Claude Code hooks 失败: ${error}`);
            return false;
        }
    }

    public async uninstallHooks(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.claudeSettingsPath)) {
                console.log('ℹ️ Claude 设置文件不存在');
                return false;
            }

            const content = fs.readFileSync(this.claudeSettingsPath, 'utf8');
            const settings: ClaudeSettings = JSON.parse(content);

            if (!settings.hooks) {
                console.log('ℹ️ 没有找到 hooks 配置');
                return false;
            }

            let removed = false;

            // 移除 PreToolUse hooks
            if (settings.hooks.PreToolUse) {
                const originalLength = settings.hooks.PreToolUse.length;
                settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(hook => 
                    !hook.hooks.some(h => h.command.includes('cchelper'))
                );
                if (settings.hooks.PreToolUse.length < originalLength) {
                    removed = true;
                }
            }

            // 移除 PostToolUse hooks
            if (settings.hooks.PostToolUse) {
                const originalLength = settings.hooks.PostToolUse.length;
                settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(hook => 
                    !hook.hooks.some(h => h.command.includes('cchelper'))
                );
                if (settings.hooks.PostToolUse.length < originalLength) {
                    removed = true;
                }
            }

            if (removed) {
                fs.writeFileSync(
                    this.claudeSettingsPath, 
                    JSON.stringify(settings, null, 2),
                    'utf8'
                );
                
                console.log(`✅ Claude Code Helper hooks 已从 ${this.claudeSettingsPath} 中移除`);
                return true;
            } else {
                console.log('ℹ️ 没有找到需要移除的 Claude Code Helper hooks');
                return false;
            }

        } catch (error) {
            console.error('❌ 卸载 hooks 失败:', error);
            vscode.window.showErrorMessage(`卸载 Claude Code hooks 失败: ${error}`);
            return false;
        }
    }

    public async checkHooksStatus(): Promise<{installed: boolean, path: string}> {
        try {
            if (!fs.existsSync(this.claudeSettingsPath)) {
                return { installed: false, path: this.claudeSettingsPath };
            }

            const content = fs.readFileSync(this.claudeSettingsPath, 'utf8');
            const settings: ClaudeSettings = JSON.parse(content);

            const hasHooks = settings.hooks && (
                (settings.hooks.PreToolUse && settings.hooks.PreToolUse.some(hook => 
                    hook.hooks.some(h => h.command.includes('cchelper'))
                )) ||
                (settings.hooks.PostToolUse && settings.hooks.PostToolUse.some(hook => 
                    hook.hooks.some(h => h.command.includes('cchelper'))
                ))
            );

            return { 
                installed: !!hasHooks, 
                path: this.claudeSettingsPath 
            };

        } catch (error) {
            console.error('检查 hooks 状态失败:', error);
            return { installed: false, path: this.claudeSettingsPath };
        }
    }

    public async checkSingleHookStatus(hookType: string): Promise<boolean> {
        try {
            if (!fs.existsSync(this.claudeSettingsPath)) {
                return false;
            }

            const content = fs.readFileSync(this.claudeSettingsPath, 'utf8');
            const settings: ClaudeSettings = JSON.parse(content);

            if (!settings.hooks) {
                return false;
            }

            if (hookType === 'fileTracking') {
                // 检查文件追踪相关的 PreToolUse hooks
                return settings.hooks.PreToolUse ? settings.hooks.PreToolUse.some(hook => 
                    hook.matcher === "Edit|MultiEdit|Write" && hook.hooks.some(h => h.command.includes('cchelper hook-open'))
                ) : false;
            } else if (hookType === 'toolSounds') {
                // 检查工具声音相关的 PreToolUse 和 PostToolUse hooks
                const hasPreToolUse = settings.hooks.PreToolUse ? settings.hooks.PreToolUse.some(hook => 
                    hook.matcher.includes('Read|Write|Edit') && hook.hooks.some(h => h.command.includes('cchelper play'))
                ) : false;
                const hasPostToolUse = settings.hooks.PostToolUse ? settings.hooks.PostToolUse.some(hook => 
                    hook.matcher.includes('Read|Write|Edit') && hook.hooks.some(h => h.command.includes('cchelper play'))
                ) : false;
                return hasPreToolUse && hasPostToolUse;
            }

            return false;

        } catch (error) {
            console.error(`检查 ${hookType} 状态失败:`, error);
            return false;
        }
    }

    public async installSingleHook(hookType: string, hooksConfig: any): Promise<boolean> {
        // 首先检查CLI是否可用
        const cliStatus = await CLIChecker.getCLIStatus();
        if (!cliStatus.available) {
            const message = `无法安装 ${hookType} hook：cchelper CLI 未安装或不可用\n错误：${cliStatus.error}\n\n请先安装 CLI 工具后再尝试安装 hooks。`;
            vscode.window.showErrorMessage(message, '安装 CLI').then(selection => {
                if (selection === '安装 CLI') {
                    vscode.commands.executeCommand('claude-code-helper.installCLI');
                }
            });
            return false;
        }

        // 验证hooks需要的CLI命令
        const commandValidation = await CLIChecker.validateHookCommands();
        if (!commandValidation.valid) {
            const message = `CLI工具缺少hooks所需的命令：${commandValidation.missingCommands.join(', ')}\n\n请重新安装或升级 CLI 工具。`;
            vscode.window.showErrorMessage(message, '重新安装 CLI').then(selection => {
                if (selection === '重新安装 CLI') {
                    vscode.commands.executeCommand('claude-code-helper.installCLI');
                }
            });
            return false;
        }

        try {
            // 确保 .claude 目录存在
            const claudeDir = path.dirname(this.claudeSettingsPath);
            if (!fs.existsSync(claudeDir)) {
                fs.mkdirSync(claudeDir, { recursive: true });
            }

            // 读取现有设置
            let settings: ClaudeSettings = {};
            if (fs.existsSync(this.claudeSettingsPath)) {
                try {
                    const content = fs.readFileSync(this.claudeSettingsPath, 'utf8');
                    settings = JSON.parse(content);
                } catch (error) {
                    console.log('创建新的 Claude 设置文件');
                }
            }

            // 初始化 hooks 对象
            if (!settings.hooks) {
                settings.hooks = {};
            }
            if (!settings.hooks.PreToolUse) {
                settings.hooks.PreToolUse = [];
            }
            if (!settings.hooks.PostToolUse) {
                settings.hooks.PostToolUse = [];
            }

            // 先移除同类型的现有 hooks
            this.removeSingleHookType(settings, hookType);

            let installed = false;

            // 根据 hookType 安装对应的 hook
            if (hookType === 'fileTracking' && hooksConfig.fileTracking) {
                settings.hooks.PreToolUse.push({
                    matcher: "Edit|MultiEdit|Write",
                    hooks: [
                        {
                            type: "command",
                            command: "cchelper hook-open"
                        }
                    ]
                });
                installed = true;
            } else if (hookType === 'toolSounds' && hooksConfig.toolSounds) {
                // 添加工具声音 Hooks  
                const startCommand = this.isWindows() 
                    ? 'cchelper play "%TOOL_NAME%" start'
                    : 'cchelper play "$TOOL_NAME" start';
                    
                settings.hooks.PreToolUse.push({
                    matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|LS|Bash|Task|WebFetch|WebSearch|TodoWrite|ExitPlanMode",
                    hooks: [
                        {
                            type: "command",
                            command: startCommand
                        }
                    ]
                });
                
                settings.hooks.PostToolUse.push({
                    matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|LS|Bash|Task|WebFetch|WebSearch|TodoWrite|ExitPlanMode",
                    hooks: [
                        {
                            type: "command", 
                            command: this.generateCrossPlatformCommand("$TOOL_ERROR", "$TOOL_NAME")
                        }
                    ]
                });
                installed = true;
            }

            // 保存设置
            if (installed) {
                fs.writeFileSync(
                    this.claudeSettingsPath, 
                    JSON.stringify(settings, null, 2),
                    'utf8'
                );
                
                console.log(`✅ ${hookType} hook 已安装到: ${this.claudeSettingsPath}`);
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ 安装单个 hook 失败:', error);
            return false;
        }
    }

    public async uninstallSingleHook(hookType: string): Promise<boolean> {
        try {
            if (!fs.existsSync(this.claudeSettingsPath)) {
                console.log('ℹ️ Claude 设置文件不存在');
                return false;
            }

            const content = fs.readFileSync(this.claudeSettingsPath, 'utf8');
            const settings: ClaudeSettings = JSON.parse(content);

            if (!settings.hooks) {
                console.log('ℹ️ 没有找到 hooks 配置');
                return false;
            }

            const removed = this.removeSingleHookType(settings, hookType);

            if (removed) {
                fs.writeFileSync(
                    this.claudeSettingsPath, 
                    JSON.stringify(settings, null, 2),
                    'utf8'
                );
                
                console.log(`✅ ${hookType} hook 已从 ${this.claudeSettingsPath} 中移除`);
                return true;
            } else {
                console.log(`ℹ️ 没有找到需要移除的 ${hookType} hook`);
                return false;
            }

        } catch (error) {
            console.error('❌ 卸载单个 hook 失败:', error);
            return false;
        }
    }

    private removeSingleHookType(settings: ClaudeSettings, hookType: string): boolean {
        if (!settings.hooks) {
            return false;
        }

        let removed = false;

        if (hookType === 'fileTracking') {
            // 移除文件追踪相关的 PreToolUse hooks
            if (settings.hooks.PreToolUse) {
                const originalLength = settings.hooks.PreToolUse.length;
                settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(hook => 
                    !(hook.matcher === "Edit|MultiEdit|Write" && hook.hooks.some(h => h.command.includes('cchelper hook-open')))
                );
                removed = settings.hooks.PreToolUse.length < originalLength;
            }
        } else if (hookType === 'toolSounds') {
            // 移除工具声音相关的 PreToolUse 和 PostToolUse hooks
            let removedPre = false, removedPost = false;
            
            if (settings.hooks.PreToolUse) {
                const originalLength = settings.hooks.PreToolUse.length;
                settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(hook => 
                    !(hook.matcher.includes('Read|Write|Edit') && hook.hooks.some(h => h.command.includes('cchelper play')))
                );
                removedPre = settings.hooks.PreToolUse.length < originalLength;
            }
            
            if (settings.hooks.PostToolUse) {
                const originalLength = settings.hooks.PostToolUse.length;
                settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(hook => 
                    !(hook.matcher.includes('Read|Write|Edit') && hook.hooks.some(h => h.command.includes('cchelper play')))
                );
                removedPost = settings.hooks.PostToolUse.length < originalLength;
            }
            
            removed = removedPre || removedPost;
        }

        return removed;
    }

    private getExistingHooksConfig(settings: ClaudeSettings): any {
        if (!settings.hooks) {
            return { fileTracking: false, toolSounds: false };
        }

        return {
            fileTracking: settings.hooks.PreToolUse ? settings.hooks.PreToolUse.some(hook => 
                hook.matcher === "Edit|MultiEdit|Write" && hook.hooks.some(h => h.command.includes('cchelper hook-open'))
            ) : false,
            toolSounds: (() => {
                const hasPreToolUse = settings.hooks.PreToolUse ? settings.hooks.PreToolUse.some(hook => 
                    hook.matcher.includes('Read|Write|Edit') && hook.hooks.some(h => h.command.includes('cchelper play'))
                ) : false;
                const hasPostToolUse = settings.hooks.PostToolUse ? settings.hooks.PostToolUse.some(hook => 
                    hook.matcher.includes('Read|Write|Edit') && hook.hooks.some(h => h.command.includes('cchelper play'))
                ) : false;
                return hasPreToolUse && hasPostToolUse;
            })()
        };
    }

    private removeExistingHooks(settings: ClaudeSettings): void {
        if (!settings.hooks) {
            return;
        }

        // 移除所有包含 cchelper 的 hooks
        ['PreToolUse', 'PostToolUse'].forEach(eventType => {
            if (settings.hooks![eventType]) {
                settings.hooks![eventType] = settings.hooks![eventType]!.filter(hook => 
                    !hook.hooks.some(h => h.command.includes('cchelper'))
                );
            }
        });
    }

    public async checkCLIStatus(): Promise<{
        available: boolean;
        version?: string;
        error?: string;
        commandsValid: boolean;
        missingCommands?: string[];
    }> {
        const cliStatus = await CLIChecker.getCLIStatus();
        
        if (!cliStatus.available) {
            return {
                available: false,
                error: cliStatus.error,
                commandsValid: false
            };
        }

        const commandValidation = await CLIChecker.validateHookCommands();
        
        return {
            available: true,
            version: cliStatus.version,
            commandsValid: commandValidation.valid,
            missingCommands: commandValidation.missingCommands
        };
    }
}