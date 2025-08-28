#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HookData {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: string;
    tool_name: string;
    tool_input: {
        file_path?: string;
        content?: string;
        command?: string;
        description?: string;
    };
    tool_response?: any;
}

class ClaudeCodeHelperCLI {
    private async openInVSCode(filePath: string): Promise<void> {
        try {
            await execAsync(`code "${filePath}"`);
            console.log(`✅ 已在 VSCode 中打开文件: ${filePath}`);
        } catch (error) {
            console.error(`❌ 打开文件失败: ${error}`);
        }
    }

    private async openInVSCodeWithLineNumber(filePath: string, line?: number): Promise<void> {
        try {
            const command = line ? `code -g "${filePath}:${line}"` : `code "${filePath}"`;
            await execAsync(command);
            console.log(`✅ 已在 VSCode 中打开文件: ${filePath}${line ? `:${line}` : ''}`);
        } catch (error) {
            console.error(`❌ 打开文件失败: ${error}`);
        }
    }

    private async revealInExplorer(filePath: string): Promise<void> {
        try {
            const platform = process.platform;
            let command: string;

            switch (platform) {
                case 'darwin':
                    command = `open -R "${filePath}"`;
                    break;
                case 'win32':
                    command = `explorer /select,"${filePath.replace(/\//g, '\\')}"`;
                    break;
                default:
                    command = `xdg-open "${path.dirname(filePath)}"`;
            }

            await execAsync(command);
            console.log(`✅ 已在文件管理器中显示: ${filePath}`);
        } catch (error) {
            console.error(`❌ 打开文件管理器失败: ${error}`);
        }
    }

    private async showFileInfo(filePath: string): Promise<void> {
        try {
            const stats = fs.statSync(filePath);
            const size = (stats.size / 1024).toFixed(2);
            const modified = stats.mtime.toLocaleString();
            
            console.log(`📄 文件信息:`);
            console.log(`   路径: ${filePath}`);
            console.log(`   大小: ${size} KB`);
            console.log(`   修改时间: ${modified}`);
            console.log(`   类型: ${stats.isDirectory() ? '目录' : '文件'}`);
        } catch (error) {
            console.error(`❌ 获取文件信息失败: ${error}`);
        }
    }

    private async processHookData(): Promise<void> {
        try {
            let input = '';
            
            // 从 stdin 读取 JSON 数据
            process.stdin.setEncoding('utf8');
            
            for await (const chunk of process.stdin) {
                input += chunk;
            }

            if (!input.trim()) {
                console.error('❌ 没有接收到输入数据');
                return;
            }

            const hookData: HookData = JSON.parse(input);
            
            console.log(`🔄 Hook 事件: ${hookData.hook_event_name}`);
            console.log(`🛠️  工具: ${hookData.tool_name}`);
            console.log(`📁 工作目录: ${hookData.cwd}`);

            if (hookData.tool_input.file_path) {
                console.log(`📝 文件路径: ${hookData.tool_input.file_path}`);
                
                // 检查文件是否存在
                if (fs.existsSync(hookData.tool_input.file_path)) {
                    await this.showFileInfo(hookData.tool_input.file_path);
                } else {
                    console.log(`⚠️  文件不存在: ${hookData.tool_input.file_path}`);
                }
            }

            if (hookData.tool_input.command) {
                console.log(`💻 命令: ${hookData.tool_input.command}`);
            }

        } catch (error) {
            console.error(`❌ 处理 Hook 数据失败: ${error}`);
        }
    }

    private async processHookDataAndOpen(): Promise<void> {
        try {
            let input = '';
            
            // 从 stdin 读取 JSON 数据
            process.stdin.setEncoding('utf8');
            
            for await (const chunk of process.stdin) {
                input += chunk;
            }

            if (!input.trim()) {
                console.error('❌ 没有接收到输入数据');
                return;
            }

            const hookData: HookData = JSON.parse(input);
            
            // 发送 hook 数据给 VSCode 插件
            await this.sendToVSCodePlugin(hookData);

        } catch (error) {
            console.error(`❌ 处理 Hook 数据并发送给插件失败: ${error}`);
        }
    }

    private async sendToVSCodePlugin(hookData: HookData): Promise<void> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(hookData);
            
            const options = {
                hostname: 'localhost',
                port: 3456,
                path: '/hook',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = http.request(options, (res) => {
                let responseBody = '';
                
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(responseBody);
                            if (response.action === 'file_opened') {
                                console.log(`✅ 已通知 VSCode 打开文件: ${response.file}`);
                            } else {
                                console.log(`ℹ️  消息已发送给 VSCode 插件`);
                            }
                            resolve();
                        } else {
                            console.error(`❌ VSCode 插件响应错误: HTTP ${res.statusCode}`);
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    } catch (parseError) {
                        console.error(`❌ 解析插件响应失败: ${parseError}`);
                        reject(parseError);
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`❌ 连接 VSCode 插件失败: ${error.message}`);
                console.log('💡 请确保 VSCode 中已启动 Claude Code Helper 插件');
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    private async testVSCodeConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3456,
                path: '/status',
                method: 'GET'
            };

            const req = http.request(options, (res) => {
                let responseBody = '';
                
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(responseBody);
                            console.log(`✅ VSCode 插件连接成功!`);
                            console.log(`   服务: ${response.service}`);
                            console.log(`   端口: ${response.port}`);
                            console.log(`   状态: ${response.status}`);
                            console.log(`   时间: ${response.timestamp}`);
                            resolve();
                        } else {
                            console.error(`❌ VSCode 插件响应错误: HTTP ${res.statusCode}`);
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    } catch (parseError) {
                        console.error(`❌ 解析插件响应失败: ${parseError}`);
                        reject(parseError);
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`❌ 连接 VSCode 插件失败: ${error.message}`);
                console.log('💡 请确保 VSCode 中已启动 Claude Code Helper 插件');
                reject(error);
            });

            req.end();
        });
    }

    private getSoundConfigForTool(toolName: string, status: string): string {
        // 工具声音映射表
        const TOOL_SOUND_MAP: {[key: string]: {[key: string]: string}} = {
            "Read": {"start": "file_open", "success": "file_open", "error": "error"},
            "Write": {"start": "file_create", "success": "file_create", "error": "build_error"},
            "Edit": {"start": "item_small", "success": "item_small", "error": "error"},
            "MultiEdit": {"start": "achievement", "success": "achievement", "error": "build_error"},
            "NotebookEdit": {"start": "puzzle_solved", "success": "puzzle_solved", "error": "error"},
            "Grep": {"start": "search_found", "success": "search_found", "no_results": "search_complete", "error": "error"},
            "Glob": {"start": "search_found", "success": "search_found", "error": "error"},
            "LS": {"start": "menu_select", "success": "menu_select", "error": "error"},
            "Bash": {"start": "item_small", "success": "success", "error": "damage"},
            "Task": {"start": "session_start", "success": "shrine_complete", "error": "game_over"},
            "WebFetch": {"start": "search_found", "success": "search_found", "error": "error"},
            "WebSearch": {"start": "search_complete", "success": "search_complete", "error": "error"},
            "TodoWrite": {"start": "todo_complete", "success": "todo_complete", "completed": "heart_get", "all_complete": "achievement"},
            "ExitPlanMode": {"start": "menu_select", "success": "menu_select"}
        };

        // Hook事件声音映射
        const HOOK_EVENT_SOUNDS: {[key: string]: string} = {
            "SubagentStop": "shrine_complete",
            "SessionStart": "session_start",
            "PreCompact": "menu_select"
        };

        // 兼容旧命令的映射
        const LEGACY_COMMANDS: {[key: string]: string} = {
            "auth": "warning",
            "complete": "session_night",
            "Notification": "warning", 
            "Stop": "session_night"
        };

        // 如果是Hook事件
        if (HOOK_EVENT_SOUNDS[toolName]) {
            return HOOK_EVENT_SOUNDS[toolName];
        }

        // 如果是工具事件
        if (TOOL_SOUND_MAP[toolName] && TOOL_SOUND_MAP[toolName][status]) {
            return TOOL_SOUND_MAP[toolName][status];
        }

        // 兼容旧命令
        if (LEGACY_COMMANDS[toolName]) {
            return LEGACY_COMMANDS[toolName];
        }

        // 默认返回warning
        return 'warning';
    }

    private getAvailableAudioFiles(): string[] {
        try {
            const soundsDir = path.join(__dirname, '..', 'assets', 'sounds');
            
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
            
            return audioFiles.map(file => path.parse(file).name.toLowerCase());
            
        } catch (error) {
            console.error('读取音频目录失败:', error);
            return [];
        }
    }

    private buildAudioFileMapping(): {[key: string]: string} {
        const audioFiles = this.getAvailableAudioFiles();
        const mapping: {[key: string]: string} = {};
        
        // 为每个音频文件生成完整路径
        for (const fileName of audioFiles) {
            // 尝试不同的扩展名
            const extensions = ['.wav', '.mp3', '.ogg', '.m4a'];
            for (const ext of extensions) {
                const fullPath = path.join(__dirname, '..', 'assets', 'sounds', fileName + ext);
                if (fs.existsSync(fullPath)) {
                    mapping[fileName] = fullPath;
                    break;
                }
            }
        }
        
        return mapping;
    }

    private async playNotificationSound(toolName: string = 'default', status: string = 'success'): Promise<void> {
        try {
            // 获取工具对应的声音配置
            const soundConfig = this.getSoundConfigForTool(toolName, status);
            
            // 构建动态音频文件映射
            const audioFileMapping = this.buildAudioFileMapping();
            
            const platform = process.platform;
            let command: string;

            switch (platform) {
                case 'darwin':
                    // macOS - 优先使用自定义音频文件，回退到系统声音
                    const macAudioFile = audioFileMapping[soundConfig.toLowerCase()];
                    if (macAudioFile && fs.existsSync(macAudioFile)) {
                        command = `afplay "${macAudioFile}"`;
                    } else {
                        // 回退到系统声音
                        const systemSounds: {[key: string]: string} = {
                            'xm3808': '/System/Library/Sounds/Glass.aiff',
                            'xm3812': '/System/Library/Sounds/Ping.aiff',
                            'default': '/System/Library/Sounds/Glass.aiff'
                        };
                        const systemSound = systemSounds[soundConfig.toLowerCase()] || systemSounds['default'];
                        command = `afplay "${systemSound}"`;
                    }
                    break;
                case 'win32':
                    // Windows - 优先尝试播放自定义音频文件，回退到系统声音
                    const winAudioFile = audioFileMapping[soundConfig.toLowerCase()];
                    if (winAudioFile && fs.existsSync(winAudioFile)) {
                        // 尝试使用 PowerShell 播放音频文件
                        command = `powershell -c "(New-Object Media.SoundPlayer '${winAudioFile.replace(/'/g, "''")}').PlaySync();"`;
                    } else {
                        // 回退到系统提示音
                        const winSounds: {[key: string]: string} = {
                            'xm3808': 'Asterisk',
                            'xm3812': 'Exclamation',
                            'default': 'Asterisk'
                        };
                        const winSound = winSounds[soundConfig.toLowerCase()] || winSounds['default'];
                        
                        if (winSound === 'Exclamation') {
                            command = `rundll32 user32.dll,MessageBeep 0x00000030`;  // MB_ICONEXCLAMATION
                        } else {
                            command = `rundll32 user32.dll,MessageBeep 0x00000040`;  // MB_ICONASTERISK (默认)
                        }
                    }
                    break;
                default:
                    // Linux - 优先使用自定义音频文件，回退到系统声音
                    const linuxAudioFile = audioFileMapping[soundConfig.toLowerCase()];
                    if (linuxAudioFile && fs.existsSync(linuxAudioFile)) {
                        command = `paplay "${linuxAudioFile}" || aplay "${linuxAudioFile}"`;
                    } else {
                        // 回退到系统声音
                        const linuxSounds: {[key: string]: string} = {
                            'xm3808': '/usr/share/sounds/alsa/Front_Left.wav',
                            'xm3812': '/usr/share/sounds/alsa/Front_Right.wav',
                            'default': '/usr/share/sounds/alsa/Front_Left.wav'
                        };
                        const linuxSound = linuxSounds[soundConfig.toLowerCase()] || linuxSounds['default'];
                        command = `paplay "${linuxSound}" || aplay "${linuxSound}" || echo "🔊 ${toolName}:${status} 通知音播放 (音频文件未找到)"`;
                    }
            }

            await execAsync(command);
            console.log(`🔊 ${toolName}:${status} (${soundConfig}) 通知音播放完成`);
        } catch (error) {
            console.log(`🔇 ${toolName}:${status} 通知音播放失败，静默处理`);
        }
    }

    public async run(): Promise<void> {
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'hook':
                await this.processHookData();
                break;

            case 'hook-open':
                await this.processHookDataAndOpen();
                break;

            case 'test-connection':
                await this.testVSCodeConnection();
                break;

            case 'play':
                const toolName = args[1] || 'default';
                const status = args[2] || 'success';
                await this.playNotificationSound(toolName, status);
                break;

            case 'open':
                if (args[1]) {
                    const filePath = args[1];
                    const line = args[2] ? parseInt(args[2]) : undefined;
                    await this.openInVSCodeWithLineNumber(filePath, line);
                } else {
                    console.error('❌ 请提供文件路径');
                }
                break;

            case 'reveal':
                if (args[1]) {
                    await this.revealInExplorer(args[1]);
                } else {
                    console.error('❌ 请提供文件路径');
                }
                break;

            case 'info':
                if (args[1]) {
                    await this.showFileInfo(args[1]);
                } else {
                    console.error('❌ 请提供文件路径');
                }
                break;

            case 'help':
            default:
                this.showHelp();
                break;
        }
    }

    private showHelp(): void {
        console.log(`
Claude Code Helper CLI

用法:
  cchelper hook                    - 处理来自 Claude Code hooks 的 JSON 数据 (从 stdin)
  cchelper open <file> [line]      - 在 VSCode 中打开文件（可选行号）
  cchelper reveal <file>           - 在文件管理器中显示文件
  cchelper info <file>             - 显示文件信息
  cchelper play <tool> [status]    - 播放通知音 (如: cchelper play Read success)
  cchelper help                    - 显示帮助信息

Claude Code Hooks 配置示例:

在 ~/.claude/settings.json 或 .claude/settings.json 中添加:

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper hook"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cchelper hook && jq -r '.tool_input.file_path' | xargs cchelper open"
          }
        ]
      }
    ]
  }
}
        `);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    const cli = new ClaudeCodeHelperCLI();
    cli.run().catch(error => {
        console.error('CLI 执行失败:', error);
        process.exit(1);
    });
}

export { ClaudeCodeHelperCLI };