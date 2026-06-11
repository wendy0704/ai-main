# 迷局 — AI 劇本殺主持人

> 2026 年 6 月　期末專題版本

迷局是一款 AI 驅動的單人謀殺推理遊戲（劇本殺）。玩家扮演偵探，在有限的行動力（AP）內蒐集線索、審問嫌疑人，最終指認兇手並說明動機與手法。每局劇本由 Claude Sonnet 即時生成，場景、角色、兇案細節皆不重複。

---

## 快速開始

### 需求

- [Node.js](https://nodejs.org/) v18 以上
- [OpenAI API Key](https://platform.openai.com/api-keys)（需要在 platform.openai.com 儲值才能使用）

### 安裝與啟動

```bash
# 1. Clone 專案
git clone https://github.com/wendy0704/ai-main.git
cd ai-main

# 2. 安裝相依套件
npm install

# 3. 建立 .env 檔案並填入 API 金鑰
# macOS / Linux：
echo "OPENAI_API_KEY=你的金鑰" > .env
# Windows：請用記事本直接建立 .env 檔，內容填入（不要用 echo 指令，會把引號一起寫入）：
# OPENAI_API_KEY=你的金鑰

# 4. 啟動伺服器
node server.js
```

啟動後開啟瀏覽器前往 [http://localhost:3000](http://localhost:3000) 即可開始遊戲。

### 對外分享（ngrok）

如果想讓其他人也能玩，可用 ngrok 建立公開網址：

```bash
# 安裝 ngrok（若尚未安裝）
brew install ngrok  # macOS

# 開啟通道
ngrok http 3000
```

ngrok 會產生一組 `https://xxxx.ngrok-free.app` 網址，分享給對方即可。

---

## 遊戲玩法

1. 輸入偵探名字，點「確認，生成劇本」
2. 等待 AI 生成原創謀殺案（約 10-20 秒）
3. 使用 **10 點行動力（AP）** 自由搜查、審問、施壓
4. 蒐集足夠線索後點「做出最終指控」
5. 指認兇手、填寫動機與手法，看看破案成績

---

## 專案概述

| 項目 | 說明 |
|------|------|
| 技術棧 | Node.js + Express 後端、原生 HTML/CSS/JS 前端、Anthropic Claude API |
| AI 模型 | gpt-4o（劇本生成 / GM 行動 / 結局評分） |
| 串流方式 | SSE（Server-Sent Events）實現打字機效果 |
| 遊戲時長 | 單局約 10 分鐘，10 點 AP 限制 |

---

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `server.js` | 後端主程式：Express API 路由、AI Prompt、評分邏輯 |
| `host.js` | 前端遊戲控制器：狀態管理、SSE 接收、UI 渲染 |
| `generator.js` | 劇本生成呼叫與驗證 |
| `styles.css` | 全部 CSS：版面、配色主題、動畫 |
| `index.html` | 單頁應用 HTML：所有畫面結構 |

---

## API 端點

### POST `/api/generate`

接收玩家名稱，呼叫 Claude 一次性生成完整劇本 JSON。

- `max_tokens`：5000（容納完整 JSON schema）
- system prompt 使用 `cache_control: ephemeral` 降低延遲
- 回傳：title, setting, victim, npcs, clues, socialIssue, literaryConnection 等完整劇本

### POST `/api/action`（SSE 串流）

接收玩家行動，以 SSE 串流回傳 GM 回應。

- `Content-Type: text/event-stream`，即時傳送 `{ t:"c", v:"文字片段" }`
- 收集完整後傳送 `{ t:"done", data, conversationHistory }`
- conversationHistory 保留最近 12 則，避免 token 超量
- `max_tokens`：1800

### POST `/api/accuse`

接收玩家最終指控，由 Claude 評分並生成結局，一般 JSON 回應（非串流）。

- 評分項目：兇手（40）、動機（20）、手法（20）、AP 效率（10）、線索（10）、互動深度（20），滿分 120
- `max_tokens`：600

---

## NPC 資料結構（每局 3 人）

| 欄位 | 說明 |
|------|------|
| `id` | n0 / n1 / n2，用於前端對應與 gameState 索引 |
| `name` / `role` | 姓名（2-3字）、身份（4-8字） |
| `personality` | 性格特質（3-5字），顯示於嫌疑人檔案標籤 |
| `background` | 角色背景故事（15-25字），一開始即顯示 |
| `victimRelationship` | 與被害者的關係（8-15字），一開始即顯示 |
| `surfaceSecret` | 表層秘密：壓力 ≥ pressureThreshold 時解鎖顯示 |
| `coreSecret` | 核心秘密：NPC 崩潰後揭露，兇手的 coreSecret 含作案事實 |
| `pressureThreshold` | 解鎖表層秘密所需壓力值（預設 60/100） |
| `isKiller` | 恰好 1 個 true |
| `issueStance` | sympathize / condemn / silent，三人各不同 |
| `initialLie` | 初始謊言，GM 用來引導 NPC 說謊 |
| `relationships` | 與其他 NPC 的關係陣列 `{ targetId, desc }` |

---

## 劇本 JSON 其他欄位

| 欄位 | 說明 |
|------|------|
| `title` | 劇本標題（4-8字） |
| `setting` | name / desc / rooms（5個房間） |
| `victim` | name / role / secret |
| `socialIssue` | theme / context / killerBackground（社會議題，影響結局反思） |
| `weapon` | name / detail |
| `killerTruth` | killerId / motive / method（後端隱藏，不傳前端） |
| `clues` | 6條預設線索（physical × 2、testimony × 2、environmental × 2） |
| `misleadingClue` | 指向無辜 NPC 的誤導線索 |
| `keyClueIds` | 3個關鍵線索 id，計分用 |
| `hiddenEvent` | 第3回合自動觸發的突發事件 |
| `literaryConnection` | theme / reflection / relatedWorks / reflectionQuestion（結局顯示） |
| `openingNarration` | 開場沉浸式敘述（100-150字） |
| `initialOptions` | 開場3個選項 |

---

## 前端 gameState

| 欄位 | 說明 |
|------|------|
| `apRemaining` | 剩餘 AP（初始 10） |
| `apUsed` | 已用 AP，計算回合數 |
| `round` | 當前回合（每 2.5AP 進一回合） |
| `npcPressure` | 各 NPC 壓力值 `{ npcId: 0-100 }` |
| `npcTrust` | 各 NPC 信任值 `{ npcId: 0-100 }` |
| `npcBroken` | 各 NPC 崩潰狀態 `{ npcId: boolean }` |
| `cluesFound` | 已發現線索陣列，每條含 type/label/text/isKey/npcId |
| `coreSecretsFound` | 已揭露核心秘密數量，計入互動分 |
| `hiddenEventTriggered` | 隱藏事件是否已觸發 |
| `conversationHistory` | 傳給 /api/action 的對話記錄（最多 12 則） |

---

## 嫌疑人檔案（卷宗設計）

嫌疑人檔案顯示角色背景資訊，目的是讓玩家在整局遊戲中隨時查閱角色身份，搭配左欄的線索筆記本做推理。

| 時機 | 顯示內容 |
|------|---------|
| 一開始 | personality 標籤、victimRelationship、background |
| 壓力到門檻 | surfaceSecret 解鎖（淡入動畫） |
| NPC 崩潰後 | coreSecret 以紅色粗體揭露 |

**與線索筆記本的分工：**

- 線索筆記本（左欄）：記錄「找到了什麼」——物證、人證、環境線索
- 嫌疑人檔案（右欄）：記錄「這個人是誰」——背景、關係、秘密

---

## SSE 串流機制

| 端 | 說明 |
|----|------|
| 後端 | 設定 `Content-Type: text/event-stream`，逐字傳送 `{ t:"c", v:"片段" }`，最後傳 `{ t:"done", data }` |
| 前端 | 呼叫後立即顯示跳動小點，用 ReadableStream 接收，累積到 done 才更新 UI |
| 好處 | 使用者立即看到回應中（跳動點），完整回應後再一次性更新所有 UI |

---

## 社會議題系統

每局劇本包含一個社會議題（職場剝削、家庭暴力、階級壓迫等），融入角色動機與背景設定，在結局集中呈現。

| 階段 | 說明 |
|------|------|
| 生成階段 | socialIssue.theme / context / killerBackground 由 Claude 生成 |
| 遊戲中 | 議題自然融入 NPC 對話，三名 NPC 各持不同立場（sympathize/condemn/silent） |
| 結局 | 真相揭曉後顯示「本案議題」區塊，提供反思問題與相關作品 |
| 設計原因 | 10 AP 不足以同時完成主線推理與議題探索，議題改在結局呈現衝擊感更強 |

---

## 配色主題系統

主題選色器常駐於頁首右上角，支援 localStorage 持久化，遊戲途中可隨時切換。

| 主題 | 說明 |
|------|------|
| 預設 | 米白底（#f5f0e8）、深紅印章（#b83232） |
| 薄荷綠 | 綠底（#ddeae2）、深綠印章（#1a6838） |
| 琥珀黃 | 暖黃底（#ede4c0）、琥珀印章（#c07800） |
| 鋼鐵藍 | 藍灰底（#cfd8e4）、深藍印章（#163460） |
| 隨機 | 每次點擊從四種主題中隨機選一 |

---

## 評分系統（滿分 120）

| 項目 | 分數 |
|------|------|
| 兇手指認 | 40 分（正確 40 / 錯誤 0） |
| 動機分析 | 0-20 分（Claude 語意評分，兇手答錯則歸零） |
| 手法推理 | 0-20 分（Claude 語意評分，兇手答錯則歸零） |
| 調查效率（剩餘 AP） | 0-10 分（剩餘 AP / 10 × 10） |
| 線索完整度 | 0-10 分（isKey 線索找到數 / 3 × 10） |
| 互動深度 | 0-20 分（隱藏事件 +10、每個核心秘密 +5，上限 20） |

| 稱號 | 分數門檻 |
|------|---------|
| 神探 | 108 分以上 |
| 優秀偵探 | 84–107 分 |
| 運氣型偵探 | 60–83 分 |
| 差點抓到的傢伙 | 36–59 分 |
| 被兇手耍了 | 35 分以下 |

---

## 前端畫面流程

| 畫面 | 說明 |
|------|------|
| `screen-home` | 首頁：遊戲說明、開始按鈕 |
| `screen-setup` | 偵探設定：輸入名字，確認後呼叫 /api/generate |
| `screen-loading` | 生成中：進度條動畫 |
| `screen-game` | 遊戲主畫面：雙欄佈局（左：故事互動 / 右：嫌疑人狀態檔案） |
| `screen-accusation` | 最終指控：選擇兇手、輸入動機與手法 |
| `screen-ending` | 結局：評分、真相揭曉、社會議題反思 |

---

## 版面配置（screen-game）

| 區塊 | 內容 |
|------|------|
| `game-left` | 主持人氣泡、故事文字、系統提示、線索筆記本、行動選項、自由輸入、指認按鈕 |
| `game-right` | 嫌疑人狀態（壓力條）、嫌疑人檔案（卷宗） |
| 嫌疑人狀態面板 | 每個 NPC 顯示壓力條（0-100）與崩潰標籤 |
| 嫌疑人檔案 | 可收合卷宗，顯示背景 → 漸進解鎖秘密 |
| 線索筆記本 | 可收合，依時序列出所有已發現線索，含類型標籤與 ★ 標記 |

---

*迷局 · AI 劇本殺主持人 © 2026 期末專題*
