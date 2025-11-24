# JPYC X402 Facilitator (Polygon)

JPYCのEIP-3009を処理する[x402プロトコル](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator)準拠のfacilitatorサービスです

## 概要

このプロジェクトは、EIP-3009（Transfer With Authorization）を実装したJPYCトークンの決済を、x402プロトコルに準拠した形で処理するファシリテーターサービスです。

## 技術スタック

- **言語**: TypeScript 5.9
- **ランタイム**: Node.js 24.11.1
- **Webフレームワーク**: Express 5.1
- **ブロックチェーンライブラリ**: Viem 2.39
- **パッケージマネージャー**: pnpm 10.18.3
- **ブロックチェーン**: Polygon Mainnet (Chain ID: 137)

## 機能

- **x402プロトコル準拠**: Coinbase CDP x402標準に完全準拠
- **署名検証**: EIP-712形式の署名を検証
- **セキュリティチェック**:
  - 有効期限チェック（validAfter/validBefore）
  - nonceの重複チェック
  - 残高チェック
  - 金額の妥当性チェック
  - 送金先アドレスの検証
- **トランザクション実行**: 検証済みのauthorizationをブロックチェーン上で実行

## アーキテクチャ

```
┌─────────────┐
│   Client    │ ─── EIP-712署名の作成
└──────┬──────┘
       │
       │ POST /verify / /settle
       │
┌──────▼──────────────────────────────────┐
│    Facilitator Server (Express)         │
│  ┌────────────────────────────────────┐ │
│  │  verifyService.ts                  │ │
│  │  - x402リクエスト検証              │ │
│  │  - Authorization検証               │ │
│  │  - EIP-712署名検証                 │ │
│  │  - 残高チェック                    │ │
│  │  - Nonce状態確認                   │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  settleService.ts                  │ │
│  │  - verifyServiceを呼び出し         │ │
│  │  - transferWithAuthorization実行   │ │
│  └────────────────────────────────────┘ │
└──────────┬───────────────────────────────┘
           │
           │ Viem (Web3クライアント)
           │
┌──────────▼───────────────────────────────┐
│     Polygon Blockchain (RPC)             │
│  ┌────────────────────────────────────┐  │
│  │  JPYC Contract (EIP-3009)          │  │
│  │  - transferWithAuthorization()     │  │
│  │  - authorizationState()            │  │
│  │  - balanceOf()                     │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 処理フロー

1. **Verify**: クライアントから受け取った署名付きauthorizationを検証
   - x402プロトコルの形式検証
   - Authorization内容の妥当性チェック
   - EIP-712署名の検証
   - 残高・nonce状態の確認

2. **Settle**: 検証済みのauthorizationをブロックチェーン上で実行
   - Verifyと同じ検証を実施
   - `transferWithAuthorization`関数を呼び出し
   - トランザクションハッシュを返却


## RPCプロバイダーの選定

このプロジェクトでは、Polygon MainnetへのアクセスにRPCプロバイダーを使用します。このプロジェクトでは**Alchemy**を使用していますが、Infuraやその他のRPCプロバイダーでも動作します。

### このプロジェクトでAlchemyを選んだ理由

開発時に以下の点で使いやすかったため、Alchemyを選択しました：

- **セットアップが簡単**: アカウント作成からAPI Key取得までスムーズ
- **無料プランが充実**: 開発・小規模運用には十分な無料枠（月間300M Compute Units）
- **ダッシュボードが使いやすい**: リクエストの監視やエラーの確認がしやすい
- **ドキュメントが充実**: 必要な情報にすぐアクセスできる

### RPCプロバイダーの選択

Alchemy以外にも、以下のRPCプロバイダーが利用可能です：

- **Infura**: 無料プランあり（100K req/日）、広く使われている
- **QuickNode**: 高パフォーマンス、有料プラン中心
- **Ankr**: 無料プランあり、複数チェーン対応

どのプロバイダーを選んでも、`.env`ファイルの`RPC_URL`を設定するだけで動作します。

### Alchemyのセットアップ例

1. [Alchemy](https://www.alchemy.com/)でアカウントを作成
2. Dashboardから "Create App" を選択
   - Chain: Polygon
   - Network: Polygon Mainnet
3. アプリの詳細画面から "VIEW KEY" をクリックしてAPI Keyを取得
4. `.env`ファイルに設定：

```env
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

## セットアップ

### 前提条件

- Polygon Mainnetへのアクセス権（Infura、Alchemyなど）
- リレイヤー用の秘密鍵（ガス代を支払うアカウント）

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/jpyc-x402-facilitator.git
cd jpyc-x402-facilitator
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

`.env`ファイルをプロジェクトルートに作成し、以下の変数を設定してください：

```env
# Polygon MainnetのRPC URL
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Infuraを使用する場合
# RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID

# リレイヤーの秘密鍵（ガス代を支払うアカウント）
RELAYER_PK=0xYOUR_PRIVATE_KEY

# JPYCコントラクトアドレス（Polygon Mainnet）
JPYC_CONTRACT_ADDRESS=0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29

# Chain ID（Polygon Mainnet = 137）
CHAIN_ID=137
```

### 4. サーバーの起動

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

## デプロイ

### Vercelへのデプロイ

このプロジェクトはVercelへのデプロイに対応しています。

1. Vercelアカウントを作成
2. GitHubリポジトリを連携
3. 環境変数を設定（Settings > Environment Variables）:
   - `RPC_URL`
   - `RELAYER_PK`
   - `JPYC_CONTRACT_ADDRESS`
   - `CHAIN_ID`
4. デプロイ

## 技術的な詳細

### EIP-3009: Transfer With Authorization

EIP-3009は、トークンの転送をガスレスで実行するための標準です。ユーザーは署名を作成し、第三者（ファシリテーター）がその署名を使ってトランザクションを実行します。

**メリット:**
- ユーザーはガス代を支払わなくて済む
- ユーザーはETH/MATICを保有する必要がない
- 1つの署名で複数のトークン転送が可能

### EIP-712: Typed Structured Data Hashing and Signing

EIP-712は、構造化されたデータに署名するための標準です。人間が読める形式で署名内容を表示できます。

**このプロジェクトでの使用:**
```typescript
{
  domain: {
    name: "JPY Coin",
    version: "1",
    chainId: 137,
    verifyingContract: "0x6AE7Dfc73E0dDE2aa99ac063DcF7e8A63265108c"
  },
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  }
}
```

## 開発

### プロジェクト構成

```
src/
├── server.ts          # Expressサーバーのメインファイル
├── verifyService.ts   # 署名検証ロジック
├── settleService.ts   # トランザクション実行ロジック
├── common.ts          # Viemクライアントの設定
├── jpycAbi.ts         # JPYCコントラクトのABI
├── types.ts           # TypeScript型定義
└── env.ts             # 環境変数のバリデーション
```

### テスト

```bash
# 開発サーバーを起動
pnpm dev

# 別のターミナルでcurlでテスト
curl -X POST http://localhost:4021/verify \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

## トラブルシューティング

### よくある問題

**1. `Missing required environment variables` エラー**
- `.env`ファイルが正しく設定されているか確認
- すべての必須環境変数が設定されているか確認

**2. `insufficient_funds` エラー**
- リレイヤーアカウントにMATICが十分にあるか確認
- ユーザーのJPYC残高が十分にあるか確認

**3. 署名検証エラー**
- EIP-712の署名が正しく生成されているか確認
- `chainId`と`verifyingContract`が正しいか確認
- nonceが既に使用されていないか確認


## 注意事項

- **秘密鍵の管理**: `RELAYER_PK`は厳重に管理してください。GitHubにコミットしないよう`.gitignore`を確認してください
- **本番環境**: 本番環境では、nonceの管理にRedisなどの永続化ストレージを使用することを推奨します
- **RPC URL**: 信頼できるプロバイダー（Infura、Alchemyなど）を使用してください
- **ガス代**: リレイヤーアカウントには常に十分なMATICを保持してください

## 参考リンク

### プロトコル・標準
- [x402 Protocol Documentation](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)

### JPYC
- [JPYC Official Website](https://jpyc.jp/)
- [JPYC ドキュメント](https://docs.jpyc.jp/)

### 開発ツール
- [Viem Documentation](https://viem.sh/)
- [Express.js Documentation](https://expressjs.com/)

### RPCプロバイダー
- [Alchemy](https://www.alchemy.com/) - 推奨RPCプロバイダー
- [Alchemy Documentation](https://docs.alchemy.com/)
- [Infura](https://www.infura.io/)
- [QuickNode](https://www.quicknode.com/)
