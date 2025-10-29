# TuyaOpen Helper 0.0.1 Usage Guide

## Installation

1. Open VSCode.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette.
3. Type `Extensions: Install from VSIX...` and select it.
4. Browse and select `TuyaOpen-helper-0.0.1.vsix`.
5. Reload VSCode if prompted.

## Configuration

1. After installation, open the workspace you want to use with TuyaOpen Helper.
2. On the first run, the extension will prompt you to enter the SDK root directory (TuyaOpen SDK path).
3. You can also manually configure the settings in `.vscode/settings.json`:

```json
{
    "TuyaOpenHelper.projectPath": "D:\\WorkSpace\\TuyaOpen\\TuyaOpen",
    "TuyaOpenHelper.exportScript": "", // leave blank to auto detect
    "TuyaOpenHelper.terminalName": "TuyaOpen Helper"
}
```

- `projectPath`: Root directory of TuyaOpen SDK.
- `exportScript`: Relative path to your environment activation script. If empty, the extension uses `export.sh` on Linux/macOS and `export.bat` on Windows.
- `terminalName`: Name of the terminal used by the extension.

## Status Bar Commands

After installation, a set of buttons will appear on the VSCode status bar:


| Button                   | Action                             |
| ------------------------ | ---------------------------------- |
| $(plug) Env              | Activate TuyaOpen environment      |
| $(check) Build           | Build the project (`tos.py build`) |
| $(gear) BoardConfig      | Run`tos.py config choice`          |
| $(settings-gear) MenuCfg | Run`tos.py config menu`            |
| $(rocket) Flash          | Flash the project (`tos.py flash`) |
| $(terminal) Monitor      | Open monitor (`tos.py monitor`)    |
| $(trash) Clean           | Clean the project (`tos.py clean`) |

## Command Palette Shortcuts

You can also access all commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `TuyaOpen Helper: Activate Environment`
- `TuyaOpen Helper: Build`
- `TuyaOpen Helper: Config Choice`
- `TuyaOpen Helper: MenuConfig`
- `TuyaOpen Helper: Flash`
- `TuyaOpen Helper: Monitor`
- `TuyaOpen Helper: Clean`

## Behavior Notes

- The extension automatically detects your OS and uses the appropriate activation script.
- Once the environment is activated, it remains active in the terminal for subsequent commands.
- On first use, if the SDK path is not set, the extension will prompt for it.
- All commands are executed in the VSCode integrated terminal named `TuyaOpen Helper`.

## Tips

- Make sure your SDK environment scripts (`export.sh` or `export.bat`) are correct.
- For Windows, the extension uses `cmd /c` to run batch scripts.
- For Linux/macOS, the extension uses `bash -lc` to ensure environment variables are loaded.
- You can always change the SDK path or terminal name in `.vscode/settings.json`.
# TuyaOpen Helper 0.0.1 Usage Guide

## Installation

1. Open VSCode.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette.
3. Type `Extensions: Install from VSIX...` and select it.
4. Browse and select `TuyaOpen-helper-0.0.1.vsix`.
5. Reload VSCode if prompted.

## Configuration

1. After installation, open the workspace you want to use with TuyaOpen Helper.
2. On the first run, the extension will prompt you to enter the SDK root directory (TuyaOpen SDK path).
3. You can also manually configure the settings in `.vscode/settings.json`:

```json
{
    "TuyaOpenHelper.projectPath": "D:\\WorkSpace\\TuyaOpen\\TuyaOpen",
    "TuyaOpenHelper.exportScript": "", // leave blank to auto detect
    "TuyaOpenHelper.terminalName": "TuyaOpen Helper"
}
```

- `projectPath`: Root directory of TuyaOpen SDK.
- `exportScript`: Relative path to your environment activation script. If empty, the extension uses `export.sh` on Linux/macOS and `export.bat` on Windows.
- `terminalName`: Name of the terminal used by the extension.

## Status Bar Commands

After installation, a set of buttons will appear on the VSCode status bar:


| Button                   | Action                             |
| ------------------------ | ---------------------------------- |
| $(plug) Env              | Activate TuyaOpen environment      |
| $(check) Build           | Build the project (`tos.py build`) |
| $(gear) BoardConfig      | Run`tos.py config choice`          |
| $(settings-gear) MenuCfg | Run`tos.py config menu`            |
| $(rocket) Flash          | Flash the project (`tos.py flash`) |
| $(terminal) Monitor      | Open monitor (`tos.py monitor`)    |
| $(trash) Clean           | Clean the project (`tos.py clean`) |

## Command Palette Shortcuts

You can also access all commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `TuyaOpen Helper: Activate Environment`
- `TuyaOpen Helper: Build`
- `TuyaOpen Helper: Config Choice`
- `TuyaOpen Helper: MenuConfig`
- `TuyaOpen Helper: Flash`
- `TuyaOpen Helper: Monitor`
- `TuyaOpen Helper: Clean`

## Behavior Notes

- The extension automatically detects your OS and uses the appropriate activation script.
- Once the environment is activated, it remains active in the terminal for subsequent commands.
- On first use, if the SDK path is not set, the extension will prompt for it.
- All commands are executed in the VSCode integrated terminal named `TuyaOpen Helper`.

## Tips

- Make sure your SDK environment scripts (`export.sh` or `export.bat`) are correct.
- For Windows, the extension uses `cmd /c` to run batch scripts.
- For Linux/macOS, the extension uses `bash -lc` to ensure environment variables are loaded.
- You can always change the SDK path or terminal name in `.vscode/settings.json`.
