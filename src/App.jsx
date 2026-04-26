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
  Database,
  Eye,
  FileText,
  Flame,
  Gauge,
  Goal,
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
  Trophy,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";

const API_BASE = "/.netlify/functions";

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, shortcut: "D", path: "/dashboard" },
  { id: "teams", label: "Équipes", icon: Users, shortcut: "T", path: "/equipes" },
  { id: "matches", label: "Analyse de match", icon: Swords, shortcut: "M", path: "/analyse-de-match" },
  { id: "champions", label: "Champion pool", icon: Crown, shortcut: "C", path: "/champion-pool" },
  { id: "progression", label: "Progression", icon: Target, shortcut: "P", path: "/progression" },
  { id: "reports", label: "Rapports", icon: FileText, shortcut: "R", path: "/rapports" },
  { id: "settings", label: "Paramètres", icon: Settings, shortcut: "S", path: "/parametres" },
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
      ? "Service temporairement indisponible. Réessaie après configuration de la base de données."
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
  return grade === "S" ? "green" : grade === "A" ? "cyan" : grade === "B" ? "purple" : grade === "C" ? "yellow" : grade === "D" ? "red" : "slate";
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
              <div className="mt-0.5 rounded-2xl bg-white/10 p-2">{toast.type === "red" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-black">{toast.title}</p>{toast.text && <p className="mt-1 text-sm leading-5 opacity-80">{toast.text}</p>}</div>
              <button onClick={() => removeToast(toast.id)} className="rounded-xl p-1.5 opacity-70 hover:bg-white/10 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon: Icon = Database, title, text, action }) {
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
        <div className="min-w-0"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 truncate text-3xl font-black text-white md:text-4xl">{value ?? "—"}</p><p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{hint ?? "En attente de données"}</p></div>
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
        src={compact ? "/riftboard-rb-mark.svg" : "/riftboard-rb-logo.svg"}
        alt="RiftBoard"
        className={cx(
          "object-contain drop-shadow-[0_0_22px_rgba(34,211,238,.30)]",
          compact ? "h-12 w-12" : "h-14 w-auto max-w-[245px]"
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
    <motion.div initial={{ opacity: 0, x: 28, rotateY: -9 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 0.75, delay: 0.1 }} className="relative hidden xl:block">
      <div className="absolute -inset-6 rounded-[2.6rem] bg-gradient-to-r from-cyan-400/20 via-violet-500/10 to-fuchsia-500/25 blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#07101f]/92 p-5 shadow-2xl shadow-violet-950/45 backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_5%,rgba(139,92,246,.22),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(34,211,238,.16),transparent_34%)]" />
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
          <BrandLogo compact />
          <p className="text-sm font-black text-white">Aperçu du tableau de bord</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-400">Données à importer</div>
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
              {axes.map((a) => <div key={a} className="flex items-center justify-between rounded-2xl bg-black/[0.18] px-3 py-2"><span className="text-sm font-bold text-slate-300">{a}</span><Badge tone="slate">À calculer</Badge></div>)}
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
            <p className="absolute right-4 top-4 text-sm font-black text-cyan-200/70">Données réelles uniquement</p>
            <svg viewBox="0 0 320 120" className="mt-5 h-28 w-full"><defs><linearGradient id="line" x1="0" x2="1"><stop stopColor="#22d3ee"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs><path d="M0 90 C35 35 55 86 92 55 S145 46 176 38 S235 68 260 42 S292 58 320 25" fill="none" stroke="url(#line)" strokeWidth="6" strokeLinecap="round" opacity=".34"/><path d="M0 90 C35 35 55 86 92 55 S145 46 176 38 S235 68 260 42 S292 58 320 25 L320 120 L0 120Z" fill="url(#line)" opacity=".08"/></svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatStrip() {
  const stats = [
    [Shield, "Données réelles", "Aucun chiffre inventé", "green"],
    [Users, "Teams & invitations", "Création ou lien d’accès", "cyan"],
    [Swords, "Imports de games", "Analyse après ajout", "purple"],
    [Clipboard, "Rapports staff", "Copie Discord prête", "blue"],
    [Database, "Stockage serveur", "Rien de sensible en local", "cyan"],
  ];
  return (
    <div className="grid gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 md:grid-cols-5">
      {stats.map(([Icon, value, label, t]) => <div key={value} className="flex items-center gap-3 border-white/10 p-3 md:not-last:border-r"><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div><div><p className="text-sm font-black text-white">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div></div>)}
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
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
      <a href="/" onClick={goHome} aria-label="Accueil RiftBoard" className="transition hover:opacity-90"><BrandLogo /></a>
      {children && <div className="flex items-center gap-3">{children}</div>}
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
        <LinkButton href="/creer-un-compte" navigate={navigate}>Créer un compte</LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-16">
        <section className="grid min-h-[690px] items-center gap-10 py-10 xl:grid-cols-[.86fr_1.14fr]">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
            <Badge tone="cyan" pulse>La plateforme d’analyse pour équipes compétitives</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.055em] md:text-7xl xl:text-7xl">
              Moins de <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">feeling.</span> Plus de <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">décisions claires</span> après chaque game.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">RiftBoard centralise tes games, ton roster et tes reviews pour aider ta team à savoir quoi travailler avant le prochain scrim.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/creer-un-compte" navigate={navigate} icon={ChevronRight} className="px-7 py-4">Créer un compte</LinkButton>
              <Button variant="ghost" icon={Search} onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })} className="px-7 py-4">Voir l’aperçu</Button>
            </div>
          </motion.div>
          <MarketingPreview />
        </section>

        <section id="features" className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Users, title: "Invite ta team en un lien", text: "Crée une structure, partage un lien d’invitation et centralise ton staff en quelques secondes.", t: "cyan" },
            { icon: Wand2, title: "Analyse qui sert vraiment", text: "Transforme une game importée en constats clairs : forces, erreurs récurrentes et focus de review.", t: "purple" },
            { icon: Crown, title: "Champion pool intelligent", text: "Repère tes champions forts, ceux qui te coûtent des games et ceux qui méritent du travail.", t: "cyan" },
          ].map((item, i) => { const Icon = item.icon; return <Surface key={item.title} delay={i * .06} glow><div className={cx("mb-5 inline-flex rounded-2xl border p-4", tone(item.t))}><Icon className="h-7 w-7" /></div><h3 className="text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{item.text}</p></Surface>; })}
        </section>

        <section id="analytics" className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 md:p-9">
          <div className="mb-8 text-center"><h2 className="text-3xl font-black text-white md:text-4xl">Démarre en moins de 2 minutes</h2><p className="mt-3 text-sm font-semibold text-slate-500">Nom de compte, team, invitation : le flow est pensé pour aller vite avant un scrim.</p></div>
          <div className="grid gap-5 md:grid-cols-3">
            {[["1", Users, "Crée ton compte", "Nom de compte unique, mot de passe, et c’est tout."], ["2", Trophy, "Crée une team", "Ajoute ton staff, tes joueurs et organise ton espace."], ["3", Clipboard, "ou rejoins-la avec un lien", "Rejoins ta team en un clic et commencez l’analyse."]].map(([n, Icon, title, text]) => <div key={n} className="relative rounded-3xl border border-white/10 bg-black/[0.18] p-6"><Badge tone="purple">{n}</Badge><div className="mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-100"><Icon className="h-7 w-7" /></div><h3 className="mt-5 text-xl font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>)}
          </div>
          <div className="mt-8 flex justify-center"><LinkButton href="/creer-un-compte" navigate={navigate} icon={ArrowRight} className="px-7 py-4">Commencer maintenant</LinkButton></div>
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
      const endpoint = isRegister ? "auth-register" : "auth-login";
      const body = { accountName: form.accountName, password: form.password };
      const result = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      pushToast({ type: "green", title: isRegister ? "Compte créé" : "Connexion réussie", text: "Bienvenue sur RiftBoard." });
      const params = new URLSearchParams(window.location.search);
      const hasInvite = params.has("invite");
      const next = params.get("next");
      const destination = hasInvite
        ? `/equipes?invite=${encodeURIComponent(params.get("invite"))}`
        : isSafeInternalPath(next)
          ? next
          : "/dashboard";
      navigate(destination, { replace: true });
      onAuth(result.user);
    } catch (err) {
      if (err?.code === "DB_NOT_CONFIGURED") {
        setError("La création de compte n’est pas encore active : la base de données du site doit être reliée dans Netlify.");
      } else {
        setError(err.message || (isRegister ? "Inscription impossible." : "Connexion impossible."));
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
        <LinkButton href={isRegister ? `/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`} navigate={navigate} variant="ghost" className="hidden md:inline-flex">
          {isRegister ? "J’ai déjà un compte" : "Créer un compte"}
        </LinkButton>
      </SiteHeader>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-108px)] max-w-7xl items-center gap-8 px-5 pb-16 lg:grid-cols-[.85fr_1.15fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
          <Badge tone={isRegister ? "purple" : "cyan"} pulse>{isRegister ? "Création de compte" : "Connexion"}</Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] md:text-7xl">
            {isRegister ? "Crée ton espace RiftBoard." : "Retourne dans ton espace RiftBoard."}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 md:text-lg">
            {isRegister
              ? "Crée ton compte avec un nom unique, puis choisis directement : créer une équipe ou rejoindre une team avec un lien d’invitation."
              : "Connecte-toi pour retrouver tes teams, tes imports, tes rapports et tes paramètres sauvegardés côté serveur."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[[Database, "DB-first"], [Shield, "Session serveur"], [Users, "Teams" ]].map(([Icon, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon className="h-5 w-5 text-cyan-200" /><p className="mt-3 text-sm font-black text-white">{label}</p></div>)}
          </div>
        </motion.div>

        <Surface glow className="mx-auto w-full max-w-xl">
          <h2 className="text-3xl font-black text-white">{isRegister ? "Créer un compte" : "Connexion"}</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">{isRegister ? "Une fois connecté, tu choisis : créer une team ou rejoindre une invitation." : "Entre ton nom de compte et ton mot de passe pour accéder au tableau de bord."}</p>
          <div className="mt-5 flex rounded-2xl border border-white/10 bg-black/[0.18] p-1">
            <a href={`/connexion${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", !isRegister ? "bg-white/10 text-white" : "text-slate-500 hover:text-white")}>Connexion</a>
            <a href={`/creer-un-compte${querySuffix}`} className={cx("flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition", isRegister ? "bg-white/10 text-white" : "text-slate-500 hover:text-white")}>Créer un compte</a>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <TextInput label="Nom de compte" value={form.accountName} onChange={(v) => patch("accountName", v)} placeholder="Ex : Ashaii" required icon={Users} />
            <TextInput label="Mot de passe" value={form.password} onChange={(v) => patch("password", v)} placeholder="••••••••" type="password" required icon={Lock} />
            {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
            <Button type="submit" disabled={loading} icon={loading ? Loader2 : isRegister ? UserPlus : Lock} className="w-full py-4">{loading ? "Chargement…" : isRegister ? "Créer le compte" : "Entrer dans RiftBoard"}</Button>
          </form>
          <p className="mt-4 text-center text-sm font-semibold text-slate-600">
            {isRegister ? "Déjà inscrit ? " : "Pas encore de compte ? "}
            <a className="font-black text-cyan-200 hover:text-white" href={isRegister ? `/connexion${querySuffix}` : `/creer-un-compte${querySuffix}`}>{isRegister ? "Connexion" : "Créer un compte"}</a>
          </p>
        </Surface>
      </main>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, user, onLogout }) {
  return (
    <>
      <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden" />}</AnimatePresence>
      <aside className={cx("fixed left-0 top-0 z-40 flex h-screen w-76 flex-col border-r border-white/10 bg-[#070b16]/88 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-3"><img src="/riftboard-rb-mark.svg" alt="RiftBoard" className="h-11 w-11 object-contain" /><div><p className="text-lg font-black tracking-tight">RiftBoard</p><p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-600">Performance OS</p></div></div><button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button></div>
        <nav className="space-y-1.5">{NAV.map((item) => { const Icon = item.icon; const selected = active === item.id; return <button key={item.id} onClick={() => { setActive(item.id); setOpen(false); }} className={cx("group flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left text-sm font-black transition duration-200", selected ? "bg-gradient-to-r from-violet-500/30 via-fuchsia-500/12 to-cyan-400/12 text-white shadow-lg shadow-violet-950/20" : "text-slate-500 hover:bg-white/[0.055] hover:text-white")}><span className="flex items-center gap-3"><Icon className={cx("h-5 w-5 transition", selected ? "text-cyan-200" : "text-slate-600 group-hover:text-cyan-200")} />{item.label}</span><span className={cx("rounded-lg border px-2 py-0.5 text-[0.65rem]", selected ? "border-cyan-300/25 text-cyan-100" : "border-white/8 text-slate-700")}>{item.shortcut}</span></button>; })}</nav>
        <div className="mt-auto space-y-3"><Surface className="rounded-3xl p-4" delay={0}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-200"><Users className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{user?.account_name || user?.name || "Coach"}</p><p className="truncate text-xs font-semibold text-slate-600">Nom de compte</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone="green" pulse>Online</Badge><Badge tone="purple">Staff access</Badge></div></Surface><Button variant="ghost" icon={LogOut} onClick={onLogout} className="w-full justify-start">Déconnexion</Button></div>
      </aside>
    </>
  );
}

function Topbar({ active, setOpen, refreshAll, loading }) {
  const nav = NAV.find((item) => item.id === active) || NAV[0];
  return <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050711]/72 px-4 py-4 text-white backdrop-blur-2xl lg:px-8"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-2 lg:hidden"><Menu className="h-5 w-5" /></button><img src="/riftboard-rb-mark.svg" alt="RiftBoard" className="hidden h-12 w-12 object-contain drop-shadow-[0_0_18px_rgba(34,211,238,.35)] md:block" /><div><p className="text-[0.68rem] font-black uppercase tracking-[0.26em] text-cyan-200/70">RiftBoard</p><h1 className="text-xl font-black tracking-tight md:text-2xl">{nav.label}</h1></div></div><div className="flex items-center gap-2"><Button variant="ghost" icon={loading ? Loader2 : RefreshCw} onClick={refreshAll} disabled={loading}>Sync DB</Button><Badge tone="green" pulse>Synced</Badge></div></div></header>;
}

function ApiBanner({ error }) {
  if (!error) return null;
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-3xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100 shadow-xl shadow-amber-950/10"><div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-200/10 p-2"><AlertTriangle className="h-5 w-5" /></div><div><p className="font-black">Endpoint/API non disponible</p><p className="mt-1 text-sm leading-6 text-amber-100/75">{error}</p></div></div></motion.div>;
}

function Dashboard({ data, loading, setActive }) {
  const d = data.dashboard || {};
  const bestChampion = data.championPool[0];
  const worstChampion = [...data.championPool].reverse()[0];
  const latestMatch = data.matches[0];
  const priority = data.improvements[0];

  return <div><PageHeader eyebrow="Performance surface" title="Vue globale de ta structure" subtitle="Retrouve en un coup d’œil la forme de ton équipe, les priorités de review et les signaux à travailler avant le prochain scrim."><Button variant="ghost" icon={Swords} onClick={() => setActive("matches")}>Importer une game</Button><Button icon={Target} onClick={() => setActive("progression")}>Voir les priorités</Button></PageHeader><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard delay={0} icon={Trophy} label="Winrate récent" value={d.recentWinrate} hint={d.winrateTrend} tone="green" /><MetricCard delay={0.04} icon={Gauge} label="Score d’impact" value={d.impactScore} hint={d.impactTrend} tone="purple" /><MetricCard delay={0.08} icon={Eye} label="Vision diff" value={d.visionDiff} hint={d.visionTrend} tone="cyan" /><MetricCard delay={0.12} icon={AlertTriangle} label="Risque midgame" value={d.midgameRisk} hint={d.riskTrend} tone="red" /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Surface glow><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-white">Cockpit de diagnostic</h3><p className="mt-1 text-sm font-medium text-slate-500">La prochaine action claire avant review.</p></div><Badge tone="purple">live synthesis</Badge></div>{loading ? <SkeletonRows count={3} /> : priority || latestMatch ? <div className="grid gap-4 lg:grid-cols-2"><div className="relative overflow-hidden rounded-[1.35rem] border border-rose-300/18 bg-gradient-to-br from-rose-500/12 to-black/20 p-5"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rose-400/10 blur-2xl" /><Badge tone="red">Priorité #{priority?.rank || 1}</Badge><h4 className="mt-4 text-2xl font-black text-white">{priority?.title || latestMatch?.primary_focus || "Axe de review"}</h4><p className="mt-3 text-sm leading-6 text-slate-300">{priority?.proof || latestMatch?.main_issue || "Importe plus de games pour stabiliser le diagnostic."}</p><div className="mt-4 rounded-2xl border border-white/10 bg-black/[0.20] p-4 text-sm font-bold leading-6 text-white">{priority?.action || "Relire les 90 secondes avant chaque objectif neutre."}</div></div><div className="space-y-3"><ChampionMiniCard title="Pick le plus fiable" item={bestChampion} icon={Crown} tone="green" /><ChampionMiniCard title="Pick à surveiller" item={worstChampion} icon={AlertTriangle} tone="yellow" /></div></div> : <EmptyState icon={BarChart3} title="Dashboard en attente" text="Crée une team ou rejoins-la depuis un lien d’invitation, ajoute les joueurs du roster, puis importe une game. RiftBoard affichera ensuite les diagnostics de ton équipe." action={<Button icon={Users} onClick={() => setActive("teams")}>Créer ou rejoindre une team</Button>} />}</Surface><Surface><div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-black text-white">Dernières games</h3><p className="mt-1 text-sm text-slate-500">Historique DB avec focus de review.</p></div><Badge tone="blue">matches</Badge></div>{loading ? <SkeletonRows /> : data.matches.length ? <div className="space-y-3">{data.matches.slice(0, 5).map((match) => <button key={match.id} onClick={() => setActive("matches")} className="group w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.06]"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-white">{match.opponent || match.game_id}</p><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"} · {match.side || "Side ?"}</p></div><ChevronRight className="h-5 w-5 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" /></div><p className="mt-3 text-sm font-bold text-cyan-100">{match.primary_focus || "Analyse qui sert vraiment à calculer"}</p></button>)}</div> : <EmptyState icon={Swords} title="Aucune game importée" text="Colle un Game ID dans l’analyse de match. Les données seront sauvegardées en base." />}</Surface></div></div>;
}

function ChampionMiniCard({ title, item, icon: Icon, tone: t }) {
  return <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">{title}</p><p className="mt-2 text-xl font-black text-white">{item?.champion || "—"}</p><p className="mt-1 text-sm font-semibold text-slate-500">{item?.player_name || "Données insuffisantes"}</p></div><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div></div><div className="mt-4 flex flex-wrap gap-2"><Badge tone="slate">{item?.games ?? 0} games</Badge><Badge tone={Number(item?.winrate || 0) >= 55 ? "green" : "yellow"}>{item?.winrate ?? "—"}% WR</Badge><Badge tone={gradeTone(item?.impact_grade)}>{item?.impact_grade || "—"}</Badge></div></div>;
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

function Teams({ data, refreshAll, selectedTeamId, setSelectedTeamId, pushToast }) {
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", region: "EUW", multiOpgg: "" });
  const [playerForm, setPlayerForm] = useState({ name: "", riotId: "", opggUrl: "", role: "TOP" });
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingMostPlayed, setSyncingMostPlayed] = useState(false);
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0];
  const roster = selectedTeam ? data.players.filter((player) => player.team_id === selectedTeam.id) : [];
  const multiPlayers = useMemo(() => parseMultiOpgg(teamForm.multiOpgg), [teamForm.multiOpgg]);

  useEffect(() => {
    if (!selectedTeamId && data.teams[0]?.id) setSelectedTeamId(data.teams[0].id);
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite && !joinCode) setJoinCode(invite);
  }, [data.teams, selectedTeamId, setSelectedTeamId, joinCode]);

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
      await refreshAll();
      pushToast({ type: "green", title: "Team créée", text: importedCount ? `${importedCount} joueur${importedCount > 1 ? "s" : ""} importé${importedCount > 1 ? "s" : ""} depuis le multi OP.GG.` : "Tu peux maintenant ajouter le roster ou partager le lien d’invitation." });
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
    pushToast({ type: "green", title: "Lien copié", text: "Envoie-le à un joueur, coach ou membre du staff." });
  }

  async function syncMostPlayed() {
    if (!selectedTeam) return;
    setSyncingMostPlayed(true);
    try {
      const result = await apiFetch("players-sync-most-played", { method: "POST", body: JSON.stringify({ teamId: selectedTeam.id }) });
      await refreshAll();
      const ok = result.results?.filter((item) => item.ok).length || 0;
      const failed = result.results?.filter((item) => !item.ok).length || 0;
      pushToast({ type: failed ? "yellow" : "green", title: "Most played synchronisés", text: `${ok} profil${ok > 1 ? "s" : ""} analysé${ok > 1 ? "s" : ""}${failed ? `, ${failed} erreur${failed > 1 ? "s" : ""}` : ""}.` });
    } catch (err) {
      pushToast({ type: "red", title: "Analyse impossible", text: err.message });
    } finally {
      setSyncingMostPlayed(false);
    }
  }

  return <div><PageHeader eyebrow="Team manager" title="Créer ou rejoindre une team" subtitle="Après la création du compte, tu peux lancer ta propre structure ou rejoindre celle de ton staff avec un lien d’invitation." />
    <div className={cx("grid gap-5", selectedTeam && "xl:grid-cols-[.78fr_1.22fr]")}>
      <div className="space-y-5">
        <Surface glow>
          <h3 className="text-xl font-black text-white">Créer une team</h3>
          <p className="mt-1 text-sm text-slate-500">Pour lancer une nouvelle structure, créer son roster et importer ses games.</p>
          <form onSubmit={createTeam} className="mt-5 space-y-4">
            <TextInput label="Nom de team" value={teamForm.name} onChange={(name) => setTeamForm({ ...teamForm, name })} placeholder="Nom de l'équipe" required icon={Trophy} />
            <TextInput label="Tag" value={teamForm.tag} onChange={(tag) => setTeamForm({ ...teamForm, tag })} placeholder="TAG" required icon={Shield} />
            <SelectInput label="Région" value={teamForm.region} onChange={(region) => setTeamForm({ ...teamForm, region })}><option>EUW</option><option>EUNE</option><option>NA</option><option>KR</option></SelectInput>
            <TextAreaInput label="Multi OP.GG ou Riot IDs" value={teamForm.multiOpgg} onChange={(multiOpgg) => setTeamForm({ ...teamForm, multiOpgg })} placeholder={"Colle un lien multi OP.GG ou une liste :\nToplaner#EUW\nJungler#EUW\nMidlaner#EUW\nADC#EUW\nSupport#EUW"} icon={Clipboard} />
            {multiPlayers.length > 0 && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{multiPlayers.length} joueur{multiPlayers.length > 1 ? "s" : ""} détecté{multiPlayers.length > 1 ? "s" : ""}</p><div className="mt-2 flex flex-wrap gap-2">{multiPlayers.map((player, index) => <Badge key={player.riotId} tone={index < 5 ? "cyan" : "slate"}>{ROSTER_ROLE_ORDER[index] || "SUB"} · {player.riotId}</Badge>)}</div></div>}
            <Button type="submit" disabled={saving} icon={saving ? Loader2 : Plus} className="w-full">Créer la team</Button>
          </form>
        </Surface>

        <Surface glow>
          <h3 className="text-xl font-black text-white">Rejoindre une team</h3>
          <p className="mt-1 text-sm text-slate-500">Colle le lien partagé par ton coach, manager ou capitaine. Le code seul fonctionne aussi.</p>
          <form onSubmit={joinTeam} className="mt-5 space-y-4">
            <TextInput label="Lien ou code d’invitation" value={joinCode} onChange={setJoinCode} placeholder="https://riftboard.../creer-un-compte?invite=RIFT-XXXXXX" required icon={UserPlus} />
            <Button type="submit" disabled={saving || !joinCode.trim()} icon={saving ? Loader2 : ArrowRight} className="w-full">Rejoindre la team</Button>
          </form>
        </Surface>

        {data.teams.length > 0 && <Surface>
          <h3 className="text-xl font-black text-white">Mes teams</h3>
          <div className="mt-4 space-y-2">{data.teams.map((team) => <button key={team.id} onClick={() => setSelectedTeamId(team.id)} className={cx("group flex w-full items-center justify-between rounded-2xl border p-4 text-left transition", selectedTeam?.id === team.id ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div><p className="font-black text-white">{team.name}</p><p className="mt-1 text-xs font-semibold text-slate-600">{team.tag || "NO TAG"} · {team.region || "EUW"}</p></div><ChevronRight className="h-5 w-5 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" /></button>)}</div>
        </Surface>}
      </div>

      {selectedTeam && <Surface glow>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h3 className="text-2xl font-black text-white">{selectedTeam.name}</h3><p className="mt-1 text-sm text-slate-500">Roster, lien d’invitation et joueurs liés à la structure.</p></div>
          <div className="flex flex-wrap gap-2"><Badge tone="purple">{selectedTeam.tag || "TEAM"}</Badge><Button variant="ghost" icon={syncingMostPlayed ? Loader2 : Crown} onClick={syncMostPlayed} disabled={syncingMostPlayed || !roster.length}>Analyser profils</Button>{selectedTeam.invite_code && <Button variant="ghost" icon={Clipboard} onClick={copyInviteLink}>Copier le lien</Button>}</div>
        </div>

        <>
          <form onSubmit={createPlayer} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <TextInput label="Nom" value={playerForm.name} onChange={(name) => setPlayerForm({ ...playerForm, name })} placeholder="Nom du joueur" required />
            <TextInput label="Riot ID" value={playerForm.riotId} onChange={(riotId) => setPlayerForm({ ...playerForm, riotId })} placeholder="Pseudo#TAG" required />
            <TextInput label="OP.GG" value={playerForm.opggUrl} onChange={(opggUrl) => setPlayerForm({ ...playerForm, opggUrl })} placeholder="https://op.gg/..." />
            <SelectInput label="Rôle" value={playerForm.role} onChange={(role) => setPlayerForm({ ...playerForm, role })}><option>TOP</option><option>JGL</option><option>MID</option><option>ADC</option><option>SUP</option><option>SUB</option></SelectInput>
            <div className="flex items-end"><Button type="submit" disabled={saving} icon={saving ? Loader2 : UserPlus} className="w-full">Ajouter</Button></div>
          </form>
          <PremiumRosterTable roster={roster} />
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

function parseMostPlayed(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function MostPlayedBadges({ value }) {
  const mostPlayed = parseMostPlayed(value).slice(0, 3);
  if (!mostPlayed.length) return <span className="text-xs font-semibold text-slate-600">Non synchronisé</span>;
  return <div className="flex flex-wrap gap-1.5">{mostPlayed.map((champion) => <span key={`${champion.championId}-${champion.champion}`} className="rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-2.5 py-1 text-xs font-black text-cyan-100">{champion.champion} · {formatPoints(champion.points)}</span>)}</div>;
}

function PremiumRosterTable({ roster }) {
  if (!roster.length) return <div className="mt-6"><EmptyState icon={UserPlus} title="Aucun joueur" text="Ajoute tes joueurs. Leurs Riot IDs et liens OP.GG seront stockés en DB." /></div>;
  return <div className="mt-6 overflow-x-auto rounded-[1.35rem] border border-white/10"><table className="w-full min-w-[980px] text-left text-sm"><thead className="sticky top-0 bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.18em] text-slate-600"><tr><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Riot ID</th><th className="px-4 py-3">Most played</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Statut</th></tr></thead><tbody className="divide-y divide-white/10">{roster.map((item) => <tr key={item.id} className="bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]"><td className="px-4 py-4"><Badge tone="blue">{item.role}</Badge></td><td className="px-4 py-4 font-black text-white">{item.name}</td><td className="px-4 py-4 font-semibold text-slate-500">{item.riot_id}</td><td className="px-4 py-4"><MostPlayedBadges value={item.most_played} /></td><td className="px-4 py-4"><Badge tone="purple">{item.performance_score ? formatPoints(item.performance_score) : "—"}</Badge></td><td className="px-4 py-4 text-slate-500">{item.status || "Non analysé"}</td></tr>)}</tbody></table></div>;
}

function Matches({ data, refreshAll, selectedTeamId, pushToast }) {
  const [gameId, setGameId] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = data.matches.find((match) => match.id === selectedId) || data.matches[0];
  const rows = selected?.participants || [];
  async function importMatch(event) { event.preventDefault(); setImporting(true); try { await apiFetch("matches-import", { method: "POST", body: JSON.stringify({ gameId, teamId: selectedTeamId }) }); setGameId(""); await refreshAll(); pushToast({ type: "green", title: "Game importée", text: "Match, participants, champion pool et rapport sauvegardés." }); } catch (err) { pushToast({ type: "red", title: "Import impossible", text: err.message }); } finally { setImporting(false); } }

  return <div><PageHeader eyebrow="Analyse de match" title="Importer, lire, comprendre" subtitle="Colle un Game ID. Le backend récupère Riot, calcule, stocke, puis le front affiche les résultats persistés." /><Surface glow><form onSubmit={importMatch} className="grid gap-3 md:grid-cols-[1fr_auto]"><TextInput label="Game ID" value={gameId} onChange={setGameId} placeholder="EUW1_7123456789" required icon={Search} /><div className="flex items-end"><Button type="submit" icon={importing ? Loader2 : Search} disabled={importing || !selectedTeamId}>Analyser & sauvegarder</Button></div></form><p className="mt-3 text-xs font-semibold leading-5 text-slate-600">RiftBoard analyse la game, sauvegarde le résultat et prépare les tableaux pour la review.</p></Surface><div className="mt-5 grid gap-5 xl:grid-cols-[.76fr_1.24fr]"><Surface><h3 className="text-xl font-black text-white">Historique</h3><div className="mt-4 space-y-2">{data.matches.length ? data.matches.map((match) => <button key={match.id} onClick={() => setSelectedId(match.id)} className={cx("group w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5", selected?.id === match.id ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]")}><div className="flex flex-wrap items-center gap-2"><p className="font-black text-white">{match.opponent || match.game_id}</p><Badge tone={match.result === "Victoire" ? "green" : match.result === "Défaite" ? "red" : "slate"}>{match.result || "Analyse"}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-600">{match.game_id} · {match.duration || "--:--"}</p><p className="mt-3 text-sm font-bold text-cyan-100">{match.primary_focus || "Analyse qui sert vraiment à calculer"}</p></button>) : <EmptyState icon={Swords} title="Aucune game" text="L’historique apparaîtra ici après sauvegarde en DB." />}</div></Surface><Surface glow>{selected ? <><div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h3 className="text-2xl font-black text-white">{selected.opponent || "Match analysé"}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{selected.game_id} · {selected.duration || "--:--"} · {selected.side || "Side ?"}</p></div><div className="flex flex-wrap gap-2"><Badge tone={selected.result === "Victoire" ? "green" : "red"}>{selected.result || "En DB"}</Badge><Badge tone={gradeTone(selected.impact_score)}>{selected.impact_score || "—"}</Badge></div></div><div className="mb-5 grid gap-3 md:grid-cols-3"><MetricCard icon={Goal} label="Objectifs" value={selected.objective_score} hint="Dragons / Barons / Tours" tone="green" /><MetricCard icon={Eye} label="Vision" value={selected.vision_score} hint="Différence équipe" tone="cyan" /><MetricCard icon={Activity} label="Impact" value={selected.impact_score} hint={selected.primary_focus} tone="purple" /></div><ParticipantTable rows={rows} /></> : <EmptyState icon={Swords} title="Sélectionne ou importe une game" text="Les analyses de match sont affichées uniquement depuis les données persistées en base." />}</Surface></div></div>;
}

function ParticipantTable({ rows }) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const filtered = rows.filter((row) => { const text = `${row.summoner_name || ""} ${row.champion || ""} ${row.role || ""}`.toLowerCase(); return text.includes(query.toLowerCase()) && (teamFilter === "ALL" || row.team_key === teamFilter); });
  if (!rows.length) return <EmptyState icon={BarChart3} title="Participants non calculés" text="La table match_participants doit être remplie par la fonction d’import." />;
  return <div><div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="w-full md:max-w-sm"><TextInput label="Rechercher" value={query} onChange={setQuery} placeholder="Champion, joueur, rôle…" icon={Search} /></div><div className="flex gap-2">{[["ALL", "Tous"], ["ALLY", "Nous"], ["ENEMY", "Eux"]].map(([id, label]) => <button key={id} onClick={() => setTeamFilter(id)} className={cx("rounded-2xl border px-4 py-2 text-sm font-black transition", teamFilter === id ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.07]")}>{label}</button>)}</div></div><div className="overflow-x-auto rounded-[1.35rem] border border-white/10"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.16em] text-slate-600"><tr><th className="px-4 py-3">Team</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Champion</th><th className="px-4 py-3">KDA</th><th className="px-4 py-3">CS/min</th><th className="px-4 py-3">Gold/min</th><th className="px-4 py-3">Dégâts</th><th className="px-4 py-3">Vision</th><th className="px-4 py-3">KP%</th><th className="px-4 py-3">Grade</th></tr></thead><tbody className="divide-y divide-white/10">{filtered.map((row) => <tr key={row.id} className="bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]"><td className="px-4 py-4"><Badge tone={row.team_key === "ALLY" ? "green" : "red"}>{row.team_key}</Badge></td><td className="px-4 py-4"><Badge tone="blue">{row.role || "—"}</Badge></td><td className="px-4 py-4 font-semibold text-slate-200">{row.summoner_name || row.riot_id || "—"}</td><td className="px-4 py-4 font-black text-white">{row.champion}</td><td className="px-4 py-4">{row.kda}</td><td className="px-4 py-4">{row.cs_per_min}</td><td className="px-4 py-4">{row.gold_per_min}</td><td className="px-4 py-4">{row.damage}</td><td className="px-4 py-4">{row.vision}</td><td className="px-4 py-4">{row.kill_participation}</td><td className="px-4 py-4"><Badge tone={gradeTone(row.grade)}>{row.grade || "—"}</Badge></td></tr>)}</tbody></table></div></div>;
}

function Champions({ data }) {
  const [query, setQuery] = useState("");
  const filtered = data.championPool.filter((row) => `${row.champion} ${row.player_name} ${row.verdict}`.toLowerCase().includes(query.toLowerCase()));
  return <div><PageHeader eyebrow="Champion intelligence" title="Meilleurs, pires et picks pièges" subtitle="RiftBoard ne classe pas seulement au winrate : volume, impact, stabilité et verdict serveur entrent en jeu." /><Surface glow><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div className="w-full md:max-w-sm"><TextInput label="Filtrer" value={query} onChange={setQuery} placeholder="Champion, joueur, verdict…" icon={Search} /></div><Badge tone="blue">champion_pool</Badge></div>{filtered.length ? <div className="overflow-x-auto rounded-[1.35rem] border border-white/10"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/[0.055] text-[0.68rem] uppercase tracking-[0.16em] text-slate-600"><tr><th className="px-4 py-3">Champion</th><th className="px-4 py-3">Joueur</th><th className="px-4 py-3">Games</th><th className="px-4 py-3">WR</th><th className="px-4 py-3">KDA</th><th className="px-4 py-3">CS/min</th><th className="px-4 py-3">Impact</th><th className="px-4 py-3">Verdict</th></tr></thead><tbody className="divide-y divide-white/10">{filtered.map((row) => <tr key={row.id} className="bg-black/[0.12] text-slate-300 transition hover:bg-white/[0.04]"><td className="px-4 py-4 font-black text-white">{row.champion}</td><td className="px-4 py-4">{row.player_name}</td><td className="px-4 py-4">{row.games}</td><td className="px-4 py-4"><Badge tone={Number(row.winrate) >= 55 ? "green" : Number(row.winrate) <= 40 ? "red" : "yellow"}>{row.winrate}%</Badge></td><td className="px-4 py-4">{row.kda}</td><td className="px-4 py-4">{row.cs_per_min}</td><td className="px-4 py-4"><Badge tone={gradeTone(row.impact_grade)}>{row.impact_grade}</Badge></td><td className="px-4 py-4 font-semibold text-slate-400">{row.verdict}</td></tr>)}</tbody></table></div> : <EmptyState icon={Crown} title="Champion pool vide" text="Après plusieurs imports, les picks fiables, picks risqués et picks à entraîner apparaîtront ici." />}</Surface></div>;
}

function Progression({ data }) {
  return <div><PageHeader eyebrow="Improvement center" title="Savoir quoi améliorer" subtitle="La page la plus importante : elle transforme l’historique de matchs en priorités concrètes de scrim/review." /><div className="grid gap-5 xl:grid-cols-3">{data.improvements.length ? data.improvements.map((item, index) => { const Icon = index === 0 ? Goal : index === 1 ? Flame : Sparkles; const t = index === 0 ? "red" : index === 1 ? "yellow" : "cyan"; return <Surface key={item.id} glow delay={index * 0.04}><div className="flex items-center justify-between"><Badge tone={t}>Priorité #{item.rank || index + 1}</Badge><div className={cx("rounded-2xl border p-3", tone(t))}><Icon className="h-5 w-5" /></div></div><h3 className="mt-5 text-2xl font-black text-white">{item.title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{item.proof}</p><div className="mt-5 rounded-2xl border border-white/10 bg-black/[0.24] p-4 text-sm font-bold leading-6 text-white">{item.action}</div></Surface>; }) : <div className="xl:col-span-3"><EmptyState icon={Target} title="Aucune priorité calculée" text="Le centre de progression se remplit depuis la base de données après analyse de plusieurs matchs." /></div>}</div></div>;
}

function Reports({ data, pushToast }) {
  const latest = data.reports[0];
  async function copyReport() { if (!latest?.content) return; await navigator.clipboard.writeText(latest.content); pushToast({ type: "green", title: "Rapport copié", text: "Tu peux le coller directement sur Discord." }); }
  return <div><PageHeader eyebrow="Discord output" title="Rapports staff prêts à copier" subtitle="Chaque rapport est généré côté serveur et stocké en base. Le bouton ne fait que copier le contenu affiché." /><Surface glow>{latest ? <><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-2xl font-black text-white">{latest.title}</h3><p className="mt-1 text-sm text-slate-500">Généré côté serveur et stocké dans la base de données.</p></div><Button icon={Clipboard} onClick={copyReport}>Copier Discord</Button></div><pre className="max-h-[560px] overflow-auto rounded-[1.35rem] border border-white/10 bg-black/[0.30] p-5 text-sm leading-7 text-slate-100 shadow-inner shadow-black/40">{latest.content}</pre></> : <EmptyState icon={FileText} title="Aucun rapport" text="Les rapports seront sauvegardés en DB après l’import/analyse d’une game." />}</Surface></div>;
}

function SettingsPage() {
  const schema = ["users", "sessions", "teams", "players", "matches", "match_participants", "champion_pool", "improvements", "reports", "audit_logs"];
  return <div><PageHeader eyebrow="Architecture" title="Règles techniques non négociables" subtitle="Cette page sert de garde-fou : RiftBoard reste DB-first, propre et déployable sur Netlify + Neon." /><div className="grid gap-5 xl:grid-cols-2"><Surface glow><h3 className="text-xl font-black text-white">Tables Neon</h3><div className="mt-4 grid gap-2 sm:grid-cols-2">{schema.map((table) => <div key={table} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-slate-300">{table}</div>)}</div></Surface><Surface><h3 className="text-xl font-black text-white">Principes</h3><div className="mt-4 space-y-3 text-sm leading-6 text-slate-400"><p><span className="font-black text-white">Aucun localStorage.</span> Pas de roster, match, rapport ou compte dans le navigateur.</p><p><span className="font-black text-white">Cookies HttpOnly.</span> Sessions créées par Netlify Functions et validées côté serveur.</p><p><span className="font-black text-white">Riot API serveur.</span> La clé Riot reste dans les variables Netlify.</p><p><span className="font-black text-white">Neon source of truth.</span> Le front ne fait qu’afficher et déclencher des actions.</p></div></Surface></div></div>;
}

function MainApp({ user, onLogout, pushToast, navigate, route }) {
  const initialPage = new URLSearchParams(route.search).get("invite") ? "teams" : pageFromPath(route.path);
  const [active, setActiveState] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(DEFAULT_DATA);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  function setActive(pageId) {
    setActiveState(pageId);
    const keepInvite = pageId === "teams" && new URLSearchParams(window.location.search).has("invite");
    navigate(`${pathFromPage(pageId)}${keepInvite ? window.location.search : ""}`);
  }

  async function refreshAll() {
    setLoading(true); setApiError("");
    try { const result = await apiFetch("bootstrap"); setData({ ...DEFAULT_DATA, ...result }); if (!selectedTeamId && result.teams?.[0]?.id) setSelectedTeamId(result.teams[0].id); }
    catch (err) { setApiError(err.message || "Impossible de charger les données."); setData(DEFAULT_DATA); }
    finally { setLoading(false); }
  }
  async function logout() { try { await apiFetch("auth-logout", { method: "POST" }); } catch {} pushToast({ type: "cyan", title: "Déconnecté", text: "Session serveur fermée." }); navigate("/connexion", { replace: true }); onLogout(); }
  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { setActiveState(new URLSearchParams(route.search).get("invite") ? "teams" : pageFromPath(route.path)); }, [route.path, route.search]);

  const page = useMemo(() => {
    if (active === "dashboard") return <Dashboard data={data} loading={loading} setActive={setActive} />;
    if (active === "teams") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} pushToast={pushToast} />;
    if (active === "matches") return <Matches data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} pushToast={pushToast} />;
    if (active === "champions") return <Champions data={data} />;
    if (active === "progression") return <Progression data={data} />;
    if (active === "reports") return <Reports data={data} pushToast={pushToast} />;
    return <SettingsPage />;
  }, [active, data, loading, selectedTeamId]);

  return <div className="relative min-h-screen text-white"><AmbientBackground /><Sidebar active={active} setActive={setActive} open={sidebarOpen} setOpen={setSidebarOpen} user={user} onLogout={logout} /><div className="relative z-10 lg:pl-76"><Topbar active={active} setOpen={setSidebarOpen} refreshAll={refreshAll} loading={loading} /><main className="mx-auto max-w-7xl px-4 py-7 lg:px-8"><ApiBanner error={apiError} /><AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>{page}</motion.div></AnimatePresence></main></div></div>;
}

export default function RiftBoard() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [route, setRoute] = useState(readRoute);

  function navigate(path, options = {}) {
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method]({}, "", path);
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pushToast(toast) {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
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
    document.title = publicTitles[route.path] || (navTitle ? `${navTitle} — RiftBoard` : "RiftBoard");
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

  const inviteMode = new URLSearchParams(route.search).has("invite") ? "register" : null;
  const mode = authModeFromPath(route.path) || inviteMode;
  const routeIsPrivate = isAppPath(route.path);
  const unknownRoute = !isKnownPath(route.path);
  const view = unknownRoute
    ? <NotFoundPage navigate={navigate} />
    : user
      ? <MainApp user={user} onLogout={() => setUser(null)} pushToast={pushToast} navigate={navigate} route={route} />
      : mode
        ? <AuthPage mode={mode} onAuth={setUser} pushToast={pushToast} navigate={navigate} />
        : routeIsPrivate
          ? <AuthPage mode="login" onAuth={setUser} pushToast={pushToast} navigate={navigate} />
          : <HomeScreen navigate={navigate} />;

  return <>{view}<ToastStack toasts={toasts} removeToast={removeToast} /></>;
}
