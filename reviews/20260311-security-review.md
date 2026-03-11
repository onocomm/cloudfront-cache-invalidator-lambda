# セキュリティレビュー結果

- **日付**: 2026-03-11
- **レビューア**: OpenAI Codex (gpt-5.4)
- **対象**: lambda/index.ts, lib/cloudfront-cache-invalidator-stack.ts, bin/app.ts, cdk.json

## 指摘事項

### 1. 認証情報の空文字許容（重要度: 高）

`basicAuthUsername` / `basicAuthPassword` が未設定でも空文字で動作し、認証バイパスになる。

- **対象**: `lib/cloudfront-cache-invalidator-stack.ts:12-19`
- **対応**: CDKスタック内でdistributionIdsと同様に空文字チェックを追加する

### 2. ブルートフォース対策なし（重要度: 中）

公開Function URLに対してレート制限・WAF・失敗回数制限がない。

- **対象**: `lib/cloudfront-cache-invalidator-stack.ts:61`
- **Claude Code見解**: 本ツールは「最低限のセキュリティによる非エンジニア向けキャッシュクリア手段」と位置づけており、WAF等の追加対策はスコープ外としている。READMEに追加対策の検討を促す記載は済み。

### 3. 認証情報の平文管理（重要度: 中）

CDK contextとLambda環境変数に平文で格納。シェル履歴やCIログに残るリスク。

- **対象**: `lib/cloudfront-cache-invalidator-stack.ts:12-19, 41-42`, `cdk.json:17-18`
- **Claude Code見解**: 本ツールの簡易性を優先した設計。Secrets Manager/SSMへの移行は過度な複雑化となるが、将来的な改善候補。

### 4. HTML出力のXSS脆弱性（重要度: 高）

`paths`（クエリ文字列由来）と`err.message`がHTMLエスケープなしで埋め込まれている。

- **対象**: `lambda/index.ts:110, 112, 147, 264`
- **対応**: HTMLエスケープ関数を追加して動的値を安全に埋め込む

### 5. GETでの状態変更操作（重要度: 中）

Basic認証ヘッダ付きGETでinvalidationが直接実行される。プリフェッチ・誤操作で副作用が発生する可能性。

- **対象**: `lambda/index.ts:171, 180, 208`
- **Claude Code見解**: curl互換性のためGET+Basic認証を維持している。ブラウザからのアクセスはPOSTのみで実行される設計のため、ブラウザでの誤操作リスクは低い。

### 6. pathsの入力バリデーション不足（重要度: 低）

件数・文字数・フォーマットの制限がなく、大量のinvalidationを投げられる可能性。

- **対象**: `lambda/index.ts:221-222`
- **対応**: パス件数上限と`/`開始チェックを追加する

## 良い点

- `distributionId`のallowlistとIAMリソース絞り込みは適切に実装されている
- `bin/app.ts`に単独での重大なセキュリティ問題はなし

## 対応方針

| 指摘 | 対応 |
|------|------|
| 1. 認証情報空文字 | 修正する（CDKで必須チェック追加） |
| 2. ブルートフォース | 現状維持（READMEで注意喚起済み） |
| 3. 平文管理 | 現状維持（簡易ツールの方針） |
| 4. XSS | 修正する（HTMLエスケープ追加） |
| 5. GETでの状態変更 | 現状維持（curl互換性優先） |
| 6. pathsバリデーション | 修正する（件数上限・フォーマットチェック） |
