export function fmtKickoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function countdownTo(iso: string): { text: string; locked: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: "Locked", locked: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return { text: `${d}d ${h}h`, locked: false };
  if (h > 0) return { text: `${h}h ${m}m`, locked: false };
  return { text: `${m}m`, locked: false };
}

export function teamFlag(code: string | null | undefined): string {
  if (!code || code.length !== 3) return "⚽";
  // Map common FIFA 3-letter codes → ISO-2 for emoji flags. Fallback to ball.
  const map: Record<string, string> = {
    USA: "US", CAN: "CA", MEX: "MX", ARG: "AR", BRA: "BR", URU: "UY", COL: "CO", ECU: "EC", PAR: "PY", CHI: "CL", PER: "PE", VEN: "VE",
    FRA: "FR", ESP: "ES", GER: "DE", ITA: "IT", ENG: "GB", POR: "PT", NED: "NL", BEL: "BE", DEN: "DK", SUI: "CH", AUT: "AT", CRO: "HR", SRB: "RS", POL: "PL", SVN: "SI", SCO: "GB", WAL: "GB", UKR: "UA", TUR: "TR", NOR: "NO", SWE: "SE", CZE: "CZ", HUN: "HU", IRL: "IE", BIH: "BA", GRE: "GR", ROU: "RO", SVK: "SK", BUL: "BG", ALB: "AL", MKD: "MK", MNE: "ME", KOS: "XK", ISL: "IS", FIN: "FI",
    MAR: "MA", TUN: "TN", EGY: "EG", ALG: "DZ", SEN: "SN", CIV: "CI", GHA: "GH", CMR: "CM", NGA: "NG", RSA: "ZA",
    JPN: "JP", KOR: "KR", AUS: "AU", IRN: "IR", KSA: "SA", QAT: "QA", UZB: "UZ", JOR: "JO", IRQ: "IQ", UAE: "AE",
    NZL: "NZ", PAN: "PA", CRC: "CR", HON: "HN", JAM: "JM",
  };
  const iso = map[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
  return iso.replace(/./g, (c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)));
}
