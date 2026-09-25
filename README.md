# ☀️ TellMeWeather — 明日の洗濯・服装チェック

[![Deploy to GitHub Pages](https://github.com/kumakumapon/TellMeWheather/actions/workflows/deploy.yml/badge.svg)](https://github.com/kumakumapon/TellMeWheather/actions/workflows/deploy.yml)

![TellMeWeather - 家族の明日の天気・洗濯・服装をまとめて確認](assets/readme-hero.png)

🔗 **アプリURL**: [https://kumakumapon.github.io/TellMeWheather/](https://kumakumapon.github.io/TellMeWheather/)

---

## 📖 概要

**TellMeWeather** は、小学生・中学生のお子さんを持つ家庭向けの「明日の天気判定アプリ」です。

明日の天気データを自動取得し、

- 🧺 **洗濯の可否**（外干しOK / 部屋干し推奨 など）
- 👕 **子どもの服装アドバイス**（お子さんの学年・体感温度に合わせた推奨コーデ）
- 📅 **週間見通し**（明日・明後日の簡易天気と洗濯チャンス）

を一画面でまとめて表示します。

インストール不要、通知なし、ブラウザだけで動くシンプルなWebアプリです。

---

## 🚀 使い方

### 1. アプリを開く

[https://kumakumapon.github.io/TellMeWheather/](https://kumakumapon.github.io/TellMeWheather/) にアクセスします。

### 2. 設定する（初回のみ）

右上の「⚙️ 設定」タブを開き、以下を入力します。

| 項目 | 内容 |
|------|------|
| 市区町村名 | お住まいの地域名（例：東京、大阪市、札幌市） |
| 子どもの人数 | 1〜3人 |
| 各子どもの名前 | 任意（例：たろう） |
| 各子どもの学年 | 小1〜中3 |
| 各子どもの体感温度 | 寒がり / 普通 / 暑がり |
| 花粉考慮 | ON にすると春・秋の外干しに注意表示 |
| 強風考慮 | ON にすると強風時に外干し注意を表示 |

「💾 設定を保存」ボタンを押すと設定が保存されます。

### 3. ダッシュボードを確認する

「🏠 ダッシュボード」タブに戻ると、明日の天気・洗濯アドバイス・服装アドバイスが表示されます。

---

## 📋 仕様

### 技術仕様

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML / CSS / JavaScript（バニラ） |
| 天気API | [Open-Meteo](https://open-meteo.com/)（無料・APIキー不要・7日間予報） |
| ジオコーディング | [Nominatim](https://nominatim.openstreetmap.org/)（OpenStreetMap、無料・APIキー不要） |
| データ保存 | `localStorage`（ユーザー設定・キャッシュ） |
| ホスティング | GitHub Pages |

### 洗濯判定ロジック

| 条件 | 判定 |
|------|------|
| 降水量 > 0 または 降水確率 ≥ 50% | ❌ 部屋干し推奨 |
| 風速 ≥ 8m/s（強風考慮ON時） | ⚠️ 外干し注意 |
| 花粉シーズン（春/秋）かつ花粉考慮ON | ⚠️ 外干し注意 |
| 上記以外 | ✅ 外干しOK |

### 服装判定ロジック（明日の最高気温ベース）

| 最高気温 | 推奨服装 |
|----------|----------|
| 〜10℃ | コート＋長袖＋インナー |
| 11〜15℃ | 長袖＋上着 |
| 16〜20℃ | 長袖 or 半袖＋薄手パーカー |
| 21〜24℃ | 半袖＋薄手上着 |
| 25℃〜 | 半袖 |

- **寒がり**：気温 −2℃ として判定
- **暑がり**：気温 +2℃ として判定

### エラー時の動作

- APIエラー発生時は「データ取得に失敗しました」を表示
- 前回取得したデータがあれば、キャッシュを利用して表示

---

## 📁 ファイル構成

```
/
├── index.html            # メインHTML（ダッシュボード・設定の両ビュー）
├── style.css             # スタイル（スマホ最適化、淡いブルー/ホワイト系）
├── app.js                # メインコントローラー
├── assets/               # GPT Image 2 で生成した背景・アイコン・天気画像
├── components/
│   ├── utils.js          # 共通ユーティリティ（escapeHtmlなど）
│   ├── weather.js        # 天気API呼び出し・天気カード表示
│   ├── laundry.js        # 洗濯アドバイス判定・表示
│   ├── clothes.js        # 子どもの服装アドバイス判定・表示
│   ├── hourly.js         # 時間帯別予報・降雨タイムライン
│   ├── heatstroke.js     # 熱中症アラート
│   └── settings.js       # 設定フォーム・localStorageへの保存
└── .github/
    └── workflows/
        └── deploy.yml    # GitHub Pages 自動デプロイ
```

---

## 📄 ライセンス

[MIT License](LICENSE)
