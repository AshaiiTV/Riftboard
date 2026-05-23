import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Crown,
  Download,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Gauge,
  Goal,
  Image as ImageIcon,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
  CalendarDays,
  Target,
  Trash2,
  Trophy,
  UserPlus,
  UserMinus,
  Users,
  Upload,
  Wand2,
  X,
} from "lucide-react";

const API_BASE = "/.netlify/functions";
const NXT5_IMPORTER_WINDOWS_URL = "https://github.com/AshaiiTV/Riftboard/releases/latest/download/NXT5-Importer.exe";
const NXT5_IMPORTER_MAC_URL = "https://github.com/AshaiiTV/Riftboard/releases/latest/download/NXT5-Importer-mac-arm64.zip";

const NAV = [
  { id: "teams", label: "Équipe", icon: Users, shortcut: "T", path: "/equipes" },
  { id: "matches", label: "Intégration", icon: Swords, shortcut: "I", path: "/integration" },
  { id: "stats", label: "Statistiques", icon: BarChart3, shortcut: "S", path: "/statistiques" },
  { id: "champions", label: "Champion Pool", icon: Crown, shortcut: "C", path: "/champion-pool" },
  { id: "planning", label: "Planning", icon: CalendarDays, shortcut: "L", path: "/planning" },
  { id: "compositions", label: "Compos Types", icon: Sparkles, shortcut: "V", path: "/compositions-types" },
  { id: "reports", label: "Rapports", icon: FileText, shortcut: "R", path: "/rapports" },
  { id: "team-management", label: "Gestion équipe", icon: Settings, shortcut: "G", path: "/gestion-equipe", hidden: true },
  { id: "settings", label: "Paramètres", icon: Settings, shortcut: "P", path: "/parametres" },
];

const AUTH_ROUTES = {
  "/connexion": "login",
  "/creer-un-compte": "register",
  "/inscription": "register",
};

const PUBLIC_ROUTES = ["/", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/mentions-legales", "/confidentialite", "/conditions"];
const AUTH_PATHS = Object.keys(AUTH_ROUTES);
const REMEMBER_ME_STORAGE_KEY = "nxt5_remember_me";
const PLANNING_DAYS = [
  ["MON", "Lun"],
  ["TUE", "Mar"],
  ["WED", "Mer"],
  ["THU", "Jeu"],
  ["FRI", "Ven"],
  ["SAT", "Sam"],
  ["SUN", "Dim"],
];
const PLANNING_TIMES = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

function normalizePath(pathname = "/") {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function pageFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/codes-tournoi") return "matches";
  if (path === "/reviews") return "matches";
  return NAV.find((item) => item.path === path)?.id || "teams";
}

function pathFromPage(pageId) {
  return NAV.find((item) => item.id === pageId)?.path || "/equipes";
}

function authModeFromPath(pathname = window.location.pathname) {
  return AUTH_ROUTES[normalizePath(pathname)] || null;
}

function isAppPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  return NAV.some((item) => item.path === path);
}

function isKnownPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  return PUBLIC_ROUTES.includes(path) || AUTH_PATHS.includes(path) || isAppPath(path);
}

function isSafeInternalPath(path = "") {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function buildLoginRedirect(path, search = "") {
  const target = `${path}${search || ""}`;
  return `/connexion?next=${encodeURIComponent(target)}`;
}

function readRoute() {
  return { path: normalizePath(window.location.pathname), search: window.location.search };
}

const DEFAULT_DATA = {
  teams: [],
  teamMembers: [],
  players: [],
  availability: [],
  matches: [],
  championPool: [],
  compositions: [],
  improvements: [],
  reports: [],
  tournamentCodes: [],
  inviteCodes: [],
};

async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error("Impossible de joindre NXT5 pour le moment. Réessaie dans quelques instants.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fallback = response.status === 502 || response.status === 503
      ?"Service temporairement indisponible. Réessaie quand le site est prêt."
      : `Erreur ${response.status}.`;
    const error = new Error(payload?.error || fallback);
    error.status = response.status;
    error.code = payload?.code || null;
    error.retryAfter = payload?.retryAfter || null;
    error.riotStatus = payload?.riotStatus || null;
    error.missing = payload?.missing || null;
    error.details = payload?.details || null;
    throw error;
  }

  return payload;
}

function formatRetryAfter(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return "quelques instants";
  if (value < 60) return `${Math.ceil(value)} seconde${value > 1 ? "s" : ""}`;
  const minutes = Math.ceil(value / 60);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

function errorDetailsLine(err) {
  const details = Array.isArray(err?.details) ? err.details.filter(Boolean) : [];
  if (!details.length) return "";
  const clean = details
    .map((detail) => String(detail).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 2);
  return clean.length ? ` Détail Riot: ${clean.join(" | ")}` : "";
}

function preciseErrorText(err, context = "generic") {
  const message = String(err?.message || "").trim();
  const code = err?.code;
  const missing = Array.isArray(err?.missing) ? err.missing.join(", ") : "";
  const status = Number(err?.status || 0);

  if (code === "RIOT_KEY_MISSING") return "RIOT_API_KEY manque dans Netlify. Ajoute la variable dans Site configuration > Environment variables, puis redeploy le site.";
  if (code === "RIOT_KEY_REJECTED") return `La clé Riot est refusée${err?.riotStatus ? ` (Riot ${err.riotStatus})` : ""}. Remplace RIOT_API_KEY par une clé valide, vérifie qu’elle n’est pas expirée, puis redeploy.`;
  if (code === "RIOT_RATE_LIMIT") return `Riot bloque temporairement les requêtes. Réessaie dans ${formatRetryAfter(err?.retryAfter)}; si ça revient souvent, attends avant de relancer toute la team.`;
  if (code === "RIOT_TOURNAMENT_NOT_CONFIGURED") return `La génération Riot n’est pas configurée. À vérifier dans Netlify: ${missing || "RIOT_API_KEY, RIOT_TOURNAMENT_ID ou RIOT_TOURNAMENT_CALLBACK_URL"}.`;
  if (code === "RIOT_TOURNAMENT_ACCESS_MISSING") return `La clé Riot peut lire certains matchs, mais pas ce code tournoi. Il faut l’accès Tournament API / Match by tournament code sur la clé, ou importer avec le Game ID Riot si tu l’as.${errorDetailsLine(err)}`;
  if (code === "RIOT_TOURNAMENT_MATCH_NOT_FOUND") return `Aucune game terminée trouvée pour ce code tournoi. Vérifie le serveur sélectionné, que la partie est finie, et que le code exact a bien été utilisé pour cette game.${errorDetailsLine(err)}`;
  if (code === "RIOT_API_ERROR") return `Riot renvoie une erreur API${err?.riotStatus ? ` ${err.riotStatus}` : ""}. Vérifie la région, la clé et réessaie après quelques minutes. Message brut: ${message || "non fourni"}`;
  if (code === "NXT5_IMPORT_FILE_INVALID") return `${message} Génère le fichier avec l’outil NXT5 local, ou importe un JSON Match-V5 complet contenant info.participants et info.teams.`;

  if (/Format Game ID invalide/i.test(message)) return "Format Game ID invalide. Mets un ID du type EUW1_7123456789. Si tu colles un code tournoi, choisis le serveur dans le menu et colle uniquement le code.";
  if (/Game ID ou code tournoi requis/i.test(message)) return "Colle soit un Game ID Riot, soit un code tournoi avant d’importer.";
  if (/Team ID requis|Team introuvable/i.test(message)) return "Aucune équipe active n’est reliée à cet import. Sélectionne ou crée une équipe, puis réessaie.";
  if (/roster avant d.importer/i.test(message)) return "Ajoute au moins un profil joueur dans la page Équipe avant d’importer une game.";
  if (/Aucun joueur du roster/i.test(message)) return "La game a été trouvée, mais aucun participant ne correspond au roster. Corrige les Riot IDs des profils dans Équipe, puis relance l’import.";
  if (/Code tournoi requis/i.test(message)) return "Le code tournoi est vide. Colle le code complet généré par Riot ou reçu pour le tournoi.";
  if (/Nom du code requis/i.test(message)) return "Donne un nom au code tournoi avant de l’enregistrer, par exemple Scrim vs Vitality ou Round 1.";

  if (context === "match-import" && status === 404) return "Riot ne trouve pas cette game. Vérifie le Game ID, la région du préfixe (EUW1, NA1, KR...) ou attends quelques minutes après la fin de la partie.";
  if (context === "match-import" && status === 403) return "Ton compte n’a pas accès à cette équipe pour importer une game. Vérifie que tu es bien membre de la team.";
  if (context === "tournament-code" && status === 403) return "Tu n’as pas les droits pour gérer les codes tournoi. Seuls l’owner, un capitaine ou un coach peuvent le faire.";
  if (status === 502 || status === 503) return `${message || "Service temporairement indisponible."} Vérifie les variables Netlify et redeploy si tu viens de les modifier.`;

  return message || "Erreur inconnue. Réessaie, puis vérifie les variables Netlify si le problème revient.";
}

function errorToast(err, title, context) {
  return { type: "red", title, text: preciseErrorText(err, context) };
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function readRememberPreference() {
  try {
    return window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeRememberPreference(value) {
  try {
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, value ? "true" : "false");
  } catch {}
}

function tone(t) {
  return {
    slate: "border-slate-200/16 bg-white/[0.055] text-slate-100",
    cyan: "border-cyan-200/45 bg-cyan-300/14 text-cyan-50 shadow-cyan-400/24",
    purple: "border-violet-200/40 bg-violet-400/14 text-violet-50 shadow-violet-400/20",
    pink: "border-fuchsia-200/42 bg-fuchsia-400/14 text-fuchsia-50 shadow-fuchsia-400/22",
    orange: "border-fuchsia-200/42 bg-fuchsia-400/14 text-fuchsia-50 shadow-fuchsia-400/22",
    green: "border-emerald-200/32 bg-emerald-400/12 text-emerald-50 shadow-emerald-400/16",
    yellow: "border-amber-200/40 bg-amber-300/14 text-amber-50 shadow-amber-400/18",
    red: "border-rose-200/35 bg-rose-400/12 text-rose-50 shadow-rose-400/16",
    blue: "border-sky-200/38 bg-sky-400/14 text-sky-50 shadow-sky-400/18",
  }[t || "slate"];
}

function gradeTone(grade) {
  return grade === "S" ?"green" : grade === "A" ?"cyan" : grade === "B" ?"purple" : grade === "C" ?"yellow" : grade === "D" ?"red" : "slate";
}

function profileStatusLabel(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "owner") return "Owner";
  if (role === "captain") return "Capitaine";
  if (role === "coach") return "Coach";
  return "Joueur";
}

function profileStatusTone(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "owner") return "green";
  if (role === "captain") return "yellow";
  if (role === "coach") return "purple";
  return "blue";
}

function Badge({ children, tone: t = "slate", pulse = false }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] shadow-[0_0_18px_rgba(255,255,255,.06)]", tone(t))}>
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />}
      {children}
    </span>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#020511]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,216,255,.22),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(217,0,255,.18),transparent_31%),linear-gradient(118deg,rgba(16,76,190,.20)_0%,transparent_24%,transparent_66%,rgba(0,238,255,.14)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:58px_58px] opacity-[0.20]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(123deg,transparent_0,transparent_142px,rgba(0,216,255,.13)_143px,transparent_146px),repeating-linear-gradient(123deg,transparent_0,transparent_226px,rgba(217,0,255,.12)_227px,transparent_230px)]" />
      <div className="absolute left-[8%] top-[14%] h-[42rem] w-[42rem] rounded-full border border-cyan-300/10 shadow-[0_0_90px_rgba(0,216,255,.12)]" />
      <div className="absolute right-[10%] top-[12%] h-[31rem] w-[31rem] rounded-full border border-fuchsia-300/10 shadow-[0_0_90px_rgba(217,0,255,.10)]" />
      <motion.div animate={{ x: ["-14%", "118%"] }} transition={{ duration: 7.2, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }} className="absolute top-[17%] h-px w-[42vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-cyan-100 to-transparent shadow-[0_0_34px_rgba(34,211,238,.82)]" />
      <motion.div animate={{ x: ["118%", "-18%"] }} transition={{ duration: 8.6, repeat: Infinity, repeatDelay: 3.6, ease: "easeInOut" }} className="absolute top-[61%] h-px w-[48vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-fuchsia-100 to-transparent shadow-[0_0_34px_rgba(217,70,239,.76)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(2,5,17,.08)_42%,rgba(2,5,17,.94)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/80 to-fuchsia-100/70" />
    </div>
  );
}

function Surface({ children, className = "", delay = 0, glow = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.34, delay, ease: "easeOut" }}
      className={cx(
        "nxt5-panel nxt5-hud-lines group relative overflow-hidden border border-cyan-200/16 bg-[#060a18]/84 p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,.10),transparent_31%,transparent_72%,rgba(0,216,255,.09))] before:opacity-90",
        glow && "after:pointer-events-none after:absolute after:-inset-px after:bg-gradient-to-r after:from-cyan-200/36 after:via-fuchsia-300/22 after:to-blue-300/28 after:opacity-0 after:blur-xl after:transition after:duration-500 group-hover:after:opacity-100",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function Button({ children, icon: Icon, variant = "primary", className = "", disabled = false, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition duration-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "border border-cyan-100/30 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(34,211,238,.30)] hover:-translate-y-0.5 hover:saturate-150 hover:shadow-[0_0_42px_rgba(217,70,239,.25)]",
    ghost: "border border-cyan-100/14 bg-white/[0.045] text-slate-100 hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.10] hover:text-white",
    danger: "border border-rose-300/25 bg-rose-500/10 text-rose-100 hover:-translate-y-0.5 hover:bg-rose-500/15",
  };
  return (
    <button disabled={disabled} className={cx(base, variants[variant], className)} {...props}>
      {Icon && <Icon className={cx("h-4 w-4", Icon === Loader2 && "animate-spin")} />}
      {children}
    </button>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text", required = false, icon: Icon, disabled = false }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && passwordVisible ? "text" : type;
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/75" />}
        <input type={inputType} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} disabled={disabled} className={cx("w-full rounded-xl border border-cyan-100/12 bg-black/[0.26] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/60 focus:bg-black/[0.32] focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60", Icon && "pl-10", isPassword && "pr-12")} />
        {isPassword && <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} disabled={disabled} aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-2.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
      </div>
    </label>
  );
}

function TextAreaInput({ label, value, onChange, placeholder, icon: Icon, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-cyan-200/75" />}
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className={cx("w-full resize-none rounded-xl border border-cyan-100/12 bg-black/[0.26] px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/60 focus:bg-black/[0.32] focus:ring-4 focus:ring-cyan-300/10", Icon && "pl-10")} />
      </div>
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
      <div className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-cyan-100/12 bg-black/[0.26] px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </div>
    </label>
  );
}

function PremiumToggle({ checked, onChange, title, text }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cx("group flex w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition", checked ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-black/[0.18] hover:border-cyan-300/20 hover:bg-white/[0.045]")}>
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{title}</span>
        {text && <span className="mt-1 block text-xs font-semibold leading-5 text-slate-400">{text}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full border transition", checked ? "border-cyan-200/45 bg-gradient-to-r from-cyan-400 to-fuchsia-500 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-white/10 bg-white/[0.08]")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2"><span className="h-px w-8 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-transparent" /><p className="text-[0.7rem] font-black uppercase tracking-[0.32em] text-cyan-100/85">{eyebrow}</p></div>
        <h2 className="nxt5-metal-text max-w-4xl py-1 text-3xl font-black leading-[1.14] tracking-tight md:text-5xl">{title}</h2>
        {subtitle && <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-slate-300">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function ToastStack({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-5 right-5 z-[80] space-y-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} className={cx("w-[min(92vw,380px)] rounded-3xl border p-4 shadow-2xl backdrop-blur-xl", tone(toast.type || "cyan"))}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-white/10 p-2">{toast.type === "red" ?<AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-black">{toast.title}</p>{toast.text && <p className="mt-1 whitespace-pre-line text-sm leading-5 opacity-80">{toast.text}</p>}</div>
              <button onClick={() => removeToast(toast.id)} className="rounded-xl p-1.5 opacity-70 hover:bg-white/10 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon: Icon = BarChart3, title, text, action }) {
  return (
    <div className="relative flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.025] p-8 text-center">
      <div className="absolute inset-0 bg-[linear-gradient(126deg,rgba(34,211,238,.10),transparent_38%,rgba(249,115,22,.06))]" />
      <div className="relative rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4 text-cyan-100 shadow-2xl shadow-cyan-950/20"><Icon className="h-8 w-8" /></div>
      <h3 className="relative mt-4 text-xl font-black text-white">{title}</h3>
      <p className="relative mt-2 max-w-xl text-sm leading-6 text-slate-400">{text}</p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone: t = "purple", delay = 0 }) {
  return (
    <Surface glow delay={delay} className="min-h-[155px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 truncate text-3xl font-black text-white md:text-4xl">{value ?? "-"}</p><p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{hint ?? "En attente de données"}</p></div>
        <div className={cx("rounded-[1.25rem] border p-3 shadow-lg", tone(t))}><Icon className="h-6 w-6" /></div>
      </div>
    </Surface>
  );
}

function SkeletonRows({ count = 4 }) {
  return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}</div>;
}


function BrandLogo({ compact = false, className = "" }) {
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <img
        src="/assets/nxt5-logo.png"
        alt="NXT5"
        className={cx(
          "object-contain drop-shadow-[0_0_30px_rgba(34,211,238,.36)]",
          compact ?"h-12 w-28 object-left" : "h-16 w-auto max-w-[220px] sm:max-w-[300px]"
        )}
      />
    </div>
  );
}

function MarketingPreview() {
  const metrics = [
    ["Winrate", "—", "Calculé après import"],
    ["KDA moyen", "—", "Calculé après import"],
    ["CS / min", "—", "Calculé après import"],
    ["Objectifs", "—", "Calculé après import"],
  ];
  const pool = ["Pick principal", "Pick secondaire", "Pick situationnel", "Pick à tester", "Pick à revoir"];
  const axes = ["Vision", "Gestion des objectifs", "Début de partie", "Teamfights mid/late"];

  return (
    <motion.div initial={{ opacity: 0, x: 28, rotateY: -9 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 0.75, delay: 0.1 }} className="relative hidden lg:block">
      <div className="absolute -inset-6 rounded-[1.6rem] bg-gradient-to-r from-cyan-400/34 via-blue-500/18 to-fuchsia-500/30 blur-2xl" />
      <div className="nxt5-panel relative overflow-hidden border border-cyan-200/25 bg-[#060a18]/92 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[linear-gradient(124deg,rgba(0,216,255,.16),transparent_28%,transparent_67%,rgba(217,0,255,.14)),repeating-linear-gradient(124deg,transparent_0,transparent_88px,rgba(255,255,255,.05)_89px,transparent_91px)]" />
        <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <BrandLogo compact />
          <p className="text-sm font-black text-white">Aperçu du tableau de bord</p>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-400">Données à importer</div>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m[0]} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold text-slate-500">{m[0]}</p>
              <p className="mt-3 text-2xl font-black text-white">{m[1]}</p>
              <p className="mt-1 text-xs font-black text-cyan-100/75">{m[2]}</p>
            </div>
          ))}
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-[.95fr_1.05fr] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Champion Pool</p>
            <p className="text-xs text-slate-500">Classement réel après plusieurs imports</p>
            <div className="mt-4 space-y-3">
              {pool.map((label, i) => (
                <div key={label} className="grid grid-cols-[42px_1fr_84px] items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/25 bg-gradient-to-br from-cyan-400/35 to-fuchsia-500/25 text-xs font-black text-white">{i + 1}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div animate={{ opacity: [0.45, 0.9, 0.45] }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.12 }} className="h-full rounded-full bg-gradient-to-r from-cyan-300/60 via-blue-300/45 to-fuchsia-300/45" style={{ width: `${76 - i * 9}%` }} />
                  </div>
                  <p className="text-xs font-black text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Axes de travail</p>
            <p className="text-xs text-slate-500">Aucune priorité inventée : tout vient des games importées</p>
            <div className="mt-4 space-y-3">
              {axes.map((a) => <div key={a} className="flex items-center justify-between gap-3 rounded-2xl bg-black/[0.18] px-3 py-2"><span className="min-w-0 text-sm font-bold text-slate-300">{a}</span><Badge tone="slate">À calculer</Badge></div>)}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-[.82fr_1.18fr] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Dernière review</p>
            <p className="mt-3 text-sm text-slate-400">Aucune review pour l’instant</p>
            <p className="text-xs text-slate-500">Elle apparaîtra ici après import</p>
            <button className="mt-4 cursor-not-allowed rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-500">En attente de données</button>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Performance d’équipe</p>
            <p className="mt-1 text-xs font-black text-cyan-100/75">Données réelles uniquement</p>
            <svg viewBox="0 0 320 120" className="mt-5 h-28 w-full"><defs><linearGradient id="line" x1="0" x2="1"><stop stopColor="#22d3ee"/><stop offset=".52" stopColor="#60a5fa"/><stop offset="1" stopColor="#e879f9"/></linearGradient></defs><path d="M0 90 C35 35 55 86 92 55 S145 46 176 38 S235 68 260 42 S292 58 320 25" fill="none" stroke="url(#line)" strokeWidth="6" strokeLinecap="round" opacity=".4"/><path d="M0 90 C35 35 55 86 92 55 S145 46 176 38 S235 68 260 42 S292 58 320 25 L320 120 L0 120Z" fill="url(#line)" opacity=".1"/></svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatStrip() {
  const stats = [
    [Crown, "Champion Pool", "Picks forts et picks pièges", "cyan"],
    [Swords, "Games importées", "KDA, dégâts, vision, objectifs", "purple"],
    [Target, "Axes de progrès", "Ce qu’il faut travailler", "green"],
    [Eye, "Vision & setup", "Avant dragons et Nashor", "blue"],
    [Flame, "Progression", "Game après game", "yellow"],
  ];
  return (
    <div className="grid gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 md:grid-cols-5">
      {stats.map(([Icon, value, label, t]) => <div key={value} className="flex items-center gap-3 border-white/10 p-3 md:[&:not(:last-child)]:border-r"><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-sm font-black text-white">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div></div>)}
    </div>
  );
}

function LinkButton({ href, children, icon: Icon, variant = "primary", className = "", navigate }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition duration-200 active:translate-y-0";
  const variants = {
    primary: "border border-cyan-100/30 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(34,211,238,.30)] hover:-translate-y-0.5 hover:saturate-150 hover:shadow-[0_0_42px_rgba(217,70,239,.25)]",
    ghost: "border border-white/14 bg-white/[0.055] text-slate-100 hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-300/[0.10]",
  };

  function go(event) {
    if (!navigate || !isSafeInternalPath(href)) return;
    event.preventDefault();
    navigate(href);
  }

  return <a href={href} onClick={go} className={cx(base, variants[variant], className)}>{Icon && <Icon className="h-4 w-4" />}{children}</a>;
}

function SiteHeader({ children, navigate }) {
  function goHome(event) {
    if (!navigate) return;
    event.preventDefault();
    navigate("/");
  }

  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6">
      <a href="/" onClick={goHome} aria-label="Accueil NXT5" className="transition hover:opacity-90"><BrandLogo /></a>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </header>
  );
}

function LegalLinks({ navigate }) {
  const links = [
    ["/mentions-legales", "Mentions légales"],
    ["/confidentialite", "Confidentialité"],
    ["/conditions", "Conditions"],
  ];
  return <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-8 text-xs font-bold text-slate-500">{links.map(([href, label]) => <LinkButton key={href} href={href} navigate={navigate} variant="ghost" className="rounded-xl border-transparent bg-transparent px-0 py-0 text-xs text-slate-400 shadow-none hover:translate-y-0 hover:border-transparent hover:bg-transparent hover:text-cyan-100">{label}</LinkButton>)}<span className="text-slate-600">NXT5 n’est pas affilié à Riot Games.</span></footer>;
}

const LEGAL_PAGES = {
  "/mentions-legales": {
    eyebrow: "Cadre légal",
    title: "Mentions légales",
    intro: "NXT5 est un outil indépendant de gestion et d’analyse League of Legends pour équipes, coachs et capitaines.",
    sections: [
      ["Éditeur", "NXT5 est édité par AshaiiTV dans le cadre d’un projet web privé destiné aux équipes League of Legends. Pour toute demande liée au projet, utilise le contact indiqué sur le produit Riot Developer ou le dépôt GitHub du projet."],
      ["Hébergement", "Le site est hébergé sur Netlify. Les données applicatives sont stockées dans une base PostgreSQL Neon. Les clés Riot et les secrets applicatifs sont conservés uniquement côté serveur via les variables d’environnement Netlify."],
      ["Riot Games", "NXT5 n’est pas approuvé, sponsorisé ou affilié à Riot Games. League of Legends et Riot Games sont des marques ou marques déposées de Riot Games, Inc. Les données Riot sont utilisées conformément aux règles du Riot Developer Portal."],
      ["Responsabilité", "NXT5 fournit des outils de lecture et d’organisation. Les décisions sportives, analyses de coach, choix de draft et interprétations restent sous la responsabilité des utilisateurs."],
    ],
  },
  "/confidentialite": {
    eyebrow: "Données",
    title: "Politique de confidentialité",
    intro: "Cette page explique quelles données NXT5 traite et pourquoi. L’objectif est de garder l’outil utile sans exposer inutilement les comptes ou les clés API.",
    sections: [
      ["Données de compte", "NXT5 stocke un e-mail de récupération, un pseudo, un mot de passe haché, les sessions de connexion et les informations nécessaires au fonctionnement du compte."],
      ["Données d’équipe", "L’application peut stocker les équipes, rôles, profils joueurs, Riot IDs, liens OP.GG, champion pools, compositions types, rapports de review, codes tournoi et matchs importés."],
      ["Données Riot", "Les appels Riot sont effectués côté serveur. La clé API Riot n’est jamais envoyée au navigateur. Les données de match importées servent uniquement à afficher des statistiques et à lier des reviews."],
      ["Cookies et session", "NXT5 utilise un cookie HttpOnly pour maintenir la session de connexion. Ce cookie sert à l’authentification et n’est pas destiné au suivi publicitaire."],
      ["Conservation", "Les données restent conservées tant que l’équipe ou le compte les utilise. Les profils joueurs, rapports et codes tournoi peuvent être supprimés depuis l’interface quand les droits le permettent."],
    ],
  },
  "/conditions": {
    eyebrow: "Utilisation",
    title: "Conditions d’utilisation",
    intro: "NXT5 est conçu pour aider les équipes à préparer, relire et organiser leurs matchs de manière propre et sécurisée.",
    sections: [
      ["Usage autorisé", "L’outil doit être utilisé pour des équipes, scrims, reviews, champion pools, compositions types et rapports liés à League of Legends."],
      ["Codes tournoi", "La génération ou l’ajout de codes tournoi est réservée aux membres autorisés de l’équipe, notamment owner, capitaine ou coach. Les codes doivent être créés uniquement pour des matchs réels et raisonnables."],
      ["Sécurité", "Il est interdit de partager des clés Riot, de contourner les droits d’équipe, d’extraire massivement des données ou d’utiliser NXT5 pour harceler, surveiller ou cibler des joueurs."],
      ["Contenu utilisateur", "Les rapports et notes de review sont écrits par les utilisateurs. Chaque équipe reste responsable du contenu qu’elle crée, modifie ou supprime."],
      ["Disponibilité", "NXT5 dépend de services externes comme Riot API, Netlify et Neon. Certaines fonctionnalités peuvent être indisponibles si ces services changent, expirent ou refusent une requête."],
    ],
  },
};

function LegalPage({ route, navigate }) {
  const page = LEGAL_PAGES[route.path] || LEGAL_PAGES["/mentions-legales"];
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-12 pt-6">
        <Surface glow className="p-6 md:p-9">
          <Badge tone="orange">{page.eyebrow}</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">{page.title}</h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-slate-200">{page.intro}</p>
          <div className="mt-8 grid gap-4">
            {page.sections.map(([title, text]) => <section key={title} className="rounded-2xl border border-white/12 bg-black/[0.24] p-5 md:p-6"><h2 className="text-2xl font-black text-white">{title}</h2><p className="mt-3 text-base font-semibold leading-8 text-slate-200">{text}</p></section>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function HomeScreen({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(0,216,255,.18),transparent_24%,transparent_70%,rgba(217,0,255,.14)),linear-gradient(180deg,transparent_0%,rgba(2,5,17,.42)_78%)]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate} className="px-3 py-2.5 sm:px-4">Créer un compte</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-16">
        <section className="grid min-h-[calc(100vh-104px)] items-center gap-10 py-8 lg:grid-cols-[.88fr_1.12fr] lg:py-10">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
            <img src="/assets/nxt5-logo.png" alt="NXT5" className="mb-6 h-auto w-full max-w-[520px] object-contain object-left drop-shadow-[0_0_42px_rgba(34,211,238,.30)]" />
            <Badge tone="cyan" pulse>Team tools for the next five</Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl">
              Passe ton <span className="bg-gradient-to-r from-cyan-100 via-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_26px_rgba(34,211,238,.32)]">cinq</span> au <span className="bg-gradient-to-r from-white via-cyan-200 to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(217,70,239,.24)]">niveau suivant</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">NXT5 centralise reviews, Champion Pools, Compos Types et rapports pour que ta team prépare mieux le prochain scrim.</p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <LinkButton href="/creer-un-compte" navigate={navigate} icon={ChevronRight} className="px-6 py-4 sm:px-7">Créer un compte</LinkButton>
            </div>
          </motion.div>
          <MarketingPreview />
        </section>

        <section id="features" className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Crown, title: "Champion Pool lisible", text: "Repère les picks fiables, les picks de confort et les champions à remettre au travail sans transformer le pool en tableau de stats.", t: "cyan" },
            { icon: Swords, title: "Apprendre après chaque game", text: "Lis chaque match avec champions, KDA, dégâts, gold, vision, objectifs et erreurs à comprendre.", t: "purple" },
            { icon: Target, title: "Préparation compétition", text: "Prépare scrims, tournois et matchs officiels avec des priorités concrètes : vision, morts isolées, dragons, Nashor, side lanes.", t: "green" },
          ].map((item, i) => { const Icon = item.icon; return <Surface key={item.title} delay={i * .06} glow><div className={cx("mb-5 inline-flex rounded-2xl border p-4", tone(item.t))}><Icon className="h-7 w-7" /></div><h3 className="text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-base font-medium leading-7 text-slate-300">{item.text}</p></Surface>; })}
        </section>

        <section id="analytics" className="mt-14 rounded-[1.35rem] border border-white/14 bg-[#060a18]/70 p-6 shadow-2xl shadow-black/25 md:p-9">
          <div className="mb-8 text-center"><h2 className="text-3xl font-black text-white md:text-4xl">Du match à la review</h2><p className="mt-3 text-base font-semibold text-slate-300">NXT5 met les données au clair pour que joueurs, coachs et capitaines fassent leur propre lecture.</p></div>
          <div className="grid gap-5 md:grid-cols-4">
            {[["1", Swords, "Importe la game", "Le match devient une fiche lisible avec champions, side, patch et objectifs."], ["2", Eye, "Lis les signaux", "Vision, dégâts, gold, KDA, KP et morts exposées ressortent sans fouiller."], ["3", Crown, "Trie les picks", "Le Champion Pool révèle les picks fiables, situationnels et dangereux."], ["4", Target, "Prépare le prochain match", "La review finit sur une priorité claire pour progresser en tournoi, scrim ou entraînement."]].map(([n, Icon, title, text]) => <div key={n} className="nxt5-panel relative border border-cyan-100/12 bg-black/[0.22] p-6"><Badge tone={n === "1" ?"cyan" : "purple"}>{n}</Badge><div className="mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Icon className="h-7 w-7" /></div><h3 className="mt-5 text-xl font-black text-white">{title}</h3><p className="mt-2 text-base font-medium leading-7 text-slate-300">{text}</p></div>)}
          </div>
          <div className="mt-8 flex justify-center"><LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight} className="px-7 py-4">Créer l’espace équipe</LinkButton></div>
        </section>

        <section className="mt-10"><StatStrip /></section>

        <section className="mt-14">
          <Surface>
            <h2 className="text-3xl font-black text-white">Pensé pour les reviews qui changent quelque chose</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {["Identifier les picks fiables et les picks pièges.", "Voir rapidement les erreurs récurrentes d’équipe.", "Générer un rapport exploitable par le staff.", "Préparer la prochaine session avec des priorités claires."].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Check className="h-5 w-5 text-emerald-300" /><span className="font-bold text-slate-300">{item}</span></div>)}
            </div>
          </Surface>
        </section>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function NotFoundPage({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center justify-center px-5 pb-16 text-center">
        <Surface glow className="w-full">
          <Badge tone="red">404</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">Page introuvable</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-300">Cette URL ne correspond à aucune page NXT5. Reviens à l’accueil ou connecte-toi pour accéder à ton espace.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function ForgotPasswordPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("auth-request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
      setMessage("Si cet e-mail correspond à un compte NXT5, un lien de réinitialisation vient d’être envoyé. Il expire dans 30 minutes.");
      setEmail("");
    } catch (err) {
      if (err?.code === "EMAIL_NOT_CONFIGURED") {
        setError("L’envoi d’e-mail n’est pas encore configuré sur Netlify. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM.");
      } else {
        setError(err.message || "Demande impossible.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(217,70,239,.14),transparent_28%,transparent_67%,rgba(34,211,238,.12))]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center px-5 pb-16">
        <Surface glow className="mx-auto w-full max-w-2xl">
          <Badge tone="yellow">Sécurité du compte</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Mot de passe oublié</h1>
          <p className="mt-5 text-base font-semibold leading-8 text-slate-200">Entre l’e-mail de ton compte. NXT5 t’envoie un lien temporaire pour choisir un nouveau mot de passe.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextInput label="E-mail du compte" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
            {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">{message}</div>}
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading || !email.trim()} icon={loading ?Loader2 : Mail} className="w-full py-4">{loading ?"Envoi..." : "Envoyer le lien"}</Button>
          </form>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            <LinkButton href="/creer-un-compte" navigate={navigate} variant="ghost" icon={UserPlus}>Créer un compte</LinkButton>
          </div>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function ResetPasswordPage({ navigate }) {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [form, setForm] = useState({ nextPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.nextPassword !== form.confirmPassword) {
      setError("La confirmation ne correspond pas.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("auth-reset-password", { method: "POST", body: JSON.stringify({ token, nextPassword: form.nextPassword }) });
      setDone(true);
      setForm({ nextPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message || "Réinitialisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Connexion</LinkButton>
      </SiteHeader>
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-108px)] max-w-4xl items-center px-5 pb-16">
        <Surface glow className="mx-auto w-full max-w-2xl">
          <Badge tone="green">Nouveau mot de passe</Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Réinitialiser le mot de passe</h1>
          {!token ? (
            <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm font-bold text-rose-100">Lien invalide : aucun token de réinitialisation.</div>
          ) : done ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">Mot de passe mis à jour. Tu peux te reconnecter.</div>
              <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Retour connexion</LinkButton>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <TextInput label="Nouveau mot de passe" value={form.nextPassword} onChange={(nextPassword) => setForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} />
              <TextInput label="Confirmer" value={form.confirmPassword} onChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} />
              {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
              <Button type="submit" disabled={loading || !form.nextPassword || !form.confirmPassword} icon={loading ?Loader2 : Shield} className="w-full py-4">{loading ?"Mise à jour..." : "Changer le mot de passe"}</Button>
            </form>
          )}
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function AuthPage({ mode, onAuth, pushToast, navigate }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ email: "", displayName: "", password: "" });
  const [rememberMe, setRememberMe] = useState(readRememberPreference);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const querySuffix = window.location.search || "";

  function patch(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ?"auth-register" : "auth-login";
      const body = { accountName: form.email, email: form.email, displayName: form.displayName, password: form.password, rememberMe };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      writeRememberPreference(rememberMe);
      pushToast({ type: "green", title: isRegister ?"Compte créé" : "Connexion réussie", text: "Bienvenue sur NXT5." });
      const params = new URLSearchParams(window.location.search);
      const hasInvite = params.has("invite");
      const next = params.get("next");
      const destination = hasInvite
        ?`/equipes?invite=${encodeURIComponent(params.get("invite"))}`
        : isSafeInternalPath(next)
          ?next
          : isRegister
            ?"/equipes?create=1"
            : "/equipes";
      navigate(destination, { replace: true });
      onAuth(result.user);
    } catch (err) {
      if (err?.code === "DB_NOT_CONFIGURED") {
        setError("La création de compte n’est pas encore active. Le site doit être terminé côté déploiement.");
      } else {
        setError(err.message || (isRegister ?"Inscription impossible." : "Connexion impossible."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(217,70,239,.14),transparent_28%,transparent_67%,rgba(34,211,238,.12))]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} variant="ghost" className="hidden md:inline-flex">
          {isRegister ?"J’ai déjà un compte" : "Créer un compte"}
        </LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-108px)] max-w-7xl items-center gap-8 px-5 pb-16 lg:grid-cols-[.85fr_1.15fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
          <Badge tone={isRegister ?"purple" : "cyan"} pulse>{isRegister ?"Création de compte" : "Connexion"}</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] md:text-7xl">
            {isRegister ?"Crée ton espace NXT5." : "Retourne dans ton espace NXT5."}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">
            {isRegister
              ?"Ajoute ton e-mail, choisis ton pseudo, puis lance ton espace équipe."
              : "Connecte-toi pour retrouver tes teams, tes imports, tes rapports et tes réglages."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[[BarChart3, "Profil de jeu"], [Shield, "Draft & rôles"], [Users, "Progression team" ]].map(([Icon, label], index) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon className={cx("h-5 w-5", index === 0 ? "text-cyan-200" : "text-cyan-200")} /><p className="mt-3 text-sm font-black text-white">{label}</p></div>)}
          </div>
        </motion.div>

        <Surface glow className="mx-auto w-full max-w-xl">
          <h2 className="text-3xl font-black text-white">{isRegister ?"Créer un compte" : "Connexion"}</h2>
          <p className="mt-2 text-base font-medium text-slate-300">{isRegister ?"Ton e-mail sert à te connecter et à récupérer ton compte." : "Entre ton e-mail et ton mot de passe pour accéder au tableau de bord."}</p>
          <div className="mt-5 flex rounded-2xl border border-white/10 bg-black/[0.18] p-1">
            <a href={`/connexion${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", !isRegister ?"bg-white/10 text-white" : "text-slate-300 hover:text-white")}>Connexion</a>
            <a href={`/creer-un-compte${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", isRegister ?"bg-white/10 text-white" : "text-slate-300 hover:text-white")}>Créer un compte</a>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextInput label={isRegister ? "E-mail" : "E-mail ou ancien pseudo"} value={form.email} onChange={(v) => patch("email", v)} placeholder={isRegister ? "joueur@exemple.com" : "joueur@exemple.com ou ancien pseudo"} type={isRegister ? "email" : "text"} required icon={Mail} />
            {isRegister && <TextInput label="Pseudo" value={form.displayName} onChange={(v) => patch("displayName", v)} placeholder="Ex : Joueur NXT5" required icon={UserPlus} />}
            <TextInput label="Mot de passe" value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" required icon={Lock} />
            <PremiumToggle checked={rememberMe} onChange={setRememberMe} title="Rester connecté" text="Garde cette session active plus longtemps sur cet appareil." />
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading} icon={loading ?Loader2 : isRegister ?UserPlus : Lock} className="w-full py-4">{loading ?"Chargement…" : isRegister ?"Créer le compte" : "Entrer dans NXT5"}</Button>
          </form>
          {!isRegister && <div className="mt-4 text-center"><a className="text-sm font-black text-cyan-200 transition hover:text-white" href="/mot-de-passe-oublie">Mot de passe oublié ?</a></div>}
          <p className="mt-4 text-center text-sm font-semibold text-slate-300">
            {isRegister ?"Déjà inscrit ?" : "Pas encore de compte ?"}
            <a className="font-black text-cyan-200 hover:text-white" href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`}>{isRegister ?" Connexion" : " Créer un compte"}</a>
          </p>
        </Surface>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, collapsed, setCollapsed, user, onLogout, currentMember, linkedPlayer }) {
  const status = profileStatusLabel(currentMember);
  const navItems = NAV.filter((item) => item.id !== "settings" && !item.hidden);
  const settingsItem = NAV.find((item) => item.id === "settings");
  const go = (pageId) => {
    setActive(pageId);
    setOpen(false);
  };
  return (
    <>
      <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden" />}</AnimatePresence>
      <aside className={cx("fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-cyan-200/14 bg-[#050917]/88 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl transition-all duration-300 lg:translate-x-0", collapsed ?"lg:w-24" : "lg:w-[21rem]", open ?"translate-x-0 w-[21rem] max-w-[calc(100vw-1rem)]" : "-translate-x-full w-[21rem] max-w-[calc(100vw-1rem)]")}>
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="absolute -right-4 top-6 hidden h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/18 bg-[#070d1d] text-cyan-100 shadow-xl shadow-black/40 transition hover:border-cyan-300/45 hover:bg-cyan-400/10 lg:flex" title={collapsed ?"Afficher le menu" : "Cacher le menu"}>
          <ChevronRight className={cx("h-5 w-5 transition", !collapsed && "rotate-180")} />
        </button>
        <div className={cx("mb-7 flex items-center", collapsed ?"justify-center" : "justify-between")}>
          <div className={cx("flex min-w-0 flex-1 items-center", collapsed ? "gap-0" : "gap-3")}><img src="/assets/nxt5-mark.png?v=8" alt="NXT5" className={cx("shrink-0 object-contain object-center drop-shadow-[0_0_30px_rgba(34,211,238,.42)]", collapsed ?"h-16 w-16" : "h-20 w-20")} /><div className={cx("min-w-0 flex-1 transition lg:block", collapsed && "lg:hidden")}><p className="nxt5-wordmark block w-full text-center text-[1.42rem] uppercase leading-none">NEXT FIVE</p><p className="mt-1 text-center text-[0.58rem] font-black uppercase tracking-[0.24em] text-cyan-100/55">Draft Tools</p></div></div>
          <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1.5">{navItems.map((item) => { const Icon = item.icon; const selected = active === item.id; return <button key={item.id} onClick={() => go(item.id)} title={item.label} className={cx("group flex w-full items-center gap-3 rounded-xl py-3 text-left text-sm font-black transition duration-200", collapsed ?"justify-center px-2 lg:justify-center" : "px-3.5", selected ?"bg-gradient-to-r from-cyan-500/26 via-blue-500/14 to-fuchsia-500/18 text-white shadow-lg shadow-cyan-950/18" : "text-slate-500 hover:bg-white/[0.055] hover:text-white")}><Icon className={cx("h-5 w-5 shrink-0 transition", selected ?"text-cyan-100" : "text-slate-600 group-hover:text-cyan-200")} /><span className={cx("truncate", collapsed && "lg:hidden")}>{item.label}</span></button>; })}</nav>
        <div className="mt-auto space-y-3"><Surface className={cx(collapsed ?"p-3" : "p-4")} delay={0}><div className={cx("flex items-center gap-3", collapsed && "lg:justify-center")}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200"><Users className="h-5 w-5" /></div><div className={cx("min-w-0", collapsed && "lg:hidden")}><p className="truncate text-sm font-black text-white">{user?.name || "Coach"}</p><p className="truncate text-xs font-semibold text-slate-500">{linkedPlayer ? `${linkedPlayer.role} · ${linkedPlayer.name}` : status}</p></div></div><div className={cx("mt-3 flex flex-wrap gap-2", collapsed && "lg:hidden")}><Badge tone="green" pulse>Online</Badge><Badge tone={profileStatusTone(currentMember)}>{status}</Badge>{linkedPlayer && <Badge tone="cyan">Profil lié</Badge>}</div></Surface>{settingsItem && <Button variant="ghost" icon={Settings} onClick={() => go("settings")} className={cx("w-full", active === "settings" && "border-cyan-300/35 bg-cyan-400/[0.075]", collapsed ?"justify-center px-0" : "justify-start")}><span className={cx(collapsed && "lg:hidden")}>{settingsItem.label}</span></Button>}<Button variant="ghost" icon={LogOut} onClick={onLogout} className={cx("w-full", collapsed ?"justify-center px-0" : "justify-start")}><span className={cx(collapsed && "lg:hidden")}>Déconnexion</span></Button></div>
      </aside>
    </>
  );
}

function TeamAvatar({ team, className = "h-12 w-12" }) {
  if (team?.avatar_data_url) {
    return <div className={cx("overflow-hidden rounded-xl border border-cyan-300/25 bg-black/30", className)}><img src={team.avatar_data_url} alt={team.name || "Team"} className="h-full w-full object-cover" style={{ transform: "scale(" + Number(team.avatar_zoom || 1) + ")", objectPosition: Number(team.avatar_x ?? 50) + "% " + Number(team.avatar_y ?? 50) + "%" }} /></div>;
  }
  return <img src="/assets/nxt5-logo.png" alt="NXT5" className={cx("object-contain object-left drop-shadow-[0_0_18px_rgba(34,211,238,.35)]", className)} />;
}

function RoleIcon({ role, className = "h-7 w-7" }) {
  const key = { TOP: "top", JGL: "jungle", MID: "middle", ADC: "bottom", SUP: "utility" }[String(role || "").toUpperCase()];
  if (!key) return <Users className={cx("text-slate-500", className)} />;
  return <img src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-${key}.svg`} alt={role} className={cx("object-contain opacity-90 invert", className)} />;
}

function Topbar({ active, setOpen, currentTeam, teams, onSelectTeam, onCreateTeam, onManageTeam }) {
  const nav = NAV.find((item) => item.id === active) || NAV[0];
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  return <header className="sticky top-0 z-20 border-b border-cyan-200/12 bg-[#030714]/78 px-4 py-4 text-white backdrop-blur-2xl lg:px-8"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-xl border border-cyan-100/14 bg-white/[0.045] p-2 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden md:block"><TeamAvatar team={currentTeam} /></div><div className="relative min-w-0"><p className="text-[0.68rem] font-black uppercase tracking-[0.26em] text-cyan-100/75">{nav.label}</p><button onClick={() => setTeamMenuOpen((open) => !open)} className="mt-0.5 flex max-w-[58vw] items-center gap-2 rounded-xl px-0 py-0 text-left transition hover:text-cyan-100"><h1 className="truncate text-xl font-black tracking-tight md:text-2xl">{currentTeam?.name || nav.label}</h1><ChevronDown className="h-5 w-5 shrink-0 text-cyan-200" /></button><AnimatePresence>{teamMenuOpen && <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="absolute left-0 top-[calc(100%+0.6rem)] z-50 w-[min(88vw,380px)] overflow-hidden rounded-2xl border border-cyan-200/14 bg-[#080d19]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">{teams.map((team) => <button key={team.id} onClick={() => { onSelectTeam(team.id); setTeamMenuOpen(false); }} className={cx("flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition", currentTeam?.id === team.id ?"bg-cyan-400/10 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white")}><span className="flex min-w-0 items-center gap-3"><TeamAvatar team={team} className="h-9 w-9 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-black">{team.name}</span><span className="mt-1 block text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-500">{team.tag || "TEAM"} · {team.region || "EUW"}</span></span></span>{currentTeam?.id === team.id && <Check className="h-4 w-4 shrink-0 text-cyan-200" />}</button>)}<button onClick={() => { onCreateTeam(); setTeamMenuOpen(false); }} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-cyan-100/14 bg-white/[0.04] px-4 py-3 text-left text-sm font-black text-cyan-100 transition hover:bg-cyan-400/10"><Plus className="h-4 w-4" />Créer une nouvelle team</button></motion.div>}</AnimatePresence></div></div>{currentTeam && active !== "team-management" && <Button variant="ghost" icon={Settings} onClick={onManageTeam}>Gestion</Button>}</div></header>;
}

function ApiBanner({ error }) {
  if (!error) return null;
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-3xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100 shadow-xl shadow-amber-950/10"><div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-200/10 p-2"><AlertTriangle className="h-5 w-5" /></div><div><p className="font-black">Endpoint/API non disponible</p><p className="mt-1 text-sm leading-6 text-amber-100/75">{error}</p></div></div></motion.div>;
}

function WinConditionPanel({ championPool, players, onOpenDraft }) {
  const pool = championPool || [];
  const best = pool.slice().filter((row) => Number(row.games || 0) > 0).sort((a, b) => (Number(b.winrate || 0) * 2 + Number(b.kda || 0) * 8 + Number(b.games || 0)) - (Number(a.winrate || 0) * 2 + Number(a.kda || 0) * 8 + Number(a.games || 0)))[0];
  const stable = pool.filter((row) => Number(row.games || 0) >= 3 && Number(row.winrate || 0) >= 50).slice(0, 5);
  const weak = pool.filter((row) => Number(row.games || 0) >= 3 && Number(row.winrate || 0) < 45).slice(0, 3);
  const missingRoles = ["TOP", "JGL", "MID", "ADC", "SUP"].filter((role) => !players.some((player) => player.role === role));
  return <Surface glow><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><Badge tone="cyan">win condition</Badge><h3 className="mt-4 text-2xl font-black text-white">Plan de jeu probable</h3><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Une lecture du pool actuel : ce qu'on peut jouer, ce qu'il faut protéger, et ce qui manque avant un match important.</p></div><Button variant="ghost" icon={Shield} onClick={onOpenDraft}>Ouvrir draft</Button></div>{best ? <div className="mt-6 grid gap-4 xl:grid-cols-[.9fr_1.1fr]"><div className="relative min-h-[260px] overflow-hidden rounded-[1.45rem] border border-cyan-300/20 bg-cyan-400/10 p-5"><ChampionBackdrop champion={best.champion} /><div className="relative z-10"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Pick autour duquel jouer</p><h4 className="mt-3 text-4xl font-black text-white">{championDisplayName(best.champion)}</h4><p className="mt-2 text-sm font-bold text-slate-300">{best.player_name || "Roster"}</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">WR</p><p className="mt-1 text-xl font-black text-white">{best.winrate || 0}%</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">KDA</p><p className="mt-1 text-xl font-black text-white">{Number(best.kda || 0).toFixed(1)}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Games</p><p className="mt-1 text-xl font-black text-white">{best.games || 0}</p></div></div></div></div><div className="grid gap-3"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Picks stables</p><div className="mt-3 flex flex-wrap gap-2">{stable.length ? stable.map((pick) => <div key={pick.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3"><img src={championSquareUrl(pick)} alt={pick.champion} className="h-8 w-8 rounded-full object-cover" /><span className="text-xs font-black text-white">{championDisplayName(pick.champion)}</span></div>) : <span className="text-sm font-semibold text-slate-500">Pas encore assez de volume.</span>}</div></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">À protéger / travailler</p><div className="mt-3 flex flex-wrap gap-2">{weak.length ? weak.map((pick) => <Badge key={pick.id} tone="red">{championDisplayName(pick.champion)} · {pick.winrate || 0}%</Badge>) : <Badge tone="green">Aucun gros point faible détecté</Badge>}{missingRoles.length > 0 && <Badge tone="yellow">Slots manquants : {missingRoles.join(", ")}</Badge>}</div></div></div></div> : <EmptyState icon={Crown} title="Plan de jeu en attente" text="Importe des games pour que NXT5 détecte les champions à jouer autour." />}</Surface>;
}

function ChampionMiniCard({ title, item, icon: Icon, tone: t }) {
  return <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4"><ChampionBackdrop champion={item?.champion} /><div className="relative z-10 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{title}</p><p className="mt-2 text-xl font-black text-white">{championDisplayName(item?.champion) || "?"}</p><p className="mt-1 text-sm font-semibold text-slate-400">{item?.player_name || "Données insuffisantes"}</p></div><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div></div><div className="relative z-10 mt-4 flex flex-wrap gap-2"><Badge tone="slate">{item?.games ?? 0} games</Badge><Badge tone={Number(item?.winrate || 0) >= 55 ?"green" : "yellow"}>{item?.winrate ?? "?"}% WR</Badge><Badge tone={gradeTone(item?.impact_grade)}>{item?.impact_grade || "?"}</Badge></div></div>;
}

const DDRAGON_VERSION = "16.10.1";

const CHAMPION_STYLE_TAGS = {
  Aatrox: ["bruiser", "teamfight"], Ahri: ["pick", "tempo"], Akali: ["assassin", "side"], Alistar: ["engage", "peel"], Amumu: ["engage", "teamfight"], Anivia: ["control", "scaling"], Annie: ["burst", "engage"], Aphelios: ["scaling", "front-to-back"], Ashe: ["utility", "pick"], AurelionSol: ["scaling", "control"], Azir: ["scaling", "front-to-back"],
  Bard: ["roam", "pick"], Blitzcrank: ["pick", "engage"], Brand: ["poke", "teamfight"], Braum: ["peel", "front-to-back"], Caitlyn: ["lane", "siege"], Camille: ["side", "pick"], Cassiopeia: ["scaling", "front-to-back"], Chogath: ["frontline", "objective"], Corki: ["poke", "scaling"],
  Darius: ["bruiser", "lane"], Diana: ["engage", "burst"], DrMundo: ["frontline", "scaling"], Draven: ["lane", "snowball"], Ekko: ["assassin", "side"], Elise: ["early", "dive"], Evelynn: ["pick", "assassin"], Ezreal: ["poke", "safe"], Fiddlesticks: ["engage", "teamfight"], Fiora: ["side", "duel"], Fizz: ["assassin", "pick"],
  Galio: ["engage", "cover"], Gangplank: ["scaling", "teamfight"], Garen: ["bruiser", "simple"], Gnar: ["teamfight", "side"], Gragas: ["engage", "disengage"], Graves: ["tempo", "skirmish"], Gwen: ["scaling", "side"], Hecarim: ["engage", "tempo"], Heimerdinger: ["control", "siege"], Hwei: ["control", "poke"],
  Irelia: ["side", "snowball"], Ivern: ["utility", "peel"], Janna: ["peel", "disengage"], JarvanIV: ["engage", "early"], Jax: ["side", "scaling"], Jayce: ["poke", "lane"], Jhin: ["utility", "pick"], Jinx: ["scaling", "front-to-back"], Kaisa: ["dive", "scaling"], Kalista: ["lane", "objective"], Karma: ["poke", "tempo"], Karthus: ["scaling", "farm"], Kassadin: ["scaling", "side"], Katarina: ["reset", "snowball"], Kayle: ["scaling", "front-to-back"], Kayn: ["tempo", "skirmish"], Kennen: ["engage", "teamfight"], Khazix: ["pick", "assassin"], Kindred: ["tempo", "scaling"], Kled: ["engage", "snowball"], KogMaw: ["scaling", "front-to-back"], KSante: ["frontline", "side"],
  LeBlanc: ["pick", "poke"], LeeSin: ["early", "playmaker"], Leona: ["engage", "lane"], Lillia: ["tempo", "teamfight"], Lissandra: ["engage", "lockdown"], Lucian: ["lane", "tempo"], Lulu: ["peel", "scaling"], Lux: ["poke", "pick"], Malphite: ["engage", "teamfight"], Malzahar: ["lockdown", "pick"], Maokai: ["engage", "vision"], MasterYi: ["scaling", "reset"], Milio: ["peel", "scaling"], MissFortune: ["teamfight", "lane"], MonkeyKing: ["engage", "teamfight"], Mordekaiser: ["frontline", "side"], Morgana: ["pick", "control"], Nami: ["lane", "utility"], Nasus: ["scaling", "side"], Nautilus: ["engage", "pick"], Neeko: ["engage", "teamfight"], Nidalee: ["tempo", "poke"], Nilah: ["dive", "teamfight"], Nocturne: ["dive", "pick"], Nunu: ["objective", "gank"], Olaf: ["bruiser", "tempo"], Orianna: ["control", "teamfight"], Ornn: ["frontline", "scaling"], Pantheon: ["early", "pick"], Poppy: ["disengage", "frontline"], Pyke: ["pick", "roam"], Qiyana: ["assassin", "teamfight"], Quinn: ["side", "lane"], Rakan: ["engage", "roam"], Rammus: ["engage", "frontline"], RekSai: ["early", "dive"], Rell: ["engage", "teamfight"], Renata: ["disengage", "teamfight"], Renekton: ["lane", "early"], Rengar: ["assassin", "pick"], Riven: ["side", "snowball"], Rumble: ["teamfight", "lane"], Ryze: ["side", "scaling"], Samira: ["dive", "reset"], Sejuani: ["engage", "frontline"], Senna: ["scaling", "utility"], Seraphine: ["teamfight", "scaling"], Sett: ["frontline", "engage"], Shen: ["side", "cover"], Shyvana: ["farm", "teamfight"], Singed: ["side", "disrupt"], Sion: ["frontline", "engage"], Sivir: ["waveclear", "front-to-back"], Skarner: ["pick", "frontline"], Smolder: ["scaling", "front-to-back"], Sona: ["scaling", "teamfight"], Soraka: ["peel", "sustain"], Swain: ["teamfight", "frontline"], Sylas: ["skirmish", "pick"], Syndra: ["burst", "control"], TahmKench: ["peel", "frontline"], Taliyah: ["control", "roam"], Talon: ["roam", "assassin"], Taric: ["peel", "teamfight"], Teemo: ["side", "control"], Thresh: ["pick", "peel"], Tristana: ["lane", "siege"], Trundle: ["frontline", "objective"], Tryndamere: ["side", "scaling"], TwistedFate: ["roam", "pick"], Twitch: ["scaling", "flank"], Udyr: ["tempo", "frontline"], Urgot: ["bruiser", "frontline"], Varus: ["poke", "pick"], Vayne: ["scaling", "duel"], Veigar: ["scaling", "control"], Velkoz: ["poke", "control"], Vex: ["burst", "anti-dive"], Vi: ["dive", "lockdown"], Viego: ["reset", "skirmish"], Viktor: ["control", "scaling"], Vladimir: ["scaling", "teamfight"], Volibear: ["dive", "early"], Warwick: ["early", "skirmish"], Xayah: ["self-peel", "front-to-back"], Xerath: ["poke", "siege"], XinZhao: ["early", "dive"], Yasuo: ["skirmish", "teamfight"], Yone: ["side", "teamfight"], Yorick: ["side", "siege"], Yuumi: ["scaling", "attach"], Zac: ["engage", "teamfight"], Zed: ["assassin", "side"], Zeri: ["scaling", "teamfight"], Ziggs: ["poke", "siege"], Zilean: ["utility", "scaling"], Zoe: ["poke", "pick"], Zyra: ["poke", "control"],
};

const ADDITIONAL_CHAMPION_STYLE_TAGS = {
  Akshan: ["roam", "reset"],
  Ambessa: ["dive", "skirmish"],
  Aurora: ["teamfight", "side"],
  Belveth: ["scaling", "skirmish"],
  Briar: ["dive", "snowball"],
  Illaoi: ["side", "teamfight"],
  Leblanc: ["pick", "poke"],
  Mel: ["control", "poke"],
  Naafiri: ["assassin", "dive"],
  Shaco: ["pick", "assassin"],
  Yunara: ["scaling", "front-to-back"],
  Zaahen: ["bruiser", "dive"],
};

const ALL_CHAMPION_STYLE_TAGS = {
  ...CHAMPION_STYLE_TAGS,
  ...ADDITIONAL_CHAMPION_STYLE_TAGS,
};

const CHAMPION_ASSET_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leblanc: "Leblanc",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  viego: "Viego",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

function championKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function championAssetId(value) {
  const raw = String(value || "").trim();
  const key = championKey(raw);
  return CHAMPION_ASSET_ALIASES[key] || raw.replace(/[^A-Za-z0-9]/g, "");
}

function championDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const names = {
    AurelionSol: "Aurelion Sol",
    Chogath: "Cho'Gath",
    DrMundo: "Dr. Mundo",
    JarvanIV: "Jarvan IV",
    Kaisa: "Kai'Sa",
    Khazix: "Kha'Zix",
    KogMaw: "Kog'Maw",
    KSante: "K'Sante",
    Leblanc: "LeBlanc",
    LeeSin: "Lee Sin",
    MasterYi: "Master Yi",
    MissFortune: "Miss Fortune",
    MonkeyKing: "Wukong",
    Nunu: "Nunu & Willump",
    RekSai: "Rek'Sai",
    TahmKench: "Tahm Kench",
    TwistedFate: "Twisted Fate",
    Velkoz: "Vel'Koz",
    XinZhao: "Xin Zhao",
  };
  const asset = championAssetId(raw);
  return names[asset] || raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function championOptions() {
  return [...new Set(Object.keys(ALL_CHAMPION_STYLE_TAGS).map(championAssetId))].sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
}

function compositionIdentity(picks) {
  const tagCounts = new Map();
  (picks || []).filter(Boolean).forEach((pick) => championStyleTags(pick.champion).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const primary = tags[0]?.[0] || "standard";
  const text = primary === "engage" ? "Chercher une ouverture claire et jouer autour du premier go." : primary === "scaling" || primary === "front-to-back" ? "Protéger les carries, temporiser et jouer les objectifs préparés." : primary === "poke" || primary === "siege" ? "Gagner l'espace avant objectif, gratter les HP puis forcer." : primary === "side" ? "Créer une pression side lane et punir les rotations adverses." : primary === "pick" ? "Jouer vision noire, isoler une cible et convertir en objectif." : "Importer plus de matchs pour stabiliser l'identité de draft.";
  return { primary, tags, text };
}

function championStyleTags(champion) {
  return ALL_CHAMPION_STYLE_TAGS[championAssetId(champion)] || ["standard"];
}

function championStyleTone(tag) {
  if (["engage", "dive", "early", "snowball", "assassin", "burst", "pick"].includes(tag)) return "red";
  if (["scaling", "front-to-back", "peel", "sustain", "utility", "control"].includes(tag)) return "cyan";
  if (["side", "duel", "split", "siege", "poke"].includes(tag)) return "yellow";
  if (["frontline", "teamfight", "objective", "tempo"].includes(tag)) return "green";
  return "slate";
}

function tagLabel(tag) {
  return {
    "blue side": "Blue Side",
    "red side": "Red Side",
    "front-to-back": "Front-to-Back",
    teamfight: "Teamfight",
    scaling: "Scaling",
    pick: "Pick",
    poke: "Poke",
    siege: "Siege",
    side: "Side",
    engage: "Engage",
    dive: "Dive",
    early: "Early",
    snowball: "Snowball",
    assassin: "Assassin",
    burst: "Burst",
    peel: "Peel",
    sustain: "Sustain",
    utility: "Utility",
    control: "Control",
    duel: "Duel",
    split: "Split",
    frontline: "Frontline",
    objective: "Objective",
    tempo: "Tempo",
    standard: "Standard",
    scrim: "Scrim",
  }[String(tag || "")] || String(tag || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function championSplashUrl(champion) {
  const id = championAssetId(champion);
  return id ? "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/" + id + "_0.jpg" : "";
}

function championLoadingUrl(champion) {
  const id = championAssetId(champion);
  return id ? "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + id + "_0.jpg" : "";
}

function championSquareUrl(rowOrChampion) {
  const championId = rowOrChampion?.raw?.championId || rowOrChampion?.championId;
  if (championId) return "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/" + championId + ".png";
  const champion = typeof rowOrChampion === "string" ? rowOrChampion : rowOrChampion?.champion;
  const id = championAssetId(champion);
  return id ? "https://ddragon.leagueoflegends.com/cdn/" + DDRAGON_VERSION + "/img/champion/" + id + ".png" : "";
}

function championIconUrl(row) {
  return championSquareUrl(row);
}

function ChampionBackdrop({ champion }) {
  const url = championSplashUrl(champion);
  if (!url) return null;
  return <div className="absolute inset-0 opacity-30"><img src={url} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#070b16] via-[#070b16]/78 to-[#070b16]/30" /></div>;
}

function StatBar({ value, max, tone: t = "cyan" }) {
  const width = Math.max(4, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100));
  return <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={cx("h-full rounded-full", t === "red" ?"bg-rose-300" : t === "green" ?"bg-emerald-300" : t === "yellow" ?"bg-amber-300" : "bg-cyan-300")} style={{ width: String(width) + "%" }} /></div>;
}

function MatchChampionStrip({ rows }) {
  const ally = rows.filter((row) => row.team_key === "ALLY").slice(0, 5);
  if (!ally.length) return null;
  return <div className="flex flex-wrap gap-2">{ally.map((row) => <div key={row.id || String(row.riot_id) + "-" + row.champion} className="group relative h-24 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src={championLoadingUrl(row.champion)} alt={row.champion} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2"><p className="truncate text-[0.65rem] font-black text-white">{row.role || "?"}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">{championDisplayName(row.champion)}</p></div></div>)}</div>;
}

function LatestMatchPanel({ match, onOpen }) {
  if (!match) return null;
  const ally = match.participants?.filter((row) => row.team_key === "ALLY") || [];
  const kills = ally.reduce((sum, row) => sum + Number(row.kills || 0), 0);
  const deaths = ally.reduce((sum, row) => sum + Number(row.deaths || 0), 0);
  const assists = ally.reduce((sum, row) => sum + Number(row.assists || 0), 0);
  const damage = ally.reduce((sum, row) => sum + Number(row.damage || 0), 0);
  const vision = ally.reduce((sum, row) => sum + Number(row.vision || 0), 0);
  return <button onClick={onOpen} className="mt-5 w-full rounded-[1.35rem] border border-cyan-300/20 bg-cyan-400/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-cyan-400/15"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ?"green" : "red"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.patch || "Patch ?"}</Badge><Badge tone="blue">{match.side || "Side ?"}</Badge></div><h4 className="mt-3 text-2xl font-black text-white">{match.game_id}</h4><p className="mt-1 text-sm font-semibold text-slate-400">{match.duration || "--:--"} · {match.primary_focus || "Focus review À définir"}</p></div><MatchChampionStrip rows={ally} /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">KDA équipe</p><p className="mt-1 text-lg font-black text-white">{kills}/{deaths}/{assists}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dégâts</p><p className="mt-1 text-lg font-black text-white">{formatPoints(damage)}</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Vision</p><p className="mt-1 text-lg font-black text-white">{vision}</p></div></div></button>;
}

const COMP_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const STAFF_ROLES = ["COACH", "ASSISTANT", "ANALYST", "MANAGER", "BOARD"];
const PROFILE_ROLES = [...COMP_ROLES, "SUB", ...STAFF_ROLES];
const ROSTER_ROLE_ORDER = COMP_ROLES;

function isGameplayRole(role) {
  return [...COMP_ROLES, "SUB"].includes(String(role || "").toUpperCase());
}

function isStaffRole(role) {
  return STAFF_ROLES.includes(String(role || "").toUpperCase());
}

function roleLabel(role) {
  return {
    TOP: "Top",
    JGL: "Jungle",
    MID: "Mid",
    ADC: "ADC",
    SUP: "Support",
    SUB: "Remplaçant",
    COACH: "Coach",
    ASSISTANT: "Assistant coach",
    ANALYST: "Analyste",
    MANAGER: "Manager",
    BOARD: "Board",
  }[String(role || "").toUpperCase()] || String(role || "Profil");
}

function decodeLoose(value) {
  let output = String(value || "").replace(/\+/g, " ");
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) break;
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
}

function parseMultiOpgg(input) {
  const text = decodeLoose(input);
  const players = [];
  const seen = new Set();

  function addRiotId(name, tag) {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    const cleanTag = String(tag || "").trim().toUpperCase();
    if (!cleanName || !cleanTag) return;
    const riotId = `${cleanName}#${cleanTag}`;
    const key = riotId.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    players.push({ name: cleanName, riotId });
  }

  const riotIdPattern = /([A-Za-z0-9À-ÿ _.'-]{2,32})\s*#\s*([A-Za-z0-9]{2,8})/g;
  for (const match of text.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);

  const urlPattern = /https?:\/\/\S+/g;
  for (const urlText of text.match(urlPattern) || []) {
    try {
      const url = new URL(urlText);
      const summoners = [
        ...url.searchParams.getAll("summoners"),
        ...url.searchParams.getAll("summoner"),
        ...url.searchParams.getAll("summonerName"),
      ].join(",");
      for (const entry of decodeLoose(summoners).split(/[,;\n|]+/)) {
        for (const match of entry.matchAll(riotIdPattern)) addRiotId(match[1], match[2]);
      }
    } catch {}
  }

  const opggPathPattern = /(?:summoners\/|^)(?:[a-z]{2,5}\/)?([^/?#&,;|\n]+)-([A-Za-z0-9]{2,8})/gi;
  for (const match of text.matchAll(opggPathPattern)) {
    addRiotId(decodeLoose(match[1]).replace(/-/g, " "), match[2]);
  }

  return players;
}

function opggUrlFromRiotId(riotId, region) {
  const [name, tag] = String(riotId).split("#");
  if (!name || !tag) return "";
  const slug = encodeURIComponent(`${name}-${tag}`);
  return `https://www.op.gg/lol/summoners/${String(region || "EUW").toLowerCase()}/${slug}`;
}

function multiOpggUrlFromRoster(roster, region) {
  const summoners = roster
    .filter((player) => isGameplayRole(player.role))
    .map((player) => {
      const [name, tag] = String(player.riot_id || "").split("#").map((part) => part.trim());
      return name && tag ?`${name}#${tag}` : "";
    })
    .filter(Boolean);

  if (!summoners.length) return "";
  return `https://www.op.gg/lol/multisearch/${String(region || "EUW").toLowerCase()}?summoners=${encodeURIComponent(summoners.join(","))}`;
}

function Teams({ data, refreshAll, selectedTeamId, setSelectedTeamId, currentMember, routeSearch = "", pushToast, user, managementOnly = false }) {
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", region: "EUW", multiOpgg: "" });
  const [playerForm, setPlayerForm] = useState({ name: "", riotId: "", opggUrl: "", role: "TOP" });
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingMostPlayed, setSyncingMostPlayed] = useState(false);
  const [syncingPlayerId, setSyncingPlayerId] = useState("");
  const [teamSetupOpen, setTeamSetupOpen] = useState(false);
  const [riotCooldownUntil, setRiotCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [teamEdit, setTeamEdit] = useState({ name: "", tag: "", avatarDataUrl: "", avatarZoom: 1, avatarX: 50, avatarY: 50 });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerEditForm, setPlayerEditForm] = useState({ name: "", riotId: "", opggUrl: "" });
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0];
  const roster = selectedTeam ?data.players.filter((player) => player.team_id === selectedTeam.id) : [];
  const gameplayRoster = roster.filter((player) => isGameplayRole(player.role));
  const teamMembers = selectedTeam ?(data.teamMembers || []).filter((member) => member.team_id === selectedTeam.id) : [];
  const inviteCodes = selectedTeam ?(data.inviteCodes || []).filter((code) => code.team_id === selectedTeam.id) : [];
  const multiPlayers = useMemo(() => parseMultiOpgg(teamForm.multiOpgg), [teamForm.multiOpgg]);
  const hasTeams = data.teams.length > 0;
  const canManageTeam = ["owner", "captain", "coach"].includes(String(currentMember?.role || "").toLowerCase());
  const canDeleteTeam = ["owner", "captain"].includes(String(currentMember?.role || "").toLowerCase());
  const riotCooldownSeconds = Math.max(0, Math.ceil((riotCooldownUntil - nowTick) / 1000));

  useEffect(() => {
    if (!selectedTeamId && data.teams[0]?.id) setSelectedTeamId(data.teams[0].id);
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite && !joinCode) setJoinCode(invite);
  }, [data.teams, selectedTeamId, setSelectedTeamId, joinCode]);

  useEffect(() => {
    const params = new URLSearchParams(routeSearch || window.location.search);
    if (params.get("create") === "1") setTeamSetupOpen(true);
  }, [routeSearch]);

  useEffect(() => {
    if (!riotCooldownUntil) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [riotCooldownUntil]);

  useEffect(() => {
    if (!selectedTeam) return;
    setTeamEdit({
      name: selectedTeam.name || "",
      tag: selectedTeam.tag || "",
      avatarDataUrl: selectedTeam.avatar_data_url || "",
      avatarZoom: Number(selectedTeam.avatar_zoom || 1),
      avatarX: Number(selectedTeam.avatar_x ?? 50),
      avatarY: Number(selectedTeam.avatar_y ?? 50),
    });
  }, [selectedTeam?.id]);

  async function createTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch("teams-create", { method: "POST", body: JSON.stringify({ name: teamForm.name, tag: teamForm.tag, region: teamForm.region }) });
      const createdTeam = result.team;
      let importedCount = 0;
      for (const [index, player] of multiPlayers.entries()) {
        await apiFetch("players-create", {
          method: "POST",
          body: JSON.stringify({
            teamId: createdTeam.id,
            name: player.name,
            riotId: player.riotId,
            opggUrl: opggUrlFromRiotId(player.riotId, teamForm.region),
            role: ROSTER_ROLE_ORDER[index] || "SUB",
          }),
        });
        importedCount += 1;
      }
      setTeamForm({ name: "", tag: "", region: "EUW", multiOpgg: "" });
      setSelectedTeamId(createdTeam.id);
      setTeamSetupOpen(false);
      await refreshAll();
      pushToast({ type: "green", title: "Team créée", text: importedCount ?`${importedCount} joueur${importedCount > 1 ?"s" : ""} importé${importedCount > 1 ?"s" : ""} depuis le multi OP.GG.` : "Tu peux maintenant ajouter le roster ou générer un code d’invitation." });
    } catch (err) {
      pushToast({ type: "red", title: "Création impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function joinTeam(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("teams-join", { method: "POST", body: JSON.stringify({ invite: joinCode }) });
      setJoinCode("");
      setTeamSetupOpen(false);
      await refreshAll();
      pushToast({ type: "green", title: "Team rejointe", text: "Tu as maintenant accès à cette structure." });
    } catch (err) {
      pushToast({ type: "red", title: "Invitation invalide", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function createPlayer(event) {
    event.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-create", { method: "POST", body: JSON.stringify({ ...playerForm, teamId: selectedTeam.id }) });
      setPlayerForm({ name: "", riotId: "", opggUrl: "", role: "TOP" });
      await refreshAll();
      pushToast({ type: "green", title: isStaffRole(playerForm.role) ? "Staff ajouté" : "Joueur ajouté", text: "Roster mis à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      const result = await apiFetch("teams-invite-code", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await navigator.clipboard.writeText(result.code);
      await refreshAll();
      pushToast({ type: "green", title: "Code d’invitation copié", text: `${result.code} est valable 1h maximum.` });
    } catch (err) {
      pushToast({ type: "red", title: "Code impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyMultiOpggLink() {
    if (!selectedTeam || !gameplayRoster.length) return;
    const link = multiOpggUrlFromRoster(gameplayRoster, selectedTeam.region);
    if (!link) {
      pushToast({ type: "red", title: "Multi OP.GG impossible", text: "Ajoute des Riot IDs au format Pseudo#TAG." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "Multi OP.GG copié", text: `${gameplayRoster.length} joueur${gameplayRoster.length > 1 ?"s" : ""} dans le lien.` });
  }

  async function copyPlayerOpggLink(player) {
    const link = String(player?.opgg_url || "").trim() || opggUrlFromRiotId(player?.riot_id, selectedTeam?.region);
    if (!link) {
      pushToast({ type: "red", title: "OP.GG introuvable", text: "Ajoute un Riot ID ou un lien OP.GG sur ce profil." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "OP.GG copié", text: `${player?.name || "Profil"} est dans le presse-papiers.` });
  }

  function openPlayerEdit(player) {
    setEditingPlayer(player);
    setPlayerEditForm({
      name: player?.name || "",
      riotId: player?.riot_id || "",
      opggUrl: player?.opgg_url || "",
    });
  }

  function closePlayerEdit() {
    setEditingPlayer(null);
    setPlayerEditForm({ name: "", riotId: "", opggUrl: "" });
  }

  async function updatePlayer(event) {
    event.preventDefault();
    if (!selectedTeam || !editingPlayer) return;
    setSaving(true);
    try {
      await apiFetch("players-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: editingPlayer.id, ...playerEditForm }) });
      closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil modifié", text: "Nom, Riot ID et OP.GG sont à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function linkPlayerAccount(playerId, userId) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("players-link-account", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId, userId: userId || null }) });
      await refreshAll();
      pushToast({ type: "green", title: userId ?"Compte lié" : "Compte délié", text: "La gestion de la team est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Liaison impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function updateMemberRole(userId, role) {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("team-member-role", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId, role }) });
      await refreshAll();
      pushToast({ type: "green", title: "Statut mis à jour", text: "Le profil reflète son rôle dans la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function loadTeamAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast({ type: "red", title: "Avatar invalide", text: "Choisis une image depuis ton PC." });
      return;
    }
    if (file.size > 900000) {
      pushToast({ type: "yellow", title: "Image trop lourde", text: "Prends une image sous 900 Ko pour garder l’avatar léger." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setTeamEdit((current) => ({ ...current, avatarDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  async function updateTeam(event) {
    event.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await apiFetch("teams-update", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, ...teamEdit }) });
      await refreshAll();
      pushToast({ type: "green", title: "Team mise à jour", text: "Nom et avatar sont synchronisés." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(`Renvoyer ${label || "ce profil"} de la team ?`)) return;
    setSaving(true);
    try {
      await apiFetch("team-member-remove", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, userId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Profil renvoyé", text: "Le compte n'a plus accès à cette team." });
    } catch (err) {
      pushToast({ type: "red", title: "Renvoi impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(playerId, label) {
    if (!selectedTeam) return;
    if (!window.confirm(`Supprimer le profil "${label || "sélectionné"}" du roster ?`)) return;
    setSaving(true);
    try {
      await apiFetch("players-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId }) });
      if (editingPlayer?.id === playerId) closePlayerEdit();
      await refreshAll();
      pushToast({ type: "green", title: "Profil supprimé", text: "Le roster de gestion est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function syncMostPlayed() {
    if (!selectedTeam) return;
    if (riotCooldownSeconds > 0) {
      pushToast({ type: "yellow", title: "Riot refroidit", text: `Réessaie dans ${formatCountdown(riotCooldownSeconds)}.` });
      return;
    }
    setSyncingMostPlayed(true);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await refreshAll();
      const ok = result.results?.filter((item) => item.ok && !item.skipped).length || 0;
      const skipped = result.results?.filter((item) => item.skipped).length || 0;
      const failed = result.results?.filter((item) => !item.ok).length || 0;
      const poolCount = result.results?.reduce((sum, item) => sum + Number(item.poolCount || 0), 0) || 0;
      const firstFailed = result.results?.find((item) => !item.ok);
      const firstError = firstFailed?.error;
      if (firstFailed?.code === "RIOT_RATE_LIMIT") {
        const retryAfter = Number(firstFailed.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      pushToast({ type: failed ?"yellow" : "green", title: "Most played synchronisés", text: `${ok} profil${ok > 1 ?"s" : ""} analysé${ok > 1 ?"s" : ""}${poolCount ?`, ${poolCount} champion${poolCount > 1 ?"s" : ""} ajouté${poolCount > 1 ?"s" : ""}` : ""}${failed ?`, ${failed} erreur${failed > 1 ?"s" : ""}` : ""}${firstError ?` : ${firstError}` : ""}.` });
    } catch (err) {
      if (err.code === "RIOT_RATE_LIMIT" || err.status === 429) {
        const retryAfter = Number(err.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingMostPlayed(false);
    }
  }

  async function syncPlayerMostPlayed(player) {
    if (!selectedTeam || !player) return;
    if (riotCooldownSeconds > 0) {
      pushToast({ type: "yellow", title: "Riot refroidit", text: `Réessaie dans ${formatCountdown(riotCooldownSeconds)}.` });
      return;
    }
    setSyncingPlayerId(player.id);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId: player.id }) });
      await refreshAll();
      const firstFailed = result.results?.find((item) => !item.ok);
      if (firstFailed?.code === "RIOT_RATE_LIMIT") {
        const retryAfter = Number(firstFailed.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      if (firstFailed) {
        pushToast({ type: "yellow", title: "Analyse incomplète", text: `${player.name} n'a pas été analysé : ${firstFailed.error}` });
      } else {
        pushToast({ type: "green", title: "Profil analysé", text: `${player.name} est à jour.` });
      }
    } catch (err) {
      if (err.code === "RIOT_RATE_LIMIT" || err.status === 429) {
        const retryAfter = Number(err.retryAfter || 120);
        setRiotCooldownUntil(Date.now() + Math.max(30, retryAfter) * 1000);
      }
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingPlayerId("");
    }
  }

  async function deleteTeam() {
    if (!selectedTeam) return;
    const confirmed = window.confirm(`Supprimer définitivement la team "${selectedTeam.name}" ? Cette action supprime aussi roster, matchs, rapports et invitations liés.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await apiFetch("teams-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      setSelectedTeamId(null);
      await refreshAll();
      pushToast({ type: "green", title: "Team supprimée", text: "La structure et ses données liées ont été supprimées." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (managementOnly) return <div><PageHeader eyebrow="Gestion" title="Gestion de l’équipe" subtitle="Modifie l’identité de l’équipe, les accès, les invitations et les liaisons de profils." />{selectedTeam ? <TeamManagementPanel team={selectedTeam} edit={teamEdit} setEdit={setTeamEdit} onAvatarFile={loadTeamAvatar} onSaveTeam={updateTeam} onCopyInvite={copyInviteLink} canManage={canManageTeam} canDeleteTeam={canDeleteTeam} members={teamMembers} roster={roster} inviteCodes={inviteCodes} saving={saving} onRoleChange={updateMemberRole} onLink={linkPlayerAccount} onRemoveMember={removeMember} onDeletePlayer={deletePlayer} onDeleteTeam={deleteTeam} /> : <Surface glow><EmptyState icon={Users} title="Aucune équipe" text="Crée ou rejoins une équipe avant d’ouvrir la gestion." /></Surface>}</div>;

  return <div><PageHeader eyebrow="Team manager" title={hasTeams ?"Gérer ton équipe" : "Créer ou rejoindre une team"} subtitle={hasTeams ?"La page affiche le roster, les invitations et les analyses de l’équipe active." : "Choisis clairement ton entrée : créer ta structure ou rejoindre une team avec un code temporaire."} />
    <div className={cx("grid gap-5", hasTeams ?teamSetupOpen && "xl:grid-cols-[.78fr_1.22fr]" : "xl:grid-cols-2")}>
      <div className={cx("space-y-5", hasTeams && !teamSetupOpen && "hidden")}>
        <Surface glow>
          <h3 className="text-xl font-black text-white">Créer une team</h3>
          <p className="mt-1 text-sm text-slate-500">Pour lancer une nouvelle structure, créer son roster et importer ses games.</p>
          <form onSubmit={createTeam} className="mt-5 space-y-4">
            <TextInput label="Nom de team" value={teamForm.name} onChange={(name) => setTeamForm({ ...teamForm, name })} placeholder="Nom de l'équipe" required icon={Trophy} />
            <TextInput label="Tag" value={teamForm.tag} onChange={(tag) => setTeamForm({ ...teamForm, tag })} placeholder="TAG" required icon={Shield} />
            <SelectInput label="Région" value={teamForm.region} onChange={(region) => setTeamForm({ ...teamForm, region })}><option>EUW</option><option>EUNE</option><option>NA</option><option>KR</option><option>BR</option><option>LAN</option><option>LAS</option><option>JP</option><option>OCE</option><option>TR</option></SelectInput>
            <TextAreaInput label="Multi OP.GG ou Riot IDs" value={teamForm.multiOpgg} onChange={(multiOpgg) => setTeamForm({ ...teamForm, multiOpgg })} placeholder={"Colle un lien multi OP.GG ou une liste :\nToplaner#EUW\nJungler#EUW\nMidlaner#EUW\nADC#EUW\nSupport#EUW"} icon={Clipboard} />
            {multiPlayers.length > 0 && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{multiPlayers.length} joueur{multiPlayers.length > 1 ?"s" : ""} détecté{multiPlayers.length > 1 ?"s" : ""}</p><div className="mt-2 flex flex-wrap gap-2">{multiPlayers.map((player, index) => <Badge key={player.riotId} tone={index < 5 ?"cyan" : "slate"}>{ROSTER_ROLE_ORDER[index] || "SUB"} · {player.riotId}</Badge>)}</div></div>}
            <Button type="submit" disabled={saving} icon={saving ?Loader2 : Plus} className="w-full">Créer la team</Button>
          </form>
        </Surface>

        <Surface glow>
          <h3 className="text-xl font-black text-white">Rejoindre une team</h3>
          <p className="mt-1 text-sm text-slate-500">Demande au coach, manager ou capitaine un code temporaire. Il expire après 1h.</p>
          <form onSubmit={joinTeam} className="mt-5 space-y-4">
            <TextInput label="Code d’invitation" value={joinCode} onChange={setJoinCode} placeholder="NXT5-ABC123" required icon={UserPlus} />
            <Button type="submit" disabled={saving || !joinCode.trim()} icon={saving ?Loader2 : ArrowRight} className="w-full">Rejoindre la team</Button>
          </form>
        </Surface>

      </div>

      {selectedTeam && <Surface glow>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h3 className="text-2xl font-black text-white">{selectedTeam.name}</h3><p className="mt-1 text-sm text-slate-500">Roster, lien d’invitation et joueurs liés à la structure.</p></div>
          <div className="flex flex-wrap gap-2"><Badge tone="purple">{selectedTeam.tag || "TEAM"}</Badge><Button variant="ghost" icon={syncingMostPlayed ?Loader2 : Crown} onClick={syncMostPlayed} disabled={syncingMostPlayed || riotCooldownSeconds > 0 || !gameplayRoster.length || !canManageTeam}>{syncingMostPlayed ? "Analyse en cours..." : riotCooldownSeconds > 0 ? `Riot ${formatCountdown(riotCooldownSeconds)}` : "Analyser profils"}</Button><Button variant="ghost" icon={Clipboard} onClick={copyMultiOpggLink} disabled={!gameplayRoster.length}>Copier Multi OP.GG</Button></div>
        </div>

        <>
          <form onSubmit={createPlayer} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <TextInput label="Nom" value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder="Nom du joueur ou staff" required />
            <TextInput label="Riot ID" value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder={isStaffRole(playerForm.role) ?"Optionnel pour staff" : "Pseudo#TAG"} required={!isStaffRole(playerForm.role)} disabled={isStaffRole(playerForm.role)} />
            <TextInput label="OP.GG" value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder={isStaffRole(playerForm.role) ?"Non utilisé pour staff" : "https://op.gg/..."} disabled={isStaffRole(playerForm.role)} />
            <SelectInput label="Catégorie" value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role, riotId: isStaffRole(role) ? "" : playerForm.riotId, opggUrl: isStaffRole(role) ? "" : playerForm.opggUrl })}>{PROFILE_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</SelectInput>
            <div className="flex items-end"><Button type="submit" disabled={saving || !canManageTeam} icon={saving ?Loader2 : UserPlus} className="w-full">Ajouter</Button></div>
          </form>
          {!canManageTeam && <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">Ton rôle permet de consulter la team, mais pas de modifier le roster.</p>}
          {editingPlayer && <form onSubmit={updatePlayer} className="mt-5 rounded-[1.35rem] border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><Badge tone="orange">Modification</Badge><h4 className="mt-3 text-xl font-black text-white">Modifier {editingPlayer.name}</h4><p className="mt-1 text-sm font-semibold text-cyan-100/80">Corrige les infos du profil, puis enregistre. Les profils staff restent hors OP.GG.</p></div><Button type="button" variant="ghost" icon={X} onClick={closePlayerEdit}>Fermer</Button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <TextInput label="Nom" value={playerEditForm.name} onChange={(name) => setPlayerEditForm({ ...playerEditForm, name })} placeholder="Nom visible" required />
              <TextInput label="Riot ID" value={playerEditForm.riotId} onChange={(riotId) => setPlayerEditForm({ ...playerEditForm, riotId })} placeholder={isStaffRole(editingPlayer.role) ?"Non utilisé pour staff" : "Pseudo#TAG"} required={!isStaffRole(editingPlayer.role)} disabled={isStaffRole(editingPlayer.role)} />
              <TextInput label="OP.GG" value={playerEditForm.opggUrl} onChange={(opggUrl) => setPlayerEditForm({ ...playerEditForm, opggUrl })} placeholder={isStaffRole(editingPlayer.role) ?"Non utilisé pour staff" : "https://op.gg/..."} disabled={isStaffRole(editingPlayer.role)} />
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={closePlayerEdit}>Annuler</Button><Button type="submit" icon={saving ?Loader2 : Check} disabled={saving || !canManageTeam}>Enregistrer</Button></div>
          </form>}
          <PremiumRosterTable roster={roster} region={selectedTeam.region} currentUserId={user?.id} canManage={canManageTeam} saving={saving} syncingPlayerId={syncingPlayerId} riotCooldownSeconds={riotCooldownSeconds} onCopyOpgg={copyPlayerOpggLink} onSyncPlayer={syncPlayerMostPlayed} onEditPlayer={openPlayerEdit} onDeletePlayer={deletePlayer} />
        </>
      </Surface>}
    </div>
  </div>;
}

function formatPoints(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${Math.round(number / 1000)}k`;
  return String(number);
}

function formatCountdown(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

function InviteCodesPanel({ inviteCodes = [], nowTick }) {
  const activeCodes = inviteCodes.filter((code) => new Date(code.expires_at).getTime() > nowTick);
  return <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/8 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/70">Codes actifs</p><h4 className="mt-1 text-xl font-black text-white">Invitations temporaires</h4></div><Badge tone="cyan">Valables 1h</Badge></div><div className="mt-4 space-y-2">{activeCodes.length ? activeCodes.map((code) => { const remaining = Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - nowTick) / 1000)); return <div key={code.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-mono text-lg font-black tracking-[0.08em] text-white">{code.code}</p><p className="mt-1 text-xs font-semibold text-slate-500">Créé par {code.created_by_name || "staff"} · suppression automatique à expiration</p></div><Badge tone={remaining > 900 ? "green" : remaining > 300 ? "yellow" : "red"}>{formatCountdown(remaining)}</Badge></div>; }) : <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-slate-500">Aucun code actif. Génère un code pour inviter quelqu’un pendant 1h.</p>}</div></div>;
}

function TeamManagementPanel({ team, edit, setEdit, onAvatarFile, onSaveTeam, onCopyInvite, canManage, canDeleteTeam, members, roster, inviteCodes = [], saving, onRoleChange, onLink, onRemoveMember, onDeletePlayer, onDeleteTeam }) {
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const linkedPlayerByUser = new Map(roster.filter((player) => player.user_id).map((player) => [player.user_id, player]));
  const memberByUser = new Map(members.map((member) => [member.user_id, member]));
  const unlinkedMemberRows = members.filter((member) => !linkedPlayerByUser.has(member.user_id));
  const linkedCount = roster.filter((player) => player.user_id).length;
  const unlinkedMembers = unlinkedMemberRows.length;
  const unlinkedRoster = roster.filter((player) => !player.user_id).length;
  const roleValue = (role) => String(role || "player").toLowerCase() === "captain" ?"captain" : String(role || "").toLowerCase() === "coach" ?"coach" : "player";
  const linkedProfileLabel = (member) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    const accountName = member.name || member.account_name || "Compte NXT5";
    return linked ? `${accountName} · ${linked.riot_id || roleLabel(linked.role)}` : `${accountName} · Non-lié`;
  };
  const isLinkedElsewhere = (member, player) => {
    const linked = linkedPlayerByUser.get(member.user_id);
    return Boolean(linked && linked.id !== player.id);
  };
  return (
    <Surface glow className="mb-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><Badge tone="cyan">Gestion</Badge><h3 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Gestion de la team</h3><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">Modifie l'identité de l'équipe, les accès et les liaisons entre comptes NXT5 et profils Riot.</p></div><Badge tone="cyan">{members.length} compte{members.length > 1 ?"s" : ""}</Badge></div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-emerald-100/75">Profils liés</p><p className="mt-2 text-3xl font-black text-white">{linkedCount}<span className="text-base text-slate-500">/{roster.length}</span></p></div>
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-cyan-100/75">Comptes non liés</p><p className="mt-2 text-3xl font-black text-white">{unlinkedMembers}</p></div>
        <div className="rounded-2xl border border-violet-300/15 bg-violet-400/10 p-4"><p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-violet-100/75">Slots à associer</p><p className="mt-2 text-3xl font-black text-white">{unlinkedRoster}</p></div>
      </div>
      <form onSubmit={onSaveTeam} className="mt-8 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="mx-auto h-48 w-48 overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-black/30">{edit.avatarDataUrl ?<img src={edit.avatarDataUrl} alt={team.name} className="h-full w-full object-cover" style={{ transform: "scale(" + Number(edit.avatarZoom || 1) + ")", objectPosition: Number(edit.avatarX ?? 50) + "% " + Number(edit.avatarY ?? 50) + "%" }} /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-12 w-12 text-slate-600" /></div>}</div><label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-white/[0.07]"><Upload className="h-4 w-4" /> Choisir une image<input type="file" accept="image/*" className="hidden" onChange={(event) => onAvatarFile(event.target.files?.[0])} disabled={!canManage || saving} /></label><div className="mt-5 space-y-4"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Zoom</span><input type="range" min="1" max="2.5" step="0.05" value={edit.avatarZoom} onChange={(event) => setEdit({ ...edit, avatarZoom: event.target.value })} disabled={!canManage || saving} className="w-full" /></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Cadrage horizontal</span><input type="range" min="0" max="100" value={edit.avatarX} onChange={(event) => setEdit({ ...edit, avatarX: event.target.value })} disabled={!canManage || saving} className="w-full" /></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Cadrage vertical</span><input type="range" min="0" max="100" value={edit.avatarY} onChange={(event) => setEdit({ ...edit, avatarY: event.target.value })} disabled={!canManage || saving} className="w-full" /></label></div></div>
        <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><TextInput label="Nom de l'équipe" value={edit.name} onChange={(name) => setEdit({ ...edit, name })} placeholder="Nom" required icon={Trophy} /><TextInput label="Tag" value={edit.tag} onChange={(tag) => setEdit({ ...edit, tag })} placeholder="TAG" required icon={Shield} /></div><div className="flex flex-wrap gap-2"><Button type="submit" icon={saving ?Loader2 : Check} disabled={saving || !canManage}>Enregistrer</Button><Button type="button" variant="ghost" icon={saving ?Loader2 : UserPlus} onClick={onCopyInvite} disabled={saving || !canManage}>Créer un code d’invitation · 1h</Button>{canDeleteTeam && <Button type="button" variant="danger" icon={saving ?Loader2 : Trash2} onClick={onDeleteTeam} disabled={saving}>Supprimer la team</Button>}</div><InviteCodesPanel inviteCodes={inviteCodes} nowTick={nowTick} />{!canManage && <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">Ton statut actuel ne permet pas de modifier la gestion.</p>}</div>
      </form>
      <div className="mt-10 space-y-8"><div><div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h4 className="text-xl font-black text-white">Profils & accès</h4><p className="mt-1 text-sm font-semibold text-slate-500">Chaque profil gère sa liaison de compte et son niveau d'accès au même endroit.</p></div><Badge tone="purple">{roster.length} profil{roster.length > 1 ?"s" : ""}</Badge></div><div className="grid gap-4 xl:grid-cols-2">{roster.map((player) => { const linkedMember = player.user_id ? memberByUser.get(player.user_id) : null; return <div key={player.id} className={cx("rounded-3xl border p-5 transition", player.user_id ? "border-emerald-300/20 bg-emerald-400/[0.055]" : "border-cyan-300/18 bg-cyan-400/[0.045]")}><div className="flex min-h-[360px] flex-col gap-4"><div className="flex items-start justify-between gap-3"><LinkedPlayerSummary player={player} linkedMember={linkedMember} /><Badge tone={player.user_id ? "green" : "orange"}>{player.user_id ? "Associé" : "Non-lié"}</Badge></div><div className="grid gap-3 md:grid-cols-2"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Compte lié</span><select value={player.user_id || ""} onChange={(event) => onLink(player.id, event.target.value)} disabled={saving || !canManage} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="">Non-lié</option>{members.map((member) => { const blocked = isLinkedElsewhere(member, player); return <option key={member.user_id} value={member.user_id} disabled={blocked}>{linkedProfileLabel(member)} · {profileStatusLabel(member)}{blocked ? " · Déjà lié" : ""}</option>; })}</select></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Accès</span><select value={linkedMember ? roleValue(linkedMember.role) : "player"} onChange={(event) => linkedMember && onRoleChange(linkedMember.user_id, event.target.value)} disabled={!linkedMember || saving || !canManage || String(linkedMember?.role || "").toLowerCase() === "owner"} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="player">Joueur</option><option value="coach">Coach</option><option value="captain">Capitaine</option></select></label></div>{linkedMember ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/[0.18] p-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Compte NXT5</p><p className="mt-1 text-sm font-black text-white">{linkedMember.name || linkedMember.account_name || "Compte NXT5"}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={profileStatusTone(linkedMember)}>{profileStatusLabel(linkedMember)}</Badge><Badge tone="green">Profil lié</Badge></div></div><Button type="button" variant="danger" icon={UserMinus} onClick={() => onRemoveMember(linkedMember.user_id, `${roleLabel(player.role)} · ${linkedMember.name || player.name}`)} disabled={saving || !canManage || String(linkedMember.role || "").toLowerCase() === "owner"}>Renvoyer</Button></div> : <p className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4 text-sm font-semibold text-cyan-100">Aucun compte lié à ce profil.</p>}<Button type="button" variant="danger" icon={Trash2} onClick={() => onDeletePlayer(player.id, player.name)} disabled={saving || !canManage}>Supprimer ce profil</Button></div></div>; })}</div></div>{unlinkedMemberRows.length > 0 && <div><h4 className="mb-4 text-xl font-black text-white">Comptes sans profil</h4><div className="grid gap-3 xl:grid-cols-2">{unlinkedMemberRows.map((member) => <div key={member.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap gap-2"><Badge tone="slate">Non-lié</Badge><Badge tone={profileStatusTone(member)}>{profileStatusLabel(member)}</Badge></div><p className="mt-2 text-sm font-semibold text-slate-400">{member.name || member.account_name || "Compte invité"} sans profil roster associé.</p></div><div className="flex flex-wrap gap-2"><select value={roleValue(member.role)} onChange={(event) => onRoleChange(member.user_id, event.target.value)} disabled={saving || !canManage || String(member.role || "").toLowerCase() === "owner"} className="rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="player">Joueur</option><option value="coach">Coach</option><option value="captain">Capitaine</option></select><Button type="button" variant="danger" icon={UserMinus} onClick={() => onRemoveMember(member.user_id, member.name || "ce compte non lié")} disabled={saving || !canManage || String(member.role || "").toLowerCase() === "owner"}>Renvoyer</Button></div></div></div>)}</div></div>}</div>
    </Surface>
  );
}

function LinkedPlayerSummary({ player, linkedMember }) {
  const mostPlayed = parseMostPlayed(player.most_played).slice(0, 3);
  const staff = isStaffRole(player.role);
  const displayName = linkedMember?.name || linkedMember?.account_name || player.name;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={staff ?"purple" : "blue"}>{roleLabel(player.role)}</Badge><p className="text-2xl font-black text-white">{displayName}</p></div>
      <p className="mt-2 text-sm font-semibold text-slate-500">{player.riot_id || (staff ? "Profil staff sans Riot ID" : "Riot ID manquant")}</p>
      {staff ?<p className="mt-5 rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-sm font-semibold text-slate-300">Accès gestion possible si le compte est lié, mais exclu du draft, du Champion Pool, des imports OP.GG et des most played.</p> : (
        <div className="mt-5 flex flex-wrap gap-3">
          {mostPlayed.length ?mostPlayed.map((champion, index) => <ChampionCircle key={String(champion.championId) + "-" + champion.champion} champion={champion} index={index} />) : <div className="w-full rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-sm font-semibold text-slate-500">Most played non synchronisés. Lance "Analyser profils" pour remplir les champions.</div>}
        </div>
      )}
    </div>
  );
}

function ChampionCircle({ champion, index }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-cyan-200/30 bg-black/35">{champion.imageUrl ?<img src={champion.imageUrl} alt={champion.champion} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-lg font-black text-cyan-100">{index + 1}</div>}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{champion.champion}</p></div></div>;
}

function parseMostPlayed(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ?parsed : [];
  } catch {
    return [];
  }
}

function MostPlayedBadges({ value }) {
  const mostPlayed = parseMostPlayed(value).slice(0, 3);
  const items = mostPlayed;
  if (!items.length) return <span className="text-xs font-semibold text-slate-600">Non synchronisé</span>;
  return <div className="flex flex-wrap gap-2">{items.map((champion, index) => <ChampionCircle key={String(champion.championId || champion.champion) + "-" + index} champion={champion} index={index} />)}</div>;
}

function PremiumRosterTable({ roster, region = "EUW", currentUserId = "", canManage = false, saving = false, syncingPlayerId = "", riotCooldownSeconds = 0, onCopyOpgg, onSyncPlayer, onEditPlayer, onDeletePlayer }) {
  if (!roster.length) return <div className="mt-6"><EmptyState icon={UserPlus} title="Aucun profil" text="Ajoute tes joueurs et ton staff pour préparer les reviews." /></div>;
  return <div className="mt-6 overflow-x-auto rounded-[1.35rem] border border-white/10"><table className="w-full min-w-[940px] text-left text-sm"><thead className="sticky top-0 bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.18em] text-slate-600"><tr><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Riot ID</th><th className="px-4 py-3">Top 3 SoloQ</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/10">{roster.map((item) => {
    const staff = isStaffRole(item.role);
    const hasOpgg = !staff && Boolean(String(item.opgg_url || "").trim() || opggUrlFromRiotId(item.riot_id, region));
    const isLinkedToMe = String(item.user_id || "") === String(currentUserId || "");
    return <tr key={item.id} className="bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]"><td className="px-4 py-4"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/25">{isGameplayRole(item.role) ? <RoleIcon role={item.role} className="h-5 w-5" /> : <Users className="h-4 w-4 text-violet-200" />}</div><Badge tone={staff ?"purple" : "blue"}>{roleLabel(item.role)}</Badge></div></td><td className="px-4 py-4"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-white">{item.name}</span>{isLinkedToMe && <Badge tone="orange">Mon profil</Badge>}{item.user_id && !isLinkedToMe && <Badge tone="green">Lié</Badge>}</div></td><td className="px-4 py-4 font-semibold text-slate-500">{staff ? "Non utilisé" : item.riot_id || "Sans Riot ID"}</td><td className="px-4 py-4">{staff ?<span className="text-xs font-semibold text-slate-300">Hors draft / OP.GG</span> : <MostPlayedBadges value={item.most_played} />}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => onCopyOpgg?.(item)} disabled={!hasOpgg} title={staff ? "Pas d'OP.GG pour staff" : "Copier l'OP.GG"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-35"><Clipboard className="h-4 w-4" /></button><button type="button" onClick={() => onSyncPlayer?.(item)} disabled={staff || !canManage || saving || syncingPlayerId === item.id || riotCooldownSeconds > 0} title={riotCooldownSeconds > 0 ? `Riot ${formatCountdown(riotCooldownSeconds)}` : "Analyser ce profil"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-35">{syncingPlayerId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button><button type="button" onClick={() => onEditPlayer?.(item)} disabled={!canManage || saving} title="Modifier le profil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => onDeletePlayer?.(item.id, item.name)} disabled={!canManage || saving} title="Supprimer le profil" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button></div></td></tr>;
  })}</tbody></table></div>;
}

function MatchIdentityBadges({ rows }) {
  const ally = (rows || []).filter((row) => row.team_key === "ALLY");
  const enemy = (rows || []).filter((row) => row.team_key === "ENEMY");
  const allyIdentity = compositionIdentity(ally);
  const enemyIdentity = compositionIdentity(enemy);
  if (!ally.length && !enemy.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2"><Badge tone={championStyleTone(allyIdentity.primary)}>Nous: {allyIdentity.primary}</Badge>{enemy.length > 0 && <Badge tone={championStyleTone(enemyIdentity.primary)}>Eux: {enemyIdentity.primary}</Badge>}</div>;
}

function Matches({ data, refreshAll, selectedTeamId, pushToast, currentMember, user }) {
  const [gameId, setGameId] = useState("");
  const [importMeta, setImportMeta] = useState({ label: "", opponent: "" });
  const [importPlatform, setImportPlatform] = useState("EUW1");
  const [importing, setImporting] = useState(false);
  const [fileImporting, setFileImporting] = useState(false);
  const [codeForm, setCodeForm] = useState({ label: "", opponent: "", code: "", platform: "EUW1" });
  const [savingCode, setSavingCode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = data.matches.find((match) => match.id === selectedId) || data.matches[0];
  const rows = selected?.participants || [];
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null;
  const canManageCodes = selectedTeam && (selectedTeam.owner_id === user?.id || ["captain", "coach"].includes(String(currentMember?.role || "").toLowerCase()));
  const tournamentCodes = (data.tournamentCodes || []).filter((item) => item.team_id === selectedTeamId);
  function updateCodeForm(key, value) {
    setCodeForm((current) => ({ ...current, [key]: value }));
  }
  function updateImportMeta(key, value) {
    setImportMeta((current) => ({ ...current, [key]: value }));
  }
  async function saveTournamentCode(event, action = "create") {
    event.preventDefault();
    setSavingCode(true);
    try {
      await apiFetch("tournament-codes-manage", { method: "POST", body: JSON.stringify({ ...codeForm, action, teamId: selectedTeamId }) });
      setCodeForm({ label: "", opponent: "", code: "", platform: codeForm.platform });
      await refreshAll();
      pushToast({ type: "green", title: action === "generate" ? "Code généré" : "Code enregistré", text: "Il est prêt dans Review." });
    } catch (err) {
      pushToast(errorToast(err, action === "generate" ? "Génération impossible" : "Code impossible", "tournament-code"));
    } finally {
      setSavingCode(false);
    }
  }
  async function copyTournamentCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      pushToast({ type: "cyan", title: "Code copié", text: "Tu peux le coller dans le lobby LoL." });
    } catch {
      pushToast({ type: "red", title: "Copie impossible", text: "Le navigateur bloque le presse-papiers." });
    }
  }
  async function deleteTournamentCode(code) {
    if (!window.confirm(`Supprimer le code "${code.label}" ?`)) return;
    setSavingCode(true);
    try {
      await apiFetch("tournament-codes-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, codeId: code.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Code supprimé", text: "La liste Review est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSavingCode(false);
    }
  }
  async function importMatch(event) {
    event.preventDefault();
    const value = String(gameId || "").trim();
    const isGameId = /^([A-Z0-9]+)_\d+$/i.test(value);
    const payload = isGameId
      ? { gameId: value, teamId: selectedTeamId, label: importMeta.label, opponent: importMeta.opponent }
      : { tournamentCode: value, platform: importPlatform, teamId: selectedTeamId, label: importMeta.label, opponent: importMeta.opponent };
    setImporting(true);
    try {
      await apiFetch("matches-import", { method: "POST", body: JSON.stringify(payload) });
      setGameId("");
      setImportMeta({ label: "", opponent: "" });
      await refreshAll();
      pushToast({ type: "green", title: "Game importée", text: "Match analysé, participants lus et rapport prêt." });
    } catch (err) {
      pushToast(errorToast(err, "Import impossible", "match-import"));
    } finally {
      setImporting(false);
    }
  }
  async function importLocalFile(file) {
    if (!file) return;
    setFileImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await apiFetch("matches-import-file", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, payload, label: importMeta.label, opponent: importMeta.opponent }) });
      setImportMeta({ label: "", opponent: "" });
      await refreshAll();
      pushToast({ type: "green", title: "Fichier importé", text: "La game locale est analysée et ajoutée aux statistiques." });
    } catch (err) {
      if (err instanceof SyntaxError) pushToast({ type: "red", title: "Import fichier impossible", text: "Le fichier choisi n’est pas un JSON valide. Génère-le avec l’outil NXT5 Importer local." });
      else pushToast(errorToast(err, "Import fichier impossible", "match-import"));
    } finally {
      setFileImporting(false);
    }
  }

  const teamMatches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  return <div><PageHeader eyebrow="Intégration" title="Intégration des games" subtitle="Crée des codes tournoi, importe les games terminées et garde un historique clair des imports." /><div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,.84fr)_minmax(0,1.16fr)]"><Surface glow className="min-w-0"><div className="flex h-full flex-col justify-between gap-4"><div><h3 className="text-xl font-black text-white">Importer une game</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Colle un Game ID ou un code tournoi, même externe. Si c’est un code tournoi, NXT5 l’enregistre en parallèle puis l’importe.</p></div><form onSubmit={importMatch} className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)_140px]"><TextInput label="Nom de l’import" value={importMeta.label} onChange={(value) => updateImportMeta("label", value)} placeholder="Scrim vs KCorp, Tournoi round 1..." icon={FileText} /><TextInput label="Adversaire" value={importMeta.opponent} onChange={(value) => updateImportMeta("opponent", value)} placeholder="Équipe adverse" icon={Swords} /><SelectInput label="Serveur" value={importPlatform} onChange={setImportPlatform}><option value="EUW1">EUW</option><option value="EUN1">EUNE</option><option value="NA1">NA</option><option value="KR">KR</option></SelectInput><div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:col-span-3"><TextInput label="Game ID ou code tournoi" value={gameId} onChange={setGameId} placeholder="EUW1_7123456789 ou code Riot" required icon={Search} /><div className="flex items-end"><Button type="submit" icon={importing ? Loader2 : Search} disabled={importing || !selectedTeamId || !gameId.trim()}>Importer</Button></div></div></form><p className="text-xs font-semibold leading-5 text-slate-600">Les analyses détaillées sont maintenant dans l’onglet Statistiques.</p></div></Surface><Surface glow className="min-w-0"><div className="flex min-w-0 flex-col gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-white">Créer un code tournoi</h3><Badge tone={canManageCodes ? "green" : "slate"}>{canManageCodes ? "Staff" : "Lecture"}</Badge></div><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Prépare un code vierge, copie-le dans LoL, puis importe la game terminée depuis le bloc de gauche.</p></div><form onSubmit={(event) => saveTournamentCode(event, "create")} className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,.95fr)_minmax(0,.95fr)_140px_minmax(0,1.2fr)_auto]"><TextInput label="Nom" value={codeForm.label} onChange={(value) => updateCodeForm("label", value)} placeholder="Scrim vs..." required icon={Trophy} /><TextInput label="Adversaire" value={codeForm.opponent} onChange={(value) => updateCodeForm("opponent", value)} placeholder="Équipe adverse" icon={Swords} /><SelectInput label="Serveur" value={codeForm.platform} onChange={(value) => updateCodeForm("platform", value)}><option value="EUW1">EUW</option><option value="EUN1">EUNE</option><option value="NA1">NA</option><option value="KR">KR</option></SelectInput><TextInput label="Code tournoi" value={codeForm.code} onChange={(value) => updateCodeForm("code", value)} placeholder="Code Riot" icon={Clipboard} /><div className="flex items-end gap-2"><Button type="button" variant="ghost" icon={Wand2} onClick={(event) => saveTournamentCode(event, "generate")} disabled={!canManageCodes || savingCode || !codeForm.label.trim()}>{savingCode ? "..." : "Générer"}</Button><Button type="submit" icon={savingCode ? Loader2 : Plus} disabled={!canManageCodes || savingCode || !codeForm.label.trim() || !codeForm.code.trim()}>Ajouter</Button></div></form>{tournamentCodes.length > 0 ? <div className="max-h-64 min-w-0 space-y-2 overflow-auto pr-1">{tournamentCodes.map((code) => <div key={code.id} className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-black/25 p-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="min-w-0 truncate text-sm font-black text-white">{code.label || "Code tournoi"}</p><Badge tone={code.status === "imported" ? "green" : "orange"}>{code.status === "imported" ? "Importé" : "Prêt"}</Badge><Badge tone="slate">{code.platform || "EUW1"}</Badge></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{code.opponent || "Adversaire libre"}{code.imported_game_id ? " · Game liée : " + code.imported_game_id : ""}</p><p className="mt-2 max-w-full break-all rounded-lg border border-cyan-300/10 bg-cyan-400/8 px-2 py-1 font-mono text-[0.68rem] font-semibold leading-5 text-cyan-100/75">{code.code}</p></div><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" icon={Clipboard} onClick={() => copyTournamentCode(code.code)}>Copier</Button>{canManageCodes && <Button type="button" variant="ghost" icon={Trash2} onClick={() => deleteTournamentCode(code)} disabled={savingCode}>Supprimer</Button>}</div></div>)}</div> : <div className="rounded-2xl border border-dashed border-cyan-300/18 bg-cyan-400/6 p-4 text-sm font-semibold text-slate-400">Aucun code tournoi préparé pour cette team.</div>}</div></Surface></div><Surface glow className="mt-5"><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-white">Importer un fichier NXT5 local</h3><Badge tone="purple">Anti-blocage Riot</Badge></div><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Télécharge NXT5 Importer, génère un JSON sans clé Riot, puis importe-le ici. NXT5 finalise l’import côté serveur avec la config Netlify.</p></div><div className="flex flex-wrap justify-end gap-2"><a href={NXT5_IMPORTER_WINDOWS_URL} download className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/12 px-5 py-4 text-sm font-black text-fuchsia-50 transition hover:-translate-y-0.5 hover:border-fuchsia-200/55 hover:bg-fuchsia-400/18"><Download className="h-4 w-4" />Windows</a><a href={NXT5_IMPORTER_MAC_URL} download className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-black text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-cyan-300/[0.10]"><Download className="h-4 w-4" />Mac</a><label className={cx("flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-400/15", fileImporting ? "pointer-events-none opacity-60" : "")}>{fileImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{fileImporting ? "Import..." : "Choisir un JSON"}<input type="file" accept="application/json,.json" className="hidden" disabled={fileImporting || !selectedTeamId} onChange={(event) => { importLocalFile(event.target.files?.[0]); event.target.value = ""; }} /></label></div></div></Surface><Surface className="mt-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h3 className="text-xl font-black text-white">Historique des imports</h3><p className="mt-1 text-sm font-semibold text-slate-500">{teamMatches.length} game{teamMatches.length > 1 ? "s" : ""} importée{teamMatches.length > 1 ? "s" : ""} pour cette team.</p></div><Badge tone="cyan">Statistiques disponibles</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-2">{teamMatches.length ? teamMatches.map((match) => <div key={match.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-white">{match.opponent || match.game_id}</p><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge><Badge tone="slate">{match.side || "Side ?"}</Badge></div><p className="mt-1 truncate text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"}</p><p className="mt-3 text-sm font-bold text-cyan-100">{match.primary_focus || "Import prêt pour analyse"}</p></div>) : <EmptyState icon={Swords} title="Aucune game" text="Importe une première game pour alimenter les statistiques." />}</div></Surface></div>;

  return <div><PageHeader eyebrow="Analyse de match" title="Reviews & codes tournoi" subtitle="Crée tes codes d’un côté, puis importe les games terminées depuis le bloc d’analyse." /><div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,.84fr)_minmax(0,1.16fr)]"><Surface glow className="min-w-0"><div className="flex h-full flex-col justify-between gap-4"><div><h3 className="text-xl font-black text-white">Importer une game</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Colle un Game ID ou un code tournoi, même externe. Si c’est un code tournoi, NXT5 l’enregistre en parallèle puis l’importe.</p></div><form onSubmit={importMatch} className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)_140px]"><TextInput label="Nom de la review" value={importMeta.label} onChange={(value) => updateImportMeta("label", value)} placeholder="Scrim vs KCorp, Tournoi round 1..." icon={FileText} /><TextInput label="Adversaire" value={importMeta.opponent} onChange={(value) => updateImportMeta("opponent", value)} placeholder="Équipe adverse" icon={Swords} /><SelectInput label="Serveur" value={importPlatform} onChange={setImportPlatform}><option value="EUW1">EUW</option><option value="EUN1">EUNE</option><option value="NA1">NA</option><option value="KR">KR</option></SelectInput><div className="xl:col-span-3 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><TextInput label="Game ID ou code tournoi" value={gameId} onChange={setGameId} placeholder="EUW1_7123456789 ou code Riot" required icon={Search} /><div className="flex items-end"><Button type="submit" icon={importing ? Loader2 : Search} disabled={importing || !selectedTeamId || !gameId.trim()}>Importer</Button></div></div></form><p className="text-xs font-semibold leading-5 text-slate-600">Le cadran à droite sert à créer/préparer les codes. L’import réel se fait ici quand la game est terminée.</p></div></Surface><Surface glow className="min-w-0"><div className="flex min-w-0 flex-col gap-4"><div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-white">Créer un code tournoi</h3><Badge tone={canManageCodes ? "green" : "slate"}>{canManageCodes ? "Staff" : "Lecture"}</Badge></div><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Prépare un code vierge, copie-le dans LoL, puis importe la game depuis le bloc de gauche.</p></div></div><form onSubmit={(event) => saveTournamentCode(event, "create")} className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,.95fr)_minmax(0,.95fr)_140px_minmax(0,1.2fr)_auto]"><TextInput label="Nom" value={codeForm.label} onChange={(value) => updateCodeForm("label", value)} placeholder="Scrim vs..." required icon={Trophy} /><TextInput label="Adversaire" value={codeForm.opponent} onChange={(value) => updateCodeForm("opponent", value)} placeholder="Équipe adverse" icon={Swords} /><SelectInput label="Serveur" value={codeForm.platform} onChange={(value) => updateCodeForm("platform", value)}><option value="EUW1">EUW</option><option value="EUN1">EUNE</option><option value="NA1">NA</option><option value="KR">KR</option></SelectInput><TextInput label="Code tournoi" value={codeForm.code} onChange={(value) => updateCodeForm("code", value)} placeholder="Code Riot" icon={Clipboard} /><div className="flex items-end gap-2"><Button type="button" variant="ghost" icon={Wand2} onClick={(event) => saveTournamentCode(event, "generate")} disabled={!canManageCodes || savingCode || !codeForm.label.trim()}>{savingCode ? "..." : "Générer"}</Button><Button type="submit" icon={savingCode ? Loader2 : Plus} disabled={!canManageCodes || savingCode || !codeForm.label.trim() || !codeForm.code.trim()}>Ajouter</Button></div></form>{tournamentCodes.length > 0 ? <div className="max-h-64 min-w-0 space-y-2 overflow-auto pr-1">{tournamentCodes.map((code) => <div key={code.id} className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-black/25 p-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="min-w-0 truncate text-sm font-black text-white">{code.label || "Code tournoi"}</p><Badge tone={code.status === "imported" ? "green" : "orange"}>{code.status === "imported" ? "Importé" : "Prêt"}</Badge><Badge tone="slate">{code.platform || "EUW1"}</Badge></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{code.opponent || "Adversaire libre"}{code.imported_game_id ? " · Game liée : " + code.imported_game_id : ""}</p><p className="mt-2 max-w-full break-all rounded-lg border border-cyan-300/10 bg-cyan-400/8 px-2 py-1 font-mono text-[0.68rem] font-semibold leading-5 text-cyan-100/75">{code.code}</p></div><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" icon={Clipboard} onClick={() => copyTournamentCode(code.code)}>Copier</Button>{canManageCodes && <Button type="button" variant="ghost" icon={Trash2} onClick={() => deleteTournamentCode(code)} disabled={savingCode}>Supprimer</Button>}</div></div>)}</div> : <div className="rounded-2xl border border-dashed border-cyan-300/18 bg-cyan-400/6 p-4 text-sm font-semibold text-slate-400">Aucun code tournoi préparé pour cette team.</div>}</div></Surface></div><div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(360px,.62fr)_1.38fr]"><Surface><h3 className="text-xl font-black text-white">Historique</h3><div className="mt-4 space-y-2">{data.matches.length ? data.matches.map((match) => <button key={match.id} onClick={() => setSelectedId(match.id)} className={cx("group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5", selected?.id === match.id ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div className="flex flex-wrap items-center gap-2"><p className="font-black text-white">{match.opponent || match.game_id}</p><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"}</p><p className="mt-3 text-sm font-bold text-cyan-100">{match.primary_focus || "Analyse qui sert vraiment à calculer"}</p></button>) : <EmptyState icon={Swords} title="Aucune game" text="L’historique apparaîtra ici après ton premier import." />}</div></Surface><Surface glow>{selected ? <><div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h3 className="text-2xl font-black text-white">{selected.opponent || "Match analysé"}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{selected.game_id} · {selected.duration || "--:--"} · {selected.side || "Side ?"}</p></div><div className="flex flex-wrap gap-2"><Badge tone={selected.result === "Victoire" ? "green" : "red"}>{selected.result || "Analyse"}</Badge><Badge tone={gradeTone(selected.impact_score)}>{selected.impact_score || "—"}</Badge></div></div><div className="mb-5 grid gap-3 md:grid-cols-3"><MetricCard icon={Goal} label="Objectifs" value={selected.objective_score} hint="Dragons / Barons / Tours" tone="green" /><MetricCard icon={Eye} label="Vision" value={selected.vision_score} hint="Différence équipe" tone="cyan" /><MetricCard icon={Activity} label="Impact" value={selected.impact_score} hint={selected.primary_focus} tone="purple" /></div><ReviewSignalPanel match={selected} rows={rows} /><ParticipantTable rows={rows} /></> : <EmptyState icon={Swords} title="Sélectionne ou importe une game" text="Les analyses de match apparaissent ici après un import." />}</Surface></div></div>;
}

function StatMeter({ label, value, max, tone = "cyan", detail }) {
  const pct = Math.max(4, Math.min(100, Math.round((Number(value || 0) / Math.max(1, Number(max || 1))) * 100)));
  const colors = {
    cyan: "from-cyan-300 to-blue-500",
    purple: "from-violet-300 to-fuchsia-500",
    green: "from-emerald-300 to-cyan-400",
    orange: "from-orange-300 to-fuchsia-400",
  };
  return <div><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span><span className="text-xs font-black text-white">{detail || value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/8"><div className={cx("h-full rounded-full bg-gradient-to-r", colors[tone] || colors.cyan)} style={{ width: `${pct}%` }} /></div></div>;
}

function PlayerStatCard({ stat, maxDamage, maxVision, maxGold }) {
  const kda = ((stat.kills + stat.assists) / Math.max(1, stat.deaths)).toFixed(2);
  const avg = (value) => (value / Math.max(1, stat.games)).toFixed(1);
  const topChampions = Array.from(stat.champions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return <Surface glow className="p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">{stat.role || "ROLE"}</Badge><Badge tone={stat.winrate >= 55 ? "green" : stat.winrate >= 45 ? "yellow" : "red"}>{stat.winrate}% WR</Badge></div><h3 className="mt-3 truncate text-2xl font-black text-white">{stat.name}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{stat.games} game{stat.games > 1 ? "s" : ""} importée{stat.games > 1 ? "s" : ""}</p></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-600">KDA</p><p className="mt-1 text-xl font-black text-white">{kda}</p></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-600">KP</p><p className="mt-1 text-xl font-black text-white">{avg(stat.kp)}%</p></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-600">CS/min</p><p className="mt-1 text-xl font-black text-white">{avg(stat.csPerMin)}</p></div></div></div><div className="mt-5 grid gap-3"><StatMeter label="Dégâts moyens" value={stat.damage / Math.max(1, stat.games)} max={maxDamage} detail={formatPoints(stat.damage / Math.max(1, stat.games))} tone="purple" /><StatMeter label="Vision moyenne" value={stat.vision / Math.max(1, stat.games)} max={maxVision} detail={avg(stat.vision)} tone="cyan" /><StatMeter label="Gold moyen" value={stat.gold / Math.max(1, stat.games)} max={maxGold} detail={formatPoints(stat.gold / Math.max(1, stat.games))} tone="orange" /></div><div className="mt-5 flex flex-wrap gap-2">{topChampions.length ? topChampions.map(([champion, count]) => <div key={champion} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3"><img src={championLoadingUrl(champion)} alt={champion} className="h-8 w-8 rounded-full object-cover" /><span className="text-xs font-black text-white">{championDisplayName(champion)} x{count}</span></div>) : <Badge tone="slate">Pas encore de champion</Badge>}</div></Surface>;
}

function Statistics({ data, selectedTeamId }) {
  const matches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const rows = matches.flatMap((match) => (match.participants || []).filter((row) => row.team_key === "ALLY"));
  const stats = Array.from(rows.reduce((map, row) => {
    const key = row.player_id || row.riot_id || row.summoner_name || `${row.role}-${row.champion}`;
    const current = map.get(key) || { key, name: row.summoner_name || row.riot_id || "Profil", role: row.role || "ROLE", games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, vision: 0, gold: 0, kp: 0, csPerMin: 0, champions: new Map() };
    current.games += 1;
    current.wins += matches.find((match) => match.id === row.match_id)?.result === "Victoire" ? 1 : 0;
    current.kills += Number(row.kills || 0);
    current.deaths += Number(row.deaths || 0);
    current.assists += Number(row.assists || 0);
    current.damage += Number(row.damage || 0);
    current.vision += Number(row.vision || 0);
    current.gold += Number(row.gold || 0);
    current.kp += Number(row.kill_participation || row.kp || 0);
    current.csPerMin += Number(row.cs_per_min || 0);
    current.champions.set(row.champion, (current.champions.get(row.champion) || 0) + 1);
    current.winrate = Math.round((current.wins / Math.max(1, current.games)) * 100);
    map.set(key, current);
    return map;
  }, new Map()).values()).sort((a, b) => ROSTER_ROLE_ORDER.indexOf(a.role) - ROSTER_ROLE_ORDER.indexOf(b.role));
  const maxDamage = Math.max(1, ...stats.map((stat) => stat.damage / Math.max(1, stat.games)));
  const maxVision = Math.max(1, ...stats.map((stat) => stat.vision / Math.max(1, stat.games)));
  const maxGold = Math.max(1, ...stats.map((stat) => stat.gold / Math.max(1, stat.games)));
  const wins = matches.filter((match) => match.result === "Victoire").length;
  return <div><PageHeader eyebrow="Performance" title="Statistiques" subtitle="Lis les performances profil par profil à partir des games importées dans NXT5." />{matches.length ? <><div className="grid gap-3 md:grid-cols-4"><MetricCard icon={Swords} label="Games importées" value={matches.length} hint="Base statistique" tone="cyan" /><MetricCard icon={Trophy} label="Winrate team" value={`${Math.round((wins / Math.max(1, matches.length)) * 100)}%`} hint={`${wins} victoire${wins > 1 ? "s" : ""}`} tone="green" /><MetricCard icon={Users} label="Profils lus" value={stats.length} hint="Joueurs détectés" tone="purple" /><MetricCard icon={BarChart3} label="Lignes data" value={rows.length} hint="Participants alliés" tone="yellow" /></div><div className="mt-5 grid gap-5 xl:grid-cols-2">{stats.map((stat) => <PlayerStatCard key={stat.key} stat={stat} maxDamage={maxDamage} maxVision={maxVision} maxGold={maxGold} />)}</div></> : <Surface glow><EmptyState icon={BarChart3} title="Aucune statistique" text="Importe une game dans Intégration pour alimenter les graphiques." /></Surface>}</div>;
}

function ReviewSignalPanel({ match, rows }) {
  const ally = rows.filter((row) => row.team_key === "ALLY");
  const enemy = rows.filter((row) => row.team_key === "ENEMY");
  const sum = (items, key) => items.reduce((total, row) => total + Number(row[key] || 0), 0);
  const allyDamage = sum(ally, "damage");
  const enemyDamage = sum(enemy, "damage");
  const allyVision = sum(ally, "vision");
  const enemyVision = sum(enemy, "vision");
  const allyGold = sum(ally, "gold");
  const enemyGold = sum(enemy, "gold");
  const topDamage = ally.slice().sort((a, b) => Number(b.damage || 0) - Number(a.damage || 0))[0];
  const topVision = ally.slice().sort((a, b) => Number(b.vision || 0) - Number(a.vision || 0))[0];
  const goldDiff = allyGold - enemyGold;
  const damageDiff = allyDamage - enemyDamage;
  const visionDiff = allyVision - enemyVision;
  const identity = compositionIdentity(ally);
  const signals = [
    [Target, "Plan de jeu", match?.primary_focus || identity.text, damageDiff >= 0 ? "green" : "yellow"],
    [Eye, "Vision", (visionDiff >= 0 ? "+" : "") + formatPoints(visionDiff) + " vision score vs adversaire", visionDiff >= 0 ? "cyan" : "red"],
    [Goal, "Economie", (goldDiff >= 0 ? "+" : "") + formatPoints(goldDiff) + " gold équipe", goldDiff >= 0 ? "green" : "red"],
  ];
  if (!rows.length) return null;
  return <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_.72fr]"><div className="grid gap-3 md:grid-cols-3">{signals.map(([Icon, title, value, t]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">{title}</p><div className={cx("rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><p className="mt-3 text-sm font-black leading-6 text-white">{value}</p></div>)}</div><div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Identité de Compo</p><Badge tone={championStyleTone(identity.primary)}>{tagLabel(identity.primary)}</Badge></div><p className="mt-3 text-sm font-bold leading-6 text-white">{identity.text}</p><div className="mt-3 flex flex-wrap gap-2">{identity.tags.length ? identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Standard</Badge>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{[["Damage lead", topDamage], ["Vision lead", topVision]].map(([label, row]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2"><div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-black/30">{row ? <img src={championIconUrl(row) || championLoadingUrl(row.champion)} alt={row.champion} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "À remplir"}</p><p className="truncate text-xs font-semibold text-slate-500">{label} · {row ? championDisplayName(row.champion) : "Importe une game"}</p></div></div>)}</div></div></div>;
}

function ParticipantTable({ rows }) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALLY");
  const maxDamage = Math.max(1, ...rows.map((row) => Number(row.damage || 0)));
  const maxGold = Math.max(1, ...rows.map((row) => Number(row.gold || 0)));
  const filtered = rows.filter((row) => { const rowText = String(row.summoner_name || "") + " " + String(row.champion || "") + " " + String(row.role || ""); return rowText.toLowerCase().includes(query.toLowerCase()) && (teamFilter === "ALL" || row.team_key === teamFilter); });
  if (!rows.length) return <EmptyState icon={BarChart3} title="Participants non calculés" text="Importe une game Riot pour afficher les champions, KDA, dégâts, gold et vision." />;
  return <div><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="w-full md:max-w-sm"><TextInput label="Rechercher" value={query} onChange={setQuery} placeholder="Champion, joueur, rôle..." icon={Search} /></div><div className="flex gap-2">{[["ALLY", "Nous"], ["ENEMY", "Eux"], ["ALL", "Tous"]].map(([id, label]) => <button key={id} onClick={() => setTeamFilter(id)} className={cx("rounded-2xl border px-4 py-2 text-sm font-black transition", teamFilter === id ?"border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.07]")}>{label}</button>)}</div></div><div className="grid gap-3">{filtered.map((row) => <div key={row.id} className={cx("grid gap-4 rounded-[1.35rem] border p-4 transition md:grid-cols-[1.5fr_.9fr_.9fr_.9fr_.65fr] md:items-center", row.team_key === "ALLY" ?"border-cyan-300/20 bg-cyan-400/8" : "border-rose-300/15 bg-rose-500/7")}><div className="flex min-w-0 items-center gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">{championIconUrl(row) ?<img src={championIconUrl(row)} alt={row.champion} className="h-full w-full object-cover" /> : <img src={championLoadingUrl(row.champion)} alt={row.champion} className="h-full w-full object-cover" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={row.team_key === "ALLY" ?"cyan" : "red"}>{row.role || "?"}</Badge><Badge tone={gradeTone(row.grade)}>{row.grade || "?"}</Badge></div><p className="mt-1 truncate text-lg font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-sm font-semibold text-slate-500">{row.summoner_name || row.riot_id || "?"}</p></div></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">KDA</p><p className="mt-1 text-lg font-black text-white">{row.kda}</p><p className="text-xs font-semibold text-slate-500">KP {row.kill_participation}</p></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Dégâts</p><p className="mt-1 text-lg font-black text-white">{formatPoints(row.damage)}</p><StatBar value={row.damage} max={maxDamage} tone={row.team_key === "ALLY" ?"cyan" : "red"} /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Gold / CS</p><p className="mt-1 text-lg font-black text-white">{formatPoints(row.gold)}</p><p className="text-xs font-semibold text-slate-500">{row.cs} CS · {row.cs_per_min}/min</p><StatBar value={row.gold} max={maxGold} tone="yellow" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Vision</p><p className="mt-1 text-lg font-black text-white">{row.vision}</p></div></div>)}</div></div>;
}

function ChampionPoolCard({ row }) {
  const winrate = Number(row.winrate || 0);
  const toneName = winrate >= 55 ? "green" : winrate <= 40 ? "red" : "yellow";
  const styleTags = championStyleTags(row.champion).slice(0, 3);
  return <div className="group relative min-h-[340px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-5"><img src={championSplashUrl(row.champion)} alt={row.champion} className="absolute inset-0 h-full w-full object-cover opacity-36 transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#050711] via-[#050711]/78 to-[#050711]/20" /><div className="relative z-10 flex h-full flex-col justify-between"><div><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/70">{row.player_name}</p><h3 className="mt-2 text-3xl font-black text-white">{championDisplayName(row.champion)}</h3></div><Badge tone={gradeTone(row.impact_grade)}>{row.impact_grade || "?"}</Badge></div><div className="mt-4 flex flex-wrap gap-2">{styleTags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div><p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{row.verdict || "Données insuffisantes"}</p></div><div className="mt-8 grid gap-3"><div className="grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-black/35 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">Games</p><p className="mt-1 text-xl font-black text-white">{row.games}</p></div><div className="rounded-2xl border border-white/10 bg-black/35 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">WR</p><p className="mt-1 text-xl font-black text-white">{row.winrate}%</p></div><div className="rounded-2xl border border-white/10 bg-black/35 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">KDA</p><p className="mt-1 text-xl font-black text-white">{Number(row.kda || 0).toFixed(1)}</p></div></div><StatBar value={winrate} max={100} tone={toneName} /><div className="flex flex-wrap gap-2"><Badge tone={toneName}>{row.wins || 0}W / {row.losses || 0}L</Badge><Badge tone="slate">{row.cs_per_min || "?"} CS/min</Badge></div></div></div></div>;
}

function championPoolStatus(row) {
  const status = String(row?.status || "");
  return ["lock", "pocket", "work", "danger"].includes(status) ? status : "work";
}

function championPoolStatusLabel(status) {
  return status === "lock" ? "Maîtrisé" : status === "danger" ? "À apprendre" : status === "pocket" ? "Confort" : "Moyens";
}

function championPoolStatusTone(status) {
  return status === "lock" ? "green" : status === "danger" ? "red" : status === "pocket" ? "yellow" : "cyan";
}

function ManualChampionPoolPanel({ players, rows, selectedTeamId, canManage, refreshAll, pushToast }) {
  const playablePlayers = players.filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role));
  const manualRows = rows.filter((row) => row.team_id === selectedTeamId && ["manual", "riot_manual"].includes(String(row.source || "")));
  const [form, setForm] = useState({ playerId: "", champion: "", status: "lock", notes: "" });
  const [saving, setSaving] = useState(false);
  const selectedPlayer = playablePlayers.find((player) => player.id === form.playerId);

  useEffect(() => {
    if (!form.playerId && playablePlayers[0]?.id) setForm((current) => ({ ...current, playerId: playablePlayers[0].id }));
  }, [playablePlayers.map((player) => player.id).join("|")]);

  async function saveManualPick(event) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, ...form }) });
      setForm((current) => ({ ...current, champion: "", notes: "" }));
      await refreshAll();
      pushToast({ type: "green", title: "Champion ajouté", text: "Le Champion Pool est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteManualPick(poolId) {
    if (!canManage || !window.confirm("Retirer ce pick du Champion Pool ?")) return;
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, poolId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Pick retiré", text: "Le Champion Pool est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return <Surface glow className="mb-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div><Badge tone="purple">Configuration</Badge><h3 className="mt-4 text-2xl font-black text-white">Champion Pool déclaré</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Ajoute les champions que chaque joueur sait jouer. Ils apparaissent dans les filtres, la draft et l’identité de Compo.</p></div><Badge tone={canManage ? "green" : "yellow"}>{canManage ? "Modifiable" : "Lecture seule"}</Badge></div>{playablePlayers.length ? <form onSubmit={saveManualPick} className="mt-6 grid gap-3 xl:grid-cols-[1fr_1fr_.8fr_1fr_auto]"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Joueur</span><select value={form.playerId} onChange={(event) => setForm({ ...form, playerId: event.target.value })} disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-black text-white outline-none">{playablePlayers.map((player) => <option key={player.id} value={player.id}>{player.role} · {player.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Champion</span><input list="champion-options" value={form.champion} onChange={(event) => setForm({ ...form, champion: event.target.value })} placeholder="Kai'Sa, Orianna..." required disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-650" /><datalist id="champion-options">{championOptions().map((champion) => <option key={champion} value={championDisplayName(champion)} />)}</datalist></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Statut</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-black text-white outline-none"><option value="lock">À Pick</option><option value="pocket">Pocket</option><option value="work">Moyens</option><option value="danger">À apprendre</option></select></label><TextInput label="Note" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} placeholder={selectedPlayer ? "Ex: blindable, counterpick..." : "Note staff"} icon={Clipboard} /><div className="flex items-end"><Button type="submit" disabled={!canManage || saving || !form.playerId || !form.champion.trim()} icon={saving ? Loader2 : Plus} className="w-full">Ajouter</Button></div></form> : <EmptyState icon={Users} title="Aucun joueur" text="Ajoute le roster avant de configurer le Champion Pool." />}{manualRows.length > 0 && <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Picks déclarés</p><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{manualRows.map((row) => <div key={row.id} className="w-[260px] shrink-0 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center gap-3"><img src={championSquareUrl(row)} alt={row.champion} className="h-12 w-12 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-xs font-semibold text-slate-500">{row.role || "ROLE"} · {row.player_name}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone={row.status === "lock" ? "green" : row.status === "danger" ? "red" : row.status === "pocket" ? "yellow" : "slate"}>{championPoolStatusLabel(row.status)}</Badge>{championStyleTags(row.champion).slice(0, 2).map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div>{row.notes && <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{row.notes}</p>}{canManage && <button type="button" onClick={() => deleteManualPick(row.id)} disabled={saving} className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-rose-200 hover:text-white">Retirer</button>}</div>)}</div></div>}</Surface>;
}

function ChampionPoolRecommendationPanel({ rows }) {
  const locks = rows.filter((row) => championPoolStatus(row) === "lock").slice(0, 3);
  const danger = rows.filter((row) => championPoolStatus(row) === "danger").slice(0, 3);
  const pockets = rows.filter((row) => championPoolStatus(row) === "pocket").slice(0, 3);
  const groups = [
    [Crown, "Picks À Pick", locks, "green"],
    [AlertTriangle, "Picks à revoir", danger, "red"],
    [Flame, "Pocket Picks", pockets, "yellow"],
  ];
  return <div className="mb-5 grid gap-3 xl:grid-cols-3">{groups.map(([Icon, title, items, t]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{title}</p><div className={cx("rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><div className="mt-3 space-y-2">{items.length ? items.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2"><img src={championSquareUrl(row)} alt={row.champion} className="h-9 w-9 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-xs font-semibold text-slate-500">{row.player_name || "Roster"} · {row.winrate || 0}% WR · {row.games || 0} games</p></div></div>) : <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm font-semibold text-slate-500">Pas assez de données.</p>}</div></div>)}</div>;
}

const CHAMPION_TIERS = [
  { id: "lock", title: "Maîtrisé", hint: "Pick fiable, prêt pour scrim ou match.", tone: "green" },
  { id: "pocket", title: "Confort", hint: "Bon pick, souvent situationnel ou à garder en option.", tone: "yellow" },
  { id: "work", title: "Moyens", hint: "Jouable, mais pas encore assez solide pour être prioritaire.", tone: "cyan" },
  { id: "danger", title: "À apprendre", hint: "À reprendre tranquillement avant de le sortir en game importante.", tone: "red" },
];

const CHAMPION_LANE_POOLS = {
  TOP: ["Aatrox", "Camille", "Chogath", "Darius", "DrMundo", "Fiora", "Gangplank", "Garen", "Gnar", "Gwen", "Irelia", "Jax", "Jayce", "Kayle", "Kennen", "Kled", "KSante", "Malphite", "Mordekaiser", "Nasus", "Olaf", "Ornn", "Pantheon", "Poppy", "Quinn", "Renekton", "Riven", "Rumble", "Ryze", "Sett", "Shen", "Singed", "Sion", "Teemo", "Tryndamere", "Urgot", "Vladimir", "Volibear", "Warwick", "Yone", "Yorick"],
  JGL: ["Amumu", "Diana", "Ekko", "Elise", "Evelynn", "Fiddlesticks", "Gragas", "Graves", "Hecarim", "Ivern", "JarvanIV", "Karthus", "Kayn", "Khazix", "Kindred", "LeeSin", "Lillia", "Maokai", "MasterYi", "Nidalee", "Nocturne", "Nunu", "Olaf", "Poppy", "Rammus", "RekSai", "Rengar", "Sejuani", "Shyvana", "Skarner", "Taliyah", "Trundle", "Udyr", "Vi", "Viego", "Volibear", "Warwick", "XinZhao", "Zac"],
  MID: ["Ahri", "Akali", "Anivia", "Annie", "AurelionSol", "Azir", "Cassiopeia", "Corki", "Diana", "Ekko", "Fizz", "Galio", "Hwei", "Irelia", "Kassadin", "Katarina", "Leblanc", "Lissandra", "Lux", "Malzahar", "Neeko", "Orianna", "Qiyana", "Ryze", "Sylas", "Syndra", "Taliyah", "Talon", "TwistedFate", "Veigar", "Velkoz", "Vex", "Viktor", "Vladimir", "Xerath", "Yasuo", "Yone", "Zed", "Ziggs", "Zoe"],
  ADC: ["Aphelios", "Ashe", "Caitlyn", "Draven", "Ezreal", "Jhin", "Jinx", "Kaisa", "Kalista", "KogMaw", "Lucian", "MissFortune", "Nilah", "Samira", "Senna", "Seraphine", "Sivir", "Smolder", "Tristana", "Twitch", "Varus", "Vayne", "Xayah", "Zeri", "Ziggs"],
  SUP: ["Alistar", "Ashe", "Bard", "Blitzcrank", "Brand", "Braum", "Janna", "Karma", "Leona", "Lulu", "Lux", "Maokai", "Milio", "Morgana", "Nami", "Nautilus", "Pyke", "Rakan", "Rell", "Renata", "Senna", "Seraphine", "Sona", "Soraka", "Swain", "TahmKench", "Taric", "Thresh", "Yuumi", "Zilean", "Zyra"],
};

const ADDITIONAL_CHAMPION_LANE_POOLS = {
  TOP: ["Ambessa", "Aurora", "Illaoi", "Zaahen"],
  JGL: ["Belveth", "Briar", "Shaco", "Zaahen"],
  MID: ["Akshan", "Aurora", "Mel", "Naafiri"],
  ADC: ["Mel", "Yunara"],
  SUP: ["Mel"],
};

const ALL_CHAMPION_LANE_POOLS = Object.fromEntries(
  Object.keys(CHAMPION_LANE_POOLS).map((lane) => [lane, [...new Set([...(CHAMPION_LANE_POOLS[lane] || []), ...(ADDITIONAL_CHAMPION_LANE_POOLS[lane] || [])])]])
);

function championMatchesLane(champion, lane) {
  if (!lane || lane === "ALL") return true;
  const id = championAssetId(champion);
  return (ALL_CHAMPION_LANE_POOLS[lane] || []).includes(id);
}

function ChampionTierCard({ row, canManage, saving, onDragStart, onDelete }) {
  const detail = championPoolStatusLabel(championPoolStatus(row));
  return <div draggable={canManage} onDragStart={(event) => onDragStart(event, row)} className={cx("group flex min-h-[52px] items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2 transition", canManage ?"cursor-grab active:cursor-grabbing hover:border-cyan-300/25 hover:bg-white/[0.05]" : "")}><img src={championSquareUrl(row)} alt={row.champion} className="h-10 w-10 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-[0.68rem] font-semibold text-slate-500">{detail}</p></div>{canManage && <button type="button" onClick={() => onDelete(row)} disabled={saving} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>}</div>;
}

function ChampionSearchTile({ champion, disabled, canManage, onDragStart }) {
  return <div draggable={canManage && !disabled} onDragStart={(event) => onDragStart(event, { champion })} className={cx("group flex min-w-0 items-center gap-2 rounded-2xl border p-2 text-left transition", disabled ?"border-white/5 bg-white/[0.02] opacity-35" : "cursor-grab border-white/10 bg-white/[0.035] hover:border-cyan-300/25 hover:bg-cyan-400/10 active:cursor-grabbing")}><img src={championSquareUrl(champion)} alt={champion} className="h-11 w-11 shrink-0 rounded-xl object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-black text-white">{championDisplayName(champion)}</span></div>;
}

function Champions({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const activeTeamId = selectedTeamId || data.teams[0]?.id || null;
  const canManageTeamPool = String(currentMember?.role || "").toLowerCase() === "captain";
  const players = (data.players || []).filter((player) => String(player.team_id || "") === String(activeTeamId || "") && isGameplayRole(player.role));
  const linkedPlayer = players.find((player) => String(player.user_id || "") === String(user?.id || ""));
  const laneOptions = ["ALL", "TOP", "JGL", "MID", "ADC", "SUP"];
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [query, setQuery] = useState("");
  const [laneFilter, setLaneFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [localPool, setLocalPool] = useState(data.championPool || []);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || players[0];
  const canManageSelectedPool = canManageTeamPool || String(selectedPlayer?.user_id || "") === String(user?.id || "");
  const selectedRows = (localPool || [])
    .filter((row) => String(row.team_id || "") === String(activeTeamId || "") && selectedPlayer && (String(row.player_id || "") === String(selectedPlayer.id || "") || row.player_name === selectedPlayer.name))
    .filter((row) => ["manual", "riot_manual"].includes(String(row.source || "")))
    .map((row) => ({ ...row, role: row.role || selectedPlayer?.role || "UNK", status: championPoolStatus(row) }))
    .sort((a, b) => championDisplayName(a.champion).localeCompare(championDisplayName(b.champion)));
  const pickedChampionKeys = new Set(selectedRows.map((row) => championAssetId(row.champion) || championKey(row.champion)));
  const visibleChampions = championOptions()
    .filter((champion) => championDisplayName(champion).toLowerCase().includes(query.toLowerCase()))
    .filter((champion) => championMatchesLane(champion, laneFilter))
    .slice(0, 72);
  const selectedTierCounts = Object.fromEntries(CHAMPION_TIERS.map((tier) => [tier.id, rowsForTier(tier.id).length]));

  useEffect(() => {
    const fallbackPlayerId = !canManageTeamPool && linkedPlayer?.id ? linkedPlayer.id : players[0]?.id || "";
    if (!selectedPlayerId && fallbackPlayerId) setSelectedPlayerId(fallbackPlayerId);
    if (selectedPlayerId && !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(fallbackPlayerId);
  }, [activeTeamId, canManageTeamPool, linkedPlayer?.id, players.map((player) => player.id).join("|")]);

  useEffect(() => {
    if (selectedPlayer?.role && laneOptions.includes(selectedPlayer.role)) setLaneFilter(selectedPlayer.role);
  }, [selectedPlayer?.id]);

  useEffect(() => {
    setLocalPool(data.championPool || []);
  }, [data.championPool]);

  function rowsForTier(status) {
    return selectedRows.filter((row) => row.status === status);
  }

  function dragPayload(event) {
    try {
      return JSON.parse(event.dataTransfer.getData("application/json") || "{}");
    } catch {
      return {};
    }
  }

  function onDragStart(event, row) {
    if (!canManageSelectedPool) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("application/json", JSON.stringify({ champion: row.champion, poolId: row.id || null }));
    event.dataTransfer.effectAllowed = "move";
  }

  async function saveChampion(champion, status, poolId = null) {
    if (!canManageSelectedPool || !selectedPlayer || !champion) return;
    const championName = championDisplayName(champion);
    const championId = championAssetId(champion);
    const existing = (localPool || []).find((row) => String(row.team_id || "") === String(activeTeamId || "") && (poolId ? String(row.id || "") === String(poolId) : (String(row.player_id || "") === String(selectedPlayer.id || "") || row.player_name === selectedPlayer.name) && championAssetId(row.champion) === championId));
    const keepStats = existing && String(existing.source || "") !== "riot";
    const optimistic = {
      ...(existing || {}),
      id: existing?.id || `optimistic-${selectedPlayer.id}-${championId}`,
      team_id: activeTeamId,
      player_id: selectedPlayer.id,
      player_name: selectedPlayer.name,
      role: selectedPlayer.role,
      champion: championName,
      status,
      source: existing?.source === "riot" ? "riot_manual" : (existing?.source || "manual"),
      games: keepStats ? existing?.games || 0 : 0,
      wins: keepStats ? existing?.wins || 0 : 0,
      losses: keepStats ? existing?.losses || 0 : 0,
      winrate: keepStats ? existing?.winrate || 0 : 0,
      kda: keepStats ? existing?.kda || 0 : 0,
      cs_per_min: keepStats ? existing?.cs_per_min || 0 : 0,
      impact_grade: existing?.impact_grade || "POOL",
    };
    setLocalPool((current) => existing
      ? current.map((row) => row.id === existing.id ? optimistic : row)
      : [...current, optimistic]);
    setSaving(true);
    try {
      const result = await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ teamId: activeTeamId, playerId: selectedPlayer.id, champion: championName, status, notes: "" }) });
      if (result?.pick) setLocalPool((current) => current.map((row) => row.id === optimistic.id ? result.pick : row));
    } catch (err) {
      setLocalPool((current) => existing
        ? current.map((row) => row.id === existing.id ? existing : row)
        : current.filter((row) => row.id !== optimistic.id));
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deletePick(row, options = {}) {
    if (!canManageSelectedPool || !row?.id) return;
    if (options.confirm !== false && !window.confirm("Retirer ce champion du Champion Pool ?")) return;
    const previousPool = localPool;
    setLocalPool((current) => current.filter((item) => item.id !== row.id));
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ action: "delete", teamId: activeTeamId, poolId: row.id }) });
    } catch (err) {
      setLocalPool(previousPool);
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function dropOnTier(event, status) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (payload.champion) saveChampion(payload.champion, status, payload.poolId);
  }

  function dropOnChampionBase(event) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (!payload.poolId) return;
    const row = selectedRows.find((item) => String(item.id || "") === String(payload.poolId));
    if (row) deletePick(row, { confirm: false });
  }

  return (
    <div>
      <PageHeader eyebrow="Champion Path" title="Champion Pool par joueur" />
      {players.length ? (
        <>
          <Surface glow className="mb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Joueur actif</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Le choix du joueur reste en haut pour laisser toute la largeur aux tableaux.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
              {players.map((player) => {
                const selected = selectedPlayer?.id === player.id;
                return (
                  <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={cx("min-w-[190px] rounded-2xl border p-4 text-left transition", selected ? "border-cyan-300/35 bg-cyan-400/10 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}>
                    <div className="flex items-center gap-3">
                      <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", selected ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-black/25")}>
                        <RoleIcon role={player.role} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-black text-white">{player.name}</p>
                        {player.riot_id && <p className="mt-1 truncate text-xs font-semibold text-slate-500">{player.riot_id}</p>}
                        {String(player.user_id || "") === String(user?.id || "") && <div className="mt-2"><Badge tone="orange">Mon profil</Badge></div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Surface>

          {selectedPlayer && (
            <>
              <Surface className="mb-5">
                <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {CHAMPION_TIERS.map((tier) => (
                    <div key={tier.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">{tier.title}</p>
                        <Badge tone={tier.tone}>{selectedTierCounts[tier.id]}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{tier.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr] xl:items-start">
                  <div>
                    <TextInput label="Ajouter un champion" value={query} onChange={setQuery} placeholder="Cherche Ahri, Renekton, Kai'Sa..." icon={Search} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {laneOptions.map((lane) => (
                        <button key={lane} type="button" onClick={() => setLaneFilter(lane)} className={cx("rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", laneFilter === lane ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-white")}>{lane === "ALL" ? "Toutes lanes" : lane}</button>
                      ))}
                    </div>
                  </div>

                  <div onDragOver={(event) => canManageSelectedPool && event.preventDefault()} onDrop={(event) => canManageSelectedPool && dropOnChampionBase(event)}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black text-white">{selectedPlayer.name}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{canManageSelectedPool ? `${visibleChampions.length} champions affichés · glisse ici un pick pour le retirer.` : "Lecture seule : seul le capitaine ou le joueur lié à ce profil peut modifier ce Champion Pool."}</p>
                      </div>
                      <Badge tone="orange">{selectedPlayer.role}</Badge>
                    </div>
                    <div className="grid max-h-[260px] gap-2 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-10">
                      {visibleChampions.map((champion) => {
                        const disabled = pickedChampionKeys.has(championAssetId(champion) || championKey(champion));
                        return <ChampionSearchTile key={champion} champion={champion} disabled={disabled} canManage={canManageSelectedPool} onDragStart={onDragStart} />;
                      })}
                    </div>
                  </div>
                </div>
              </Surface>

              <div className="grid gap-3 xl:grid-cols-4">
                {CHAMPION_TIERS.map((tier) => {
                  const items = rowsForTier(tier.id);
                  return (
                    <Surface key={tier.id} className="p-3" delay={0}>
                      <div onDragOver={(event) => canManageSelectedPool && event.preventDefault()} onDrop={(event) => canManageSelectedPool && dropOnTier(event, tier.id)} className="flex min-h-[280px] flex-col rounded-[1.1rem] border border-white/10 bg-black/20 p-3">
                        <div className="mb-3">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-black text-white">{tier.title}</h3>
                            <Badge tone={tier.tone}>{items.length}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{tier.hint}</p>
                        </div>
                        <div className="grid max-h-[300px] flex-1 content-start gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
                          {items.length ? items.map((row) => <ChampionTierCard key={row.id} row={row} canManage={canManageSelectedPool} saving={saving} onDragStart={onDragStart} onDelete={deletePick} />) : <div className="col-span-full flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-white/10 p-4 text-center text-xs font-semibold leading-5 text-slate-600">{canManageSelectedPool ? "Glisse un champion ici." : "Lecture seule."}</div>}
                        </div>
                      </div>
                    </Surface>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <Surface glow><EmptyState icon={Users} title="Aucun joueur" text="Ajoute le roster avant de construire les Champion Pools." /></Surface>
      )}
    </div>
  );
}

function emptyCompositionSlots(players = []) {
  return Object.fromEntries(COMP_ROLES.map((role) => {
    const player = players.find((item) => item.role === role);
    return [role, { playerId: player?.id || "", poolId: "" }];
  }));
}

function compositionSlots(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

function jsonList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function availabilitySlots(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === "object" ? value : {};
}

function dateKey(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function mondayOfWeek(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function formatPlanningDate(date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatWeekRange(start) {
  return `${formatPlanningDate(start)} - ${formatPlanningDate(addDays(start, 6))}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function compositionMastery(slots, rows) {
  const picked = Object.values(compositionSlots(slots)).map((slot) => rows.find((row) => row.id === slot.poolId)).filter(Boolean);
  if (!picked.length) return { label: "À remplir", tone: "slate", score: 0 };
  const weights = { lock: 100, pocket: 78, work: 52, danger: 24 };
  const score = Math.round(picked.reduce((sum, row) => sum + (weights[championPoolStatus(row)] || 45), 0) / picked.length);
  return score >= 82 ? { label: "Très maîtrisée", tone: "green", score } : score >= 65 ? { label: "Jouable", tone: "yellow", score } : score >= 42 ? { label: "À valider", tone: "cyan", score } : { label: "Trop fragile", tone: "red", score };
}

function CompositionSlot({ role, slot, players, rows, onChange }) {
  const rolePlayers = players.filter((player) => player.role === role);
  const player = players.find((item) => item.id === slot.playerId) || rolePlayers[0];
  const pool = rows.filter((row) => String(row.player_id || "") === String(player?.id || "") || row.player_name === player?.name);
  const pick = pool.find((row) => row.id === slot.poolId);
  return <div className="rounded-xl border border-white/10 bg-black/25 p-2.5"><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><RoleIcon role={role} className="h-5 w-5" /><span className="text-xs font-black text-white">{role}</span></div>{pick && <Badge tone={championPoolStatusTone(championPoolStatus(pick))}>{championPoolStatusLabel(championPoolStatus(pick))}</Badge>}</div><div className="grid gap-2"><select value={player?.id || ""} onChange={(event) => onChange(role, { playerId: event.target.value, poolId: "" })} className="w-full rounded-lg border border-white/10 bg-black/[0.22] px-2.5 py-2 text-xs font-black text-white outline-none">{rolePlayers.length ? rolePlayers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">Aucun joueur</option>}</select><select value={slot.poolId || ""} onChange={(event) => onChange(role, { playerId: player?.id || "", poolId: event.target.value })} className="w-full rounded-lg border border-white/10 bg-black/[0.22] px-2.5 py-2 text-xs font-black text-white outline-none"><option value="">Champion</option>{pool.map((row) => <option key={row.id} value={row.id}>{championDisplayName(row.champion)} · {championPoolStatusLabel(championPoolStatus(row))}</option>)}</select></div>{pick ? <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2"><img src={championSquareUrl(pick)} alt={pick.champion} className="h-9 w-9 rounded-lg object-cover" /><div className="min-w-0"><p className="truncate text-xs font-black text-white">{championDisplayName(pick.champion)}</p><p className="truncate text-[0.66rem] font-semibold text-slate-500">{pick.player_name || role} · {championPoolStatusLabel(championPoolStatus(pick))}</p></div></div> : <p className="mt-2 rounded-lg border border-dashed border-white/10 p-2 text-xs font-semibold text-slate-600">Slot vide.</p>}</div>;
}

function CompositionCard({ composition, rows, canManage, saving, onEdit, onDuplicate, onDelete }) {
  const slots = compositionSlots(composition.slots);
  const tags = jsonList(composition.tags);
  const mastery = compositionMastery(slots, rows);
  const picks = COMP_ROLES.map((role) => rows.find((row) => row.id === slots[role]?.poolId)).filter(Boolean);
  return <Surface className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge tone={mastery.tone}>{mastery.label} · {mastery.score}%</Badge>{tags.map((tag) => <Badge key={tag} tone="purple">{tagLabel(tag)}</Badge>)}</div><h3 className="mt-3 truncate text-xl font-black text-white">{composition.title}</h3><p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/70">Créée par {composition.created_by_name || "un membre"}</p>{composition.notes && <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-400">{composition.notes}</p>}</div>{canManage && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => onEdit(composition)} disabled={saving} className="rounded-xl p-2 text-slate-500 transition hover:bg-cyan-400/10 hover:text-cyan-100"><Clipboard className="h-4 w-4" /></button><button type="button" onClick={() => onDuplicate(composition)} disabled={saving} className="rounded-xl p-2 text-slate-500 transition hover:bg-violet-400/10 hover:text-violet-100"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(composition.id)} disabled={saving} className="rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button></div>}</div><div className="mt-4 grid gap-2 md:grid-cols-5">{COMP_ROLES.map((role) => { const pick = rows.find((row) => row.id === slots[role]?.poolId); return <div key={role} className={cx("min-w-0 rounded-xl border p-2", pick ? tone(championPoolStatusTone(championPoolStatus(pick))) : "border-white/10 bg-black/25 text-slate-500")}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[0.68rem] font-black"><RoleIcon role={role} className="h-4 w-4" />{role}</span></div>{pick ? <div className="mt-2 flex items-center gap-2"><img src={championSquareUrl(pick)} alt={pick.champion} className="h-9 w-9 rounded-lg object-cover" /><div className="min-w-0"><p className="truncate text-xs font-black text-white">{championDisplayName(pick.champion)}</p><p className="truncate text-[0.62rem] font-semibold opacity-80">{pick.player_name}</p></div></div> : <p className="mt-2 text-xs font-semibold">Vide</p>}</div>; })}</div>{picks.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{compositionIdentity(picks).tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>)}</div>}</Surface>;
}

function Compositions({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const isStaff = ["owner", "captain", "coach"].includes(String(currentMember?.role || "").toLowerCase());
  const canCreate = Boolean(currentMember);
  const players = (data.players || []).filter((player) => player.team_id === selectedTeamId && COMP_ROLES.includes(player.role));
  const rows = (data.championPool || []).filter((row) => row.team_id === selectedTeamId && ["manual", "riot_manual"].includes(String(row.source || "")));
  const compositions = (data.compositions || []).filter((item) => item.team_id === selectedTeamId);
  const [form, setForm] = useState({ id: null, title: "", notes: "", tags: [], slots: emptyCompositionSlots(players) });
  const [saving, setSaving] = useState(false);
  const [sideFilter, setSideFilter] = useState("all");
  const tagOptions = ["blue side", "red side", "scrim", "BO", "teamfight", "pick", "scaling"];

  useEffect(() => {
    setForm((current) => ({ ...current, slots: { ...emptyCompositionSlots(players), ...(current.slots || {}) } }));
  }, [players.map((player) => player.id).join("|")]);

  function updateSlot(role, slot) {
    setForm((current) => ({ ...current, slots: { ...current.slots, [role]: slot } }));
  }

  function toggleCompTag(tag) {
    setForm((current) => ({ ...current, tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag] }));
  }

  function resetCompositionForm() {
    setForm({ id: null, title: "", notes: "", tags: [], slots: emptyCompositionSlots(players) });
  }

  function editComposition(composition) {
    setForm({ id: composition.id, title: composition.title || "", notes: composition.notes || "", tags: jsonList(composition.tags), slots: { ...emptyCompositionSlots(players), ...compositionSlots(composition.slots) } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicateComposition(composition) {
    setForm({ id: null, title: `${composition.title || "Compo"} copie`, notes: composition.notes || "", tags: jsonList(composition.tags), slots: { ...emptyCompositionSlots(players), ...compositionSlots(composition.slots) } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveComposition(event) {
    event.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    try {
      await apiFetch("composition-types-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, compositionId: form.id, title: form.title, notes: form.notes, tags: form.tags, slots: form.slots }) });
      resetCompositionForm();
      await refreshAll();
      pushToast({ type: "green", title: form.id ? "Compo mise à jour" : "Compo créée", text: "La Compo Type est disponible pour la team." });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteComposition(compositionId) {
    const composition = compositions.find((item) => item.id === compositionId);
    const canManageComposition = isStaff || composition?.created_by === user?.id;
    if (!canManageComposition || !window.confirm("Supprimer cette Compo Type ?")) return;
    setSaving(true);
    try {
      await apiFetch("composition-types-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, compositionId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Compo supprimée", text: "La liste est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const mastery = compositionMastery(form.slots, rows);
  const filteredCompositions = compositions.filter((composition) => sideFilter === "all" || jsonList(composition.tags).includes(sideFilter));
  const sideOptions = [
    { id: "all", label: "Toutes" },
    { id: "blue side", label: "Blue Side" },
    { id: "red side", label: "Red Side" },
  ];
  return <div><PageHeader eyebrow="Draft Room" title="Compos Types" subtitle="Construis des Compos à partir des Champion Pools réels, avec une lecture immédiate de la maîtrise poste par poste." />{players.length ? <form onSubmit={saveComposition}><Surface glow className="p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h3 className="text-2xl font-black text-white">{form.id ? "Modifier la Compo" : "Nouvelle Compo"}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Chaque membre de la team peut proposer une Compo Type. Le créateur reste visible sur la carte.</p></div><Badge tone={mastery.tone}>{mastery.label} · {mastery.score}%</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_1.4fr]"><TextInput label="Nom de la Compo" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} placeholder="Ex: Engage Dragon, Front-to-Back Jinx..." required icon={Sparkles} /><TextInput label="Note" value={form.notes} onChange={(notes) => setForm((current) => ({ ...current, notes }))} placeholder="Plan, condition de fight, bans à protéger..." icon={Clipboard} /></div><div className="mt-4 flex flex-wrap gap-2">{tagOptions.map((tag) => <button key={tag} type="button" onClick={() => toggleCompTag(tag)} className={cx("rounded-xl border px-3 py-2 text-xs font-black transition", form.tags.includes(tag) ? "border-violet-300/35 bg-violet-400/10 text-violet-100" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-white")}>{tagLabel(tag)}</button>)}</div><div className="mt-5 grid gap-2 xl:grid-cols-5">{COMP_ROLES.map((role) => <CompositionSlot key={role} role={role} slot={form.slots[role] || {}} players={players} rows={rows} onChange={updateSlot} />)}</div><div className="mt-5 flex flex-wrap justify-end gap-2">{form.id && <Button type="button" variant="ghost" icon={X} onClick={resetCompositionForm}>Annuler</Button>}<Button type="submit" icon={saving ? Loader2 : form.id ? Check : Plus} disabled={!canCreate || saving || !form.title.trim()}>{form.id ? "Enregistrer" : "Créer la Compo"}</Button></div></Surface></form> : <EmptyState icon={Users} title="Roster incomplet" text="Ajoute les joueurs TOP, JGL, MID, ADC et SUP pour créer des Compos Types." />}<div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-sm font-black uppercase tracking-[0.28em] text-slate-300">Compos enregistrées</h3><p className="mt-1 text-xs font-bold text-slate-500">{filteredCompositions.length} / {compositions.length} visibles</p></div><div className="flex w-full rounded-2xl border border-white/10 bg-black/20 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)] md:w-auto">{sideOptions.map((option) => <button key={option.id} type="button" onClick={() => setSideFilter(option.id)} className={cx("flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition md:flex-none", sideFilter === option.id ? "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.34)]" : "text-slate-500 hover:bg-white/[0.05] hover:text-white")}>{option.label}</button>)}</div></div><div className="mt-3 grid gap-3">{filteredCompositions.length ? filteredCompositions.map((composition) => <CompositionCard key={composition.id} composition={composition} rows={rows} canManage={isStaff || composition.created_by === user?.id} saving={saving} onEdit={editComposition} onDuplicate={duplicateComposition} onDelete={deleteComposition} />) : compositions.length ? <EmptyState icon={Sparkles} title="Aucune Compo pour ce side" text="Change le filtre ou ajoute le tag Blue Side / Red Side sur une Compo." /> : <EmptyState icon={Sparkles} title="Aucune Compo Type" text="Crée une première Compo à partir des Champion Pools de tes joueurs." />}</div></div>;
}

function Planning({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const players = (data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role));
  const baseWeekStart = useMemo(() => mondayOfWeek(), []);
  const weekOptions = useMemo(() => [
    { id: "current", label: "Semaine en cours", start: dateKey(baseWeekStart), range: formatWeekRange(baseWeekStart) },
    { id: "next", label: "Semaine d’après", start: dateKey(addDays(baseWeekStart, 7)), range: formatWeekRange(addDays(baseWeekStart, 7)) },
  ], [baseWeekStart]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekOptions[0].start);
  const selectedWeek = weekOptions.find((week) => week.start === selectedWeekStart) || weekOptions[0];
  const weekStartDate = dateFromKey(selectedWeek.start);
  const weekDays = PLANNING_DAYS.map(([day, label], index) => [day, label, addDays(weekStartDate, index)]);
  const availability = (data.availability || []).filter((item) => {
    const itemWeek = item.week_start ? String(item.week_start).slice(0, 10) : weekOptions[0].start;
    return item.team_id === selectedTeamId && itemWeek === selectedWeek.start;
  });
  const canManageAll = ["owner", "captain", "coach"].includes(String(currentMember?.role || "").toLowerCase());
  const linkedPlayer = players.find((player) => player.user_id && player.user_id === user?.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [draftSlots, setDraftSlots] = useState({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fallback = canManageAll ? players[0]?.id : linkedPlayer?.id || players[0]?.id;
    if (!selectedPlayerId || !players.some((player) => player.id === selectedPlayerId)) setSelectedPlayerId(fallback || "");
  }, [canManageAll, linkedPlayer?.id, players.map((player) => player.id).join("|"), selectedPlayerId]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || null;
  const selectedAvailability = availability.find((item) => item.player_id === selectedPlayerId) || null;
  const canEditSelected = Boolean(selectedPlayer && (canManageAll || selectedPlayer.user_id === user?.id));

  useEffect(() => {
    setDraftSlots(availabilitySlots(selectedAvailability?.slots));
    setNotes(selectedAvailability?.notes || "");
  }, [selectedAvailability?.id, selectedAvailability?.updated_at, selectedPlayerId, selectedWeek.start]);

  function slotList(playerId, day) {
    const row = availability.find((item) => item.player_id === playerId);
    return availabilitySlots(row?.slots)[day] || [];
  }

  function toggleSlot(day, time) {
    if (!canEditSelected) return;
    setDraftSlots((current) => {
      const list = Array.isArray(current[day]) ? current[day] : [];
      const nextList = list.includes(time) ? list.filter((item) => item !== time) : [...list, time].sort();
      return { ...current, [day]: nextList };
    });
  }

  async function saveAvailability() {
    if (!selectedPlayer || !selectedTeamId || !canEditSelected) return;
    setSaving(true);
    try {
      await apiFetch("player-availability-manage", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, playerId: selectedPlayer.id, weekStart: selectedWeek.start, slots: draftSlots, notes }) });
      await refreshAll();
      pushToast({ type: "green", title: "Planning mis à jour", text: `Les dispos du profil sont enregistrées pour ${selectedWeek.label.toLowerCase()}.` });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const totalPlayers = players.length || 1;
  const bestCells = weekDays.flatMap(([day]) => PLANNING_TIMES.map((time) => ({
    day,
    time,
    count: players.filter((player) => slotList(player.id, day).includes(time)).length,
  }))).sort((a, b) => b.count - a.count).slice(0, 3);

  if (!selectedTeamId) return <EmptyState icon={CalendarDays} title="Aucune équipe sélectionnée" text="Choisis une équipe pour configurer les disponibilités." />;
  if (!players.length) return <EmptyState icon={Users} title="Aucun profil joueur" text="Ajoute des profils joueurs pour construire le planning de team." />;

  return (
    <div>
      <PageHeader eyebrow="Organisation" title="Planning" subtitle="Chaque joueur renseigne ses dispos, puis la vue globale montre immédiatement les créneaux jouables pour l’équipe.">
        <div className="flex flex-wrap gap-2">
          {weekOptions.map((week) => (
            <button key={week.id} type="button" onClick={() => setSelectedWeekStart(week.start)} className={cx("rounded-xl border px-3 py-2 text-left transition", selectedWeek.start === week.start ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,.12)]" : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-cyan-300/25 hover:text-white")}>
              <span className="block text-xs font-black uppercase tracking-[0.14em]">{week.label}</span>
              <span className="mt-0.5 block text-xs font-semibold opacity-80">{week.range}</span>
            </button>
          ))}
        </div>
        {bestCells[0]?.count > 0 && <Badge tone="cyan">Meilleur créneau : {bestCells[0].count}/{players.length}</Badge>}
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.45fr]">
        <div className="space-y-5">
          <Surface glow>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-white">Profils</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">Sélectionne un profil pour consulter ou modifier ses disponibilités.</p>
              </div>
              <Badge tone={canManageAll ? "purple" : "slate"}>{canManageAll ? "Staff" : "Joueur"}</Badge>
            </div>
            <div className="mt-5 grid gap-2">
              {players.map((player) => {
                const selected = player.id === selectedPlayerId;
                const filled = weekDays.reduce((sum, [day]) => sum + slotList(player.id, day).length, 0);
                return (
                  <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={cx("flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition", selected ? "border-cyan-300/35 bg-cyan-400/10 text-white shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/18 hover:bg-white/[0.06] hover:text-white")}>
                    <span className="flex min-w-0 items-center gap-3">
                      <RoleIcon role={player.role} className="h-6 w-6 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{player.name}</span>
                        <span className="mt-1 block text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-500">{roleLabel(player.role)}{player.user_id === user?.id ? " · Moi" : ""}</span>
                      </span>
                    </span>
                    <Badge tone={filled ? "cyan" : "slate"}>{filled} slots</Badge>
                  </button>
                );
              })}
            </div>
          </Surface>

          <Surface>
            <h3 className="text-xl font-black text-white">Créneaux forts</h3>
            <div className="mt-4 grid gap-2">
              {bestCells.map((cell) => (
                <div key={`${cell.day}-${cell.time}`} className={cx("flex items-center justify-between rounded-2xl border p-3", cell.count === players.length ? tone("green") : cell.count > 0 ? tone("cyan") : tone("slate"))}>
                  <span className="font-black">{weekDays.find(([day]) => day === cell.day)?.[1]} · {formatPlanningDate(weekDays.find(([day]) => day === cell.day)?.[2] || weekStartDate)} · {cell.time}</span>
                  <span className="text-sm font-black">{cell.count}/{players.length}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>

        <div className="space-y-5">
          <Surface glow className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-black text-white">{selectedPlayer?.name || "Profil"}</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">{canEditSelected ? "Clique sur les slots pour activer ou retirer une disponibilité." : "Lecture seule : seul le joueur, le capitaine ou le coach peut modifier ce profil."}</p>
              </div>
              {selectedPlayer && <Badge tone="blue">{roleLabel(selectedPlayer.role)}</Badge>}
            </div>
            <div className="mt-5 overflow-x-auto pb-2">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[5.5rem_repeat(7,minmax(5.5rem,1fr))] gap-2">
                  <div />
                  {weekDays.map(([day, label, date]) => <div key={day} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-300"><span className="block">{label}</span><span className="mt-1 block text-[0.66rem] text-cyan-100/70">{formatPlanningDate(date)}</span></div>)}
                  {PLANNING_TIMES.map((time) => (
                    <React.Fragment key={time}>
                      <div className="flex items-center rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-black text-white">{time}</div>
                      {weekDays.map(([day]) => {
                        const activeSlot = (draftSlots[day] || []).includes(time);
                        return <button key={`${day}-${time}`} type="button" disabled={!canEditSelected || saving} onClick={() => toggleSlot(day, time)} className={cx("min-h-12 rounded-xl border text-xs font-black transition", activeSlot ? "border-cyan-200/45 bg-cyan-300/18 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,.14)]" : "border-white/10 bg-white/[0.035] text-slate-600 hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100", !canEditSelected && "cursor-not-allowed opacity-70")}>{activeSlot ? "DISPO" : "OFF"}</button>;
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <TextAreaInput label="Note" value={notes} onChange={setNotes} placeholder="Ex: dispo après 20h30, pas le vendredi cette semaine..." rows={3} icon={Clipboard} />
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" icon={saving ? Loader2 : Check} disabled={!canEditSelected || saving} onClick={saveAvailability}>{saving ? "Enregistrement..." : "Enregistrer les dispos"}</Button>
            </div>
          </Surface>

          <Surface>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-black text-white">Planning général</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">Vue team complète pour {selectedWeek.label.toLowerCase()} ({selectedWeek.range}) : plus la case brille, plus le créneau est bon.</p>
              </div>
              <Badge tone="purple">{players.length} profils</Badge>
            </div>
            <div className="mt-5 overflow-x-auto pb-2">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[5.5rem_repeat(7,minmax(6.2rem,1fr))] gap-2">
                  <div />
                  {weekDays.map(([day, label, date]) => <div key={day} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-300"><span className="block">{label}</span><span className="mt-1 block text-[0.66rem] text-cyan-100/70">{formatPlanningDate(date)}</span></div>)}
                  {PLANNING_TIMES.map((time) => (
                    <React.Fragment key={time}>
                      <div className="flex items-center rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-black text-white">{time}</div>
                      {weekDays.map(([day]) => {
                        const availablePlayers = players.filter((player) => slotList(player.id, day).includes(time));
                        const ratio = availablePlayers.length / totalPlayers;
                        const cellTone = availablePlayers.length === players.length ? "border-emerald-200/35 bg-emerald-400/14 text-emerald-50" : ratio >= 0.6 ? "border-cyan-200/35 bg-cyan-400/12 text-cyan-50" : availablePlayers.length ? "border-violet-200/25 bg-violet-400/10 text-violet-50" : "border-white/10 bg-white/[0.025] text-slate-600";
                        return (
                          <div key={`${day}-${time}`} className={cx("min-h-[4.4rem] rounded-xl border p-2", cellTone)}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-black">{availablePlayers.length}/{players.length}</span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30"><span className="block h-full rounded-full bg-current" style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {availablePlayers.map((player) => <span key={player.id} title={player.name} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/25"><RoleIcon role={player.role} className="h-4 w-4" /></span>)}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

function DraftPickCard({ pick, label }) {
  const winrate = Number(pick?.winrate || 0);
  const toneName = winrate >= 55 ? "green" : winrate <= 40 ? "red" : "yellow";
  const styleTags = championStyleTags(pick?.champion).slice(0, 2);
  return <div className="nxt5-panel group relative min-h-[250px] overflow-hidden border border-cyan-200/14 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/34 hover:shadow-[0_0_34px_rgba(34,211,238,.12)]"><ChampionBackdrop champion={pick?.champion} /><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-fuchsia-200/60" /><div className="relative z-10 flex min-h-[210px] flex-col justify-between"><div><div className="flex items-center justify-between gap-3"><Badge tone="cyan">{label}</Badge><Badge tone={gradeTone(pick?.impact_grade)}>{pick?.impact_grade || "?"}</Badge></div><h3 className="mt-5 text-3xl font-black text-white">{pick ? championDisplayName(pick.champion) : "À définir"}</h3><p className="mt-1 text-sm font-bold text-slate-300">{pick?.player_name || "Pas assez de données"}</p>{pick && <div className="mt-3 flex flex-wrap gap-2">{styleTags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)}</Badge>)}</div>}</div><div className="mt-6"><StatBar value={winrate} max={100} tone={toneName} /><div className="mt-3 flex flex-wrap gap-2"><Badge tone={toneName}>{pick?.winrate ?? "?"}% WR</Badge><Badge tone="slate">{pick?.games ?? 0} games</Badge><Badge tone="purple">{pick?.kda ? Number(pick.kda).toFixed(1) : "?"} KDA</Badge></div><p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{pick?.verdict || "Importe plus de matchs pour alimenter la préparation de draft."}</p></div></div></div>;
}

function DraftSlot({ pick, index, side = "blue" }) {
  const sideTone = side === "blue" ?"border-cyan-300/28 bg-cyan-400/[0.08] shadow-[inset_0_0_34px_rgba(34,211,238,.06)]" : "border-fuchsia-300/28 bg-fuchsia-400/[0.08] shadow-[inset_0_0_34px_rgba(217,70,239,.06)]";
  const indexTone = side === "blue" ?"border-cyan-300/30 text-cyan-100" : "border-fuchsia-300/30 text-fuchsia-100";
  return <div className={cx("nxt5-panel grid min-h-[92px] grid-cols-[3rem_1fr_auto] items-center gap-3 border p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.055]", sideTone)}><div className={cx("flex h-10 w-10 items-center justify-center rounded-xl border bg-black/34 text-sm font-black", indexTone)}>{index + 1}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{pick ?championDisplayName(pick.champion) : "Open Pick"}</p><p className="truncate text-xs font-semibold text-slate-400">{pick?.player_name || "À déterminer"}</p></div><div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">{pick ?<img src={championIconUrl(pick) || championLoadingUrl(pick.champion)} alt={pick.champion} className="h-full w-full object-cover" /> : <Crown className="m-3 h-6 w-6 text-slate-600" />}</div></div>;
}

function DraftBoard({ comfort, risk }) {
  const blue = [comfort[0], comfort[2], comfort[4], comfort[6], comfort[8]];
  const red = [comfort[1], comfort[3], comfort[5], risk[0], risk[1]];
  return <Surface glow className="nxt5-hud-lines"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="nxt5-metal-text text-2xl font-black">Draft Protocol</h3><p className="mt-1 text-sm font-semibold text-slate-400">Une table tactique pour discuter ordre de Pick, sécurisation et réponses.</p></div><Badge tone="purple">Five-stack prep</Badge></div><div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><Badge tone="cyan">Blue Side</Badge><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Priorité Confort</span></div><div className="space-y-2">{blue.map((pick, index) => <DraftSlot key={"blue-" + index} pick={pick} index={index} side="blue" />)}</div></div><div><div className="mb-3 flex items-center gap-2"><Badge tone="pink">Red Side</Badge><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Réponse Et Flex</span></div><div className="space-y-2">{red.map((pick, index) => <DraftSlot key={"red-" + index} pick={pick} index={index} side="red" />)}</div></div></div></Surface>;
}

function BanRecommendations({ risk, comfort }) {
  const bans = [...risk.slice(0, 3), ...comfort.filter((pick) => Number(pick.winrate || 0) < 50).slice(0, 2)].slice(0, 5);
  return <Surface><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Bans à préparer</h3><p className="mt-1 text-sm font-semibold text-slate-500">Les Picks à retirer ou à tester en counterpick avant un match important.</p></div><Badge tone="red">Ban List</Badge></div>{bans.length ?<div className="space-y-3">{bans.map((pick, index) => <div key={pick.id || index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src={championIconUrl(pick) || championLoadingUrl(pick.champion)} alt={pick.champion} className="h-full w-full object-cover" /></div><div className="min-w-0"><p className="truncate font-black text-white">{championDisplayName(pick.champion)}</p><p className="truncate text-xs font-semibold text-slate-500">{pick.player_name || "Roster"} · {pick.games || 0} games</p></div><Badge tone={Number(pick.winrate || 0) <= 40 ?"red" : "yellow"}>{pick.winrate || 0}% WR</Badge></div>)}</div> : <EmptyState icon={Shield} title="Aucune Ban prioritaire" text="Importe plus de matchs pour faire ressortir les Picks à risque." />}</Surface>;
}

function RolePrepMatrix({ players, championPool }) {
  const roles = COMP_ROLES;
  return <Surface glow><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Préparation par rôle</h3><p className="mt-1 text-sm font-semibold text-slate-500">Ce que chaque poste doit savoir avant d'entrer en lobby.</p></div><Badge tone="cyan">roster</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{roles.map((role) => { const player = players.find((item) => item.role === role); const picks = player ?playerChampionRows(player, championPool).slice(0, 3) : []; return <div key={role} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><Badge tone={role === "COACH" ?"purple" : "blue"}>{role}</Badge><span className="truncate text-sm font-black text-white">{player?.name || "Slot ouvert"}</span></div><div className="mt-4 flex gap-2">{picks.length ?picks.map((pick) => <div key={pick.id} className="h-12 w-12 overflow-hidden rounded-full border border-cyan-300/20 bg-black/30"><img src={championIconUrl(pick) || championLoadingUrl(pick.champion)} alt={pick.champion} className="h-full w-full object-cover" /></div>) : <p className="text-sm font-semibold leading-6 text-slate-500">Pas encore assez de données champion.</p>}</div><p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Focus</p><p className="mt-1 text-sm font-bold leading-6 text-slate-300">{role === "COACH" ?"Vérifier draft, win condition et plan de review." : picks[0] ?"Sécuriser " + championDisplayName(picks[0].champion) + " ou préparer une réponse." : "Importer des games pour définir le plan."}</p></div>; })}</div></Surface>;
}

function TournamentChecklist({ latest }) {
  const items = [
    ["Win condition", latest?.primary_focus || "Définir le plan principal avant la game."],
    ["Objectif neutre", latest?.objectives_note || "Choisir dragon, Herald ou Nashor à prioriser."],
    ["Risque majeur", latest?.main_issue || "Noter le pattern qui coûte le plus cher."],
    ["Communication", "Une call principale, une backup, pas dix priorités."],
  ];
  return <Surface><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Checklist match</h3><p className="mt-1 text-sm font-semibold text-slate-500">Le minimum à valider avant tournoi, scrim ou BO.</p></div><Badge tone={latest ?"green" : "yellow"}>{latest ?"base active" : "à remplir"}</Badge></div><div className="space-y-3">{items.map(([title, text]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-black text-white">{title}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p></div>)}</div></Surface>;
}

function CompositionIdentityPanel({ picks }) {
  const identity = compositionIdentity(picks);
  return <Surface><div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Identité de Compo</h3><p className="mt-1 text-sm font-semibold text-slate-500">La tendance de Draft selon les champions conforts actuels.</p></div><Badge tone={championStyleTone(identity.primary)}>{tagLabel(identity.primary)}</Badge></div><p className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold leading-6 text-white">{identity.text}</p><div className="mt-4 flex flex-wrap gap-2">{identity.tags.length ? identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tagLabel(tag)} x{count}</Badge>) : <Badge tone="slate">Pas assez de Picks</Badge>}</div></Surface>;
}

function reportMatchIds(report) {
  if (Array.isArray(report.match_ids)) return report.match_ids;
  if (typeof report.match_ids === "string") {
    try {
      const parsed = JSON.parse(report.match_ids);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  if (report.match_id) return [report.match_id];
  return [];
}

function reportRows(matches, matchIds) {
  const selected = matches.filter((match) => matchIds.includes(match.id));
  return selected.flatMap((match) => (match.participants || []).map((row) => ({ ...row, match }))).filter((row) => row.team_key === "ALLY");
}

function roleRows(rows, role) {
  const needle = String(role || "").replace(/["']/g, "").toUpperCase();
  return rows.filter((row) => String(row.role || "").toUpperCase() === needle);
}

function commandResult(command, rows) {
  const raw = String(command || "").trim();
  const teamMatch = raw.match(/^\/TEAM\s+(KDA|DAMAGE|VISION|GOLD|KP)/i);
  if (teamMatch) {
    if (!rows.length) return `${raw} -> aucune game liée.`;
    const key = teamMatch[1].toUpperCase();
    const avg = (field) => Math.round(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length);
    const avgFloat = (field) => (rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length).toFixed(2);
    if (key === "KDA") return `Team KDA moyen: ${avgFloat("kda")} sur ${rows.length} lignes joueur.`;
    if (key === "DAMAGE") return `Team dégâts moyens par joueur: ${formatPoints(avg("damage"))}.`;
    if (key === "VISION") return `Team vision moyenne par joueur: ${avg("vision")}.`;
    if (key === "GOLD") return `Team gold moyen par joueur: ${formatPoints(avg("gold"))}.`;
    return `Team KP moyen: ${Math.round(Number(avgFloat("kp")) * 100)}%`;
  }
  const match = raw.match(/^\/(KDA|DAMAGE|VISION|GOLD|KP)\s+["']?([A-Z]{2,3})["']?/i);
  if (!match) return null;
  const [, key, role] = match;
  const scoped = roleRows(rows, role);
  if (!scoped.length) return `${raw} -> aucune donnée pour ${role.toUpperCase()}.`;
  const avg = (field) => Math.round(scoped.reduce((sum, row) => sum + Number(row[field] || 0), 0) / scoped.length);
  const avgFloat = (field) => (scoped.reduce((sum, row) => sum + Number(row[field] || 0), 0) / scoped.length).toFixed(2);
  const label = role.toUpperCase();
  if (key.toUpperCase() === "KDA") return `${label} KDA moyen: ${avgFloat("kda")} sur ${scoped.length} game${scoped.length > 1 ? "s" : ""}.`;
  if (key.toUpperCase() === "DAMAGE") return `${label} dégâts moyens: ${formatPoints(avg("damage"))}.`;
  if (key.toUpperCase() === "VISION") return `${label} vision moyenne: ${avg("vision")}.`;
  if (key.toUpperCase() === "GOLD") return `${label} gold moyen: ${formatPoints(avg("gold"))}.`;
  return `${label} KP moyen: ${Math.round(Number(avgFloat("kp")) * 100)}%`;
}

function renderReportContent(content, rows) {
  return String(content || "").split("\n").map((line, index) => {
    const result = commandResult(line, rows);
    return result ? <div key={index} className="my-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 font-black text-cyan-50">{result}</div> : <p key={index} className="min-h-[1.5rem] whitespace-pre-wrap">{line}</p>;
  });
}

function ReportPreview({ content, rows }) {
  return <div className="rounded-2xl border border-white/10 bg-black/[0.26] p-4 text-sm leading-7 text-slate-100 shadow-inner shadow-black/35">{String(content || "").trim() ? renderReportContent(content, rows) : <p className="text-sm font-semibold text-slate-600">L’aperçu apparaîtra ici.</p>}</div>;
}

function Reports({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const reports = (data.reports || []).filter((report) => report.team_id === selectedTeamId);
  const matches = (data.matches || []).filter((match) => match.team_id === selectedTeamId);
  const canCaptainDelete = ["owner", "captain"].includes(String(currentMember?.role || "").toLowerCase());
  const [form, setForm] = useState({ id: null, title: "", content: "", matchIds: [] });
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [lexiconOpen, setLexiconOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = reports.find((report) => report.id === selectedReportId) || reports[0];
  const selectedRows = selected ? reportRows(matches, reportMatchIds(selected)) : [];
  const formRows = reportRows(matches, form.matchIds);
  const canEditSelected = selected && (canCaptainDelete || selected.created_by === user?.id);

  function toggleMatch(id) {
    setForm((current) => ({ ...current, matchIds: current.matchIds.includes(id) ? current.matchIds.filter((item) => item !== id) : [...current.matchIds, id] }));
  }

  function insertCommand(command) {
    setForm((current) => ({ ...current, content: `${current.content}${current.content.endsWith("\n") || !current.content ? "" : "\n"}${command}` }));
  }

  function editReport(report) {
    setForm({ id: report.id, title: report.title || "", content: report.content || "", matchIds: reportMatchIds(report) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicateReport(report) {
    setForm({ id: null, title: `${report.title || "Rapport"} copie`, content: report.content || "", matchIds: reportMatchIds(report) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetReportForm() {
    setForm({ id: null, title: "", content: "", matchIds: [] });
  }

  async function saveReport(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, reportId: form.id, title: form.title, content: form.content, matchIds: form.matchIds }) });
      resetReportForm();
      await refreshAll();
      pushToast({ type: "green", title: form.id ? "Rapport mis à jour" : "Rapport créé", text: "Le bloc notes de review est enregistré." });
    } catch (err) {
      pushToast({ type: "red", title: "Enregistrement impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(report) {
    const canDelete = canCaptainDelete || report.created_by === user?.id;
    if (!canDelete || !window.confirm("Supprimer ce rapport ?")) return;
    setSaving(true);
    try {
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, reportId: report.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Rapport supprimé", text: "Le rapport a été retiré." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const commands = [[`/KDA "ADC"`, "KDA moyen d’un rôle."], [`/DAMAGE "MID"`, "Dégâts moyens d’un rôle."], [`/VISION "SUP"`, "Vision moyenne d’un rôle."], [`/GOLD "JGL"`, "Gold moyen d’un rôle."], [`/KP "TOP"`, "Participation moyenne aux kills."], ["/TEAM KDA", "KDA moyen de l’équipe."], ["/TEAM DAMAGE", "Dégâts moyens par joueur."]];
  return <div><PageHeader eyebrow="Bloc notes staff" title="Rapports de review" subtitle="Crée des notes liées aux games importées, avec des commandes qui injectent les datas utiles." /><div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><Surface glow className="p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">{form.id ? "Modifier le rapport" : "Créer un rapport"}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Notes à gauche, rendu data à droite.</p></div><Button variant="ghost" icon={Clipboard} onClick={() => setLexiconOpen((value) => !value)}>Commandes</Button></div>{lexiconOpen && <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4"><div className="grid gap-2 md:grid-cols-2">{commands.map(([command, text]) => <button key={command} type="button" onClick={() => insertCommand(command)} className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-cyan-300/25 hover:bg-cyan-400/10"><p className="font-mono text-sm font-black text-cyan-100">{command}</p><p className="mt-1 text-xs font-semibold text-slate-400">{text}</p></button>)}</div></div>}<form onSubmit={saveReport} className="mt-5 space-y-4"><TextInput label="Titre" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} placeholder="Review scrim vs..." required icon={FileText} /><div><p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Games liées</p><div className="grid max-h-[180px] gap-2 overflow-auto pr-1 md:grid-cols-2">{matches.length ? matches.map((match) => <button key={match.id} type="button" onClick={() => toggleMatch(match.id)} className={cx("rounded-xl border p-3 text-left transition", form.matchIds.includes(match.id) ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div className="flex flex-wrap items-center gap-2"><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge><span className="truncate text-sm font-black text-white">{match.opponent || match.game_id}</span></div><p className="mt-1 truncate text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"}</p></button>) : <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-semibold text-slate-500">Importe une game pour lier des données.</p>}</div></div><div className="grid gap-4 xl:grid-cols-2"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Notes</span><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder={`Plan de jeu, erreurs récurrentes, décisions à revoir...\n/KDA "ADC"`} required rows={13} className="w-full resize-y rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-slate-650 focus:border-cyan-300/35" /></label><div><p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Aperçu</p><ReportPreview content={form.content} rows={formRows} /></div></div><div className="flex flex-wrap justify-end gap-2">{form.id && <Button type="button" variant="ghost" icon={X} onClick={resetReportForm}>Annuler</Button>}<Button type="submit" icon={saving ? Loader2 : form.id ? Check : Plus} disabled={saving || !selectedTeamId || !form.title.trim() || !form.content.trim()}>{form.id ? "Enregistrer" : "Créer le rapport"}</Button></div></form></Surface><div className="space-y-5"><Surface className="p-4"><h3 className="text-xl font-black text-white">Rapports existants</h3><div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">{reports.length ? reports.map((report) => <button key={report.id} type="button" onClick={() => setSelectedReportId(report.id)} className={cx("w-full rounded-xl border p-3 text-left transition", selected?.id === report.id ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div className="flex items-center justify-between gap-3"><p className="truncate font-black text-white">{report.title}</p><Badge tone="slate">{reportMatchIds(report).length} game{reportMatchIds(report).length > 1 ? "s" : ""}</Badge></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">Par {report.author_name || "NXT5"} · {new Date(report.updated_at || report.created_at).toLocaleDateString("fr-FR")}</p></button>) : <EmptyState icon={FileText} title="Aucun rapport" text="Crée un premier rapport lié à tes reviews." />}</div></Surface><Surface glow>{selected ? <><div className="mb-4 flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-2xl font-black text-white">{selected.title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Par {selected.author_name || "NXT5"} · {reportMatchIds(selected).length} game{reportMatchIds(selected).length > 1 ? "s" : ""} liée{reportMatchIds(selected).length > 1 ? "s" : ""}</p></div><div className="flex shrink-0 gap-2"><Button variant="ghost" icon={RefreshCw} onClick={() => duplicateReport(selected)} disabled={saving}>Dupliquer</Button>{canEditSelected && <Button variant="ghost" icon={Clipboard} onClick={() => editReport(selected)} disabled={saving}>Éditer</Button>}{canEditSelected && <Button variant="ghost" icon={Trash2} onClick={() => deleteReport(selected)} disabled={saving}>Supprimer</Button>}</div></div><ReportPreview content={selected.content} rows={selectedRows} /></> : <EmptyState icon={FileText} title="Sélectionne un rapport" text="Le contenu apparaîtra ici." />}</Surface></div></div></div>;
}

function SettingsPage({ user, onUserUpdate, pushToast }) {
  const [profileForm, setProfileForm] = useState({ name: user?.name || "", email: user?.email || "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [rememberDefault, setRememberDefault] = useState(readRememberPreference);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setProfileForm({ name: user?.name || "", email: user?.email || "" });
  }, [user?.name, user?.email]);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify(profileForm) });
      onUserUpdate(result.user);
      pushToast({ type: "green", title: "Compte mis à jour", text: "Le changement est visible dans ton espace." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      pushToast({ type: "red", title: "Mot de passe refusé", text: "La confirmation ne correspond pas." });
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("auth-change-password", { method: "POST", body: JSON.stringify({ currentPassword: passwordForm.currentPassword, nextPassword: passwordForm.nextPassword }) });
      setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
      pushToast({ type: "green", title: "Mot de passe mis à jour", text: "La prochaine connexion utilisera ce nouveau mot de passe." });
    } catch (err) {
      pushToast({ type: "red", title: "Modification impossible", text: err.message });
    } finally {
      setSavingPassword(false);
    }
  }

  function updateRememberDefault(value) {
    setRememberDefault(value);
    writeRememberPreference(value);
    pushToast({ type: "cyan", title: value ? "Rester connecté activé" : "Rester connecté désactivé", text: "Ce choix sera appliqué aux prochaines connexions sur cet appareil." });
  }

  return <div><PageHeader eyebrow="Compte" title="Paramètres" subtitle="Gère ton e-mail, ton pseudo, ton mot de passe et tes sessions." /><div className="grid gap-5 xl:grid-cols-2"><Surface glow><h3 className="text-xl font-black text-white">Compte</h3><p className="mt-2 text-sm leading-6 text-slate-400">L’e-mail sert à te connecter et à récupérer ton compte. Le pseudo est le nom visible par les autres.</p><form onSubmit={saveProfile} className="mt-5 space-y-4"><TextInput label="E-mail" value={profileForm.email} onChange={(email) => setProfileForm((current) => ({ ...current, email }))} placeholder="joueur@exemple.com" type="email" required icon={Mail} /><TextInput label="Pseudo" value={profileForm.name} onChange={(name) => setProfileForm((current) => ({ ...current, name }))} placeholder="Pseudo visible" required icon={Users} /><Button type="submit" icon={savingProfile ?Loader2 : Check} disabled={savingProfile || !profileForm.name.trim() || !profileForm.email.trim()}>{savingProfile ?"Enregistrement..." : "Enregistrer"}</Button></form></Surface><Surface glow><h3 className="text-xl font-black text-white">Mot de passe</h3><p className="mt-2 text-sm leading-6 text-slate-400">Le changement vérifie ton mot de passe actuel avant d’accepter le nouveau.</p><form onSubmit={savePassword} className="mt-5 space-y-4"><TextInput label="Mot de passe actuel" value={passwordForm.currentPassword} onChange={(currentPassword) => setPasswordForm((current) => ({ ...current, currentPassword }))} placeholder="••••••••" type="password" required icon={Lock} /><TextInput label="Nouveau mot de passe" value={passwordForm.nextPassword} onChange={(nextPassword) => setPasswordForm((current) => ({ ...current, nextPassword }))} placeholder="8 caractères minimum" type="password" required icon={Shield} /><TextInput label="Confirmer" value={passwordForm.confirmPassword} onChange={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))} placeholder="Répète le nouveau mot de passe" type="password" required icon={Check} /><Button type="submit" icon={savingPassword ?Loader2 : Shield} disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword}>{savingPassword ?"Mise à jour..." : "Changer le mot de passe"}</Button></form></Surface><Surface><h3 className="text-xl font-black text-white">Session</h3><p className="mt-2 text-sm leading-6 text-slate-400">Choisis le comportement par défaut du bouton de connexion sur cet appareil.</p><div className="mt-5"><PremiumToggle checked={rememberDefault} onChange={updateRememberDefault} title="Rester connecté par défaut" text="Quand c’est désactivé, les prochaines sessions sont plus courtes." /></div></Surface></div></div>;
}

function MissingEmailModal({ user, onUserUpdate, pushToast }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify({ name: user?.name || user?.account_name || "Compte NXT5", email }) });
      onUserUpdate(result.user);
      pushToast({ type: "green", title: "E-mail ajouté", text: "Ton compte peut maintenant recevoir les liens de mot de passe oublié." });
    } catch (err) {
      setError(err.message || "Impossible d’ajouter cet e-mail.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 text-white backdrop-blur-xl">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-xl overflow-hidden rounded-[1.65rem] border border-cyan-300/25 bg-[#090d1a]/95 p-6 shadow-2xl shadow-black/50">
        <Badge tone="orange">Action requise</Badge>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Ajoute ton e-mail de récupération</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Les anciens comptes n’avaient pas d’e-mail. Ajoute le tien maintenant pour recevoir les liens de mot de passe oublié.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <TextInput label="E-mail de récupération" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
          {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
          <Button type="submit" disabled={saving || !email.trim()} icon={saving ?Loader2 : Mail} className="w-full py-4">{saving ?"Enregistrement..." : "Enregistrer l’e-mail"}</Button>
        </form>
      </motion.div>
    </div>
  );
}

function AppLoadingScreen({ label = "Chargement de ton espace…" }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden text-white">
      <AmbientBackground />
      <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 w-[min(92vw,460px)] overflow-hidden rounded-[1.6rem] border border-cyan-200/16 bg-[#050914]/86 p-7 text-center shadow-[0_0_90px_rgba(34,211,238,0.22)] backdrop-blur-2xl">
        <motion.div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-fuchsia-300" animate={{ opacity: [0.25, 1, 0.25], x: [-24, 24, -24] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] border border-cyan-200/18 bg-cyan-400/8 shadow-[0_0_46px_rgba(34,211,238,0.24)]">
          <motion.div className="absolute inset-[-18px] rounded-[2.4rem] bg-cyan-300/10 blur-2xl" animate={{ opacity: [0.25, 0.75, 0.25], scale: [0.92, 1.12, 0.92] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
          <img src="/assets/nxt5-mark.png?v=8" alt="NXT5" className="relative z-10 h-24 w-24 object-contain drop-shadow-[0_0_30px_rgba(34,211,238,.55)]" />
          <motion.img src="/assets/nxt5-mark.png?v=8" alt="" aria-hidden="true" className="pointer-events-none absolute inset-2 z-20 h-24 w-24 object-contain opacity-80 mix-blend-screen" style={{ filter: "brightness(1.65) saturate(1.6) drop-shadow(0 0 8px rgba(34,211,238,.8))", clipPath: "polygon(-20% 0, 6% 0, 38% 100%, 12% 100%)" }} animate={{ x: [-34, 38], opacity: [0, 0.95, 0] }} transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }} />
          <motion.img src="/assets/nxt5-mark.png?v=8" alt="" aria-hidden="true" className="pointer-events-none absolute inset-2 z-20 h-24 w-24 object-contain opacity-70 mix-blend-screen" style={{ filter: "brightness(1.55) saturate(1.7) drop-shadow(0 0 9px rgba(217,70,239,.72))", clipPath: "polygon(62% 0, 88% 0, 120% 100%, 94% 100%)" }} animate={{ x: [34, -38], opacity: [0, 0.82, 0] }} transition={{ duration: 1.95, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-fuchsia-300/0" animate={{ borderColor: ["rgba(217,70,239,0.05)", "rgba(34,211,238,.42)", "rgba(217,70,239,0.05)"], boxShadow: ["0 0 18px rgba(34,211,238,.14)", "0 0 46px rgba(217,70,239,.28)", "0 0 18px rgba(34,211,238,.14)"] }} transition={{ duration: 1.55, repeat: Infinity, ease: "easeInOut" }} />
        </div>
        <p className="nxt5-wordmark mt-5 text-2xl uppercase leading-none">NEXT FIVE</p>
        <div className="mx-auto mt-5 flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-black/24 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          <span className="text-sm font-black text-slate-200">{label}</span>
        </div>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/8">
          <motion.div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400" animate={{ x: ["-110%", "220%"] }} transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </motion.div>
    </div>
  );
}

function MainApp({ user, onLogout, onUserUpdate, pushToast, navigate, route }) {
  const initialPage = new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path);
  const [active, setActiveState] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [apiError, setApiError] = useState("");

  function setActive(pageId) {
    setActiveState(pageId);
    const keepInvite = pageId === "teams" && new URLSearchParams(window.location.search).has("invite");
    navigate(`${pathFromPage(pageId)}${keepInvite ?window.location.search : ""}`);
  }

  function openTeamCreation() {
    navigate("/equipes?create=1");
  }

  function openTeamManagement() {
    navigate("/gestion-equipe");
  }

  async function refreshAll() {
    setLoading(true); setApiError("");
    try { const result = await apiFetch("bootstrap"); setData({ ...DEFAULT_DATA, ...result }); if (!selectedTeamId && result.teams?.[0]?.id) setSelectedTeamId(result.teams[0].id); }
    catch (err) { setApiError(err.message || "Impossible de charger les données."); if (!bootstrapped) setData(DEFAULT_DATA); }
    finally { setLoading(false); setBootstrapped(true); }
  }
  async function logout() { try { await apiFetch("auth-logout", { method: "POST" }); } catch {} pushToast({ type: "cyan", title: "Déconnecté", text: "Tu es bien déconnecté." }); navigate("/connexion", { replace: true }); onLogout(); }
  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { setActiveState(new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path)); }, [route.path, route.search]);

  const currentTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null;
  const currentMember = currentTeam ?(data.teamMembers || []).find((member) => member.team_id === currentTeam.id && member.user_id === user.id) : null;

  const page = useMemo(() => {
    if (active === "teams") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />;
    if (active === "team-management") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} managementOnly />;
    if (active === "matches") return <Matches data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "stats") return <Statistics data={data} selectedTeamId={selectedTeamId} />;
    if (active === "champions") return <Champions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "planning") return <Planning data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "compositions") return <Compositions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "reports") return <Reports data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} />;
    if (active === "settings") return <SettingsPage user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />;
    return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />;
  }, [active, data, loading, selectedTeamId, currentMember, route.search, pushToast, user, onUserUpdate]);

  const linkedPlayer = currentTeam ?(data.players || []).find((player) => player.team_id === currentTeam.id && player.user_id === user.id) : null;
  if (!bootstrapped) return <AppLoadingScreen label="Synchronisation de ta team…" />;
  if (!data.teams.length) return <div className="relative min-h-screen text-white"><AmbientBackground /><main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 lg:px-8"><div className="mb-6 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><img src="/assets/nxt5-mark.png?v=8" alt="NXT5" className="h-14 w-14 object-contain drop-shadow-[0_0_22px_rgba(34,211,238,.45)]" /><div><p className="nxt5-wordmark text-2xl uppercase leading-none">NEXT FIVE</p><p className="mt-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-100/55">Team access</p></div></div><Button variant="ghost" icon={LogOut} onClick={logout}>Déconnexion</Button></div><ApiBanner error={apiError} /><Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} /></main><LegalLinks navigate={navigate} />{!user?.email && <MissingEmailModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}</div>;
  return <div className="relative min-h-screen text-white"><AmbientBackground /><Sidebar active={active} setActive={setActive} open={sidebarOpen} setOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} user={user} currentMember={currentMember} linkedPlayer={linkedPlayer} onLogout={logout} /><div className={cx("relative z-10 transition-all duration-300", sidebarCollapsed ?"lg:pl-24" : "lg:pl-[21rem]")}><Topbar active={active} setOpen={setSidebarOpen} currentTeam={currentTeam} teams={data.teams} onSelectTeam={setSelectedTeamId} onCreateTeam={openTeamCreation} onManageTeam={openTeamManagement} /><main className="w-full px-4 py-7 lg:px-8 2xl:px-10"><ApiBanner error={apiError} /><AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>{page}</motion.div></AnimatePresence></main><LegalLinks navigate={navigate} /></div>{!user?.email && <MissingEmailModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}</div>;
}

export default function NXT5() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [route, setRoute] = useState(readRoute);

  function navigate(path, options = {}) {
    const method = options.replace ?"replaceState" : "pushState";
    window.history[method]({}, "", path);
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pushToast(toast) {
    const id = crypto.randomUUID ?crypto.randomUUID() : String(Date.now() + Math.random());
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }
  function removeToast(id) { setToasts((current) => current.filter((item) => item.id !== id)); }
  function handleAuth(nextUser) {
    setUser(nextUser);
  }

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let mounted = true;
    apiFetch("auth-me").then((result) => { if (mounted) setUser(result.user); }).catch(() => { if (mounted) setUser(null); }).finally(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const navTitle = NAV.find((item) => item.path === route.path)?.label;
    const publicTitles = {
      "/": "NXT5",
      "/connexion": "Connexion — NXT5",
      "/creer-un-compte": "Créer un compte — NXT5",
      "/inscription": "Créer un compte — NXT5",
      "/mot-de-passe-oublie": "Mot de passe oublié — NXT5",
      "/reinitialiser-mot-de-passe": "Réinitialiser le mot de passe — NXT5",
      "/mentions-legales": "Mentions légales — NXT5",
      "/confidentialite": "Confidentialité — NXT5",
      "/conditions": "Conditions — NXT5",
    };
    document.title = publicTitles[route.path] || (navTitle ?`${navTitle} — NXT5` : "NXT5");
  }, [route.path]);

  useEffect(() => {
    if (!checkingSession && user && (route.path === "/" || authModeFromPath(route.path))) {
      navigate("/equipes", { replace: true });
    }
  }, [checkingSession, user, route.path]);

  useEffect(() => {
    if (checkingSession || user || !isAppPath(route.path)) return;
    const params = new URLSearchParams(route.search);
    if (route.path === "/equipes" && params.has("invite")) {
      navigate(`/creer-un-compte?invite=${encodeURIComponent(params.get("invite"))}`, { replace: true });
      return;
    }
    navigate(buildLoginRedirect(route.path, route.search), { replace: true });
  }, [checkingSession, user, route.path, route.search]);

  if (checkingSession) return <AppLoadingScreen label="Vérification de session…" />;

  const inviteMode = new URLSearchParams(route.search).has("invite") ?"register" : null;
  const mode = authModeFromPath(route.path) || inviteMode;
  const routeIsPrivate = isAppPath(route.path);
  const unknownRoute = !isKnownPath(route.path);
  const view = unknownRoute
    ?<NotFoundPage navigate={navigate} />
      : LEGAL_PAGES[route.path]
      ?<LegalPage route={route} navigate={navigate} />
      : user
      ?<MainApp user={user} onLogout={() => setUser(null)} onUserUpdate={setUser} pushToast={pushToast} navigate={navigate} route={route} />
      : route.path === "/mot-de-passe-oublie"
        ?<ForgotPasswordPage navigate={navigate} />
      : route.path === "/reinitialiser-mot-de-passe"
        ?<ResetPasswordPage navigate={navigate} />
      : mode
        ?<AuthPage mode={mode} onAuth={handleAuth} pushToast={pushToast} navigate={navigate} />
        : routeIsPrivate
          ?<AuthPage mode="login" onAuth={handleAuth} pushToast={pushToast} navigate={navigate} />
          : <HomeScreen navigate={navigate} />;

  return <>{view}<ToastStack toasts={toasts} removeToast={removeToast} /></>;
}
