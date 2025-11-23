# JPYC X402 Facilitator (Polygon)

JPYCのEIP-3009を処理するfacilitatorサービスです（Polygon Mainnet向け）。

## 機能

- **署名検証**: EIP-712形式の署名を検証
- **セキュリティチェック**:
  - 有効期限チェック（validAfter/validBefore）
  - nonceの重複チェック
  - 残高チェック
- **トランザクション実行**: 検証済みのauthorizationをブロックチェーン上で実行

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下の変数を設定してください：

```env
RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
RELAYER_PK=0x...
JPYC_CONTRACT_ADDRESS=0x...
CHAIN_ID=137
PORT=4021  # オプション（デフォルト: 4021）
```

### 3. サーバーの起動

```bash
pnpm dev
```

## API エンドポイント

### GET /health

ヘルスチェックエンドポイント

**レスポンス:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "jpyc-x402-facilitator-polygon"
}
```

### POST /verify

authorizationの署名を検証します。

**リクエスト:**
```json
{
  "auth": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000",
    "validAfter": "0",
    "validBefore": "1763799685",
    "nonce": "0x...",
    "v": 28,
    "r": "0x...",
    "s": "0x..."
  }
}
```

**レスポンス（成功）:**
```json
{
  "ok": true
}
```

**レスポンス（失敗）:**
```json
{
  "ok": false,
  "error": "Invalid signature"
}
```

### POST /settle

検証済みのauthorizationをブロックチェーン上で実行します。

**リクエスト:**
```json
{
  "auth": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000",
    "validAfter": "0",
    "validBefore": "1763799685",
    "nonce": "0x...",
    "v": 28,
    "r": "0x...",
    "s": "0x..."
  }
}
```

**レスポンス（成功）:**
```json
{
  "ok": true,
  "txHash": "0x..."
}
```

**レスポンス（失敗）:**
```json
{
  "ok": false,
  "error": "Authorization verification failed"
}
```

## セキュリティ

- nonceの重複チェック
  - メモリ内チェック（高速化のため）
  - コントラクトレベルでのnonce状態確認（確実性のため）
- 有効期限チェック
- 残高チェック
- 署名検証

## 注意事項

- 秘密鍵は厳重に管理してください
