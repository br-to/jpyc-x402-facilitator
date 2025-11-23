# JPYC X402 Facilitator (Polygon)

JPYCのEIP-3009を処理する[x402プロトコル](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator)準拠のfacilitatorサービスです（Polygon Mainnet向け）。

## 機能

- **x402プロトコル準拠**: Coinbase CDP x402標準に完全準拠
- **署名検証**: EIP-712形式の署名を検証
- **セキュリティチェック**:
  - 有効期限チェック（validAfter/validBefore）
  - nonceの重複チェック
  - 残高チェック
  - 金額の妥当性チェック
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

x402プロトコルに準拠したpaymentの検証を行います。

**リクエスト:**
```json
{
  "x402Version": 1,
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "polygon",
    "payload": {
      "signature": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f134800123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef1b",
      "authorization": {
        "from": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "to": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "value": "1000000000000000000",
        "validAfter": "0",
        "validBefore": "1763799685",
        "nonce": "0x1234567890abcdef1234567890abcdef12345678"
      }
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "polygon",
    "maxAmountRequired": "1000000000000000000",
    "resource": "https://api.example.com/premium/resource/123",
    "description": "Premium API access",
    "mimeType": "application/json",
    "payTo": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "maxTimeoutSeconds": 10,
    "asset": "0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c"
  }
}
```

**レスポンス（200 OK - 検証成功）:**
```json
{
  "isValid": true,
  "payer": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}
```

**レスポンス（200 OK - 検証失敗）:**
```json
{
  "isValid": false,
  "invalidReason": "insufficient_funds",
  "payer": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}
```

**レスポンス（400 Bad Request - リクエスト形式が不正）:**
```json
{
  "errorType": "invalid_request",
  "errorMessage": "Invalid request. Please check the request body and parameters."
}
```

**レスポンス（500 Internal Server Error - サーバーエラー）:**
```json
{
  "errorType": "internal_server_error",
  "errorMessage": "An internal server error occurred. Please try again later."
}
```

**Verifyの invalidReasonの種類:**
- `insufficient_funds`: 残高不足
- `invalid_scheme`: スキームが不正
- `invalid_network`: ネットワークが不正
- `invalid_x402_version`: x402バージョンが不正
- `invalid_payload`: ペイロードが不正
- `invalid_exact_evm_payload_authorization_value`: 金額が不正
- `invalid_exact_evm_payload_authorization_value_too_low`: 金額が不足
- `invalid_exact_evm_payload_authorization_valid_after`: validAfterが不正
- `invalid_exact_evm_payload_authorization_valid_before`: validBeforeが不正
- `invalid_exact_evm_payload_signature`: 署名が不正
- `invalid_exact_evm_payload_signature_address`: 署名アドレスが不一致

**Settleの errorReasonの種類:**
- 上記の `invalidReason` と同様、加えて：
- `settle_exact_svm_block_height_exceeded`: ブロック高が超過（Solana）
- `settle_exact_svm_transaction_confirmation_timed_out`: トランザクション確認タイムアウト（Solana）

### POST /settle

検証済みのx402 paymentをブロックチェーン上で実行します。

**リクエスト:**
```json
{
  "x402Version": 1,
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "polygon",
    "payload": {
      "signature": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f134800123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef1b",
      "authorization": {
        "from": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "to": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        "value": "1000000000000000000",
        "validAfter": "0",
        "validBefore": "1763799685",
        "nonce": "0x1234567890abcdef1234567890abcdef12345678"
      }
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "polygon",
    "maxAmountRequired": "1000000000000000000",
    "resource": "https://api.example.com/premium/resource/123",
    "description": "Premium API access",
    "mimeType": "application/json",
    "payTo": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "maxTimeoutSeconds": 10,
    "asset": "0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c"
  }
}
```

**レスポンス（200 OK - 決済成功）:**
```json
{
  "success": true,
  "payer": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "transaction": "0xabc123...",
  "network": "polygon"
}
```

**レスポンス（200 OK - 決済失敗）:**
```json
{
  "success": false,
  "errorReason": "insufficient_funds",
  "payer": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "transaction": "",
  "network": "polygon"
}
```

**レスポンス（400 Bad Request - リクエスト形式が不正）:**
```json
{
  "errorType": "invalid_request",
  "errorMessage": "Invalid request. Please check the request body and parameters."
}
```

**レスポンス（500 Internal Server Error - サーバーエラー）:**
```json
{
  "errorType": "internal_server_error",
  "errorMessage": "An internal server error occurred. Please try again later."
}
```

## x402プロトコル準拠

このfacilitatorは[Coinbase CDP x402プロトコル](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/verify-a-payment)に完全準拠しています：

- **standardized request/response**: x402標準のリクエスト/レスポンス形式
- **invalidReason**: 標準的なエラーコード
- **EIP-3009**: EIP-3009 (transferWithAuthorization) を使用

## セキュリティ

- nonceの重複チェック
  - メモリ内チェック（高速化のため）
  - コントラクトレベルでのnonce状態確認（確実性のため）
- 有効期限チェック（validAfter/validBefore）
- 残高チェック
- 署名検証（EIP-712）
- 金額の妥当性チェック（paymentRequirementsとの照合）
- 送金先アドレスの検証（payToとの照合）

## 注意事項

- 秘密鍵は厳重に管理してください
- 本番環境では、nonceの管理にRedisなどの永続化ストレージを使用することを推奨します
- RPC URLは信頼できるプロバイダーを使用してください
