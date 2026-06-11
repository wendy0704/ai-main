/** 劇本生成器 */


async function generateScript(seed, playerName) {
  const resp = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed, playerName }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `伺服器錯誤 ${resp.status}`);
  }
  const { ok, data, error } = await resp.json();
  if (!ok) throw new Error(error || "劇本生成失敗");

  const killerCount = data.npcs.filter((n) => n.isKiller).length;
  if (data.npcs.length !== 3 || killerCount !== 1) {
    throw new Error("劇本資料異常：NPC 數量或兇手設定錯誤");
  }
  return data;
}
