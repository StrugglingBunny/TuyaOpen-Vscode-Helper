import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SerialPort } from 'serialport';

let serialStatusBar: vscode.StatusBarItem;
let boardConfigItemBar: vscode.StatusBarItem;
let _isMonitor_on = false;


function updateSerialStatusBar(port?: string) {
    if (!serialStatusBar) return;
    serialStatusBar.text = port ? `$(plug) ${port}` : '$(plug) Serial';
    serialStatusBar.tooltip = port ? `Selected serial port: ${port}` : 'Select serial port';
}
function updateboardConfigItemBar(board?: string) {
    if (!boardConfigItemBar) return;
    boardConfigItemBar.text = board ? `$(circuit-board) ${board}` : '$(circuit-board) Board';
    boardConfigItemBar.tooltip = board ? `Selected${board}` : 'Config platform';
}
function getPlatformFromConfig(workspaceFolder: string): string | undefined {
    const configPath = path.join(workspaceFolder, 'app_default.config');
    if (!fs.existsSync(configPath)) return undefined;

    const content = fs.readFileSync(configPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    //  CONFIG_BOARD_CHOICE_xxx=y
    const boardChoices = lines
        .map(line => {
            const match = line.match(/^CONFIG_BOARD_CHOICE_(.+?)=y$/);
            return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

    if (boardChoices.length === 0) return undefined;

    let platformName = boardChoices[0];
    if (boardChoices.length > 1) {
        const esp = boardChoices.find(b => b.includes('_'));
        if (esp) platformName = esp;
        else platformName = boardChoices[boardChoices.length - 1]; // 备用
    }

    return `platform:${platformName}`;
}

async function selectSerialPort(force = false) {
    const config = vscode.workspace.getConfiguration('TuyaOpenHelper');
    const savedPort = config.get<string>('serialPort');

    if (savedPort && !force) {
        updateSerialStatusBar(savedPort);
        return savedPort;
    }

    try {
        const ports = await SerialPort.list();
        if (!ports || ports.length === 0) {
            vscode.window.showWarningMessage('No serial ports found.');
            return;
        }

        const items = ports.map(p => ({
            label: p.path,
            description: p.manufacturer || ''
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select serial port',
            canPickMany: false
        });

        if (!selected) return;

        await config.update('serialPort', selected.label, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Serial port saved: ${selected.label}`);
        updateSerialStatusBar(selected.label);
        return selected.label;
    } catch (err) {
        vscode.window.showErrorMessage(`Error listing serial ports: ${err}`);
    }
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
    if (fs.existsSync(cppPropsPath)) {
        // vscode.window.showInformationMessage('ℹ️ c_cpp_properties.json already exists. Skipped generation.');
        return;
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

    vscode.window.showInformationMessage(`✅ Generated c_cpp_properties.json,name=${sdkName}`);
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
                    isEnvActivated = false;
                    disposable.dispose();
                }
            });
        }
        return sharedTerminal;
    }

    // 获取 SDK 根目录，如果未设置则弹出输入框
    async function getTuyaOpenSDKPath(): Promise<string | undefined> {
        let tuyaOpenSDKPath = getConfig<string>('TuyaOpenHelper.tuyaOpenSDKPath', '');
        if (!tuyaOpenSDKPath) {
            const inputPath = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                prompt: 'Please input your SDK path',
                placeHolder: process.platform === 'win32' ? 'Please input your SDK path' : '/home/user/sdk',
            });

            if (!inputPath) {
                vscode.window.showErrorMessage('❌ SDK path error,ignore command');
                return undefined;
            }
            tuyaOpenSDKPath = inputPath;

            if (!fs.existsSync(tuyaOpenSDKPath)) {
                vscode.window.showErrorMessage(`❌ SDK path doesn't exist: ${tuyaOpenSDKPath}`);
                return undefined;
            }

            updateConfig('TuyaOpenHelper.tuyaOpenSDKPath', tuyaOpenSDKPath);
            vscode.window.showInformationMessage(`✅ Set SDK path: ${tuyaOpenSDKPath}`);
        }
        return tuyaOpenSDKPath;
    }
    async function selectBoard() {
        const sdkPath = await getTuyaOpenSDKPath();
        if (!sdkPath) return;


        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return;

        const appDefaultPath = path.join(workspaceFolder, 'app_default.config');

        let currentContent = '';
        if (fs.existsSync(appDefaultPath)) {
            currentContent = fs.readFileSync(appDefaultPath, 'utf-8');
        }



        const boardsDir = path.join(sdkPath, 'boards');
        const boardFolders = fs.readdirSync(boardsDir, { withFileTypes: true })
            .filter(f => f.isDirectory())
            .map(f => f.name);

        // 构建 QuickPick 列表
        const boardItems: vscode.QuickPickItem[] = [];
        for (const board of boardFolders) {
            const configDir = path.join(boardsDir, board, 'config');
            if (!fs.existsSync(configDir)) continue;

            const configFiles = fs.readdirSync(configDir)
                .filter(f => f.endsWith('.config'));

            for (const cfg of configFiles) {
                boardItems.push({
                    label: `${board} -> ${cfg}`,
                    description: path.join(configDir, cfg)
                });
            }
        }

        const choice = await vscode.window.showQuickPick(boardItems, {
            placeHolder: 'Select board platform'
        });

        if (!choice) return;
        const selectedConfigPath = choice.description!;
        const newContent = fs.readFileSync(selectedConfigPath, 'utf-8');

        // Need to change the configuration
        if (currentContent !== newContent) {

            const destConfig = path.join(workspaceFolder, 'app_default.config');
            // Update the status bar
            fs.copyFileSync(choice.description!, destConfig);
            const buildPath = path.join(workspaceFolder, '.build');
            if (fs.existsSync(buildPath)) {
                try {
                    fs.rmSync(buildPath, { recursive: true, force: true });
                    console.log(`[INFO]: Removed build folder: ${buildPath}`);
                } catch (err) {
                    console.error('[ERROR]: Failed to remove .build folder:', err);
                }
            }
            updateboardConfigItemBar(`Platform: ${choice.label.split(' -> ')[1].replace('.config', '')}`)
            setTimeout(() => {
                //Full clean
                runTosCommand('tos.py clean');
            }, 500);

        }
    }



    async function runTosCommand(tosSubCmd: string, keepTerminalVisible: boolean = true) {
        const currentDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const tuyaOpenSDKPath = await getTuyaOpenSDKPath();
        if (!tuyaOpenSDKPath) return;
        //Set serial ports
        if (tosSubCmd === 'TuyaOpenHelper.setSerialPort') {
            vscode.window.showInformationMessage(`runTosCommand: ${tosSubCmd}`);
            await selectSerialPort(true);
            return;
        }
        const includeEnv = !isEnvActivated; // 如果环境没激活就包含 export
        if (includeEnv) isEnvActivated = true; // 激活标记
        if (includeEnv == false) {
            const term = getTerminal();
            term.show(true);
            if (currentDir != project_currentDir) {
                const new_cmd = process.platform === 'win32'
                    ? `cd /d "${currentDir}"`
                    : `cd "${currentDir}"`;
                term.sendText(new_cmd, true);
                await delay(10);
            }

               // Exit the monitor terminal
            if (_isMonitor_on == true) {
                //turn off the monitor 
                term.sendText('\x03', false); // Ctrl+C
                await delay(300);
                term.sendText('\r', false); // send enter
                await delay(300);
                _isMonitor_on = false;

            } else {
                if (/monitor/.test(tosSubCmd))//User try to turn on the monitor
                {
                    _isMonitor_on = true;
                }
            }

            let tosCmd = process.platform === 'win32' ? `${tosSubCmd}` : `${tosSubCmd}`;
            if (/flash|monitor/.test(tosSubCmd)) {
                const port = await selectSerialPort();
                if (port) {
                    tosCmd = tosCmd + ` --port ${port}`;
                }

            } else if (/config choice/.test(tosSubCmd)) {
                await selectBoard();
                return;
            }
            term.sendText(tosCmd, true);
            return;
        }
        // Activate the TuyaOpen environment
        if (!project_currentDir) {
            project_currentDir = tuyaOpenSDKPath;
        }
        const exportScript = getExportScript();
        const term = getTerminal();
        term.show(true);
        if (process.platform === 'win32') {
            const _cmd = `cmd /c "cd /d "${tuyaOpenSDKPath}" && ${exportScript} && ${tosSubCmd}"`;
            term.sendText(_cmd, true);
        } else {
            term.sendText(`cd "${tuyaOpenSDKPath}"`, true);
            await delay(10);
            term.sendText(`. ${exportScript}`, true);
            term.sendText(tosSubCmd, true);

        }
        generateCppProperties(tuyaOpenSDKPath);
    }

    // 注册命令
    const commands = [
        { id: 'TuyaOpenHelper.runEnv', cmd: 'echo "Environment activated"' },
        { id: 'TuyaOpenHelper.setSerialPort', cmd: 'TuyaOpenHelper.setSerialPort' },
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
    const items: { cmd: string; text: string; tooltip: string; priority?: number }[] = [
        { cmd: 'TuyaOpenHelper.runEnv', text: '$(tools) Env', tooltip: 'Activate the tos environment', priority: 100 },
        { cmd: 'TuyaOpenHelper.setSerialPort', text: '$(plug) Serial', tooltip: 'Select serial port', priority: 99 },
        { cmd: 'TuyaOpenHelper.configChoice', text: '$(circuit-board) BoardConfig', tooltip: 'config choice', priority: 98 },
        { cmd: 'TuyaOpenHelper.menuconfig', text: '$(settings-gear) MenuCfg', tooltip: 'menuconfig', priority: 97 },
        { cmd: 'TuyaOpenHelper.build', text: '$(check) Build', tooltip: 'Build the project', priority: 96 },
        { cmd: 'TuyaOpenHelper.flash', text: '$(rocket) Flash', tooltip: 'flash', priority: 94 },
        { cmd: 'TuyaOpenHelper.monitor', text: '$(terminal) Monitor', tooltip: 'monitor', priority: 93 },
        { cmd: 'TuyaOpenHelper.clean', text: '$(trash) clean', tooltip: 'clean', priority: 92 },
    ];

    items.forEach(it => {
        const sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, it.priority);
        sb.command = it.cmd;
        sb.text = it.text;
        sb.tooltip = it.tooltip;
        sb.show();
        context.subscriptions.push(sb);
        if (it.cmd === 'TuyaOpenHelper.setSerialPort') {
            serialStatusBar = sb;
        } else if (it.cmd === 'TuyaOpenHelper.configChoice') {
            boardConfigItemBar = sb;
        }
    });
    setTimeout(() => {
        let sdk = getConfig<string>('TuyaOpenHelper.tuyaOpenSDKPath', '');
        if (sdk) {
            vscode.commands.executeCommand('TuyaOpenHelper.runEnv');
        }
    }, 1000);
    setTimeout(() => {
        const config = vscode.workspace.getConfiguration('TuyaOpenHelper');
        const savedPort = config.get<string>('serialPort');
        if (savedPort) {
            updateSerialStatusBar(savedPort);
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            const platform = getPlatformFromConfig(workspaceFolder);
            updateboardConfigItemBar(platform);
        }
    }, 2000);
}

export function deactivate() { }
