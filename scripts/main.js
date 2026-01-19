/* Babylon System (v12.5.0) — Full integration + hotbar tooltip fix */

// --- Compat helpers (added) ---

Hooks.once("init", () => {
});

const SYSID = (game?.system?.id) || "babylon-system";
const TPL = (p) => `systems/${SYSID}/templates/${p}`;
async function evalRollCompat(roll) {
  try { if (roll?.evaluate?.length === 0) return await roll.evaluate(); return await roll.evaluate({async:true}); }
  catch(e){ if (typeof roll.evaluateSync === "function") return roll.evaluateSync(); throw e; }
}
// --- end compat helpers ---
/* global Hooks, ActorSheet, ItemSheet, Roll, ChatMessage, canvas, ui, foundry, game, Actors, Items, loadTemplates, FilePicker, Macro, fromUuid, AudioHelper, Combat */

function sizeFrom(txt, fb=6){ 
  const s = String(txt ?? "").trim().toUpperCase();
  if (!s) return fb;
  let m = s.match(/\bD(\d+)\b/);
  if (m) return Number(m[1]);
  m = s.match(/^\d+$/);
  if (m) return Number(s);
  return fb;
}
function labelField(k){ return ({charm:"매력·인상", body:"신체·체력", tech:"기술·기교", will:"의지·용기"})[k] || k; }
function cap(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function numOr(value, fallback){ const n = Number(value); return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback; }

// === Sheet UI defaults (per-actor) ===
const SHEET_CFG_DEFAULTS = {
  // Global look & feel (independent from RPG bar colors)
  theme: "obsidian",          // obsidian|azure|crimson|emerald|parchment
  portraitSize: 170,         // unified default (smaller)
  portraitFit: "cover",      // cover|contain
  badgeImage: "",
  badgeSize: 44,
  colors: {
    accent: "#d9a441",
    energy: "#ffc84d",
    damage: "#ff4d4d",
    shield: "#4aa3ff"
  }
};

// Built-in sheet themes (whole sheet look; separate from RPG bar colors)
const SHEET_THEME_KEYS = ["obsidian","azure","crimson","emerald","parchment"];

function sanitizeHexColor(v, fallback){
  const s = String(v ?? "").trim();
  const m = s.match(/^#([0-9a-fA-F]{6})$/);
  return m ? ("#" + m[1].toLowerCase()) : fallback;
}

function normalizeSheetCfg(raw){
  const cur = foundry.utils.mergeObject(foundry.utils.deepClone(SHEET_CFG_DEFAULTS), foundry.utils.deepClone(raw || {}), {inplace:false});
  cur.theme = SHEET_THEME_KEYS.includes(String(cur.theme || "").trim()) ? String(cur.theme).trim() : SHEET_CFG_DEFAULTS.theme;
  cur.portraitSize = cap(numOr(cur.portraitSize, SHEET_CFG_DEFAULTS.portraitSize), 160, 180);
  cur.portraitFit  = (cur.portraitFit === "contain") ? "contain" : "cover";
  cur.badgeImage   = String(cur.badgeImage || "").trim();
  cur.badgeSize    = cap(numOr(cur.badgeSize, SHEET_CFG_DEFAULTS.badgeSize), 24, 96);
  if (!cur.colors) cur.colors = {};
  cur.colors.accent = sanitizeHexColor(cur.colors.accent, SHEET_CFG_DEFAULTS.colors.accent);
  cur.colors.energy = sanitizeHexColor(cur.colors.energy, SHEET_CFG_DEFAULTS.colors.energy);
  cur.colors.damage = sanitizeHexColor(cur.colors.damage, SHEET_CFG_DEFAULTS.colors.damage);
  cur.colors.shield = sanitizeHexColor(cur.colors.shield, SHEET_CFG_DEFAULTS.colors.shield);
  return cur;
}

async function openBabylonSheetConfigDialog(sheet){
  const actor = sheet?.actor;
  if (!actor) return;

  const cur = normalizeSheetCfg(actor.system?.babylon?.sheet);

  const content = await renderTemplate(TPL("dialog/sheet-config.hbs"), { cfg: cur });

  const applyUpdate = async (html) => {
    const root = html[0];
    const read = (sel) => root.querySelector(sel)?.value;

    const theme = String(read("[name='theme']") || "").trim();

    const readColor = (base, fb) => {
      const t = read(`[name='${base}Text']`);
      const c = read(`[name='${base}']`);
      return sanitizeHexColor(t || c, fb);
    };

    const upd = {
      "system.babylon.sheet.theme": SHEET_THEME_KEYS.includes(theme) ? theme : SHEET_CFG_DEFAULTS.theme,
      "system.babylon.sheet.portraitSize": cap(numOr(read("[name='portraitSize']"), SHEET_CFG_DEFAULTS.portraitSize), 160, 180),
      "system.babylon.sheet.portraitFit": (read("[name='portraitFit']") === "contain") ? "contain" : "cover",
      "system.babylon.sheet.badgeImage": String(read("[name='badgeImage']") || "").trim(),
      "system.babylon.sheet.badgeSize": cap(numOr(read("[name='badgeSize']"), SHEET_CFG_DEFAULTS.badgeSize), 24, 96),

      "system.babylon.sheet.colors.accent": readColor("colorAccent", SHEET_CFG_DEFAULTS.colors.accent),
      "system.babylon.sheet.colors.energy": readColor("colorEnergy", SHEET_CFG_DEFAULTS.colors.energy),
      "system.babylon.sheet.colors.damage": readColor("colorDamage", SHEET_CFG_DEFAULTS.colors.damage),
      "system.babylon.sheet.colors.shield": readColor("colorShield", SHEET_CFG_DEFAULTS.colors.shield)
    };

    await actor.update(upd);
    sheet.render(false);
  };

  const resetUpdate = async () => {
    await actor.update({
      "system.babylon.sheet.theme": SHEET_CFG_DEFAULTS.theme,
      "system.babylon.sheet.portraitSize": SHEET_CFG_DEFAULTS.portraitSize,
      "system.babylon.sheet.portraitFit": SHEET_CFG_DEFAULTS.portraitFit,
      "system.babylon.sheet.badgeImage": SHEET_CFG_DEFAULTS.badgeImage,
      "system.babylon.sheet.badgeSize": SHEET_CFG_DEFAULTS.badgeSize,

      "system.babylon.sheet.colors.accent": SHEET_CFG_DEFAULTS.colors.accent,
      "system.babylon.sheet.colors.energy": SHEET_CFG_DEFAULTS.colors.energy,
      "system.babylon.sheet.colors.damage": SHEET_CFG_DEFAULTS.colors.damage,
      "system.babylon.sheet.colors.shield": SHEET_CFG_DEFAULTS.colors.shield
    });
    sheet.render(false);
  };

  new Dialog({
    title: "시트 설정",
    content,
    buttons: {
      save: { icon: '<i class="fas fa-save"></i>', label: "저장", callback: applyUpdate },
      reset:{ icon: '<i class="fas fa-undo"></i>', label: "초기화", callback: async () => resetUpdate() },
      cancel:{ icon: '<i class="fas fa-times"></i>', label: "닫기" }
    },
    default: "save",
    render: (html) => {
      const bindPicker = (btnSel, inputSel) => {
        html.find(btnSel).on("click", (ev) => {
          ev.preventDefault();
          const inp = html[0].querySelector(inputSel);
          const fp = new FilePicker({ type: "image", current: inp?.value || "", callback: (path) => { if (inp) inp.value = path; } });
          fp.render(true);
        });
      };
      bindPicker("[data-pick='badgeImage']", "[name='badgeImage']");

      // Keep color inputs & text inputs in sync
      const syncPair = (colorName, textName) => {
        const c = html[0].querySelector(`[name='${colorName}']`);
        const t = html[0].querySelector(`[name='${textName}']`);
        if (!c || !t) return;
        c.addEventListener("input", () => { t.value = c.value; });
        t.addEventListener("input", () => {
          const v = sanitizeHexColor(t.value, c.value);
          c.value = v;
        });
      };
      syncPair("colorAccent", "colorAccentText");
      syncPair("colorEnergy", "colorEnergyText");
      syncPair("colorDamage", "colorDamageText");
      syncPair("colorShield", "colorShieldText");
    }
  }).render(true);
}

// Stack maximums (character defaults to 3, boss can be 20+)
function maxDamageStacks(actor){
  const v = numOr(actor?.system?.combat?.damageStacksMax, NaN);
  return (Number.isFinite(v) && v > 0) ? v : 3;
}
function maxShieldStacks(actor){
  const v = numOr(actor?.system?.combat?.shieldStacksMax, NaN);
  return (Number.isFinite(v) && v > 0) ? v : 3;
}

async function ensureCombatForScene(scene){
  if (game.combat && game.combat.scene?.id === (scene?.id || canvas.scene?.id)) return game.combat;
  const created = await Combat.create({scene: (scene?.id || canvas.scene?.id)});
  ui.combat.render(true);
  return created;
}
async function ensureCombatantForActor(actor){
  const scene = canvas.scene;
  const combat = await ensureCombatForScene(scene);
  const token = canvas.tokens?.controlled[0] || canvas.tokens?.placeables.find(t => t.actor?.id === actor.id);
  const tokenId = token?.id;
  let cbt = combat.combatants.find(c => c.actorId === actor.id || (tokenId && c.tokenId === tokenId));
  if (!cbt){
    const created = await combat.createEmbeddedDocuments("Combatant", [{ name: (token?.name ?? actor.name), name: (token?.name ?? actor.name), actorId: actor.id, tokenId: tokenId || null, sceneId: combat.scene?.id }]);
    cbt = created[0];
  }
  return {combat, cbt, token};
}

async function useBabylonSkill(actorId, itemId, opts={}){
  const actor = game.actors.get(actorId);
  if (!actor) return ui.notifications?.warn("배우를 찾을 수 없습니다.");
  const item = actor.items.get(itemId);
  if (!item) return ui.notifications?.warn("스킬 아이템을 찾을 수 없습니다.");

  const sys = item.system || {};
  // Some old data may store these as objects; normalize to strings to avoid "[object Object]" in UI.
  const normKey = (v, fallback) => {
    let x = v;
    if (typeof x !== "string") x = x?.value ?? x?.key ?? x?.id;
    if (typeof x !== "string" || !x.trim()) x = fallback;
    return String(x).trim();
  };

  // Normalize kind for older items (some store Korean labels like "스킬" or even "사용")
  const kindRaw = normKey(sys.kind, "skill");
  const kindNorm = String(kindRaw ?? "").trim();
  const kindLower = kindNorm.toLowerCase();
  const KIND_MAP = {
    "basic": "basic", "기본": "basic", "기본공격": "basic", "기본 공격": "basic",
    "skill": "skill", "스킬": "skill", "사용": "skill", "use": "skill",
    "ultimate": "ultimate", "필살기": "ultimate", "궁극기": "ultimate",
    "passive": "passive", "패시브": "passive"
  };
  let kind = KIND_MAP[kindNorm] ?? KIND_MAP[kindLower] ?? kindLower;
  if (!["basic", "skill", "ultimate", "passive"].includes(kind)) kind = "skill";
  const key  = normKey(sys.fieldKey, normKey(actor.system?.babylon?.selectField, "charm"));

  // Energy flow (no dice/rolls)
  const defaultGain = (kind === "basic" ? 20 : kind === "skill" ? 30 : 0);
  const defaultReq  = (kind === "ultimate" ? 100 : 0);
  const defaultReset= (kind === "ultimate" ? 0 : null);
  let energyNow  = numOr(actor.system?.combat?.energy, 0);
  const energyMax  = numOr(actor.system?.combat?.energyMax, 100);
  const energyGain = (sys.energyGain === "" || sys.energyGain === null || sys.energyGain === undefined) ? defaultGain  : numOr(sys.energyGain, defaultGain);
  const requiresEnergy = (sys.requiresEnergy === "" || sys.requiresEnergy === null || sys.requiresEnergy === undefined) ? defaultReq : numOr(sys.requiresEnergy, defaultReq);
  const gainFirst = !!sys.energyGainFirst;
  const energyResetTo = (sys.energyResetTo === "" || sys.energyResetTo === undefined) ? defaultReset : (sys.energyResetTo === null ? null : numOr(sys.energyResetTo, defaultReset));

  let energyForCheck = energyNow;
  if (gainFirst) energyForCheck = cap(energyNow + energyGain, 0, energyMax);
  if (requiresEnergy > 0 && energyForCheck < requiresEnergy){
    return ui.notifications?.warn(`에너지가 부족합니다 (${energyForCheck}/${requiresEnergy})`);
  }

  let nextEnergy = energyNow;
  if (gainFirst) nextEnergy = cap(nextEnergy + energyGain, 0, energyMax);
  if (requiresEnergy > 0) nextEnergy = cap(nextEnergy - requiresEnergy, 0, energyMax);
  else if (energyResetTo !== null) nextEnergy = energyResetTo;
  else if (!gainFirst) nextEnergy = cap(nextEnergy + energyGain, 0, energyMax);
  await actor.update({"system.combat.energy": nextEnergy});

  // Optional sound
  try {
    if (game.settings.get("babylon-system","enableSkillSound")) {
      let src = sys.sound || sys.soundSrc || null;
      const vol = Math.max(0, Math.min(1, Number(sys.soundVolume ?? 0.8)));
      if (typeof src === "object" && src?.src) src = src.src;
      if (src && typeof AudioHelper?.play === "function") {
        await AudioHelper.play({src, volume: vol, autoplay: true, loop: false}, true);
      }
    }
  } catch (e) { console.warn("Babylon | sound play failed", e); }

  // Build clean chat card: Skill name / description / effect (no numbers)
  const kindText = ({basic:"기본공격", skill:"스킬", ultimate:"필살기", passive:"패시브"})[kind] || "스킬";
  const fieldText = ({charm:"매력·인상", body:"신체·체력", tech:"기술·기교", will:"의지·용기"})[key] || key;
  const tags = Array.isArray(sys.tags) ? sys.tags : (typeof sys.tags === "string" ? sys.tags.split(",").map(s=>s.trim()).filter(Boolean) : []);
  const tagsText = tags.map(t=>String(t).trim()).filter(Boolean).slice(0,6).join(", ");

  const descText = String(sys.description || "").trim();
  const effectLines = [];
  if (sys.status?.name) effectLines.push(`${sys.status.name}${sys.status.duration ? ` (${sys.status.duration})` : ""}`);
  if (sys.status?.note) effectLines.push(String(sys.status.note).trim());
  const effectText = effectLines.filter(Boolean).join("\n");

  let energyText = `⚡ ${energyNow}`;
  if (gainFirst && energyGain) energyText += ` +${energyGain}`;
  if (requiresEnergy) energyText += ` -${requiresEnergy}`;
  if (!gainFirst && !requiresEnergy && energyGain) energyText += ` +${energyGain}`;
  energyText += ` = ${nextEnergy}`;

  const iconImg = item.img || actor.img || "icons/svg/mystery-man.svg";
  const content = await renderTemplate(TPL("chat/skill-roll.hbs"), {
    kind,
    kindText,
    actorName: actor.name || "Actor",
    iconImg,
    skill: {name: item.name, img: item.img},
    fieldText,
    range: String(sys.range || "").trim(),
    tagsText,
    descText,
    effectText,
    energyText
  });

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flags: { babylon: true, blStyle: kind, itemUuid: item?.uuid }
  });

  // New combat flow: if the user has targets selected, consume shield first, then add damage stack.
  try {
    const targets = Array.from(game.user?.targets || []);
    for (const tok of targets) {
      const tActor = tok?.actor;
      if (!tActor) continue;
      const shMax = maxShieldStacks(tActor);
      const dmMax = maxDamageStacks(tActor);
      const curS = cap(numOr(tActor.system?.combat?.shieldStacks, 0), 0, shMax);
      if (curS > 0) {
        await tActor.update({"system.combat.shieldStacks": cap(curS - 1, 0, shMax)});
        continue;
      }
      const curD = cap(numOr(tActor.system?.combat?.damageStacks, 0), 0, dmMax);
      await tActor.update({"system.combat.damageStacks": cap(curD + 1, 0, dmMax)});
    }
  } catch (e) { console.warn("Babylon | apply damage stack failed", e); }
}

class BabylonCharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["babylon-system", "sheet", "actor"],
      template: TPL("actor-character.hbs"),
      width: 1040, height: 840,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "profile"}],
      dragDrop: [{dragSelector: ".skill .drag", dropSelector: ".skill-list"}],
      resizable: true
    });
  }
  getData(options={}) {
    if (!this.actor) return {};
    const data = super.getData(options) || {};
    const sys = foundry.utils.mergeObject({
      babylon: {
        fields: { charm:"D8", body:"D8", tech:"D8", will:"D8" },
        selectField: "charm",
        nameDie: "D6",
        constellationDie: "D6",
        options: { bond:false },
        /** Sheet UI customization (safe defaults) */
        sheet: {
          // Whole sheet theme (background/cards/tabs)
          theme: SHEET_CFG_DEFAULTS.theme,
          // Portrait frame size (width). The grey frame itself is clamped in CSS too.
          portraitSize: SHEET_CFG_DEFAULTS.portraitSize,
          portraitFit: SHEET_CFG_DEFAULTS.portraitFit, /* cover|contain */
          /* small badge overlay (image) */
          badgeImage: SHEET_CFG_DEFAULTS.badgeImage,
          badgeSize: SHEET_CFG_DEFAULTS.badgeSize,
          colors: foundry.utils.deepClone(SHEET_CFG_DEFAULTS.colors)
        }
      },
      combat: {
        // HP is no longer used in the new "3-hit stack" flow (kept for backward compatibility).
        hp: 80, hpmax: 80,
        // 0~3 : filled red boxes in the header.
        damageStacks: 0,
        damageStacksMax: 3,
        // 0~3 : shield stacks (consumed before damage stacks)
        shieldStacks: 0,
        shieldStacksMax: 3,
        defense: 10, weapon:"D6",
        energy: 0, energyMax: 100
      }
    }, foundry.utils.deepClone(this.actor.system || {}), {inplace:false});

    data.system = sys;
    // Provide a short alias used by the template
    data.sheetCfg = normalizeSheetCfg(sys.babylon?.sheet);
    data.img = this.actor.img || "icons/svg/mystery-man.svg";

    // Gimmick tracker (30 slots) stored in system.babylon.gimmicks (boolean[])
    if (!sys.babylon) sys.babylon = {};
    let g = sys.babylon.gimmicks;
    if (!Array.isArray(g)) g = [];
    g = g.map(v => !!v);
    while (g.length < 30) g.push(false);
    if (g.length > 30) g = g.slice(0, 30);
    sys.babylon.gimmicks = g;
    data.gimmickSlots = g.map((checked, i) => ({ index: i, checked: !!checked, label: i + 1 }));

    const items = this.actor.items.contents || [];
    const defaultSkillList = { query:"", sort:"name-asc", kind:"all", field:"all", group:"none" };
const savedSkillList = this.actor.getFlag(SYSID, "skillList");
const skillList = foundry.utils.mergeObject(defaultSkillList, savedSkillList || {}, {inplace:false});
data.skillList = skillList;

data.skillsDocs = items.filter(i => i.type === "skill");

// build view
let skillsView = data.skillsDocs.map(doc => ({
  id: doc.id,
  uuid: doc.uuid,
  name: doc.name,
  img: doc.img,
  kind: doc.system?.kind || "skill",
  isUltimate: doc.system?.kind === "ultimate",
  fieldKey: doc.system?.fieldKey || "will",
  gainFirst: !!doc.system?.energyGainFirst,
  requiresEnergy: doc.system?.requiresEnergy,
  energyGain: doc.system?.energyGain,
  range: doc.system?.range || "",
  tags: Array.isArray(doc.system?.tags) ? doc.system.tags : (typeof doc.system?.tags === "string" ? doc.system.tags.split(",").map(s=>s.trim()).filter(Boolean) : [])
}));

// Precompute a compact tag label for list UI
for (const s of skillsView) {
  const t = (Array.isArray(s.tags) ? s.tags.map(x=>String(x).trim()).filter(Boolean) : []).filter(x=>x!=="선가산" && x!=="선가산 ");
  s.tagsText = t.slice(0, 3).join(", ") + (t.length > 3 ? "…" : "");

  // Labels (avoid helper-name collisions in templates)
  s.kindText = ({basic:"기본공격", skill:"스킬", ultimate:"필살기", passive:"패시브"})[s.kind] || "스킬";
  // Energy pill (hide '선가산' concept in list UI)
  const eg = Number(s.energyGain || 0) || 0;
  const ec = Number(s.requiresEnergy || 0) || 0;
  const parts = [];
  if (eg) parts.push(`+${eg}`);
  if (ec) parts.push(`-${ec}`);
  s.energyText = parts.length ? `⚡ ${parts.join(" ")}` : "";
}

// apply search/filter
const q = (skillList.query || "").trim().toLowerCase();
if (q) skillsView = skillsView.filter(s => (s.name || "").toLowerCase().includes(q));
if (skillList.kind && skillList.kind !== "all") skillsView = skillsView.filter(s => s.kind === skillList.kind);
if (skillList.field && skillList.field !== "all") skillsView = skillsView.filter(s => s.fieldKey === skillList.field);

// sort
const cmpText = (a,b)=>String(a||"").localeCompare(String(b||""), game.i18n?.lang || "ko", {numeric:true, sensitivity:"base"});
const sortMode = skillList.sort || "name-asc";
skillsView.sort((a,b)=>{
  if (sortMode === "name-desc") return -cmpText(a.name,b.name);
  if (sortMode === "kind") return cmpText(a.kind,b.kind) || cmpText(a.name,b.name);
  if (sortMode === "field") return cmpText(a.fieldKey,b.fieldKey) || cmpText(a.name,b.name);
  return cmpText(a.name,b.name);
});

// group
const kindLabel = (k)=>({basic:"기본공격", skill:"스킬", ultimate:"필살기", passive:"패시브"})[k] || "스킬";
const fieldLabel = (k)=>({charm:"매력·인상", body:"신체·체력", tech:"기술·기교", will:"의지·용기"})[k] || k;

let skillGroups = [];
const groupMode = skillList.group || "none";
if (groupMode === "kind") {
  const map = new Map();
  for (const s of skillsView) {
    const k = s.kind || "skill";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  const order = ["basic","skill","ultimate","passive"];
  for (const k of order) if (map.has(k)) skillGroups.push({key:k, label: kindLabel(k), skills: map.get(k)});
  for (const [k,v] of map.entries()) if (!order.includes(k)) skillGroups.push({key:k, label: kindLabel(k), skills:v});
} else if (groupMode === "field") {
  const map = new Map();
  for (const s of skillsView) {
    const k = s.fieldKey || "will";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  const order = ["charm","body","tech","will"];
  for (const k of order) if (map.has(k)) skillGroups.push({key:k, label: fieldLabel(k), skills: map.get(k)});
  for (const [k,v] of map.entries()) if (!order.includes(k)) skillGroups.push({key:k, label: fieldLabel(k), skills:v});
} else {
  skillGroups = [{key:"all", label:"", skills: skillsView}];
}

data.skillGroups = skillGroups;
data.skillsView = skillsView; // backward compat
const _e = Number(sys?.combat?.energy ?? 0) || 0;
const _eMaxRaw = Number(sys?.combat?.energyMax ?? 0);
const _eMax = (Number.isFinite(_eMaxRaw) && _eMaxRaw > 0) ? _eMaxRaw : 100;
const _eClamped = Math.max(0, Math.min(_e, _eMax));
data.energyPct = Math.max(0, Math.min(100, Math.round(100 * (_eClamped / _eMax))));
data.shieldStacks = cap(numOr(sys?.combat?.shieldStacks, 0), 0, 3);
data.shieldSlots = Array.from({length:3}, (_, i) => ({ index: i, filled: i < data.shieldStacks }));
data.damageStacks = cap(numOr(sys?.combat?.damageStacks, 0), 0, 3);
data.stackSlots = Array.from({length:3}, (_, i) => ({ index: i, filled: i < data.damageStacks }));
    return data;
  }
  activateListeners(html) {
    // Babylon: persist DC per skill row
    const actor = this.actor;
    // restore cached DC values
    html.find(".skill.row").each((_, el)=>{
      const id = el.dataset.itemId;
      const v = actor?.getFlag?.("babylon-system", "ui.dc."+id);
      if (v !== undefined && v !== null) {
        const input = el.querySelector(".babylon-skill-dc");
        if (input) input.value = v;
      }
    });
    // save on input
    html.on("input", ".babylon-skill-dc", ev => {
      const row = ev.currentTarget.closest(".skill.row");
      const id = row?.dataset.itemId;
      const val = ev.currentTarget.value;
      if (id) actor?.setFlag?.("babylon-system", "ui.dc."+id, val);
    });

    super.activateListeners(html);

    // Prevent Foundry image popout: capture click on portrait and open FilePicker
    try {
      const imgEl = html[0]?.querySelector?.(".portrait .profile-img");
      if (imgEl) {
        imgEl.addEventListener("click", (ev)=>{ this._onEditImage?.(ev); }, {capture:true});
        imgEl.addEventListener("dblclick", (ev)=>{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }, {capture:true});
      }
    } catch(e) {}

    // --- 3-hit damage stack UI (replaces HP) ---
    // Left-click: set to that slot (or +1 if clicking the current top).
    html.on("click", ".stack-slot", async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      const cur = cap(numOr(this.actor.system?.combat?.damageStacks, 0), 0, 3);
      let next = cap(idx + 1, 0, 3);
      if (next === cur) next = cap(cur + 1, 0, 3);
      await this.actor.update({"system.combat.damageStacks": next});
    });
    // Right-click: -1
    html.on("contextmenu", ".stack-slot", async (ev) => {
      ev.preventDefault();
      const cur = cap(numOr(this.actor.system?.combat?.damageStacks, 0), 0, 3);
      await this.actor.update({"system.combat.damageStacks": cap(cur - 1, 0, 3)});
    });

    // --- 3-stack shield UI ---
    html.on("click", ".shield-slot", async (ev) => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      const cur = cap(numOr(this.actor.system?.combat?.shieldStacks, 0), 0, 3);
      let next = cap(idx + 1, 0, 3);
      if (next === cur) next = cap(cur + 1, 0, 3);
      await this.actor.update({"system.combat.shieldStacks": next});
    });
    html.on("contextmenu", ".shield-slot", async (ev) => {
      ev.preventDefault();
      const cur = cap(numOr(this.actor.system?.combat?.shieldStacks, 0), 0, 3);
      await this.actor.update({"system.combat.shieldStacks": cap(cur - 1, 0, 3)});
    });

    // --- Gimmick tracker (30 slots) ---
    html.on("click", "[data-action=\'toggle-gimmick\']", async (ev)=>{
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      const cur = Array.isArray(this.actor.system?.babylon?.gimmicks) ? this.actor.system.babylon.gimmicks.map(Boolean) : [];
      while (cur.length < 30) cur.push(false);
      cur[idx] = !cur[idx];
      await this.actor.update({"system.babylon.gimmicks": cur});
    });

    html.on("click", "[data-action=\'reset-gimmicks\']", async (ev)=>{
      ev.preventDefault();
      await this.actor.update({"system.babylon.gimmicks": Array.from({length:30}, ()=>false)});
    });

    // --- Quick reset (optional) ---
    html.on("click", "[data-action=\'reset-combat\']", async (ev)=>{
      ev.preventDefault();
      await this.actor.update({
        "system.combat.shieldStacks": 0,
        "system.combat.damageStacks": 0,
        "system.combat.energy": 0
      });
    });

    try {
      const sel = html[0]?.querySelector?.('select[name="system.status.id"]');
      if (sel) {
        sel.addEventListener('change', ev => {
          const id = ev.currentTarget.value;
          const list = (Array.isArray(CONFIG?.statusEffects)?CONFIG.statusEffects:[]);
          const found = list.find(se => (se.id||se?.flags?.core?.statusId) === id);
          const label = found ? (game.i18n?.localize?.(found.label) ?? found.label ?? id) : "";
          const nameInput = html[0]?.querySelector?.('input[name="system.status.name"]');
          if (nameInput && label && (!nameInput.value || nameInput.value.trim().length===0)) nameInput.value = label;
        });
      }
    } catch(e) { console.warn('Babylon | status select init failed', e); }
    /* patched: do not block listener binding for read-only sheets */ // if (!this.isEditable) return;

    html.find("input, textarea, select").on("change", (ev)=>this._onInputChange?.(ev));;
    html.find("[data-action='test-roll']").on("click", (ev)=>this._onTestRoll?.(ev));;
    html.find("[data-action='join-combat']").on("click", (ev)=>this._onJoinCombat?.(ev));;
    html.find("[data-action='init']").on("click", (ev)=>this._onInitiative?.(ev));;
    html.find("[data-action='hit']").on("click", (ev)=>this._onHit?.(ev));;
    html.on("click", "[data-action='use-skill']", (ev)=>this._onUseSkill?.(ev));;
    html.find(".portrait .profile-img").on("click", (ev)=>this._onEditImage?.(ev));;
    html.find("[data-action='apply-token']").on("click", (ev)=>this._onApplyToken?.(ev));;

    // Open sheet config dialog
    html.on("click", "[data-action='open-sheet-config']", (ev)=>this._onOpenSheetConfig?.(ev));

    html.on("click", "[data-action='new-skill']", (ev)=>this._onNewSkill?.(ev));;
    html.on("click", "[data-action='edit-skill']", (ev)=>this._onEditSkill?.(ev));;
    html.on("click", "[data-action='del-skill']", (ev)=>this._onDelSkill?.(ev));;


// Skill list controls (persist per-actor in flags)
const saveSkillList = async (patch) => {
  const cur = this.actor.getFlag(SYSID, "skillList") || {};
  const next = foundry.utils.mergeObject(cur, patch || {}, {inplace:false});
  await this.actor.setFlag(SYSID, "skillList", next);
  this.render(false);
};

const debouncedQuery = foundry.utils.debounce((val)=>saveSkillList({query: val}), 250);

html.find("input.skill-search").on("input", (ev)=>debouncedQuery(ev.currentTarget.value || ""));
html.find("select.skill-filter-kind").on("change", (ev)=>saveSkillList({kind: ev.currentTarget.value}));
html.find("select.skill-filter-field").on("change", (ev)=>saveSkillList({field: ev.currentTarget.value}));
html.find("select.skill-sort").on("change", (ev)=>saveSkillList({sort: ev.currentTarget.value}));
html.find("select.skill-group").on("change", (ev)=>saveSkillList({group: ev.currentTarget.value}));
html.on("click", "[data-action='clear-skill-filters']", (ev)=>{ ev.preventDefault(); saveSkillList({query:"", kind:"all", field:"all", sort:"name-asc", group:"none"}); });

    // (sheet config is handled via the dialog)
html.find("input.skill-name").on("keydown", async ev => {
      if (ev.key === "Enter") { ev.preventDefault(); ev.currentTarget.blur(); }
    });
    html.find("input.skill-name").on("blur", async ev => {
      const el = ev.currentTarget;
      const id = el.dataset.itemId;
      const name = el.value.trim();
      const it = this.actor.items.get(id);
      if (it && name && name !== it.name) await it.update({name});
    });

    html.find(".skill .drag").each((i,el)=>{
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", ev => {
        const li = ev.currentTarget.closest("[data-item-id]");
        const itemId = li?.dataset?.itemId;
        const payload = { type:"babylon-skill", actorId: this.actor.id, itemId, uuid: (this.actor?.items?.get?.(itemId)?.uuid) };
        ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
      });
    });

    const b = this.actor.system?.babylon || {};
    html.find(`input[name="system.babylon.selectField"][value="${b.selectField||'charm'}"]`).prop("checked", true);
  
    // Delegate field-check button on sheet
    html.on("click", "[data-action='field-check']", async (ev)=>{
      ev.preventDefault();
      try{
        const root = html[0];
        const dc = Number(root.querySelector("#field-dc")?.value || 0) || 0;
        const actor = this.actor;
        const b = actor.system?.babylon || {};
        const key = b.selectField || "charm";
        const f = (txt)=>{ const m=String(txt||"").toUpperCase().match(/D(\d+)/); return m?Number(m[1]):6; };
        const fSize = f(b.fields?.[key]);
        const nSize = f(b.nameDie);
        const cSize = f(b.constellationDie);
        const formula = `{1d${nSize},1d${cSize},1d${fSize}}kh2`;
        const roll = await (new Roll(formula)).evaluate({async:true});
        const total = roll.total ?? 0;
        const isSuccess = total >= dc;
        const result = root.querySelector("#field-check-result");
        if (result){
          result.textContent = isSuccess ? `성공 (${total} ≥ DC ${dc})` : `실패 (${total} < DC ${dc})`;
          result.style.fontWeight = "700";
          result.style.color = isSuccess ? "var(--color-success,#2e8b57)" : "var(--color-danger,#c0392b)";
        }
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({actor}),
          flavor: `분야 판정 — ${key.toUpperCase()} vs DC ${dc}`,
          flags: { babylon:true, blStyle:"judge" }
        });
      }catch(err){
        ui.notifications?.error("분야 판정에 실패했습니다.");
        console.warn(err);
      }
    });
}

  async _onDrop(event) {
    const dataTxt = event.dataTransfer?.getData("text/plain");
    try {
      const data = JSON.parse(dataTxt || "{}");
      if (data?.type === "Item" && data.uuid) {
        const source = await fromUuid(data.uuid);
        if (!source) return false;
        const itemData = source.toObject();
        delete itemData._id;
        await this.actor.createEmbeddedDocuments("Item", [itemData]);
        return false;
        this.actor?.sheet?.render(false);
      }
    } catch(e){}
    return super._onDrop(event);
  }

  async _onEditImage(event) { event.preventDefault(); event.stopPropagation?.(); event.stopImmediatePropagation?.(); const fp = new FilePicker({ type: "image", current: this.actor.img, callback: async (p)=>{ await this.actor.update({img:p}); } }); fp.render(true); return false; }
  async _onApplyToken(event) { event.preventDefault(); const img = this.actor.img; await this.actor.update({"prototypeToken.texture.src": img}); ui.notifications?.info("초상 이미지를 토큰에 적용했습니다."); }
  async _onOpenSheetConfig(event) { event.preventDefault(); return openBabylonSheetConfigDialog(this); }
  async _onInputChange(event) { const el = event.currentTarget; const name = el.name; let value = (el.type === "checkbox") ? el.checked : (el.type === "number") ? Number(el.value || 0) : el.value; await this.actor.update({ [name]: value }); }
  _poolFormula(fieldKey) { const b = this.actor.system?.babylon || {}; const f = sizeFrom(b.fields?.[fieldKey], 6); const n = sizeFrom(b.nameDie, 6); const c = sizeFrom(b.constellationDie, 6); return `{1d${n},1d${c},1d${f}}kh2`; }
  async _onTestRoll(event) { event.preventDefault(); const b = this.actor.system?.babylon || {}; const key = b.selectField || "charm"; let formula = this._poolFormula(key); if (b.options?.bond) formula = `(${formula}) + 2d4kh1`; const roll = await evalRollCompat(new Roll(formula)); await roll.toMessage({ speaker: ChatMessage.getSpeaker({actor: this.actor}), flavor:`[판정] ${labelField(key)} (상위2합)${b.options?.bond?" + 유대":""}`, flags:{babylon:true, blStyle:"test"} }); }
  async _onJoinCombat(event){ event.preventDefault(); await ensureCombatantForActor(this.actor); ui.notifications?.info("전투에 참가했습니다."); }
  async _onInitiative(event) { event.preventDefault(); const ctx = await ensureCombatantForActor(this.actor); const cbt = ctx?.cbt; if (!cbt) return; const key = this.actor.system?.babylon?.selectField || "charm"; const roll = await evalRollCompat(new Roll(this._poolFormula(key))); await ctx.combat.setInitiative(cbt.id, roll.total ?? 0); await roll.toMessage({ speaker: ChatMessage.getSpeaker({actor}), flavor: `[우선권] ${labelField(key)} (상위2합)`, flags:{babylon:true, blStyle:"initiative"} }); }

  // New flow: immediate hit => fill 3 red stacks (no HP).
  async _onHit(event) {
    event.preventDefault();
    const curShield = cap(numOr(this.actor.system?.combat?.shieldStacks, 0), 0, 3);
    if (curShield > 0) {
      await this.actor.update({"system.combat.shieldStacks": cap(curShield - 1, 0, 3)});
      return;
    }
    const cur = cap(numOr(this.actor.system?.combat?.damageStacks, 0), 0, 3);
    await this.actor.update({"system.combat.damageStacks": cap(cur + 1, 0, 3)});
  }
  async _onAttack(event) { event.preventDefault(); await ensureCombatantForActor(this.actor); const key = this.actor.system?.babylon?.selectField || "charm"; const base = this._poolFormula(key); const w = sizeFrom(this.actor.system?.combat?.weapon || "D6", 6); let formula = `(${base}) + 1d${w}`; if (this.actor.system?.babylon?.options?.bond) formula += " + 2d4kh1"; const roll = await evalRollCompat(new Roll(formula)); await roll.toMessage({ speaker: ChatMessage.getSpeaker({actor: this.actor}), flavor:`[공격] ${labelField(key)} + 무기 d${w}${this.actor.system?.babylon?.options?.bond? " + 유대": ""}`, flags:{babylon:true, blStyle:"attack"} }); }
  async _onUseSkill(event) { event.preventDefault(); const li = event.currentTarget.closest('[data-item-id]'); const itemId = li?.dataset?.itemId || event.currentTarget.dataset?.itemId; if (!itemId) { ui.notifications?.warn('스킬 아이템을 찾을 수 없습니다.'); return; } return useBabylonSkill(this.actor.id, itemId, { judgeOnly: false }); }

  async _onNewSkill(event){
    event.preventDefault();
    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: "새 스킬",
      type: "skill",
      img: "icons/svg/dice-target.svg",
      system: { kind:"skill", fieldKey:"will",
        energyGain:30, energyGainFirst:true, requiresEnergy:0,
        tags:[], description:"", range:"", sound:"", soundVolume:0.8 }
    }]);
    created[0]?.sheet?.render(true);
    this.actor?.sheet?.render(false);
  }
  async _onEditSkill(event){
    event.preventDefault();
    const li = event.currentTarget.closest("[data-item-id]");
    const id = li?.dataset?.itemId;
    const it = this.actor.items.get(id);
    it?.sheet?.render(true);
  }
  async _onDelSkill(event){
    event.preventDefault();
    const li = event.currentTarget.closest("[data-item-id]");
    const id = li?.dataset?.itemId;
    if (this.actor.items.get(id)) { await this.actor.deleteEmbeddedDocuments("Item", [id]); }
    this.actor?.sheet?.render(false);
  }
}

// --- Scenario Boss Sheet (20+ stacks + separate shield) ---
class BabylonBossSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["babylon-system", "sheet", "actor", "boss"],
      template: TPL("actor-boss.hbs"),
      width: 980,
      height: 760,
      submitOnChange: true,
      closeOnSubmit: false,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "skills"}],
      dragDrop: [{dragSelector: ".skill .drag", dropSelector: ".skill-list"}],
      resizable: true
    });
  }

getData(options={}) {
  const data = super.getData(options) || {};
  const sys = foundry.utils.mergeObject({
    babylon: { note: "", gimmicks: Array.from({length:30}, ()=>false) },
    combat: {
      damageStacks: 0, damageStacksMax: 30,
      shieldStacks: 0, shieldStacksMax: 30,
      energy: 0, energyMax: 100
    }
  }, foundry.utils.deepClone(this.actor.system || {}), {inplace:false});

  // Defensive normalization (avoid 0 max / NaN)
  sys.combat.damageStacksMax = Math.max(1, numOr(sys.combat.damageStacksMax, 30));
  sys.combat.shieldStacksMax = Math.max(1, numOr(sys.combat.shieldStacksMax, 30));
  sys.combat.energyMax = Math.max(1, numOr(sys.combat.energyMax, 100));

  sys.combat.damageStacks = cap(numOr(sys.combat.damageStacks, 0), 0, sys.combat.damageStacksMax);
  sys.combat.shieldStacks = cap(numOr(sys.combat.shieldStacks, 0), 0, sys.combat.shieldStacksMax);
  sys.combat.energy = cap(numOr(sys.combat.energy, 0), 0, sys.combat.energyMax);

  data.system = sys;
  data.sheetCfg = normalizeSheetCfg(sys.babylon?.sheet);
  data.img = this.actor.img || "icons/svg/mystery-man.svg";

// Gimmick tracker (30 slots) stored in system.babylon.gimmicks (boolean[])
if (!sys.babylon) sys.babylon = {};
let g = sys.babylon.gimmicks;
if (!Array.isArray(g)) g = [];
g = g.map(v => !!v);
while (g.length < 30) g.push(false);
if (g.length > 30) g = g.slice(0, 30);
sys.babylon.gimmicks = g;
data.gimmickSlots = g.map((checked, i) => ({ index: i, checked: !!checked, label: i + 1 }));


  // Visual slots (kept lightweight)
  const DISPLAY_CAP = 40;
  const dmgShow = Math.min(sys.combat.damageStacksMax, DISPLAY_CAP);
  const shShow  = Math.min(sys.combat.shieldStacksMax, DISPLAY_CAP);

  data.damageSlots = Array.from({ length: dmgShow }, (_, i) => ({ value: i + 1, filled: i < sys.combat.damageStacks }));
  data.shieldSlots = Array.from({ length: shShow  }, (_, i) => ({ value: i + 1, filled: i < sys.combat.shieldStacks }));
  data.damageSlotsOverflow = Math.max(0, sys.combat.damageStacksMax - dmgShow);
  data.shieldSlotsOverflow = Math.max(0, sys.combat.shieldStacksMax - shShow);

  data.damagePct = Math.round((sys.combat.damageStacks / sys.combat.damageStacksMax) * 100);
  data.shieldPct = Math.round((sys.combat.shieldStacks / sys.combat.shieldStacksMax) * 100);
  const _e = Number(sys?.combat?.energy ?? 0) || 0;
const _eMaxRaw = Number(sys?.combat?.energyMax ?? 0);
const _eMax = (Number.isFinite(_eMaxRaw) && _eMaxRaw > 0) ? _eMaxRaw : 100;
const _eClamped = Math.max(0, Math.min(_e, _eMax));
data.energyPct = Math.max(0, Math.min(100, Math.round(100 * (_eClamped / _eMax))));
// Skills list (search / filter / group)
  const items = this.actor.items.contents || [];
  const defaultSkillList = { query:"", sort:"name-asc", kind:"all", field:"all", group:"none" };
  const savedSkillList = this.actor.getFlag(SYSID, "skillList");
  const skillList = foundry.utils.mergeObject(defaultSkillList, savedSkillList || {}, {inplace:false});
  data.skillList = skillList;

  const docs = items.filter(i => i.type === "skill");
  const kindLabel = (k)=>({basic:"기본공격", skill:"스킬", ultimate:"필살기", passive:"패시브"})[k] || "스킬";
  const fieldLabel = (k)=>({charm:"매력·인상", body:"신체·체력", tech:"기술·기교", will:"의지·용기"})[k] || k;

  let skillsView = docs.map(doc => {
    const s = doc.system || {};
    const kind = s.kind || "skill";
    const fieldKey = s.fieldKey || "will";
    const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === "string" ? s.tags.split(",").map(x=>x.trim()).filter(Boolean) : []);
    const eg = (s.energyGain === "" || s.energyGain === null || s.energyGain === undefined) ? null : numOr(s.energyGain, null);
    const req = (s.requiresEnergy === "" || s.requiresEnergy === null || s.requiresEnergy === undefined) ? null : numOr(s.requiresEnergy, null);
    const gainFirst = !!s.energyGainFirst;
    // compact energy string for list UI
    let energyText = "";
    if (eg !== null || req !== null) {
      const parts = [];
      if (eg !== null) parts.push(`${gainFirst ? "+" : "+"}${eg}`);
      if (req !== null && req > 0) parts.push(`-${req}`);
      energyText = parts.join(" ");
    }
    const t = tags.map(x=>String(x).trim()).filter(Boolean);
    const tagsText = t.slice(0,3).join(", ") + (t.length > 3 ? "…" : "");
    return {
      id: doc.id,
      name: doc.name,
      img: doc.img,
      kind,
      kindLabel: kindLabel(kind),
      fieldKey,
      fieldLabel: fieldLabel(fieldKey),
      range: String(s.range || "").trim(),
      tagsText,
      energyText
    };
  });

  // apply search/filter
  const q = (skillList.query || "").trim().toLowerCase();
  if (q) skillsView = skillsView.filter(s => (s.name || "").toLowerCase().includes(q));
  if (skillList.kind && skillList.kind !== "all") skillsView = skillsView.filter(s => s.kind === skillList.kind);
  if (skillList.field && skillList.field !== "all") skillsView = skillsView.filter(s => s.fieldKey === skillList.field);

  // sort
  const cmpText = (a,b)=>String(a||"").localeCompare(String(b||""), game.i18n?.lang || "ko", {numeric:true, sensitivity:"base"});
  const sortMode = skillList.sort || "name-asc";
  skillsView.sort((a,b)=>{
    if (sortMode === "name-desc") return -cmpText(a.name,b.name);
    if (sortMode === "kind") return cmpText(a.kind,b.kind) || cmpText(a.name,b.name);
    if (sortMode === "field") return cmpText(a.fieldKey,b.fieldKey) || cmpText(a.name,b.name);
    return cmpText(a.name,b.name);
  });

  // group
  let skillGroups = [];
  const groupMode = skillList.group || "none";
  if (groupMode === "kind") {
    const map = new Map();
    for (const s of skillsView) {
      const k = s.kind || "skill";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    const order = ["basic","skill","ultimate","passive"];
    for (const k of order) if (map.has(k)) skillGroups.push({key:k, label: kindLabel(k), skills: map.get(k)});
    for (const [k,v] of map.entries()) if (!order.includes(k)) skillGroups.push({key:k, label: kindLabel(k), skills:v});
  } else if (groupMode === "field") {
    const map = new Map();
    for (const s of skillsView) {
      const k = s.fieldKey || "will";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    const order = ["charm","body","tech","will"];
    for (const k of order) if (map.has(k)) skillGroups.push({key:k, label: fieldLabel(k), skills: map.get(k)});
    for (const [k,v] of map.entries()) if (!order.includes(k)) skillGroups.push({key:k, label: fieldLabel(k), skills:v});
  } else {
    skillGroups = [{key:"all", label:"", skills: skillsView}];
  }

  data.skillGroups = skillGroups;
  data.skillsView = skillsView; // backward compat
  return data;
}

  activateListeners(html) {
    super.activateListeners(html);

// Prevent huge image popout; use FilePicker on portrait click (capture)
try {
  const imgEl = html[0]?.querySelector?.(".boss-portrait");
  if (imgEl) {
    imgEl.addEventListener("click", (ev)=>{
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      const fp = new FilePicker({ type:"image", current: this.actor.img, callback: async (p)=>{ await this.actor.update({img:p}); } });
      fp.render(true);
      return false;
    }, {capture:true});
  }
} catch(e) {}


// Sheet config (colors / bars)
html.on("click", "[data-action='open-sheet-config']", (ev)=>{ ev.preventDefault(); openBabylonSheetConfigDialog(this); });


    // Skill list UI controls (search / filter / sort / group)
    const saveSkillList = async (patch) => {
      const cur = this.actor.getFlag(SYSID, "skillList") || {};
      const next = foundry.utils.mergeObject(cur, patch || {}, {inplace:false});
      await this.actor.setFlag(SYSID, "skillList", next);
      this.render(false);
    };
    const debouncedQuery = foundry.utils.debounce((value)=>saveSkillList({query: value}), 200);
    html.on("input", "[data-action='skill-query']", (ev)=>{ debouncedQuery(String(ev.currentTarget.value||"")); });
    html.on("click", "[data-action='skill-clear']", async (ev)=>{ ev.preventDefault(); await saveSkillList({query:""}); });
    html.on("change", "[data-action='skill-kind']", (ev)=>saveSkillList({kind: ev.currentTarget.value}));
    html.on("change", "[data-action='skill-field']", (ev)=>saveSkillList({field: ev.currentTarget.value}));
    html.on("change", "[data-action='skill-sort']", (ev)=>saveSkillList({sort: ev.currentTarget.value}));
    html.on("change", "[data-action='skill-group']", (ev)=>saveSkillList({group: ev.currentTarget.value}));

// Max값(피격/보호막) 바꾸면 즉시 칸 개수 다시 그리기
const rerenderMax = foundry.utils.debounce(() => this.render(false), 50);
html.on("change", "input[name='system.combat.shieldStacksMax']", rerenderMax);
html.on("change", "input[name='system.combat.damageStacksMax']", rerenderMax);


    
const stepStack = async (path, delta, kind) => {
  const max = (kind === "shield") ? maxShieldStacks(this.actor) : maxDamageStacks(this.actor);
  const cur = numOr(foundry.utils.getProperty(this.actor.system, path), 0);
  const next = cap(cur + delta, 0, max);
  await this.actor.update({ [`system.${path}`]: next });
};

const setStack = async (path, value, kind) => {
  const max = (kind === "shield") ? maxShieldStacks(this.actor) : maxDamageStacks(this.actor);
  const cur = numOr(foundry.utils.getProperty(this.actor.system, path), 0);
  const v = numOr(value, cur);
  // Toggle: clicking the current level reduces by 1 (handy for quick corrections)
  const next = (cur === v) ? cap(v - 1, 0, max) : cap(v, 0, max);
  await this.actor.update({ [`system.${path}`]: next });
};

const stepEnergy = async (delta) => {
  const max = Math.max(1, numOr(this.actor.system?.combat?.energyMax, 100));
  const cur = numOr(this.actor.system?.combat?.energy, 0);
  await this.actor.update({ "system.combat.energy": cap(cur + delta, 0, max) });
};

const setEnergy = async (value) => {
  const max = Math.max(1, numOr(this.actor.system?.combat?.energyMax, 100));
  await this.actor.update({ "system.combat.energy": cap(numOr(value, 0), 0, max) });
};

// Reset (quick)
html.on("click", "[data-action='reset-combat']", async (ev)=>{
  ev.preventDefault();
  await this.actor.update({
    "system.combat.shieldStacks": 0,
    "system.combat.damageStacks": 0,
    "system.combat.energy": 0
  });
  this.render(false);
});

// Gimmick tracker (30 slots)
const getGimmicks = () => {
  const raw = this.actor.system?.babylon?.gimmicks;
  let arr = Array.isArray(raw) ? raw.slice() : [];
  arr = arr.map(v => !!v);
  while (arr.length < 30) arr.push(false);
  if (arr.length > 30) arr = arr.slice(0, 30);
  return arr;
};

html.on("click", "[data-action='toggle-gimmick']", async (ev) => {
  ev.preventDefault();
  const idx = Number(ev.currentTarget?.dataset?.index);
  if (!Number.isFinite(idx) || idx < 0 || idx >= 30) return;
  const arr = getGimmicks();
  arr[idx] = !arr[idx];
  await this.actor.update({ "system.babylon.gimmicks": arr });
  this.render(false);
});

html.on("click", "[data-action='reset-gimmicks']", async (ev) => {
  ev.preventDefault();
  await this.actor.update({ "system.babylon.gimmicks": Array.from({length:30}, ()=>false) });
  this.render(false);
});

// Stack +/-
html.on("click", "[data-action='shield-dec5']", (ev)=>{ ev.preventDefault(); stepStack("combat.shieldStacks", -5, "shield"); });
html.on("click", "[data-action='shield-dec1']", (ev)=>{ ev.preventDefault(); stepStack("combat.shieldStacks", -1, "shield"); });
html.on("click", "[data-action='shield-inc1']", (ev)=>{ ev.preventDefault(); stepStack("combat.shieldStacks", +1, "shield"); });
html.on("click", "[data-action='shield-inc5']", (ev)=>{ ev.preventDefault(); stepStack("combat.shieldStacks", +5, "shield"); });
html.on("click", "[data-action='shield-zero']", (ev)=>{ ev.preventDefault(); setStack("combat.shieldStacks", 0, "shield"); });
html.on("click", "[data-action='shield-max']", (ev)=>{ ev.preventDefault(); setStack("combat.shieldStacks", maxShieldStacks(this.actor), "shield"); });

html.on("click", "[data-action='dmg-dec5']", (ev)=>{ ev.preventDefault(); stepStack("combat.damageStacks", -5, "damage"); });
html.on("click", "[data-action='dmg-dec1']", (ev)=>{ ev.preventDefault(); stepStack("combat.damageStacks", -1, "damage"); });
html.on("click", "[data-action='dmg-inc1']", (ev)=>{ ev.preventDefault(); stepStack("combat.damageStacks", +1, "damage"); });
html.on("click", "[data-action='dmg-inc5']", (ev)=>{ ev.preventDefault(); stepStack("combat.damageStacks", +5, "damage"); });
html.on("click", "[data-action='dmg-zero']", (ev)=>{ ev.preventDefault(); setStack("combat.damageStacks", 0, "damage"); });
html.on("click", "[data-action='dmg-max']", (ev)=>{ ev.preventDefault(); setStack("combat.damageStacks", maxDamageStacks(this.actor), "damage"); });

// Click slots to set exact value
html.on("click", "[data-action='set-shield']", (ev)=>{ ev.preventDefault(); setStack("combat.shieldStacks", Number(ev.currentTarget?.dataset?.value), "shield"); });
html.on("click", "[data-action='set-dmg']", (ev)=>{ ev.preventDefault(); setStack("combat.damageStacks", Number(ev.currentTarget?.dataset?.value), "damage"); });

// Energy
html.on("click", "[data-action='energy-dec10']", (ev)=>{ ev.preventDefault(); stepEnergy(-10); });
html.on("click", "[data-action='energy-dec1']", (ev)=>{ ev.preventDefault(); stepEnergy(-1); });
html.on("click", "[data-action='energy-inc1']", (ev)=>{ ev.preventDefault(); stepEnergy(+1); });
html.on("click", "[data-action='energy-inc10']", (ev)=>{ ev.preventDefault(); stepEnergy(+10); });
html.on("click", "[data-action='energy-zero']", (ev)=>{ ev.preventDefault(); setEnergy(0); });
html.on("click", "[data-action='energy-max']", (ev)=>{ ev.preventDefault(); setEnergy(numOr(this.actor.system?.combat?.energyMax, 100)); });
html.on("click", "[data-action='energy-half']", (ev)=>{
  ev.preventDefault();
  const max = Math.max(1, numOr(this.actor.system?.combat?.energyMax, 100));
  setEnergy(Math.floor(max / 2));
});

    // Skills
    html.on("click", "[data-action='use-skill']", (ev)=>{
      ev.preventDefault();
      const itemId = ev.currentTarget?.dataset?.itemId;
      if (itemId) useBabylonSkill(this.actor.id, itemId, { judgeOnly:false });
    });
    html.on("click", "[data-action='new-skill']", (ev)=>this._onNewSkill(ev));
    html.on("click", "[data-action='edit-skill']", (ev)=>{
      ev.preventDefault();
      const id = ev.currentTarget?.dataset?.itemId;
      this.actor.items.get(id)?.sheet?.render(true);
    });
    html.on("click", "[data-action='delete-skill']", async (ev)=>{
      ev.preventDefault();
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      const ok = await Dialog.confirm({ title:"삭제", content:"이 스킬을 삭제할까요?" });
      if (ok) await this.actor.deleteEmbeddedDocuments("Item", [id]);
      this.render(false);
    });
  }

  async _onNewSkill(event){
    event.preventDefault();
    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: "새 스킬",
      type: "skill",
      img: "icons/svg/dice-target.svg",
      system: { kind:"skill", fieldKey:"will", energyGain:30, energyGainFirst:true, requiresEnergy:0, tags:[], description:"", range:"", sound:"", soundVolume:0.8 }
    }]);
    created[0]?.sheet?.render(true);
    this.render(false);
  }
}

class BabylonSkillSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["babylon-system", "sheet", "item"],
      template: TPL("item-skill.hbs"),
      width: 700, height: 700
    });
  }
  getData(options={}){
    if (!this.item) return {};
    const data = super.getData(options) || {};
    // No dice/formula fields needed for this rule set.
    const sys = foundry.utils.mergeObject({
      kind:"skill", fieldKey:"will", target:"single",
      cooldown:0, tags:[], description:"",
      energyGain: null, requiresEnergy: null, energyResetTo: null, energyGainFirst: false,
      sound: "", soundVolume: 0.8
    }, foundry.utils.deepClone(this.item.system||{}), {inplace:false});
    
    // Add defaults and status choices
    if (!sys.range) sys.range = "";
    if (!sys.status) sys.status = {applyButton:true, id:"", name:"", duration:"", note:""};
    const coreSE = Array.isArray(CONFIG?.statusEffects) ? CONFIG.statusEffects : [];
    data.statusChoices = coreSE.map(se => ({
      id: se.id || se?.flags?.core?.statusId || "",
      label: (game.i18n?.localize?.(se.label) ?? se.label ?? se.id) || ""
    })).filter(o => o.id && o.label);
data.tagsString = Array.isArray(sys.tags) ? sys.tags.join(', ') : (sys.tags || '');
    data.system = sys; return data;
  }
  activateListeners(html){
    super.activateListeners(html);

// Use button (only works when owned by an Actor)
const useSkill = async (ev) => {
  ev.preventDefault();
  const actor = this.item?.parent;
  if (!actor) return ui.notifications?.warn("이 스킬은 Actor에 소속되어 있지 않습니다.");
  return useBabylonSkill(actor.id, this.item.id, { judgeOnly: false });
};
html.find("[data-action='send-skill']").on("click", useSkill);
// Backward compat: older templates may still have roll-skill
html.find("[data-action='roll-skill']").on("click", useSkill);

// Tags input: normalize comma-separated to array on blur
html.find('input[name="system.tags"]').on("blur", async (ev) => {
  const raw = String(ev.currentTarget.value || "");
  const arr = raw.split(",").map(s=>s.trim()).filter(Boolean);
  await this.item.update({"system.tags": arr});
});
    try {
      const sel = html[0]?.querySelector?.('select[name="system.status.id"]');
      if (sel) {
        sel.addEventListener('change', ev => {
          const id = ev.currentTarget.value;
          const list = (Array.isArray(CONFIG?.statusEffects)?CONFIG.statusEffects:[]);
          const found = list.find(se => (se.id||se?.flags?.core?.statusId) === id);
          const label = found ? (game.i18n?.localize?.(found.label) ?? found.label ?? id) : "";
          const nameInput = html[0]?.querySelector?.('input[name="system.status.name"]');
          if (nameInput && label && (!nameInput.value || nameInput.value.trim().length===0)) nameInput.value = label;
        });
      }
    } catch(e) { console.warn('Babylon | status select init failed', e); }
    html.find("[data-action='pick-sound']").on("click", async ev => {
      ev.preventDefault();
      const fp = new FilePicker({
        type: "audio",
        current: this.item.system?.sound || "",
        callback: async (p)=>{ await this.item.update({"system.sound": p}); }
      });
      fp.render(true);
    });
    html.find("[data-action='pick-icon']").on("click", async ev => {
      ev.preventDefault();
      const fp = new FilePicker({
        type: "image",
        current: this.item.img || "",
        callback: async (p)=>{ await this.item.update({"img": p}); }
      });
      fp.render(true);
    });
  }

  /** Normalize form input before saving */
  async _updateObject(event, formData) {
    // Tags: comma-separated string -> array
    if (Object.prototype.hasOwnProperty.call(formData, "system.tags")) {
      const raw = String(formData["system.tags"] || "");
      formData["system.tags"] = raw.split(",").map(s=>s.trim()).filter(Boolean);
    }
    // Energy reset: treat empty string as null
    if (Object.prototype.hasOwnProperty.call(formData, "system.energyResetTo")) {
      if (formData["system.energyResetTo"] === "") formData["system.energyResetTo"] = null;
      else {
        const n = Number(formData["system.energyResetTo"]);
        if (Number.isFinite(n)) formData["system.energyResetTo"] = n;
      }
    }
    return super._updateObject(event, formData);
  }
}

Hooks.once("init", async () => {
  try {
    game.settings.register("babylon-system","styleChatCards",{
      name: "채팅 카드 스타일 적용",
      hint: "Babylon 전용 채팅 카드 스타일을 적용합니다. (기본 해제)",
      scope: "client", config: true, type: Boolean, default: false
    });

// World migration marker (cleanup legacy inventory items)
game.settings.register("babylon-system","migrationCleanupV12_20260106",{
  scope: "world", config: false, type: Boolean, default: false
});

  } catch(e){ console.warn("Babylon | setting register failed", e); }
});

Hooks.once("init", async () => {
// Preload templates (chat cards)
try { await loadTemplates([TPL("chat/skill-roll.hbs")]); } catch(e) { console.warn("Babylon | template preload failed", e); }

// Handlebars helpers for labels
try {
  Handlebars.registerHelper("kindLabel", (k)=>({basic:"기본공격", skill:"스킬", ultimate:"필살기", passive:"패시브"})[k]||"스킬");
  Handlebars.registerHelper("fieldLabel", (k)=>({charm:"매력·인상", body:"신체·체력", tech:"기술·기교", will:"의지·용기"})[k]||k);
} catch(e) { /* ignore */ }
  game.babylon = game.babylon || {};
  game.babylon.useSkill = useBabylonSkill;
  game.babylon.useSkillByUUID = async (uuid)=>{
    const doc = await fromUuid(uuid);
    const item = doc?.document ?? doc;
    const actor = item?.parent;
    if (!(actor && item)) return ui.notifications?.warn("UUID에서 스킬을 찾지 못했습니다.");
    return useBabylonSkill(actor.id, item.id);
  };

  game.settings.register("babylon-system","enableSkillSound",{
    name: "스킬 사운드 사용",
    hint: "스킬 사용 시 지정된 오디오 파일을 재생합니다.",
    scope: "world", config: true, type: Boolean, default: true
  });

  await loadTemplates([ TPL("actor-character.hbs"), TPL("actor-boss.hbs"), TPL("item-skill.hbs"), TPL("chat/skill-roll.hbs"), TPL("dialog/sheet-config.hbs") ]);
// patched: do not unregister core actor sheet
Actors.registerSheet(SYSID, BabylonCharacterSheet, { types:["character","npc"], makeDefault:true, label:"Babylon Character Sheet" });
Actors.registerSheet(SYSID, BabylonBossSheet, { types:["boss"], makeDefault:true, label:"Babylon Boss Sheet" });
// patched: do not unregister core item sheet
Items.registerSheet(SYSID, BabylonSkillSheet, { types:["skill"], makeDefault:true, label:"Babylon Skill" });
});

Hooks.on("createActor", async (actor, options, userId) => {
  try {
    // Default boss stack caps (persisted on the actor)
    if (actor?.type === "boss") {
      const upd = {};
      const dmMax = foundry.utils.getProperty(actor.system, "combat.damageStacksMax");
      const shMax = foundry.utils.getProperty(actor.system, "combat.shieldStacksMax");
      if (dmMax === undefined) upd["system.combat.damageStacksMax"] = 20;
      if (shMax === undefined) upd["system.combat.shieldStacksMax"] = 20;
      if (foundry.utils.getProperty(actor.system, "combat.damageStacks") === undefined) upd["system.combat.damageStacks"] = 0;
      if (foundry.utils.getProperty(actor.system, "combat.shieldStacks") === undefined) upd["system.combat.shieldStacks"] = 0;
      if (Object.keys(upd).length) await actor.update(upd);
    }
    if (game.userId === userId) setTimeout(() => actor?.sheet?.render(true), 120);
  } catch(e) { console.warn("Babylon | createActor hook error", e); }
});

// --- Hotbar macro: name decoupled from item name + tooltip set to displayName ---
Hooks.on("hotbarDrop", async (bar, data, slot) => {
  try{
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    if (payload?.type !== "babylon-skill") return;
    const { actorId, itemId, uuid:payloadUuid } = payload;
let actor = game.actors.get(actorId);
let item = actor?.items.get(itemId);
if (!item && payloadUuid) { const doc = await fromUuid(payloadUuid); const cand = doc?.document ?? doc; if (cand) { item = cand; actor = item?.parent ?? actor; } }
if (!actor || !item) return ui.notifications?.warn("드롭 실패: 배우 또는 스킬을 찾을 수 없습니다.");
const uuid = item.uuid;
    const command = `game.babylon?.useSkillByUUID?.("${uuid}");`;

    const displayName = item.name;
    const technicalName = `BL:${uuid}`;

    let macro = game.macros.find(m => m.getFlag("babylon-system","itemUuid") === uuid);
    if (!macro){
      macro = await Macro.create({
        name: technicalName,
        type: "script",
        img: item.img || "icons/svg/dice-target.svg",
        command,
        flags: { "babylon-system": { itemUuid: uuid, actorId, itemId, displayName } }
      });
    } else {
      await macro.update({ img: item.img || macro.img, command, name: technicalName });
      await macro.setFlag("babylon-system","displayName", displayName);
      await macro.setFlag("babylon-system","itemUuid", uuid);
    }
    await game.user.assignHotbarMacro(macro, slot);

    // Update slot label + tooltip to displayName
    setTimeout(()=>{
      const hb = ui?.hotbar?.element;
      if (!hb) return;
      const el = hb.find(`.macro[data-slot="${slot}"]`)[0];
      if (!el) return;
      el.querySelector(".macro-title")?.replaceChildren(document.createTextNode(displayName));
      el.setAttribute("title", displayName);
      el.setAttribute("aria-label", displayName);
      el.setAttribute("data-tooltip", displayName); // Foundry v12 TooltipManager uses this
    }, 50);

    return false;
  }catch(e){ console.warn("Babylon | hotbarDrop error", e); }
});

// On any hotbar render, sync label + tooltip from flags
Hooks.on("renderHotbar", (app, html) => {
  try{
    html.find(".macro").each((i, el) => {
      const slot = Number(el.dataset.slot);
      const macro = game.user.getHotbarMacro(slot);
      if (!macro) return;
      const label = macro.getFlag("babylon-system","displayName");
      if (label){
        el.querySelector(".macro-title")?.replaceChildren(document.createTextNode(label));
        el.setAttribute("title", label);
        el.setAttribute("aria-label", label);
        el.setAttribute("data-tooltip", label);
      }
    });
  } catch(e){ console.warn("Babylon | renderHotbar sync error", e); }
});

Hooks.on("renderActorSheet", (sheet, html) => {
  html.find(".skill .drag").each((i,el)=>{
    el.setAttribute("draggable","true");
    el.addEventListener("dragstart", ev => {
      const li = ev.currentTarget.closest("[data-item-id]");
      const itemId = li?.dataset?.itemId;
      const payload = { type:"babylon-skill", actorId: sheet.actor.id, itemId, uuid: (sheet.actor?.items?.get?.(itemId)?.uuid) };
      ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
    });
  });
});

Hooks.on("renderChatMessage", (message, html) => {
try{
  const flags = message.flags || {};
  const st = flags.status;
  if (flags.babylon && st && (st.name || st.id) && (st.applyButton !== false)) {
    const host = html[0] || html;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "babylon-apply-status";
    const label = st.name || "상태이상";
    btn.textContent = `상태이상 적용: ${label}`;
    (host.querySelector(".message-content") || host).appendChild(btn);
    btn.addEventListener("click", async ()=>{
      try{
        const targets = Array.from(game.user?.targets || []);
        const selected = targets.length ? targets : (canvas.tokens?.controlled || []);
        if (!selected.length){ ui.notifications?.warn("대상 토큰을 선택/타겟하세요."); return; }

        // Resolve core status effect by id or label
        const list = Array.isArray(CONFIG?.statusEffects) ? CONFIG.statusEffects : [];
        const id = st.id || (list.find(se => (game.i18n?.localize?.(se.label) ?? se.label)?.toLowerCase() === String(st.name||'').toLowerCase())?.id);
        const se = id ? list.find(s=>s.id===id) : null;
        const rounds = (()=>{ const m=String(st.duration||'').match(/(\d+)/); return m? Number(m[1]) : null; })();

        await Promise.allSettled(selected.map(async t=>{
          const actor = t.actor;
          if (!actor) return;
          if (id && t?.document?.toggleStatusEffect){
            await t.document.toggleStatusEffect(id, { active: true, overlay: false });
          } else if (actor.createEmbeddedDocuments){
            const eff = { label: label, icon: (se?.icon || st.icon || "icons/svg/aura.svg"), origin: flags.itemUuid || actor.uuid, changes: [], disabled: false };
            if (rounds) eff.duration = { rounds };
            if (id) eff.statuses = [id];
            await actor.createEmbeddedDocuments("ActiveEffect", [eff]);
          }
        }));
        ui.notifications?.info(`'${label}' 적용 완료`);
      }catch(e){ console.error(e); ui.notifications?.error("상태이상 적용 실패"); }
    });
  }
}catch(e){}


  if (!message.flags?.babylon) return;

  // Rename 판정 관련 label을 엔트로피로 표기
  try {
    const host = html[0] || html;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      // 1) '판정값' → '엔트로피'
      if (node.nodeValue.includes("판정값")) {
        node.nodeValue = node.nodeValue.replace(/판정값/g, "엔트로피");
      }
      // 2) 채팅 헤더 등에서 단독으로 쓰이는 '판정' → '엔트로피'
      const trimmed = node.nodeValue.trim();
      if (trimmed === "판정") {
        node.nodeValue = node.nodeValue.replace("판정", "엔트로피");
      }
    }
  } catch (e) {
    console.warn("Babylon | 엔트로피 label patch failed", e);
  }


  // Apply styling only if enabled in settings
  let useStyle = false;
  try { useStyle = game.settings.get("babylon-system","styleChatCards"); } catch(e){}
  if (useStyle) {
    html.addClass("babylon-chat");
    const style = message.flags.blStyle || "test";
    html.addClass(`babylon-${style}`);
  }

  // If damage message, append "피해 굴리기" button that re-rolls saved formula
  if (false /* hard disabled */ && message.flags?.blDamage && message.flags?.blFormula) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "babylon-reroll-damage";
    btn.textContent = "피해 굴리기";
    btn.style.marginLeft = "6px";
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        const formula = String(message.flags.blFormula || "").trim();
        if (!formula) return;
        const r = new Roll(formula);
        if (r.evaluate) await r.evaluate({async:true}); 

  if (false && message.flags?.canDamage && !message.flags?.blDamage) {
    const content = html[0]?.querySelector?.(".message-content") || html[0];
    if (content && !content.querySelector?.(".bby-next-dmg")){
      const wrap = document.createElement("div");
      wrap.className = "bby-next-dmg";
      wrap.style.marginTop = "6px";
      wrap.style.paddingTop = "6px";
      wrap.style.borderTop = "1px dashed var(--color-border,#666)";
      wrap.innerHTML = `
        <div class="bby-next-dmg-row" style="display:flex;gap:6px;align-items:center;">
          <label>피해식</label>
          <input type="text" class="bby-dmg-inp" style="width:140px;" value="${(message.flags?.blFormula||'1d6').replace(/"/g,'&quot;')}" />
          <button type="button" class="bby-dmg-go">피해 계산</button>
        </div>`;
      content.appendChild(wrap);
      wrap.querySelector(".bby-dmg-go")?.addEventListener("click", async ev=>{
        ev.preventDefault();
        const formula = wrap.querySelector(".bby-dmg-inp")?.value?.trim();
        if (!formula) return;
        try{
          const actor = game.actors.get(message.speaker?.actor) || game.user?.character || null;
          const speaker = ChatMessage.getSpeaker({ actor });
          const r = await (new Roll(formula)).evaluate({async:true});
          const flavor = `피해 주사위: ${formula} → ${r.total}`;
          await r.toMessage({ speaker, flavor, flags: { babylon:true, blDamage:true, blFormula: formula } });
        }catch(err){
          ui.notifications?.error("피해 굴리기에 실패했습니다.");
          console.warn(err);
        }
      });
    }
  }

else if (r.evaluateSync) r.evaluateSync();
        const flavor = `피해 주사위: ${formula} → ${r.total}`;
        await r.toMessage({ speaker: ChatMessage.getSpeaker({user: game.user}), flavor, flags:{babylon:true, blStyle:"damage", blDamage:true, blFormula: formula} });
      } catch(err) {
        ui.notifications?.error("피해 굴리기에 실패했습니다.");
        console.warn(err);
      }
    });
    const content = html[0]?.querySelector?.(".message-content") || html[0];
    content?.appendChild?.(btn);
  }
});


// Babylon: Chat-level Damage button
Hooks.on("renderChatLog", (app, html) => { /* 피해 계산 버튼 완전 비활성화 */ });



// --- Patch: suppress 판정값 chat when using a skill ---
;(function(){
  try {
    const __origUseSkill = useBabylonSkill;
    async function useBabylonSkill(actorId, itemId, opts={}){
      const next = Object.assign({}, opts, { judgeOnly:false, forceJudgeMessage:false });
      // signal to suppress the very next judge message created by this flow
      window.__BABYLON_SUPPRESS_NEXT_JUDGE = true;
      return await __origUseSkill(actorId, itemId, next);
    }
    // overwrite original binding
    window.useBabylonSkill = useBabylonSkill;

    // prevent the next judge message from being created
    Hooks.on("preCreateChatMessage", (doc, data, options, userId)=>{
      try {
        if (window.__BABYLON_SUPPRESS_NEXT_JUDGE && data?.flags?.babylon && data?.flags?.blStyle === "judge"){
          window.__BABYLON_SUPPRESS_NEXT_JUDGE = false;
          return false; // cancel creation
        }
      } catch(e){}
      return true;
    });
  } catch(e){
    console.warn("Babylon | skill-judge suppression patch failed", e);
  }
})(); // end patch


// --- robust _onUseSkill override to support UUID fallback ---
;(function(){
  try{
    const proto = BabylonCharacterSheet.prototype;
    const __orig = proto._onUseSkill;
    proto._onUseSkill = async function(event){
      try{
        event?.preventDefault?.();
        const el = event?.currentTarget?.closest?.("[data-item-id],[data-uuid]");
        const uuid = el?.dataset?.uuid;
        const itemId = el?.dataset?.itemId;
        let actor = this.actor;
        let item = null;
        if (uuid){
          const doc = await fromUuid(uuid);
          const cand = doc?.document ?? doc;
          if (cand){ item = cand; actor = item?.parent ?? actor; }
        }
        if (!item && itemId) item = actor?.items?.get?.(itemId);
        if (!(actor && item)) return ui.notifications?.warn('스킬 아이템을 찾을 수 없습니다.');
        return useBabylonSkill(actor.id, item.id, { judgeOnly:false });
      }catch(e){ console.warn("Babylon | _onUseSkill override failed", e); }
    };
  }catch(e){ console.warn("Babylon | failed to patch _onUseSkill", e); }
})();


Hooks.once("ready", async () => {
  try {
    const key = "migrationCleanupV12_20260106";
    const done = game.settings.get("babylon-system", key);
    if (done) return;

    const legacyTypes = new Set(["gear","consumable","feature","inventory"]);
    let removed = 0;
    let affectedActors = 0;

    for (const actor of (game.actors?.contents || [])) {
      const bad = (actor.items?.contents || []).filter(it => legacyTypes.has(it.type) || it.type === "" || it.type == null);
      if (!bad.length) continue;
      affectedActors += 1;
      removed += bad.length;
      await actor.deleteEmbeddedDocuments("Item", bad.map(it => it.id));
    }

    await game.settings.set("babylon-system", key, true);
    if (removed > 0) {
      ui.notifications?.info(`Babylon 마이그레이션: 레거시 아이템 ${removed}개 제거 (${affectedActors}명)`);
    } else {
      ui.notifications?.info("Babylon 마이그레이션: 정리할 레거시 아이템이 없습니다.");
    }
  } catch (e) {
    console.warn("Babylon | migration cleanup failed", e);
    ui.notifications?.warn("Babylon 마이그레이션 정리에 실패했습니다. 콘솔을 확인하세요.");
  }
});
