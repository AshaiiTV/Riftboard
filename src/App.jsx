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
  Eye,
  FileText,
  Flame,
  Gauge,
  Goal,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
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

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, shortcut: "D", path: "/dashboard" },
  { id: "teams", label: "Équipes", icon: Users, shortcut: "T", path: "/equipes" },
  { id: "matches", label: "Reviews", icon: Swords, shortcut: "M", path: "/reviews" },
  { id: "champions", label: "Champion pool", icon: Crown, shortcut: "C", path: "/champion-pool" },
  { id: "progression", label: "Apprentissage", icon: Target, shortcut: "A", path: "/apprentissage" },
  { id: "scouting", label: "Tournoi & draft", icon: Shield, shortcut: "V", path: "/tournoi-draft" },
  { id: "reports", label: "Rapports", icon: FileText, shortcut: "R", path: "/rapports" },
];

const AUTH_ROUTES = {
  "/connexion": "login",
  "/creer-un-compte": "register",
  "/inscription": "register",
};

const PUBLIC_ROUTES = ["/"];
const AUTH_PATHS = Object.keys(AUTH_ROUTES);

function normalizePath(pathname = "/") {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function pageFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  return NAV.find((item) => item.path === path)?.id || "dashboard";
}

function pathFromPage(pageId) {
  return NAV.find((item) => item.id === pageId)?.path || "/dashboard";
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
  dashboard: null,
  teams: [],
  teamMembers: [],
  players: [],
  matches: [],
  championPool: [],
  improvements: [],
  reports: [],
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
    throw new Error("Impossible de joindre le serveur. Vérifie que les fonctions Netlify sont bien déployées.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fallback = response.status === 502 || response.status === 503
      ?"Service temporairement indisponible. Réessaie après configuration de la base de données."
      : `Erreur serveur ${response.status}.`;
    const error = new Error(payload?.error || fallback);
    error.status = response.status;
    error.code = payload?.code || null;
    throw error;
  }

  return payload;
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function tone(t) {
  return {
    slate: "border-white/10 bg-white/[0.045] text-slate-200",
    cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-cyan-500/10",
    purple: "border-violet-300/25 bg-violet-500/10 text-violet-100 shadow-violet-500/10",
    pink: "border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100 shadow-fuchsia-500/10",
    green: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-500/10",
    yellow: "border-amber-300/25 bg-amber-500/10 text-amber-100 shadow-amber-500/10",
    red: "border-rose-300/25 bg-rose-500/10 text-rose-100 shadow-rose-500/10",
    blue: "border-sky-300/25 bg-sky-500/10 text-sky-100 shadow-sky-500/10",
  }[t || "slate"];
}

function gradeTone(grade) {
  return grade === "S" ?"green" : grade === "A" ?"cyan" : grade === "B" ?"purple" : grade === "C" ?"yellow" : grade === "D" ?"red" : "slate";
}

function profileStatusLabel(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "captain") return "Capitaine";
  if (role === "coach") return "Coach";
  return "Joueur";
}

function profileStatusTone(member) {
  const role = String(member?.role || "").toLowerCase();
  if (role === "captain") return "yellow";
  if (role === "coach") return "purple";
  return "blue";
}

function Badge({ children, tone: t = "slate", pulse = false }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] shadow-sm", tone(t))}>
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />}
      {children}
    </span>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#050711]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(124,58,237,.34),transparent_30%),radial-gradient(circle_at_86%_15%,rgba(34,211,238,.20),transparent_30%),radial-gradient(circle_at_55%_92%,rgba(217,70,239,.12),transparent_38%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.034)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.034)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.18]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,.28)_72%)]" />
      <motion.div animate={{ x: [0, 34, -24, 0], y: [0, -26, 18, 0], scale: [1, 1.08, 0.96, 1] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} className="absolute left-[8%] top-[12%] h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      <motion.div animate={{ x: [0, -30, 20, 0], y: [0, 20, -18, 0], scale: [1, 0.96, 1.1, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} className="absolute right-[5%] top-[18%] h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
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
        "group relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#0b1020]/72 p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[1.65rem] before:bg-gradient-to-br before:from-white/[0.075] before:via-transparent before:to-transparent before:opacity-80",
        glow && "after:pointer-events-none after:absolute after:-inset-px after:rounded-[1.65rem] after:bg-gradient-to-r after:from-violet-400/20 after:via-cyan-300/10 after:to-fuchsia-400/20 after:opacity-0 after:blur-xl after:transition after:duration-500 group-hover:after:opacity-100",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function Button({ children, icon: Icon, variant = "primary", className = "", disabled = false, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition duration-200 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white shadow-lg shadow-violet-950/40 hover:-translate-y-0.5 hover:shadow-cyan-950/40",
    ghost: "border border-white/10 bg-white/[0.045] text-slate-100 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.075]",
    danger: "border border-rose-300/25 bg-rose-500/10 text-rose-100 hover:-translate-y-0.5 hover:bg-rose-500/15",
  };
  return (
    <button disabled={disabled} className={cx(base, variants[variant], className)} {...props}>
      {Icon && <Icon className={cx("h-4 w-4", Icon === Loader2 && "animate-spin")} />}
      {children}
    </button>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text", required = false, icon: Icon }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className={cx("w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-650 focus:border-cyan-300/55 focus:bg-black/[0.28] focus:ring-4 focus:ring-cyan-300/10", Icon && "pl-10")} />
      </div>
    </label>
  );
}

function TextAreaInput({ label, value, onChange, placeholder, icon: Icon, rows = 4 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-slate-600" />}
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className={cx("w-full resize-none rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-650 focus:border-cyan-300/55 focus:bg-black/[0.28] focus:ring-4 focus:ring-cyan-300/10", Icon && "pl-10")} />
      </div>
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <div className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/55 focus:ring-4 focus:ring-cyan-300/10">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>
    </label>
  );
}

function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2"><span className="h-px w-8 bg-gradient-to-r from-cyan-300 to-transparent" /><p className="text-[0.7rem] font-black uppercase tracking-[0.32em] text-cyan-200/75">{eyebrow}</p></div>
        <h2 className="max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
        {subtitle && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">{subtitle}</p>}
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
              <div className="min-w-0 flex-1"><p className="font-black">{toast.title}</p>{toast.text && <p className="mt-1 text-sm leading-5 opacity-80">{toast.text}</p>}</div>
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.08),transparent_42%)]" />
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
        <div className="min-w-0"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 truncate text-3xl font-black text-white md:text-4xl">{value ?? "-"}</p><p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{hint ?? "En attente de donnees"}</p></div>
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
        src={compact ?"/riftboard-rb-mark.svg" : "/riftboard-rb-logo.svg"}
        alt="RiftBoard"
        className={cx(
          "object-contain drop-shadow-[0_0_22px_rgba(34,211,238,.30)]",
          compact ?"h-12 w-12" : "h-14 w-auto max-w-[180px] sm:max-w-[245px]"
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
      <div className="absolute -inset-6 rounded-[2.6rem] bg-gradient-to-r from-cyan-400/20 via-violet-500/10 to-fuchsia-500/25 blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#07101f]/92 p-5 shadow-2xl shadow-violet-950/45 backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_5%,rgba(139,92,246,.22),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(34,211,238,.16),transparent_34%)]" />
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
              <p className="mt-1 text-xs font-black text-cyan-200/70">{m[2]}</p>
            </div>
          ))}
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-[.95fr_1.05fr] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">Champion pool</p>
            <p className="text-xs text-slate-500">Classement réel après plusieurs imports</p>
            <div className="mt-4 space-y-3">
              {pool.map((label, i) => (
                <div key={label} className="grid grid-cols-[42px_1fr_84px] items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-cyan-400/30 to-violet-500/30 text-xs font-black text-white">{i + 1}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div animate={{ opacity: [0.45, 0.85, 0.45] }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.12 }} className="h-full rounded-full bg-gradient-to-r from-cyan-300/45 to-violet-400/45" style={{ width: `${76 - i * 9}%` }} />
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
            <p className="mt-1 text-xs font-black text-cyan-200/70">Données réelles uniquement</p>
            <svg viewBox="0 0 320 120" className="mt-5 h-28 w-full"><defs><linearGradient id="line" x1="0" x2="1"><stop stopColor="#22d3ee"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs><path d="M0 90 C35 35 55 86 92 55 S145 46 176 38 S235 68 260 42 S292 58 320 25" fill="none" stroke="url(#line)" strokeWidth="6" strokeLinecap="round" opacity=".34"/><path d="M0 90 C35 35 55 86 92 55 S145 46 176 38 S235 68 260 42 S292 58 320 25 L320 120 L0 120Z" fill="url(#line)" opacity=".08"/></svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatStrip() {
  const stats = [
    [Crown, "Champion pool", "Picks forts et picks pièges", "cyan"],
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
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition duration-200 active:translate-y-0";
  const variants = {
    primary: "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white shadow-lg shadow-violet-950/40 hover:-translate-y-0.5 hover:shadow-cyan-950/40",
    ghost: "border border-white/10 bg-white/[0.045] text-slate-100 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.075]",
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
      <a href="/" onClick={goHome} aria-label="Accueil RiftBoard" className="transition hover:opacity-90"><BrandLogo /></a>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </header>
  );
}

function HomeScreen({ navigate }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_28%,rgba(139,92,246,.16),transparent_26%),radial-gradient(circle_at_85%_22%,rgba(34,211,238,.12),transparent_28%)]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href="/connexion" navigate={navigate} variant="ghost" className="hidden md:inline-flex">Se connecter</LinkButton>
        <LinkButton href="/creer-un-compte" navigate={navigate} className="px-3 py-2.5 sm:px-4">Créer un compte</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-16">
        <section className="grid min-h-[calc(100vh-104px)] items-center gap-10 py-8 lg:grid-cols-[.88fr_1.12fr] lg:py-10">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
            <Badge tone="cyan" pulse>La plateforme d’analyse pour équipes compétitives</Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl">
              Moins de <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">feeling.</span> Plus de <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">décisions claires</span> après chaque game.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">RiftBoard centralise tes games, ton roster et tes reviews pour aider ta team à savoir quoi travailler avant le prochain scrim.</p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <LinkButton href="/creer-un-compte" navigate={navigate} icon={ChevronRight} className="px-6 py-4 sm:px-7">Créer un compte</LinkButton>
              <Button variant="ghost" icon={Search} onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })} className="px-6 py-4 sm:px-7">Voir l’aperçu</Button>
            </div>
          </motion.div>
          <MarketingPreview />
        </section>

        <section id="features" className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Crown, title: "Champion pool lisible", text: "Repère les picks fiables, les picks pièges et les champions a remettre au travail avec WR, KDA et volume.", t: "cyan" },
            { icon: Swords, title: "Apprendre après chaque game", text: "Lis chaque match avec champions, KDA, dégâts, gold, vision, objectifs et erreurs a comprendre.", t: "purple" },
            { icon: Target, title: "Préparation compétition", text: "Prépare scrims, tournois et matchs officiels avec des priorités concrètes : vision, morts isolées, dragons, Nashor, side lanes.", t: "green" },
          ].map((item, i) => { const Icon = item.icon; return <Surface key={item.title} delay={i * .06} glow><div className={cx("mb-5 inline-flex rounded-2xl border p-4", tone(item.t))}><Icon className="h-7 w-7" /></div><h3 className="text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{item.text}</p></Surface>; })}
        </section>

        <section id="analytics" className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 md:p-9">
          <div className="mb-8 text-center"><h2 className="text-3xl font-black text-white md:text-4xl">Du match à l’apprentissage</h2><p className="mt-3 text-sm font-semibold text-slate-500">RiftBoard doit aider joueurs, coachs et capitaines à comprendre ce qui gagne, ce qui coûte les games, et quoi améliorer avant le prochain rendez-vous compétitif.</p></div>
          <div className="grid gap-5 md:grid-cols-4">
            {[["1", Swords, "Importe la game", "Le match devient une fiche lisible avec champions, side, patch et objectifs."], ["2", Eye, "Lis les signaux", "Vision, dégâts, gold, KDA, KP et morts exposees ressortent sans fouiller."], ["3", Crown, "Trie les picks", "Le champion pool révèle les picks fiables, situationnels et dangereux."], ["4", Target, "Prépare le prochain match", "La review finit sur une priorité claire pour progresser en tournoi, scrim ou entraînement."]].map(([n, Icon, title, text]) => <div key={n} className="relative rounded-3xl border border-white/10 bg-black/[0.18] p-6"><Badge tone="purple">{n}</Badge><div className="mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-100"><Icon className="h-7 w-7" /></div><h3 className="mt-5 text-xl font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>)}
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
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-400">Cette URL ne correspond à aucune page RiftBoard. Reviens à l’accueil ou connecte-toi pour accéder au dashboard.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/" navigate={navigate} variant="ghost">Retour accueil</LinkButton>
            <LinkButton href="/connexion" navigate={navigate} icon={Lock}>Connexion</LinkButton>
          </div>
        </Surface>
      </main>
    </div>
  );
}

function AuthPage({ mode, onAuth, pushToast, navigate }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ accountName: "", password: "" });
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
      const body = { accountName: form.accountName, password: form.password };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      pushToast({ type: "green", title: isRegister ?"Compte créé" : "Connexion réussie", text: "Bienvenue sur RiftBoard." });
      const params = new URLSearchParams(window.location.search);
      const hasInvite = params.has("invite");
      const next = params.get("next");
      const destination = hasInvite
        ?`/equipes?invite=${encodeURIComponent(params.get("invite"))}`
        : isSafeInternalPath(next)
          ?next
          : "/dashboard";
      navigate(destination, { replace: true });
      onAuth(result.user);
    } catch (err) {
      if (err?.code === "DB_NOT_CONFIGURED") {
        setError("La création de compte n’est pas encore active : la base de données du site doit être reliée dans Netlify.");
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_28%,rgba(139,92,246,.16),transparent_26%),radial-gradient(circle_at_85%_22%,rgba(34,211,238,.12),transparent_28%)]" />
      <SiteHeader navigate={navigate}>
        <LinkButton href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} variant="ghost" className="hidden md:inline-flex">
          {isRegister ?"J’ai déjà un compte" : "Créer un compte"}
        </LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-108px)] max-w-7xl items-center gap-8 px-5 pb-16 lg:grid-cols-[.85fr_1.15fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
          <Badge tone={isRegister ?"purple" : "cyan"} pulse>{isRegister ?"Création de compte" : "Connexion"}</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] md:text-7xl">
            {isRegister ?"Crée ton espace RiftBoard." : "Retourne dans ton espace RiftBoard."}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">
            {isRegister
              ?"Crée ton compte avec un nom unique, puis choisis directement : créer une équipe ou rejoindre une team avec un lien d’invitation."
              : "Connecte-toi pour retrouver tes teams, tes imports, tes rapports et tes paramètres sauvegardés côté serveur."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[[BarChart3, "Profil de jeu"], [Shield, "Draft & r?les"], [Users, "Progression team" ]].map(([Icon, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon className="h-5 w-5 text-cyan-200" /><p className="mt-3 text-sm font-black text-white">{label}</p></div>)}
          </div>
        </motion.div>

        <Surface glow className="mx-auto w-full max-w-xl">
          <h2 className="text-3xl font-black text-white">{isRegister ?"Créer un compte" : "Connexion"}</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">{isRegister ?"Une fois connecté, tu choisis : créer une team ou rejoindre une invitation." : "Entre ton nom de compte et ton mot de passe pour accéder au tableau de bord."}</p>
          <div className="mt-5 flex rounded-2xl border border-white/10 bg-black/[0.18] p-1">
            <a href={`/connexion${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", !isRegister ?"bg-white/10 text-white" : "text-slate-500 hover:text-white")}>Connexion</a>
            <a href={`/creer-un-compte${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", isRegister ?"bg-white/10 text-white" : "text-slate-500 hover:text-white")}>Créer un compte</a>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextInput label="Nom de compte" value={form.accountName} onChange={(v) => patch("accountName", v)} placeholder="Ex : Ashaii" required icon={Users} />
            <TextInput label="Mot de passe" value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" required icon={Lock} />
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading} icon={loading ?Loader2 : isRegister ?UserPlus : Lock} className="w-full py-4">{loading ?"Chargement…" : isRegister ?"Créer le compte" : "Entrer dans RiftBoard"}</Button>
          </form>
          <p className="mt-4 text-center text-sm font-semibold text-slate-600">
            {isRegister ?"Déjà inscrit ?" : "Pas encore de compte ?"}
            <a className="font-black text-cyan-200 hover:text-white" href={isRegister ?`/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`}>{isRegister ?"Connexion" : "Créer un compte"}</a>
          </p>
        </Surface>
      </main>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, user, onLogout, currentMember }) {
  const status = profileStatusLabel(currentMember);
  return (
    <>
      <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden" />}</AnimatePresence>
      <aside className={cx("fixed left-0 top-0 z-40 flex h-screen w-76 flex-col border-r border-white/10 bg-[#070b16]/88 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl transition-transform lg:translate-x-0", open ?"translate-x-0" : "-translate-x-full")}>
        <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-3"><img src="/riftboard-rb-mark.svg" alt="RiftBoard" className="h-11 w-11 object-contain" /><div><p className="text-lg font-black tracking-tight">RiftBoard</p><p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-600">Performance OS</p></div></div><button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button></div>
        <nav className="space-y-1.5">{NAV.map((item) => { const Icon = item.icon; const selected = active === item.id; return <button key={item.id} onClick={() => { setActive(item.id); setOpen(false); }} className={cx("group flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left text-sm font-black transition duration-200", selected ?"bg-gradient-to-r from-violet-500/30 via-fuchsia-500/12 to-cyan-400/12 text-white shadow-lg shadow-violet-950/20" : "text-slate-500 hover:bg-white/[0.055] hover:text-white")}><span className="flex items-center gap-3"><Icon className={cx("h-5 w-5 transition", selected ?"text-cyan-200" : "text-slate-600 group-hover:text-cyan-200")} />{item.label}</span><span className={cx("rounded-lg border px-2 py-0.5 text-[0.65rem]", selected ?"border-cyan-300/25 text-cyan-100" : "border-white/8 text-slate-700")}>{item.shortcut}</span></button>; })}</nav>
        <div className="mt-auto space-y-3"><Surface className="rounded-3xl p-4" delay={0}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-200"><Users className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{user?.account_name || user?.name || "Coach"}</p><p className="truncate text-xs font-semibold text-slate-600">{status}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone="green" pulse>Online</Badge><Badge tone={profileStatusTone(currentMember)}>{status}</Badge></div></Surface><Button variant="ghost" icon={LogOut} onClick={onLogout} className="w-full justify-start">Déconnexion</Button></div>
      </aside>
    </>
  );
}

function TeamAvatar({ team, className = "h-12 w-12" }) {
  if (team?.avatar_data_url) {
    return <div className={cx("overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/30", className)}><img src={team.avatar_data_url} alt={team.name || "Team"} className="h-full w-full object-cover" style={{ transform: "scale(" + Number(team.avatar_zoom || 1) + ")", objectPosition: Number(team.avatar_x ?? 50) + "% " + Number(team.avatar_y ?? 50) + "%" }} /></div>;
  }
  return <img src="/riftboard-rb-mark.svg" alt="RiftBoard" className={cx("object-contain drop-shadow-[0_0_18px_rgba(34,211,238,.35)]", className)} />;
}

function Topbar({ active, setOpen, currentTeam, teams, onSelectTeam, onCreateTeam, onManageTeam }) {
  const nav = NAV.find((item) => item.id === active) || NAV[0];
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  return <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050711]/72 px-4 py-4 text-white backdrop-blur-2xl lg:px-8"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-2 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden md:block"><TeamAvatar team={currentTeam} /></div><div className="relative min-w-0"><p className="text-[0.68rem] font-black uppercase tracking-[0.26em] text-cyan-200/70">{nav.label}</p><button onClick={() => setTeamMenuOpen((open) => !open)} className="mt-0.5 flex max-w-[58vw] items-center gap-2 rounded-2xl px-0 py-0 text-left transition hover:text-cyan-100"><h1 className="truncate text-xl font-black tracking-tight md:text-2xl">{currentTeam?.name || nav.label}</h1><ChevronDown className="h-5 w-5 shrink-0 text-cyan-200" /></button><AnimatePresence>{teamMenuOpen && <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="absolute left-0 top-[calc(100%+0.6rem)] z-50 w-[min(88vw,380px)] overflow-hidden rounded-3xl border border-white/10 bg-[#080d19]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">{teams.map((team) => <button key={team.id} onClick={() => { onSelectTeam(team.id); setTeamMenuOpen(false); }} className={cx("flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition", currentTeam?.id === team.id ?"bg-cyan-400/10 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white")}><span className="flex min-w-0 items-center gap-3"><TeamAvatar team={team} className="h-9 w-9 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-black">{team.name}</span><span className="mt-1 block text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-600">{team.tag || "TEAM"} · {team.region || "EUW"}</span></span></span>{currentTeam?.id === team.id && <Check className="h-4 w-4 shrink-0 text-cyan-200" />}</button>)}<button onClick={() => { onCreateTeam(); setTeamMenuOpen(false); }} className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-black text-cyan-100 transition hover:bg-white/[0.07]"><Plus className="h-4 w-4" />Cr?er une nouvelle team</button></motion.div>}</AnimatePresence></div></div>{currentTeam && <Button variant="ghost" icon={Settings} onClick={onManageTeam}>Gestion</Button>}</div></header>;
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
  return <Surface glow><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><Badge tone="cyan">win condition</Badge><h3 className="mt-4 text-2xl font-black text-white">Plan de jeu probable</h3><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Une lecture automatique du pool actuel : ce qu'on peut jouer, ce qu'il faut proteger, et ce qui manque avant un match important.</p></div><Button variant="ghost" icon={Shield} onClick={onOpenDraft}>Ouvrir draft</Button></div>{best ? <div className="mt-6 grid gap-4 xl:grid-cols-[.9fr_1.1fr]"><div className="relative min-h-[260px] overflow-hidden rounded-[1.45rem] border border-cyan-300/20 bg-cyan-400/10 p-5"><ChampionBackdrop champion={best.champion} /><div className="relative z-10"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Pick autour duquel jouer</p><h4 className="mt-3 text-4xl font-black text-white">{championDisplayName(best.champion)}</h4><p className="mt-2 text-sm font-bold text-slate-300">{best.player_name || "Roster"}</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">WR</p><p className="mt-1 text-xl font-black text-white">{best.winrate || 0}%</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">KDA</p><p className="mt-1 text-xl font-black text-white">{Number(best.kda || 0).toFixed(1)}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Games</p><p className="mt-1 text-xl font-black text-white">{best.games || 0}</p></div></div></div></div><div className="grid gap-3"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Picks stables</p><div className="mt-3 flex flex-wrap gap-2">{stable.length ? stable.map((pick) => <div key={pick.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3"><img src={championSquareUrl(pick)} alt={pick.champion} className="h-8 w-8 rounded-full object-cover" /><span className="text-xs font-black text-white">{championDisplayName(pick.champion)}</span></div>) : <span className="text-sm font-semibold text-slate-500">Pas encore assez de volume.</span>}</div></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">A proteger / travailler</p><div className="mt-3 flex flex-wrap gap-2">{weak.length ? weak.map((pick) => <Badge key={pick.id} tone="red">{championDisplayName(pick.champion)} ? {pick.winrate || 0}%</Badge>) : <Badge tone="green">Aucun gros point faible detecte</Badge>}{missingRoles.length > 0 && <Badge tone="yellow">Slots manquants : {missingRoles.join(", ")}</Badge>}</div></div></div></div> : <EmptyState icon={Crown} title="Plan de jeu en attente" text="Importe des games pour que RiftBoard detecte les champions a jouer autour." />}</Surface>;
}

function Dashboard({ data, loading, setActive }) {
  const d = data.dashboard || {};
  const bestChampion = data.championPool[0];
  const worstChampion = [...data.championPool].reverse()[0];
  const latestMatch = data.matches[0];
  const priority = data.improvements[0];

  return <div><PageHeader eyebrow="Performance surface" title="Vue globale de ta structure" subtitle="Retrouve en un coup d’œil la forme de ton équipe, les priorités de review et les signaux à travailler avant le prochain scrim."><Button variant="ghost" icon={Swords} onClick={() => setActive("matches")}>Importer une game</Button><Button icon={Target} onClick={() => setActive("progression")}>Voir les priorités</Button></PageHeader><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard delay={0} icon={Trophy} label="Winrate récent" value={d.recentWinrate} hint={d.winrateTrend} tone="green" /><MetricCard delay={0.04} icon={Gauge} label="Score d’impact" value={d.impactScore} hint={d.impactTrend} tone="purple" /><MetricCard delay={0.08} icon={Eye} label="Vision diff" value={d.visionDiff} hint={d.visionTrend} tone="cyan" /><MetricCard delay={0.12} icon={AlertTriangle} label="Risque midgame" value={d.midgameRisk} hint={d.riskTrend} tone="red" /></div><LatestMatchPanel match={latestMatch} onOpen={() => setActive("matches")} /><div className="mt-6"><WinConditionPanel championPool={data.championPool} players={data.players} onOpenDraft={() => setActive("scouting")} /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Surface glow><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-white">Cockpit de diagnostic</h3><p className="mt-1 text-sm font-medium text-slate-500">La prochaine action claire avant review.</p></div><Badge tone="purple">live synthesis</Badge></div>{loading ?<SkeletonRows count={3} /> : priority || latestMatch ?<div className="grid gap-4 lg:grid-cols-2"><div className="relative overflow-hidden rounded-[1.35rem] border border-rose-300/18 bg-gradient-to-br from-rose-500/12 to-black/20 p-5"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rose-400/10 blur-2xl" /><Badge tone="red">Priorité #{priority?.rank || 1}</Badge><h4 className="mt-4 text-2xl font-black text-white">{priority?.title || latestMatch?.primary_focus || "Axe de review"}</h4><p className="mt-3 text-sm leading-6 text-slate-300">{priority?.proof || latestMatch?.main_issue || "Importe plus de games pour stabiliser le diagnostic."}</p><div className="mt-4 rounded-2xl border border-white/10 bg-black/[0.20] p-4 text-sm font-bold leading-6 text-white">{priority?.action || "Relire les 90 secondes avant chaque objectif neutre."}</div></div><div className="space-y-3"><ChampionMiniCard title="Pick le plus fiable" item={bestChampion} icon={Crown} tone="green" /><ChampionMiniCard title="Pick à surveiller" item={worstChampion} icon={AlertTriangle} tone="yellow" /></div></div> : <EmptyState icon={BarChart3} title="Dashboard en attente" text="Crée une team ou rejoins-la depuis un lien d’invitation, ajoute les joueurs du roster, puis importe une game. RiftBoard affichera ensuite les diagnostics de ton équipe." />}</Surface><Surface><div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-black text-white">Dernières games</h3><p className="mt-1 text-sm text-slate-500">Historique DB avec focus de review.</p></div><Badge tone="blue">matches</Badge></div>{loading ?<SkeletonRows /> : data.matches.length ?<div className="space-y-3">{data.matches.slice(0, 5).map((match) => <button key={match.id} onClick={() => setActive("matches")} className="group w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.06]"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-white">{match.opponent || match.game_id}</p><Badge tone={match.result === "Victoire" ?"green" : match.result === "Défaite" ?"red" : "slate"}>{match.result || "Analyse"}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"} · {match.side || "Side ?"}</p></div><ChevronRight className="h-5 w-5 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" /></div><p className="mt-3 text-sm font-bold text-cyan-100">{match.primary_focus || "Analyse qui sert vraiment à calculer"}</p></button>)}</div> : <EmptyState icon={Swords} title="Aucune game importée" text="Colle un Game ID dans l’analyse de match. Les données seront sauvegardées en base." />}</Surface></div></div>;
}

function ChampionMiniCard({ title, item, icon: Icon, tone: t }) {
  return <div className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4"><ChampionBackdrop champion={item?.champion} /><div className="relative z-10 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{title}</p><p className="mt-2 text-xl font-black text-white">{championDisplayName(item?.champion) || "?"}</p><p className="mt-1 text-sm font-semibold text-slate-400">{item?.player_name || "Données insuffisantes"}</p></div><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div></div><div className="relative z-10 mt-4 flex flex-wrap gap-2"><Badge tone="slate">{item?.games ?? 0} games</Badge><Badge tone={Number(item?.winrate || 0) >= 55 ?"green" : "yellow"}>{item?.winrate ?? "?"}% WR</Badge><Badge tone={gradeTone(item?.impact_grade)}>{item?.impact_grade || "?"}</Badge></div></div>;
}

const CHAMPION_STYLE_TAGS = {
  Aatrox: ["bruiser", "teamfight"], Ahri: ["pick", "tempo"], Akali: ["assassin", "side"], Alistar: ["engage", "peel"], Amumu: ["engage", "teamfight"], Anivia: ["control", "scaling"], Annie: ["burst", "engage"], Aphelios: ["scaling", "front-to-back"], Ashe: ["utility", "pick"], AurelionSol: ["scaling", "control"], Azir: ["scaling", "front-to-back"],
  Bard: ["roam", "pick"], Blitzcrank: ["pick", "engage"], Brand: ["poke", "teamfight"], Braum: ["peel", "front-to-back"], Caitlyn: ["lane", "siege"], Camille: ["side", "pick"], Cassiopeia: ["scaling", "front-to-back"], Chogath: ["frontline", "objective"], Corki: ["poke", "scaling"],
  Darius: ["bruiser", "lane"], Diana: ["engage", "burst"], DrMundo: ["frontline", "scaling"], Draven: ["lane", "snowball"], Ekko: ["assassin", "side"], Elise: ["early", "dive"], Evelynn: ["pick", "assassin"], Ezreal: ["poke", "safe"], Fiddlesticks: ["engage", "teamfight"], Fiora: ["side", "duel"], Fizz: ["assassin", "pick"],
  Galio: ["engage", "cover"], Gangplank: ["scaling", "teamfight"], Garen: ["bruiser", "simple"], Gnar: ["teamfight", "side"], Gragas: ["engage", "disengage"], Graves: ["tempo", "skirmish"], Gwen: ["scaling", "side"], Hecarim: ["engage", "tempo"], Heimerdinger: ["control", "siege"], Hwei: ["control", "poke"],
  Irelia: ["side", "snowball"], Ivern: ["utility", "peel"], Janna: ["peel", "disengage"], JarvanIV: ["engage", "early"], Jax: ["side", "scaling"], Jayce: ["poke", "lane"], Jhin: ["utility", "pick"], Jinx: ["scaling", "front-to-back"], Kaisa: ["dive", "scaling"], Kalista: ["lane", "objective"], Karma: ["poke", "tempo"], Karthus: ["scaling", "farm"], Kassadin: ["scaling", "side"], Katarina: ["reset", "snowball"], Kayle: ["scaling", "front-to-back"], Kayn: ["tempo", "skirmish"], Kennen: ["engage", "teamfight"], Khazix: ["pick", "assassin"], Kindred: ["tempo", "scaling"], Kled: ["engage", "snowball"], KogMaw: ["scaling", "front-to-back"], KSante: ["frontline", "side"],
  LeBlanc: ["pick", "poke"], LeeSin: ["early", "playmaker"], Leona: ["engage", "lane"], Lillia: ["tempo", "teamfight"], Lissandra: ["engage", "lockdown"], Lucian: ["lane", "tempo"], Lulu: ["peel", "scaling"], Lux: ["poke", "pick"], Malphite: ["engage", "teamfight"], Malzahar: ["lockdown", "pick"], Maokai: ["engage", "vision"], MasterYi: ["scaling", "reset"], Milio: ["peel", "scaling"], MissFortune: ["teamfight", "lane"], MonkeyKing: ["engage", "teamfight"], Mordekaiser: ["frontline", "side"], Morgana: ["pick", "control"], Nami: ["lane", "utility"], Nasus: ["scaling", "side"], Nautilus: ["engage", "pick"], Neeko: ["engage", "teamfight"], Nidalee: ["tempo", "poke"], Nilah: ["dive", "teamfight"], Nocturne: ["dive", "pick"], Nunu: ["objective", "gank"], Olaf: ["bruiser", "tempo"], Orianna: ["control", "teamfight"], Ornn: ["frontline", "scaling"], Pantheon: ["early", "pick"], Poppy: ["disengage", "frontline"], Pyke: ["pick", "roam"], Qiyana: ["assassin", "teamfight"], Quinn: ["side", "lane"], Rakan: ["engage", "roam"], Rammus: ["engage", "frontline"], RekSai: ["early", "dive"], Rell: ["engage", "teamfight"], Renata: ["disengage", "teamfight"], Renekton: ["lane", "early"], Rengar: ["assassin", "pick"], Riven: ["side", "snowball"], Rumble: ["teamfight", "lane"], Ryze: ["side", "scaling"], Samira: ["dive", "reset"], Sejuani: ["engage", "frontline"], Senna: ["scaling", "utility"], Seraphine: ["teamfight", "scaling"], Sett: ["frontline", "engage"], Shen: ["side", "cover"], Shyvana: ["farm", "teamfight"], Singed: ["side", "disrupt"], Sion: ["frontline", "engage"], Sivir: ["waveclear", "front-to-back"], Skarner: ["pick", "frontline"], Smolder: ["scaling", "front-to-back"], Sona: ["scaling", "teamfight"], Soraka: ["peel", "sustain"], Swain: ["teamfight", "frontline"], Sylas: ["skirmish", "pick"], Syndra: ["burst", "control"], TahmKench: ["peel", "frontline"], Taliyah: ["control", "roam"], Talon: ["roam", "assassin"], Taric: ["peel", "teamfight"], Teemo: ["side", "control"], Thresh: ["pick", "peel"], Tristana: ["lane", "siege"], Trundle: ["frontline", "objective"], Tryndamere: ["side", "scaling"], TwistedFate: ["roam", "pick"], Twitch: ["scaling", "flank"], Udyr: ["tempo", "frontline"], Urgot: ["bruiser", "frontline"], Varus: ["poke", "pick"], Vayne: ["scaling", "duel"], Veigar: ["scaling", "control"], Velkoz: ["poke", "control"], Vex: ["burst", "anti-dive"], Vi: ["dive", "lockdown"], Viego: ["reset", "skirmish"], Viktor: ["control", "scaling"], Vladimir: ["scaling", "teamfight"], Volibear: ["dive", "early"], Warwick: ["early", "skirmish"], Xayah: ["self-peel", "front-to-back"], Xerath: ["poke", "siege"], XinZhao: ["early", "dive"], Yasuo: ["skirmish", "teamfight"], Yone: ["side", "teamfight"], Yorick: ["side", "siege"], Yuumi: ["scaling", "attach"], Zac: ["engage", "teamfight"], Zed: ["assassin", "side"], Zeri: ["scaling", "teamfight"], Ziggs: ["poke", "siege"], Zilean: ["utility", "scaling"], Zoe: ["poke", "pick"], Zyra: ["poke", "control"],
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
  return Object.keys(CHAMPION_STYLE_TAGS).sort((a, b) => championDisplayName(a).localeCompare(championDisplayName(b)));
}

function compositionIdentity(picks) {
  const tagCounts = new Map();
  (picks || []).filter(Boolean).forEach((pick) => championStyleTags(pick.champion).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const primary = tags[0]?.[0] || "standard";
  const text = primary === "engage" ? "Chercher une ouverture claire et jouer autour du premier go." : primary === "scaling" || primary === "front-to-back" ? "Proteger les carries, temporiser et jouer les objectifs prepares." : primary === "poke" || primary === "siege" ? "Gagner l'espace avant objectif, gratter les HP puis forcer." : primary === "side" ? "Creer une pression side lane et punir les rotations adverses." : primary === "pick" ? "Jouer vision noire, isoler une cible et convertir en objectif." : "Importer plus de matchs pour stabiliser l'identite de draft.";
  return { primary, tags, text };
}

function championStyleTags(champion) {
  return CHAMPION_STYLE_TAGS[championAssetId(champion)] || ["standard"];
}

function championStyleTone(tag) {
  if (["engage", "dive", "early", "snowball", "assassin", "burst", "pick"].includes(tag)) return "red";
  if (["scaling", "front-to-back", "peel", "sustain", "utility", "control"].includes(tag)) return "cyan";
  if (["side", "duel", "split", "siege", "poke"].includes(tag)) return "yellow";
  if (["frontline", "teamfight", "objective", "tempo"].includes(tag)) return "green";
  return "slate";
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
  return id ? "https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/" + id + ".png" : "";
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

const ROSTER_ROLE_ORDER = ["TOP", "JGL", "MID", "ADC", "SUP"];

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
  return `https://www.op.gg/summoners/${String(region || "EUW").toLowerCase()}/${slug}`;
}

function multiOpggUrlFromRoster(roster, region) {
  const summoners = roster
    .map((player) => {
      const [name, tag] = String(player.riot_id || "").split("#").map((part) => part.trim());
      return name && tag ?`${name}-${tag}` : "";
    })
    .filter(Boolean);

  if (!summoners.length) return "";
  return `https://www.op.gg/multisearch/${String(region || "EUW").toLowerCase()}?summoners=${encodeURIComponent(summoners.join(","))}`;
}

function Teams({ data, refreshAll, selectedTeamId, setSelectedTeamId, currentMember, routeSearch = "", pushToast }) {
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", region: "EUW", multiOpgg: "" });
  const [playerForm, setPlayerForm] = useState({ name: "", riotId: "", opggUrl: "", role: "TOP" });
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingMostPlayed, setSyncingMostPlayed] = useState(false);
  const [teamSetupOpen, setTeamSetupOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [teamEdit, setTeamEdit] = useState({ name: "", tag: "", avatarDataUrl: "", avatarZoom: 1, avatarX: 50, avatarY: 50 });
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0];
  const roster = selectedTeam ?data.players.filter((player) => player.team_id === selectedTeam.id) : [];
  const teamMembers = selectedTeam ?(data.teamMembers || []).filter((member) => member.team_id === selectedTeam.id) : [];
  const multiPlayers = useMemo(() => parseMultiOpgg(teamForm.multiOpgg), [teamForm.multiOpgg]);
  const hasTeams = data.teams.length > 0;
  const canManageTeam = ["owner", "captain", "coach"].includes(String(currentMember?.role || "").toLowerCase());
  const canDeleteTeam = String(currentMember?.role || "").toLowerCase() === "captain";

  useEffect(() => {
    if (!selectedTeamId && data.teams[0]?.id) setSelectedTeamId(data.teams[0].id);
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite && !joinCode) setJoinCode(invite);
  }, [data.teams, selectedTeamId, setSelectedTeamId, joinCode]);

  useEffect(() => {
    const params = new URLSearchParams(routeSearch || window.location.search);
    if (params.get("create") === "1") setTeamSetupOpen(true);
    if (params.get("gestion") === "1") setManagementOpen(true);
  }, [routeSearch]);

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
      pushToast({ type: "green", title: "Team créée", text: importedCount ?`${importedCount} joueur${importedCount > 1 ?"s" : ""} importé${importedCount > 1 ?"s" : ""} depuis le multi OP.GG.` : "Tu peux maintenant ajouter le roster ou partager le lien d’invitation." });
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
      pushToast({ type: "green", title: "Joueur ajouté", text: "Roster mis à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!selectedTeam?.invite_code) return;
    const link = `${window.location.origin}/creer-un-compte?invite=${selectedTeam.invite_code}`;
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "Lien d’invitation créé", text: "Il est copié. Envoie-le à un joueur, coach ou membre du staff." });
  }

  async function copyMultiOpggLink() {
    if (!selectedTeam || !roster.length) return;
    const link = multiOpggUrlFromRoster(roster, selectedTeam.region);
    if (!link) {
      pushToast({ type: "red", title: "Multi OP.GG impossible", text: "Ajoute des Riot IDs au format Pseudo#TAG." });
      return;
    }
    await navigator.clipboard.writeText(link);
    pushToast({ type: "green", title: "Multi OP.GG copié", text: `${roster.length} joueur${roster.length > 1 ?"s" : ""} dans le lien.` });
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
      pushToast({ type: "yellow", title: "Image trop lourde", text: "Prends une image sous 900 Ko pour la stocker en DB." });
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
    if (!window.confirm(`Supprimer le profil Riot "${label || "sélectionné"}" du roster ?`)) return;
    setSaving(true);
    try {
      await apiFetch("players-delete", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id, playerId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Profil Riot supprimé", text: "Le roster de gestion est à jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function syncMostPlayed() {
    if (!selectedTeam) return;
    setSyncingMostPlayed(true);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await refreshAll();
      const ok = result.results?.filter((item) => item.ok && !item.skipped).length || 0;
      const skipped = result.results?.filter((item) => item.skipped).length || 0;
      const failed = result.results?.filter((item) => !item.ok).length || 0;
      const poolCount = result.results?.reduce((sum, item) => sum + Number(item.poolCount || 0), 0) || 0;
      pushToast({ type: failed ?"yellow" : "green", title: "Most played synchronis?s", text: `${ok} profil${ok > 1 ?"s" : ""} analys?${ok > 1 ?"s" : ""}${poolCount ?`, ${poolCount} champion${poolCount > 1 ?"s" : ""} ajout?${poolCount > 1 ?"s" : ""}` : ""}${failed ?`, ${failed} erreur${failed > 1 ?"s" : ""}` : ""}.` });
    } catch (err) {
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingMostPlayed(false);
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

  return <div><PageHeader eyebrow="Team manager" title={hasTeams ?"Gérer ton équipe" : "Créer ou rejoindre une team"} subtitle={hasTeams ?"La page affiche le roster, les invitations et les analyses de l’équipe active." : "Après la création du compte, tu peux lancer ta propre structure ou rejoindre celle de ton staff avec un lien d’invitation."}>{hasTeams && <Button variant="ghost" icon={teamSetupOpen ?X : Plus} onClick={() => setTeamSetupOpen((open) => !open)}>{teamSetupOpen ?"Masquer création" : "Nouvelle team"}</Button>}</PageHeader>
    {managementOpen && selectedTeam && <TeamManagementPanel team={selectedTeam} edit={teamEdit} setEdit={setTeamEdit} onAvatarFile={loadTeamAvatar} onSaveTeam={updateTeam} canManage={canManageTeam} canDeleteTeam={canDeleteTeam} members={teamMembers} roster={roster} saving={saving} onRoleChange={updateMemberRole} onLink={linkPlayerAccount} onRemoveMember={removeMember} onDeletePlayer={deletePlayer} onDeleteTeam={deleteTeam} />}
    <div className={cx("grid gap-5", hasTeams ?teamSetupOpen && "xl:grid-cols-[.78fr_1.22fr]" : selectedTeam && "xl:grid-cols-[.78fr_1.22fr]")}>
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
          <p className="mt-1 text-sm text-slate-500">Colle le lien partagé par ton coach, manager ou capitaine. Le code seul fonctionne aussi.</p>
          <form onSubmit={joinTeam} className="mt-5 space-y-4">
            <TextInput label="Lien ou code d’invitation" value={joinCode} onChange={setJoinCode} placeholder="https://riftboard.../creer-un-compte?invite=RIFT-XXXXXX" required icon={UserPlus} />
            <Button type="submit" disabled={saving || !joinCode.trim()} icon={saving ?Loader2 : ArrowRight} className="w-full">Rejoindre la team</Button>
          </form>
        </Surface>

      </div>

      {selectedTeam && <Surface glow>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h3 className="text-2xl font-black text-white">{selectedTeam.name}</h3><p className="mt-1 text-sm text-slate-500">Roster, lien d’invitation et joueurs liés à la structure.</p></div>
          <div className="flex flex-wrap gap-2"><Badge tone="purple">{selectedTeam.tag || "TEAM"}</Badge><Button variant="ghost" icon={syncingMostPlayed ?Loader2 : Crown} onClick={syncMostPlayed} disabled={syncingMostPlayed || !roster.length}>{syncingMostPlayed ? "Analyse en cours..." : "Analyser profils"}</Button><Button variant="ghost" icon={Clipboard} onClick={copyMultiOpggLink} disabled={!roster.length}>Copier Multi OP.GG</Button>{selectedTeam.invite_code && <Button variant="ghost" icon={UserPlus} onClick={copyInviteLink}>Cr?er un lien d?invitation</Button>}</div>
        </div>

        <>
          <form onSubmit={createPlayer} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <TextInput label="Nom" value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder="Nom du joueur" required />
            <TextInput label="Riot ID" value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder={playerForm.role === "COACH" ?"Optionnel pour coach" : "Pseudo#TAG"} required={playerForm.role !== "COACH"} />
            <TextInput label="OP.GG" value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder="https://op.gg/..." />
            <SelectInput label="Rôle" value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role })}><option>TOP</option><option>JGL</option><option>MID</option><option>ADC</option><option>SUP</option><option>SUB</option><option>COACH</option></SelectInput>
            <div className="flex items-end"><Button type="submit" disabled={saving} icon={saving ?Loader2 : UserPlus} className="w-full">Ajouter</Button></div>
          </form>
          <PremiumRosterTable roster={roster} championPool={(data.championPool || []).filter((row) => row.team_id === selectedTeam.id)} />
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

function TeamManagementPanel({ team, edit, setEdit, onAvatarFile, onSaveTeam, canManage, canDeleteTeam, members, roster, saving, onRoleChange, onLink, onRemoveMember, onDeletePlayer, onDeleteTeam }) {
  const linkedPlayerByUser = new Map(roster.filter((player) => player.user_id).map((player) => [player.user_id, player]));
  return (
    <Surface glow className="mb-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><Badge tone="cyan">Gestion</Badge><h3 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Gestion de la team</h3><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">Modifie l'identit?de l'équipe, les acces et les liaisons entre comptes RiftBoard et profils Riot.</p></div><Badge tone="cyan">{members.length} compte{members.length > 1 ?"s" : ""}</Badge></div>
      <form onSubmit={onSaveTeam} className="mt-8 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="mx-auto h-48 w-48 overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-black/30">{edit.avatarDataUrl ?<img src={edit.avatarDataUrl} alt={team.name} className="h-full w-full object-cover" style={{ transform: "scale(" + Number(edit.avatarZoom || 1) + ")", objectPosition: Number(edit.avatarX ?? 50) + "% " + Number(edit.avatarY ?? 50) + "%" }} /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-12 w-12 text-slate-600" /></div>}</div><label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-white/[0.07]"><Upload className="h-4 w-4" /> Choisir une image<input type="file" accept="image/*" className="hidden" onChange={(event) => onAvatarFile(event.target.files?.[0])} disabled={!canManage || saving} /></label><div className="mt-5 space-y-4"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Zoom</span><input type="range" min="1" max="2.5" step="0.05" value={edit.avatarZoom} onChange={(event) => setEdit({ ...edit, avatarZoom: event.target.value })} disabled={!canManage || saving} className="w-full" /></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Cadrage horizontal</span><input type="range" min="0" max="100" value={edit.avatarX} onChange={(event) => setEdit({ ...edit, avatarX: event.target.value })} disabled={!canManage || saving} className="w-full" /></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Cadrage vertical</span><input type="range" min="0" max="100" value={edit.avatarY} onChange={(event) => setEdit({ ...edit, avatarY: event.target.value })} disabled={!canManage || saving} className="w-full" /></label></div></div>
        <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><TextInput label="Nom de l'équipe" value={edit.name} onChange={(name) => setEdit({ ...edit, name })} placeholder="Nom" required icon={Trophy} /><TextInput label="Tag" value={edit.tag} onChange={(tag) => setEdit({ ...edit, tag })} placeholder="TAG" required icon={Shield} /></div><div className="flex flex-wrap gap-2"><Button type="submit" icon={saving ?Loader2 : Check} disabled={saving || !canManage}>Enregistrer</Button>{canDeleteTeam && <Button type="button" variant="danger" icon={saving ?Loader2 : Trash2} onClick={onDeleteTeam} disabled={saving}>Supprimer la team</Button>}</div>{!canManage && <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">Ton statut actuel ne permet pas de modifier la gestion.</p>}</div>
      </form>
      <div className="mt-10 space-y-8"><div><h4 className="mb-4 text-xl font-black text-white">Comptes dans la team</h4><div className="grid gap-4 xl:grid-cols-2">{members.map((member) => { const label = member.account_name || member.name; return <div key={member.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-2xl font-black text-white">{label}</p><Badge tone={profileStatusTone(member)}>{profileStatusLabel(member)}</Badge></div><p className="mt-2 text-sm font-semibold text-slate-500">Compte RiftBoard lie au profil</p></div><select value={String(member.role || "player").toLowerCase() === "captain" ?"captain" : String(member.role || "").toLowerCase() === "coach" ?"coach" : "player"} onChange={(event) => onRoleChange(member.user_id, event.target.value)} disabled={saving || !canManage} className="rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="player">Joueur</option><option value="coach">Coach</option><option value="captain">Capitaine</option></select></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/[0.18] p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Slot lie</p>{linkedPlayerByUser.get(member.user_id) ?<div className="mt-3"><LinkedPlayerSummary player={linkedPlayerByUser.get(member.user_id)} /></div> : <p className="mt-3 text-sm font-semibold text-slate-500">Aucun joueur ou coach lie pour l'instant.</p>}</div><div className="mt-4 flex justify-end"><Button type="button" variant="danger" icon={UserMinus} onClick={() => onRemoveMember(member.user_id, label)} disabled={saving || !canManage}>Renvoyer le profil</Button></div></div>; })}</div></div>
        <div><div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h4 className="text-xl font-black text-white">Comptes Riot disponibles</h4><p className="mt-1 text-sm font-semibold text-slate-500">Fais defiler, puis choisis le compte RiftBoard a lier au profil Riot ou coach.</p></div><Badge tone="purple">{roster.length} profil{roster.length > 1 ?"s" : ""}</Badge></div><div className="flex gap-4 overflow-x-auto pb-3">{roster.map((player) => <div key={player.id} className="w-[min(88vw,520px)] shrink-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex min-h-[360px] flex-col gap-4"><LinkedPlayerSummary player={player} /><select value={player.user_id || ""} onChange={(event) => onLink(player.id, event.target.value)} disabled={saving || !canManage} className="rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none md:min-w-[260px]"><option value="">Aucun compte lie</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.account_name || member.name}</option>)}</select><Button type="button" variant="danger" icon={Trash2} onClick={() => onDeletePlayer(player.id, player.name)} disabled={saving || !canManage}>Supprimer ce profil Riot</Button></div></div>)}</div></div></div>
    </Surface>
  );
}

function LinkedPlayerSummary({ player }) {
  const mostPlayed = parseMostPlayed(player.most_played).slice(0, 3);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={player.role === "COACH" ?"purple" : "blue"}>{player.role}</Badge><p className="text-2xl font-black text-white">{player.name}</p></div>
      <p className="mt-2 text-sm font-semibold text-slate-500">{player.riot_id || "Coach sans Riot ID"}</p>
      {player.role === "COACH" ?<p className="mt-5 rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-sm font-semibold text-slate-500">Pas de compte Riot requis pour ce slot coach.</p> : (
        <div className="mt-5 flex flex-wrap gap-3">
          {mostPlayed.length ?mostPlayed.map((champion, index) => <ChampionCircle key={String(champion.championId) + "-" + champion.champion} champion={champion} index={index} />) : <div className="w-full rounded-2xl border border-white/10 bg-black/[0.18] p-4 text-sm font-semibold text-slate-500">Most played non synchronisés. Lance "Analyser profils" pour remplir les champions.</div>}
        </div>
      )}
    </div>
  );
}

function ChampionCircle({ champion, index }) {
  const detail = champion.games ? `${champion.games} game${Number(champion.games) > 1 ? "s" : ""}` : `${formatPoints(champion.points)} pts`;
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-cyan-200/30 bg-black/35">{champion.imageUrl ?<img src={champion.imageUrl} alt={champion.champion} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-lg font-black text-cyan-100">{index + 1}</div>}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{champion.champion}</p><p className="mt-0.5 text-xs font-bold text-cyan-100">{detail}</p></div></div>;
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

function MostPlayedBadges({ value, fallback = [] }) {
  const mostPlayed = parseMostPlayed(value).slice(0, 3);
  const fallbackPlayed = fallback.slice(0, 3).map((row) => ({
    championId: row.raw?.championId || row.champion_id || null,
    champion: row.champion,
    imageUrl: championSquareUrl(row),
    points: row.games ? String(row.games) + " games" : row.impact_grade || "pool",
  }));
  const items = mostPlayed.length ? mostPlayed : fallbackPlayed;
  if (!items.length) return <span className="text-xs font-semibold text-slate-600">Non synchronis?</span>;
  return <div className="flex flex-wrap gap-2">{items.map((champion, index) => <ChampionCircle key={String(champion.championId || champion.champion) + "-" + index} champion={champion} index={index} />)}</div>;
}

function PremiumRosterTable({ roster, championPool = [] }) {
  if (!roster.length) return <div className="mt-6"><EmptyState icon={UserPlus} title="Aucun joueur" text="Ajoute tes joueurs. Leurs Riot IDs et liens OP.GG seront stockes en DB." /></div>;
  return <div className="mt-6 overflow-x-auto rounded-[1.35rem] border border-white/10"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.18em] text-slate-600"><tr><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Riot ID</th><th className="px-4 py-3">3 champions les plus joués</th><th className="px-4 py-3">Score</th></tr></thead><tbody className="divide-y divide-white/10">{roster.map((item) => <tr key={item.id} className="bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]"><td className="px-4 py-4"><Badge tone={item.role === "COACH" ?"purple" : "blue"}>{item.role}</Badge></td><td className="px-4 py-4 font-black text-white">{item.name}</td><td className="px-4 py-4 font-semibold text-slate-500">{item.riot_id || "Sans Riot ID"}</td><td className="px-4 py-4">{item.role === "COACH" ?<span className="text-xs font-semibold text-slate-600">Non requis</span> : <MostPlayedBadges value={item.most_played} fallback={championPool.filter((row) => row.player_id === item.id)} />}</td><td className="px-4 py-4"><Badge tone="purple">{item.performance_score ?formatPoints(item.performance_score) : "?"}</Badge></td></tr>)}</tbody></table></div>;
}

function MatchIdentityBadges({ rows }) {
  const ally = (rows || []).filter((row) => row.team_key === "ALLY");
  const enemy = (rows || []).filter((row) => row.team_key === "ENEMY");
  const allyIdentity = compositionIdentity(ally);
  const enemyIdentity = compositionIdentity(enemy);
  if (!ally.length && !enemy.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2"><Badge tone={championStyleTone(allyIdentity.primary)}>Nous: {allyIdentity.primary}</Badge>{enemy.length > 0 && <Badge tone={championStyleTone(enemyIdentity.primary)}>Eux: {enemyIdentity.primary}</Badge>}</div>;
}

function Matches({ data, refreshAll, selectedTeamId, pushToast }) {
  const [gameId, setGameId] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = data.matches.find((match) => match.id === selectedId) || data.matches[0];
  const rows = selected?.participants || [];
  async function importMatch(event) { event.preventDefault(); setImporting(true); try { await apiFetch("matches-import", { method: "POST", body: JSON.stringify({ gameId, teamId: selectedTeamId }) }); setGameId(""); await refreshAll(); pushToast({ type: "green", title: "Game importée", text: "Match, participants, champion pool et rapport sauvegardés." }); } catch (err) { pushToast({ type: "red", title: "Import impossible", text: err.message }); } finally { setImporting(false); } }

  return <div><PageHeader eyebrow="Analyse de match" title="Importer, lire, comprendre" subtitle="Colle un Game ID. Le backend récupère Riot, calcule, stocke, puis le front affiche les résultats persistés." /><Surface glow><form onSubmit={importMatch} className="grid gap-3 md:grid-cols-[1fr_auto]"><TextInput label="Game ID" value={gameId} onChange={setGameId} placeholder="EUW1_7123456789" required icon={Search} /><div className="flex items-end"><Button type="submit" icon={importing ?Loader2 : Search} disabled={importing || !selectedTeamId}>Analyser & sauvegarder</Button></div></form><p className="mt-3 text-xs font-semibold leading-5 text-slate-600">RiftBoard analyse la game, sauvegarde le résultat et prépare les tableaux pour la review.</p></Surface><div className="mt-5 grid gap-5 xl:grid-cols-[.76fr_1.24fr]"><Surface><h3 className="text-xl font-black text-white">Historique</h3><div className="mt-4 space-y-2">{data.matches.length ?data.matches.map((match) => <button key={match.id} onClick={() => setSelectedId(match.id)} className={cx("group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5", selected?.id === match.id ?"border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div className="flex flex-wrap items-center gap-2"><p className="font-black text-white">{match.opponent || match.game_id}</p><Badge tone={match.result === "Victoire" ?"green" : match.result === "Défaite" ?"red" : "slate"}>{match.result || "Analyse"}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"}</p><p className="mt-3 text-sm font-bold text-cyan-100">{match.primary_focus || "Analyse qui sert vraiment à calculer"}</p></button>) : <EmptyState icon={Swords} title="Aucune game" text="L’historique apparaîtra ici après sauvegarde en DB." />}</div></Surface><Surface glow>{selected ?<><div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h3 className="text-2xl font-black text-white">{selected.opponent || "Match analysé"}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{selected.game_id} · {selected.duration || "--:--"} · {selected.side || "Side ?"}</p></div><div className="flex flex-wrap gap-2"><Badge tone={selected.result === "Victoire" ?"green" : "red"}>{selected.result || "En DB"}</Badge><Badge tone={gradeTone(selected.impact_score)}>{selected.impact_score || "—"}</Badge></div></div><div className="mb-5 grid gap-3 md:grid-cols-3"><MetricCard icon={Goal} label="Objectifs" value={selected.objective_score} hint="Dragons / Barons / Tours" tone="green" /><MetricCard icon={Eye} label="Vision" value={selected.vision_score} hint="Différence équipe" tone="cyan" /><MetricCard icon={Activity} label="Impact" value={selected.impact_score} hint={selected.primary_focus} tone="purple" /></div><ReviewSignalPanel match={selected} rows={rows} /><ParticipantTable rows={rows} /></> : <EmptyState icon={Swords} title="Sélectionne ou importe une game" text="Les analyses de match sont affichées uniquement depuis les données persistées en base." />}</Surface></div></div>;
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
    [Goal, "Economie", (goldDiff >= 0 ? "+" : "") + formatPoints(goldDiff) + " gold equipe", goldDiff >= 0 ? "green" : "red"],
  ];
  if (!rows.length) return null;
  return <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_.72fr]"><div className="grid gap-3 md:grid-cols-3">{signals.map(([Icon, title, value, t]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">{title}</p><div className={cx("rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><p className="mt-3 text-sm font-black leading-6 text-white">{value}</p></div>)}</div><div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Identite de compo</p><Badge tone={championStyleTone(identity.primary)}>{identity.primary}</Badge></div><p className="mt-3 text-sm font-bold leading-6 text-white">{identity.text}</p><div className="mt-3 flex flex-wrap gap-2">{identity.tags.length ? identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tag} x{count}</Badge>) : <Badge tone="slate">standard</Badge>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{[["Damage lead", topDamage], ["Vision lead", topVision]].map(([label, row]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2"><div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-black/30">{row ? <img src={championIconUrl(row) || championLoadingUrl(row.champion)} alt={row.champion} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{row?.summoner_name || row?.riot_id || "A remplir"}</p><p className="truncate text-xs font-semibold text-slate-500">{label} ? {row ? championDisplayName(row.champion) : "Importe une game"}</p></div></div>)}</div></div></div>;
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
  return <div className="group relative min-h-[340px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-5"><img src={championSplashUrl(row.champion)} alt={row.champion} className="absolute inset-0 h-full w-full object-cover opacity-36 transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#050711] via-[#050711]/78 to-[#050711]/20" /><div className="relative z-10 flex h-full flex-col justify-between"><div><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/70">{row.player_name}</p><h3 className="mt-2 text-3xl font-black text-white">{championDisplayName(row.champion)}</h3></div><Badge tone={gradeTone(row.impact_grade)}>{row.impact_grade || "?"}</Badge></div><div className="mt-4 flex flex-wrap gap-2">{styleTags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tag}</Badge>)}</div><p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{row.verdict || "Donn?es insuffisantes"}</p></div><div className="mt-8 grid gap-3"><div className="grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-black/35 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">Games</p><p className="mt-1 text-xl font-black text-white">{row.games}</p></div><div className="rounded-2xl border border-white/10 bg-black/35 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">WR</p><p className="mt-1 text-xl font-black text-white">{row.winrate}%</p></div><div className="rounded-2xl border border-white/10 bg-black/35 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">KDA</p><p className="mt-1 text-xl font-black text-white">{Number(row.kda || 0).toFixed(1)}</p></div></div><StatBar value={winrate} max={100} tone={toneName} /><div className="flex flex-wrap gap-2"><Badge tone={toneName}>{row.wins || 0}W / {row.losses || 0}L</Badge><Badge tone="slate">{row.cs_per_min || "?"} CS/min</Badge></div></div></div></div>;
}

function championPoolStatus(row) {
  if (["manual", "riot_manual"].includes(String(row.source || "")) && ["lock", "pocket", "work", "danger"].includes(String(row.status || ""))) return row.status;
  const games = Number(row.games || 0);
  const winrate = Number(row.winrate || 0);
  if (games >= 3 && winrate >= 55) return "lock";
  if (games >= 3 && winrate <= 40) return "danger";
  if (games > 0 && games < 3) return "pocket";
  return "work";
}

function championPoolStatusLabel(status) {
  return status === "lock" ? "A lock" : status === "danger" ? "A travailler" : status === "pocket" ? "Pocket" : "A valider";
}

function ManualChampionPoolPanel({ players, rows, selectedTeamId, canManage, refreshAll, pushToast }) {
  const playablePlayers = players.filter((player) => player.team_id === selectedTeamId && player.role !== "COACH");
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
      pushToast({ type: "green", title: "Champion ajout?", text: "Le champion pool manuel est ? jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Ajout impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteManualPick(poolId) {
    if (!canManage || !window.confirm("Retirer ce pick manuel du champion pool ?")) return;
    setSaving(true);
    try {
      await apiFetch("champion-pool-manual", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, poolId }) });
      await refreshAll();
      pushToast({ type: "green", title: "Pick retir?", text: "Le champion pool manuel est ? jour." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return <Surface glow className="mb-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div><Badge tone="purple">configuration manuelle</Badge><h3 className="mt-4 text-2xl font-black text-white">Champion pool d?clar?</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Ajoute les champions que chaque joueur sait jouer, m?me sans game import?e. Ils apparaissent dans les filtres, la draft et l?identit? de compo.</p></div><Badge tone={canManage ? "green" : "yellow"}>{canManage ? "modifiable" : "lecture seule"}</Badge></div>{playablePlayers.length ? <form onSubmit={saveManualPick} className="mt-6 grid gap-3 xl:grid-cols-[1fr_1fr_.8fr_1fr_auto]"><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Joueur</span><select value={form.playerId} onChange={(event) => setForm({ ...form, playerId: event.target.value })} disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-black text-white outline-none">{playablePlayers.map((player) => <option key={player.id} value={player.id}>{player.role} ? {player.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Champion</span><input list="champion-options" value={form.champion} onChange={(event) => setForm({ ...form, champion: event.target.value })} placeholder="Kai'Sa, Orianna..." required disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-650" /><datalist id="champion-options">{championOptions().map((champion) => <option key={champion} value={championDisplayName(champion)} />)}</datalist></label><label className="block"><span className="mb-2 block text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-500">Statut</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={!canManage || saving} className="w-full rounded-2xl border border-white/10 bg-black/[0.22] px-4 py-3 text-sm font-black text-white outline-none"><option value="lock">A lock</option><option value="pocket">Pocket</option><option value="work">A valider</option><option value="danger">A travailler</option></select></label><TextInput label="Note" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} placeholder={selectedPlayer ? "Ex: blindable, counterpick..." : "Note staff"} icon={Clipboard} /><div className="flex items-end"><Button type="submit" disabled={!canManage || saving || !form.playerId || !form.champion.trim()} icon={saving ? Loader2 : Plus} className="w-full">Ajouter</Button></div></form> : <EmptyState icon={Users} title="Aucun joueur" text="Ajoute le roster avant de configurer le champion pool manuel." />}{manualRows.length > 0 && <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Picks manuels</p><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{manualRows.map((row) => <div key={row.id} className="w-[260px] shrink-0 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center gap-3"><img src={championSquareUrl(row)} alt={row.champion} className="h-12 w-12 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-xs font-semibold text-slate-500">{row.role || "ROLE"} ? {row.player_name}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone={row.status === "lock" ? "green" : row.status === "danger" ? "red" : row.status === "pocket" ? "yellow" : "slate"}>{championPoolStatusLabel(row.status)}</Badge>{championStyleTags(row.champion).slice(0, 2).map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tag}</Badge>)}</div>{row.notes && <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{row.notes}</p>}{canManage && <button type="button" onClick={() => deleteManualPick(row.id)} disabled={saving} className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-rose-200 hover:text-white">Retirer</button>}</div>)}</div></div>}</Surface>;
}

function ChampionPoolRecommendationPanel({ rows }) {
  const locks = rows.filter((row) => championPoolStatus(row) === "lock").slice(0, 3);
  const danger = rows.filter((row) => championPoolStatus(row) === "danger").slice(0, 3);
  const pockets = rows.filter((row) => championPoolStatus(row) === "pocket").slice(0, 3);
  const groups = [
    [Crown, "Picks a lock", locks, "green"],
    [AlertTriangle, "Picks a revoir", danger, "red"],
    [Flame, "Pocket picks", pockets, "yellow"],
  ];
  return <div className="mb-5 grid gap-3 xl:grid-cols-3">{groups.map(([Icon, title, items, t]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{title}</p><div className={cx("rounded-xl border p-2", tone(t))}><Icon className="h-4 w-4" /></div></div><div className="mt-3 space-y-2">{items.length ? items.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2"><img src={championSquareUrl(row)} alt={row.champion} className="h-9 w-9 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-white">{championDisplayName(row.champion)}</p><p className="truncate text-xs font-semibold text-slate-500">{row.player_name || "Roster"} ? {row.winrate || 0}% WR ? {row.games || 0} games</p></div></div>) : <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm font-semibold text-slate-500">Pas assez de donnees.</p>}</div></div>)}</div>;
}

function Champions({ data, selectedTeamId, refreshAll, pushToast, currentMember }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("impact");
  const roleByPlayer = new Map((data.players || []).map((player) => [String(player.name || "").toLowerCase(), player.role]));
  const activeTeamId = selectedTeamId || data.teams[0]?.id || null;
  const canManagePool = ["owner", "captain", "coach"].includes(String(currentMember?.role || "").toLowerCase());
  const rows = data.championPool.filter((row) => !activeTeamId || row.team_id === activeTeamId).map((row) => ({ ...row, role: row.role || roleByPlayer.get(String(row.player_name || "").toLowerCase()) || "UNK", status: championPoolStatus(row) }));
  const filtered = rows
    .filter((row) => (String(row.champion || "") + " " + String(row.player_name || "") + " " + String(row.verdict || "") + " " + String(row.role || "")).toLowerCase().includes(query.toLowerCase()))
    .filter((row) => roleFilter === "ALL" || row.role === roleFilter)
    .filter((row) => statusFilter === "ALL" || row.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === "winrate") return Number(b.winrate || 0) - Number(a.winrate || 0);
      if (sortBy === "games") return Number(b.games || 0) - Number(a.games || 0);
      if (sortBy === "kda") return Number(b.kda || 0) - Number(a.kda || 0);
      return (Number(b.winrate || 0) * 2 + Number(b.kda || 0) * 8 + Number(b.games || 0)) - (Number(a.winrate || 0) * 2 + Number(a.kda || 0) * 8 + Number(a.games || 0));
    });
  const reliable = rows.filter((row) => row.status === "lock").length;
  const risky = rows.filter((row) => row.status === "danger").length;
  const roles = ["ALL", "TOP", "JGL", "MID", "ADC", "SUP", "COACH"];
  const statuses = [["ALL", "Tous"], ["lock", "A lock"], ["pocket", "Pocket"], ["danger", "A travailler"], ["work", "A valider"]];
  return <div><PageHeader eyebrow="Champion intelligence" title="Champion pool concret" subtitle="Filtre par role, repere les locks, les pockets et les picks a sortir temporairement avant draft ou review." /><ManualChampionPoolPanel players={data.players} rows={rows} selectedTeamId={activeTeamId} canManage={canManagePool} refreshAll={refreshAll} pushToast={pushToast} /><Surface glow><ChampionPoolRecommendationPanel rows={rows} /><div className="mb-6 grid gap-3 xl:grid-cols-[1fr_auto_auto_auto]"><TextInput label="Filtrer" value={query} onChange={setQuery} placeholder="Champion, joueur, verdict..." icon={Search} /><div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Picks suivis</p><p className="mt-1 text-2xl font-black text-white">{filtered.length}</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/70">Locks</p><p className="mt-1 text-2xl font-black text-white">{reliable}</p></div><div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-rose-100/70">A revoir</p><p className="mt-1 text-2xl font-black text-white">{risky}</p></div></div><div className="mb-6 grid gap-3 xl:grid-cols-[1fr_1fr_auto]"><div className="flex flex-wrap gap-2">{roles.map((role) => <button key={role} onClick={() => setRoleFilter(role)} className={cx("rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", roleFilter === role ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-500 hover:text-white")}>{role === "ALL" ? "Tous roles" : role}</button>)}</div><div className="flex flex-wrap gap-2">{statuses.map(([id, label]) => <button key={id} onClick={() => setStatusFilter(id)} className={cx("rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition", statusFilter === id ? "border-violet-300/30 bg-violet-400/10 text-violet-100" : "border-white/10 bg-white/[0.04] text-slate-500 hover:text-white")}>{label}</button>)}</div><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-2xl border border-white/10 bg-black/[0.22] px-3 py-2 text-sm font-black text-white outline-none"><option value="impact">Impact</option><option value="winrate">Winrate</option><option value="games">Volume</option><option value="kda">KDA</option></select></div>{filtered.length ? <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{filtered.map((row) => <div key={row.id} className="relative"><ChampionPoolCard row={row} /><div className="absolute left-5 top-5 z-20 flex gap-2"><Badge tone={row.status === "lock" ? "green" : row.status === "danger" ? "red" : row.status === "pocket" ? "yellow" : "slate"}>{championPoolStatusLabel(row.status)}</Badge><Badge tone="blue">{row.role}</Badge></div></div>)}</div> : <EmptyState icon={Crown} title="Champion pool vide" text="Importe plusieurs games pour afficher les picks fiables, les picks risques et les champions a travailler." />}</Surface></div>;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace("#", "-");
}

function playerChampionRows(player, championPool) {
  return championPool.filter((row) => row.player_id === player.id || row.player_name === player.name).slice(0, 4);
}

function PlayerLearningCard({ player, championPool, matches }) {
  const picks = playerChampionRows(player, championPool);
  const linkedRows = matches.flatMap((match) => match.participants || []).filter((row) => row.player_id === player.id || normalizeText(row.riot_id) === normalizeText(player.riot_id));
  const recent = linkedRows.slice(-8);
  const avgDeaths = recent.length ?(recent.reduce((sum, row) => sum + Number(row.deaths || 0), 0) / recent.length).toFixed(1) : "?";
  const avgVision = recent.length ?Math.round(recent.reduce((sum, row) => sum + Number(row.vision || 0), 0) / recent.length) : "?";
  const bestPick = picks.slice().sort((a, b) => Number(b.winrate || 0) - Number(a.winrate || 0))[0];
  return <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-5"><ChampionBackdrop champion={bestPick?.champion} /><div className="relative z-10"><div className="flex items-start justify-between gap-3"><div><Badge tone={player.role === "COACH" ?"purple" : "blue"}>{player.role}</Badge><h3 className="mt-3 text-2xl font-black text-white">{player.name}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{player.riot_id || "Coach / staff"}</p></div><Badge tone={bestPick ?"green" : "slate"}>{bestPick ?"Profil actif" : "À remplir"}</Badge></div><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">Morts moy.</p><p className="mt-1 text-xl font-black text-white">{avgDeaths}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">Vision</p><p className="mt-1 text-xl font-black text-white">{avgVision}</p></div><div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-500">Picks</p><p className="mt-1 text-xl font-black text-white">{picks.length}</p></div></div><div className="mt-5 space-y-2">{picks.length ?picks.map((pick) => <div key={pick.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"><span className="min-w-0 truncate font-black text-white">{championDisplayName(pick.champion)}</span><span className="flex shrink-0 gap-2"><Badge tone={Number(pick.winrate || 0) >= 55 ?"green" : Number(pick.winrate || 0) <= 40 ?"red" : "yellow"}>{pick.winrate}% WR</Badge><Badge tone="slate">{pick.games} games</Badge></span></div>) : <p className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm font-semibold text-slate-400">Importe des games ou synchronise les profils pour construire sa fiche d’apprentissage.</p>}</div><div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Axe actuel</p><p className="mt-2 text-sm font-bold leading-6 text-white">{bestPick ?"Conserver " + championDisplayName(bestPick.champion) + " comme repere, puis travailler les decisions autour des objectifs neutres." : "Definir ses champions conforts et suivre ses erreurs recurrentes."}</p></div></div></div>;
}

function LearningRoadmap({ improvements }) {
  const steps = improvements.length ?improvements.slice(0, 4) : [
    { title: "Importer 3 a 5 games", proof: "Construire une base de lecture fiable.", action: "Ajouter des matchs de soloQ, scrim ou tournoi." },
    { title: "Identifier les erreurs repetees", proof: "Vision, morts isolées, objectifs contestes sans setup.", action: "Transformer chaque erreur en regle simple." },
    { title: "Valider le champion pool", proof: "Volume + winrate + KDA par joueur.", action: "Separer picks confort, picks tournoi et picks a retravailler." },
  ];
  return <div className="grid gap-4 lg:grid-cols-2">{steps.map((item, index) => <Surface key={item.id || item.title} glow delay={index * 0.04}><div className="flex items-center justify-between gap-3"><Badge tone={index === 0 ?"red" : index === 1 ?"yellow" : "cyan"}>Etape {index + 1}</Badge><div className={cx("rounded-2xl border p-3", tone(index === 0 ?"red" : index === 1 ?"yellow" : "cyan"))}>{index === 0 ?<Target className="h-5 w-5" /> : index === 1 ?<Eye className="h-5 w-5" /> : <Crown className="h-5 w-5" />}</div></div><h3 className="mt-5 text-2xl font-black text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{item.proof}</p><div className="mt-5 rounded-2xl border border-white/10 bg-black/[0.24] p-4 text-sm font-bold leading-6 text-white">{item.action}</div></Surface>)}</div>;
}

function Progression({ data }) {
  return <div><PageHeader eyebrow="Learning center" title="Apprendre game après game" subtitle="RiftBoard suit les axes individuels et collectifs pour progresser en soloQ, entraînement, scrim, tournoi et match officiel." /><div className="grid gap-5 xl:grid-cols-[1fr_.9fr]"><div><LearningRoadmap improvements={data.improvements} /></div><Surface glow><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-white">Signaux d’apprentissage</h3><p className="mt-1 text-sm font-semibold text-slate-500">Ce qui mérite une review avant le prochain match.</p></div><Badge tone="cyan">learn</Badge></div><div className="mt-5 space-y-3">{["Objectif perdu sans setup vision", "Mort isolée avant dragon ou Nashor", "Pick performant à garder en tournoi", "Pick faible à sortir temporairement", "Joueur à accompagner sur sa phase faible"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"><Check className="h-4 w-4 text-emerald-300" /><span className="text-sm font-bold text-slate-300">{item}</span></div>)}</div></Surface></div><div className="mt-6"><Surface glow><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Fiches joueurs</h3><p className="mt-1 text-sm font-semibold text-slate-500">Une lecture simple pour apprendre : picks, tendances, erreurs et axe actuel.</p></div><Badge tone="purple">{data.players.length} profils</Badge></div>{data.players.length ?<div className="grid gap-4 xl:grid-cols-2">{data.players.map((player) => <PlayerLearningCard key={player.id} player={player} championPool={data.championPool} matches={data.matches} />)}</div> : <EmptyState icon={Users} title="Aucun profil joueur" text="Ajoute le roster pour commencer à suivre les apprentissages individuels." />}</Surface></div></div>;
}

function DraftPickCard({ pick, label }) {
  const winrate = Number(pick?.winrate || 0);
  const toneName = winrate >= 55 ? "green" : winrate <= 40 ? "red" : "yellow";
  const styleTags = championStyleTags(pick?.champion).slice(0, 2);
  return <div className="group relative min-h-[250px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5"><ChampionBackdrop champion={pick?.champion} /><div className="relative z-10 flex min-h-[210px] flex-col justify-between"><div><div className="flex items-center justify-between gap-3"><Badge tone="cyan">{label}</Badge><Badge tone={gradeTone(pick?.impact_grade)}>{pick?.impact_grade || "?"}</Badge></div><h3 className="mt-5 text-3xl font-black text-white">{pick ? championDisplayName(pick.champion) : "A definir"}</h3><p className="mt-1 text-sm font-bold text-slate-300">{pick?.player_name || "Pas assez de donnees"}</p>{pick && <div className="mt-3 flex flex-wrap gap-2">{styleTags.map((tag) => <Badge key={tag} tone={championStyleTone(tag)}>{tag}</Badge>)}</div>}</div><div className="mt-6"><StatBar value={winrate} max={100} tone={toneName} /><div className="mt-3 flex flex-wrap gap-2"><Badge tone={toneName}>{pick?.winrate ?? "?"}% WR</Badge><Badge tone="slate">{pick?.games ?? 0} games</Badge><Badge tone="purple">{pick?.kda ? Number(pick.kda).toFixed(1) : "?"} KDA</Badge></div><p className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">{pick?.verdict || "Importe plus de matchs pour alimenter la preparation de draft."}</p></div></div></div>;
}

function DraftSlot({ pick, index, side = "blue" }) {
  const sideTone = side === "blue" ?"border-cyan-300/20 bg-cyan-400/10" : "border-rose-300/20 bg-rose-400/10";
  return <div className={cx("grid min-h-[84px] grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-2xl border p-3", sideTone)}><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm font-black text-white">{index + 1}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{pick ?championDisplayName(pick.champion) : "Open pick"}</p><p className="truncate text-xs font-semibold text-slate-500">{pick?.player_name || "A determiner"}</p></div><div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">{pick ?<img src={championIconUrl(pick) || championLoadingUrl(pick.champion)} alt={pick.champion} className="h-full w-full object-cover" /> : <Crown className="m-3 h-6 w-6 text-slate-600" />}</div></div>;
}

function DraftBoard({ comfort, risk }) {
  const blue = [comfort[0], comfort[2], comfort[4], comfort[6], comfort[8]];
  const red = [comfort[1], comfort[3], comfort[5], risk[0], risk[1]];
  return <Surface glow><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-2xl font-black text-white">Plan de draft</h3><p className="mt-1 text-sm font-semibold text-slate-500">Une maquette rapide pour discuter ordre de pick, securisation et reponses.</p></div><Badge tone="purple">best of prep</Badge></div><div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><Badge tone="cyan">Blue side</Badge><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">priorite confort</span></div><div className="space-y-2">{blue.map((pick, index) => <DraftSlot key={"blue-" + index} pick={pick} index={index} side="blue" />)}</div></div><div><div className="mb-3 flex items-center gap-2"><Badge tone="red">Red side</Badge><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">reponse et flex</span></div><div className="space-y-2">{red.map((pick, index) => <DraftSlot key={"red-" + index} pick={pick} index={index} side="red" />)}</div></div></div></Surface>;
}

function BanRecommendations({ risk, comfort }) {
  const bans = [...risk.slice(0, 3), ...comfort.filter((pick) => Number(pick.winrate || 0) < 50).slice(0, 2)].slice(0, 5);
  return <Surface><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Bans a preparer</h3><p className="mt-1 text-sm font-semibold text-slate-500">Les picks a retirer ou a tester en counterpick avant un match important.</p></div><Badge tone="red">ban list</Badge></div>{bans.length ?<div className="space-y-3">{bans.map((pick, index) => <div key={pick.id || index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"><div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src={championIconUrl(pick) || championLoadingUrl(pick.champion)} alt={pick.champion} className="h-full w-full object-cover" /></div><div className="min-w-0"><p className="truncate font-black text-white">{championDisplayName(pick.champion)}</p><p className="truncate text-xs font-semibold text-slate-500">{pick.player_name || "Roster"} ? {pick.games || 0} games</p></div><Badge tone={Number(pick.winrate || 0) <= 40 ?"red" : "yellow"}>{pick.winrate || 0}% WR</Badge></div>)}</div> : <EmptyState icon={Shield} title="Aucune ban prioritaire" text="Importe plus de matchs pour faire ressortir les picks a risque." />}</Surface>;
}

function RolePrepMatrix({ players, championPool }) {
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP", "COACH"];
  return <Surface glow><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Preparation par role</h3><p className="mt-1 text-sm font-semibold text-slate-500">Ce que chaque poste doit savoir avant d'entrer en lobby.</p></div><Badge tone="cyan">roster</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{roles.map((role) => { const player = players.find((item) => item.role === role); const picks = player ?playerChampionRows(player, championPool).slice(0, 3) : []; return <div key={role} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between gap-3"><Badge tone={role === "COACH" ?"purple" : "blue"}>{role}</Badge><span className="truncate text-sm font-black text-white">{player?.name || "Slot ouvert"}</span></div><div className="mt-4 flex gap-2">{picks.length ?picks.map((pick) => <div key={pick.id} className="h-12 w-12 overflow-hidden rounded-full border border-cyan-300/20 bg-black/30"><img src={championIconUrl(pick) || championLoadingUrl(pick.champion)} alt={pick.champion} className="h-full w-full object-cover" /></div>) : <p className="text-sm font-semibold leading-6 text-slate-500">Pas encore assez de donnees champion.</p>}</div><p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Focus</p><p className="mt-1 text-sm font-bold leading-6 text-slate-300">{role === "COACH" ?"Verifier draft, win condition et plan de review." : picks[0] ?"Securiser " + championDisplayName(picks[0].champion) + " ou preparer une reponse." : "Importer des games pour definir le plan."}</p></div>; })}</div></Surface>;
}

function TournamentChecklist({ latest }) {
  const items = [
    ["Win condition", latest?.primary_focus || "Definir le plan principal avant la game."],
    ["Objectif neutre", latest?.objectives_note || "Choisir dragon, Herald ou Nashor a prioriser."],
    ["Risque majeur", latest?.main_issue || "Noter le pattern qui coute le plus cher."],
    ["Communication", "Une call principale, une backup, pas dix priorites."],
  ];
  return <Surface><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Checklist match</h3><p className="mt-1 text-sm font-semibold text-slate-500">Le minimum a valider avant tournoi, scrim ou BO.</p></div><Badge tone={latest ?"green" : "yellow"}>{latest ?"base active" : "a remplir"}</Badge></div><div className="space-y-3">{items.map(([title, text]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-black text-white">{title}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p></div>)}</div></Surface>;
}

function CompositionIdentityPanel({ picks }) {
  const identity = compositionIdentity(picks);
  return <Surface><div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-black text-white">Identite de compo</h3><p className="mt-1 text-sm font-semibold text-slate-500">La tendance de draft selon les champions conforts actuels.</p></div><Badge tone={championStyleTone(identity.primary)}>{identity.primary}</Badge></div><p className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold leading-6 text-white">{identity.text}</p><div className="mt-4 flex flex-wrap gap-2">{identity.tags.length ? identity.tags.map(([tag, count]) => <Badge key={tag} tone={championStyleTone(tag)}>{tag} x{count}</Badge>) : <Badge tone="slate">Pas assez de picks</Badge>}</div></Surface>;
}

function Scouting({ data }) {
  const pool = data.championPool || [];
  const players = data.players || [];
  const comfort = pool.filter((row) => Number(row.games || 0) >= 3).sort((a, b) => Number(b.winrate || 0) - Number(a.winrate || 0));
  const risk = pool.filter((row) => Number(row.games || 0) >= 3).sort((a, b) => Number(a.winrate || 0) - Number(b.winrate || 0));
  const pocket = pool.filter((row) => Number(row.games || 0) < 3).slice(0, 4);
  const latest = data.matches[0];
  return <div><PageHeader eyebrow="Tournament prep" title="Tournoi, scouting & draft" subtitle="Prepare les matchs qui comptent : picks confort, bans a anticiper, poches a cacher, faiblesses a proteger et notes de tournoi." /><div className="grid gap-5 xl:grid-cols-3"><DraftPickCard pick={comfort[0]} label="Pick a lock" /><DraftPickCard pick={comfort[1]} label="Deuxieme confort" /><DraftPickCard pick={risk[0]} label="Pick a surveiller" /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><DraftBoard comfort={comfort} risk={risk} /><BanRecommendations risk={risk} comfort={comfort} /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.82fr_.82fr]"> <RolePrepMatrix players={players} championPool={pool} /><CompositionIdentityPanel picks={comfort.slice(0, 5)} /><TournamentChecklist latest={latest} /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.82fr]"><Surface glow><div className="mb-5 flex items-center justify-between"><div><h3 className="text-2xl font-black text-white">Pocket picks & options</h3><p className="mt-1 text-sm font-semibold text-slate-500">Les picks peu joues ne sont pas forcement mauvais : certains sont des armes de tournoi.</p></div><Badge tone="cyan">options</Badge></div>{pocket.length ?<div className="grid gap-3 md:grid-cols-2">{pocket.map((pick) => <DraftPickCard key={pick.id} pick={pick} label="Pocket" />)}</div> : <EmptyState icon={Crown} title="Aucun pocket pick detecte" text="Ajoute du volume ou importe des matchs pour reperer les options cachees." />}</Surface><Surface><div className="mb-5 flex items-center justify-between"><div><h3 className="text-2xl font-black text-white">Dernier match lu</h3><p className="mt-1 text-sm font-semibold text-slate-500">Le dernier signal competitif disponible pour nourrir la prep.</p></div><Badge tone={latest?.result === "Victoire" ?"green" : latest ?"red" : "slate"}>{latest?.result || "A importer"}</Badge></div>{latest ?<div><MatchChampionStrip rows={latest.participants || []} /><div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-sm font-black text-white">{latest.primary_focus || "Focus a definir"}</p><p className="mt-2 text-sm leading-6 text-slate-400">{latest.main_issue || "Importe plus de games pour stabiliser les signaux."}</p></div></div> : <EmptyState icon={Swords} title="Aucun match importe" text="Importe une game pour demarrer la preparation tournoi." />}</Surface></div></div>;
}

function Reports({ data, pushToast }) {
  const latest = data.reports[0];
  async function copyReport() { if (!latest?.content) return; await navigator.clipboard.writeText(latest.content); pushToast({ type: "green", title: "Rapport copié", text: "Tu peux le coller directement sur Discord." }); }
  return <div><PageHeader eyebrow="Discord output" title="Rapports staff prêts à copier" subtitle="Chaque rapport est généré côté serveur et stocké en base. Le bouton ne fait que copier le contenu affiché." /><Surface glow>{latest ?<><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-2xl font-black text-white">{latest.title}</h3><p className="mt-1 text-sm text-slate-500">Généré côté serveur et stocké dans la base de données.</p></div><Button icon={Clipboard} onClick={copyReport}>Copier Discord</Button></div><pre className="max-h-[560px] overflow-auto rounded-[1.35rem] border border-white/10 bg-black/[0.30] p-5 text-sm leading-7 text-slate-100 shadow-inner shadow-black/40">{latest.content}</pre></> : <EmptyState icon={FileText} title="Aucun rapport" text="Les rapports seront sauvegardés en DB après l’import/analyse d’une game." />}</Surface></div>;
}

function SettingsPage() {
  const schema = ["users", "sessions", "teams", "players", "matches", "match_participants", "champion_pool", "improvements", "reports", "audit_logs"];
  const [riotStatus, setRiotStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiFetch("riot-status")
      .then((status) => { if (mounted) setRiotStatus(status); })
      .catch((err) => { if (mounted) setRiotStatus({ configured: false, error: err.message }); });
    return () => { mounted = false; };
  }, []);
  return <div><PageHeader eyebrow="Architecture" title="Règles techniques non négociables" subtitle="Cette page sert de garde-fou : RiftBoard reste DB-first, propre et déployable sur Netlify + Neon." /><div className="grid gap-5 xl:grid-cols-2"><Surface glow><h3 className="text-xl font-black text-white">Tables Neon</h3><div className="mt-4 grid gap-2 sm:grid-cols-2">{schema.map((table) => <div key={table} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-slate-300">{table}</div>)}</div></Surface><Surface><h3 className="text-xl font-black text-white">Principes</h3><div className="mt-4 space-y-3 text-sm leading-6 text-slate-400"><p><span className="font-black text-white">Aucun localStorage.</span> Pas de roster, match, rapport ou compte dans le navigateur.</p><p><span className="font-black text-white">Cookies HttpOnly.</span> Sessions créées par Netlify Functions et validées côté serveur.</p><p><span className="font-black text-white">Riot API serveur.</span> La clé Riot reste dans les variables Netlify.</p><p><span className="font-black text-white">Neon source of truth.</span> Le front ne fait qu’afficher et déclencher des actions.</p></div></Surface><Surface glow><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h3 className="text-xl font-black text-white">Connexion Riot API</h3><p className="mt-2 text-sm leading-6 text-slate-400">La clé reste côté Netlify Functions. Le navigateur reçoit uniquement le statut de configuration.</p></div><Badge tone={riotStatus?.configured ?"green" : riotStatus ?"red" : "yellow"} pulse>{riotStatus?.configured ?"Connectée" : riotStatus ?"À configurer" : "Vérification"}</Badge></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{["Account-V1", "Match-V5", "Champion-Mastery-V4", "Data Dragon"].map((service) => <div key={service} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-slate-300">{service}</div>)}</div>{riotStatus?.error && <p className="mt-4 text-sm font-semibold leading-6 text-rose-200">{riotStatus.error}</p>}</Surface></div></div>;
}

function MainApp({ user, onLogout, pushToast, navigate, route }) {
  const initialPage = new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path);
  const [active, setActiveState] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(false);
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
    navigate("/equipes?gestion=1");
  }

  async function refreshAll() {
    setLoading(true); setApiError("");
    try { const result = await apiFetch("bootstrap"); setData({ ...DEFAULT_DATA, ...result }); if (!selectedTeamId && result.teams?.[0]?.id) setSelectedTeamId(result.teams[0].id); }
    catch (err) { setApiError(err.message || "Impossible de charger les données."); setData(DEFAULT_DATA); }
    finally { setLoading(false); }
  }
  async function logout() { try { await apiFetch("auth-logout", { method: "POST" }); } catch {} pushToast({ type: "cyan", title: "Déconnecté", text: "Session serveur fermée." }); navigate("/connexion", { replace: true }); onLogout(); }
  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { setActiveState(new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path)); }, [route.path, route.search]);

  const currentTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null;
  const currentMember = currentTeam ?(data.teamMembers || []).find((member) => member.team_id === currentTeam.id && member.user_id === user.id) : null;

  const page = useMemo(() => {
    if (active === "dashboard") return <Dashboard data={data} loading={loading} setActive={setActive} />;
    if (active === "teams") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} />;
    if (active === "matches") return <Matches data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} pushToast={pushToast} />;
    if (active === "champions") return <Champions data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} />;
    if (active === "progression") return <Progression data={data} />;
    if (active === "scouting") return <Scouting data={data} />;
    if (active === "reports") return <Reports data={data} pushToast={pushToast} />;
    return <SettingsPage />;
  }, [active, data, loading, selectedTeamId, currentMember, route.search, pushToast]);

  return <div className="relative min-h-screen text-white"><AmbientBackground /><Sidebar active={active} setActive={setActive} open={sidebarOpen} setOpen={setSidebarOpen} user={user} currentMember={currentMember} onLogout={logout} /><div className="relative z-10 lg:pl-76"><Topbar active={active} setOpen={setSidebarOpen} currentTeam={currentTeam} teams={data.teams} onSelectTeam={setSelectedTeamId} onCreateTeam={openTeamCreation} onManageTeam={openTeamManagement} /><main className="mx-auto max-w-7xl px-4 py-7 lg:px-8"><ApiBanner error={apiError} /><AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>{page}</motion.div></AnimatePresence></main></div></div>;
}

export default function RiftBoard() {
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
      "/": "RiftBoard",
      "/connexion": "Connexion — RiftBoard",
      "/creer-un-compte": "Créer un compte — RiftBoard",
      "/inscription": "Créer un compte — RiftBoard",
    };
    document.title = publicTitles[route.path] || (navTitle ?`${navTitle} — RiftBoard` : "RiftBoard");
  }, [route.path]);

  useEffect(() => {
    if (!checkingSession && user && (route.path === "/" || authModeFromPath(route.path))) {
      navigate("/dashboard", { replace: true });
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

  if (checkingSession) return <div className="relative flex min-h-screen items-center justify-center text-white"><AmbientBackground /><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex items-center gap-3 rounded-3xl border border-white/10 bg-[#090d1a]/82 px-6 py-5 shadow-2xl backdrop-blur-2xl"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /><span className="text-sm font-black text-slate-200">Vérification de session serveur…</span></motion.div></div>;

  const inviteMode = new URLSearchParams(route.search).has("invite") ?"register" : null;
  const mode = authModeFromPath(route.path) || inviteMode;
  const routeIsPrivate = isAppPath(route.path);
  const unknownRoute = !isKnownPath(route.path);
  const view = unknownRoute
    ?<NotFoundPage navigate={navigate} />
    : user
      ?<MainApp user={user} onLogout={() => setUser(null)} pushToast={pushToast} navigate={navigate} route={route} />
      : mode
        ?<AuthPage mode={mode} onAuth={setUser} pushToast={pushToast} navigate={navigate} />
        : routeIsPrivate
          ?<AuthPage mode="login" onAuth={setUser} pushToast={pushToast} navigate={navigate} />
          : <HomeScreen navigate={navigate} />;

  return <>{view}<ToastStack toasts={toasts} removeToast={removeToast} /></>;
}
