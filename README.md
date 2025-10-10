# Rakugaki - VSCode統合AI提案システム

Claude Chat Extension・GitHub Copilot統合によるプロジェクト全体理解型コード品質向上システム

## 概要

Rakugakiは、VSCode内で動作するAI提案システムです。複数のAIエージェント（Claude Chat Extension、GitHub Copilot）を統合し、プロジェクト全体のコンテキストを理解した高品質なコード改善提案を提供します。

## 特徴

- **プロジェクト全体理解**: ワークスペース全体のコンテキストを考慮した提案
- **複数エージェント統合**: Claude Chat Extension と GitHub Copilot の両方に対応
- **リアルタイム分析**: ファイル変更に応じた即座の品質分析
- **カテゴリ別提案**: 記法改善、パフォーマンス、設計改善の3つの観点
- **設定可能**: 分析深度、提案カテゴリなどを柔軟に設定

## 必要な環境

- VSCode 1.70.0以上
- Node.js 22.x以上
- 以下のいずれかのAIエージェント:
  - Claude Chat Extension (`anthropic.claude-dev`)
  - GitHub Copilot

## 開発者向け

### セットアップ

```bash
# 依存関係のインストール
npm install

# TypeScriptコンパイル
npm run compile

# ウォッチモードでの開発
npm run watch
```

### VSCodeでのテスト実行

1. F5キーを押すか、「Run Extension」デバッグ設定を実行
2. 新しいVSCodeウィンドウが開きます
3. コマンドパレット（Cmd+Shift+P）で「ワークスペース全体分析」などのコマンドを実行

### 利用可能なコマンド

- `ワークスペース全体分析`: プロジェクト全体の品質分析を実行
- `エージェント接続更新`: 利用可能なAIエージェントの状態を更新
- `分析機能の切り替え`: パターン学習機能のオン/オフ切り替え
- `統計情報を表示`: 現在の設定と統計情報を表示

## ライセンス

MIT License