/** 遊戲主持人引擎 */

const $ = (id) => document.getElementById(id);

// ── 打字機效果 ────────────────────────────────────────────────────────────

function typewriter(element, text, speed = 18) {
  return new Promise((resolve) => {
    element.textContent = "";
    const cursor = document.createElement("span");
    cursor.className = "tw-cursor";
    element.appendChild(cursor);
    let i = 0;
    const tick = () => {
      if (i >= text.length) { cursor.remove(); resolve(); return; }
      element.insertBefore(document.createTextNode(text[i++]), cursor);
      setTimeout(tick, speed);
    };
    setTimeout(tick, speed);
  });
}

// ── NPC 崩潰閃光 ──────────────────────────────────────────────────────────

function triggerBreakdownFlash() {
  const flash = $("breakdown-flash");
  if (!flash) return;
  flash.classList.remove("active");
  void flash.offsetWidth; // reflow
  flash.classList.add("active");
  flash.addEventListener("animationend", () => flash.classList.remove("active"), { once: true });
}

let game = null;
let gameState = null;

// ── 畫面切換 ──────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === id);
  });
}

// ── 設定畫面 ──────────────────────────────────────────────────────────────

function initSetupScreen() {
  const nameInput = $("player-name");
  const confirmBtn = $("btn-confirm-setup");

  function checkReady() {
    confirmBtn.disabled = !nameInput.value.trim();
  }

  nameInput.addEventListener("input", checkReady);

  confirmBtn.addEventListener("click", () => {
    const playerName = nameInput.value.trim();
    if (!playerName) return;
    runLoading(playerName);
  });
}

// ── 載入＋劇本生成 ────────────────────────────────────────────────────────

async function runLoading(playerName) {
  showScreen("screen-loading");
  const steps = ["構思場景…", "設計人物…", "編排線索…", "撰寫劇情…"];
  const loadingText = $("loading-text");
  const loadingFill = $("loading-fill");
  let stepIdx = 0;

  const ticker = setInterval(() => {
    stepIdx = (stepIdx + 1) % steps.length;
    if (loadingText) loadingText.textContent = steps[stepIdx];
    if (loadingFill) loadingFill.style.width = `${((stepIdx + 1) / steps.length) * 75}%`;
  }, 900);

  try {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    game = await generateScript(seed, playerName);
    const _npcs = [...game.npcs];
    for (let i = _npcs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_npcs[i], _npcs[j]] = [_npcs[j], _npcs[i]];
    }
    game.npcs = _npcs;

    gameState = {
      playerName,
      apRemaining: 10,
      apUsed: 0,
      round: 1,
      npcPressure: {},
      npcTrust: {},
      npcBroken: {},
      cluesFound: [],
      keyCluesFound: 0,
      coreSecretsFound: 0,
      hiddenEventTriggered: false,
      conversationHistory: [],
      phase: "investigation",
    };
    game.npcs.forEach((n) => {
      gameState.npcPressure[n.id] = 0;
      gameState.npcTrust[n.id] = 100;
      gameState.npcBroken[n.id] = false;
    });

    clearInterval(ticker);
    if (loadingFill) loadingFill.style.width = "100%";
    setTimeout(startGame, 300);
  } catch (err) {
    clearInterval(ticker);
    console.error(err);
    showScreen("screen-home");
    alert("劇本生成失敗，請確認伺服器已啟動並設定 ANTHROPIC_API_KEY。\n\n錯誤：" + err.message);
  }
}

// ── 開始遊戲 ──────────────────────────────────────────────────────────────

function startGame() {

  showScreen("screen-game");
  $("script-title").textContent = `《${game.title}》`;
  renderNpcPanel();
  renderSuspectsPanel();
  updateApDisplay();
  updateRoundBadge();

  typewriter($("host-text"), game.openingHostNote || "案件已開始，請展開調查。");
  refreshStoryText(game.openingNarration || game.setting.desc);

  renderOptions(game.initialOptions || []);
  $("free-input-area").classList.remove("hidden");
  $("accuse-bar").classList.remove("hidden");
  $("suspects-panel").classList.remove("hidden");

  // 綁定面板收合 toggles
  bindPanelToggle("clues-toggle", "clues-body");
  bindPanelToggle("suspects-toggle", "suspects-body");
}

// ── 故事文字淡入刷新 ─────────────────────────────────────────────────────

function refreshStoryText(text) {
  const card = document.querySelector(".story-card");
  const el = $("story-text");
  if (card) { card.classList.remove("refreshing"); void card.offsetWidth; card.classList.add("refreshing"); }
  el.innerHTML = formatStory(text);
}

// ── AP 顯示 ───────────────────────────────────────────────────────────────

function updateApDisplay() {
  const count = $("ap-count");
  const pipsEl = $("ap-pips");
  if (count) count.textContent = gameState.apRemaining;
  if (pipsEl) {
    pipsEl.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const pip = document.createElement("div");
      pip.className = `ap-pip${i >= gameState.apRemaining ? " used" : ""}`;
      pipsEl.appendChild(pip);
    }
  }
}

function updateRoundBadge() {
  const badge = $("round-badge");
  if (badge) badge.textContent = `第 ${gameState.round} 回合`;
}

function computeRound(apUsed) {
  if (apUsed <= 2) return 1;
  if (apUsed <= 4) return 2;
  if (apUsed <= 7) return 3;
  return 4;
}

// ── NPC 面板 ──────────────────────────────────────────────────────────────

function renderNpcPanel() {
  const panel = $("npc-panel");
  const grid = $("npc-grid");
  panel.classList.remove("hidden");
  grid.innerHTML = game.npcs.map((n, idx) => `
    <div class="npc-row" id="npc-row-${n.id}" data-idx="${idx}">
      <div class="npc-info">
        <span class="npc-name">${escapeHtml(n.name)}</span>
        <span class="npc-role">${escapeHtml(n.role)}</span>
      </div>
      <div class="npc-pressure-wrap">
        <div class="pressure-bar-bg">
          <div class="pressure-bar-fill" id="pressure-fill-${n.id}" style="width:0%;background:var(--stamp)"></div>
        </div>
        <span class="pressure-label" id="pressure-label-${n.id}">壓力 0/100</span>
      </div>
    </div>`).join("");
}

function updateNpcDisplay() {
  game.npcs.forEach((n) => {
    const fill = $(`pressure-fill-${n.id}`);
    const label = $(`pressure-label-${n.id}`);
    const p = gameState.npcPressure[n.id] || 0;
    if (fill) fill.style.width = `${p}%`;
    if (label) label.textContent = `壓力 ${p}/100`;
    const row = $(`npc-row-${n.id}`);
    if (row && gameState.npcBroken[n.id]) {
      if (!row.querySelector(".npc-broken-tag")) {
        const tag = document.createElement("span");
        tag.className = "npc-broken-tag";
        tag.textContent = "已崩潰";
        row.querySelector(".npc-info").appendChild(tag);
      }
    }
  });
  refreshSuspectsPanel();
}

function renderSuspectsPanel() {
  $("suspects-grid").innerHTML = game.npcs.map((n) => `
    <div class="suspect-card" id="suspect-card-${escapeHtml(n.id)}">
      <div class="suspect-header suspect-toggle" data-npc="${escapeHtml(n.id)}">
        <div class="suspect-header-info">
          <strong>${escapeHtml(n.name)}</strong>
          <span>${escapeHtml(n.role)}</span>
        </div>
        <span class="toggle-chevron">▾</span>
      </div>
      <div class="suspect-dossier" id="suspect-dossier-${escapeHtml(n.id)}">
        ${n.personality ? `<span class="dossier-personality">${escapeHtml(n.personality)}</span>` : ""}
        ${n.victimRelationship ? `<div class="dossier-row"><span class="dossier-key">與被害者</span><span>${escapeHtml(n.victimRelationship)}</span></div>` : ""}
        ${n.background ? `<div class="dossier-row"><span class="dossier-key">背景</span><span>${escapeHtml(n.background)}</span></div>` : ""}
        <div class="dossier-divider"></div>
        <div class="dossier-secret" id="suspect-surface-${escapeHtml(n.id)}">
          <span class="dossier-key">表層秘密</span>
          <span class="secret-locked">施壓後可探出</span>
        </div>
        <div class="dossier-secret" id="suspect-core-${escapeHtml(n.id)}">
          <span class="dossier-key">核心秘密</span>
          <span class="secret-locked">崩潰後揭露</span>
        </div>
      </div>
    </div>`).join("");

  document.querySelectorAll(".suspect-toggle").forEach((header) => {
    header.addEventListener("click", () => {
      const npcId = header.dataset.npc;
      const body = $(`suspect-dossier-${npcId}`);
      const chevron = header.querySelector(".toggle-chevron");
      const collapsed = body.classList.toggle("collapsed");
      chevron.classList.toggle("rotated", collapsed);
    });
  });
}

function refreshSuspectsPanel() {
  if (!game) return;
  game.npcs.forEach((n) => {
    const pressure = gameState.npcPressure[n.id] || 0;
    const broken   = gameState.npcBroken[n.id];

    // 壓力到門檻 → 解鎖表層秘密
    const surfaceEl = $(`suspect-surface-${n.id}`);
    if (surfaceEl && pressure >= (n.pressureThreshold || 60) && surfaceEl.querySelector(".secret-locked")) {
      surfaceEl.innerHTML = `<span class="dossier-key">表層秘密</span><span class="secret-revealed">${escapeHtml(n.surfaceSecret || "")}</span>`;
    }

    // 崩潰 → 解鎖核心秘密
    const coreEl = $(`suspect-core-${n.id}`);
    if (coreEl && broken && coreEl.querySelector(".secret-locked")) {
      coreEl.innerHTML = `<span class="dossier-key">核心秘密</span><span class="secret-revealed core">${escapeHtml(n.coreSecret || "")}</span>`;
    }
  });
}

// ── 線索 ──────────────────────────────────────────────────────────────────

const CLUE_TYPE_LABEL = {
  physical:     "物證",
  testimony:    "人證",
  environmental:"環境",
  misleading:   "存疑",
};

function addClue(clue) {
  if (!clue) return;
  const id = clue.id || clue.label;
  if (gameState.cluesFound.some((c) => (c.id || c.label) === id)) return;

  gameState.cluesFound.push(clue);

  const keyClueIds = new Set(game.keyClueIds || []);
  if (clue.isKey || keyClueIds.has(clue.id)) gameState.keyCluesFound++;

  const panel = $("clues-panel");
  panel.classList.remove("hidden");
  $("clue-count").textContent = gameState.cluesFound.length;

  // 同步更新嫌疑人面板
  refreshSuspectsPanel();

  const typeTag = CLUE_TYPE_LABEL[clue.type] || clue.type || "線索";
  const item = document.createElement("div");
  item.className = "clue-item new-clue";
  item.innerHTML = `
    <span class="clue-type-tag ${escapeHtml(clue.type || "")}">${escapeHtml(typeTag)}</span>
    <div class="clue-text-wrap">
      <div class="clue-label">${escapeHtml(clue.label)}${clue.isKey ? '<span class="clue-key-mark">★</span>' : ""}</div>
      <div class="clue-detail">${escapeHtml(clue.text)}</div>
    </div>`;
  $("clues-list").appendChild(item);
}

// ── 選項渲染 ──────────────────────────────────────────────────────────────

const ACTION_LABEL = {
  investigate: "搜查",
  interrogate: "審問",
  pressure: "心理施壓",
  wait: "等待觀察",
};
const ACTION_ICON = {
  investigate: "🔍",
  interrogate: "💬",
  pressure: "⚡",
  wait: "👁",
};
const AP_COST_MAP = { investigate: 1, interrogate: 1, pressure: 2, wait: 0 };

function renderOptions(options) {
  const panel = $("choices-panel");
  panel.innerHTML = "";

  (options || []).forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `choice-btn${opt.actionType === "pressure" ? " pressure-btn" : ""}`;
    const ap = opt.apCost ?? AP_COST_MAP[opt.actionType] ?? 1;
    const tagText = ACTION_LABEL[opt.actionType] || opt.label || "行動";
    const icon = ACTION_ICON[opt.actionType] || "▸";
    btn.innerHTML = `
      <span class="choice-icon">${icon}</span>
      <div class="choice-body">
        <span class="choice-tag">${escapeHtml(tagText)}</span>
        <span>${escapeHtml(opt.text)}</span>
      </div>
      <span class="choice-ap">${ap > 0 ? ap + " AP" : "免費"}</span>`;

    if (gameState.apRemaining < ap) btn.disabled = true;

    btn.addEventListener("click", () => {
      executeAction({
        text: opt.text,
        actionType: opt.actionType,
        target: opt.target || null,
        apCost: ap,
      });
    });
    panel.appendChild(btn);
  });
}

// ── 執行行動（核心 API 呼叫，SSE 串流版）────────────────────────────

/** 從部分 JSON 文字中提取已完成的字串欄位值，成功回傳字串，否則 null */
function extractJsonField(text, field) {
  const re = new RegExp('"' + field + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"');
  const m = text.match(re);
  if (!m) return null;
  return m[1]
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** 在 host-text 顯示三點等待動畫 */
function showThinkingDots() {
  $("host-text").innerHTML =
    '<span class="thinking-dots"><span></span><span></span><span></span></span>';
}

/** 將完整 action data 套用到 gameState 並更新 UI（與串流分離）*/
function applyActionData(data, actionData, sysNote) {
  if (data.isOffRail) {
    sysNote.textContent = "【系統提示】" + (data.systemNote || "此行動偏離案件範圍，AP 已退回，請重新選擇。");
    sysNote.classList.remove("hidden");
  } else {
    const cost = data.apCost ?? actionData.apCost;
    gameState.apRemaining = Math.max(0, gameState.apRemaining - cost);
    gameState.apUsed += cost;
    gameState.round = computeRound(gameState.apUsed);
    updateApDisplay();
    updateRoundBadge();

    if (data.pressureChanges) {
      for (const [id, delta] of Object.entries(data.pressureChanges)) {
        gameState.npcPressure[id] = Math.min(100, Math.max(0, (gameState.npcPressure[id] || 0) + delta));
      }
    }
    if (data.trustChanges) {
      for (const [id, delta] of Object.entries(data.trustChanges)) {
        gameState.npcTrust[id] = Math.min(100, Math.max(0, (gameState.npcTrust[id] ?? 100) + delta));
      }
    }
    updateNpcDisplay();

    if (data.npcBreakdown) {
      const { npcId, secretType, revelation } = data.npcBreakdown;
      if (!gameState.npcBroken[npcId]) {
        gameState.npcBroken[npcId] = true;
        if (secretType === "core") gameState.coreSecretsFound++;
      }
      triggerBreakdownFlash();
      addClue({ type: "testimony", label: `${game.npcs.find((n) => n.id === npcId)?.name || npcId}的供詞`, text: revelation, isKey: true, npcId });
    }

    if (data.clueFound) {
      const clue = { ...data.clueFound };
      // target 是特定 NPC（非場所）時，人證、物證、環境線索都歸屬該 NPC
      // 舊 bug 的根源是 target 為「場所名」時也歸屬，現在只在 target 是 NPC id 時才歸屬
      const targetIsNpc = actionData.target && game.npcs.some((n) => n.id === actionData.target);
      if (!clue.npcId && targetIsNpc && ["testimony", "physical", "environmental"].includes(clue.type)) {
        clue.npcId = actionData.target;
      }
      addClue(clue);
    }

    if (data.triggerHiddenEvent && !gameState.hiddenEventTriggered) {
      gameState.hiddenEventTriggered = true;
      if (data.hiddenEventClue) {
        addClue({ ...data.hiddenEventClue, type: data.hiddenEventClue.type || "environmental", isKey: true });
      }
    }
  }

  renderOptions(data.options);

  if (gameState.apRemaining <= 0 && gameState.phase === "investigation") {
    showApDepletedNotice();
  }
}

async function executeAction(actionData) {
  setUiLocked(true);
  const sysNote = $("system-note");
  sysNote.classList.add("hidden");
  showThinkingDots();                 // 立即顯示等待動畫

  try {
    const resp = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: game,
        gameState,
        action: actionData,
        conversationHistory: gameState.conversationHistory,
      }),
    });
    if (!resp.ok) throw new Error(`伺服器錯誤 ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let lineBuf = "";
    let rawJson = "";

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop();           // 保留未完成的行

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        let ev;
        try { ev = JSON.parse(payload); } catch { continue; }

        if (ev.t === "c") {
          rawJson += ev.v;
        }

        if (ev.t === "done") {
          const { data, conversationHistory } = ev;
          gameState.conversationHistory = (conversationHistory || []).slice(-12);

          // 全部收到後一次更新
          refreshStoryText(data.narration || "");
          typewriter($("host-text"), data.hostNote || "");
          applyActionData(data, actionData, sysNote);
          break outer;
        }

        if (ev.t === "err") throw new Error(ev.error);
      }
    }

  } catch (err) {
    console.error(err);
    $("host-text").textContent = "";
    sysNote.textContent = "AI 回應失敗，請重試。(" + err.message + ")";
    sysNote.classList.remove("hidden");
  } finally {
    setUiLocked(false);
  }
}

function showApDepletedNotice() {
  $("choices-panel").innerHTML = "";
  const sysNote = $("system-note");
  sysNote.innerHTML = `⚠️ 行動力已耗盡——閱讀完上方故事後，請做出你的最終指控。
    <div style="margin-top:.75rem">
      <button type="button" id="btn-force-accuse" class="btn-accuse-trigger">⚖️ 做出最終指控</button>
    </div>`;
  sysNote.classList.remove("hidden");
  $("btn-force-accuse").addEventListener("click", showAccusationScreen);
}

function setUiLocked(locked) {
  document.querySelectorAll(".choice-btn, .btn-free, #btn-free-action, #btn-show-accuse").forEach((el) => {
    el.disabled = locked;
  });
  const freeInput = $("free-input");
  if (freeInput) freeInput.disabled = locked;
}

// ── 自由輸入 ──────────────────────────────────────────────────────────────

function bindFreeInput() {
  const input = $("free-input");
  const btn = $("btn-free-action");

  // 攔截 Enter 鍵，無論是否在輸入法組字中，一律不提交
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  btn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    if (gameState.apRemaining < 1) {
      $("system-note").textContent = "行動力不足，無法繼續行動。";
      $("system-note").classList.remove("hidden");
      return;
    }
    input.value = "";
    executeAction({ text, actionType: "free", target: null, apCost: 1 });
  });
}

// ── 指認畫面 ──────────────────────────────────────────────────────────────

function showAccusationScreen() {
  gameState.phase = "accusation";
  showScreen("screen-accusation");

  const intro = $("accusation-intro");
  if (intro) intro.textContent = gameState.apRemaining <= 0
    ? "行動力耗盡！你不得不在此刻做出指控——"
    : `剩餘 ${gameState.apRemaining} AP。你認為誰是殺害 ${game.victim.name} 的真兇？`;

  const killerOpts = $("accuse-killer-options");
  killerOpts.innerHTML = "";
  let selectedKillerId = null;

  game.npcs.forEach((n) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "accuse-npc-btn";
    btn.textContent = `${n.name}（${n.role}）`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".accuse-npc-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedKillerId = n.id;
      checkAccuseReady();
    });
    killerOpts.appendChild(btn);
  });

  const submitBtn = $("btn-submit-accuse");
  submitBtn.disabled = true;

  function checkAccuseReady() {
    const motive = $("accuse-motive").value.trim();
    const method = $("accuse-method").value.trim();
    submitBtn.disabled = !selectedKillerId || !motive || !method;
  }

  $("accuse-motive").value = "";
  $("accuse-method").value = "";
  $("accuse-motive").addEventListener("input", checkAccuseReady);
  $("accuse-method").addEventListener("input", checkAccuseReady);

  submitBtn.onclick = async () => {
    if (!selectedKillerId) return;
    const motive = $("accuse-motive").value.trim();
    const method = $("accuse-method").value.trim();
    if (!motive || !method) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "AI 評分中…";
    try {
      const resp = await fetch("/api/accuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: game, gameState, accusedId: selectedKillerId, accusedMotive: motive, accusedMethod: method }),
      });
      const { ok, data, error } = await resp.json();
      if (!ok) throw new Error(error);
      showEnding(data);
    } catch (err) {
      alert("評分失敗：" + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "提出指控";
    }
  };

  $("btn-back-to-game").onclick = () => {
    if (gameState.apRemaining > 0) {
      gameState.phase = "investigation";
      showScreen("screen-game");
    }
  };
}

// ── 結局 ──────────────────────────────────────────────────────────────────

const ENDING_META = {
  perfect:  { verdict: "— 完美破案 —",  color: "#c9a962" },
  partial:  { verdict: "— 真兇落網 —",  color: "#7a8ec4" },
  wrong:    { verdict: "— 推理失敗 —",  color: "#c45c5c" },
  overtime: { verdict: "— 超時收場 —",  color: "#8e849c" },
};

function showEnding(data) {
  showScreen("screen-ending");

  // 重置所有分段元素為隱藏
  document.querySelectorAll(".reveal-step").forEach((el) => el.classList.remove("visible"));

  const meta = ENDING_META[data.endingType] || ENDING_META.wrong;
  $("ending-verdict").textContent = meta.verdict;
  $("ending-verdict").style.color = meta.color;
  $("ending-title").textContent = data.endingTitle || data.endingType;
  $("detective-title-box").textContent = `稱號：${data.detectiveTitle}`;

  // 分數表
  const sc = data.scores;
  $("score-card").innerHTML = `
    <h4>推理評分</h4>
    ${scoreRow("兇手指認", sc.killer, 40)}
    ${scoreRow("動機分析", sc.motive, 20)}
    ${scoreRow("手法推理", sc.method, 20)}
    ${scoreRow("調查效率（剩餘 AP）", sc.ap, 10)}
    ${scoreRow("線索完整度", sc.clue, 10)}
    ${scoreRow("互動深度（NPC / 隱藏事件）", sc.interaction, 20)}
    <div class="score-row total">
      <span class="score-label">總分</span>
      <span class="score-val max">${sc.total} / 120</span>
    </div>`;

  // 結局故事
  $("ending-story").textContent = data.endingNarration || "";

  // 真相揭曉
  const isCorrect = data.killerCorrect;
  const issue = data.socialIssue;
  $("truth-reveal").innerHTML = `
    <h4>完整真相</h4>
    <p><strong>真兇：</strong>${escapeHtml(data.killerName)}（${escapeHtml(data.killerRole)}）</p>
    <p><strong>動機：</strong>${escapeHtml(data.killerMotive)}</p>
    <p><strong>手法：</strong>${escapeHtml(data.killerMethod)}</p>
    <p><strong>核心秘密：</strong>${escapeHtml(data.killerSecret || "")}</p>
    ${!isCorrect ? `<p style="margin-top:.5rem"><strong>你指控了：</strong>${escapeHtml(data.accusedName || "")}</p>` : ""}
    ${data.motiveFeedback ? `<p style="margin-top:.6rem;color:var(--muted);font-size:.85rem">動機：${escapeHtml(data.motiveFeedback)}</p>` : ""}
    ${data.methodFeedback ? `<p style="margin-top:.3rem;color:var(--muted);font-size:.85rem">手法：${escapeHtml(data.methodFeedback)}</p>` : ""}
    <p style="margin-top:.5rem;color:var(--muted);font-size:.85rem">被害者秘密：${escapeHtml(data.victimSecret || "")}</p>
    ${issue ? `<div class="social-issue-reveal">
      <span class="issue-label">本案議題</span>
      <strong>${escapeHtml(issue.theme)}</strong>
      <p>${escapeHtml(issue.context)}</p>
      <p style="color:var(--muted);font-size:.85rem">${escapeHtml(issue.killerBackground)}</p>
    </div>` : ""}`;

  // 文學連結
  const lit = data.literaryConnection;
  if (lit) {
    $("literary-section").classList.remove("hidden");
    $("literary-content").innerHTML = `
      <p class="literary-theme">議題：${escapeHtml(lit.theme || "")}</p>
      <p class="literary-theme" style="margin-bottom:.5rem">${escapeHtml(lit.reflection || "")}</p>
      ${lit.relatedWorks?.length ? `<ul class="literary-works">${lit.relatedWorks.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>` : ""}
      ${lit.reflectionQuestion ? `<p class="literary-question">💭 ${escapeHtml(lit.reflectionQuestion)}</p>` : ""}`;
  }

  // ── 未發現的線索與隱藏劇情 ──
  const foundLabels = new Set((gameState.cluesFound || []).map((c) => c.label));
  const missedClues = (game.clues || []).filter((c) => !foundLabels.has(c.label));
  const missedHidden = !gameState.hiddenEventTriggered && game.hiddenEvent;

  if (missedClues.length > 0 || missedHidden) {
    $("missed-section").classList.remove("hidden");
    const TYPE_TAG = { physical: "物證", testimony: "人證", environmental: "環境", misleading: "誤導" };
    let html = "";
    if (missedClues.length > 0) {
      html += `<div class="missed-group"><div class="missed-group-title">未發現的線索</div>`;
      html += missedClues.map((c) => `
        <div class="missed-clue${c.isKey ? " key-clue" : ""}">
          <span class="clue-type-tag">${TYPE_TAG[c.type] || c.type}</span>
          ${c.isKey ? '<span class="key-tag">★ 關鍵</span>' : ""}
          <span class="clue-label">${escapeHtml(c.label)}</span>
          <p class="clue-text">${escapeHtml(c.text)}</p>
        </div>`).join("");
      html += `</div>`;
    }
    if (missedHidden) {
      html += `<div class="missed-group">
        <div class="missed-group-title">未觸發的隱藏事件</div>
        <div class="missed-clue">
          <p class="clue-text">${escapeHtml(game.hiddenEvent.description)}</p>
          <p class="clue-text" style="margin-top:.3rem;font-style:italic">揭示：${escapeHtml(game.hiddenEvent.clueRevealed)}</p>
        </div>
      </div>`;
    }
    $("missed-content").innerHTML = html;
  }

  // ── 完整故事劇情下拉 ──
  $("full-story-section").classList.remove("hidden");
  const TYPE_TAG2 = { physical: "物證", testimony: "人證", environmental: "環境", misleading: "誤導" };
  const allClues = [...(game.clues || []), ...(game.misleadingClue ? [{ ...game.misleadingClue, type: "misleading", isKey: false }] : [])];
  $("full-story-body").innerHTML = `
    <div class="story-chapter">
      <div class="story-chapter-title">開場</div>
      <p>${escapeHtml(game.openingNarration || game.setting?.desc || "")}</p>
    </div>
    <div class="story-chapter">
      <div class="story-chapter-title">所有線索</div>
      ${allClues.map((c) => `
        <div class="full-clue${c.isKey ? " key-clue" : ""}">
          <span class="clue-type-tag">${TYPE_TAG2[c.type] || c.type}</span>
          ${c.isKey ? '<span class="key-tag">★</span>' : ""}
          <strong>${escapeHtml(c.label)}</strong>
          <p class="clue-text">${escapeHtml(c.text)}</p>
        </div>`).join("")}
    </div>
    <div class="story-chapter">
      <div class="story-chapter-title">隱藏事件（第3回合）</div>
      <p>${escapeHtml(game.hiddenEvent?.description || "")}</p>
      <p style="font-style:italic;margin-top:.3rem">揭示：${escapeHtml(game.hiddenEvent?.clueRevealed || "")}</p>
    </div>
    <div class="story-chapter">
      <div class="story-chapter-title">NPC 秘密</div>
      ${(game.npcs || []).map((n) => `
        <div class="full-npc-secret">
          <strong>${escapeHtml(n.name)}</strong>（${escapeHtml(n.role)}）
          <p>表層秘密：${escapeHtml(n.surfaceSecret || "")}</p>
          <p>核心秘密：${escapeHtml(n.coreSecret || "")}</p>
        </div>`).join("")}
    </div>
    <div class="story-chapter">
      <div class="story-chapter-title">完整真相</div>
      <p><strong>真兇：</strong>${escapeHtml(data.killerName)}（${escapeHtml(data.killerRole)}）</p>
      <p><strong>動機：</strong>${escapeHtml(data.killerMotive)}</p>
      <p><strong>手法：</strong>${escapeHtml(data.killerMethod)}</p>
    </div>`;

  $("full-story-toggle").onclick = () => {
    const body = $("full-story-body");
    const chevron = $("full-story-chevron");
    const collapsed = body.classList.toggle("collapsed");
    chevron.classList.toggle("rotated", !collapsed);
  };

  // 分段淡入動畫
  const steps = [
    $("ending-verdict"),
    $("ending-title"),
    $("detective-title-box"),
    $("score-card"),
    $("ending-story"),
    $("truth-reveal"),
    $("literary-section"),
    $("missed-section"),
    $("full-story-section"),
  ];
  steps.forEach((el) => { if (el) el.classList.add("reveal-step"); });
  steps.forEach((el, i) => {
    if (!el) return;
    setTimeout(() => el.classList.add("visible"), 150 + i * 300);
  });
}

function scoreRow(label, val, max) {
  const cls = val === 0 ? "zero" : val === max ? "max" : "";
  return `<div class="score-row">
    <span class="score-label">${escapeHtml(label)}</span>
    <span class="score-val ${cls}">${val} / ${max}</span>
  </div>`;
}

// ── 工具函數 ──────────────────────────────────────────────────────────────

function bindPanelToggle(toggleId, bodyId) {
  const toggle = $(toggleId);
  const body = $(bodyId);
  if (!toggle || !body) return;
  toggle.addEventListener("click", () => {
    const collapsed = body.classList.toggle("collapsed");
    const chevron = toggle.querySelector(".toggle-chevron");
    if (chevron) chevron.classList.toggle("rotated", collapsed);
  });
}

function formatStory(text) {
  if (!text) return "";
  return "<p>" + escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
}

function escapeHtml(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

// ── 綁定 UI ───────────────────────────────────────────────────────────────

// ── 配色選色器 ────────────────────────────────────────────────────────────

const THEME_CLASSES = ["style-forensic", "style-crimescene", "style-coldcase"];
const THEME_PIP_COLORS = {
  "":           "#b83232",
  "forensic":   "#1a6838",
  "crimescene": "#c07800",
  "coldcase":   "#163460",
};

function applyTheme(theme) {
  document.body.classList.remove(...THEME_CLASSES);
  if (theme) document.body.classList.add(`style-${theme}`);
  document.querySelectorAll(".theme-swatch").forEach((s) =>
    s.classList.toggle("active", s.dataset.theme === theme)
  );
}

function initThemeSwitcher() {
  applyTheme(localStorage.getItem("miju-theme") || "");

  document.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      let t = btn.dataset.theme;
      if (t === "random") {
        const opts = ["", "forensic", "crimescene", "coldcase"];
        t = opts[Math.floor(Math.random() * opts.length)];
      }
      applyTheme(t);
      localStorage.setItem("miju-theme", t);
    });
  });
}

function bindUi() {
  // 首頁 → 設定
  $("btn-go-setup").addEventListener("click", () => showScreen("screen-setup"));

  // 設定畫面
  initSetupScreen();

  // 自由輸入
  bindFreeInput();

  // 做出指控按鈕
  $("btn-show-accuse").addEventListener("click", showAccusationScreen);

  // 新的一局：回主頁
  $("btn-new-game").addEventListener("click", () => {
    game = null;
    gameState = null;
    document.body.className = "";
    $("player-name").value = "";
    document.querySelectorAll(".style-btn").forEach((b) => b.classList.remove("selected"));
    $("btn-confirm-setup").disabled = true;
    showScreen("screen-home");
  });

  // 再玩一次：同劇本重置重玩
  $("btn-replay-same").addEventListener("click", () => {
    if (!game) return;
    gameState = {
      playerName: gameState?.playerName || "",
      apRemaining: 10,
      apUsed: 0,
      round: 1,
      npcPressure: {},
      npcTrust: {},
      npcBroken: {},
      cluesFound: [],
      keyCluesFound: 0,
      coreSecretsFound: 0,
      hiddenEventTriggered: false,
      conversationHistory: [],
      phase: "investigation",
    };
    game.npcs.forEach((n) => {
      gameState.npcPressure[n.id] = 0;
      gameState.npcTrust[n.id] = 100;
      gameState.npcBroken[n.id] = false;
    });
    // 重置結局區塊狀態
    $("missed-section").classList.add("hidden");
    $("full-story-section").classList.add("hidden");
    $("full-story-body").classList.add("collapsed");
    startGame();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { bindUi(); initThemeSwitcher(); });
} else {
  bindUi(); initThemeSwitcher();
}
