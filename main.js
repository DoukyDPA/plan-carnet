"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PlanCarnetPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/outline.ts
var HEADING = /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
var FENCE = /^ {0,3}(`{3,}|~{3,})/;
function scanHeadings(lines, skipFrontmatter) {
  var _a, _b;
  const out = [];
  let i = 0;
  if (skipFrontmatter && ((_a = lines[0]) == null ? void 0 : _a.trim()) === "---") {
    for (i = 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === "---" || t === "...") {
        i++;
        break;
      }
    }
  }
  let fence = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const f = FENCE.exec(l);
    if (f) {
      const mark = f[1];
      if (fence === null) fence = mark;
      else if (mark[0] === fence[0] && mark.length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = HEADING.exec(l);
    if (m) out.push({ line: i, level: m[1].length, title: ((_b = m[2]) != null ? _b : "").trim() });
  }
  return out;
}
function countWords(lines, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) {
    const w = lines[i].replace(/%%.*?%%/g, "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    if (w) n += w.length;
  }
  return n;
}
function parse(text) {
  const lines = text.split("\n");
  const heads = scanHeadings(lines, true);
  const roots = [];
  const all = [];
  const stack = [];
  heads.forEach((h, idx) => {
    var _a;
    const nextLine = idx + 1 < heads.length ? heads[idx + 1].line : lines.length;
    const node = {
      level: h.level,
      title: h.title,
      line: h.line,
      end: lines.length,
      children: [],
      parent: null,
      ownWords: countWords(lines, h.line + 1, nextLine),
      totalWords: 0
    };
    while (stack.length && stack[stack.length - 1].level >= h.level) {
      stack.pop().end = h.line;
    }
    const parent = (_a = stack[stack.length - 1]) != null ? _a : null;
    node.parent = parent;
    (parent ? parent.children : roots).push(node);
    stack.push(node);
    all.push(node);
  });
  const sum = (n) => n.totalWords = n.ownWords + n.children.reduce((a, c) => a + sum(c), 0);
  roots.forEach(sum);
  return { lines, roots, all };
}
function findByLine(o, line) {
  return o.all.find((n) => n.line === line);
}
function nodeAtLine(o, line) {
  let found;
  for (const n of o.all) if (n.line <= line && line < n.end) found = n;
  return found;
}
function siblingsOf(o, n) {
  return n.parent ? n.parent.children : o.roots;
}
function isBlank(s) {
  return s === void 0 || s.trim() === "";
}
function moveSection(text, srcLine, targetLine, pos) {
  const o = parse(text);
  const src = findByLine(o, srcLine);
  const tgt = findByLine(o, targetLine);
  if (!src || !tgt) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
  if (tgt.line >= src.line && tgt.line < src.end) {
    throw new Error("Impossible de d\xE9placer une section dans elle-m\xEAme.");
  }
  const newLevel = pos === "inside" ? tgt.level + 1 : tgt.level;
  const delta = newLevel - src.level;
  const lines = o.lines;
  const block = lines.slice(src.line, src.end);
  if (delta !== 0) {
    for (const h of scanHeadings(block, false)) {
      const lvl = h.level + delta;
      if (lvl > 6) throw new Error("Trop profond : Markdown s'arr\xEAte au niveau 6.");
      if (lvl < 1) throw new Error("Impossible de remonter plus haut que le niveau 1.");
      block[h.line] = block[h.line].replace(/^#{1,6}/, "#".repeat(lvl));
    }
  }
  while (block.length > 1 && isBlank(block[block.length - 1])) block.pop();
  const rest = [...lines.slice(0, src.line), ...lines.slice(src.end)];
  const hadFinalNewline = text.endsWith("\n");
  if (hadFinalNewline && rest.length && rest[rest.length - 1] === "") rest.pop();
  while (rest.length && isBlank(rest[rest.length - 1])) rest.pop();
  let insertAt = pos === "before" ? tgt.line : tgt.end;
  if (insertAt >= src.end) insertAt -= src.end - src.line;
  insertAt = Math.min(insertAt, rest.length);
  const piece = [...block];
  if (insertAt > 0 && !isBlank(rest[insertAt - 1])) piece.unshift("");
  if (insertAt < rest.length && !isBlank(rest[insertAt])) piece.push("");
  const result = [...rest.slice(0, insertAt), ...piece, ...rest.slice(insertAt)];
  const cleaned = [];
  for (let i = 0; i < result.length; i++) {
    if (isBlank(result[i]) && isBlank(cleaned[cleaned.length - 1]) && cleaned.length > 0) {
      if (!insideFence(result, i)) continue;
    }
    cleaned.push(result[i]);
  }
  return cleaned.join("\n") + (hadFinalNewline ? "\n" : "");
}
function insideFence(lines, idx) {
  let fence = null;
  for (let i = 0; i < idx; i++) {
    const f = FENCE.exec(lines[i]);
    if (!f) continue;
    if (fence === null) fence = f[1];
    else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
  }
  return fence !== null;
}
function shiftSection(text, line, dir) {
  var _a;
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) return null;
  const sibs = siblingsOf(o, n);
  const i = sibs.indexOf(n);
  let target;
  let pos;
  switch (dir) {
    case "up":
      target = sibs[i - 1];
      pos = "before";
      break;
    case "down":
      target = sibs[i + 1];
      pos = "after";
      break;
    case "indent":
      target = sibs[i - 1];
      pos = "inside";
      break;
    case "outdent":
      target = (_a = n.parent) != null ? _a : void 0;
      pos = "after";
      break;
  }
  if (!target) return null;
  const out = moveSection(text, n.line, target.line, pos);
  return { text: out, newLine: locate(out, n, text) };
}
function locate(newText, n, oldText) {
  var _a;
  const oldLines = oldText.split("\n");
  const body = oldLines.slice(n.line + 1, Math.min(n.end, n.line + 4)).join("\n");
  const o = parse(newText);
  const cands = o.all.filter((c) => c.title === n.title);
  const best = (_a = cands.find((c) => o.lines.slice(c.line + 1, Math.min(c.end, c.line + 4)).join("\n") === body)) != null ? _a : cands[0];
  return best ? best.line : 0;
}
function renameSection(text, line, title) {
  var _a;
  const lines = text.split("\n");
  const m = HEADING.exec((_a = lines[line]) != null ? _a : "");
  if (!m) throw new Error("Ce n'est plus un titre.");
  lines[line] = `${m[1]} ${title.trim()}`;
  return lines.join("\n");
}
function addSection(text, ref, mode, title, body = "", callout) {
  var _a, _b;
  const o = parse(text);
  const lines = [...o.lines];
  const hadFinalNewline = text.endsWith("\n");
  if (hadFinalNewline && lines[lines.length - 1] === "") lines.pop();
  let level;
  let at;
  const node = ref === null ? void 0 : findByLine(o, ref);
  if (!node) {
    level = (_b = (_a = o.roots[0]) == null ? void 0 : _a.level) != null ? _b : 1;
    at = lines.length;
  } else {
    level = Math.min(6, mode === "child" ? node.level + 1 : node.level);
    at = Math.min(node.end, lines.length);
  }
  while (at === lines.length && at > 0 && isBlank(lines[at - 1])) {
    lines.pop();
    at--;
  }
  const piece = [];
  if (at > 0 && !isBlank(lines[at - 1])) piece.push("");
  const headLine = at + piece.length;
  piece.push(`${"#".repeat(level)} ${title.trim()}`);
  const bodyLines = body.trim() ? body.replace(/\s+$/, "").split("\n") : [];
  let cursorLine;
  if (callout) {
    piece.push(callout, ...bodyLines.length ? quoteLines(bodyLines) : ["> "]);
    cursorLine = at + piece.length - 1;
    if (at < lines.length && !isBlank(lines[at])) piece.push("");
  } else if (bodyLines.length) {
    piece.push("", ...bodyLines);
    cursorLine = at + piece.length - 1;
    if (at < lines.length && !isBlank(lines[at])) piece.push("");
  } else {
    piece.push("");
    cursorLine = at + piece.length - 1;
    if (at < lines.length && !isBlank(lines[at])) piece.push("");
  }
  lines.splice(at, 0, ...piece);
  return { text: lines.join("\n") + (hadFinalNewline ? "\n" : ""), newLine: headLine, cursorLine };
}
function quoteLines(lines) {
  return lines.map((l) => l.trim() === "" ? ">" : `> ${l}`);
}
function lineDepths(lines) {
  const heads = scanHeadings(lines, true);
  const min = heads.reduce((m, h) => Math.min(m, h.level), 7);
  const depth = new Array(lines.length).fill(0);
  const heading = new Array(lines.length).fill(0);
  let cur = 0;
  let hi = 0;
  for (let i = 0; i < lines.length; i++) {
    if (hi < heads.length && heads[hi].line === i) {
      const d = heads[hi].level - min;
      depth[i] = d;
      heading[i] = heads[hi].level;
      cur = d + 1;
      hi++;
    } else depth[i] = cur;
  }
  return { depth, heading };
}
function setLevel(text, line, target, withChildren = true) {
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) throw new Error("Ce n'est plus un titre.");
  const lines = [...o.lines];
  if (target === 0) {
    lines[n.line] = n.title;
    return { text: lines.join("\n"), line: n.line };
  }
  target = Math.max(1, Math.min(6, target));
  const delta = target - n.level;
  if (delta === 0) return { text, line: n.line };
  const end = withChildren ? n.end : n.line + 1;
  const block = lines.slice(n.line, end);
  for (const h of scanHeadings(block, false)) {
    const lvl = Math.max(1, Math.min(6, h.level + delta));
    block[h.line] = block[h.line].replace(/^#{1,6}/, "#".repeat(lvl));
  }
  lines.splice(n.line, end - n.line, ...block);
  return { text: lines.join("\n"), line: n.line };
}
function setLineHeading(text, line, level) {
  var _a, _b;
  const lines = text.split("\n");
  const raw = (_a = lines[line]) != null ? _a : "";
  const m = HEADING.exec(raw);
  const content = m ? ((_b = m[2]) != null ? _b : "").trim() : raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").trim();
  lines[line] = level === 0 ? content : `${"#".repeat(Math.min(6, level))} ${content}`;
  return lines.join("\n");
}
function ownRange(lines, n) {
  var _a, _b;
  const from = n.line + 1;
  const to = Math.min((_b = (_a = n.children[0]) == null ? void 0 : _a.line) != null ? _b : n.end, lines.length);
  let first = -1;
  let last = -1;
  for (let i = from; i < to; i++)
    if (!isBlank(lines[i])) {
      if (first < 0) first = i;
      last = i;
    }
  return { from, to, first, last };
}
function appendToSection(text, line, body, callout) {
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
  const hadFinalNewline = text.endsWith("\n");
  const lines = [...o.lines];
  if (hadFinalNewline && lines[lines.length - 1] === "") lines.pop();
  const r = ownRange(lines, n);
  const last = r.last < 0 ? n.line : r.last;
  const bodyLines = body.replace(/\s+$/, "").split("\n");
  const at = last + 1;
  let piece;
  if (callout) {
    const q = quoteLines(bodyLines);
    piece = r.last >= 0 && /^\s*>/.test(lines[r.last]) ? [">", ...q] : ["", callout, ...q];
    if (r.last < 0) piece.shift();
  } else piece = ["", ...bodyLines];
  const lastLine = at + piece.length - 1;
  if (at < lines.length && !isBlank(lines[at])) piece.push("");
  lines.splice(at, 0, ...piece);
  return { text: lines.join("\n") + (hadFinalNewline ? "\n" : ""), lastLine };
}
function applyLayout(text, line, callout) {
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) return null;
  const lines = [...o.lines];
  const r = ownRange(lines, n);
  if (r.first < 0) {
    const piece = [callout, "> "];
    if (n.line + 1 < lines.length && !isBlank(lines[n.line + 1])) piece.push("");
    lines.splice(n.line + 1, 0, ...piece);
    return lines.join("\n");
  }
  if (/^\s*>\s*\[!/.test(lines[r.first])) return null;
  const body = lines.slice(r.first, r.last + 1);
  lines.splice(r.first, body.length, callout, ...quoteLines(body));
  return lines.join("\n");
}
function applyAllLayouts(text, pick) {
  const nodes = [...parse(text).all].sort((a, b) => b.line - a.line);
  let count = 0;
  for (const n of nodes) {
    const c = pick(n.title);
    if (!c) continue;
    const out = applyLayout(text, n.line, c);
    if (out !== null) {
      text = out;
      count++;
    }
  }
  return { text, count };
}
function deleteSection(text, line, mode) {
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
  const hadFinalNewline = text.endsWith("\n");
  const lines = [...o.lines];
  if (hadFinalNewline && lines[lines.length - 1] === "") lines.pop();
  const end = mode === "all" ? Math.min(n.end, lines.length) : n.line + 1;
  const removed = lines.slice(n.line, end).join("\n").replace(/\s+$/, "");
  lines.splice(n.line, end - n.line);
  const at = n.line;
  while (at < lines.length && isBlank(lines[at]) && (at === 0 || isBlank(lines[at - 1]))) lines.splice(at, 1);
  while (lines.length && isBlank(lines[lines.length - 1])) lines.pop();
  return { text: lines.join("\n") + (hadFinalNewline ? "\n" : ""), removed, at };
}
function insertBlock(text, at, block) {
  const hadFinalNewline = text.endsWith("\n");
  const lines = text.split("\n");
  if (hadFinalNewline && lines[lines.length - 1] === "") lines.pop();
  at = Math.max(0, Math.min(at, lines.length));
  const heads = parse(lines.join("\n")).all.map((x) => x.line);
  if (at < lines.length && !heads.includes(at)) {
    const next = heads.find((h) => h >= at);
    at = next != null ? next : lines.length;
  }
  const piece = block.split("\n");
  if (at > 0 && !isBlank(lines[at - 1])) piece.unshift("");
  const line = at + (piece[0] === "" ? 1 : 0);
  if (at < lines.length && !isBlank(lines[at])) piece.push("");
  lines.splice(at, 0, ...piece);
  return { text: lines.join("\n") + (hadFinalNewline ? "\n" : ""), line };
}

// src/appearance.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var PRESET_CONTRASTE = [
  { size: 2, useColor: true, color: "#9c3d1c", bold: true, transform: "uppercase", deco: "band" },
  { size: 1.55, useColor: true, color: "#2c5f8d", bold: true, transform: "none", deco: "underline" },
  { size: 1.25, useColor: true, color: "#3f7a3a", bold: true, transform: "none", deco: "bar" },
  { size: 1.08, useColor: true, color: "#7a4f9c", bold: true, transform: "small-caps", deco: "none" },
  { size: 1, useColor: true, color: "#8a6a2a", bold: true, transform: "none", deco: "none" },
  { size: 1, useColor: false, color: "#666666", bold: false, transform: "none", deco: "none" }
];
var PRESET_SOBRE = [
  { size: 1.9, useColor: false, color: "#000000", bold: true, transform: "uppercase", deco: "underline" },
  { size: 1.45, useColor: false, color: "#000000", bold: true, transform: "none", deco: "none" },
  { size: 1.2, useColor: false, color: "#000000", bold: true, transform: "small-caps", deco: "none" },
  { size: 1.05, useColor: false, color: "#000000", bold: true, transform: "none", deco: "none" },
  { size: 1, useColor: false, color: "#000000", bold: false, transform: "none", deco: "none" },
  { size: 1, useColor: false, color: "#000000", bold: false, transform: "none", deco: "none" }
];
var APPEARANCE_DEFAULTS = {
  stylesOn: true,
  indentOn: true,
  indentPx: 22,
  levels: PRESET_CONTRASTE.map((l) => ({ ...l }))
};
function buildCss(s) {
  const out = [];
  const vars = [];
  s.levels.forEach((l, i) => {
    const n = i + 1;
    const c = l.useColor ? l.color : "var(--text-normal)";
    const accent = l.useColor ? l.color : "var(--text-accent)";
    vars.push(`--h${n}-size:${l.size}em;`, `--h${n}-color:${c};`, `--h${n}-weight:${l.bold ? 700 : 500};`);
    const sel = `body.pc-hs .markdown-rendered h${n}, body.pc-hs .cm-line.HyperMD-header-${n}`;
    const rules = [];
    if (l.transform === "uppercase") rules.push("text-transform:uppercase;letter-spacing:.04em;");
    if (l.transform === "small-caps") rules.push("font-variant:small-caps;letter-spacing:.02em;");
    if (l.deco === "underline") rules.push(`border-bottom:2px solid ${accent};padding-bottom:.12em;`);
    if (l.deco === "band")
      rules.push(
        `background:color-mix(in srgb, ${accent} 13%, transparent);border-radius:6px;padding:.12em .45em !important;`
      );
    if (l.deco === "bar") rules.push(`border-left:4px solid ${accent};padding-left:.5em !important;`);
    if (rules.length) out.push(`${sel}{${rules.join("")}}`);
    if (l.useColor) out.push(`.plan-carnet .pc-lvl-${n} > .pc-label{color:${l.color};}`);
  });
  out.unshift(`body.pc-hs.pc-hs{${vars.join("")}}`);
  out.push(
    `body.pc-hs .cm-header{color:inherit;}`,
    `body.pc-hs .cm-line[class*="HyperMD-header-"]{padding-top:.35em;}`
  );
  for (let d = 1; d <= 6; d++) {
    out.push(`body.pc-indent .markdown-source-view.mod-cm6 .cm-line.pc-ind-${d}{margin-inline-start:${d * s.indentPx}px;}`);
  }
  return out.join("\n");
}
var indentExtension = import_view.ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.depth = [];
      this.compute(view);
      this.decorations = this.build(view);
    }
    update(u) {
      if (u.docChanged) this.compute(u.view);
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
    }
    compute(view) {
      this.depth = lineDepths(view.state.doc.toString().split("\n")).depth;
    }
    build(view) {
      var _a;
      const b = new import_state.RangeSetBuilder();
      const doc = view.state.doc;
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = doc.lineAt(pos);
          const d = Math.min((_a = this.depth[line.number - 1]) != null ? _a : 0, 6);
          if (d > 0) b.add(line.from, line.from, import_view.Decoration.line({ class: `pc-ind-${d}` }));
          pos = line.to + 1;
        }
      }
      return b.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

// src/links.ts
var import_obsidian = require("obsidian");
function headingAnchor(h) {
  return h.replace(/[#|^:%[\]]/g, " ").replace(/\s+/g, " ").trim();
}
function linkTargets(app, sourcePath, headings) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const h of headings) {
    if (!h || seen.has(h)) continue;
    seen.add(h);
    const a = headingAnchor(h);
    out.push({ kind: "heading", label: h, detail: "section de cette note", link: `[[#${a}|${h.replace(/[|[\]]/g, " ")}]]` });
  }
  const files = app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime);
  for (const f of files) {
    if (f.path === sourcePath) continue;
    const lt = app.metadataCache.fileToLinktext(f, sourcePath, true);
    const folder = f.parent && f.parent.path !== "/" ? f.parent.path : "";
    out.push({ kind: "file", label: f.basename, detail: folder, link: `[[${lt}]]` });
  }
  return out;
}
function renderTarget(t, el) {
  el.addClass("pc-link-item");
  const ic = el.createSpan("pc-link-icon");
  (0, import_obsidian.setIcon)(ic, t.kind === "heading" ? "hash" : "file-text");
  el.createSpan({ cls: "pc-link-label", text: t.label });
  if (t.detail) el.createSpan({ cls: "pc-link-detail", text: t.detail });
}
var LinkPicker = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, targets, onPick) {
    super(app);
    this.targets = targets;
    this.onPick = onPick;
    this.setPlaceholder("Lien vers\u2026 (tape quelques lettres d'une section ou d'une note)");
    this.limit = 60;
  }
  getItems() {
    return this.targets;
  }
  getItemText(t) {
    return `${t.label} ${t.detail}`;
  }
  renderSuggestion(m, el) {
    renderTarget(m.item, el);
  }
  onChooseItem(t) {
    this.onPick(t);
  }
};
function looksLikeUrl(s) {
  return /^(https?:\/\/|www\.)\S+$/i.test(s.trim());
}
function safeUrl(u) {
  u = u.trim();
  if (/^www\./i.test(u)) u = "https://" + u;
  return u.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}
function webLink(url, label) {
  const u = safeUrl(url);
  const l = label.trim().replace(/[[\]]/g, "");
  return l ? `[${l}](${u})` : `<${u}>`;
}
var WebLinkModal = class extends import_obsidian.Modal {
  constructor(app, initialText, onDone) {
    super(app);
    this.initialText = initialText;
    this.onDone = onDone;
  }
  async onOpen() {
    this.titleEl.setText("Lien web");
    let url = "";
    try {
      const clip = await navigator.clipboard.readText();
      if (looksLikeUrl(clip)) url = clip.trim();
    } catch (e) {
    }
    let label = this.initialText;
    const submit = () => {
      if (!url.trim()) return;
      this.close();
      this.onDone(webLink(url, label));
    };
    let urlEl;
    new import_obsidian.Setting(this.contentEl).setName("Adresse").addText((t) => {
      t.setPlaceholder("https://\u2026").setValue(url).onChange((v) => url = v);
      t.inputEl.style.width = "100%";
      urlEl = t.inputEl;
    });
    new import_obsidian.Setting(this.contentEl).setName("Texte affich\xE9").setDesc("Facultatif. Vide : l'adresse s'affiche telle quelle.").addText((t) => {
      t.setValue(label).onChange((v) => label = v);
      t.inputEl.style.width = "100%";
      t.inputEl.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), submit()));
    });
    urlEl.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), submit()));
    new import_obsidian.Setting(this.contentEl).addButton((b) => b.setButtonText("Ins\xE9rer").setCta().onClick(submit));
    window.setTimeout(() => urlEl.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
function insertInArea(area, s, from = area.selectionStart, to = area.selectionEnd) {
  area.focus();
  area.setRangeText(s, from, to, "end");
  area.dispatchEvent(new Event("input"));
}
function attachLinkTools(area, ctx) {
  var _a;
  const bar = createDiv("pc-link-bar");
  (_a = area.parentElement) == null ? void 0 : _a.insertBefore(bar, area);
  const pickNote = (replaceFrom) => {
    const from = replaceFrom != null ? replaceFrom : area.selectionStart;
    const to = area.selectionEnd;
    new LinkPicker(
      ctx.app,
      linkTargets(ctx.app, ctx.sourcePath, ctx.headings),
      (t) => insertInArea(area, t.link, from, to)
    ).open();
  };
  const pickWeb = () => {
    const from = area.selectionStart;
    const to = area.selectionEnd;
    const sel = area.value.slice(from, to);
    new WebLinkModal(ctx.app, sel, (md) => insertInArea(area, md, from, to)).open();
  };
  const btn = (icon, text, tip, fn) => {
    const b = bar.createEl("button", { cls: "pc-link-btn", attr: { "aria-label": tip, type: "button" } });
    (0, import_obsidian.setIcon)(b.createSpan(), icon);
    b.createSpan({ text });
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", fn);
  };
  btn("link-2", "Note ou section", `Lien interne (ou tape ${ctx.trigger})`, () => pickNote());
  btn("globe", "Lien web", "Lien externe (Cmd+K)", pickWeb);
  bar.createSpan({ cls: "pc-link-tip", text: `Astuce : tape ${ctx.trigger} pour un lien interne` });
  area.addEventListener("input", () => {
    const t = ctx.trigger;
    if (!t) return;
    const pos = area.selectionStart;
    if (pos >= t.length && area.value.slice(pos - t.length, pos) === t) {
      area.setRangeText("", pos - t.length, pos, "end");
      pickNote(pos - t.length);
    }
  });
  area.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      pickWeb();
    }
  });
  area.addEventListener("paste", (e) => {
    var _a2, _b;
    const clip = (_b = (_a2 = e.clipboardData) == null ? void 0 : _a2.getData("text/plain")) != null ? _b : "";
    const from = area.selectionStart;
    const to = area.selectionEnd;
    if (to > from && looksLikeUrl(clip)) {
      e.preventDefault();
      insertInArea(area, webLink(clip, area.value.slice(from, to)), from, to);
    }
  });
}
var LinkSuggest = class extends import_obsidian.EditorSuggest {
  constructor(app, trigger, enabled) {
    super(app);
    this.trigger = trigger;
    this.enabled = enabled;
    this.limit = 50;
    this.setInstructions([
      { command: "\u2191\u2193", purpose: "choisir" },
      { command: "\u21B5", purpose: "ins\xE9rer le lien" },
      { command: "\xE9chap", purpose: "fermer" }
    ]);
  }
  onTrigger(cursor, editor, _file) {
    const t = this.trigger();
    if (!this.enabled() || !t) return null;
    const before = editor.getLine(cursor.line).slice(0, cursor.ch);
    const i = before.lastIndexOf(t);
    if (i < 0) return null;
    const q = before.slice(i + t.length);
    if (q.length > 60 || /[[\]]/.test(q)) return null;
    return { start: { line: cursor.line, ch: i }, end: cursor, query: q };
  }
  getSuggestions(ctx) {
    var _a, _b;
    const headings = parse(ctx.editor.getValue()).all.map((n) => n.title);
    const all = linkTargets(this.app, (_b = (_a = ctx.file) == null ? void 0 : _a.path) != null ? _b : "", headings);
    if (!ctx.query.trim()) return all.slice(0, this.limit);
    const f = (0, import_obsidian.prepareFuzzySearch)(ctx.query.trim());
    return all.map((t) => ({ t, r: f(t.label) })).filter((x) => x.r).sort((a, b) => b.r.score - a.r.score).slice(0, this.limit).map((x) => x.t);
  }
  renderSuggestion(t, el) {
    renderTarget(t, el);
  }
  selectSuggestion(t) {
    const c = this.context;
    if (!c) return;
    c.editor.replaceRange(t.link, c.start, c.end);
    c.editor.setCursor({ line: c.start.line, ch: c.start.ch + t.link.length });
  }
};
function insertNoteLink(app, editor, sourcePath) {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const headings = parse(editor.getValue()).all.map((n) => n.title);
  new LinkPicker(app, linkTargets(app, sourcePath, headings), (t) => {
    editor.replaceRange(t.link, from, to);
    editor.setCursor({ line: from.line, ch: from.ch + t.link.length });
    editor.focus();
  }).open();
}
function insertWebLink(app, editor) {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  new WebLinkModal(app, editor.getSelection(), (md) => {
    editor.replaceRange(md, from, to);
    editor.setCursor({ line: from.line, ch: from.ch + md.length });
    editor.focus();
  }).open();
}

// src/layouts.ts
var CALLOUT_TYPES = {
  note: "Note (bleu)",
  info: "Info (bleu)",
  abstract: "R\xE9sum\xE9 (turquoise)",
  tip: "Astuce (vert d'eau)",
  success: "R\xE9ussite (vert)",
  question: "Question (jaune)",
  todo: "\xC0 faire (bleu)",
  example: "Exemple (violet)",
  quote: "Citation (gris)",
  warning: "Attention (orange)",
  failure: "\xC9chec (rouge)",
  danger: "Danger (rouge)",
  bug: "Bug (rouge)"
};
var FOLDS = {
  "": "Toujours ouvert",
  "+": "Repliable, ouvert",
  "-": "Repli\xE9"
};
var DEFAULT_RULES = [
  { titles: "Notes, Note", type: "note", label: "", fold: "" },
  { titles: "Voir aussi", type: "info", label: "", fold: "" }
];
function norm(s) {
  return s.normalize("NFC").toLowerCase().replace(/[\s:.]+$/g, "").replace(/\s+/g, " ").trim();
}
function ruleFor(rules, title) {
  var _a;
  const t = norm(title);
  if (!t) return null;
  return (_a = rules.find((r) => r.titles.split(",").some((x) => norm(x) === t))) != null ? _a : null;
}
function calloutHeader(r) {
  return `> [!${r.type}]${r.fold}${r.label.trim() ? " " + r.label.trim() : ""}`;
}
function parseCalloutHeader(h) {
  const m = /^\s*>\s*\[!([^\]]+)\]([+-]?)[ \t]*(.*?)\s*$/.exec(h || "");
  return m ? { type: m[1].trim(), fold: m[2], label: m[3] } : null;
}
function describeRule(r) {
  var _a;
  const name = ((_a = CALLOUT_TYPES[r.type]) != null ? _a : r.type).replace(/\s*\(.*\)$/, "");
  return `encadr\xE9 \xAB ${r.label.trim() || name} \xBB`;
}

// src/main.ts
var VIEW_TYPE = "plan-carnet-view";
var TitleModal = class extends import_obsidian2.Modal {
  constructor(app, heading, initial, onDone) {
    super(app);
    this.heading = heading;
    this.onDone = onDone;
    this.value = initial;
  }
  onOpen() {
    this.titleEl.setText(this.heading);
    const submit = () => {
      const v = this.value.trim();
      if (!v) return;
      this.close();
      this.onDone(v);
    };
    new import_obsidian2.Setting(this.contentEl).setName("Titre").addText((t) => {
      t.setValue(this.value).onChange((v) => this.value = v);
      t.inputEl.style.width = "100%";
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      window.setTimeout(() => {
        t.inputEl.focus();
        t.inputEl.select();
      }, 0);
    });
    new import_obsidian2.Setting(this.contentEl).addButton((b) => b.setButtonText("Valider").setCta().onClick(submit));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SectionModal = class extends import_obsidian2.Modal {
  constructor(app, heading, onDone, linkCtx, hintFor) {
    super(app);
    this.heading = heading;
    this.onDone = onDone;
    this.linkCtx = linkCtx;
    this.hintFor = hintFor;
    this.title = "";
    this.body = "";
  }
  onOpen() {
    this.titleEl.setText(this.heading);
    this.modalEl.addClass("pc-section-modal");
    const submit = () => {
      if (!this.title.trim()) {
        titleInput.focus();
        return;
      }
      this.close();
      this.onDone(this.title, this.body);
    };
    const c = this.contentEl;
    const titleInput = c.createEl("input", { type: "text", cls: "pc-modal-title", attr: { placeholder: "Titre" } });
    const hint = c.createDiv("pc-modal-layout");
    titleInput.addEventListener("input", () => {
      this.title = titleInput.value;
      const h = this.hintFor(this.title);
      hint.setText(h ? `Mise en page automatique : ${h}` : "");
    });
    const area = c.createEl("textarea", {
      cls: "pc-modal-body",
      attr: { placeholder: "Texte (facultatif). Tu pourras aussi \xE9crire directement dans la note.", rows: "8" }
    });
    area.addEventListener("input", () => this.body = area.value);
    attachLinkTools(area, this.linkCtx);
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) submit();
        else area.focus();
      }
    });
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    });
    const foot = c.createDiv("pc-modal-foot");
    foot.createSpan({ cls: "pc-modal-hint", text: "Entr\xE9e : passer au texte \xB7 Cmd+Entr\xE9e : cr\xE9er" });
    const btn = foot.createEl("button", { text: "Cr\xE9er", cls: "mod-cta" });
    btn.addEventListener("click", submit);
    window.setTimeout(() => titleInput.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var lastStamp = false;
var NoteModal = class extends import_obsidian2.Modal {
  constructor(app, sectionTitle, onDone, linkCtx, layoutHint) {
    super(app);
    this.sectionTitle = sectionTitle;
    this.onDone = onDone;
    this.linkCtx = linkCtx;
    this.layoutHint = layoutHint;
    this.body = "";
    this.stamp = lastStamp;
  }
  onOpen() {
    this.titleEl.setText(`Ajouter \xE0 \xAB ${this.sectionTitle} \xBB`);
    this.modalEl.addClass("pc-section-modal");
    const c = this.contentEl;
    if (this.layoutHint) c.createDiv({ cls: "pc-modal-layout", text: `Ira dans l'${this.layoutHint}` });
    const area = c.createEl("textarea", {
      cls: "pc-modal-body",
      attr: { placeholder: "Une id\xE9e, un concept, une r\xE9f\xE9rence\u2026", rows: "8" }
    });
    area.addEventListener("input", () => this.body = area.value);
    attachLinkTools(area, this.linkCtx);
    const submit = () => {
      if (!this.body.trim()) {
        area.focus();
        return;
      }
      lastStamp = this.stamp;
      let b = this.body;
      if (this.stamp) {
        const d = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
        b = `*${d}* : ${b}`;
      }
      this.close();
      this.onDone(b);
    };
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    });
    const foot = c.createDiv("pc-modal-foot");
    const left = foot.createDiv("pc-modal-left");
    const lab = left.createEl("label", { cls: "pc-modal-stamp" });
    const cb = lab.createEl("input", { type: "checkbox" });
    cb.checked = this.stamp;
    cb.addEventListener("change", () => this.stamp = cb.checked);
    lab.appendText(" Dater la note");
    left.createSpan({ cls: "pc-modal-hint", text: "Cmd+Entr\xE9e : ajouter" });
    const btn = foot.createEl("button", { text: "Ajouter", cls: "mod-cta" });
    btn.addEventListener("click", submit);
    window.setTimeout(() => area.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DeleteModal = class extends import_obsidian2.Modal {
  constructor(app, n, hasOwnText, onDone) {
    super(app);
    this.n = n;
    this.hasOwnText = hasOwnText;
    this.onDone = onDone;
  }
  onOpen() {
    const n = this.n;
    this.titleEl.setText(`Supprimer \xAB ${n.title} \xBB ?`);
    this.modalEl.addClass("pc-delete-modal");
    const c = this.contentEl;
    let count = 0;
    const walk = (x) => x.children.forEach((k) => (count++, walk(k)));
    walk(n);
    const words = n.totalWords;
    const what = [];
    if (words) what.push(`${words.toLocaleString("fr-FR")} mot${words > 1 ? "s" : ""}`);
    if (count) what.push(`${count} sous-section${count > 1 ? "s" : ""}`);
    c.createEl("p", { text: what.length ? `Cette section contient ${what.join(" et ")}.` : "Cette section est vide." });
    let mode = "all";
    if (this.hasOwnText || count) {
      const opts = c.createDiv("pc-delete-opts");
      const radio = (value, label, desc) => {
        const l = opts.createEl("label", { cls: "pc-delete-opt" });
        const r = l.createEl("input", { type: "radio", attr: { name: "pc-del" } });
        r.checked = value === mode;
        r.addEventListener("change", () => mode = value);
        const t = l.createDiv();
        t.createDiv({ cls: "pc-delete-opt-title", text: label });
        t.createDiv({ cls: "pc-delete-opt-desc", text: desc });
      };
      radio("all", "Toute la section", "Le titre, son texte et ses sous-sections.");
      radio(
        "heading",
        "Le titre seulement",
        "Le texte et les sous-sections restent, rattach\xE9s \xE0 la section du dessus."
      );
    }
    c.createEl("p", {
      cls: "pc-delete-safe",
      text: "Filet de s\xE9curit\xE9 : Cmd+Z annule, et la commande \xAB Restaurer une section supprim\xE9e \xBB la remet en place."
    });
    const foot = c.createDiv("pc-modal-foot");
    foot.createSpan();
    const btns = foot.createDiv("pc-delete-btns");
    const cancel = btns.createEl("button", { text: "Annuler" });
    cancel.addEventListener("click", () => this.close());
    const ok = btns.createEl("button", { text: "Supprimer", cls: "mod-warning" });
    ok.addEventListener("click", () => {
      this.close();
      this.onDone(mode);
    });
    window.setTimeout(() => cancel.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TrashPicker = class extends import_obsidian2.FuzzySuggestModal {
  constructor(app, items, onPick) {
    super(app);
    this.items = items;
    this.onPick = onPick;
    this.setPlaceholder("Quelle section restaurer ?");
  }
  getItems() {
    return [...this.items].reverse();
  }
  getItemText(t) {
    var _a;
    const d = new Date(t.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const f = (_a = t.path.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/, "");
    return `${t.title}  \xB7  ${f}  \xB7  ${d}`;
  }
  onChooseItem(t) {
    this.onPick(t);
  }
};
var SectionPicker = class extends import_obsidian2.FuzzySuggestModal {
  constructor(app, nodes, onPick) {
    super(app);
    this.nodes = nodes;
    this.onPick = onPick;
    this.setPlaceholder("Dans quelle section noter l'id\xE9e ?");
  }
  getItems() {
    return this.nodes;
  }
  getItemText(n) {
    const path = [];
    for (let c = n; c; c = c.parent) path.unshift(c.title);
    return path.join(" \u203A ");
  }
  onChooseItem(n) {
    this.onPick(n);
  }
};
function editorFor(app, file) {
  var _a;
  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const v = leaf.view;
    if (v instanceof import_obsidian2.MarkdownView && ((_a = v.file) == null ? void 0 : _a.path) === file.path) return v.editor;
  }
  return null;
}
async function readText(app, file) {
  const ed = editorFor(app, file);
  if (ed) {
    const v = ed.getValue();
    if (v.length || file.stat.size === 0) return v;
  }
  return app.vault.read(file);
}
async function writeText(app, file, oldText, newText) {
  if (oldText === newText) return;
  const ed = editorFor(app, file);
  if (!ed) {
    await app.vault.modify(file, newText);
    return;
  }
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let q = 0;
  while (q < max - p && oldText[oldText.length - 1 - q] === newText[newText.length - 1 - q]) q++;
  ed.replaceRange(
    newText.slice(p, newText.length - q),
    ed.offsetToPos(p),
    ed.offsetToPos(oldText.length - q)
  );
}
var PlanView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.pinned = false;
    this.lastText = null;
    this.outline = null;
    this.collapsed = /* @__PURE__ */ new Map();
    // chemin du fichier -> clés repliées
    this.dragLine = null;
    this.activeLine = null;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Plan carnet";
  }
  getIcon() {
    return "list-tree";
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("plan-carnet");
    this.headerEl = root.createDiv("pc-header");
    this.treeEl = root.createDiv("pc-tree");
    this.treeEl.addEventListener("dragover", (e) => {
      if (e.target === this.treeEl && this.dragLine !== null) e.preventDefault();
    });
    this.treeEl.addEventListener("drop", (e) => {
      if (e.target !== this.treeEl || this.dragLine === null || !this.outline) return;
      e.preventDefault();
      const last = this.outline.roots[this.outline.roots.length - 1];
      if (last) this.move(this.dragLine, last.line, "after");
    });
    const f = this.app.workspace.getActiveFile();
    if (f && f.extension === "md") await this.setFile(f);
    else this.draw();
  }
  async setFile(file) {
    this.file = file;
    await this.refresh();
  }
  async refresh(text) {
    if (!this.file) {
      this.outline = null;
      this.lastText = null;
      this.draw();
      return;
    }
    const t = text != null ? text : await readText(this.app, this.file);
    this.lastText = t;
    this.outline = parse(t);
    this.draw();
  }
  setActiveLine(line) {
    var _a, _b, _c;
    if (line === this.activeLine) return;
    this.activeLine = line;
    (_a = this.treeEl) == null ? void 0 : _a.querySelectorAll(".pc-row.is-active").forEach((el) => el.removeClass("is-active"));
    if (line !== null) (_c = (_b = this.treeEl) == null ? void 0 : _b.querySelector(`.pc-row[data-line="${line}"]`)) == null ? void 0 : _c.addClass("is-active");
  }
  keyOf(n) {
    const parts = [];
    for (let c = n; c; c = c.parent) parts.unshift(c.title);
    return parts.join("\0");
  }
  collapsedSet() {
    var _a, _b;
    const k = (_b = (_a = this.file) == null ? void 0 : _a.path) != null ? _b : "";
    if (!this.collapsed.has(k)) this.collapsed.set(k, /* @__PURE__ */ new Set());
    return this.collapsed.get(k);
  }
  draw() {
    if (!this.treeEl) return;
    this.headerEl.empty();
    this.treeEl.empty();
    if (!this.file || !this.outline) {
      this.headerEl.createDiv({ cls: "pc-title", text: "Aucune note ouverte" });
      this.treeEl.createDiv({ cls: "pc-empty", text: "Ouvre une note Markdown : ses titres appara\xEEtront ici." });
      return;
    }
    const titleRow = this.headerEl.createDiv("pc-title-row");
    titleRow.createDiv({ cls: "pc-title", text: this.file.basename });
    const total = this.outline.roots.reduce((a, n) => a + n.totalWords, 0);
    titleRow.createDiv({ cls: "pc-count", text: `${total.toLocaleString("fr-FR")} mots` });
    const tools = this.headerEl.createDiv("pc-tools");
    const pin = this.toolButton(
      tools,
      this.pinned ? "pin" : "pin-off",
      this.pinned ? "Plan \xE9pingl\xE9 sur cette note (cliquer pour suivre la note ouverte)" : "\xC9pingler le plan sur cette note",
      () => {
        this.pinned = !this.pinned;
        if (!this.pinned) this.plugin.syncToActive();
        this.draw();
      }
    );
    if (this.pinned) pin.addClass("is-active");
    this.toolButton(tools, "chevrons-down-up", "Tout replier", () => {
      const s = this.collapsedSet();
      this.outline.all.filter((n) => n.children.length).forEach((n) => s.add(this.keyOf(n)));
      this.draw();
    });
    this.toolButton(tools, "chevrons-up-down", "Tout d\xE9plier", () => {
      this.collapsedSet().clear();
      this.draw();
    });
    this.toolButton(
      tools,
      "plus",
      "Nouvelle section principale",
      () => this.askSection("Nouvelle section principale", (t, b) => this.add(null, "sibling", t, b))
    );
    if (!this.outline.roots.length) {
      this.treeEl.createDiv({
        cls: "pc-empty",
        text: "Pas encore de titres. Clique sur + ou \xE9cris \xAB # Mon carnet \xBB dans la note."
      });
      return;
    }
    for (const n of this.outline.roots) this.drawNode(this.treeEl, n, 0);
  }
  toolButton(parent, icon, label, onClick) {
    const b = parent.createDiv({ cls: "clickable-icon pc-tool", attr: { "aria-label": label } });
    (0, import_obsidian2.setIcon)(b, icon);
    b.addEventListener("click", onClick);
    return b;
  }
  drawNode(parent, n, depth) {
    const wrap = parent.createDiv("pc-node");
    const row = wrap.createDiv({ cls: "pc-row", attr: { "data-line": String(n.line), draggable: "true" } });
    row.style.paddingLeft = `${4 + depth * 16}px`;
    row.addClass(`pc-depth-${Math.min(depth, 5)}`, `pc-lvl-${n.level}`);
    if (n.line === this.activeLine) row.addClass("is-active");
    if (this.plugin.isAnnex(n.title)) row.addClass("pc-annex");
    const key = this.keyOf(n);
    const isCollapsed = this.collapsedSet().has(key);
    const toggle = row.createDiv("pc-toggle");
    if (n.children.length) {
      (0, import_obsidian2.setIcon)(toggle, isCollapsed ? "chevron-right" : "chevron-down");
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const s = this.collapsedSet();
        s.has(key) ? s.delete(key) : s.add(key);
        this.draw();
      });
    }
    if (!this.plugin.isAnnex(n.title)) {
      const sti = this.plugin.statusInfo(statusIdOf(this.outline.lines, n));
      const dot = row.createDiv({ cls: "pc-status" + (sti ? "" : " is-none"), attr: { "aria-label": sti ? `Statut : ${sti.label}` : "Donner un statut" } });
      if (sti) dot.style.background = sti.color;
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        this.plugin.statusMenu(e, this.file, n);
      });
      dot.addEventListener("dblclick", (e) => e.stopPropagation());
    }
    row.createDiv({ cls: "pc-label", text: n.title || "(sans titre)" });
    const meta = row.createDiv("pc-meta");
    if (n.children.length && isCollapsed) meta.createSpan({ cls: "pc-badge", text: String(n.children.length) });
    meta.createSpan({ cls: "pc-words", text: n.totalWords ? String(n.totalWords) : "" });
    const actions = row.createDiv("pc-actions");
    this.miniButton(actions, "message-square-plus", "Ajouter du texte", () => this.askNote(n));
    this.miniButton(actions, "arrow-up", "Monter", () => this.shift(n.line, "up"));
    this.miniButton(actions, "arrow-down", "Descendre", () => this.shift(n.line, "down"));
    this.miniButton(
      actions,
      "arrow-left",
      "Niveau sup\xE9rieur (titre plus grand)",
      () => this.level(n.line, n.level - 1)
    );
    this.miniButton(
      actions,
      "arrow-right",
      "Niveau inf\xE9rieur (titre plus petit)",
      () => this.level(n.line, n.level + 1)
    );
    this.miniButton(actions, "more-horizontal", "Plus", (e) => this.contextMenu(e, n));
    row.addEventListener("click", () => this.reveal(n.line));
    row.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.askTitle("Renommer", n.title, (t) => this.rename(n.line, t));
    });
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.contextMenu(e, n);
    });
    row.addEventListener("dragstart", (e) => {
      var _a;
      this.dragLine = n.line;
      (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/plain", n.title);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      window.setTimeout(() => wrap.addClass("is-dragging"), 0);
    });
    row.addEventListener("dragend", () => {
      this.dragLine = null;
      this.clearDropMarks();
      wrap.removeClass("is-dragging");
    });
    row.addEventListener("dragover", (e) => {
      if (this.dragLine === null) return;
      e.preventDefault();
      const pos = this.zone(e, row);
      this.clearDropMarks();
      row.addClass(`drop-${pos}`);
    });
    row.addEventListener("dragleave", () => row.removeClass("drop-before", "drop-after", "drop-inside"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const src = this.dragLine;
      this.clearDropMarks();
      if (src === null || src === n.line) return;
      const pos = this.zone(e, row);
      if (pos === "inside") this.collapsedSet().delete(key);
      this.move(src, n.line, pos);
    });
    if (n.children.length && !isCollapsed) {
      const kids = wrap.createDiv("pc-children");
      for (const c of n.children) this.drawNode(kids, c, depth + 1);
    }
  }
  miniButton(parent, icon, label, onClick) {
    const b = parent.createDiv({ cls: "clickable-icon pc-mini", attr: { "aria-label": label } });
    (0, import_obsidian2.setIcon)(b, icon);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(e);
    });
    b.addEventListener("dblclick", (e) => e.stopPropagation());
  }
  zone(e, row) {
    const r = row.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    return y < 0.28 ? "before" : y > 0.72 ? "after" : "inside";
  }
  clearDropMarks() {
    this.treeEl.querySelectorAll(".drop-before, .drop-after, .drop-inside").forEach((el) => el.removeClass("drop-before", "drop-after", "drop-inside"));
  }
  contextMenu(e, n) {
    const m = new import_obsidian2.Menu();
    m.addItem(
      (i) => i.setTitle("Ajouter du texte (une id\xE9e, une note)").setIcon("message-square-plus").onClick(() => this.askNote(n))
    );
    m.addItem(
      (i) => i.setTitle("Ajouter une sous-section").setIcon("corner-down-right").onClick(
        () => this.askSection(`Nouvelle sous-section dans \xAB ${n.title} \xBB`, (t, b) => this.add(n.line, "child", t, b))
      )
    );
    m.addItem(
      (i) => i.setTitle("Ajouter une section apr\xE8s").setIcon("plus").onClick(
        () => this.askSection(`Nouvelle section apr\xE8s \xAB ${n.title} \xBB`, (t, b) => this.add(n.line, "sibling", t, b))
      )
    );
    if (!this.plugin.isAnnex(n.title))
      m.addItem((i) => i.setTitle("Statut\u2026").setIcon("circle-dot").onClick(() => this.plugin.statusMenu(e, this.file, n)));
    m.addItem(
      (i) => i.setTitle("Renommer").setIcon("pencil").onClick(
        () => this.askTitle("Renommer", n.title, (t) => this.rename(n.line, t))
      )
    );
    m.addSeparator();
    m.addItem((i) => i.setTitle("Monter").setIcon("arrow-up").onClick(() => this.shift(n.line, "up")));
    m.addItem((i) => i.setTitle("Descendre").setIcon("arrow-down").onClick(() => this.shift(n.line, "down")));
    m.addItem(
      (i) => i.setTitle(`Changer de niveau (actuel : ${n.level})\u2026`).setIcon("heading").onClick(() => this.levelMenu(e, n))
    );
    m.addItem(
      (i) => i.setTitle("Sortir de la section parente").setIcon("corner-left-up").onClick(() => this.shift(n.line, "outdent"))
    );
    m.addItem(
      (i) => i.setTitle("Ranger dans la section au-dessus").setIcon("corner-right-down").onClick(() => this.shift(n.line, "indent"))
    );
    m.addSeparator();
    m.addItem(
      (i) => i.setTitle("Copier la section").setIcon("copy").onClick(async () => {
        const lines = (await readText(this.app, this.file)).split("\n");
        await navigator.clipboard.writeText(lines.slice(n.line, n.end).join("\n").trimEnd() + "\n");
        new import_obsidian2.Notice("Section copi\xE9e");
      })
    );
    const rl = ruleFor(this.plugin.settings.layoutRules, n.title);
    if (rl) {
      m.addItem(
        (i) => i.setTitle(`Mettre le texte dans l'${describeRule(rl)}`).setIcon("layout-template").onClick(() => this.applyRule(n, rl))
      );
    }
    m.addSeparator();
    m.addItem((i) => {
      var _a;
      i.setTitle("Supprimer\u2026").setIcon("trash-2").onClick(() => this.askDelete(n));
      (_a = i.setWarning) == null ? void 0 : _a.call(i, true);
    });
    m.showAtMouseEvent(e);
  }
  linkCtx() {
    var _a, _b, _c, _d;
    return {
      app: this.app,
      sourcePath: (_b = (_a = this.file) == null ? void 0 : _a.path) != null ? _b : "",
      headings: (_d = (_c = this.outline) == null ? void 0 : _c.all.map((x) => x.title)) != null ? _d : [],
      trigger: this.plugin.settings.linkTrigger
    };
  }
  rule(title) {
    const st = this.plugin.settings;
    return st.layoutAuto ? ruleFor(st.layoutRules, title) : null;
  }
  askNote(n) {
    const r = this.rule(n.title);
    new NoteModal(
      this.app,
      n.title,
      (b) => this.appendNote(n.line, n.title, b),
      this.linkCtx(),
      r ? describeRule(r) : null
    ).open();
  }
  applyRule(n, r) {
    this.edit((t) => {
      const out = applyLayout(t, n.line, calloutHeader(r));
      if (out === null) {
        new import_obsidian2.Notice("D\xE9j\xE0 mis en page.");
        return null;
      }
      return { text: out, line: n.line };
    });
  }
  askDelete(n) {
    var _a, _b, _c;
    const lines = ((_a = this.lastText) != null ? _a : "").split("\n");
    const ownEnd = (_c = (_b = n.children[0]) == null ? void 0 : _b.line) != null ? _c : n.end;
    const hasOwnText = lines.slice(n.line + 1, ownEnd).some((l) => l.trim() !== "");
    new DeleteModal(this.app, n, hasOwnText, (mode) => this.remove(n, mode)).open();
  }
  async remove(n, mode) {
    if (!this.file) return;
    const path = this.file.path;
    let removed = "";
    let at = 0;
    await this.edit((t) => {
      const r = deleteSection(t, n.line, mode);
      removed = r.removed;
      at = r.at;
      return { text: r.text };
    });
    if (removed) {
      await this.plugin.toTrash({ path, title: n.title, text: removed, line: at, date: Date.now() }, mode === "all");
    }
    new import_obsidian2.Notice(`\xAB ${n.title} \xBB supprim\xE9e. Cmd+Z pour annuler.`, 6e3);
  }
  pickAndNote() {
    if (!this.outline || !this.outline.all.length) {
      new import_obsidian2.Notice("Aucune section dans la note affich\xE9e par le plan.");
      return;
    }
    new SectionPicker(this.app, this.outline.all, (n) => this.askNote(n)).open();
  }
  async appendNote(line, title, body) {
    const r0 = this.rule(title);
    await this.edit((t) => {
      const r = appendToSection(t, line, body, r0 ? calloutHeader(r0) : void 0);
      return { text: r.text, line };
    });
    new import_obsidian2.Notice(`Ajout\xE9 \xE0 \xAB ${title} \xBB`);
  }
  levelMenu(e, n) {
    const m = new import_obsidian2.Menu();
    const kids = n.children.length > 0;
    for (let l = 1; l <= 6; l++) {
      m.addItem(
        (i) => i.setTitle(`Niveau ${l}  ${"#".repeat(l)}`).setChecked(l === n.level).onClick(() => this.level(n.line, l))
      );
    }
    if (kids) {
      m.addSeparator();
      m.addItem(
        (i) => i.setTitle("Ce titre seul, sans ses sous-titres\u2026").setIcon("minus").onClick(() => {
          const m2 = new import_obsidian2.Menu();
          for (let l = 1; l <= 6; l++)
            m2.addItem(
              (j) => j.setTitle(`Niveau ${l}  ${"#".repeat(l)}`).setChecked(l === n.level).onClick(() => this.level(n.line, l, false))
            );
          m2.showAtMouseEvent(e);
        })
      );
    }
    m.addSeparator();
    m.addItem(
      (i) => i.setTitle("Texte simple (n'est plus un titre)").setIcon("pilcrow").onClick(() => this.level(n.line, 0))
    );
    m.showAtMouseEvent(e);
  }
  level(line, target, withChildren = true) {
    var _a;
    if (target > 6) {
      new import_obsidian2.Notice("Niveau 6 atteint. Pour aller plus bas, choisis \xAB Texte simple \xBB dans le menu.");
      return;
    }
    if (target < 1 && target !== 0) {
      new import_obsidian2.Notice("C'est d\xE9j\xE0 le niveau 1, le plus haut.");
      return;
    }
    const n = (_a = this.outline) == null ? void 0 : _a.all.find((x) => x.line === line);
    if (n && withChildren && target > 0) {
      let deepest = n.level;
      const walk = (x) => x.children.forEach((c) => (deepest = Math.max(deepest, c.level), walk(c)));
      walk(n);
      const over = deepest + (target - n.level);
      if (over > 6)
        new import_obsidian2.Notice(
          "Certains sous-titres auraient d\xE9pass\xE9 le niveau 6 : ils restent au niveau 6. Cmd+Z pour annuler, ou utilise \xAB Ce titre seul \xBB dans le menu.",
          7e3
        );
    }
    this.edit((t) => {
      const r = setLevel(t, line, target, withChildren);
      return { text: r.text, line: target === 0 ? void 0 : r.line };
    });
  }
  askSection(heading, cb) {
    new SectionModal(this.app, heading, cb, this.linkCtx(), (t) => {
      const r = this.rule(t);
      return r ? describeRule(r) : null;
    }).open();
  }
  askTitle(heading, initial, cb) {
    new TitleModal(this.app, heading, initial, cb).open();
  }
  /* --- opérations --- */
  async edit(fn) {
    var _a;
    if (!this.file) return;
    const file = this.file;
    const old = await readText(this.app, file);
    let res;
    try {
      res = fn(old);
    } catch (err) {
      new import_obsidian2.Notice(err.message);
      return;
    }
    if (!res) return;
    await writeText(this.app, file, old, res.text);
    await this.refresh(res.text);
    if (res.line !== void 0) {
      this.setActiveLine(res.line);
      (_a = this.treeEl.querySelector(`.pc-row[data-line="${res.line}"]`)) == null ? void 0 : _a.scrollIntoView({ block: "nearest" });
    }
  }
  move(src, target, pos) {
    this.edit((t) => {
      var _a, _b;
      const title = (_b = (_a = this.outline) == null ? void 0 : _a.all.find((n) => n.line === src)) == null ? void 0 : _b.title;
      const out = moveSection(t, src, target, pos);
      const moved = parse(out).all.find((n) => n.title === title);
      return { text: out, line: moved == null ? void 0 : moved.line };
    });
  }
  shift(line, dir) {
    this.edit((t) => {
      const r = shiftSection(t, line, dir);
      return r ? { text: r.text, line: r.newLine } : null;
    });
  }
  rename(line, title) {
    var _a, _b;
    const old = (_b = (_a = this.outline) == null ? void 0 : _a.all.find((x) => x.line === line)) == null ? void 0 : _b.title;
    this.edit((t) => ({ text: renameSection(t, line, title), line }));
  }
  async add(ref, mode, title, body = "") {
    if (ref !== null && mode === "child" && this.outline) {
      const n = this.outline.all.find((x) => x.line === ref);
      if (n) this.collapsedSet().delete(this.keyOf(n));
    }
    let cursor = -1;
    await this.edit((t) => {
      const rl = this.rule(title);
      const r = addSection(t, ref, mode, title, body, rl ? calloutHeader(rl) : void 0);
      cursor = r.cursorLine;
      return { text: r.text, line: r.newLine };
    });
    if (cursor >= 0) await this.reveal(cursor, true);
  }
  async reveal(line, atEnd = false) {
    if (!this.file) return;
    let leaf = this.app.workspace.getLeavesOfType("markdown").find((l2) => {
      var _a;
      return ((_a = l2.view.file) == null ? void 0 : _a.path) === this.file.path;
    });
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(this.file);
    }
    await revealLine(this.app, this.file, line, atEnd);
    this.setActiveLine(line);
  }
};
// src/notes.ts : notes séparées du texte (panneau de droite, index, masquage)
var NOTES_VIEW = "plan-carnet-notes";
var STATUSES = [
  { id: "idee", label: "Id\xE9e", color: "#9e9e9e" },
  { id: "brouillon", label: "Brouillon", color: "#e8912d" },
  { id: "relire", label: "\xC0 relire", color: "#3b82c4" },
  { id: "fini", label: "Fini", color: "#3fa34d" }
];
function keyOfNode(n) {
  const parts = [];
  for (let c = n; c; c = c.parent) parts.unshift(c.title);
  return parts.join("\0");
}
function findByKey(o, key) {
  return o.all.find((n) => keyOfNode(n) === key);
}
function fold(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
/** La section « propriétaire » des notes pour une ligne donnée. */
function ownerAt(o, line, isAnnex) {
  let n = nodeAtLine(o, line);
  while (n && isAnnex(n.title)) n = n.parent;
  if (!n) return null;
  for (let c = n; c; c = c.parent) if (c.children.some((k) => isAnnex(k.title))) return c;
  return n;
}
function ownersOf(o, isAnnex) {
  return o.all.filter((n) => !isAnnex(n.title) && n.children.some((k) => isAnnex(k.title)));
}
/** Contenu d'une section de notes, sans les chevrons de l'encadré. */
function annexBody(lines, n) {
  const end = Math.min(n.end, lines.length);
  let body = lines.slice(n.line + 1, end);
  while (body.length && isBlank(body[0])) body.shift();
  while (body.length && isBlank(body[body.length - 1])) body.pop();
  let callout = null;
  if (body.length && /^\s*>\s*\[!/.test(body[0]) && body.every((l) => /^\s*>/.test(l))) {
    callout = body[0].trim();
    body = body.slice(1).map((l) => l.replace(/^\s*> ?/, ""));
  }
  return { callout, text: body.join("\n").replace(/^\s+|\s+$/g, "") };
}
function setAnnexBody(text, line, callout, newText) {
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
  const hadFinalNewline = text.endsWith("\n");
  const lines = [...o.lines];
  if (hadFinalNewline && lines[lines.length - 1] === "") lines.pop();
  let stop = Math.min(n.end, lines.length);
  while (stop > n.line + 1 && isBlank(lines[stop - 1])) stop--;
  const body = newText.replace(/\s+$/, "");
  const bodyLines = body ? body.split("\n") : [];
  let piece;
  if (callout) piece = [callout, ...bodyLines.length ? quoteLines(bodyLines) : ["> "]];
  else piece = bodyLines.length ? ["", ...bodyLines] : [];
  lines.splice(n.line + 1, stop - (n.line + 1), ...piece);
  return lines.join("\n") + (hadFinalNewline ? "\n" : "");
}
function plainPreview(s) {
  return s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim();
}
async function revealLine(app, file, line, atEnd = false) {
  let leaf = app.workspace.getLeavesOfType("markdown").find((l2) => {
    var _a;
    return ((_a = l2.view.file) == null ? void 0 : _a.path) === file.path;
  });
  if (!leaf) {
    leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const view = leaf.view;
  const ed = view.editor;
  const l = Math.max(0, Math.min(line, ed.lineCount() - 1));
  ed.setCursor({ line: l, ch: atEnd ? ed.getLine(l).length : 0 });
  try {
    if (view.getMode && view.getMode() === "preview") {
      view.previewMode.applyScroll(l);
      return;
    }
    const cm = ed.cm;
    if (cm && cm.dispatch) {
      const pos = cm.state.doc.line(l + 1).from;
      cm.dispatch({ effects: import_view.EditorView.scrollIntoView(pos, { y: "start", yMargin: 60 }) });
      cm.focus();
      return;
    }
  } catch (err) {
    console.error("Plan carnet : d\xE9filement", err);
  }
  ed.scrollIntoView({ from: { line: l, ch: 0 }, to: { line: l, ch: 0 } }, true);
}
/* --- masquage des notes dans l'éditeur --- */
var notesHideCfg = { hidden: false, isAnnex: () => false, onClick: () => {
} };
var setNotesHidden = import_state.StateEffect.define();
var HiddenNotesWidget = class extends import_view.WidgetType {
  constructor(label) {
    super();
    this.label = label;
  }
  eq(o) {
    return o.label === this.label;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "pc-notes-hidden";
    el.textContent = `▸ ${this.label}`;
    el.setAttribute("aria-label", "Notes masqu\xE9es : clic pour les voir dans le panneau");
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      notesHideCfg.onClick();
    });
    return el;
  }
  ignoreEvent() {
    return true;
  }
};
var STATUS_RE = /^\s*%%\s*statut\s*:\s*([^%]*?)\s*%%\s*$/i;
function statusLineOf(lines, n) {
  var _a, _b;
  const to = Math.min((_b = (_a = n.children[0]) == null ? void 0 : _a.line) != null ? _b : n.end, lines.length);
  for (let i = n.line + 1; i < to; i++) if (STATUS_RE.test(lines[i])) return i;
  return -1;
}
function statusIdOf(lines, n) {
  const i = statusLineOf(lines, n);
  if (i < 0) return "";
  const v = fold(STATUS_RE.exec(lines[i])[1].trim());
  const s = STATUSES.find((x) => x.id === v || fold(x.label) === v);
  return s ? s.id : "";
}
function setStatusInText(text, line, id) {
  const o = parse(text);
  const n = findByLine(o, line);
  if (!n) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
  const hadFinalNewline = text.endsWith("\n");
  const lines = [...o.lines];
  if (hadFinalNewline && lines[lines.length - 1] === "") lines.pop();
  const i = statusLineOf(lines, n);
  if (!id) {
    if (i >= 0) lines.splice(i, 1);
  } else {
    const l = `%% statut: ${id} %%`;
    if (i >= 0) lines[i] = l;
    else lines.splice(n.line + 1, 0, l);
  }
  return lines.join("\n") + (hadFinalNewline ? "\n" : "");
}
function buildHideDecos(state) {
  const doc = state.doc;
  const o = parse(doc.toString());
  const lines = o.lines;
  const groups = [];
  let lastEnd = -1;
  for (const n of o.all) {
    if (!notesHideCfg.hidden) break;
    if (n.line < lastEnd || !notesHideCfg.isAnnex(n.title)) continue;
    let stop = Math.min(n.end, lines.length);
    while (stop > n.line + 1 && isBlank(lines[stop - 1])) stop--;
    lastEnd = n.end;
    const g = groups[groups.length - 1];
    let gapBlank = !!g;
    if (g) for (let i = g.stop; i < n.line; i++) if (!isBlank(lines[i])) gapBlank = false;
    if (g && gapBlank) {
      g.stop = stop;
      g.titles.push(n.title);
    } else groups.push({ from: n.line, stop, titles: [n.title] });
  }
  const ranges = groups.map((g) => ({
    from: doc.line(g.from + 1).from,
    to: doc.line(Math.min(g.stop, doc.lines)).to,
    deco: import_view.Decoration.replace({ widget: new HiddenNotesWidget(g.titles.join(" \xB7 ")), block: true })
  }));
  const inGroup = (l) => groups.some((g) => l >= g.from && l < g.stop);
  if (!notesHideCfg.hidden) {
    for (const n of o.all) {
      if (!notesHideCfg.isAnnex(n.title) || n.line + 1 > doc.lines) continue;
      const ln = doc.line(n.line + 1);
      ranges.push({ from: ln.from, to: ln.from, deco: import_view.Decoration.line({ class: "pc-annex-head" }) });
    }
  }
  for (const n of o.all) {
    if (notesHideCfg.isAnnex(n.title)) continue;
    const i = statusLineOf(lines, n);
    if (i < 0 || i + 1 > doc.lines || inGroup(i)) continue;
    const ln = doc.line(i + 1);
    ranges.push({ from: ln.from, to: ln.to, deco: import_view.Decoration.replace({ block: true }) });
  }
  ranges.sort((a, b2) => a.from - b2.from);
  const b = new import_state.RangeSetBuilder();
  let last = -1;
  for (const r of ranges) {
    if (r.from <= last && r.to > r.from) continue;
    b.add(r.from, r.to, r.deco);
    last = r.to;
  }
  return b.finish();
}
var hideNotesField = import_state.StateField.define({
  create: (s) => buildHideDecos(s),
  update(deco, tr) {
    if (tr.docChanged || tr.effects.some((e) => e.is(setNotesHidden))) return buildHideDecos(tr.state);
    return deco;
  },
  provide: (f) => import_view.EditorView.decorations.from(f)
});
/* --- panneau de droite --- */
var NotesView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.text = null;
    this.cursorLine = null;
    this.ownerKey = null;
    this.mode = "section";
    this.pending = /* @__PURE__ */ new Map();
    this.saving = Promise.resolve();
    this.focusKey = null;
    this.editKey = null;
    this.caret = null;
    this.query = "";
    this.filter = "all";
    this.comp = null;
  }
  getViewType() {
    return NOTES_VIEW;
  }
  getDisplayText() {
    return "Notes de la section";
  }
  getIcon() {
    return "sticky-note";
  }
  async onOpen() {
    this.contentEl.addClass("pc-notes");
    const mv = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (mv == null ? void 0 : mv.file) this.follow(mv.file, mv.editor.getValue(), mv.editor.getCursor().line);
    else this.draw();
  }
  isAnnex(t) {
    return this.plugin.isAnnex(t);
  }
  /** Appelé par le plugin quand le curseur bouge ou que le texte change. */
  follow(file, text, line) {
    if (this.busy()) return;
    const moved = file !== this.file || line !== this.cursorLine;
    if (!moved && text === this.text) return;
    const textChanged = text !== this.text || file !== this.file;
    this.file = file;
    this.text = text;
    this.cursorLine = line;
    const o = parse(text);
    let owner = !moved && this.ownerKey ? findByKey(o, this.ownerKey) : null;
    if (!owner) owner = ownerAt(o, line, (t) => this.isAnnex(t));
    const key = owner ? keyOfNode(owner) : null;
    const prevKey = this.ownerKey;
    this.ownerKey = key;
    if (this.mode === "index" && !textChanged) return;
    if (this.mode === "section" && key === prevKey && !textChanged) return;
    this.draw();
  }
  setOwner(n) {
    this.ownerKey = n ? keyOfNode(n) : null;
    this.draw();
  }
  draw() {
    for (const [k, v] of this.pending) this.saveAnnex(k, v);
    this.pending.clear();
    const c = this.contentEl;
    const scroller = c.querySelector(".pc-notes-body");
    const scroll = scroller ? scroller.scrollTop : 0;
    c.empty();
    if (this.comp) this.removeChild(this.comp);
    this.comp = this.addChild(new import_obsidian2.Component());
    const head = c.createDiv("pc-notes-head");
    const tabs = head.createDiv("pc-notes-tabs");
    const tab = (id, label) => {
      const b = tabs.createEl("button", { text: label, cls: "pc-notes-tab" });
      if (this.mode === id) b.addClass("is-active");
      b.addEventListener("click", () => {
        this.mode = id;
        this.draw();
      });
    };
    tab("section", "Section");
    tab("index", "Index");
    const right = head.createDiv("pc-notes-tools");
    const pv = this.plugin.settings.notesMarkdown;
    const prev = right.createDiv({
      cls: "clickable-icon pc-tool" + (pv ? " is-active" : ""),
      attr: { "aria-label": pv ? "Markdown visible en permanence (cliquer pour revenir au texte mis en forme)" : "Afficher le code Markdown en permanence" }
    });
    (0, import_obsidian2.setIcon)(prev, "code");
    prev.addEventListener("click", async () => {
      this.editKey = null;
      this.plugin.settings.notesMarkdown = !pv;
      await this.plugin.saveData(this.plugin.settings);
      this.draw();
    });
    const eye = right.createDiv({
      cls: "clickable-icon pc-tool",
      attr: { "aria-label": this.plugin.settings.notesHidden ? "Notes masqu\xE9es dans le texte (cliquer pour les afficher)" : "Masquer les notes dans le texte" }
    });
    (0, import_obsidian2.setIcon)(eye, this.plugin.settings.notesHidden ? "eye-off" : "eye");
    if (this.plugin.settings.notesHidden) eye.addClass("is-active");
    eye.addEventListener("click", () => this.plugin.setNotesHidden(!this.plugin.settings.notesHidden));
    const body = c.createDiv("pc-notes-body");
    if (!this.file || this.text === null) {
      body.createDiv({ cls: "pc-empty", text: "Ouvre une note et place le curseur dans une section : ses notes s'afficheront ici." });
      return;
    }
    try {
      if (this.mode === "index") this.drawIndex(body);
      else this.drawSection(body);
    } catch (err) {
      console.error("Plan carnet : panneau des notes", err);
      body.createDiv({ cls: "pc-empty", text: `Erreur d'affichage : ${err.message}. Copie ce message pour le signaler.` });
    }
    body.scrollTop = scroll;
  }
  /** Le panneau est en cours d'utilisation : ne pas le redessiner sous les doigts. */
  busy() {
    return this.pending.size > 0 || this.contentEl.contains(document.activeElement) || !!document.querySelector(".modal-container");
  }
  linkCtxFor() {
    return {
      app: this.app,
      sourcePath: this.file.path,
      headings: parse(this.text).all.map((x) => x.title),
      trigger: this.plugin.settings.linkTrigger
    };
  }
  drawSection(body) {
    const o = parse(this.text);
    const owner = this.ownerKey ? findByKey(o, this.ownerKey) : null;
    if (!owner) {
      body.createDiv({ cls: "pc-empty", text: "Le curseur n'est dans aucune section." });
      return;
    }
    const crumbs = body.createDiv("pc-notes-crumbs");
    const chain = [];
    for (let c = owner.parent; c; c = c.parent) chain.unshift(c);
    chain.forEach((a) => {
      const s = crumbs.createSpan({ cls: "pc-notes-crumb", text: a.title, attr: { "aria-label": "Voir les notes de cette section" } });
      s.addEventListener("click", () => this.setOwner(a));
      crumbs.createSpan({ cls: "pc-notes-sep", text: "›" });
    });
    const annexes = owner.children.filter((k) => this.isAnnex(k.title));
    const titleRow = body.createDiv("pc-notes-title-row");
    const t = titleRow.createDiv({ cls: "pc-notes-title", text: owner.title || "(sans titre)" });
    t.addEventListener("click", () => revealLine(this.app, this.file, owner.line));
    const meta = body.createDiv("pc-notes-meta");
    const st = this.plugin.statusInfo(statusIdOf(o.lines, owner));
    const pill = meta.createEl("button", { cls: "pc-status-pill" + (st ? "" : " is-none"), attr: { "aria-label": "Changer le statut" } });
    const dot = pill.createSpan("pc-status-dot");
    if (st) dot.style.background = st.color;
    pill.createSpan({ text: st ? st.label : "Statut" });
    pill.addEventListener("click", (e) => this.plugin.statusMenu(e, this.file, owner));
    const textWords = owner.totalWords - annexes.reduce((a, k) => a + k.totalWords, 0);
    meta.createDiv({ cls: "pc-count", text: `${textWords.toLocaleString("fr-FR")} mots de texte` });
    for (const n of annexes) this.drawCard(body, o, n);
    const rules = this.plugin.settings.layoutRules.filter((r) => r.titles.trim());
    const missing = rules.filter((r) => !annexes.some((k) => ruleFor([r], k.title)));
    if (missing.length) {
      const add = body.createDiv("pc-notes-add");
      for (const r of missing) {
        const name = r.titles.split(",")[0].trim();
        const b = add.createEl("button", { cls: "pc-notes-add-btn" });
        (0, import_obsidian2.setIcon)(b.createSpan(), "plus");
        b.createSpan({ text: name });
        b.addEventListener("click", () => this.createAnnex(owner, r, name));
      }
    }
    if (!annexes.length) body.createDiv({ cls: "pc-empty", text: "Pas encore de notes pour cette section." });
  }
  drawCard(body, o, n) {
    const card = body.createDiv("pc-note-card");
    const r = ruleFor(this.plugin.settings.layoutRules, n.title);
    if (r) card.addClass(`pc-note-${r.type}`);
    const h = card.createDiv("pc-note-head");
    h.createDiv({ cls: "pc-note-name", text: n.title });
    const acts = h.createDiv("pc-note-acts");
    const { callout, text } = annexBody(o.lines, n);
    const key = keyOfNode(n);
    const mini = (icon, tip, fn) => {
      const b = acts.createDiv({ cls: "clickable-icon pc-mini", attr: { "aria-label": tip } });
      (0, import_obsidian2.setIcon)(b, icon);
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", fn);
    };
    mini("message-square-plus", "Ajouter une id\xE9e dat\xE9e \xE0 la suite", () => this.quickAdd(n, callout));
    if (!this.plugin.settings.notesHidden) mini("locate", "Aller dans le texte", () => revealLine(this.app, this.file, n.line));
    const ch = parseCalloutHeader(callout);
    const defType = ch ? ch.type : r ? r.type : "note";
    const curTitle = ch ? ch.label.trim() : "";
    const tRow = card.createDiv("pc-note-title");
    (0, import_obsidian2.setIcon)(tRow.createSpan("pc-note-title-ico"), "heading");
    const tIn = tRow.createEl("input", { type: "text", cls: "pc-note-title-input", attr: { placeholder: defType.charAt(0).toUpperCase() + defType.slice(1), "aria-label": "Titre de l'encadr\xE9 (vide = titre par d\xE9faut)", spellcheck: "true" } });
    tIn.value = curTitle;
    let tDone = false;
    tIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tIn.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        tIn.value = curTitle;
        tIn.blur();
      }
    });
    tIn.addEventListener("blur", () => {
      const v = tIn.value.replace(/[\r\n]+/g, " ").trim();
      if (tDone || v === curTitle) return;
      tDone = true;
      this.setCardTitle(n, v, defType);
    });
    const md = !!this.plugin.settings.notesMarkdown;
    if (!md && this.editKey !== key) {
      const content = card.createDiv({ cls: "pc-note-content markdown-rendered", attr: { "aria-label": "Clic pour modifier" } });
      if (!text) content.createDiv({ cls: "pc-empty", text: "Vide. Clique pour \xE9crire." });
      else import_obsidian2.MarkdownRenderer.render(this.app, text, content, this.file.path, this.comp);
      content.addEventListener("click", (e) => {
        const a = e.target.closest("a");
        if (a) {
          e.preventDefault();
          if (a.hasClass("internal-link")) this.openLink(a.getAttribute("data-href") || a.getAttribute("href") || "");
          else if (a.hasClass("external-link")) window.open(a.getAttribute("href") || "");
          else if (a.hasClass("tag")) return;
          return;
        }
        if (e.target.closest("input")) return;
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && content.contains(sel.anchorNode)) return;
        let caret = text.length;
        if (sel && sel.anchorNode && sel.anchorNode.nodeType === 3 && content.contains(sel.anchorNode)) {
          const t = sel.anchorNode.textContent || "";
          const i = t.trim() ? text.indexOf(t) : -1;
          if (i >= 0) caret = i + sel.anchorOffset;
        }
        this.editKey = key;
        this.caret = caret;
        this.draw();
      });
      return;
    }
    const area = card.createEl("textarea", { cls: "pc-note-area", attr: { placeholder: "\xC9cris ici… (@@ pour un lien)", spellcheck: "true" } });
    area.value = text;
    const grow = () => {
      area.style.height = "auto";
      area.style.height = `${Math.max(64, area.scrollHeight + 2)}px`;
    };
    attachLinkTools(area, this.linkCtxFor());
    let timer = null;
    const flush = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (!this.pending.has(key)) return;
      const v = this.pending.get(key);
      this.pending.delete(key);
      try {
        const o2 = parse(this.text);
        const n2 = findByKey(o2, key);
        if (n2) this.text = setAnnexBody(this.text, n2.line, annexBody(o2.lines, n2).callout, v);
      } catch (e) {
      }
      this.saveAnnex(key, v);
    };
    area.addEventListener("input", () => {
      grow();
      this.pending.set(key, area.value);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(flush, 800);
    });
    area.addEventListener("blur", () => {
      flush();
      if (md) return;
      window.setTimeout(() => {
        if (document.querySelector(".modal-container") || document.activeElement === area) return;
        if (this.editKey !== key) return;
        this.editKey = null;
        this.draw();
      }, 200);
    });
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        flush();
      } else if (e.key === "Escape" && !md) {
        e.preventDefault();
        e.stopPropagation();
        area.blur();
      }
    });
    area.addEventListener("click", (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const v = area.value;
      const p = area.selectionStart;
      const re = /\[\[([^\]]+)\]\]|\[([^\]]*)\]\(([^)\s]+)\)|https?:\/\/\S+/g;
      let m;
      while (m = re.exec(v)) {
        if (p >= m.index && p <= m.index + m[0].length) {
          e.preventDefault();
          if (m[1]) this.openLink(m[1].split("|")[0]);
          else window.open(m[3] || m[0]);
          return;
        }
      }
    });
    window.setTimeout(grow, 0);
    if (this.focusKey === key || !md && this.editKey === key) {
      const at = this.focusKey === key || this.caret == null ? area.value.length : Math.min(this.caret, area.value.length);
      this.focusKey = null;
      this.caret = null;
      this.editKey = key;
      window.setTimeout(() => {
        area.focus();
        area.setSelectionRange(at, at);
      }, 0);
    }
  }
  /** Enregistre le texte d'une carte, sans redessiner le panneau. */
  saveAnnex(key, value) {
    this.saving = this.saving.then(async () => {
      if (!this.file) return;
      const file = this.file;
      const old = await readText(this.app, file);
      const o = parse(old);
      const n = findByKey(o, key);
      if (!n) {
        new import_obsidian2.Notice("Section introuvable : la note n'a pas \xE9t\xE9 enregistr\xE9e. Copie ton texte avant de continuer.", 8e3);
        return;
      }
      const out = setAnnexBody(old, n.line, annexBody(o.lines, n).callout, value);
      await writeText(this.app, file, old, out);
      this.text = out;
    }).catch((err) => new import_obsidian2.Notice(`Plan carnet : ${err.message}`));
    return this.saving;
  }
  /** Change le titre affiché de l'encadré d'une carte (vide = titre par défaut d'Obsidian). */
  setCardTitle(n, label, defType) {
    const key = keyOfNode(n);
    return this.mutate((t) => {
      const o2 = parse(t);
      const n2 = findByKey(o2, key);
      if (!n2) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
      const lines = t.split("\n");
      const end = Math.min(n2.end, lines.length);
      let i = n2.line + 1;
      while (i < end && isBlank(lines[i])) i++;
      const c = i < end ? parseCalloutHeader(lines[i]) : null;
      if (c) {
        const cr = lines[i].endsWith("\r") ? "\r" : "";
        lines[i] = calloutHeader({ type: c.type, fold: c.fold, label }) + cr;
        return lines.join("\n");
      }
      const { text } = annexBody(o2.lines, n2);
      return setAnnexBody(t, n2.line, calloutHeader({ type: defType, fold: "", label }), text);
    });
  }
  async createAnnex(owner, rule, name) {
    const ownerKey = keyOfNode(owner);
    this.focusKey = `${ownerKey}\0${name}`;
    await this.mutate((t) => {
      const n2 = findByKey(parse(t), ownerKey);
      if (!n2) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
      return addSection(t, n2.line, "child", name, "", calloutHeader(rule)).text;
    });
  }
  quickAdd(n, callout) {
    const key = keyOfNode(n);
    new NoteModal(
      this.app,
      n.title,
      (b) => this.mutate((t) => {
        const n2 = findByKey(parse(t), key);
        if (!n2) throw new Error("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
        return appendToSection(t, n2.line, b, callout != null ? callout : void 0).text;
      }),
      this.linkCtxFor(),
      null
    ).open();
  }
  async mutate(fn) {
    if (!this.file) return;
    await this.saving;
    const file = this.file;
    const old = await readText(this.app, file);
    let out;
    try {
      out = fn(old);
    } catch (err) {
      new import_obsidian2.Notice(err.message);
      return;
    }
    await writeText(this.app, file, old, out);
    this.pending.clear();
    this.text = out;
    this.draw();
  }
  openLink(href) {
    if (!this.file) return;
    href = href.trim();
    if (href.startsWith("#")) {
      const anchor = headingAnchor(href.slice(1));
      const h = parse(this.text).all.find((x) => headingAnchor(x.title) === anchor);
      if (h) revealLine(this.app, this.file, h.line);
      else new import_obsidian2.Notice("Section introuvable dans cette note.");
    } else this.app.workspace.openLinkText(href, this.file.path, false);
  }
  drawIndex(body) {
    const o = parse(this.text);
    const isA = (t) => this.isAnnex(t);
    const owners = ownersOf(o, isA);
    const rules = this.plugin.settings.layoutRules.filter((r) => r.titles.trim());
    const bar = body.createDiv("pc-index-bar");
    const input = bar.createEl("input", { type: "search", cls: "pc-index-search", attr: { placeholder: "Chercher dans les notes…" } });
    input.value = this.query;
    const sel = bar.createEl("select", { cls: "dropdown pc-index-filter" });
    const opt = (v, l) => {
      const op = sel.createEl("option", { text: l, attr: { value: v } });
      if (v === this.filter) op.selected = true;
    };
    opt("all", "Toutes les sections avec notes");
    rules.forEach((r, i) => {
      const name = r.titles.split(",")[0].trim();
      opt(`with:${i}`, `Avec \xAB ${name} \xBB`);
      opt(`without:${i}`, `Sans \xAB ${name} \xBB`);
    });
    STATUSES.forEach((x) => opt(`st:${x.id}`, `Statut : ${x.label}`));
    opt("st:", "Statut : aucun");
    const info = body.createDiv("pc-index-info");
    const list = body.createDiv("pc-index-list");
    const levelCount = /* @__PURE__ */ new Map();
    o.all.filter((n) => !isA(n.title)).forEach((n) => levelCount.set(n.level, (levelCount.get(n.level) || 0) + 1));
    let entryLevel = 0;
    let best = -1;
    levelCount.forEach((v, k) => {
      if (v > best) best = v, entryLevel = k;
    });
    const render = () => {
      list.empty();
      const q = fold(this.query.trim());
      let pool;
      const m = /^(with|without):(\d+)$/.exec(this.filter);
      const sm = /^st:(.*)$/.exec(this.filter);
      if (sm) {
        pool = o.all.filter((n) => n.level === entryLevel && !isA(n.title) && statusIdOf(o.lines, n) === sm[1]);
      } else if (m && m[1] === "without") {
        const r = rules[+m[2]];
        pool = o.all.filter((n) => n.level === entryLevel && !isA(n.title) && !n.children.some((k) => r && ruleFor([r], k.title)));
      } else if (m) {
        const r = rules[+m[2]];
        pool = owners.filter((n) => n.children.some((k) => r && ruleFor([r], k.title)));
      } else pool = owners;
      let shown = 0;
      for (const n of pool) {
        const ann = n.children.filter((k) => isA(k.title));
        const texts = ann.map((k) => ({ k, t: annexBody(o.lines, k).text }));
        if (q && !fold(n.title + " " + texts.map((x) => x.t).join(" ")).includes(q)) continue;
        shown++;
        const row = list.createDiv("pc-index-row");
        const top = row.createDiv("pc-index-top");
        const sti = this.plugin.statusInfo(statusIdOf(o.lines, n));
        const d = top.createSpan({ cls: "pc-status-dot" + (sti ? "" : " is-none"), attr: { "aria-label": sti ? sti.label : "Sans statut" } });
        if (sti) d.style.background = sti.color;
        top.createSpan({ cls: "pc-index-title", text: n.title || "(sans titre)" });
        const chips = top.createSpan("pc-index-chips");
        for (const k of ann) {
          const r = ruleFor(rules, k.title);
          const chip = chips.createSpan({ cls: `pc-index-chip pc-note-${r ? r.type : "note"}`, text: k.title });
          chip.setAttr("aria-label", `${k.totalWords} mots`);
        }
        let prev = "";
        if (q) {
          const hit = texts.find((x) => fold(x.t).includes(q));
          if (hit) {
            const p = plainPreview(hit.t);
            const i = fold(p).indexOf(q);
            prev = (i > 40 ? "…" : "") + p.slice(Math.max(0, i - 40), i + 100);
          }
        }
        if (!prev && texts.length) prev = plainPreview(texts[0].t).slice(0, 120);
        if (prev) row.createDiv({ cls: "pc-index-prev", text: prev });
        row.addEventListener("click", () => revealLine(this.app, this.file, n.line));
        const open = row.createDiv({ cls: "clickable-icon pc-mini pc-index-open", attr: { "aria-label": "Ouvrir les notes de cette section" } });
        (0, import_obsidian2.setIcon)(open, "sticky-note");
        open.addEventListener("click", (e) => {
          e.stopPropagation();
          this.mode = "section";
          this.setOwner(n);
        });
      }
      const counts = STATUSES.map((x) => {
        const k = o.all.filter((n) => n.level === entryLevel && !isA(n.title) && statusIdOf(o.lines, n) === x.id).length;
        return k ? `${k} ${x.label.toLowerCase()}` : "";
      }).filter(Boolean).join(" \xB7 ");
      info.setText(`${shown.toLocaleString("fr-FR")} section${shown > 1 ? "s" : ""} affich\xE9e${shown > 1 ? "s" : ""}${counts ? " \xB7 " + counts : ""}`);
      if (!shown) list.createDiv({ cls: "pc-empty", text: "Aucune section ne correspond." });
    };
    input.addEventListener("input", () => {
      this.query = input.value;
      render();
    });
    sel.addEventListener("change", () => {
      this.filter = sel.value;
      render();
    });
    render();
  }
};

var DEFAULTS = {
  side: "left",
  ...APPEARANCE_DEFAULTS,
  layoutAuto: true,
  layoutRules: DEFAULT_RULES.map((r) => ({ ...r })),
  linkTrigger: "@@",
  linkSuggestOn: true,
  linksNewTab: true,
  notesHidden: false,
  notesMarkdown: false,
  statuses: {},
  notesSide: "right",
  notesPanelCreated: false,
  trash: []
};
var TRANSFORMS = {
  none: "Normal",
  uppercase: "MAJUSCULES",
  "small-caps": "Petites capitales"
};
var DECOS = {
  none: "Aucune",
  underline: "Soulign\xE9",
  band: "Bandeau de couleur",
  bar: "Barre \xE0 gauche"
};
var PlanSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.previewEl = null;
  }
  async save(redraw = false) {
    await this.plugin.saveSettings();
    if (redraw) this.display();
    else this.drawPreview();
  }
  display() {
    const el = this.containerEl;
    el.empty();
    const st = this.plugin.settings;
    new import_obsidian2.Setting(el).setName("Position du plan").setDesc("Barre lat\xE9rale o\xF9 s'affiche l'arbre.").addDropdown(
      (d) => d.addOption("left", "\xC0 gauche du texte").addOption("right", "\xC0 droite du texte").setValue(st.side).onChange(async (v) => {
        st.side = v;
        await this.plugin.saveSettings();
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length) await this.plugin.openView();
      })
    );
    new import_obsidian2.Setting(el).setName("Liens").setHeading();
    new import_obsidian2.Setting(el).setName("Raccourci de lien interne").setDesc("Taper ces caract\xE8res ouvre la liste des sections et des notes, dans la note comme dans les fen\xEAtres du plan.").addText(
      (t) => t.setValue(st.linkTrigger).setPlaceholder("@@").onChange(async (v) => {
        st.linkTrigger = v.trim();
        await this.plugin.saveSettings();
      })
    ).addToggle(
      (t) => t.setTooltip("Actif aussi dans la note").setValue(st.linkSuggestOn).onChange(async (v) => (st.linkSuggestOn = v, await this.plugin.saveSettings()))
    );
    new import_obsidian2.Setting(el).setName("Ouvrir les liens dans un nouvel onglet").setDesc(
      "Un lien vers une autre note s'ouvre \xE0 c\xF4t\xE9, sans remplacer la page en cours. Si la note est d\xE9j\xE0 ouverte, son onglet est r\xE9utilis\xE9. Les liens vers une section de la m\xEAme note restent sur place."
    ).addToggle(
      (t) => t.setValue(st.linksNewTab).onChange(async (v) => (st.linksNewTab = v, await this.plugin.saveSettings()))
    );
    new import_obsidian2.Setting(el).setName("Notes s\xE9par\xE9es du texte").setHeading();
    new import_obsidian2.Setting(el).setName("Panneau des notes").setDesc("Les sous-sections dont le titre figure dans les mises en page ci-dessous (Notes, Voir aussi, R\xE9f\xE9rences\u2026) sont trait\xE9es comme des notes : elles s'affichent dans ce panneau, \xE0 c\xF4t\xE9 du texte.").addDropdown(
      (d) => d.addOption("right", "\xC0 droite du texte").addOption("left", "\xC0 gauche du texte").setValue(st.notesSide).onChange(async (v) => {
        st.notesSide = v;
        await this.plugin.saveSettings();
        if (this.app.workspace.getLeavesOfType(NOTES_VIEW).length) await this.plugin.openNotes(true);
      })
    );
    new import_obsidian2.Setting(el).setName("Masquer les notes dans le texte").setDesc("En mode \xE9dition, les sections de notes sont remplac\xE9es par une ligne discr\xE8te. On les lit et on les modifie dans le panneau.").addToggle(
      (t) => t.setValue(st.notesHidden).onChange(async (v) => this.plugin.setNotesHidden(v))
    );
    new import_obsidian2.Setting(el).setName("Mises en page selon le titre").setHeading();
    new import_obsidian2.Setting(el).setName("Appliquer automatiquement").setDesc(
      "Quand une section porte l'un de ces titres, le texte ajout\xE9 par le plan va dans un encadr\xE9. Plusieurs titres possibles, s\xE9par\xE9s par des virgules."
    ).addToggle((t) => t.setValue(st.layoutAuto).onChange(async (v) => (st.layoutAuto = v, await this.plugin.saveSettings())));
    st.layoutRules.forEach((r, idx) => {
      const row = new import_obsidian2.Setting(el).setClass("pc-rule");
      row.addText(
        (t) => t.setPlaceholder("Titre de section").setValue(r.titles).onChange(async (v) => (r.titles = v, await this.plugin.saveSettings()))
      );
      row.addDropdown((d) => {
        Object.entries(CALLOUT_TYPES).forEach(([k, v]) => d.addOption(k, v));
        if (!CALLOUT_TYPES[r.type]) d.addOption(r.type, r.type);
        d.setValue(r.type).onChange(async (v) => (r.type = v, await this.plugin.saveSettings()));
      });
      row.addText(
        (t) => t.setPlaceholder("Titre de l'encadr\xE9 (facultatif)").setValue(r.label).onChange(async (v) => (r.label = v, await this.plugin.saveSettings()))
      );
      row.addDropdown((d) => {
        Object.keys(FOLDS).forEach((k) => d.addOption(k, FOLDS[k]));
        d.setValue(r.fold).onChange(async (v) => (r.fold = v, await this.plugin.saveSettings()));
      });
      row.addExtraButton(
        (b) => b.setIcon("trash-2").setTooltip("Retirer cette r\xE8gle").onClick(async () => {
          st.layoutRules.splice(idx, 1);
          await this.save(true);
        })
      );
    });
    new import_obsidian2.Setting(el).addButton(
      (b) => b.setButtonText("Ajouter une r\xE8gle").onClick(async () => {
        st.layoutRules.push({ titles: "", type: "note", label: "", fold: "" });
        await this.save(true);
      })
    ).setDesc("Pour mettre en page les sections d\xE9j\xE0 \xE9crites : commande \xAB Appliquer les mises en page \xE0 toute la note \xBB.");
    new import_obsidian2.Setting(el).setName("Apparence des niveaux").setHeading();
    new import_obsidian2.Setting(el).setName("Styliser les titres").setDesc("Applique les r\xE9glages ci-dessous \xE0 toutes les notes, en \xE9dition comme en lecture.").addToggle((t) => t.setValue(st.stylesOn).onChange(async (v) => (st.stylesOn = v, this.save())));
    new import_obsidian2.Setting(el).setName("D\xE9caler le texte selon le niveau").setDesc("Comme dans OneNote : chaque niveau et son texte s'\xE9cartent un peu plus de la marge (mode \xE9dition).").addToggle((t) => t.setValue(st.indentOn).onChange(async (v) => (st.indentOn = v, this.save()))).addSlider(
      (sl) => sl.setLimits(8, 48, 2).setValue(st.indentPx).setDynamicTooltip().onChange(async (v) => (st.indentPx = v, this.save()))
    );
    new import_obsidian2.Setting(el).setName("Pr\xE9r\xE9glages").addButton(
      (b) => b.setButtonText("Contrast\xE9").onClick(async () => {
        st.levels = PRESET_CONTRASTE.map((l) => ({ ...l }));
        await this.save(true);
      })
    ).addButton(
      (b) => b.setButtonText("Sobre, couleurs du th\xE8me").onClick(async () => {
        st.levels = PRESET_SOBRE.map((l) => ({ ...l }));
        await this.save(true);
      })
    );
    this.previewEl = el.createDiv("pc-preview");
    this.drawPreview();
    st.levels.forEach((l, i) => {
      const n = i + 1;
      new import_obsidian2.Setting(el).setName(`Niveau ${n}  (${"#".repeat(n)})`).setHeading();
      new import_obsidian2.Setting(el).setName("Taille").addSlider(
        (sl) => sl.setLimits(0.9, 2.6, 0.05).setValue(l.size).setDynamicTooltip().onChange(async (v) => (l.size = v, this.save()))
      );
      new import_obsidian2.Setting(el).setName("Couleur").setDesc("D\xE9sactiv\xE9e : couleur du th\xE8me.").addToggle((t) => t.setValue(l.useColor).onChange(async (v) => (l.useColor = v, this.save()))).addColorPicker((c) => c.setValue(l.color).onChange(async (v) => (l.color = v, this.save())));
      new import_obsidian2.Setting(el).setName("Style").addDropdown((d) => {
        Object.keys(TRANSFORMS).forEach((k) => d.addOption(k, TRANSFORMS[k]));
        d.setValue(l.transform).onChange(async (v) => (l.transform = v, this.save()));
      }).addToggle(
        (t) => t.setTooltip("Gras").setValue(l.bold).onChange(async (v) => (l.bold = v, this.save()))
      );
      new import_obsidian2.Setting(el).setName("D\xE9coration").addDropdown((d) => {
        Object.keys(DECOS).forEach((k) => d.addOption(k, DECOS[k]));
        d.setValue(l.deco).onChange(async (v) => (l.deco = v, this.save()));
      });
    });
  }
  /** Aperçu en direct, rendu comme une vraie note. */
  drawPreview() {
    const p = this.previewEl;
    if (!p) return;
    p.empty();
    p.createDiv({ cls: "pc-preview-label", text: "Aper\xE7u" });
    const page = p.createDiv("markdown-rendered pc-preview-page");
    const sample = [
      [1, "B"],
      [2, "Bengio (Yoshua)"],
      [3, "D\xE9finition"],
      [4, "Exemple"]
    ];
    sample.forEach(([n, t]) => {
      page.createEl(`h${n}`, { text: t });
      if (n === 3) page.createEl("p", { text: "Le texte d'un article du dictionnaire." });
    });
  }
};
var PlanCarnetPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    this.styleEl = null;
    this.restoreLinks = null;
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.applyAppearance();
    try {
      this.refreshHidden();
    } catch (e) {
    }
  }
  applyAppearance() {
    const s = this.settings;
    if (this.styleEl) this.styleEl.textContent = buildCss(s);
    document.body.toggleClass("pc-hs", s.stylesOn);
    document.body.toggleClass("pc-indent", s.indentOn);
  }
  async onload() {
    var _a;
    const saved = (_a = await this.loadData()) != null ? _a : {};
    this.settings = Object.assign({}, DEFAULTS, saved);
    if (!Array.isArray(saved.levels) || saved.levels.length !== 6) {
      this.settings.levels = APPEARANCE_DEFAULTS.levels.map((l) => ({ ...l }));
    }
    if (!Array.isArray(saved.layoutRules)) this.settings.layoutRules = DEFAULT_RULES.map((r) => ({ ...r }));
    if (!Array.isArray(saved.trash)) this.settings.trash = [];
    this.settings.statuses = saved.statuses && typeof saved.statuses === "object" ? saved.statuses : {};
    this.registerView(VIEW_TYPE, (leaf) => new PlanView(leaf, this));
    this.registerView(NOTES_VIEW, (leaf) => new NotesView(leaf, this));
    notesHideCfg.hidden = !!this.settings.notesHidden;
    notesHideCfg.isAnnex = (t) => this.isAnnex(t);
    notesHideCfg.onClick = () => this.openNotes();
    this.addRibbonIcon("sticky-note", "Notes de la section", () => this.openNotes());
    this.addCommand({ id: "ouvrir-notes", name: "Ouvrir le panneau des notes", callback: () => this.openNotes() });
    this.addCommand({
      id: "index-notes",
      name: "Index des notes",
      callback: async () => {
        const v = await this.openNotes();
        if (v) {
          v.mode = "index";
          v.draw();
        }
      }
    });
    this.addCommand({
      id: "masquer-notes",
      name: "Masquer ou afficher les notes dans le texte",
      callback: () => this.setNotesHidden(!this.settings.notesHidden)
    });
    this.addRibbonIcon("list-tree", "Plan carnet", () => this.openView());
    this.addCommand({ id: "ouvrir", name: "Ouvrir le plan", callback: () => this.openView() });
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length) this.openView();
      else this.ensurePanel();
      this.migrateStatuses().catch((e) => console.error("Plan carnet : reprise des statuts", e));
      if (!this.app.workspace.getLeavesOfType(NOTES_VIEW).length) this.openNotes(false, false).catch((e) => console.error("Plan carnet : panneau des notes", e));
    });
    const safe = (what, fn) => {
      try {
        fn();
      } catch (err) {
        console.error(`Plan carnet : ${what} indisponible sur cet appareil`, err);
      }
    };
    safe("ouverture des liens", () => this.patchLinks());
    safe(
      "suggestion de liens",
      () => this.registerEditorSuggest(
        new LinkSuggest(
          this.app,
          () => this.settings.linkTrigger,
          () => this.settings.linkSuggestOn
        )
      )
    );
    this.addCommand({
      id: "lien-interne",
      name: "Ins\xE9rer un lien vers une note ou une section\u2026",
      editorCallback: (editor, ctx) => {
        var _a2, _b;
        return insertNoteLink(this.app, editor, (_b = (_a2 = ctx.file) == null ? void 0 : _a2.path) != null ? _b : "");
      }
    });
    this.addCommand({
      id: "lien-web",
      name: "Ins\xE9rer un lien web\u2026",
      editorCallback: (editor) => insertWebLink(this.app, editor)
    });
    this.addCommand({
      id: "mises-en-page",
      name: "Appliquer les mises en page \xE0 toute la note",
      editorCallback: (editor, ctx) => {
        const old = editor.getValue();
        const r = applyAllLayouts(old, (t) => {
          const rl = ruleFor(this.settings.layoutRules, t);
          return rl ? calloutHeader(rl) : null;
        });
        if (!r.count) {
          new import_obsidian2.Notice("Rien \xE0 mettre en page dans cette note.");
          return;
        }
        if (ctx.file) writeText(this.app, ctx.file, old, r.text);
        new import_obsidian2.Notice(`${r.count} section${r.count > 1 ? "s" : ""} mise${r.count > 1 ? "s" : ""} en page. Cmd+Z pour annuler.`);
      }
    });
    this.addCommand({
      id: "restaurer",
      name: "Restaurer une section supprim\xE9e\u2026",
      callback: () => {
        if (!this.settings.trash.length) {
          new import_obsidian2.Notice("Aucune section supprim\xE9e \xE0 restaurer.");
          return;
        }
        new TrashPicker(this.app, this.settings.trash, (t) => this.restore(t)).open();
      }
    });
    safe("style des niveaux", () => {
      this.styleEl = document.head.createEl("style", { attr: { id: "plan-carnet-niveaux" } });
      this.applyAppearance();
    });
    safe("d\xE9calage du texte", () => this.registerEditorExtension(indentExtension));
    safe("masquage des notes", () => this.registerEditorExtension(hideNotesField));
    safe("titres de notes en lecture", () => this.registerMarkdownPostProcessor((el) => {
      el.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
        if (this.isAnnex(h.textContent || "")) h.addClass("pc-annex-head");
      });
    }));
    this.addCommand({
      id: "basculer-style",
      name: "Activer ou couper le style des niveaux",
      callback: async () => {
        this.settings.stylesOn = !this.settings.stylesOn;
        await this.saveSettings();
      }
    });
    this.addSettingTab(new PlanSettingTab(this.app, this));
    const moves = [
      ["up", "Monter la section"],
      ["down", "Descendre la section"],
      ["outdent", "Sortir la section de sa section parente"],
      ["indent", "Ranger la section dans celle du dessus"]
    ];
    for (let l = 0; l <= 6; l++) {
      this.addCommand({
        id: `ligne-niveau-${l}`,
        name: l === 0 ? "Ligne en texte simple" : `Ligne en titre de niveau ${l}`,
        editorCallback: (editor) => this.lineLevel(editor, () => l)
      });
    }
    this.addCommand({
      id: "noter-idee",
      name: "Noter une id\xE9e dans une section\u2026",
      callback: async () => {
        var _a2, _b;
        let v = (_a2 = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]) == null ? void 0 : _a2.view;
        if (!(v instanceof PlanView)) {
          await this.openView();
          v = (_b = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]) == null ? void 0 : _b.view;
        }
        if (v instanceof PlanView) {
          await v.refresh();
          v.pickAndNote();
        }
      }
    });
    this.addCommand({
      id: "titre-plus-petit",
      name: "Titre : un niveau plus bas (plus petit)",
      editorCallback: (editor) => this.lineLevel(editor, (cur) => cur === 0 ? 6 : cur >= 6 ? 0 : cur + 1)
    });
    this.addCommand({
      id: "titre-plus-grand",
      name: "Titre : un niveau plus haut (plus grand)",
      editorCallback: (editor) => this.lineLevel(editor, (cur) => cur === 0 ? 6 : Math.max(1, cur - 1))
    });
    for (const [dir, name] of moves) {
      this.addCommand({
        id: `section-${dir}`,
        name,
        editorCallback: (editor) => this.shiftAtCursor(editor, dir)
      });
    }
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncToActive()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncToActive()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncToActive()));
    const live = (0, import_obsidian2.debounce)((text, file) => this.forViews((pv) => pv.file === file && pv.refresh(text)), 350, true);
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        if (info.file) live(editor.getValue(), info.file);
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (f instanceof import_obsidian2.TFile && !editorFor(this.app, f)) this.forViews((pv) => pv.file === f && pv.refresh());
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        const st = this.settings.statuses;
        if (oldPath && st[oldPath]) {
          st[f.path] = st[oldPath];
          delete st[oldPath];
          this.saveData(this.settings);
        }
        if (f instanceof import_obsidian2.TFile) this.forViews((pv) => pv.file === f && pv.refresh());
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (f) => {
        this.forViews((pv) => {
          var _a2;
          if (((_a2 = pv.file) == null ? void 0 : _a2.path) === f.path) {
            pv.pinned = false;
            pv.setFile(null);
            this.syncToActive();
          }
        });
      })
    );
    this.registerInterval(
      window.setInterval(() => {
        this.syncToActive();
        const mv = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
        if (!(mv == null ? void 0 : mv.file)) return;
        const line = mv.editor.getCursor().line;
        const cur = mv.editor.getValue();
        for (const leaf of this.app.workspace.getLeavesOfType(NOTES_VIEW)) {
          if (leaf.view instanceof NotesView && cur.length) leaf.view.follow(mv.file, cur, line);
        }
        this.forViews((pv) => {
          var _a2, _b, _c, _d;
          if (((_a2 = pv.file) == null ? void 0 : _a2.path) !== ((_b = mv.file) == null ? void 0 : _b.path)) return;
          const txt = mv.editor.getValue();
          if (txt.length && txt !== pv.lastText) pv.refresh(txt);
          const o = parse(txt);
          pv.setActiveLine((_d = (_c = nodeAtLine(o, line)) == null ? void 0 : _c.line) != null ? _d : null);
        });
      }, 600)
    );
  }
  /** Les clics sur un lien interne passent par openLinkText : on choisit l'onglet. */
  patchLinks() {
    const ws = this.app.workspace;
    const orig = ws.openLinkText;
    const plugin = this;
    ws.openLinkText = async function(linktext, sourcePath, newLeaf, state) {
      try {
        if (plugin.settings.linksNewTab && !newLeaf) {
          const path = linktext.split("|")[0].split("#")[0].trim();
          if (path) {
            const dest = plugin.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
            if (!dest || dest.path !== sourcePath) {
              let found = null;
              if (dest)
                plugin.app.workspace.iterateAllLeaves((l) => {
                  var _a;
                  if (!found && l.view instanceof import_obsidian2.MarkdownView && ((_a = l.view.file) == null ? void 0 : _a.path) === dest.path) found = l;
                });
              if (found) plugin.app.workspace.setActiveLeaf(found, { focus: true });
              else newLeaf = "tab";
            }
          }
        }
      } catch (e) {
      }
      return orig.call(this, linktext, sourcePath, newLeaf, state);
    };
    this.restoreLinks = () => ws.openLinkText = orig;
  }
  onunload() {
    var _a, _b;
    (_a = this.restoreLinks) == null ? void 0 : _a.call(this);
    (_b = this.styleEl) == null ? void 0 : _b.remove();
    document.body.removeClass("pc-hs", "pc-indent");
  }
  isAnnex(t) {
    return !!ruleFor(this.settings.layoutRules, t);
  }
  statusInfo(id) {
    return STATUSES.find((x) => x.id === id) || null;
  }
  /** Les statuts des versions 0.9 et 0.10 étaient dans les réglages : on les écrit dans les notes. */
  async migrateStatuses() {
    const all = this.settings.statuses || {};
    let done = 0;
    let changed = false;
    for (const path of Object.keys(all)) {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (!(f instanceof import_obsidian2.TFile)) continue;
      const old = await readText(this.app, f);
      let text = old;
      for (const [title, id] of Object.entries(all[path] || {})) {
        if (!STATUSES.some((x) => x.id === id)) continue;
        const o = parse(text);
        const n = o.all.find((x) => x.title === title);
        if (!n || statusIdOf(o.lines, n)) continue;
        text = setStatusInText(text, n.line, id);
        done++;
      }
      await writeText(this.app, f, old, text);
      delete all[path];
      changed = true;
    }
    if (changed) {
      await this.saveData(this.settings);
    }
    if (done) new import_obsidian2.Notice(`Plan carnet : ${done} statut${done > 1 ? "s" : ""} r\xE9cup\xE9r\xE9${done > 1 ? "s" : ""} et \xE9crit${done > 1 ? "s" : ""} dans la note.`, 8e3);
  }
  async setStatus(file, line, title, id) {
    const old = await readText(this.app, file);
    const o = parse(old);
    let n = findByLine(o, line);
    if (!n || n.title !== title) n = o.all.find((x) => x.title === title);
    if (!n) {
      new import_obsidian2.Notice("Section introuvable, le fichier a peut-\xEAtre chang\xE9.");
      return;
    }
    const out = setStatusInText(old, n.line, id);
    await writeText(this.app, file, old, out);
    this.forViews((pv) => pv.file === file && pv.refresh(out));
    for (const leaf of this.app.workspace.getLeavesOfType(NOTES_VIEW)) {
      const v = leaf.view;
      if (v instanceof NotesView && v.file === file) {
        v.text = out;
        v.draw();
      }
    }
  }
  statusMenu(e, file, node) {
    if (!file || !node) return;
    const title = node.title;
    let cur = "";
    try {
      const v = this.app.workspace.getLeavesOfType(NOTES_VIEW).map((l) => l.view).find((x) => x instanceof NotesView && x.file === file);
      const pv = this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).find((x) => x instanceof PlanView && x.file === file);
      const txt = v && v.text || pv && pv.lastText || "";
      const o = parse(txt);
      const n = findByLine(o, node.line) || o.all.find((x) => x.title === title);
      if (n) cur = statusIdOf(o.lines, n);
    } catch (err) {
    }
    const menu = new import_obsidian2.Menu();
    for (const x of STATUSES) {
      menu.addItem((i) => {
        i.setTitle(`\u25CF  ${x.label}`).setChecked(cur === x.id).onClick(() => this.setStatus(file, node.line, title, x.id));
        const t = i.titleEl || (i.dom && i.dom.querySelector(".menu-item-title"));
        if (t) {
          t.empty();
          const d = t.createSpan("pc-status-dot");
          d.style.background = x.color;
          t.appendText(` ${x.label}`);
        }
      });
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Aucun statut").setChecked(!cur).onClick(() => this.setStatus(file, node.line, title, "")));
    menu.showAtMouseEvent(e);
  }
  async setNotesHidden(v) {
    this.settings.notesHidden = v;
    notesHideCfg.hidden = v;
    await this.saveData(this.settings);
    this.refreshHidden();
    for (const leaf of this.app.workspace.getLeavesOfType(NOTES_VIEW)) if (leaf.view instanceof NotesView) leaf.view.draw();
    new import_obsidian2.Notice(v ? "Notes masqu\xE9es dans le texte : elles restent dans le panneau." : "Notes affich\xE9es dans le texte.");
  }
  refreshHidden() {
    this.app.workspace.iterateAllLeaves((l) => {
      var _a;
      const cm = l.view instanceof import_obsidian2.MarkdownView ? (_a = l.view.editor) == null ? void 0 : _a.cm : null;
      if (cm && cm.dispatch) cm.dispatch({ effects: setNotesHidden.of(this.settings.notesHidden) });
    });
  }
  async openNotes(move = false, reveal = true) {
    const ws = this.app.workspace;
    const wanted = this.settings.notesSide === "left" ? ws.leftSplit : ws.rightSplit;
    let leaf = ws.getLeavesOfType(NOTES_VIEW)[0];
    if (leaf && (move || leaf.getRoot() !== wanted)) {
      leaf.detach();
      leaf = void 0;
    }
    if (!leaf) {
      const l = this.settings.notesSide === "left" ? ws.getLeftLeaf(false) : ws.getRightLeaf(false);
      leaf = l != null ? l : ws.getLeaf(true);
      await leaf.setViewState({ type: NOTES_VIEW, active: reveal });
    }
    if (reveal) ws.revealLeaf(leaf);
    return leaf.view instanceof NotesView ? leaf.view : null;
  }
  /** Garde les 30 dernières sections supprimées. */
  async toTrash(item, _whole) {
    this.settings.trash.push(item);
    if (this.settings.trash.length > 30) this.settings.trash.splice(0, this.settings.trash.length - 30);
    await this.saveData(this.settings);
  }
  async restore(t) {
    const f = this.app.vault.getAbstractFileByPath(t.path);
    if (!(f instanceof import_obsidian2.TFile)) {
      await navigator.clipboard.writeText(t.text + "\n");
      new import_obsidian2.Notice("La note d'origine n'existe plus : la section est copi\xE9e, colle-la o\xF9 tu veux.", 8e3);
      return;
    }
    const old = await readText(this.app, f);
    const r = insertBlock(old, t.line, t.text);
    await writeText(this.app, f, old, r.text);
    this.settings.trash = this.settings.trash.filter((x) => x !== t);
    await this.saveData(this.settings);
    new import_obsidian2.Notice(`\xAB ${t.title} \xBB restaur\xE9e.`);
  }
  /** Aligne le plan sur la note Markdown active (sauf s'il est épinglé). */
  syncToActive() {
    const mv = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    const f = mv == null ? void 0 : mv.file;
    if (!f || f.extension !== "md") return;
    this.forViews((pv) => {
      var _a;
      if (!pv.pinned && ((_a = pv.file) == null ? void 0 : _a.path) !== f.path) pv.setFile(f);
    });
  }
  forViews(fn) {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof PlanView) fn(leaf.view);
    }
  }
  async ensurePanel() {
    try {
      const ws = this.app.workspace;
      const l = this.settings.side === "left" ? ws.getLeftLeaf(false) : ws.getRightLeaf(false);
      if (l) await l.setViewState({ type: VIEW_TYPE, active: false });
    } catch (err) {
      console.error("Plan carnet : cr\xE9ation du panneau", err);
    }
  }
  async openView() {
    const ws = this.app.workspace;
    const wanted = this.settings.side === "left" ? ws.leftSplit : ws.rightSplit;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf && leaf.getRoot() !== wanted) {
      leaf.detach();
      leaf = void 0;
    }
    if (!leaf) {
      const l = this.settings.side === "left" ? ws.getLeftLeaf(false) : ws.getRightLeaf(false);
      leaf = l != null ? l : ws.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    ws.revealLeaf(leaf);
    this.syncToActive();
  }
  /** Change le niveau de la ligne du curseur (titre ou texte). */
  lineLevel(editor, next) {
    const line = editor.getCursor().line;
    const m = /^(#{1,6})\s/.exec(editor.getLine(line));
    const cur = m ? m[1].length : 0;
    const target = next(cur);
    if (target === cur) return;
    const old = editor.getValue();
    const out = setLineHeading(old, line, target);
    const mv = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (mv == null ? void 0 : mv.file) writeText(this.app, mv.file, old, out);
    editor.setCursor({ line, ch: editor.getLine(line).length });
  }
  shiftAtCursor(editor, dir) {
    const old = editor.getValue();
    const cur = editor.getCursor();
    const o = parse(old);
    const n = nodeAtLine(o, cur.line);
    if (!n) {
      new import_obsidian2.Notice("Le curseur n'est dans aucune section.");
      return;
    }
    let r;
    try {
      r = shiftSection(old, n.line, dir);
    } catch (err) {
      new import_obsidian2.Notice(err.message);
      return;
    }
    if (!r) return;
    const offsetInSection = cur.line - n.line;
    const mv = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (mv == null ? void 0 : mv.file) writeText(this.app, mv.file, old, r.text);
    const nl = Math.min(r.newLine + offsetInSection, editor.lineCount() - 1);
    editor.setCursor({ line: nl, ch: cur.ch });
    editor.scrollIntoView({ from: { line: nl, ch: 0 }, to: { line: nl, ch: 0 } }, true);
  }
};
