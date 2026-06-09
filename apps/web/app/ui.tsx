export const treatmentTypes = [
  { name: "Ortopedik", description: "Kas ve iskelet sistemi iyileştirmeleri.", icon: "☷" },
  { name: "Nörolojik", description: "Sinir sistemi ve inme sonrası destek.", icon: "◎" },
  { name: "Pediatrik", description: "Çocuk gelişimi ve hareket terapisi.", icon: "☻" },
  { name: "Geriatrik", description: "Yaşlı bireyler için güvenli hareketlilik.", icon: "♟" },
  { name: "Sporcu", description: "Performans artışı ve sakatlık tedavisi.", icon: "⌁" }
];

export const therapists = [
  { name: "Dr. Ahmet Yılmaz", title: "Kıdemli Fizyoterapist", specialty: "Manuel Terapi", tags: ["Manuel Terapi", "Spor Rehabilitasyonu", "Ortopedi"], tier: "Altın Kademe", rating: "4.9", reviews: "120+", price: "₺650", availability: "Bugün 14:00", location: "Kadıköy, İstanbul", color: "from-teal-900 to-cyan-100", initials: "AY" },
  { name: "Uzm. Fzt. Merve Kaya", title: "Nörolojik Rehab Uzmanı", specialty: "Nörolojik Reh.", tags: ["Nörolojik Reh.", "Pediatrik Terapi"], tier: "Gümüş Kademe", rating: "4.8", reviews: "86", price: "₺500", availability: "Yarın 09:30", location: "Şişli, İstanbul", color: "from-emerald-200 to-amber-100", initials: "MK" },
  { name: "Fzt. Selin Can", title: "Sporcu Sağlığı", specialty: "Sporcu Sağlığı", tags: ["Klinik Pilates", "Duruş Bozukluğu"], tier: "Altın Kademe", rating: "5.0", reviews: "42", price: "₺750", availability: "Bugün 17:00", location: "Online ve Evde Terapi", color: "from-slate-900 to-teal-200", initials: "SC" }
];

export function PatientHeader({ active = "Tedavi Türleri" }: { active?: string }) {
  const nav = ["Tedavi Türleri", "Randevularım", "Kademe"];
  return (
    <header className="border-b border-[#cfd8d4] bg-[#f6f8f7]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <a href="/" className="text-3xl font-black tracking-tight text-[#00685f]">FizioTerapi</a>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#202927] md:flex">
          {nav.map((item) => <a key={item} href={item === "Tedavi Türleri" ? "/treatment-types" : "#"} className={item === active ? "border-b-2 border-[#00685f] pb-2 text-[#00685f]" : ""}>{item}</a>)}
        </nav>
        <div className="flex items-center gap-5 text-sm font-semibold text-[#202927]"><span className="hidden rounded-full border border-[#cfd8d4] px-5 py-3 text-[#667370] sm:inline">⌕ Terapist veya uzmanlık ara...</span><span>◉ Profil</span></div>
      </div>
    </header>
  );
}

export function ProHeader({ active = "Panel", admin = false }: { active?: string; admin?: boolean }) {
  const nav = admin ? ["Onaylar", "İstatistikler", "Ayarlar"] : ["Panel", "Talepler", "Takvim", "Paketler"];
  return (
    <header className={admin ? "bg-[#252b2b] text-white" : "border-b border-[#cfd8d4] bg-[#f6f8f7]"}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <a href={admin ? "/admin" : "/therapist"} className={"text-3xl font-black tracking-tight " + (admin ? "text-white" : "text-[#00685f]")}>FizioTerapi {admin ? "Admin" : "Pro"}</a>
        <nav className="hidden items-center gap-8 text-base font-semibold md:flex">{nav.map((item) => <a key={item} href="#" className={item === active ? "border-b-2 border-[#008577] pb-2 text-[#008577]" : admin ? "text-white" : "text-[#202927]"}>{item}</a>)}</nav>
        <div className="flex items-center gap-4 font-semibold"><span>♧</span><span className="rounded-full bg-[#008577] px-3 py-2 text-white">{admin ? "AD" : "FA"}</span></div>
      </div>
    </header>
  );
}

export function Footer({ pro = false }: { pro?: boolean }) {
  return <footer className="mx-auto mt-20 flex max-w-7xl flex-col gap-4 border-t border-[#cfd8d4] px-8 py-8 text-sm text-[#283331] md:flex-row md:items-center md:justify-between"><div><p className="font-black text-[#00685f]">FizioTerapi{pro ? " Pro" : ""}</p><p className="mt-2">© 2026 FizioTerapi Pazaryeri. Tıbbi tavsiye değildir.</p></div><div className="flex gap-8"><a href="#">Şartlar</a><a href="#">Gizlilik</a><a href="#">Tıbbi Uyarı</a><a href="#">Destek</a></div></footer>;
}

export function Panel({ children, className = "" }: { children: any; className?: string }) { return <section className={"rounded-[8px] border border-[#cfd8d4] bg-white shadow-sm " + className}>{children}</section>; }
export function TealButton({ children, className = "" }: { children: any; className?: string }) { return <button className={"rounded-[7px] bg-[#00796b] px-6 py-4 font-black text-white shadow-sm transition hover:bg-[#00685f] " + className}>{children}</button>; }
export function Portrait({ color, initials, className = "" }: { color: string; initials: string; className?: string }) { return <div className={"relative overflow-hidden rounded-[7px] bg-gradient-to-br " + color + " " + className}><div className="absolute inset-x-8 bottom-0 h-3/4 rounded-t-full bg-white/55 blur-sm" /><div className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-2xl font-black text-[#00796b] shadow-sm">{initials}</div><span className="absolute left-3 top-3 rounded-full bg-[#00796b] px-3 py-1 text-[11px] font-black text-white">DOĞRULANMIŞ</span></div>; }
