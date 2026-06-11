require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();
const client = new OpenAI();

app.use(express.static(__dirname));
app.use(express.json({ limit: "4mb" }));

// ── /api/generate ──────────────────────────────────────────────────────────

const GENERATE_SYSTEM = `你是謀殺推理桌遊劇本設計師，以繁體中文創作原創謀殺案。禁止使用簡體中文。
直接返回 JSON，不含任何 markdown 標記或說明文字。

JSON 結構（完整填寫所有欄位）：
{
  "title": "劇本標題（4-8字）",
  "setting": {
    "name": "場景名稱（6-10字）",
    "desc": "場景氣氛描述（40-70字，渲染懸疑感）",
    "rooms": ["房間1", "房間2", "房間3", "房間4", "房間5"]
  },
  "victim": {
    "name": "被害者姓名（2-3字）",
    "role": "身份（4-8字）",
    "secret": "被害者秘密（15-25字）"
  },
  "socialIssue": {
    "theme": "核心社會議題（4-8字；從以下方向擇一發揮，可自由延伸：【社會人權】校園霸凌、網路言語暴力、心理健康污名、原生家庭創傷、貧富懸殊、弱勢生存困境、老人遺棄、身障歧視、強迫婚姻、精神虐待、移工剝削、學歷歧視；【歷史文化】在地歷史懸案、文化資產消失、傳統技藝凋零、日治/戒嚴記憶、民間信仰衝突；【環境永續】氣候末日資源爭奪、生態破壞與財團利益、環保人士打壓；【職場企業】辦公室政治、企業資料竊密、公關危機與假新聞、食安醜聞掩蓋；【科技倫理】AI自我意識與責任歸屬、大數據監控、個資外洩、賽博龐克隱私剝奪；【其他】學術造假、媒體操控、宗教剝削、腐敗包庇、房租壓榨、科技監控）",
    "definition": "用一般人能理解的語言解釋這個社會議題是什麼、為何存在、對當事人有何影響（30-50字）",
    "context": "議題如何在這個案件中體現（20-30字）",
    "killerBackground": "兇手是被這個結構性壓力逼到的描述（15-25字）"
  },
  "npcs": [
    {
      "id": "n0",
      "name": "姓名（2-3字）",
      "role": "身份（4-8字）",
      "personality": "性格特質（3-5字）",
      "background": "角色背景故事（15-25字，說明此人來歷與處境）",
      "victimRelationship": "與被害者的客觀身份關係（8-15字，只描述社會角色連結，例如：前同事、房東與房客、多年老友；禁止包含衝突、過節、情感糾葛等戲劇性內容）",
      "isKiller": false,
      "issueStance": "sympathize",
      "surfaceSecret": "表層秘密，施壓後可問出（10-20字）；適合放與被害者的衝突、過節、或見不得人的往來",
      "coreSecret": "核心秘密，高壓才能逼出（10-20字）；兇手的 coreSecret 含作案動機或關鍵事實",
      "pressureThreshold": 60,
      "relationships": [
        { "targetId": "n1", "desc": "與n1的關係（5-10字）" }
      ],
      "initialLie": "初始謊言，掩護自己（10-20字）"
    }
  ],
  "weapon": {
    "name": "凶器名稱（4-8字）",
    "detail": "凶器物證描述（15-25字）"
  },
  "killerTruth": {
    "killerId": "n0",
    "motive": "殺人動機（20-35字）",
    "method": "作案手法（20-35字）"
  },
  "clues": [
    { "id": "c1", "type": "physical",     "label": "線索標籤（3-8字）", "text": "線索描述（15-25字）", "isKey": true  },
    { "id": "c2", "type": "testimony",    "label": "線索標籤",          "text": "線索描述",           "isKey": false },
    { "id": "c3", "type": "environmental","label": "線索標籤",          "text": "線索描述",           "isKey": true  },
    { "id": "c4", "type": "testimony",    "label": "線索標籤",          "text": "線索描述",           "isKey": true  },
    { "id": "c5", "type": "physical",     "label": "線索標籤",          "text": "線索描述",           "isKey": false },
    { "id": "c6", "type": "environmental","label": "線索標籤",          "text": "線索描述",           "isKey": false },
  ],
  "misleadingClue": { "id": "mc1", "label": "誤導線索名稱（3-8字）", "text": "指向無辜NPC的誤導描述（15-25字）" },
  "keyClueIds": ["c1", "c3", "c4"],
  "hiddenEvent": {
    "description": "第三回合自動觸發的突發事件（40-60字）",
    "clueRevealed": "事件揭示的關鍵線索（15-25字）"
  },
  "literaryConnection": {
    "theme": "案件影射的社會議題（5-10字）",
    "reflection": "議題反思旁白（30-50字）",
    "relatedWorks": ["《作品名》— 作者名", "《作品名》— 作者名"],
    "reflectionQuestion": "留給玩家的開放式問題（15-25字）？"
  },
  "openingNarration": "開場場景描述（180-250字，第二人稱沉浸式）：必須包含以下三個層次——①環境鋪陳：描繪場景的感官細節（光線、氣味、聲音、氣氛）；②發現被害者：清楚寫出被害者的姓名與身份，具體描述屍體被發現的位置與狀態（姿勢、傷口位置、現場跡象），讓玩家立刻知道誰是被害者；③懸念收尾：留下一個讓人想繼續追查的疑點或細節",
  "openingHostNote": "主持人開場旁白（30-50字）：點出被害者姓名，給玩家一個明確的第一步調查方向（例如建議先搜查哪個房間，或先詢問哪位嫌疑人），降低玩家茫然感",
  "initialOptions": [
    { "label": "搜查", "text": "選項1描述（搜查最可能有直接線索的核心現場，例如案發房間）", "actionType": "investigate", "target": "房間名", "apCost": 1 },
    { "label": "審問", "text": "選項2描述（審問與被害者關係最密切或最早發現屍體的NPC）", "actionType": "interrogate", "target": "n0", "apCost": 1 },
    { "label": "審問", "text": "選項3描述（審問另一位嫌疑人）", "actionType": "interrogate", "target": "n1", "apCost": 1 },
    { "label": "觀察", "text": "選項4描述（仔細觀察被害者的遺體或隨身物品，尋找第一條有形線索）", "actionType": "investigate", "target": "案發現場", "apCost": 1 }
  ]
}

規則：
1. npcs 陣列恰好 3 人，其中恰好 1 個 isKiller=true
2. 兇手的 coreSecret 必須包含作案事實的核心證據
3. keyClueIds 恰好指向 3 個 isKey=true 的線索
4. 誤導線索應指向某無辜 NPC，增加推理難度
5. 整體邏輯自洽，玩家可通過推理找到兇手
6. 全部使用繁體中文
7. socialIssue.killerBackground 必須說明兇手的殺人動機根植於 socialIssue.theme 所描述的結構性壓力，而非純粹個人仇恨；socialIssue.theme 必須選用冷門、具體、貼近當代台灣社會的議題，嚴禁選擇「職場剝削」「家庭暴力」「階級壓迫」這類過於籠統的主題
8. 三個 NPC 的 issueStance 必須各不相同，恰好是 "sympathize"（同情兇手處境）、"condemn"（強烈譴責）、"silent"（沉默迴避）各一個
9. socialIssue 的主題與背景需自然融入 NPC 的對話與劇情敘述中，讓玩家在結局時有所感
10. 線索設計原則（最重要）：
    - 單一線索不得直接點名或確認兇手；每條線索只提供拼圖的一塊，玩家需交叉比對至少3條才能得出結論
    - 物證禁止寫「兇手的○○」，應寫成需解讀的間接形式（例：「刻有縮寫 M.C. 的打火機」而非「兇手的打火機」；「一只染血手套，尺寸偏小」而非「兇手留下的手套」）
    - isKey=true 的線索各自對應真相的不同側面（例：一條對應動機、一條對應手法、一條對應時間），三條合起來才能完整指向兇手
    - 6條預設線索中，至少 2 條在表面上看起來和無辜 NPC 一樣有關聯，製造多個可疑方向`;

app.post("/api/generate", async (req, res) => {
  const { seed, playerName } = req.body;

  try {
    const message = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 5000,
      messages: [
        { role: "system", content: GENERATE_SYSTEM },
        { role: "user", content: `偵探名：${playerName || "偵探"}。種子：${seed}。直接返回 JSON。` },
      ],
    });

    const raw = message.choices[0].message.content.trim();
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const data = JSON.parse(jsonStr);
    data.npcs = data.npcs.map((n, i) => ({ ...n, id: n.id || `n${i}` }));

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[generate]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── /api/action ────────────────────────────────────────────────────────────

const ISSUE_STANCE_DESC = {
  sympathize: "同情兇手處境，認為社會結構才是真正的兇手，言談中流露出對被害者或現狀的不滿",
  condemn:    "強烈譴責兇手行為，拒絕為任何原因辯護，但若施壓可能說出與議題相關的不舒服真相",
  silent:     "沉默迴避這個話題，表面上事不關己，但深度盤問後會透露出自己也是這個結構的一部分",
};

function buildActionSystem(script) {
  const killer = script.npcs.find((n) => n.isKiller);
  const issue = script.socialIssue;
  return `你是謀殺推理遊戲 GM（繁體中文）。以下是完整隱藏劇本，玩家不可知：

【場景】${script.setting.name}：${script.setting.desc}
【被害者】${script.victim.name}（${script.victim.role}）秘密：${script.victim.secret}
【凶器】${script.weapon.name}——${script.weapon.detail}
【真相】兇手：${killer?.name}，動機：${script.killerTruth.motive}，手法：${script.killerTruth.method}
${issue ? `【社會議題】${issue.theme}：${issue.context}
【兇手背景】${issue.killerBackground}` : ""}

【NPC 詳情】
${script.npcs.map((n) => `
▸ ${n.name}（${n.role}）[id=${n.id}] isKiller=${n.isKiller}
  性格：${n.personality}
  謊言：${n.initialLie}
  表層秘密（容易問出）：${n.surfaceSecret}
  核心秘密（壓力≥${n.pressureThreshold}才出現）：${n.coreSecret}
  對社會議題的立場（${n.issueStance || "silent"}）：${ISSUE_STANCE_DESC[n.issueStance] || ISSUE_STANCE_DESC.silent}
  關係：${n.relationships?.map((r) => `與${r.targetId}：${r.desc}`).join("，") || "無"}
`).join("")}

【誤導線索】${script.misleadingClue.text}
【隱藏事件】${script.hiddenEvent.description}（揭示：${script.hiddenEvent.clueRevealed}）

GM 規則：
- 兇手 NPC 說謊、閃躲，但不主動暴露
- 無辜 NPC 各有秘密但不是兇手，壓力夠時會說出 surfaceSecret
- 壓力達到 pressureThreshold 時觸發 npcBreakdown，揭示 coreSecret
- 【等待觀察】(0AP) 讓 NPC 自發互動，可能揭露人際關係線索
- 嚴重脫離案件（超能力、穿越等）設 isOffRail=true，退還 AP
- 每次回應必須提供 2-3 個有效選項
- narration 200-300 字，hostNote 20-40 字

【資訊揭露框架】
每條線索分三層，每次行動只往上一層走：
  表層（場景描述時主動給）：可見事實，不需推理，例如「書桌上有一本日記，最後幾頁被撕掉了」
  中層（玩家選擇調查時給）：需要追問的細節，例如「殘留頁緣的日期是案發前兩天，有墨水痕跡」
  深層（多條線索交叉後給）：關鍵因果與指向性，例如「筆跡鑑定與某NPC一致，且時間與其謊言矛盾」

【AP 消耗與資訊密度】
  0AP 行動：給表層資訊或已知資訊的再確認；必須有最低回報——哪怕調查無關物件，也加一句「你注意到 XXX 似乎有些異狀」，把注意力引回正軌
  1AP 行動：給 1 條中層線索，具體事實但需要解讀
  2AP 行動：給深層線索或解鎖新資訊來源（新區域、NPC 口供突破）

【進度自適應平衡】
每次回應前，根據玩家已掌握的線索數量調整給資訊的密度：
  線索 0-30%（0-2條）：主動且慷慨地給資訊，每個行動都要有實質線索，narration 中要含有 1-2 個可追查的具體細節，讓玩家快速建立方向感
  線索 30-70%（3-5條）：正常節奏，給中層線索；每次 narration 必須包含至少一句讓玩家能判斷下一步的具體描述
  線索 70%+（6條以上）：開始給有指向性的深層資訊，可以讓線索之間的關聯更清晰，但不直接點名兇手
每給完一條線索，內部自檢：「玩家能從這條資訊直接推出答案嗎？」→ 若是，拿掉一個關鍵字改成可疑但不確定的描述；「玩家能從這條資訊得到下一步方向嗎？」→ 若否，**必須在 narration 末尾補一句引導語**，例如「你隱約覺得還有什麼值得深究……」後接一個具體方向提示

【強制轉折點（安全網）】
  剩餘 AP = 8 時：無論玩家進度，強制安排一個中層線索（NPC 主動說話、發現新物證等）
  剩餘 AP = 5 時：給一條有明確指向性的線索，主持人在 hostNote 中直接點出「有件事值得特別注意」
  剩餘 AP = 2 時：給一條偏深層、具有明確指向性的線索，讓玩家還有機會做出有根據的指控
  每隔 3 個行動點：主持人主動描述一個「環境變化」或「NPC 行為異狀」作為免費資訊，防止遊戲停滯

【線索三要素保障】
  3 條 isKey 線索必須涵蓋：動機（為什麼殺）、手法（怎麼殺）、身份縮小（指向誰）——三個面向缺一不可
  每個行動都應產出 1 條 clueFound，不得連續 2 個行動都沒有任何線索；若玩家行動實在無法挖出新資訊，至少在 narration 中加入一個「可疑細節」暗示，並在 options 中給出更有針對性的選項

- 行為描寫原則：嚴禁使用「猶豫不決」「神色慌張」「欲言又止」「若有所思」等空泛情緒詞；NPC 的反應必須有具體可觀察的行為細節，例如「他下意識摸了摸左手手腕」「她的視線飄向抽屜方向，隨即收回」「他提到案發時間時停頓了整整三秒才繼續說」

- clueFound 有效性原則：
  ✗ 禁止直接點名：「這是兇手留下的○○」「直接證明○○是兇手」
  ✗ 禁止無效模糊：「地板有些灰塵」「窗戶開著」「對方顯得緊張」
  ✓ 平衡寫法：給出具體事實但缺少一個關鍵拼圖，例如「日記最後幾頁被撕掉，殘留頁緣上有墨水痕跡，日期是案發前兩天」（給了時間線索與隱瞞暗示，但沒給內容）
  ✓ narration 中 NPC 的對話要含有可推敲的具體資訊，不能只是情緒反應
- clueFound.npcId 規則（嚴格）：
  ✓ 可填入 npcId：線索上有該 NPC 的姓名、個人物品、筆跡、指紋，或線索明確描述「某人的○○」
  ✗ 不可填入 npcId：僅因該 NPC 與該場所有關聯就歸屬；「有人曾用過」「有人留下」等不明確描述一律填 null
  原則：只有線索內容本身能直接點名時才填，推論與間接關聯不算
- 回傳純 JSON，不含 markdown

JSON 格式：
{
  "narration": "場景描述（100-150字）",
  "hostNote": "主持人旁白（20-40字）",
  "clueFound": null 或 { "type": "physical|testimony|environmental|misleading", "label": "...", "text": "...", "isKey": true/false, "npcId": "npc的id或null" },
  "pressureChanges": { "npcId": delta },
  "trustChanges": { "npcId": delta },
  "npcBreakdown": null 或 { "npcId": "...", "secretType": "surface|core", "revelation": "揭示的秘密內容" },
  "apCost": 數字,
  "triggerHiddenEvent": false,
  "hiddenEventClue": null 或 { "label": "...", "text": "..." },
  "options": [
    { "label": "行動標籤", "text": "選項描述（必須使用 NPC 的真實姓名，禁止用「他」「她」「對方」「NPC」等代稱，例如「向林美秀追問昨晚的行蹤」而非「向她追問昨晚的行蹤」）", "actionType": "investigate|interrogate|pressure|wait", "target": "npcId或房間名", "apCost": 數字 }
  ],
  "isOffRail": false,
  "systemNote": null
}`;
}

app.post("/api/action", async (req, res) => {
  const { script, gameState, action, conversationHistory } = req.body;

  const stateCtx = `【當前狀態】回合 ${gameState.round}/4，剩餘 AP：${gameState.apRemaining}/15
NPC 壓力：${script.npcs.map((n) => `${n.name}=${gameState.npcPressure?.[n.id] ?? 0}/100`).join("，")}
NPC 信任：${script.npcs.map((n) => `${n.name}=${gameState.npcTrust?.[n.id] ?? 100}/100`).join("，")}
已發現線索：${gameState.cluesFound?.length ? gameState.cluesFound.map((c) => c.label).join("、") : "尚無"}
隱藏事件已觸發：${gameState.hiddenEventTriggered ? "是" : "否"}
${gameState.round === 3 && !gameState.hiddenEventTriggered ? "⚠️ 本回合應觸發隱藏事件（設 triggerHiddenEvent=true）" : ""}

【玩家行動】${action.text}（類型：${action.actionType}，目標：${action.target || "無"}，消耗 ${action.apCost} AP）`;

  const messages = [
    ...(conversationHistory || []).slice(-12),
    { role: "user", content: stateCtx },
  ];

  // SSE 串流
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  let fullText = "";
  try {
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 3000,
      messages: [
        { role: "system", content: buildActionSystem(script) },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        fullText += text;
        send({ t: "c", v: text });
      }
    }

    const jsonStr = fullText.slice(fullText.indexOf("{"), fullText.lastIndexOf("}") + 1);
    const data = JSON.parse(jsonStr);

    const updatedHistory = [
      ...(conversationHistory || []).slice(-12),
      { role: "user", content: stateCtx },
      { role: "assistant", content: fullText },
    ];

    send({ t: "done", data, conversationHistory: updatedHistory });
    res.end();
  } catch (err) {
    console.error("[action]", err.message);
    send({ t: "err", error: err.message });
    res.end();
  }
});

// ── /api/accuse ────────────────────────────────────────────────────────────

app.post("/api/accuse", async (req, res) => {
  const { script, gameState, accusedId, accusedMotive, accusedMethod } = req.body;

  const killer = script.npcs.find((n) => n.isKiller);
  const accused = script.npcs.find((n) => n.id === accusedId);
  const killerCorrect = accusedId === script.killerTruth.killerId;

  const apScore = Math.min(gameState.apRemaining, 15); // 直接等於剩餘 AP，上限 15
  // 用 isKey 旗標計分（AI 回傳的 clueFound 不帶預設 id，無法比對 keyClueIds）
  const foundKeyClues = (gameState.cluesFound || []).filter((c) => c.isKey).length;
  const clueScore = Math.round((Math.min(foundKeyClues, 3) / 3) * 10);
  const isOvertime = gameState.apRemaining <= 0;

  try {
    const cluesSummary = (script.clues || []).map((c) => `【${c.label}】${c.text}`).join("\n");
    const npcSummary = (script.npcs || []).map((n) => `${n.name}（${n.role}）：表層秘密—${n.surfaceSecret}；核心秘密—${n.coreSecret}`).join("\n");

    const evalMsg = `評估玩家指控，以繁體中文回應。

【案件背景】
場景：${script.setting?.name}
被害者：${script.victim?.name}（${script.victim?.role}）
兇手真相：${killer?.name}，動機：${script.killerTruth.motive}，手法：${script.killerTruth.method}

【NPC】
${npcSummary}

【所有線索】
${cluesSummary}

【玩家指控】
- 指認：${accused?.name}（${killerCorrect ? "✓正確" : "✗錯誤"}）
- 動機說法：「${accusedMotive}」
- 手法說法：「${accusedMethod}」
- 剩餘 AP：${gameState.apRemaining}（超時=${isOvertime}）

評分規則：
- motiveScore：兇手答錯時固定給 0；兇手答對時依動機吻合程度給 0-20
- methodScore：不論兇手對錯，只要玩家說出的手法與真實手法吻合就給分（0-20）

fullStory 規則：
- 以第三人稱小說風格，繁體中文，約500字
- 從案發背景開始，帶出所有NPC關係、線索、真相
- 結尾揭示兇手動機與手法，帶有文學感
- 不提及「玩家」或「遊戲」

返回 JSON（不含 markdown）：
{
  "motiveScore": 0-20,
  "methodScore": 0-20,
  "motiveFeedback": "一句話點評動機答案",
  "methodFeedback": "一句話點評手法答案",
  "endingNarration": "結局故事（80-120字，根據結果調整情緒基調）",
  "fullStory": "約500字第三人稱小說"
}`;

    const msg = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1800,
      messages: [{ role: "user", content: evalMsg }],
    });

    const raw = msg.choices[0].message.content.trim();
    const evalData = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

    const killerScore = killerCorrect ? 40 : 0;
    const motiveScore = killerCorrect ? (evalData.motiveScore || 0) : 0;
    const methodScore = evalData.methodScore || 0; // 手法獨立計分，即使兇手答錯仍可得分
    const total = killerScore + motiveScore + methodScore + apScore + clueScore;

    let endingType;
    if (isOvertime) endingType = "overtime";
    else if (!killerCorrect) endingType = "wrong";
    else if (total >= 84) endingType = "perfect";  // 105分制，約80%
    else endingType = "partial";

    const titleMap = [
      [95, "神探"],
      [75, "優秀偵探"],
      [55, "運氣型偵探"],
      [35, "差點抓到的傢伙"],
      [0,  "被兇手耍了"],
    ];
    const detectiveTitle = titleMap.find(([t]) => total >= t)?.[1] || "被兇手耍了";

    res.json({
      ok: true,
      data: {
        ...evalData,
        killerCorrect,
        scores: { killer: killerScore, motive: motiveScore, method: methodScore, ap: apScore, clue: clueScore, total },
        endingType,
        detectiveTitle,
        socialIssue: script.socialIssue,
        accusedName: accused?.name,
        killerName: killer?.name,
        killerRole: killer?.role,
        killerMotive: script.killerTruth.motive,
        killerMethod: script.killerTruth.method,
        killerSecret: killer?.coreSecret,
        victimSecret: script.victim.secret,
        literaryConnection: script.literaryConnection,
      },
    });
  } catch (err) {
    console.error("[accuse]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`迷局伺服器已啟動：http://localhost:${PORT}`));
