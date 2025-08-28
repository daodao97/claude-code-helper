import * as http from 'http';
import * as vscode from 'vscode';
import * as url from 'url';
import * as path from 'path';

interface HookMessage {
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

export class HttpServer {
    private server?: http.Server;
    private readonly port: number = 3456;
    
    constructor() {}

    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on('error', (error: any) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`端口 ${this.port} 已被占用，Claude Code Helper HTTP 服务器无法启动`);
                } else {
                    console.error('HTTP 服务器错误:', error);
                }
                reject(error);
            });

            this.server.listen(this.port, 'localhost', () => {
                console.log(`✅ Claude Code Helper HTTP 服务器已启动，端口: ${this.port}`);
                resolve();
            });
        });
    }

    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = undefined;
            console.log('🔴 Claude Code Helper HTTP 服务器已停止');
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname;

        if (req.method === 'POST' && pathname === '/hook') {
            await this.handleHookMessage(req, res);
        } else if (req.method === 'GET' && pathname === '/status') {
            this.handleStatusRequest(req, res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }

    private async handleHookMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            let body = '';
            
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const hookData: HookMessage = JSON.parse(body);
                    
                    console.log(`📥 收到 Hook 消息: ${hookData.tool_name} - ${hookData.hook_event_name}`);
                    
                    // 处理文件编辑相关的 hook
                    if (hookData.tool_input.file_path && 
                        (hookData.tool_name === 'Edit' || hookData.tool_name === 'MultiEdit' || hookData.tool_name === 'Write')) {
                        
                        await this.openFileInVSCode(hookData.tool_input.file_path);
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            action: 'file_opened', 
                            file: hookData.tool_input.file_path 
                        }));
                    } else {
                        // 其他类型的 hook，仅记录
                        console.log(`ℹ️  Hook 信息 - 工具: ${hookData.tool_name}, 事件: ${hookData.hook_event_name}`);
                        if (hookData.tool_input.command) {
                            console.log(`💻 命令: ${hookData.tool_input.command}`);
                        }
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, action: 'logged' }));
                    }
                    
                } catch (parseError) {
                    console.error('解析 Hook 数据失败:', parseError);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });

        } catch (error) {
            console.error('处理 Hook 消息失败:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    private handleStatusRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'running', 
            service: 'Claude Code Helper',
            port: this.port,
            timestamp: new Date().toISOString()
        }));
    }

    private async openFileInVSCode(filePath: string): Promise<void> {
        try {
            // 检查是否为当前工作区的文件
            const isWorkspaceFile = this.isFileInCurrentWorkspace(filePath);
            
            if (!isWorkspaceFile) {
                console.log(`ℹ️  文件不在当前工作区，跳过打开: ${filePath}`);
                return;
            }

            // 在 VSCode 中打开文件
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document, {
                viewColumn: vscode.ViewColumn.Active,
                preserveFocus: false
            });
            
            console.log(`✅ 已在当前窗口打开工作区文件: ${filePath}`);
            
            // 显示通知
            const fileName = filePath.split('/').pop();
            vscode.window.showInformationMessage(`📂 Claude Code 编辑文件: ${fileName}`);
            
        } catch (error) {
            console.error(`❌ 打开文件失败: ${filePath}`, error);
            vscode.window.showErrorMessage(`打开文件失败: ${filePath}`);
        }
    }

    private isFileInCurrentWorkspace(filePath: string): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('ℹ️  没有打开的工作区，跳过文件打开');
            // 如果没有工作区，不打开文件
            return false;
        }

        // 检查文件是否在任何工作区文件夹中
        for (const folder of workspaceFolders) {
            const workspacePath = folder.uri.fsPath;
            
            // 规范化路径进行比较
            const normalizedFilePath = this.normalizePath(filePath);
            const normalizedWorkspacePath = this.normalizePath(workspacePath);
            
            console.log(`🔍 检查文件: ${normalizedFilePath}`);
            console.log(`🔍 工作区: ${normalizedWorkspacePath}`);
            
            // 检查文件是否在工作区内（包括子目录）
            if (normalizedFilePath.startsWith(normalizedWorkspacePath + '/') || 
                normalizedFilePath === normalizedWorkspacePath) {
                console.log(`✅ 文件在工作区 '${folder.name}' 中`);
                return true;
            }
        }

        console.log(`⚠️  文件不在当前工作区中，跳过打开`);
        
        return false;
    }

    private normalizePath(filePath: string): string {
        // 移除末尾的斜杠，统一路径格式，并解析为绝对路径
        try {
            // 如果是相对路径，转换为绝对路径
            const absolutePath = path.resolve(filePath);
            // 统一使用正斜杠
            return absolutePath.replace(/\\/g, '/');
        } catch (error) {
            // 如果路径解析失败，使用原路径
            return filePath.replace(/\/$/, '').replace(/\\/g, '/');
        }
    }

    public getPort(): number {
        return this.port;
    }
}