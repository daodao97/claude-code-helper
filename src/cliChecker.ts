import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CLIChecker {
    /**
     * 检查cchelper CLI是否已安装并可用
     */
    public static async isCLIAvailable(): Promise<boolean> {
        try {
            await execAsync('cchelper help');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查cchelper CLI版本
     */
    public static async getCLIVersion(): Promise<string | null> {
        try {
            const { stdout } = await execAsync('cchelper --version');
            return stdout.trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取CLI状态信息
     */
    public static async getCLIStatus(): Promise<{
        available: boolean;
        version?: string;
        error?: string;
    }> {
        try {
            const available = await this.isCLIAvailable();
            if (available) {
                const version = await this.getCLIVersion();
                return {
                    available: true,
                    version: version || 'unknown'
                };
            } else {
                return {
                    available: false,
                    error: 'cchelper command not found in PATH'
                };
            }
        } catch (error) {
            return {
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * 验证特定的cchelper命令是否可用
     */
    public static async validateCommand(command: string): Promise<boolean> {
        try {
            // 对于某些命令，我们只需要检查它们是否在帮助信息中存在
            if (command === 'play') {
                // play命令需要参数，我们检查help输出
                const { stdout } = await execAsync('cchelper help');
                return stdout.includes('play') || stdout.includes('播放通知音');
            } else if (command === 'hook-open' || command === 'hook') {
                // hook相关命令检查
                const { stdout } = await execAsync('cchelper help');
                return stdout.includes('hook') || stdout.includes('处理来自 Claude Code hooks');
            }
            
            // 对于其他命令，尝试执行并检查错误
            await execAsync(`cchelper ${command} --help`);
            return true;
        } catch (error) {
            // 如果是因为参数问题导致的错误，而不是命令不存在，那么命令是可用的
            if (error instanceof Error) {
                const errorMsg = error.message.toLowerCase();
                return !errorMsg.includes('unknown command') && 
                       !errorMsg.includes('not found') && 
                       !errorMsg.includes('command not found');
            }
            return false;
        }
    }

    /**
     * 检查所有hooks需要的CLI命令是否可用
     */
    public static async validateHookCommands(): Promise<{
        valid: boolean;
        missingCommands: string[];
    }> {
        const requiredCommands = ['play', 'hook-open', 'hook'];
        const missingCommands: string[] = [];

        for (const command of requiredCommands) {
            const isValid = await this.validateCommand(command);
            if (!isValid) {
                missingCommands.push(command);
            }
        }

        return {
            valid: missingCommands.length === 0,
            missingCommands
        };
    }
}