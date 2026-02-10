const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Order configuration: files containing these strings will be loaded in this order
const LOAD_ORDER = ['fast', 'script', 'keywords'];

let globalSnippetMap = new Map();

function activate(context) {
    console.log('Taikou5 extension is activating...');

    // 1. Register Sidebar View Provider (Priority: High)
    try {
        class TaikouConfigProvider {
            constructor() {
                this._onDidChangeTreeData = new vscode.EventEmitter();
                this.onDidChangeTreeData = this._onDidChangeTreeData.event;
            }
    
            refresh() {
                this._onDidChangeTreeData.fire();
            }
    
            getChildren(element) {
                try {
                    if (!element) {
                        const config = vscode.workspace.getConfiguration('taikou5');
                        const compilerPath = config.get('compilerPath');
                        const pathItem = new vscode.TreeItem('编译器', vscode.TreeItemCollapsibleState.None);
                        pathItem.description = '';
                        pathItem.tooltip = compilerPath || '点击设置 tkhack-dx.exe 路径';
                        pathItem.iconPath = new vscode.ThemeIcon('settings-gear');
                        pathItem.command = {
                            command: 'taikou5.openSettings',
                            title: '设置编译器路径'
                        };
    
                        const compileItem = new vscode.TreeItem("执行编译", vscode.TreeItemCollapsibleState.None);
                        compileItem.iconPath = new vscode.ThemeIcon('play');
                        compileItem.command = {
                            command: 'taikou5.compile',
                            title: '编译为EVM'
                        };
    
                        return [pathItem, compileItem];
                    }
                    return [];
                } catch (e) {
                    console.error('Error getting tree children:', e);
                    vscode.window.showErrorMessage(`侧栏加载失败: ${e.message}`);
                    return [];
                }
            }
    
            getTreeItem(element) {
                return element;
            }
        }
        
        const configProvider = new TaikouConfigProvider();
        vscode.window.registerTreeDataProvider('taikou5-config-view', configProvider);
        
        context.subscriptions.push(vscode.commands.registerCommand('taikou5.refreshConfig', () => {
            configProvider.refresh();
        }));
    
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('taikou5.compilerPath')) {
                configProvider.refresh();
            }
        }));
        console.log('Sidebar provider registered.');
    } catch (e) {
        console.error('Failed to register sidebar provider:', e);
    }

    // 2. Register Commands (Priority: High)
    try {
        // Register compile command
        const validateCompilerPath = (filePath) => {
            if (!filePath) return true;
            if (path.basename(filePath).toLowerCase() !== 'tkhack-dx.exe') {
                vscode.window.showErrorMessage('只能选择 tkhack-dx.exe');
                return false;
            }
            return true;
        };

        context.subscriptions.push(vscode.commands.registerCommand('taikou5.openSettings', async () => {
            const config = vscode.workspace.getConfiguration('taikou5');
            const currentPath = String(config.get('compilerPath') || '');

            const selection = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(folder-opened) 选择编译器路径...',
                        description: '浏览并选择 tkhack-dx.exe',
                        action: 'pick'
                    },
                    {
                        label: '$(edit) 手动输入路径...',
                        description: '输入/粘贴 tkhack-dx.exe 的完整路径',
                        action: 'input'
                    },
                    {
                        label: '$(trash) 清除当前路径',
                        description: currentPath || '未设置',
                        action: 'clear'
                    },
                    {
                        label: '$(copy) 复制当前路径',
                        description: currentPath || '未设置',
                        action: 'copy'
                    },
                    {
                        label: '$(settings-gear) 打开设置项',
                        description: '在设置中查看 taikou5.compilerPath',
                        action: 'settings'
                    }
                ],
                {
                    placeHolder: `当前编译器: ${currentPath || '未设置'}`,
                    ignoreFocusOut: true
                }
            );

            if (!selection) return;

            if (selection.action === 'pick') {
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'Executables': ['exe'],
                        'All Files': ['*']
                    },
                    openLabel: '选择 tkhack-dx.exe'
                });

                if (!picked || picked.length === 0) return;
                const nextPath = picked[0].fsPath;
                if (!validateCompilerPath(nextPath)) return;
                await config.update('compilerPath', nextPath, vscode.ConfigurationTarget.Global);
                return;
            }

            if (selection.action === 'input') {
                const nextPath = await vscode.window.showInputBox({
                    prompt: '请输入 tkhack-dx.exe 的完整路径',
                    value: currentPath,
                    ignoreFocusOut: true
                });
                if (typeof nextPath !== 'string') return;
                if (nextPath && !validateCompilerPath(nextPath)) return;
                await config.update('compilerPath', nextPath, vscode.ConfigurationTarget.Global);
                return;
            }

            if (selection.action === 'clear') {
                await config.update('compilerPath', '', vscode.ConfigurationTarget.Global);
                return;
            }

            if (selection.action === 'copy') {
                if (!currentPath) {
                    vscode.window.showWarningMessage('当前未设置编译器路径');
                    return;
                }
                await vscode.env.clipboard.writeText(currentPath);
                vscode.window.showInformationMessage('已复制编译器路径');
                return;
            }

            if (selection.action === 'settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'taikou5.compilerPath');
                return;
            }
        }));

        context.subscriptions.push(vscode.commands.registerCommand('taikou5.compile', async () => {
            let compilerPath = vscode.workspace.getConfiguration('taikou5').get('compilerPath');

            if (!validateCompilerPath(compilerPath)) {
                compilerPath = '';
            }

            if (!compilerPath || !fs.existsSync(compilerPath)) {
                const selection = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'Executables': ['exe'],
                        'All Files': ['*']
                    },
                    openLabel: '选择 tkhack-dx.exe'
                });

                if (selection && selection.length > 0) {
                    const selectedPath = selection[0].fsPath;
                    if (!validateCompilerPath(selectedPath)) {
                        return;
                    }
                    compilerPath = selectedPath;
                    await vscode.workspace.getConfiguration('taikou5').update('compilerPath', compilerPath, vscode.ConfigurationTarget.Global);
                } else {
                    return;
                }
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('请先打开一个文件');
                return;
            }

            const taskDefinition = {
                type: 'shell',
                label: '编译为EVM'
            };

            const commandLine = `"${compilerPath}" --for=5dx --language=sc --command=compile --input="${editor.document.fileName}"`;
            const execution = new vscode.ShellExecution('cmd.exe', ['/d', '/c', commandLine]);

            const task = new vscode.Task(
                taskDefinition,
                vscode.TaskScope.Workspace,
                '编译为EVM',
                'taikou5',
                execution
            );

            task.group = vscode.TaskGroup.Build;
            task.presentationOptions = {
                echo: true,
                reveal: vscode.TaskRevealKind.Always,
                focus: true,
                panel: vscode.TaskPanelKind.Shared,
                showReuseMessage: true,
                clear: false
            };

            vscode.tasks.executeTask(task);
        }));

        const updateContextKey = (editor) => {
            if (!editor) {
                vscode.commands.executeCommand('setContext', 'taikou5.isEventFile', false);
                return;
            }
            const rawFirstLine = editor.document.lineAt(0).text;
            const withoutBom = rawFirstLine.replace(/^\uFEFF/, '');
            const commentIndex = withoutBom.indexOf('//');
            const header = (commentIndex >= 0 ? withoutBom.slice(0, commentIndex) : withoutBom).trim();
            const isEventFile = /^太[閣阁]立志[傳传][５5]事件源文件$/.test(header);
            vscode.commands.executeCommand('setContext', 'taikou5.isEventFile', isEventFile);
        };


        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateContextKey));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
            if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
                if (e.contentChanges.some(change => change.range.start.line === 0)) {
                    updateContextKey(vscode.window.activeTextEditor);
                }
            }
        }));
        
        if (vscode.window.activeTextEditor) {
            updateContextKey(vscode.window.activeTextEditor);
        }
        
        console.log('Commands registered.');
    } catch (e) {
        console.error('Failed to register commands:', e);
    }

    // 3. Load Snippets (Feature)
    try {
        const snippetsPath = path.join(context.extensionPath, 'everedit');
        
        if (!fs.existsSync(snippetsPath)) {
            console.warn(`Snippets path not found: ${snippetsPath}`);
            // Do not return here, so that other features (like the sidebar) can still work
        } else {
            // Initial load
            loadSnippets(snippetsPath);
    
            // Watch for changes to reload dynamically
            try {
                const watcher = fs.watch(snippetsPath, (eventType, filename) => {
                    if (filename && filename.endsWith('.snippet')) {
                        // Simple debounce/reload
                        loadSnippets(snippetsPath);
                    }
                });
                context.subscriptions.push({ dispose: () => watcher.close() });
            } catch (e) {
                console.error('Failed to watch snippet directory:', e);
            }
        }
    } catch (e) {
        console.error('Failed to initialize snippets:', e);
    }

    // 4. Register Completion Provider (Feature)
    try {
        const provider = vscode.languages.registerCompletionItemProvider(
            'taikou5-script',
            {
                provideCompletionItems(document, position) {
                    // Get the line text up to the cursor position
                    const lineText = document.lineAt(position).text;
                    const linePrefix = lineText.substring(0, position.character);
    
                    // Try to find a valid prefix (either English-like sequence or Chinese-like sequence at the end)
                    // This regex matches a sequence of ASCII word characters OR a sequence of non-ASCII characters at the end of the string
                    // It helps separate Chinese and English when they are adjacent, e.g. "代入a" -> matches "a"
                    const match = linePrefix.match(/([a-zA-Z0-9_]+|[^\x00-\x7f]+)$/);
                    const prefix = match ? match[0].toLowerCase() : '';
                    
                    // Calculate the range to replace
                    // If we matched a prefix, we must provide a range to tell VS Code exactly what to replace.
                    // Otherwise VS Code might use its default word detection which could be wrong (e.g. including the Chinese characters)
                    let range;
                    if (match) {
                        range = new vscode.Range(position.translate(0, -match[0].length), position);
                    }
    
                    const items = [];
                    
                    for (const [bodyText, entry] of globalSnippetMap.entries()) {
                        const allTriggers = Array.from(entry.triggers);
                        
                        // Optimize filterText based on current prefix
                        // If any trigger starts with prefix, put it at the front to ensure high rank
                        // If no trigger matches prefix, just use default order (ASCII/length)
                        
                        let sortedTriggers;
                        if (prefix) {
                            // Find triggers that match prefix
                            const matches = [];
                            const others = [];
                            for (const t of allTriggers) {
                                if (t.toLowerCase().startsWith(prefix)) {
                                    matches.push(t);
                                } else {
                                    others.push(t);
                                }
                            }
                            
                            if (matches.length > 0) {
                                // Sort matches by length (shortest match first usually better?)
                                matches.sort((a, b) => a.length - b.length);
                                // Sort others by standard logic
                                others.sort((a, b) => a.length - b.length || a.localeCompare(b));
                                sortedTriggers = [...matches, ...others];
                            } else {
                                // No prefix match, use standard sort
                                sortedTriggers = allTriggers.sort((a, b) => {
                                    const isAsciiA = /^[\x00-\x7F]*$/.test(a);
                                    const isAsciiB = /^[\x00-\x7F]*$/.test(b);
                                    if (isAsciiA && !isAsciiB) return -1;
                                    if (!isAsciiA && isAsciiB) return 1;
                                    return a.length - b.length || a.localeCompare(b);
                                });
                            }
                        } else {
                            // Empty prefix, standard sort
                            sortedTriggers = allTriggers.sort((a, b) => {
                                const isAsciiA = /^[\x00-\x7F]*$/.test(a);
                                const isAsciiB = /^[\x00-\x7F]*$/.test(b);
                                if (isAsciiA && !isAsciiB) return -1;
                                if (!isAsciiA && isAsciiB) return 1;
                                return a.length - b.length || a.localeCompare(b);
                            });
                        }
    
                        const item = new vscode.CompletionItem(entry.label, vscode.CompletionItemKind.Snippet);
                        item.filterText = sortedTriggers.join(' ');
                        item.detail = sortedTriggers.join(', '); 
                        item.sortText = String(entry.sortIndex).padStart(6, '0');
                        item.insertText = new vscode.SnippetString(bodyText);
                        item.documentation = new vscode.MarkdownString().appendCodeblock(bodyText, 'taikou5-script');
                        
                        // Explicitly set the range if we detected a prefix
                        if (range) {
                            item.range = range;
                        }
    
                        items.push(item);
                    }
                    
                    // Return isIncomplete=true to force VS Code to call us again when user types more
                    // This ensures we can re-optimize the filterText order for the new prefix
                    return new vscode.CompletionList(items, true);
                }
            }
        );
    
        context.subscriptions.push(provider);
        console.log('Completion provider registered.');
    } catch (e) {
        console.error('Failed to register completion provider:', e);
    }
}

function deactivate() {}



function loadSnippets(dirPath) {
    console.log('Loading snippets from ' + dirPath);
    const items = [];
    try {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.snippet'));
        
        // Sort files based on LOAD_ORDER
        files.sort((a, b) => {
            const getPriority = (filename) => {
                for (let i = 0; i < LOAD_ORDER.length; i++) {
                    if (filename.includes(LOAD_ORDER[i])) {
                        return i;
                    }
                }
                return LOAD_ORDER.length; // Default priority for others
            };
            
            const pa = getPriority(a);
            const pb = getPriority(b);
            
            if (pa !== pb) {
                return pa - pb;
            }
            return a.localeCompare(b);
        });

        console.log('Snippet load order:', files);

    // Use a Map to aggregate triggers for the same bodyText
    // Key: bodyText, Value: { label, triggers: Set<string>, sortIndex }
    const snippetMap = new Map();
    let globalSortIndex = 0;

    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
            parseSnippetFile(content, snippetMap, () => globalSortIndex++);
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
    }
    
    // We don't pre-generate completionItems anymore.
    // We store the map and generate them dynamically in provideCompletionItems
    globalSnippetMap = snippetMap;
    console.log(`Loaded ${snippetMap.size} unique snippets.`);
    } catch (e) {
        console.error('Error loading snippets:', e);
    }
}

function parseSnippetFile(content, snippetMap, getSortIndex) {
    const lines = content.split(/\r?\n/);
    let currentLabel = null;
    let currentTrigger = null;
    let currentBody = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#t=')) {
            if (currentLabel && currentTrigger) {
                addSnippetEntry(snippetMap, currentLabel, currentTrigger, currentBody, getSortIndex);
            }
            currentLabel = line.substring(3).trim();
            currentTrigger = null;
            currentBody = [];
        } else if (line.startsWith('#g=')) {
            currentTrigger = line.substring(3).trim();
        } else {
            if (currentLabel && currentTrigger) {
                currentBody.push(line);
            }
        }
    }
    
    if (currentLabel && currentTrigger) {
        addSnippetEntry(snippetMap, currentLabel, currentTrigger, currentBody, getSortIndex);
    }
}

function addSnippetEntry(snippetMap, label, trigger, bodyLines, getSortIndex) {
    // Remove trailing empty lines
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
        bodyLines.pop();
    }
    
    if (bodyLines.length === 0 && !label) {
        return;
    }

    const bodyText = bodyLines.join('\n');

    if (snippetMap.has(bodyText)) {
        const entry = snippetMap.get(bodyText);
        entry.triggers.add(trigger);
        // Keep existing label/sortIndex (first loaded wins)
    } else {
        snippetMap.set(bodyText, {
            label: label,
            triggers: new Set([trigger]),
            sortIndex: getSortIndex()
        });
    }
}

module.exports = {
    activate,
    deactivate
};
