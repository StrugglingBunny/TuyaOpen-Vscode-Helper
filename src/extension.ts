import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

async function generateCppProperties(sdkPath: string) {
    if (!sdkPath || !fs.existsSync(sdkPath)) {
        vscode.window.showErrorMessage(`SDK path doesn't exist: ${sdkPath}`);
        return;
    }

    // 获取 SDK 目录名作为 name
    const sdkName = path.basename(sdkPath);

    // VSCode 工作区根目录
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('❌ Can not find  workspaceFolder,can not create c_cpp_properties.json');
        return;
    }

    const cppPropsPath = path.join(workspaceFolder, '.vscode', 'c_cpp_properties.json');

    // 确保 .vscode 目录存在
    const vscodeDir = path.dirname(cppPropsPath);
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const cppConfig = {
        configurations: [
            {
                name: sdkName,
                includePath: [
                    `${sdkPath}/platform/**`,
                    `${sdkPath}/src/**`,
                    `${workspaceFolder}/**`
                ],
                browse: {
                    path: [
                        `${sdkPath}/platform`,
                        `${sdkPath}/src`,
                        `${workspaceFolder}`
                    ],
                    limitSymbolsToIncludedHeaders: true
                },
                cStandard: "c11",
                cppStandard: "c++17"
            }
        ],
        version: 4
    };

    // 写入 JSON 文件
    fs.writeFileSync(cppPropsPath, JSON.stringify(cppConfig, null, 4), { encoding: 'utf8' });

    vscode.window.showInformationMessage(`✅ 已生成 c_cpp_properties.json，name=${sdkName}`);
}

function getConfig<T>(key: string, defaultValue: T): T {
    const cfg = vscode.workspace.getConfiguration();
    const v = cfg.get<T>(key);
    return typeof v === 'undefined' ? defaultValue : v;
}

function updateConfig(key: string, value: any) {
    vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Workspace);
}

// 根据操作系统自动选择 export 脚本
function getExportScript(): string {
    return process.platform === 'win32' ? '.\\export.bat' : './export.sh';
}

// 生成实际命令
function makeCommandLine(projectPath: string, tosSubCmd: string, includeEnv: boolean = true): string {
    const exportScript = getExportScript();

    if (process.platform === 'win32') {
       
        if (includeEnv) {
            return `cmd /c "cd /d "${projectPath}" && ${exportScript} && ${tosSubCmd}"`;
        } else {
            return `cmd /c "cd /d "${projectPath}" && ${tosSubCmd}"`;
        }
    } else {
        // Linux/macOS/WSL
        if (includeEnv) {
            return `bash -lc 'cd "${projectPath}" && . ${exportScript} && ${tosSubCmd}'`;
        } else {
            return `bash -lc 'cd "${projectPath}" && ${tosSubCmd}'`;
        }
    }
}

export function activate(context: vscode.ExtensionContext) {

    let sharedTerminal: vscode.Terminal | undefined;
    let isEnvActivated = false;
    let project_currentDir: string | undefined;

    console.log('TuyaOpen-helper activated');

    const terminalName = getConfig<string>('TuyaOpenHelper.terminalName', 'Smart Build');

    function getTerminal(): vscode.Terminal {
        if (!sharedTerminal) {
            sharedTerminal = vscode.window.createTerminal(terminalName);
            const disposable = vscode.window.onDidCloseTerminal(t => {
                if (t.name === terminalName) {
                    sharedTerminal = undefined;
                    isEnvActivated = false; // 关闭终端后重置激活状态
                    disposable.dispose();
                }
            });
        }
        return sharedTerminal;
    }

    // 获取 SDK 根目录，如果未设置则弹出输入框
    async function getProjectPath(): Promise<string | undefined> {
        let projectPath = getConfig<string>('TuyaOpenHelper.projectPath', '');
        if (!projectPath) {
            const inputPath = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                prompt: '请输入 SDK 根目录路径',
                placeHolder: process.platform === 'win32' ? 'Please input your SDK path' : '/home/user/sdk',
            });

            if (!inputPath) {
                vscode.window.showErrorMessage('❌ SDK path error,ignore command');
                return undefined;
            }
            projectPath = inputPath;

            if (!fs.existsSync(projectPath)) {
                vscode.window.showErrorMessage(`❌ SDK path doesn't exist: ${projectPath}`);
                return undefined;
            }

            updateConfig('TuyaOpenHelper.projectPath', projectPath);
            vscode.window.showInformationMessage(`✅ Set SDK path: ${projectPath}`);
        }
        return projectPath;
    }

    async function runTosCommand(tosSubCmd: string, keepTerminalVisible: boolean = true) {
        const currentDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const projectPath = await getProjectPath();
        if (!projectPath) return;

        const includeEnv = !isEnvActivated; // 如果环境没激活就包含 export
        if (includeEnv) isEnvActivated = true; // 激活标记
        if (includeEnv == false) {


            const term = getTerminal();
            term.show(true);


            if (currentDir != project_currentDir) {
                const new_cmd = ` cd /d "${currentDir}"`;

                term.sendText(new_cmd, true);

             
            }

            const tosCmd = process.platform === 'win32' ? `${tosSubCmd}` : `bash -lc '${tosSubCmd}'`;
             term.sendText(tosCmd, true);

         
            return;
        }

        if (!project_currentDir) {
            project_currentDir = projectPath;
        }

        const cmd = makeCommandLine(projectPath, tosSubCmd, includeEnv);
        const term = getTerminal();
        term.show(true);
        term.sendText(cmd, true);
        generateCppProperties(projectPath);





    }

    // 注册命令
    const commands = [
        { id: 'TuyaOpenHelper.runEnv', cmd: 'echo "Environment activated"' },
        { id: 'TuyaOpenHelper.configChoice', cmd: 'tos.py config choice' },
        { id: 'TuyaOpenHelper.build', cmd: 'tos.py build' },
        { id: 'TuyaOpenHelper.flash', cmd: 'tos.py flash' },
        { id: 'TuyaOpenHelper.clean', cmd: 'tos.py clean' },
        { id: 'TuyaOpenHelper.monitor', cmd: 'tos.py monitor', keepTerminal: true },
        { id: 'TuyaOpenHelper.menuconfig', cmd: 'tos.py config menu', keepTerminal: true }
    ];

    commands.forEach(c => {
        context.subscriptions.push(vscode.commands.registerCommand(c.id, () => runTosCommand(c.cmd, c.keepTerminal)));
    });

    // 创建状态栏按钮
    const items: { cmd: string; text: string; tooltip: string; priority?: number }[] = [
        { cmd: 'TuyaOpenHelper.runEnv', text: '$(plug) Env', tooltip: '激活环境', priority: 100 },
        { cmd: 'TuyaOpenHelper.build', text: '$(check) Build', tooltip: '一键 build', priority: 99 },
        { cmd: 'TuyaOpenHelper.configChoice', text: '$(gear) BoardConfig', tooltip: 'config choice', priority: 98 },
        { cmd: 'TuyaOpenHelper.menuconfig', text: '$(settings-gear) MenuCfg', tooltip: 'menuconfig', priority: 97 },
        { cmd: 'TuyaOpenHelper.flash', text: '$(rocket) Flash', tooltip: 'flash', priority: 96 },
        { cmd: 'TuyaOpenHelper.monitor', text: '$(terminal) Monitor', tooltip: 'monitor', priority: 95 },
        { cmd: 'TuyaOpenHelper.clean', text: '$(trash) clean', tooltip: 'clean', priority: 94 }
    ];

    items.forEach(it => {
        const sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, it.priority);
        sb.command = it.cmd;
        sb.text = it.text;
        sb.tooltip = it.tooltip;
        sb.show();
        context.subscriptions.push(sb);
    });
}

export function deactivate() { }
