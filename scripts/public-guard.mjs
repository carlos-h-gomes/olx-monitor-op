#!/usr/bin/env node
// public-guard: impede que dado pessoal ou segredo chegue ao repositorio publico.
// Zero dependencias. Uso:
//   node scripts/public-guard.mjs            -> verifica tudo que iria pro repo
//   node scripts/public-guard.mjs --staged   -> verifica so o que esta staged (pre-commit)
// Para liberar uma linha legitima, inclua o comentario: public-guard:allow

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const STAGED = process.argv.includes("--staged");
const MAX_FILE_BYTES = 1_500_000;
const ALLOW_MARK = "public-guard:allow";

// Caminhos que nunca podem ser publicados, mesmo que alguem force no git.
const FORBIDDEN_PATHS = [
  [/(^|\/)\.env(\.|$)(?!example$)/i, "arquivo .env"],
  [/\.(pem|key|crx|xpi|p12|pfx)$/i, "chave/pacote assinado"],
  [/\.(sqlite3?|db)$/i, "banco de dados local"],
  [/\.log$/i, "arquivo de log"],
  [/(^|\/)(browser-profile|data|logs|node_modules)\//i, "pasta de runtime"],
  [/(^|\/)(AGENTS|CLAUDE)\.md$/i, "governanca privada de IA"],
  [/(^|\/)(\.agents|\.claude|docs\/ai|prompt-templates)\//i, "governanca privada de IA"],
  [/(^|\/)\.public-guard\.local$/i, "lista local de termos pessoais"],
  [/(^|\/)config\.ya?ml$/i, "config real (use config.example)"],
];

// Padroes de conteudo. Cada um: [regex, motivo, filtro opcional de falso positivo].
const CONTENT_RULES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
  [/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, "token de bot do Telegram"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "token do GitHub"],
  [/\bAKIA[0-9A-Z]{16}\b/, "chave AWS"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT"],
  [/\b(api[_-]?key|apikey|secret|password|senha|token)\b\s*[:=]\s*["']?[A-Za-z0-9_\-\/+=]{16,}/i, "segredo em texto"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "e-mail",
    (m) => /@(example\.(com|org)|exemplo\.com|users\.noreply\.github\.com)$/i.test(m)],
  [/(?<![\d.])(?:\+?55\s?)?\(?[1-9]{2}\)?\s?9\d{4}[-\s]?\d{4}(?!\d)/, "telefone celular BR"],
  [/\b55[1-9]{2}9\d{8}\b/, "numero de WhatsApp"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, "endereco IP",
    (m) => /^(127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.\d+)$/.test(m) || /^\d+\.\d+\.\d+\.\d+$/.test(m) && m.split(".").some((n) => Number(n) > 255)],
  [/\b[A-Z]:\\(?:Users|Usuarios|Usuários)\\[^\\\s"']+/i, "caminho de usuario do Windows"],
  [/\b[D-Z]:\\[^\s"'<>|]{3,}/, "caminho local de disco"],
  [/\/home\/[a-z_][a-z0-9_-]{1,31}\//, "caminho de usuario Linux"],
  [/ntfy\.sh\/[A-Za-z0-9_-]{6,}/, "topico ntfy real",
    (m) => /ntfy\.sh\/(SEU|seu|exemplo|example|meu-topico|TOPICO)/.test(m)],
];

function loadPersonalTerms() {
  const file = join(ROOT, ".public-guard.local");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((t) => t.toLowerCase());
}

function isGitRepo() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function listFiles() {
  if (isGitRepo()) {
    const cmd = STAGED
      ? "git diff --cached --name-only --diff-filter=ACMR -z"
      : "git ls-files --cached --others --exclude-standard -z";
    return execSync(cmd, { encoding: "utf8" }).split("\0").filter(Boolean);
  }
  // Sem git ainda: varre a pasta pulando o que obviamente nao vai subir.
  const skip = new Set([".git", "node_modules"]);
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(relative(ROOT, full).split(sep).join("/"));
    }
  };
  walk(ROOT);
  return out;
}

function readContent(path) {
  if (STAGED) return execSync(`git show ":${path}"`, { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });
  return readFileSync(join(ROOT, path));
}

const IGNORED_WHEN_NO_GIT = [/^\.public-guard\.local$/];
const self = "scripts/public-guard.mjs";
const personalTerms = loadPersonalTerms();
const problems = [];
const gitMode = isGitRepo();

for (const path of listFiles()) {
  if (!gitMode && IGNORED_WHEN_NO_GIT.some((r) => r.test(path))) continue;

  for (const [re, why] of FORBIDDEN_PATHS) {
    if (re.test(path)) problems.push(`${path}: caminho proibido (${why})`);
  }

  let buf;
  try {
    buf = readContent(path);
  } catch {
    continue;
  }
  if (buf.length > MAX_FILE_BYTES) problems.push(`${path}: arquivo grande demais (${buf.length} bytes)`);
  if (buf.includes(0)) continue; // binario: so as regras de caminho valem

  const lines = buf.toString("utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARK)) return;
    const where = `${path}:${i + 1}`;
    if (path !== self) {
      for (const [re, why, isFalsePositive] of CONTENT_RULES) {
        const m = line.match(re);
        if (m && !(isFalsePositive && isFalsePositive(m[0]))) problems.push(`${where}: ${why} -> ${mask(m[0])}`);
      }
    }
    const lower = line.toLowerCase();
    for (const term of personalTerms) {
      if (lower.includes(term)) problems.push(`${where}: termo pessoal da sua lista local`);
    }
  });
}

function mask(s) {
  return s.length <= 6 ? "***" : `${s.slice(0, 3)}***${s.slice(-2)}`;
}

if (problems.length) {
  console.error(`public-guard: ${problems.length} problema(s) encontrado(s)\n`);
  for (const p of problems) console.error(`  - ${p}`);
  if (!personalTerms.length) console.error("\nAviso: .public-guard.local nao existe, termos pessoais nao foram checados.");
  process.exit(1);
}
console.log(`public-guard: ok${personalTerms.length ? "" : " (aviso: sem .public-guard.local, termos pessoais nao checados)"}`);
