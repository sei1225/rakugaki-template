import * as vscode from 'vscode';

/**
 * VSCode統合AI提案システム - メインエントリーポイント
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('VSCode統合AI提案システム 起動中...');

    try {
        // エージェント可用性チェック
        checkAgentAvailability();

        // 基本コマンドの登録
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

        // リソース管理
        context.subscriptions.push(...commands);

        // 起動完了メッセージ
        vscode.window.showInformationMessage(
            'AI提案システム起動完了 - エージェント接続を確認中...'
        );

        console.log('VSCode統合AI提案システム 起動成功');
    } catch (error) {
        console.error('Extension activation failed:', error);
        vscode.window.showErrorMessage(
            'AI提案システムの起動に失敗しました。'
        );
    }
}

/**
 * エージェントの可用性をチェック
 */
async function checkAgentAvailability() {
    const availableAgents: string[] = [];

    // Claude Chat Extension チェック
    const claudeExtension = vscode.extensions.getExtension('anthropic.claude-dev');
    if (claudeExtension?.isActive) {
        availableAgents.push('Claude Chat Extension');
    }

    // Copilot Chat API チェック
    try {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot'
        });
        if (models.length > 0) {
            availableAgents.push('GitHub Copilot Chat');
        }
    } catch (error) {
        console.log('Copilot Chat API 利用不可:', error);
    }

    // 結果表示
    if (availableAgents.length > 0) {
        vscode.window.showInformationMessage(
            `利用可能なエージェント: ${availableAgents.join(', ')}`
        );
    } else {
        vscode.window.showWarningMessage(
            '利用可能なエージェントがありません。Claude Chat Extension または GitHub Copilot の設定を確認してください。'
        );
    }
}

/**
 * ワークスペース全体分析コマンド
 */
async function analyzeWorkspace() {
    vscode.window.showInformationMessage('ワークスペース全体分析を開始します...');

    // TODO: 実際の分析ロジックを実装
    await simulateAnalysis();

    vscode.window.showInformationMessage('ワークスペース分析完了');
}

/**
 * エージェント接続更新コマンド
 */
async function refreshAgents() {
    vscode.window.showInformationMessage('エージェント接続を更新中...');

    await checkAgentAvailability();

    vscode.window.showInformationMessage('エージェント接続更新完了');
}

/**
 * 分析機能切り替えコマンド
 */
async function toggleAnalysis() {
    const config = vscode.workspace.getConfiguration('rakugaki');
    const isEnabled = config.get('enablePatternLearning', true);

    await config.update('enablePatternLearning', !isEnabled, vscode.ConfigurationTarget.Workspace);

    const status = !isEnabled ? '有効' : '無効';
    vscode.window.showInformationMessage(`分析機能を${status}にしました`);
}

/**
 * 統計情報表示コマンド
 */
async function showStats() {
    const config = vscode.workspace.getConfiguration('rakugaki');
    const enabledCategories = config.get('enabledCategories', []);
    const primaryAgent = config.get('primaryAgent', 'auto');
    const analysisDepth = config.get('analysisDepth', 'normal');

    const statsMessage = [
        '=== AI提案システム統計 ===',
        `有効カテゴリ: ${JSON.stringify(enabledCategories)}`,
        `優先エージェント: ${primaryAgent}`,
        `分析深度: ${analysisDepth}`,
        '========================='
    ].join('\n');

    vscode.window.showInformationMessage(statsMessage, { modal: true });
}

/**
 * 分析シミュレーション（デモ用）
 */
async function simulateAnalysis() {
    return new Promise(resolve => {
        setTimeout(resolve, 1500); // 1.5秒待機
    });
}

/**
 * 拡張機能の非アクティブ化
 */
export function deactivate() {
    console.log('VSCode統合AI提案システム 終了中...');
}