import * as vscode from 'vscode';
import { AgentManager } from './core/AgentManager';
import { DocumentWatcher } from './core/DocumentWatcher';
import { SuggestionViewProvider } from './ui/SuggestionViewProvider';
import { Suggestion } from './types';

// グローバルインスタンス
let agentManager: AgentManager;
let documentWatcher: DocumentWatcher;
let suggestionViewProvider: SuggestionViewProvider;

/**
 * VSCode統合AI提案システム - メインエントリーポイント
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Rakugaki - VSCode統合AI提案システム 起動中...');

    try {
        // システム初期化
        await initializeSystem();

        // WebViewProvider 登録
        suggestionViewProvider = new SuggestionViewProvider(context.extensionUri, agentManager);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SuggestionViewProvider.viewType,
                suggestionViewProvider
            )
        );

        // コマンド登録
        const commands = [
            vscode.commands.registerCommand(
                'rakugaki.analyzeWorkspace',
                analyzeWorkspace
            ),
            vscode.commands.registerCommand(
                'rakugaki.refreshAgents',
                refreshAgents
            ),
            vscode.commands.registerCommand(
                'rakugaki.toggleAnalysis',
                toggleAnalysis
            ),
            vscode.commands.registerCommand(
                'rakugaki.showStats',
                showStats
            )
        ];

        // ドキュメント監視開始
        const watcherDisposables = documentWatcher.startWatching();

        // リソース管理
        context.subscriptions.push(...commands);
        context.subscriptions.push(...watcherDisposables);

        // 起動完了メッセージ
        const availableAgents = agentManager.getAvailableAgents();
        const availableCount = availableAgents.filter(agent => agent.isAvailable).length;

        vscode.window.showInformationMessage(
            `✅ Rakugaki起動完了 - ${availableCount}個のエージェント利用可能`
        );

        console.log('✅ Rakugaki 起動成功');
        console.log('🔍 拡張機能は継続実行中です。ウィンドウを閉じないでください。');
    } catch (error) {
        console.error('❌ Extension activation failed:', error);
        vscode.window.showErrorMessage(
            '❌ Rakugaki起動に失敗しました。詳細はコンソールを確認してください。'
        );
    }
}

/**
 * システム初期化
 */
async function initializeSystem() {
    // AgentManager初期化
    agentManager = new AgentManager();
    await agentManager.initialize();

    // DocumentWatcher初期化
    documentWatcher = new DocumentWatcher(agentManager, onSuggestionGenerated);

    console.log('🔧 システム初期化完了');
}

/**
 * 提案生成時のコールバック
 */
function onSuggestionGenerated(suggestions: Suggestion[]) {
    if (suggestions.length === 0) {
        return;
    }

    console.log(`📝 ${suggestions.length}個の提案を生成`);

    // サイドパネルに提案を表示（ポップアップなし）
    if (suggestionViewProvider) {
        suggestionViewProvider.addSuggestions(suggestions);
    }
}

/**
 * 提案詳細表示
 */
function showSuggestionDetail(suggestion: Suggestion) {
    const detail = [
        `📋 **${suggestion.title}**`,
        '',
        `🏷️ **カテゴリ**: ${suggestion.category}`,
        `⚡ **優先度**: ${suggestion.priority}`,
        `🤖 **エージェント**: ${suggestion.agent}`,
        '',
        `💭 **説明**:`,
        suggestion.description,
        '',
        suggestion.reasoning ? `🧠 **理由**: ${suggestion.reasoning}` : '',
        '',
        suggestion.codeExample ? '```' + suggestion.codeExample.before + '```' : '',
        suggestion.codeExample ? '↓' : '',
        suggestion.codeExample ? '```' + suggestion.codeExample.after + '```' : ''
    ].filter(Boolean).join('\n');

    vscode.window.showInformationMessage(detail, { modal: true });
}

/**
 * ワークスペース全体分析コマンド
 */
async function analyzeWorkspace() {
    if (!agentManager) {
        vscode.window.showWarningMessage('システムが初期化されていません');
        return;
    }

    vscode.window.showInformationMessage('🔍 ワークスペース全体分析を開始します...');

    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('アクティブなエディタがありません');
            return;
        }

        // 現在のドキュメントを分析
        documentWatcher.startWatching();

        vscode.window.showInformationMessage('✅ ワークスペース分析を開始しました');
    } catch (error) {
        console.error('Workspace analysis failed:', error);
        vscode.window.showErrorMessage('❌ ワークスペース分析に失敗しました');
    }
}

/**
 * エージェント接続更新コマンド
 */
async function refreshAgents() {
    if (!agentManager) {
        vscode.window.showWarningMessage('システムが初期化されていません');
        return;
    }

    vscode.window.showInformationMessage('🔄 エージェント接続を更新中...');

    try {
        await agentManager.refreshAgentConnections();

        const availableAgents = agentManager.getAvailableAgents();
        const availableCount = availableAgents.filter(agent => agent.isAvailable).length;

        vscode.window.showInformationMessage(
            `✅ エージェント接続更新完了 - ${availableCount}個のエージェント利用可能`
        );
    } catch (error) {
        console.error('Agent refresh failed:', error);
        vscode.window.showErrorMessage('❌ エージェント接続更新に失敗しました');
    }
}

/**
 * 分析機能切り替えコマンド
 */
async function toggleAnalysis() {
    const config = vscode.workspace.getConfiguration('rakugaki');
    const isEnabled = config.get('enablePatternLearning', true);

    await config.update('enablePatternLearning', !isEnabled, vscode.ConfigurationTarget.Workspace);

    const status = !isEnabled ? '有効' : '無効';
    const emoji = !isEnabled ? '✅' : '❌';
    vscode.window.showInformationMessage(`${emoji} 分析機能を${status}にしました`);
}

/**
 * 統計情報表示コマンド
 */
async function showStats() {
    if (!agentManager) {
        vscode.window.showWarningMessage('システムが初期化されていません');
        return;
    }

    const config = vscode.workspace.getConfiguration('rakugaki');
    const availableAgents = agentManager.getAvailableAgents();

    const statsMessage = [
        '📊 === Rakugaki 統計情報 ===',
        '',
        '🎯 **設定**:',
        `• 有効カテゴリ: ${config.get('enabledCategories', []).join(', ')}`,
        `• 優先エージェント: ${config.get('primaryAgent', 'auto')}`,
        `• 分析深度: ${config.get('analysisDepth', 'normal')}`,
        `• 提案遅延: ${config.get('suggestionDelay', 500)}ms`,
        '',
        '🤖 **エージェント状況**:',
        ...availableAgents.map(agent =>
            `• ${agent.name}: ${agent.isAvailable ? '✅ 利用可能' : '❌ 利用不可'}`
        ),
        '',
        '================================'
    ].join('\n');

    vscode.window.showInformationMessage(statsMessage, { modal: true });
}

/**
 * 拡張機能の非アクティブ化
 */
export function deactivate() {
    console.log('👋 Rakugaki 終了中...');

    try {
        documentWatcher?.stopWatching();
        agentManager?.dispose();
        console.log('✅ Rakugaki 正常終了');
    } catch (error) {
        console.error('❌ Deactivation error:', error);
    }
}