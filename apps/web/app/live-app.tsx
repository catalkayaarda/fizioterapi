// @ts-nocheck
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "PATIENT" | "THERAPIST" | "ADMIN";
type Session = { accessToken: string; user: { id: string; email: string; name: string; role: Role } };
type Tab = "home" | "therapists" | "assessment" | "messages" | "therapist" | "admin" | "profile";
type Toast = { id: number; type: "success" | "error" | "info"; text: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SESSION_KEY = "fizioterapi.web.session";

function money(v: unknown) {
  if (v === undefined || v === null) return "—";
  return Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}
function dateTime(v: unknown) {
  if (!v) return "—";
  return new Date(String(v)).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}
function dateOnly(v: unknown) {
  if (!v) return "—";
  return new Date(String(v)).toLocaleDateString("tr-TR", { dateStyle: "long" });
}
function cls(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}
function stars(v: unknown) {
  const n = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
function initials(name: string | null | undefined) {
  return String(name || "FT").split(" ").filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase();
}
function roleLabel(v: string) {
  return ({ PATIENT: "Hasta", THERAPIST: "Fizyoterapist", ADMIN: "Yönetici" } as Record<string,string>)[v] || v;
}
function statusLabel(v: string) {
  const m: Record<string,string> = { PENDING:"Bekliyor", APPROVED:"Onaylandı", REJECTED:"Reddedildi" };
  return m[v] || v;
}
function statusBadge(v: string) {
  const m: Record<string,string> = { PENDING:"bg-orange-50 text-orange-700 border-orange-200", APPROVED:"bg-green-50 text-green-700 border-green-200", REJECTED:"bg-red-50 text-red-700 border-red-200" };
  return m[v] || "bg-gray-50 text-gray-600 border-gray-200";
}
function modeLabel(v: string) {
  return ({ ONLINE:"Online", PHYSICAL:"Yüz yüze", BOTH:"Online & Yüz yüze" } as Record<string,string>)[v] || v;
}
function convStatusLabel(v: string) {
  return ({ PENDING: "Onay bekliyor", ACCEPTED: "Aktif", REJECTED: "Reddedildi" } as Record<string,string>)[v] || v;
}
function convStatusBadge(v: string) {
  return ({ PENDING: "border-orange-200 bg-orange-50 text-orange-700", ACCEPTED: "border-green-200 bg-green-50 text-green-700", REJECTED: "border-red-200 bg-red-50 text-red-700" } as Record<string,string>)[v] || "border-gray-200 bg-gray-50 text-gray-600";
}
function avatarGrad() {
  return "from-teal-600 to-teal-300 text-white";
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Input({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-gray-700">
      {label && <span>{label}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
    </label>
  );
}
function Textarea({ label, value, onChange, placeholder = "", rows = 4 }: any) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-gray-700">
      {label && <span>{label}</span>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none resize-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
    </label>
  );
}
function Select({ label, value, onChange, options, labels = {} }: any) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-gray-700">
      {label && <span>{label}</span>}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
        {options.map((o: string) => <option key={o} value={o}>{(labels as any)[o] || o}</option>)}
      </select>
    </label>
  );
}
function Btn({ children, onClick, variant = "primary", size = "md", disabled = false, className = "" }: any) {
  const v: Record<string,string> = { primary:"bg-teal-700 text-white hover:bg-teal-800", outline:"border border-teal-700 text-teal-700 bg-white hover:bg-teal-50", danger:"border border-red-500 text-red-600 bg-white hover:bg-red-50", secondary:"bg-gray-100 text-gray-700 hover:bg-gray-200", ghost:"text-gray-600 hover:bg-gray-100" };
  const s: Record<string,string> = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2.5 text-sm", lg:"px-6 py-3 text-sm", xl:"px-8 py-4 text-base" };
  return <button onClick={onClick} disabled={disabled} className={cls("inline-flex items-center justify-center font-bold rounded-lg transition disabled:opacity-50", v[variant], s[size], className)}>{children}</button>;
}
function Badge({ children, className = "" }: any) {
  return <span className={cls("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", className)}>{children}</span>;
}
function Card({ children, className = "" }: any) {
  return <section className={cls("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>{children}</section>;
}
function Stat({ label, value, sub }: any) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-gray-900">{String(value ?? "—")}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center">
      <span className="text-4xl">📋</span>
      <p className="mt-3 font-semibold text-gray-400">{text}</p>
    </div>
  );
}
function AuthRequired({ text = "Bu bölüm için giriş yapmanız gerekiyor." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
      <span className="text-5xl">🔒</span>
      <p className="mt-4 text-lg font-bold text-gray-600">{text}</p>
    </div>
  );
}
function FileUpload({ label, onUpload }: any) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-bold text-gray-700">{label}</p>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-teal-700" />
      <Btn onClick={() => onUpload(file)} variant="secondary" size="sm" className="mt-3 w-full">Yükle</Btn>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
let _toastId = 0;

export default function LiveApp({ initialTab = "home" }: { initialTab?: Tab }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [treatmentTypes, setTreatmentTypes] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [assessmentResult, setAssessmentResult] = useState<any | null>(null);
  const [therapistProfile, setTherapistProfile] = useState<any | null>(null);
  const [pendingTherapists, setPendingTherapists] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  function toast(type: Toast["type"], text: string) {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, text }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (session?.accessToken) headers.set("authorization", "Bearer " + session.accessToken);
    const res = await fetch(API_URL.replace(/\/$/, "") + path, { ...init, headers });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; }
    catch { throw new Error("Sunucudan beklenmeyen yanıt alındı. API adresini (NEXT_PUBLIC_API_URL) kontrol edin."); }
    if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : body?.message || res.statusText);
    return body as T;
  }, [session?.accessToken]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); toast("success", label + " tamamlandı."); }
    catch (e: any) { toast("error", e?.message || "İşlem başarısız."); }
    finally { setBusy(false); }
  }

  const loadPublic = useCallback(async () => {
    try {
      const [types, list] = await Promise.all([request<any[]>("/catalog/treatment-types"), request<any[]>("/marketplace/therapists")]);
      setTreatmentTypes(types); setTherapists(list);
    } catch {}
  }, [request]);

  const loadTherapistPanel = useCallback(async () => {
    if (!session || session.user.role !== "THERAPIST") return;
    setTherapistProfile(await request<any>("/therapists/me"));
  }, [request, session]);

  const loadAdminPanel = useCallback(async () => {
    if (!session || session.user.role !== "ADMIN") return;
    setPendingTherapists(await request<any[]>("/admin/therapists/pending"));
  }, [request, session]);

  const loadConversations = useCallback(async () => {
    if (!session || session.user.role === "ADMIN") return [] as any[];
    const list = await request<any[]>("/conversations");
    setConversations(list);
    setUnreadMessages(list.reduce((sum, c: any) => sum + (c.unreadCount || 0), 0));
    return list;
  }, [request, session]);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  useEffect(() => { loadPublic(); }, [loadPublic]);

  useEffect(() => {
    if (!session) return;
    if (session.user.role === "THERAPIST") loadTherapistPanel().catch(() => {});
    if (session.user.role === "ADMIN") loadAdminPanel().catch(() => {});
    if (session.user.role !== "ADMIN") loadConversations().catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session || session.user.role === "ADMIN") return;
    const timer = setInterval(() => {
      request<{ unreadCount: number }>("/conversations/unread-count").then(r => setUnreadMessages(r.unreadCount)).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [session, request]);

  function saveSession(next: Session) {
    setSession(next); localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setTab(next.user.role === "ADMIN" ? "admin" : next.user.role === "THERAPIST" ? "therapist" : "home");
    toast("success", "Hoş geldiniz, " + next.user.name + "!");
  }
  function logout() { setSession(null); localStorage.removeItem(SESSION_KEY); setTab("home"); toast("info", "Çıkış yapıldı."); }

  async function openTherapist(id: string) {
    const detail = await request<any>("/marketplace/therapists/" + id);
    setSelectedTherapist(detail); setTab("therapists");
  }

  const nav = useMemo(() => {
    const base: Array<{ key: Tab; label: string }> = [
      { key: "home", label: "Ana Sayfa" }, { key: "therapists", label: "Terapistler" }, { key: "assessment", label: "Yönlendirme Testi" }
    ];
    if (session?.user.role === "PATIENT") base.push({ key: "messages", label: "Mesajlar" }, { key: "profile", label: "Profilim" });
    if (session?.user.role === "THERAPIST") base.push({ key: "therapist", label: "Pro Panel" }, { key: "messages", label: "Mesajlar" });
    if (session?.user.role === "ADMIN") base.push({ key: "admin", label: "Yönetim" });
    return base;
  }, [session?.user.role]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <button onClick={() => setTab("home")} className="text-2xl font-black text-teal-700 tracking-tight">FizioTerapi</button>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)}
                className={cls("rounded-lg px-4 py-2 text-sm font-semibold transition", tab === item.key ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-gray-100")}>
                {item.label}
                {item.key === "messages" && unreadMessages > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{unreadMessages}</span>}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="hidden rounded-full bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-700 sm:inline">{session.user.name}</span>
                <Btn variant="ghost" size="sm" onClick={logout}>Çıkış</Btn>
              </>
            ) : (
              <Btn variant="primary" size="sm" onClick={() => setTab("profile")}>Giriş / Kayıt</Btn>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {nav.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={cls("shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition", tab === item.key ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-600")}>
              {item.label}
              {item.key === "messages" && unreadMessages > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{unreadMessages}</span>}
            </button>
          ))}
        </div>
      </header>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={cls("flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm font-semibold",
            t.type === "success" && "bg-green-50 border-green-200 text-green-800",
            t.type === "error" && "bg-red-50 border-red-200 text-red-800",
            t.type === "info" && "bg-blue-50 border-blue-200 text-blue-800")}>
            <span className="mt-0.5 shrink-0">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="shrink-0 opacity-50 hover:opacity-100">✕</button>
          </div>
        ))}
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {!session && tab === "profile" ? <AuthSection request={request} saveSession={saveSession} /> : null}
        {tab === "home" ? <HomeSection treatmentTypes={treatmentTypes} therapists={therapists} openTherapist={id => run("Terapist yükleniyor", () => openTherapist(id))} setTab={setTab} /> : null}
        {tab === "therapists" ? <TherapistsSection request={request} treatmentTypes={treatmentTypes} therapists={therapists} setTherapists={setTherapists} selectedTherapist={selectedTherapist} setSelectedTherapist={setSelectedTherapist} session={session} run={run} loadConversations={loadConversations} setActiveConversationId={setActiveConversationId} setTab={setTab} toast={toast} /> : null}
        {tab === "assessment" ? <AssessmentSection questions={questions} setQuestions={setQuestions} request={request} result={assessmentResult} setResult={setAssessmentResult} run={run} openTherapist={id => run("Terapist yükleniyor", () => openTherapist(id))} setTab={setTab} /> : null}
        {tab === "messages" ? <MessagesSection session={session} request={request} conversations={conversations} loadConversations={loadConversations} activeConversationId={activeConversationId} setActiveConversationId={setActiveConversationId} toast={toast} /> : null}
        {tab === "therapist" ? <TherapistProSection session={session} request={request} run={run} treatmentTypes={treatmentTypes} profile={therapistProfile} conversations={conversations} reload={loadTherapistPanel} setTab={setTab} toast={toast} /> : null}
        {tab === "admin" ? <AdminSection session={session} request={request} run={run} pending={pendingTherapists} reload={loadAdminPanel} /> : null}
        {session && tab === "profile" ? <ProfileSection session={session} setTab={setTab} /> : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black text-teal-700">FizioTerapi</p>
            <p className="mt-1">© 2026 FizioTerapi Pazaryeri. Bu platform tıbbi tavsiye vermez.</p>
          </div>
          <div className="flex gap-6 text-xs font-semibold">
            <span>Şartlar & Koşullar</span><span>Gizlilik Politikası</span><span>Destek</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function AuthSection({ request, saveSession }: any) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState<Role>("PATIENT"); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit() {
    setError(""); setLoading(true);
    try {
      const body = mode === "login" ? { email, password } : { email, password, name, role };
      saveSession(await request(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(body) }));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  return (
    <div className="mx-auto max-w-md">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 border-b border-gray-200">
          <button onClick={() => setMode("login")} className={cls("py-4 text-sm font-bold transition", mode === "login" ? "bg-teal-700 text-white" : "text-gray-500 hover:bg-gray-50")}>Giriş Yap</button>
          <button onClick={() => setMode("register")} className={cls("py-4 text-sm font-bold transition", mode === "register" ? "bg-teal-700 text-white" : "text-gray-500 hover:bg-gray-50")}>Hesap Aç</button>
        </div>
        <div className="p-7 space-y-4">
          <Input label="E-posta" type="email" value={email} onChange={setEmail} placeholder="ornek@email.com" />
          <Input label="Şifre" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          {mode === "register" && (<><Input label="Ad Soyad" value={name} onChange={setName} placeholder="Ad Soyadınız" /><Select label="Hesap Türü" value={role} onChange={(v: string) => setRole(v as Role)} options={["PATIENT", "THERAPIST"]} labels={{ PATIENT: "Hasta", THERAPIST: "Fizyoterapist" }} /></>)}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Btn onClick={submit} disabled={loading} size="lg" className="w-full">{loading ? "Yükleniyor..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}</Btn>
          <div className="border-t border-gray-100 pt-4">
            <p className="mb-3 text-center text-xs font-semibold text-gray-400">Demo hesapları</p>
            <div className="grid grid-cols-3 gap-2">
              {[{ label: "Yönetici", e: "admin@fizioterapi.local", p: "Admin12345!" }, { label: "Hasta", e: "patient@example.com", p: "Password123!" }, { label: "Terapist", e: "therapist@example.com", p: "Password123!" }].map(({ label, e, p }) => (
                <button key={label} onClick={() => { setEmail(e); setPassword(p); }} className="rounded-lg border border-gray-200 p-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition">{label}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
const ICONS: Record<string,string> = { "manuel-terapi":"🤲","ortopedik-rehabilitasyon":"🦴","norolojik-rehabilitasyon":"🧠","sporcu-fizyoterapisi":"🏃","pediatrik-fizyoterapi":"👶","geriatrik-fizyoterapi":"👴","kardiyopulmoner-rehabilitasyon":"❤️","pelvik-taban-rehabilitasyonu":"🏥","postur-ve-skolyoz":"🦷" };

function HomeSection({ treatmentTypes, therapists, openTherapist, setTab }: any) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 to-teal-600 px-8 py-16 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-teal-400/50 bg-teal-700/50 px-4 py-1.5 text-sm font-bold text-teal-100">✓ Türkiye'nin Güvenilir Fizyoterapi Platformu</div>
          <h1 className="text-4xl font-black leading-tight md:text-5xl">Size en uygun<br />fizyoterapisti bulun</h1>
          <p className="mt-4 max-w-xl text-lg text-teal-100">Uzman terapistler, hizmet paketleri ve doğrudan mesajlaşma. Hepsi tek platformda.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setTab("therapists")} className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-black text-teal-800 shadow-sm hover:bg-teal-50 transition">Terapist Ara →</button>
            <button onClick={() => setTab("assessment")} className="inline-flex items-center justify-center rounded-lg border border-white/40 bg-white/10 px-8 py-4 text-base font-black text-white hover:bg-white/20 transition">Yönlendirme Testi</button>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white opacity-5" />
      </section>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[{ label: "Onaylı Terapist", val: therapists.length + "+" }, { label: "Tedavi Alanı", val: treatmentTypes.length }, { label: "Ortalama Puan", val: "4.9★" }, { label: "Uzman Kadro", val: "✓" }].map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
            <p className="text-2xl font-black text-teal-700">{s.val}</p>
            <p className="mt-1 text-sm font-semibold text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-black">Nasıl Çalışır?</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[{ n:"1", t:"Terapist Seç", d:"Uzmanlık, paket ve fiyata göre filtrele." }, { n:"2", t:"Mesaj Gönder", d:"Terapiste ulaş, talebini ilet." }, { n:"3", t:"Görüş", d:"Terapist onaylayınca mesaj alanında konuş." }].map(s => (
            <Card key={s.n} className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-lg font-black text-white">{s.n}</div>
              <h3 className="mt-4 text-lg font-black">{s.t}</h3>
              <p className="mt-2 text-sm text-gray-500">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Treatment types */}
      <section>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Tedavi Alanları</h2><Btn variant="ghost" size="sm" onClick={() => setTab("therapists")}>Tümünü gör →</Btn></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {treatmentTypes.map((t: any) => (
            <button key={t.id} onClick={() => setTab("therapists")}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-teal-400 hover:shadow-md transition-all group">
              <span className="text-2xl">{ICONS[t.slug] || "🏥"}</span>
              <div><p className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors">{t.name}</p><p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{t.description}</p></div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured therapists */}
      <section>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Öne Çıkan Terapistler</h2><Btn variant="ghost" size="sm" onClick={() => setTab("therapists")}>Tümünü gör →</Btn></div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {therapists.slice(0, 3).map((t: any) => <TherapistCard key={t.id} therapist={t} onOpen={() => openTherapist(t.id)} />)}
          {!therapists.length && <Empty text="Henüz onaylı terapist yok." />}
        </div>
      </section>

      {/* Trust */}
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-center text-xl font-black">Neden FizioTerapi?</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {[{ icon:"✅", t:"Onaylı Terapistler", d:"Her terapist belge incelemesinden geçer." }, { icon:"💬", t:"Doğrudan Mesajlaşma", d:"Terapistle uygulama içinden konuş." }, { icon:"📦", t:"Şeffaf Paketler", d:"Seans ve fiyatlar açıkça listelenir." }, { icon:"⭐", t:"Gerçek Yorumlar", d:"Hastaların değerlendirmelerini gör." }].map(f => (
            <div key={f.t} className="text-center"><span className="text-4xl">{f.icon}</span><h3 className="mt-3 font-bold text-gray-900">{f.t}</h3><p className="mt-1 text-sm text-gray-500">{f.d}</p></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TherapistCard({ therapist, onOpen }: any) {
  const minPrice = therapist.packages?.[0]?.price;
  const spec = therapist.specialties?.map((s: any) => s.treatmentType?.name).filter(Boolean).join(", ") || "Uzmanlık bekleniyor";
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className={cls("flex aspect-video items-center justify-center text-5xl font-black bg-gradient-to-br", avatarGrad())}>{initials(therapist.fullName)}</div>
      <div className="p-5">
        <h3 className="font-black text-gray-900">{therapist.fullName}</h3>
        <p className="mt-1 text-sm font-bold text-yellow-500">{stars(therapist.averageRating)} <span className="font-normal text-gray-400">{Number(therapist.averageRating || 0).toFixed(1)} ({therapist.reviewCount || 0})</span></p>
        <p className="mt-2 line-clamp-1 text-sm text-gray-500">{spec}</p>
        <div className="mt-4 flex items-center justify-between">
          <div><p className="text-xs text-gray-400">Başlangıç</p><p className="font-black text-teal-700">{minPrice ? money(minPrice) : "Paket yok"}</p></div>
          <Btn variant="primary" size="sm" onClick={onOpen}>Detay</Btn>
        </div>
      </div>
    </Card>
  );
}

// ── Therapists Section ────────────────────────────────────────────────────────
function TherapistsSection({ request, treatmentTypes, therapists, setTherapists, selectedTherapist, setSelectedTherapist, session, run, loadConversations, setActiveConversationId, setTab, toast }: any) {
  const [treatmentType, setTreatmentType] = useState(""); const [mode, setMode] = useState(""); const [minPrice, setMinPrice] = useState(""); const [maxPrice, setMaxPrice] = useState("");
  const [review, setReview] = useState(""); const [rating, setRating] = useState("5");
  const isPatient = session?.user.role === "PATIENT";

  async function search() {
    const p = new URLSearchParams();
    if (treatmentType) p.set("treatmentType", treatmentType); if (mode) p.set("mode", mode); if (minPrice) p.set("minPrice", minPrice); if (maxPrice) p.set("maxPrice", maxPrice);
    setTherapists(await request("/marketplace/therapists" + (p.toString() ? "?" + p : ""))); setSelectedTherapist(null);
  }
  async function detail(id: string) {
    setSelectedTherapist(await request("/marketplace/therapists/" + id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Terapistler</h1>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <Card className="p-5 space-y-4">
            <h2 className="font-black text-gray-900">Filtrele</h2>
            <Select label="Tedavi Türü" value={treatmentType} onChange={setTreatmentType} options={["", ...treatmentTypes.map((t: any) => t.slug || t.id)]} labels={{ "": "Tümü", ...Object.fromEntries(treatmentTypes.map((t: any) => [t.slug || t.id, t.name])) }} />
            <Select label="Seans Modu" value={mode} onChange={setMode} options={["", "ONLINE", "PHYSICAL", "BOTH"]} labels={{ "": "Tümü", ONLINE: "Online", PHYSICAL: "Yüz yüze", BOTH: "Her ikisi" }} />
            <div className="grid grid-cols-2 gap-3"><Input label="Min Fiyat ₺" value={minPrice} onChange={setMinPrice} placeholder="0" /><Input label="Max Fiyat ₺" value={maxPrice} onChange={setMaxPrice} placeholder="5000" /></div>
            <Btn onClick={() => run("Terapist arama", search)} className="w-full" size="md">Ara ({therapists.length})</Btn>
            {(treatmentType || mode || minPrice || maxPrice) && <Btn variant="ghost" size="sm" className="w-full" onClick={() => { setTreatmentType(""); setMode(""); setMinPrice(""); setMaxPrice(""); }}>Sıfırla</Btn>}
          </Card>
        </aside>
        <div className="space-y-4">
          {therapists.map((t: any) => <TherapistListRow key={t.id} therapist={t} onOpen={() => run("Terapist yükleniyor", () => detail(t.id))} />)}
          {!therapists.length && <Empty text="Filtreye uygun terapist bulunamadı." />}
        </div>
      </div>
      {selectedTherapist && (
        <TherapistModal therapist={selectedTherapist} session={session} isPatient={isPatient} review={review} setReview={setReview} rating={rating} setRating={setRating} close={() => setSelectedTherapist(null)} run={run} request={request} refresh={() => detail(selectedTherapist.id)} loadConversations={loadConversations} setActiveConversationId={setActiveConversationId} setTab={setTab} toast={toast} />
      )}
    </div>
  );
}

function TherapistListRow({ therapist, onOpen }: any) {
  const packages = therapist.packages || [];
  const minPrice = packages[0]?.price;
  const spec = therapist.specialties?.map((s: any) => s.treatmentType?.name).filter(Boolean).join(", ") || "Uzmanlık bekleniyor";
  return (
    <Card className="p-5">
      <div className="flex gap-4 items-start">
        <div className={cls("hidden h-20 w-20 shrink-0 items-center justify-center rounded-xl text-2xl font-black bg-gradient-to-br sm:flex", avatarGrad())}>{initials(therapist.fullName)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-gray-900">{therapist.fullName}</h3>
              <p className="mt-1 text-sm font-bold text-yellow-500">{stars(therapist.averageRating)} <span className="font-normal text-gray-400">{Number(therapist.averageRating || 0).toFixed(1)} · {therapist.reviewCount || 0} yorum</span></p>
            </div>
            <div className="text-right"><p className="text-xs text-gray-400">Başlangıç</p><p className="text-lg font-black text-teal-700">{minPrice ? money(minPrice) : "—"}</p></div>
          </div>
          <p className="mt-2 text-sm text-gray-600">{spec}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {packages.length > 0 && <span className="rounded-full bg-teal-50 px-3 py-1 font-bold text-teal-700">{packages.length} paket</span>}
              {therapist.city && <span className="rounded-full bg-gray-100 px-3 py-1 font-bold text-gray-600">📍 {therapist.city}</span>}
            </div>
            <Btn variant="primary" size="sm" onClick={onOpen}>Profili Gör</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

function TherapistModal({ therapist, session, isPatient, review, setReview, rating, setRating, close, run, request, refresh, loadConversations, setActiveConversationId, setTab, toast }: any) {
  const [messageDraft, setMessageDraft] = useState("");

  async function startConversation() {
    if (!isPatient) { toast("error", "Mesaj göndermek için hasta hesabıyla giriş yapın."); return; }
    const conversation = await request("/conversations", { method: "POST", body: JSON.stringify({ therapistProfileId: therapist.id, message: messageDraft.trim() || undefined }) });
    setMessageDraft("");
    await loadConversations?.();
    setActiveConversationId?.(conversation.id);
    close(); setTab("messages");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={e => e.target === e.currentTarget && close()}>
      <section className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-teal-600">Terapist Profili</p><h2 className="text-xl font-black">{therapist.fullName}</h2></div>
          <button onClick={close} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition">✕</button>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
          {/* Left */}
          <aside className="space-y-4">
            <div className={cls("flex aspect-square items-center justify-center rounded-xl text-5xl font-black bg-gradient-to-br", avatarGrad())}>{initials(therapist.fullName)}</div>
            <div className="space-y-2">
              {therapist.city && <p className="text-sm text-gray-500">📍 {therapist.city}</p>}
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-lg font-black text-yellow-500">{stars(therapist.averageRating)}</p><p className="mt-1 text-sm font-semibold text-gray-700">{Number(therapist.averageRating || 0).toFixed(1)} · {therapist.reviewCount || 0} yorum</p></div>
            </div>
          </aside>
          {/* Right */}
          <div className="space-y-7">
            <div>
              <h3 className="font-black text-gray-900">Hakkında</h3>
              <p className="mt-2 leading-relaxed text-gray-600">{therapist.bio || "Terapist henüz biyografi eklememiş."}</p>
              <div className="mt-3 flex flex-wrap gap-2">{therapist.specialties?.map((s: any) => <Badge key={s.id} className="border-teal-200 bg-teal-50 text-teal-700">{s.treatmentType?.name}</Badge>)}</div>
            </div>

            <div>
              <h3 className="font-black text-gray-900">Hizmet Paketleri</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {therapist.packages?.map((p: any) => (
                  <div key={p.id} className="rounded-xl border-2 border-gray-200 p-4">
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.sessionCount} seans · {modeLabel(p.mode)}</p>
                    <p className="mt-2 text-xl font-black text-teal-700">{money(p.price)}</p>
                  </div>
                ))}
                {!therapist.packages?.length && <p className="col-span-2 text-sm text-gray-400">Henüz paket eklenmemiş.</p>}
              </div>
            </div>

            {/* Message request */}
            {isPatient ? (
              <div className="rounded-xl border-2 border-teal-200 bg-white p-5">
                <h3 className="font-black text-gray-900">💬 Mesaj Gönder</h3>
                <p className="mt-1 text-sm text-gray-500">İlgilendiğiniz paketi veya sorunuzu terapiste iletin. Terapist talebinizi onayladığında mesaj alanından görüşebilirsiniz.</p>
                <div className="mt-3 space-y-3">
                  <Textarea label="" value={messageDraft} onChange={setMessageDraft} placeholder="Merhaba, ... paketi hakkında bilgi almak istiyorum." rows={3} />
                  <Btn onClick={() => run("Mesaj talebi gönderiliyor", startConversation)} variant="primary" className="w-full">Mesaj Talebi Gönder</Btn>
                </div>
              </div>
            ) : !session ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center"><p className="font-bold text-teal-800">Mesaj göndermek için hasta hesabıyla giriş yapın</p></div>
            ) : null}

            {/* Documents */}
            {therapist.documents?.length > 0 && (
              <div>
                <h3 className="font-black text-gray-900">Sertifikalar</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {therapist.documents.map((d: any) => (
                    <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm hover:bg-gray-50 transition">
                      <span className="text-2xl">{d.type === "DIPLOMA" ? "🎓" : "📄"}</span>
                      <div><p className="font-bold text-gray-900">{d.type === "DIPLOMA" ? "Diploma" : "Lisans"}</p><p className="text-xs text-gray-400">{d.originalName}</p></div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div>
              <h3 className="font-black text-gray-900">Yorumlar</h3>
              <div className="mt-3 space-y-3">
                {therapist.reviews?.map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between"><p className="font-bold text-yellow-500">{stars(r.rating)} <span className="font-semibold text-sm text-gray-700">{r.rating}/5</span></p><p className="text-xs text-gray-400">{dateOnly(r.createdAt)}</p></div>
                    {r.comment && <p className="mt-2 text-sm text-gray-600">{r.comment}</p>}
                    <p className="mt-2 text-xs font-bold text-gray-400">{r.authorName || "Hasta"}</p>
                  </div>
                ))}
                {!therapist.reviews?.length && <p className="text-sm text-gray-400">Henüz yorum yok.</p>}
              </div>
              {isPatient && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <h4 className="font-black text-gray-900">Yorum Bırak</h4>
                  <div className="mt-3 space-y-3">
                    <Select label="Puan" value={rating} onChange={setRating} options={["5","4","3","2","1"]} labels={{ "5":"5 ★ Mükemmel","4":"4 ★ İyi","3":"3 ★ Orta","2":"2 ★ Zayıf","1":"1 ★ Çok kötü" }} />
                    <Textarea label="Yorumunuz" value={review} onChange={setReview} placeholder="Deneyiminizi paylaşın..." rows={3} />
                    <Btn onClick={() => run("Yorum kaydediliyor", async () => { await request("/marketplace/therapists/" + therapist.id + "/reviews", { method: "POST", body: JSON.stringify({ rating: Number(rating), comment: review }) }); await refresh(); setReview(""); })} variant="primary" size="sm">Yorumu Gönder</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Assessment ────────────────────────────────────────────────────────────────
function AssessmentSection({ questions, setQuestions, request, result, setResult, run, openTherapist, setTab }: any) {
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const answered = Object.keys(answers).length;
  const progress = questions.length ? (answered / questions.length) * 100 : 0;

  async function load() { const q = await request("/assessment/questions"); setQuestions(q); setAnswers({}); setResult(null); }
  async function submit() {
    const optionIds = Object.values(answers);
    if (!optionIds.length) throw new Error("En az bir soruyu yanıtlayın.");
    setResult(await request("/assessment/results", { method: "POST", body: JSON.stringify({ optionIds }) }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black">Yönlendirme Testi</h1><p className="mt-1 text-gray-500">Size en uygun tedavi türünü belirleyin.</p></div>
        {!questions.length ? <Btn onClick={() => run("Sorular yükleniyor", load)} variant="primary">Teste Başla</Btn> : !result && <Btn onClick={() => run("Yeniden başlıyor", load)} variant="secondary" size="sm">Yeniden Başla</Btn>}
      </div>

      {!questions.length && (
        <Card className="p-12 text-center">
          <span className="text-6xl">🩺</span>
          <h2 className="mt-4 text-xl font-black">Belirtilerinizi anlayalım</h2>
          <p className="mt-2 mx-auto max-w-md text-gray-500">Kısa test ile size en uygun tedavi türü ve terapist önerisi alın.</p>
          <Btn onClick={() => run("Sorular yükleniyor", load)} variant="primary" size="xl" className="mt-6">Teste Başla →</Btn>
        </Card>
      )}

      {questions.length > 0 && !result && (
        <>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-gray-700">{answered} / {questions.length} yanıtlandı</span><span className="font-bold text-teal-700">{Math.round(progress)}%</span></div>
            <div className="h-2 rounded-full bg-gray-200"><div className="h-2 rounded-full bg-teal-600 transition-all duration-500" style={{ width: progress + "%" }} /></div>
          </Card>
          <div className="space-y-4">
            {questions.map((q: any, i: number) => (
              <Card key={q.id} className={cls("p-6 transition-all", answers[q.id] && "border-teal-300 bg-teal-50/20")}>
                <div className="flex items-start gap-3">
                  <span className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black", answers[q.id] ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-600")}>{i + 1}</span>
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{q.text}</h2>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o: any) => (
                    <button key={o.id} onClick={() => setAnswers(p => ({ ...p, [q.id]: o.id }))} className={cls("rounded-xl border-2 p-3 text-left text-sm font-semibold transition", answers[q.id] === o.id ? "border-teal-600 bg-teal-50 text-teal-800" : "border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-gray-50")}>{o.label}</button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <Btn onClick={() => run("Sonuç hesaplanıyor", submit)} variant="primary" size="xl" disabled={answered === 0} className="w-full">
            {answered === questions.length ? "Sonucu Hesapla →" : `${questions.length - answered} soru kaldı`}
          </Btn>
        </>
      )}

      {result && (
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <span className="text-4xl">🎯</span>
              <div><p className="text-sm font-bold uppercase tracking-wider text-teal-600">Önerilen Tedavi Türü</p><h2 className="mt-1 text-2xl font-black text-gray-900">{result.recommendedTreatmentType?.name || "Belirlenemedi"}</h2><p className="mt-2 text-gray-600">{result.recommendedTreatmentType?.description}</p></div>
            </div>
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="text-sm font-semibold text-orange-700">⚠️ {result.disclaimer}</p></div>
          </Card>
          {result.therapists?.length > 0 && (
            <div><h3 className="text-xl font-black">Önerilen Terapistler</h3><div className="mt-4 grid gap-4 md:grid-cols-3">{result.therapists.map((t: any) => <TherapistCard key={t.id} therapist={t} onOpen={() => openTherapist(t.id)} />)}</div></div>
          )}
          <div className="flex gap-3"><Btn variant="primary" size="lg" onClick={() => setTab("therapists")}>Tüm Terapistleri Gör</Btn><Btn variant="outline" size="lg" onClick={() => run("Yeniden başlıyor", load)}>Testi Tekrarla</Btn></div>
        </div>
      )}
    </div>
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────
function MessagesSection({ session, request, conversations, loadConversations, activeConversationId, setActiveConversationId, toast }: any) {
  if (!session || session.user.role === "ADMIN") return <AuthRequired text="Mesajlaşma için hasta veya terapist hesabıyla giriş yapın." />;
  const isTherapist = session.user.role === "THERAPIST";
  const [messages, setMessages] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const selectedId = activeConversationId;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const other = (c: any) => isTherapist ? c?.patient?.name : c?.therapistProfile?.fullName;

  const openConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    try {
      const data = await request<any>("/conversations/" + id + "/messages");
      setActiveConv(data.conversation);
      setMessages(data.messages);
      await loadConversations?.();
    } catch (e: any) { toast("error", e?.message || "Mesajlar yüklenemedi."); }
  }, [request, loadConversations, setActiveConversationId, toast]);

  useEffect(() => { loadConversations?.().catch(() => {}); }, []);
  useEffect(() => { if (selectedId) openConversation(selectedId); }, [selectedId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length, selectedId]);

  // Light polling so new messages and approvals appear without a manual refresh.
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(async () => {
      try {
        const data = await request<any>("/conversations/" + selectedId + "/messages");
        setActiveConv(data.conversation);
        setMessages(data.messages);
        loadConversations?.().catch(() => {});
      } catch {}
    }, 6000);
    return () => clearInterval(timer);
  }, [selectedId, request, loadConversations]);

  async function send() {
    const body = draft.trim();
    if (!body || !selectedId) return;
    setSending(true);
    try {
      const data = await request<any>("/conversations/" + selectedId + "/messages", { method: "POST", body: JSON.stringify({ body }) });
      setActiveConv(data.conversation);
      setMessages(data.messages);
      setDraft("");
      await loadConversations?.();
    } catch (e: any) { toast("error", e?.message || "Mesaj gönderilemedi."); }
    finally { setSending(false); }
  }

  async function review(action: "accept" | "reject") {
    if (!selectedId) return;
    try {
      await request("/conversations/" + selectedId + "/" + action, { method: "PATCH", body: JSON.stringify({}) });
      await openConversation(selectedId);
      toast("success", action === "accept" ? "Görüşme kabul edildi." : "Görüşme reddedildi.");
    } catch (e: any) { toast("error", e?.message || "İşlem başarısız."); }
  }

  const status = activeConv?.status;
  const canWrite = status === "ACCEPTED" || (status === "PENDING" && !isTherapist);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black">Mesajlar</h1><p className="mt-1 text-gray-500">{isTherapist ? "Hastalarınızla görüşün ve gelen talepleri yanıtlayın." : "Terapistlerle iletişime geçin."}</p></div>
        <Btn variant="outline" size="sm" onClick={() => loadConversations?.()}>↺ Yenile</Btn>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <Card className="overflow-hidden h-fit max-h-[70vh] overflow-y-auto">
          {conversations.length ? conversations.map((c: any) => (
            <button key={c.id} onClick={() => openConversation(c.id)}
              className={cls("flex w-full items-start gap-3 border-b border-gray-100 p-4 text-left transition", selectedId === c.id ? "bg-teal-50" : "hover:bg-gray-50")}>
              <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black bg-gradient-to-br", avatarGrad())}>{initials(other(c))}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold text-gray-900">{other(c) || "Kullanıcı"}</p>
                  {c.unreadCount > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unreadCount}</span>}
                </div>
                <p className="mt-0.5 truncate text-sm text-gray-500">{c.lastMessage?.body || "Henüz mesaj yok"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className={convStatusBadge(c.status)}>{convStatusLabel(c.status)}</Badge>
                  {c.lastMessageAt && <span className="text-[11px] text-gray-400">{dateTime(c.lastMessageAt)}</span>}
                </div>
              </div>
            </button>
          )) : <div className="p-8 text-center text-sm text-gray-400">Henüz görüşmeniz yok.{!isTherapist && " Bir terapist profilinden mesaj gönderebilirsiniz."}</div>}
        </Card>

        {/* Thread */}
        <Card className="flex h-[70vh] flex-col">
          {!activeConv ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-400">
              <span className="text-5xl">💬</span>
              <p className="mt-3 font-semibold">Bir görüşme seçin</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-gray-900">{other(activeConv)}</h2>
                  <Badge className={convStatusBadge(status)}>{convStatusLabel(status)}</Badge>
                </div>
                {isTherapist && status === "PENDING" && (
                  <div className="flex gap-2">
                    <Btn variant="primary" size="sm" onClick={() => review("accept")}>Kabul Et ✓</Btn>
                    <Btn variant="danger" size="sm" onClick={() => review("reject")}>Reddet</Btn>
                  </div>
                )}
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-5">
                {messages.length ? messages.map((m: any) => {
                  const mine = m.senderRole === activeConv.viewerRole;
                  return (
                    <div key={m.id} className={cls("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cls("max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm", mine ? "rounded-br-sm bg-teal-700 text-white" : "rounded-bl-sm border border-gray-200 bg-white text-gray-800")}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cls("mt-1 text-[10px]", mine ? "text-teal-100" : "text-gray-400")}>{dateTime(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                }) : <p className="text-center text-sm text-gray-400">Henüz mesaj yok. İlk mesajı gönderin.</p>}
              </div>
              <div className="border-t border-gray-200 p-3">
                {canWrite ? (
                  <div className="flex items-end gap-2">
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={1} placeholder="Mesaj yazın..."
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      className="max-h-32 flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                    <Btn onClick={send} disabled={sending || !draft.trim()} variant="primary" size="md">Gönder</Btn>
                  </div>
                ) : (
                  <p className="px-2 py-1 text-center text-sm text-gray-400">
                    {status === "REJECTED" ? "Bu görüşme talebi reddedildi." : isTherapist ? "Mesajlaşmak için talebi kabul edin." : "Terapistin talebinizi onaylaması bekleniyor."}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Therapist Pro ─────────────────────────────────────────────────────────────
function TherapistProSection({ session, request, run, treatmentTypes, profile, conversations, reload, setTab, toast }: any) {
  if (!session || session.user.role !== "THERAPIST") return <AuthRequired text="Terapist paneli için terapist hesabıyla giriş yapın." />;
  const [sub, setSub] = useState<"dashboard"|"packages"|"profile">("dashboard");
  const pendingRequests = (conversations || []).filter((c: any) => c.status === "PENDING").length;
  const tabs = [{ key:"dashboard", label:"Genel Bakış" }, { key:"packages", label:"Paketler" }, { key:"profile", label:"Profil" }];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black">FizioTerapi Pro</h1><div className="mt-1 flex items-center gap-2"><Badge className={statusBadge(profile?.status || "PENDING")}>{statusLabel(profile?.status || "PENDING")}</Badge></div></div>
        <Btn variant="outline" size="sm" onClick={() => run("Panel yenileniyor", reload)}>↺ Yenile</Btn>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSub(t.key as any)} className={cls("flex shrink-0 items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-bold transition whitespace-nowrap", sub === t.key ? "bg-teal-700 text-white" : "text-gray-500 hover:text-gray-700")}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === "dashboard" && <ProDashboard profile={profile} pendingRequests={pendingRequests} setTab={setTab} />}
      {sub === "packages" && <ProPackages profile={profile} treatmentTypes={treatmentTypes} run={run} request={request} reload={reload} />}
      {sub === "profile" && <ProProfileEdit profile={profile} treatmentTypes={treatmentTypes} run={run} request={request} reload={reload} />}
    </div>
  );
}

function ProDashboard({ profile, pendingRequests, setTab }: any) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Bekleyen Mesaj Talebi" value={pendingRequests} sub="Yanıt bekleniyor" />
        <Stat label="Paketlerim" value={profile?.packages?.length || 0} sub="Aktif paket" />
        <Stat label="Uzmanlık Alanı" value={profile?.specialties?.length || 0} />
      </div>
      <Card className="p-6">
        <h2 className="font-black text-gray-900">Hasta Talepleri</h2>
        <p className="mt-2 text-sm text-gray-500">Hastalar profilinizden size mesaj gönderir. Gelen talepleri kabul edip mesaj alanında görüşebilirsiniz.</p>
        <Btn variant="primary" size="md" className="mt-4" onClick={() => setTab("messages")}>Mesajlara Git{pendingRequests > 0 ? ` (${pendingRequests})` : ""} →</Btn>
      </Card>
      {profile?.status !== "APPROVED" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-sm font-semibold text-orange-700">
          Profiliniz {statusLabel(profile?.status || "PENDING").toLowerCase()}. Paket ve uzmanlık eklemek için önce yönetici onayı gerekir. Profil sekmesinden belgelerinizi yükleyin.
        </div>
      )}
    </div>
  );
}

function ProPackages({ profile, treatmentTypes, run, request, reload }: any) {
  const [name, setName] = useState("Tekli Seans"); const [price, setPrice] = useState("750"); const [sessionCount, setSessionCount] = useState("1"); const [mode, setMode] = useState("ONLINE"); const [treatmentTypeId, setTreatmentTypeId] = useState(treatmentTypes[0]?.id || "");
  const packages = profile?.packages || [];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-4 text-xl font-black">Mevcut Paketler ({packages.length})</h2>
        <div className="space-y-3">
          {packages.map((p: any) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-black text-gray-900">{p.name}</h3><p className="text-sm text-gray-500">{p.sessionCount} seans · {modeLabel(p.mode)}</p><p className="mt-1 text-lg font-black text-teal-700">{money(p.price)}</p></div>
                <Btn variant="danger" size="sm" onClick={() => run("Paket siliniyor", async () => { await request("/therapists/me/packages/" + p.id, { method: "DELETE" }); await reload(); })}>Sil</Btn>
              </div>
            </Card>
          ))}
          {!packages.length && <Empty text="Henüz paket eklemediniz." />}
        </div>
      </div>
      <div>
        <h2 className="mb-4 text-xl font-black">Yeni Paket</h2>
        <Card className="p-5 space-y-4">
          <Input label="Paket Adı" value={name} onChange={setName} placeholder="ör. Tekli Seans" />
          <div className="grid grid-cols-2 gap-3"><Input label="Seans" value={sessionCount} onChange={setSessionCount} /><Input label="Fiyat (₺)" value={price} onChange={setPrice} /></div>
          <Select label="Seans Modu" value={mode} onChange={setMode} options={["ONLINE","PHYSICAL","BOTH"]} labels={{ ONLINE:"Online", PHYSICAL:"Yüz yüze", BOTH:"Her ikisi" }} />
          <Select label="Tedavi Türü" value={treatmentTypeId} onChange={setTreatmentTypeId} options={treatmentTypes.map((t: any) => t.id)} labels={Object.fromEntries(treatmentTypes.map((t: any) => [t.id, t.name]))} />
          <Btn onClick={() => run("Paket oluşturuluyor", async () => { await request("/therapists/me/packages", { method: "POST", body: JSON.stringify({ name, sessionCount: Number(sessionCount), price: Number(price), mode, treatmentTypeId }) }); await reload(); })} variant="primary" className="w-full">Paketi Oluştur</Btn>
        </Card>
      </div>
    </div>
  );
}

function ProProfileEdit({ profile, treatmentTypes, run, request, reload }: any) {
  const [fullName, setFullName] = useState(profile?.fullName || ""); const [bio, setBio] = useState(profile?.bio || ""); const [specialtyIds, setSpecialtyIds] = useState<string[]>(profile?.specialties?.map((s: any) => s.treatmentTypeId) || []);
  useEffect(() => { setFullName(profile?.fullName || ""); setBio(profile?.bio || ""); setSpecialtyIds(profile?.specialties?.map((s: any) => s.treatmentTypeId) || []); }, [profile?.id]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <Card className="p-5 space-y-4">
          <h2 className="font-black text-gray-900">Temel Bilgiler</h2>
          <Input label="Ad Soyad" value={fullName} onChange={setFullName} />
          <Textarea label="Biyografi" value={bio} onChange={setBio} placeholder="Uzmanlık alanlarınız, tecrübeleriniz..." rows={5} />
          <Btn onClick={() => run("Profil kaydediliyor", async () => { await request("/therapists/me", { method: "PATCH", body: JSON.stringify({ fullName, bio }) }); await reload(); })} variant="primary" className="w-full">Profili Kaydet</Btn>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-black text-gray-900">Belgeler</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {profile?.documents?.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm">
                <span>{d.type === "DIPLOMA" ? "🎓" : "📄"}</span>
                <div className="min-w-0"><p className="font-bold text-teal-800">{d.type === "DIPLOMA" ? "Diploma" : "Lisans"}</p><p className="truncate text-xs text-teal-600">{d.originalName}</p></div>
              </div>
            ))}
          </div>
          <div className="grid gap-3">
            {[{ type:"DIPLOMA", label:"Diploma Yükle" }, { type:"LICENSE", label:"Lisans Yükle" }].map(({ type, label }) => (
              <FileUpload key={type} label={label} onUpload={(file: File | null) => { if (!file) return; run(label, async () => { const f = new FormData(); f.set("type", type); f.set("file", file); await request("/therapists/me/documents", { method: "POST", body: f }); await reload(); }); }} />
            ))}
          </div>
        </Card>
      </div>
      <Card className="p-5 h-fit">
        <h2 className="mb-4 font-black text-gray-900">Uzmanlık Alanları</h2>
        <div className="space-y-2">
          {treatmentTypes.map((t: any) => (
            <label key={t.id} className={cls("flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition", specialtyIds.includes(t.id) ? "border-teal-600 bg-teal-50" : "border-gray-200 hover:border-teal-300")}>
              <input type="checkbox" checked={specialtyIds.includes(t.id)} onChange={e => setSpecialtyIds(e.target.checked ? [...specialtyIds, t.id] : specialtyIds.filter(id => id !== t.id))} className="h-4 w-4 accent-teal-600" />
              <div><p className="font-semibold text-gray-900">{t.name}</p>{t.description && <p className="text-xs text-gray-400">{t.description}</p>}</div>
            </label>
          ))}
        </div>
        <Btn onClick={() => run("Uzmanlıklar kaydediliyor", async () => { await request("/therapists/me/specialties", { method: "PATCH", body: JSON.stringify({ treatmentTypeIds: specialtyIds }) }); await reload(); })} variant="primary" className="mt-4 w-full">Uzmanlıkları Kaydet</Btn>
      </Card>
    </div>
  );
}

// ── Admin ─────────────────────────────────────────────────────────────────────
function AdminSection({ session, request, run, pending, reload }: any) {
  if (!session || session.user.role !== "ADMIN") return <AuthRequired text="Yönetim paneli için admin hesabıyla giriş yapın." />;
  async function review(id: string, status: "APPROVED" | "REJECTED") {
    await request("/admin/therapists/" + id + "/review", { method: "PATCH", body: JSON.stringify(status === "APPROVED" ? { status } : { status, rejectionReason: "Belgeler eksik veya geçersiz." }) });
    await reload();
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Yönetim Paneli</h1><p className="mt-1 text-gray-500">Onay bekleyen: {pending.length} terapist</p></div><Btn variant="outline" size="sm" onClick={() => run("Yenileniyor", reload)}>↺ Yenile</Btn></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Onay Bekleyen" value={pending.length} sub="İnceleme gerekiyor" />
        <Stat label="Platform" value="Aktif" sub="Tüm sistemler normal" />
      </div>
      <div>
        <h2 className="mb-4 text-xl font-black">Bekleyen Terapistler</h2>
        <div className="space-y-4">
          {pending.map((p: any) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-gray-900">{p.fullName}</h3><Badge className="border-orange-200 bg-orange-50 text-orange-700">Bekliyor</Badge></div>
                  <p className="text-sm text-gray-500">📧 {p.user?.email}</p>
                  {p.city && <p className="text-sm text-gray-500">📍 {p.city}</p>}
                  {p.bio && <p className="max-w-xl line-clamp-2 text-sm text-gray-600">{p.bio}</p>}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {p.documents?.map((d: any) => (
                      <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-bold text-teal-700 hover:bg-teal-100 transition">
                        {d.type === "DIPLOMA" ? "🎓" : "📄"} {d.type === "DIPLOMA" ? "Diploma" : "Lisans"}
                      </a>
                    ))}
                    {!p.documents?.length && <span className="text-gray-400">Belge yüklenmemiş</span>}
                  </div>
                  {p.specialties?.length > 0 && <div className="flex flex-wrap gap-1">{p.specialties.map((s: any) => <Badge key={s.id} className="border-gray-200 bg-gray-100 text-gray-600">{s.treatmentType?.name}</Badge>)}</div>}
                  <p className="text-xs text-gray-400">Başvuru: {dateTime(p.createdAt)}</p>
                </div>
                <div className="flex gap-3"><Btn variant="primary" size="md" onClick={() => run("Onaylanıyor", () => review(p.id, "APPROVED"))}>Onayla ✓</Btn><Btn variant="danger" size="md" onClick={() => run("Reddediliyor", () => review(p.id, "REJECTED"))}>Reddet</Btn></div>
              </div>
            </Card>
          ))}
          {!pending.length && <Empty text="Onay bekleyen terapist yok. Her şey güncel!" />}
        </div>
      </div>
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileSection({ session, setTab }: any) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Profilim</h1>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className={cls("flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-black bg-gradient-to-br", avatarGrad())}>{initials(session.user.name)}</div>
              <div><h2 className="text-xl font-black text-gray-900">{session.user.name}</h2><p className="text-sm text-gray-500">{session.user.email}</p><div className="mt-2 flex gap-2"><Badge className="border-gray-200 bg-gray-100 text-gray-600">{roleLabel(session.user.role)}</Badge></div></div>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-black text-gray-900">Nasıl İlerlerim?</h2>
            <ol className="mt-3 space-y-2 text-sm text-gray-600">
              <li>1. Terapistler sekmesinden uygun fizyoterapisti bulun.</li>
              <li>2. Profilinden mesaj göndererek talebinizi iletin.</li>
              <li>3. Terapist onayladığında Mesajlar sekmesinden görüşün.</li>
            </ol>
            <Btn variant="primary" size="md" className="mt-4" onClick={() => setTab("therapists")}>Terapist Bul →</Btn>
          </Card>
        </div>
        <Card className="p-5 h-fit">
          <h2 className="font-black text-gray-900">Hesap</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Ad Soyad</span><span className="font-bold text-gray-700">{session.user.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">E-posta</span><span className="font-bold text-gray-700">{session.user.email}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Rol</span><span className="font-bold text-gray-700">{roleLabel(session.user.role)}</span></div>
          </div>
          <Btn variant="primary" size="md" className="mt-5 w-full" onClick={() => setTab("messages")}>Mesajlarım →</Btn>
        </Card>
      </div>
    </div>
  );
}
