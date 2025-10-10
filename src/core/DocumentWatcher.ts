import * as vscode from 'vscode';
import { CodeContext, WorkspaceEnrichedContext, ProjectStructure, CodePattern } from '../types';

/**
 * ドキュメント変更監視システム
 */
export class DocumentWatcher {
  private changeHandler?: vscode.Disposable;
  private saveHandler?: vscode.Disposable;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private onSuggestionGenerated?: (suggestions: import('../types').Suggestion[]) => void;

  // 重複防止用
  private lastAnalyzedContent = new Map<string, string>(); // ファイルパス -> 最後に分析した内容のハッシュ
  private processingFiles = new Set<string>(); // 現在処理中のファイル

  constructor(
    private agentManager: import('./AgentManager').AgentManager,
    onSuggestionGenerated?: (suggestions: import('../types').Suggestion[]) => void
  ) {
    this.onSuggestionGenerated = onSuggestionGenerated;
  }

  /**
   * ファイル変更監視を開始
   */
  startWatching(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // テキスト変更イベント監視
    this.changeHandler = vscode.workspace.onDidChangeTextDocument(
      this.onDidChangeTextDocument.bind(this)
    );
    disposables.push(this.changeHandler);

    // ファイル保存イベント監視
    this.saveHandler = vscode.workspace.onDidSaveTextDocument(
      this.onDidSaveTextDocument.bind(this)
    );
    disposables.push(this.saveHandler);

    console.log('DocumentWatcher 監視開始');
    return disposables;
  }

  /**
   * テキスト変更イベント処理（デバウンス付き）
   */
  private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;
    const documentUri = document.uri.toString();

    // サポート対象言語のみ処理
    if (!this.isSupportedLanguage(document.languageId)) {
      return;
    }

    // デバウンス処理
    const existingTimer = this.debounceTimers.get(documentUri);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const config = vscode.workspace.getConfiguration('rakugaki');
    const delay = config.get('suggestionDelay', 500);

    const timer = setTimeout(() => {
      this.processDocumentChange(document, event.contentChanges);
      this.debounceTimers.delete(documentUri);
    }, delay);

    this.debounceTimers.set(documentUri, timer);
  }

  /**
   * ファイル保存イベント処理
   */
  private onDidSaveTextDocument(document: vscode.TextDocument): void {
    if (!this.isSupportedLanguage(document.languageId)) {
      return;
    }

    // 保存時は即座に処理
    this.processDocumentChange(document, []);
  }

  /**
   * ドキュメント変更処理
   */
  private async processDocumentChange(
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): Promise<void> {
    const filePath = document.uri.fsPath;

    try {
      // 重複処理の防止
      if (this.processingFiles.has(filePath)) {
        console.debug(`Already processing: ${document.fileName}`);
        return;
      }

      // 内容の変更チェック
      const contentHash = this.generateContentHash(document.getText());
      const lastHash = this.lastAnalyzedContent.get(filePath);

      if (lastHash === contentHash) {
        console.debug(`No content change detected: ${document.fileName}`);
        return;
      }

      // 処理開始
      this.processingFiles.add(filePath);
      this.lastAnalyzedContent.set(filePath, contentHash);

      console.log(`Processing document change: ${document.fileName}`);

      // 変更コンテキストの構築
      const context = await this.buildChangeContext(document, changes);

      // ワークスペースコンテキストの豊富化
      const enrichedContext = await this.enrichWorkspaceContext(context);

      // 提案生成
      const suggestions = await this.agentManager.generateSuggestions(enrichedContext);

      // 提案に位置情報を追加
      const suggestionsWithLocation = this.addLocationInfo(suggestions, context);

      // UI通知
      if (this.onSuggestionGenerated && suggestionsWithLocation.length > 0) {
        this.onSuggestionGenerated(suggestionsWithLocation);
      }

      console.log(`Generated ${suggestions.length} suggestions for ${document.fileName}`);

    } catch (error) {
      console.error('Document change processing failed:', error);
    } finally {
      // 処理完了フラグを解除
      this.processingFiles.delete(filePath);
    }
  }

  /**
   * 変更コンテキストの構築
   */
  private async buildChangeContext(
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): Promise<CodeContext> {
    const changeText = this.extractChangeText(changes);

    return {
      document,
      fileName: document.fileName,
      language: document.languageId,
      code: document.getText(),
      changeText,
      changeRange: changes[0]?.range,
      timestamp: Date.now()
    };
  }

  /**
   * ワークスペースコンテキストの豊富化
   */
  private async enrichWorkspaceContext(context: CodeContext): Promise<WorkspaceEnrichedContext> {
    const [
      relatedFiles,
      projectStructure,
      dependencies,
      codePatterns,
      designPrinciples
    ] = await Promise.all([
      this.findRelatedFiles(context),
      this.analyzeProjectStructure(context),
      this.extractDependencies(context),
      this.learnCodePatterns(context),
      this.identifyDesignPrinciples(context)
    ]);

    return {
      ...context,
      relatedFiles,
      projectStructure,
      dependencies,
      codePatterns,
      designPrinciples
    };
  }

  /**
   * 関連ファイルの特定
   */
  private async findRelatedFiles(context: CodeContext): Promise<string[]> {
    const relatedFiles: string[] = [];

    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(context.document.uri);
      if (!workspaceFolder) {
        return relatedFiles;
      }

      // インポート文から関連ファイルを抽出
      const importPattern = /import.*from ['"]([^'"]+)['"]/g;
      let match;
      while ((match = importPattern.exec(context.code)) !== null) {
        const importPath = match[1];
        if (!importPath.startsWith('.')) {
          continue; // 外部ライブラリはスキップ
        }

        relatedFiles.push(importPath);
      }

      // 同一ディレクトリのファイルを検索
      const currentDir = vscode.Uri.joinPath(context.document.uri, '..');
      const files = await vscode.workspace.fs.readDirectory(currentDir);

      for (const [name, type] of files) {
        if (type === vscode.FileType.File && name !== context.document.uri.path.split('/').pop()) {
          if (this.isSupportedLanguage(this.getLanguageFromFileName(name))) {
            relatedFiles.push(name);
          }
        }
      }

    } catch (error) {
      console.warn('Related files discovery failed:', error);
    }

    return relatedFiles.slice(0, 10); // 最大10ファイル
  }

  /**
   * プロジェクト構造の解析
   */
  private async analyzeProjectStructure(context: CodeContext): Promise<ProjectStructure> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(context.document.uri);
    if (!workspaceFolder) {
      return {
        type: 'unknown',
        rootPath: '',
        configFiles: [],
        srcDirs: [],
        testDirs: []
      };
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const configFiles: string[] = [];
    const srcDirs: string[] = [];
    const testDirs: string[] = [];

    try {
      const files = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);

      for (const [name, type] of files) {
        if (type === vscode.FileType.File) {
          if (['package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js'].includes(name)) {
            configFiles.push(name);
          }
        } else if (type === vscode.FileType.Directory) {
          if (['src', 'lib', 'app'].includes(name)) {
            srcDirs.push(name);
          } else if (['test', 'tests', '__tests__', 'spec'].includes(name)) {
            testDirs.push(name);
          }
        }
      }

    } catch (error) {
      console.warn('Project structure analysis failed:', error);
    }

    return {
      type: this.determineProjectType(configFiles),
      rootPath,
      configFiles,
      srcDirs,
      testDirs
    };
  }

  private determineProjectType(configFiles: string[]): ProjectStructure['type'] {
    if (configFiles.includes('package.json')) {
      if (configFiles.includes('tsconfig.json')) {
        return 'typescript';
      }
      return 'javascript';
    }
    return 'unknown';
  }

  /**
   * 依存関係の抽出
   */
  private async extractDependencies(context: CodeContext): Promise<string[]> {
    const dependencies: string[] = [];

    // package.jsonから依存関係を抽出（Node.jsプロジェクトの場合）
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(context.document.uri);
      if (workspaceFolder) {
        const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');

        // ファイルが存在するかチェック
        try {
          const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
          const packageJson = JSON.parse(packageJsonContent.toString());

          if (packageJson.dependencies) {
            dependencies.push(...Object.keys(packageJson.dependencies));
          }
          if (packageJson.devDependencies) {
            dependencies.push(...Object.keys(packageJson.devDependencies));
          }
        } catch (fileError) {
          // package.jsonが存在しない場合は他の方法を試す
          await this.extractAlternativeDependencies(context, dependencies);
        }
      }
    } catch (error) {
      // エラーログを簡潔にする
      console.debug('Dependencies extraction skipped:', context.document.languageId);
    }

    return dependencies.slice(0, 20); // 最大20個
  }

  /**
   * 代替の依存関係抽出（Python、他の言語用）
   */
  private async extractAlternativeDependencies(context: CodeContext, dependencies: string[]): Promise<void> {
    const languageId = context.document.languageId;

    if (languageId === 'python') {
      // requirements.txtやpyproject.tomlから抽出を試みる
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(context.document.uri);
      if (workspaceFolder) {
        try {
          const requirementsUri = vscode.Uri.joinPath(workspaceFolder.uri, 'requirements.txt');
          const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);
          const lines = requirementsContent.toString().split('\n');

          lines.forEach(line => {
            const match = line.trim().match(/^([a-zA-Z0-9_-]+)/);
            if (match) {
              dependencies.push(match[1]);
            }
          });
        } catch {
          // requirements.txtがない場合は無視
        }
      }
    }
    // 他の言語のサポートは将来追加可能
  }

  /**
   * コードパターンの学習
   */
  private async learnCodePatterns(context: CodeContext): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // 基本的なパターン検出
    const code = context.code;

    // 関数宣言パターン
    const functionPattern = /function\s+\w+|const\s+\w+\s*=\s*\(/g;
    const functionMatches = code.match(functionPattern);
    if (functionMatches) {
      patterns.push({
        pattern: 'function-declaration',
        description: '関数宣言のパターン',
        frequency: functionMatches.length
      });
    }

    // クラス定義パターン
    const classPattern = /class\s+\w+/g;
    const classMatches = code.match(classPattern);
    if (classMatches) {
      patterns.push({
        pattern: 'class-definition',
        description: 'クラス定義のパターン',
        frequency: classMatches.length
      });
    }

    return patterns;
  }

  /**
   * 設計原則の識別
   */
  private async identifyDesignPrinciples(context: CodeContext): Promise<string[]> {
    const principles: string[] = [];

    const code = context.code;

    // 基本的な設計原則の検出
    if (code.includes('interface ') || code.includes('implements ')) {
      principles.push('インターフェース分離');
    }

    if (code.includes('extends ')) {
      principles.push('継承パターン');
    }

    if (code.includes('async ') || code.includes('Promise')) {
      principles.push('非同期パターン');
    }

    return principles;
  }

  private extractChangeText(changes: readonly vscode.TextDocumentContentChangeEvent[]): string {
    return changes.map(change => change.text).join('\\n');
  }

  private isSupportedLanguage(languageId: string): boolean {
    const supportedLanguages = [
      'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
      'python', 'go', 'vue', 'json', 'yaml', 'markdown'
    ];
    return supportedLanguages.includes(languageId);
  }

  private getLanguageFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const extensionMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'js': 'javascript',
      'jsx': 'javascriptreact',
      'py': 'python',
      'go': 'go',
      'vue': 'vue',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown'
    };
    return extensionMap[extension || ''] || 'plaintext';
  }

  /**
   * 提案に位置情報を追加
   */
  private addLocationInfo(suggestions: import('../types').Suggestion[], context: CodeContext): import('../types').Suggestion[] {
    return suggestions.map(suggestion => {
      // 提案のbeforeテキストから元の位置を特定
      if (suggestion.codeExample?.before) {
        const location = this.findCodeLocation(context.document, suggestion.codeExample.before);
        if (location) {
          return {
            ...suggestion,
            sourceLocation: {
              filePath: context.document.uri.fsPath,
              startLine: location.start.line,
              endLine: location.end.line,
              startCharacter: location.start.character,
              endCharacter: location.end.character,
              originalText: suggestion.codeExample.before
            }
          };
        }
      }

      // 位置情報が見つからない場合は変更範囲を使用
      if (context.changeRange) {
        return {
          ...suggestion,
          sourceLocation: {
            filePath: context.document.uri.fsPath,
            startLine: context.changeRange.start.line,
            endLine: context.changeRange.end.line,
            startCharacter: context.changeRange.start.character,
            endCharacter: context.changeRange.end.character,
            originalText: context.changeText || ''
          }
        };
      }

      return suggestion;
    });
  }

  /**
   * ドキュメント内でコードの位置を検索
   */
  private findCodeLocation(document: vscode.TextDocument, searchText: string): vscode.Range | null {
    const text = document.getText();
    const normalizedSearch = searchText.trim();

    // 正確な一致を探す
    const exactIndex = text.indexOf(normalizedSearch);
    if (exactIndex !== -1) {
      const startPos = document.positionAt(exactIndex);
      const endPos = document.positionAt(exactIndex + normalizedSearch.length);
      return new vscode.Range(startPos, endPos);
    }

    // 行単位での一致を探す
    const lines = text.split('\n');
    const searchLines = normalizedSearch.split('\n');

    for (let i = 0; i <= lines.length - searchLines.length; i++) {
      let matches = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (lines[i + j]?.trim() !== searchLines[j]?.trim()) {
          matches = false;
          break;
        }
      }

      if (matches) {
        const startPos = new vscode.Position(i, 0);
        const endPos = new vscode.Position(i + searchLines.length - 1, lines[i + searchLines.length - 1]?.length || 0);
        return new vscode.Range(startPos, endPos);
      }
    }

    return null;
  }

  /**
   * 内容のハッシュを生成（重複検出用）
   */
  private generateContentHash(content: string): string {
    // 簡単なハッシュ生成（空白や改行の変化を無視）
    const normalizedContent = content
      .replace(/\s+/g, ' ')  // 複数の空白を単一の空白に
      .trim()               // 前後の空白を除去
      .toLowerCase();       // 大文字小文字を統一

    // 単純なハッシュ関数
    let hash = 0;
    for (let i = 0; i < normalizedContent.length; i++) {
      const char = normalizedContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer に変換
    }
    return hash.toString(36);
  }

  /**
   * 監視停止
   */
  stopWatching(): void {
    this.changeHandler?.dispose();
    this.saveHandler?.dispose();

    // タイマーをクリア
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // 重複防止用データもクリア
    this.lastAnalyzedContent.clear();
    this.processingFiles.clear();

    console.log('DocumentWatcher 監視停止');
  }
}