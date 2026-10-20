import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarPlus,
  Trash2,
  Loader2,
  RefreshCw,
  Clock,
  MapPin,
  Sparkles,
  Sun,
  Moon,
  Check,
  Users,
  Phone,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Settings2,
  CalendarRange,
  Eye,
  EyeOff,
  User,
  Pencil,
} from "lucide-react";

interface Availability {
  id: number;
  agentId: number | null;
  weekday: number;
  startTime: string;
  endTime: string;
  sede: string;
  isActive: boolean;
}

interface Cita {
  id: number;
  conversationId: number;
  agentId: number | null;
  kind?: string | null;
  sede: string;
  startAt: string;
  endAt: string;
  estado: string;
  note: string | null;
  contactName: string | null;
  waId: string | null;
}

interface ContactResult {
  id: number;
  waId: string;
  contactName: string | null;
  updatedAt: string | null;
}

const APP_TZ = "America/La_Paz";
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const CANALES = ["centro", "norte", "virtual"] as const;
type Canal = (typeof CANALES)[number];
const SEDE_LABEL: Record<string, string> = { centro: "Centro", norte: "Norte", virtual: "Virtual" };
const SEDE_ADDR: Record<string, string> = { centro: "Cochabamba #694", norte: "Los Cusis #139", virtual: "Videollamada" };
const SEDE_ACCENT: Record<string, { tab: string; chip: string; dot: string; bar: string }> = {
  centro: {
    tab: "border-cyan-500 bg-cyan-500/15 text-cyan-200",
    chip: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
    dot: "bg-cyan-400",
    bar: "bg-cyan-400",
  },
  norte: {
    tab: "border-violet-500 bg-violet-500/15 text-violet-200",
    chip: "border-violet-500/40 bg-violet-500/10 text-violet-200",
    dot: "bg-violet-400",
    bar: "bg-violet-400",
  },
  virtual: {
    tab: "border-rose-500 bg-rose-500/15 text-rose-200",
    chip: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
  },
};
const ESTADOS = ["reservada", "confirmada", "asistio", "cancelada"];
const ESTADO_STYLE: Record<string, string> = {
  reservada: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  confirmada: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  asistio: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  cancelada: "bg-slate-600/20 text-slate-400 border-slate-500/40 line-through",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDaysKey = (key: string, n: number) => {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};
const weekdayOf = (key: string) => new Date(key + "T12:00:00").getDay();
const startOfWeekKey = (key: string) => {
  const d = new Date(key + "T12:00:00");
  const diff = (d.getDay() + 6) % 7; // lunes como inicio
  d.setDate(d.getDate() - diff);
  return toDateKey(d);
};
const timeOf = (c: Cita) => c.startAt.slice(11, 16);
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmtDayShort = (key: string) =>
  new Date(key + "T12:00:00").toLocaleDateString("es-BO", { day: "2-digit", month: "short" });

export default function CitasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const [tab, setTab] = useState("agenda");

  // ===== Agenda state =====
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") || today);
  const [sedeAgenda, setSedeAgenda] = useState<Canal>("centro");
  const [soloOcupados, setSoloOcupados] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState("todas");
  const [configHint, setConfigHint] = useState<string | null>(null);
  const [highlightCitaId, setHighlightCitaId] = useState<number | null>(
    searchParams.get("cita") ? parseInt(searchParams.get("cita") as string) : null,
  );

  // ===== Horarios state =====
  const [sede, setSede] = useState<Canal>("centro");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [morningOn, setMorningOn] = useState(true);
  const [morningStart, setMorningStart] = useState("08:00");
  const [morningEnd, setMorningEnd] = useState("12:00");
  const [afternoonOn, setAfternoonOn] = useState(true);
  const [afternoonStart, setAfternoonStart] = useState("14:00");
  const [afternoonEnd, setAfternoonEnd] = useState("18:00");
  const [horarioSheetOpen, setHorarioSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  // ===== Nueva cita dialog =====
  const [showNueva, setShowNueva] = useState(false);
  const [dlgContact, setDlgContact] = useState<ContactResult | null>(null);
  const [dlgQuery, setDlgQuery] = useState("");
  const [dlgDebounced, setDlgDebounced] = useState("");
  const [dlgSede, setDlgSede] = useState<Canal>("centro");
  const [dlgDate, setDlgDate] = useState(selectedDate);
  const [dlgNote, setDlgNote] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const date = searchParams.get("date");
    const cita = searchParams.get("cita");
    const sedeParam = searchParams.get("sede");
    if (date) setSelectedDate(date);
    if (sedeParam === "centro" || sedeParam === "norte" || sedeParam === "virtual") {
      setSedeAgenda(sedeParam);
      setSede(sedeParam);
      if (date) {
        setDays([weekdayOf(date)]);
        setConfigHint(date);
      }
      // Llegó desde "Configurar horario" en el chat: abrir la pestaña de horarios.
      setTab("horarios");
    }
    if (cita) {
      setHighlightCitaId(parseInt(cita));
      setTab("agenda");
    }
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDlgDebounced(dlgQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [dlgQuery]);

  // ===== Queries =====
  const { data: avail = [], isLoading: availLoading, refetch: refetchAvail } = useQuery<Availability[]>({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await fetch("/api/availabilities", { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: citasData, isLoading: citasLoading, refetch: refetchCitas } = useQuery<Cita[]>({
    queryKey: ["/api/citas", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/citas?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });
  const citas: Cita[] = Array.isArray(citasData) ? (citasData as Cita[]) : [];

  const { data: upcoming = [] } = useQuery<Cita[]>({
    queryKey: ["/api/citas", "upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/citas", { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: dlgCitasData } = useQuery<Cita[]>({
    queryKey: ["/api/citas", "dlg", dlgDate],
    queryFn: async () => {
      const res = await fetch(`/api/citas?date=${dlgDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    enabled: showNueva,
  });
  const dlgCitas: Cita[] = Array.isArray(dlgCitasData) ? (dlgCitasData as Cita[]) : [];

  const { data: contactResults = [], isFetching: searchingContacts } = useQuery<ContactResult[]>({
    queryKey: ["/api/conversations/search", dlgDebounced],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(dlgDebounced)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    enabled: showNueva,
  });

  // Capacidad (cupo COMPARTIDO por horario, todos los canales)
  const { data: aiSettings } = useQuery<{ citaCapacity: number | null }>({
    queryKey: ["/api/ai/settings"],
  });
  const [capShared, setCapShared] = useState(5);
  useEffect(() => {
    if (!aiSettings) return;
    setCapShared(aiSettings.citaCapacity ?? 5);
  }, [aiSettings]);
  const capDe = (_s?: string) => capShared;

  const saveCapacityMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/ai/settings", {
        citaCapacity: capShared,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "Capacidad guardada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ===== Derivados =====
  const timesFor = (weekday: number, s: string): string[] => {
    const set = new Set<string>();
    for (const a of avail) {
      if (a.sede !== s || a.weekday !== weekday || a.isActive === false) continue;
      const start = toMin(a.startTime);
      const end = toMin(a.endTime);
      for (let m = start; m + 60 <= end; m += 60) set.add(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    }
    return Array.from(set).sort();
  };

  const isLlamada = (c: Cita) => (c.kind ?? "cita") === "llamada";

  const agendaCitas = useMemo(
    () => citas.filter((c) => !isLlamada(c) && c.sede === sedeAgenda && (estadoFilter === "todas" || c.estado === estadoFilter)),
    [citas, sedeAgenda, estadoFilter],
  );
  const llamadasDia = useMemo(() => citas.filter((c) => isLlamada(c) && (estadoFilter === "todas" || c.estado === estadoFilter)), [citas, estadoFilter]);

  const byTime = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of agendaCitas) {
      const k = timeOf(c);
      const list = m.get(k) || [];
      list.push(c);
      m.set(k, list);
    }
    return m;
  }, [agendaCitas]);

  const agendaRows = useMemo(() => {
    const weekday = weekdayOf(selectedDate);
    const times = timesFor(weekday, sedeAgenda);
    const rows: Array<{ time: string; citas: Cita[]; capacidad: number; extras?: boolean }> = [];
    const seen = new Set<string>();
    for (const t of times) {
      seen.add(t);
      rows.push({ time: t, citas: byTime.get(t) || [], capacidad: capDe(sedeAgenda) });
    }
    for (const t of Array.from(byTime.keys()).sort()) {
      if (!seen.has(t)) rows.push({ time: t, citas: byTime.get(t) || [], capacidad: capDe(sedeAgenda), extras: true });
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, sedeAgenda, avail, byTime, capShared]);

  const llamadasRows = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of llamadasDia) {
      const k = timeOf(c);
      const list = m.get(k) || [];
      list.push(c);
      m.set(k, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [llamadasDia]);

  const dayCount = (key: string) => {
    const iso = key;
    return upcoming.filter((c) => c.startAt.slice(0, 10) === iso && c.estado !== "cancelada").length;
  };

  const weekStart = startOfWeekKey(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const accent = SEDE_ACCENT[sedeAgenda];
  const totalDelDia = agendaCitas.length + llamadasDia.length;

  // ===== Mutations =====
  const updateCita = useMutation({
    mutationFn: async ({ id, estado }: { id: number; estado: string }) => {
      const res = await fetch(`/api/citas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error("Error al actualizar cita");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/citas"] });
      toast({ title: "Cita actualizada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCita = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/citas/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/citas"] });
      toast({ title: "Cita eliminada" });
    },
  });

  const createCita = useMutation({
    mutationFn: async (payload: { conversationId: number; sede: string; date: string; time: string; note?: string }) => {
      const startAt = new Date(`${payload.date}T${payload.time}:00-04:00`).toISOString();
      const res = await fetch("/api/citas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: payload.conversationId, sede: payload.sede, startAt, note: payload.note }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al agendar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/citas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Cita agendada", description: "Se guardó en la agenda y se avisará al contacto." });
      closeNueva();
    },
    onError: (e: Error) => toast({ title: "No se pudo agendar", description: e.message, variant: "destructive" }),
  });

  const closeNueva = () => {
    setShowNueva(false);
    setDlgContact(null);
    setDlgQuery("");
    setDlgDebounced("");
    setDlgNote("");
  };

  const openNueva = (opts?: { sede?: Canal; date?: string; time?: string }) => {
    setDlgSede(opts?.sede || sedeAgenda);
    setDlgDate(opts?.date || selectedDate);
    setDlgNote(opts?.time ? "" : dlgNote);
    setShowNueva(true);
    setTimeout(() => searchInputRef.current?.focus(), 120);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (days.length === 0) throw new Error("Selecciona al menos un día");
      if (!morningOn && !afternoonOn) throw new Error("Activa al menos un turno");
      if (morningOn && morningStart >= morningEnd) throw new Error("Turno mañana: la hora de inicio debe ser menor");
      if (afternoonOn && afternoonStart >= afternoonEnd) throw new Error("Turno tarde: la hora de inicio debe ser menor");
      const existing = avail.filter((a) => a.sede === sede && days.includes(a.weekday));
      for (const a of existing) await apiRequest("DELETE", `/api/availabilities/${a.id}`);
      for (const wd of days) {
        if (morningOn) await apiRequest("POST", "/api/availabilities", { weekday: wd, startTime: morningStart, endTime: morningEnd, sede });
        if (afternoonOn) await apiRequest("POST", "/api/availabilities", { weekday: wd, startTime: afternoonStart, endTime: afternoonEnd, sede });
      }
      return { dias: days.length, turnos: days.length * ((morningOn ? 1 : 0) + (afternoonOn ? 1 : 0)) };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/availabilities"] });
      toast({ title: "Horario guardado", description: `${r.dias} día(s) · ${r.turnos} bloque(s) en ${SEDE_LABEL[sede]}` });
    },
    onError: (e: Error) => toast({ title: "Revisa los datos", description: e.message, variant: "destructive" }),
  });

  const clearDayMutation = useMutation({
    mutationFn: async () => {
      const existing = avail.filter((a) => a.sede === sede && days.includes(a.weekday));
      for (const a of existing) await apiRequest("DELETE", `/api/availabilities/${a.id}`);
      return existing.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["/api/availabilities"] });
      toast({ title: n > 0 ? `${n} bloque(s) quitado(s)` : "No había bloques en esos días" });
    },
  });

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const configureFromDate = (dateKey: string) => {
    setSede(sedeAgenda);
    setDays([weekdayOf(dateKey)]);
    setConfigHint(dateKey);
    setTab("horarios");
  };

  const groupedBySede = useMemo(() => {
    const map: Record<string, Map<number, Availability[]>> = { centro: new Map(), norte: new Map(), virtual: new Map() };
    for (const a of avail) {
      const byDay = map[a.sede] || (map[a.sede] = new Map());
      const list = byDay.get(a.weekday) || [];
      list.push(a);
      byDay.set(a.weekday, list);
    }
    return map;
  }, [avail]);

  useEffect(() => {
    if (!highlightCitaId || citas.length === 0) return;
    const el = document.getElementById(`cita-${highlightCitaId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightCitaId, citas]);

  // Slots del diálogo
  const dlgTimes = useMemo(() => {
    const weekday = weekdayOf(dlgDate);
    return timesFor(weekday, dlgSede);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlgDate, dlgSede, avail]);
  const dlgByTime = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of dlgCitas) {
      if (isLlamada(c) || c.sede !== dlgSede || c.estado === "cancelada") continue;
      const k = timeOf(c);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [dlgCitas, dlgSede]);
  const dlgCap = capDe(dlgSede);

  const renderCita = (c: Cita) => (
    <div
      key={c.id}
      id={`cita-${c.id}`}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-slate-800/50 px-2.5 py-1.5 transition-colors",
        highlightCitaId === c.id ? "border-emerald-500/70 ring-2 ring-emerald-500/40" : "border-slate-700/60 hover:border-slate-600",
      )}
      data-testid={`cita-${c.id}`}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.contactName || c.waId}</span>
      {c.note && <span className="hidden max-w-[120px] truncate text-[11px] text-slate-500 sm:inline">· {c.note}</span>}
      <span className={cn("hidden rounded-full border px-2 py-0.5 text-[10px] capitalize sm:inline-block", ESTADO_STYLE[c.estado] || ESTADO_STYLE.reservada)}>
        {c.estado}
      </span>
      <select
        value={c.estado}
        onChange={(e) => updateCita.mutate({ id: c.id, estado: e.target.value })}
        className="h-7 rounded-md border border-slate-600/60 bg-slate-900/70 px-1.5 text-[11px] capitalize text-slate-200"
        data-testid={`select-cita-estado-${c.id}`}
      >
        {ESTADOS.map((e) => (
          <option key={e} value={e} className="capitalize">{e}</option>
        ))}
      </select>
      <button
        onClick={() => deleteCita.mutate(c.id)}
        className="rounded p-1 text-red-400/70 hover:bg-red-500/10 hover:text-red-300"
        data-testid={`button-del-cita-${c.id}`}
        title="Eliminar cita"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const daysLabel =
    days.length === 0
      ? "Ningún día"
      : days.length === 7
        ? "Todos los días"
        : [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => WEEKDAYS_SHORT[d]).join(" · ");
  const turnosLabel =
    [morningOn ? `Mañana ${morningStart}–${morningEnd}` : null, afternoonOn ? `Tarde ${afternoonStart}–${afternoonEnd}` : null]
      .filter(Boolean)
      .join(" · ") || "Sin turnos";

  const horarioEditor = (
    <>
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-slate-400">Canal</Label>
        <div className="grid grid-cols-3 gap-2">
          {CANALES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSede(s)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all active:scale-[0.97]",
                sede === s ? SEDE_ACCENT[s].tab : "border-slate-600/50 bg-slate-800/50 text-slate-300 hover:border-slate-500",
              )}
              data-testid={`button-sede-${s}`}
            >
              <MapPin className={cn("h-4 w-4", sede === s ? "" : "text-slate-500")} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{SEDE_LABEL[s]}</span>
                <span className="block truncate text-[11px] opacity-70">{SEDE_ADDR[s]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs text-slate-400">Días</Label>
          <div className="flex flex-wrap justify-end gap-1.5">
            <button onClick={() => setDays([1, 2, 3, 4, 5])} className="rounded-full border border-slate-600/50 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 transition-transform active:scale-95 hover:border-emerald-500/50">Lun–Vie</button>
            <button onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="rounded-full border border-slate-600/50 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 transition-transform active:scale-95 hover:border-emerald-500/50">Todos</button>
            <button onClick={() => setDays([])} className="rounded-full border border-slate-600/50 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 transition-transform active:scale-95 hover:border-red-500/50">Ninguno</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-xl border-2 text-xs font-semibold transition-all active:scale-95",
                  on ? "border-emerald-500 bg-emerald-500/20 text-white" : "border-slate-600/50 bg-slate-800/50 text-slate-400",
                )}
                data-testid={`day-${d}`}
              >
                {WEEKDAYS_SHORT[d]}
                {on && <Check className="mt-0.5 h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className={cn("rounded-xl border p-3 transition-all", morningOn ? "border-amber-500/50 bg-amber-500/10" : "border-slate-600/50 bg-slate-800/40")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className={cn("h-4 w-4", morningOn ? "text-amber-400" : "text-slate-500")} />
              <span className="text-sm font-medium">Turno mañana</span>
            </div>
            <Switch checked={morningOn} onCheckedChange={setMorningOn} />
          </div>
          {morningOn && (
            <div className="mt-3 flex items-center gap-2">
              <Input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} className="min-w-0 flex-1 bg-slate-900/60 border-slate-600/60 text-white" />
              <span className="shrink-0 text-slate-500">–</span>
              <Input type="time" value={morningEnd} onChange={(e) => setMorningEnd(e.target.value)} className="min-w-0 flex-1 bg-slate-900/60 border-slate-600/60 text-white" />
            </div>
          )}
        </div>

        <div className={cn("rounded-xl border p-3 transition-all", afternoonOn ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-600/50 bg-slate-800/40")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className={cn("h-4 w-4", afternoonOn ? "text-indigo-300" : "text-slate-500")} />
              <span className="text-sm font-medium">Turno tarde</span>
            </div>
            <Switch checked={afternoonOn} onCheckedChange={setAfternoonOn} />
          </div>
          {afternoonOn && (
            <div className="mt-3 flex items-center gap-2">
              <Input type="time" value={afternoonStart} onChange={(e) => setAfternoonStart(e.target.value)} className="min-w-0 flex-1 bg-slate-900/60 border-slate-600/60 text-white" />
              <span className="shrink-0 text-slate-500">–</span>
              <Input type="time" value={afternoonEnd} onChange={(e) => setAfternoonEnd(e.target.value)} className="min-w-0 flex-1 bg-slate-900/60 border-slate-600/60 text-white" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          onClick={() => saveMutation.mutate(undefined, { onSuccess: () => setHorarioSheetOpen(false) })}
          disabled={saveMutation.isPending}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white transition-transform active:scale-[0.98]"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Guardar horario
        </Button>
        <Button variant="outline" onClick={() => clearDayMutation.mutate()} disabled={clearDayMutation.isPending} className="border-slate-600 bg-slate-800/60 text-slate-200 transition-transform active:scale-95">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Reemplaza el horario de {SEDE_LABEL[sede]} en los días elegidos. Se crean citas de 1 hora.</p>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-28 text-slate-100 lg:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-800/70" data-testid="button-back-citas">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
              <CalendarPlus className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold leading-tight">Citas e horarios</h1>
              <p className="text-xs text-slate-400">Diagnóstico gratuito · 1 hora</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openNueva()}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
              data-testid="button-nueva-cita"
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Nueva cita
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:bg-slate-800/70"
              onClick={() => { refetchAvail(); refetchCitas(); }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/60">
            <TabsTrigger value="agenda" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <CalendarRange className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="horarios" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <Clock className="h-4 w-4" /> Horarios
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <Settings2 className="h-4 w-4" /> Config
            </TabsTrigger>
          </TabsList>

          {/* ================= AGENDA ================= */}
          <TabsContent value="agenda" className="space-y-4">
            {/* Navegación de semana */}
            <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 shadow-xl backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => setSelectedDate(addDaysKey(selectedDate, -7))}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  data-testid="button-prev-week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(today)}
                  className="text-sm font-semibold capitalize text-slate-200"
                  data-testid="button-today"
                >
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-BO", { month: "long", year: "numeric" })}
                </button>
                <button
                  onClick={() => setSelectedDate(addDaysKey(selectedDate, 7))}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  data-testid="button-next-week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((key) => {
                  const active = key === selectedDate;
                  const isToday = key === today;
                  const count = dayCount(key);
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(key)}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl border py-2 transition-all",
                        active ? "border-emerald-500 bg-emerald-500/20 text-white" : "border-transparent bg-slate-800/40 text-slate-300 hover:bg-slate-800",
                      )}
                      data-testid={`day-${key}`}
                    >
                      <span className="text-[10px] uppercase opacity-70">{WEEKDAYS_SHORT[weekdayOf(key)]}</span>
                      <span className={cn("text-sm font-bold", isToday && !active && "text-emerald-400")}>{key.slice(8, 10)}</span>
                      {count > 0 && (
                        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-slate-950">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Controles */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-xl border border-slate-700/60">
                {CANALES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSedeAgenda(s)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                      sedeAgenda === s ? SEDE_ACCENT[s].tab : "bg-slate-800/40 text-slate-400 hover:text-slate-200",
                    )}
                    data-testid={`agenda-sede-${s}`}
                  >
                    <span className={cn("h-2 w-2 rounded-full", SEDE_ACCENT[s].dot)} />
                    {SEDE_LABEL[s]}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSoloOcupados((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  soloOcupados ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-slate-700/60 bg-slate-800/40 text-slate-400",
                )}
                data-testid="toggle-solo-ocupados"
              >
                {soloOcupados ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {soloOcupados ? "Solo con citas" : "Ver horarios libres"}
              </button>

              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="h-8 rounded-xl border border-slate-700/60 bg-slate-800/40 px-2 text-xs capitalize text-slate-300"
                data-testid="filter-estado"
              >
                {["todas", ...ESTADOS].map((e) => (
                  <option key={e} value={e} className="capitalize">{e === "todas" ? "Todos los estados" : e}</option>
                ))}
              </select>

              <span className="ml-auto text-xs text-slate-500">{totalDelDia} cita(s) · {fmtDayShort(selectedDate)}</span>
            </div>

            {/* Lista de agenda */}
            <section className="space-y-2">
              {citasLoading || availLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (
                <>
                  {agendaRows.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700/60 py-10 text-center">
                      <CalendarPlus className="mx-auto mb-2 h-9 w-9 text-slate-600" />
                      <p className="text-sm text-slate-400">Sin horarios configurados este día.</p>
                      <Button variant="outline" size="sm" className="mt-3 border-slate-600 bg-slate-800/60" onClick={() => configureFromDate(selectedDate)}>
                        Configurar {WEEKDAYS_SHORT[weekdayOf(selectedDate)]} en Horarios
                      </Button>
                    </div>
                  )}

                  {agendaRows.map((row) => {
                    const ocupados = row.citas.length;
                    const pct = Math.min(100, Math.round((ocupados / Math.max(1, row.capacidad)) * 100));
                    const lleno = ocupados >= row.capacidad;
                    if (soloOcupados && ocupados === 0 && !row.extras) return null;
                    return (
                      <div
                        key={row.time}
                        className={cn(
                          "flex gap-3 rounded-2xl border bg-slate-900/60 p-2.5 shadow-sm",
                          ocupados > 0 ? "border-slate-700/60" : "border-slate-800/60",
                        )}
                        data-testid={`slot-${row.time}`}
                      >
                        {/* Hora */}
                        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-800/60 py-1">
                          <span className={cn("text-base font-bold tabular-nums", ocupados > 0 ? "text-white" : "text-slate-400")}>{row.time}</span>
                          <span className={cn("text-[10px] font-medium tabular-nums", lleno ? "text-red-400" : ocupados > 0 ? "text-emerald-400" : "text-slate-500")}>
                            {ocupados}/{row.capacidad}
                          </span>
                        </div>

                        {/* Contenido */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                            <div className={cn("h-full rounded-full", lleno ? "bg-red-500/70" : accent.bar)} style={{ width: `${pct}%` }} />
                          </div>
                          {ocupados === 0 ? (
                            <button
                              onClick={() => openNueva({ sede: sedeAgenda, date: selectedDate })}
                              className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-700/60 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" /> Libre · agendar aquí
                            </button>
                          ) : (
                            <>
                              {row.citas.map(renderCita)}
                              {!lleno && (
                                <button
                                  onClick={() => openNueva({ sede: sedeAgenda, date: selectedDate })}
                                  className="flex items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-emerald-300"
                                >
                                  <CalendarPlus className="h-3 w-3" /> Agregar otra ({row.capacidad - ocupados} libre{(row.capacidad - ocupados) > 1 ? "s" : ""})
                                </button>
                              )}
                            </>
                          )}
                          {row.extras && <p className="text-[10px] text-amber-400/80">Fuera del horario configurado</p>}
                        </div>
                      </div>
                    );
                  })}

                  {/* Llamadas */}
                  {llamadasRows.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold">Llamadas del día</h3>
                        <span className="h-px flex-1 bg-slate-700/60" />
                        <span className="text-xs text-slate-500">{llamadasDia.length}</span>
                      </div>
                      <div className="space-y-2">
                        {llamadasRows.map(([time, list]) => (
                          <div key={time} className="flex gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-2.5">
                            <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-800/60 py-1">
                              <span className="text-base font-bold tabular-nums">{time}</span>
                              <span className="text-[10px] text-emerald-400">{list.length}/{capShared}</span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              {list.map(renderCita)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {agendaRows.length > 0 && agendaCitas.length === 0 && llamadasRows.length === 0 && soloOcupados && (
                    <div className="rounded-2xl border border-dashed border-slate-700/60 py-8 text-center text-sm text-slate-500">
                      No hay citas para {SEDE_LABEL[sedeAgenda]} este día.
                    </div>
                  )}
                </>
              )}
            </section>
          </TabsContent>

          {/* ================= HORARIOS ================= */}
          <TabsContent value="horarios" className="space-y-4">
            {configHint && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                <CalendarRange className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="min-w-0">
                  Configurando <strong>{WEEKDAYS_SHORT[weekdayOf(configHint)]} {fmtDayShort(configHint)}</strong> · {SEDE_LABEL[sede]}
                  <span className="ml-1 text-emerald-300/70">(día ya marcado abajo)</span>
                </span>
                <button onClick={() => setConfigHint(null)} className="ml-auto shrink-0 rounded p-1 text-emerald-300/70 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
              {isMobile ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold">Horario</h2>
                    <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", SEDE_ACCENT[sede].chip)}>
                      <MapPin className="h-3 w-3" />
                      {SEDE_LABEL[sede]}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-xs text-slate-500">Días</dt>
                      <dd className="min-w-0 text-slate-200">{daysLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-xs text-slate-500">Turnos</dt>
                      <dd className="min-w-0 text-slate-200 tabular-nums">{turnosLabel}</dd>
                    </div>
                  </dl>
                  <Button
                    onClick={() => setHorarioSheetOpen(true)}
                    className="mt-3 w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white transition-transform active:scale-[0.98]"
                    data-testid="button-editar-horario"
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Editar horario
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold">Configurar horario</h2>
                  </div>
                  {horarioEditor}
                </>
              )}
            </section>

            {/* Resumen semanal */}
            <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold">Mi semana</h2>
              </div>
              {availLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-3">
                  {CANALES.map((s) => {
                    const byDay = groupedBySede[s] || new Map();
                    const total = Array.from(byDay.values()).reduce((acc, l) => acc + l.length, 0);
                    return (
                      <div key={s} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", SEDE_ACCENT[s].dot)} />
                          <span className="text-sm font-semibold">{SEDE_LABEL[s]}</span>
                          <span className="ml-auto text-xs text-slate-500">{total} bloque(s)</span>
                        </div>
                        {total === 0 ? (
                          <p className="text-xs text-slate-600">Sin horarios cargados.</p>
                        ) : (
                          <div className="space-y-1">
                            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                              const list = (byDay.get(wd) || []).slice().sort((x, y) => x.startTime.localeCompare(y.startTime));
                              if (list.length === 0) return null;
                              return (
                                <div key={wd} className="flex items-start gap-2">
                                  <span className="w-10 shrink-0 pt-1 text-[11px] font-semibold text-slate-400">{WEEKDAYS_SHORT[wd]}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {list.map((a) => (
                                      <span key={a.id} className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] tabular-nums", SEDE_ACCENT[s].chip)}>
                                        {a.startTime}–{a.endTime}
                                        <button
                                          onClick={() => apiRequest("DELETE", `/api/availabilities/${a.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/availabilities"] }))}
                                          className="ml-0.5 opacity-50 hover:opacity-100"
                                        >
                                          <Trash2 className="h-2.5 w-2.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </TabsContent>

          {/* ================= CONFIG ================= */}
          <TabsContent value="config" className="space-y-4">
            <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold">Cupo por horario (compartido)</h2>
              </div>
              <div className="max-w-[220px] space-y-1">
                <Label className="text-xs text-slate-400">Cupo por horario (todos los canales)</Label>
                <Input type="number" min={1} max={200} value={capShared} onChange={(e) => setCapShared(parseInt(e.target.value) || 1)} className="bg-slate-800/50 border-slate-600/50 text-white" data-testid="input-cap-shared" />
              </div>
              <Button onClick={() => saveCapacityMutation.mutate()} disabled={saveCapacityMutation.isPending} className="mt-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white" data-testid="button-save-capacity">
                {saveCapacityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Guardar capacidad
              </Button>
              <p className="mt-2 text-xs text-slate-500">Cuenta por <strong>mismo horario</strong>: Centro, Norte y Virtual <strong>comparten</strong> el cupo (mismo asesor). Ej: con 5, puedes tener 3 presenciales + 2 virtuales a la misma hora.</p>
            </section>

            <Link href="/reminders">
              <Button variant="outline" className="w-full border-slate-600 bg-slate-800/40 text-slate-200">
                <Clock className="mr-2 h-4 w-4" /> Ver recordatorios
              </Button>
            </Link>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom sheet: editar horario (mobile) */}
      <Sheet open={horarioSheetOpen} onOpenChange={setHorarioSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto rounded-t-3xl border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-100"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700 lg:hidden" />
          <SheetTitle className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-amber-400" /> Configurar horario
          </SheetTitle>
          {horarioEditor}
        </SheetContent>
      </Sheet>

      {/* ================= Diálogo Nueva cita ================= */}
      <Dialog open={showNueva} onOpenChange={(o) => (o ? setShowNueva(true) : closeNueva())}>
        <DialogContent className="max-w-md border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-emerald-500" /> Nueva cita
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contacto */}
            {dlgContact ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5">
                <User className="h-4 w-4 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{dlgContact.contactName || `+${dlgContact.waId}`}</p>
                  <p className="truncate text-[11px] text-slate-400">+{dlgContact.waId}</p>
                </div>
                <button onClick={() => setDlgContact(null)} className="rounded p-1 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    ref={searchInputRef}
                    value={dlgQuery}
                    onChange={(e) => setDlgQuery(e.target.value)}
                    placeholder="Buscar por nombre o WhatsApp…"
                    className="border-slate-600/60 bg-slate-800/50 pl-9 text-white"
                    data-testid="input-buscar-contacto"
                  />
                  {searchingContacts && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />}
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {contactResults.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-500">
                      {dlgQuery ? "Sin resultados." : "Escribe para buscar un contacto."}
                    </p>
                  ) : (
                    contactResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setDlgContact(c)}
                        className="flex w-full items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-2.5 py-1.5 text-left hover:border-emerald-500/40 hover:bg-slate-800"
                        data-testid={`contact-${c.id}`}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[11px] font-semibold">
                          {(c.contactName || c.waId).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{c.contactName || `+${c.waId}`}</p>
                          <p className="truncate text-[11px] text-slate-500">+{c.waId}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Sede + fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Canal</label>
                <select value={dlgSede} onChange={(e) => setDlgSede(e.target.value as Canal)} className="h-10 w-full rounded-lg border border-slate-600/60 bg-slate-800/50 px-3 text-sm text-white" data-testid="select-dlg-sede">
                  <option value="centro">Centro</option>
                  <option value="norte">Norte</option>
                  <option value="virtual">Virtual</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Fecha</label>
                <Input type="date" value={dlgDate} onChange={(e) => setDlgDate(e.target.value)} className="h-10 border-slate-600/60 bg-slate-800/50 text-white" data-testid="input-dlg-date" />
              </div>
            </div>

            {/* Horarios */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-400">Elige un horario</p>
              {dlgTimes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-700/60 p-3 text-center text-xs text-slate-500">
                  No hay horarios configurados para {SEDE_LABEL[dlgSede]} ese día.
                </p>
              ) : (
                <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {dlgTimes.map((t) => {
                    const ocupados = dlgByTime.get(t) || 0;
                    const lleno = ocupados >= dlgCap;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={lleno || createCita.isPending || !dlgContact}
                        onClick={() => dlgContact && createCita.mutate({ conversationId: dlgContact.id, sede: dlgSede, date: dlgDate, time: t, note: dlgNote })}
                        className={cn(
                          "flex flex-col items-center rounded-xl border px-2 py-1.5 text-center transition-all",
                          lleno
                            ? "cursor-not-allowed border-slate-700/50 bg-slate-800/30 text-slate-600"
                            : "border-emerald-400/50 bg-emerald-500/10 text-white hover:bg-emerald-500/20 active:scale-[0.97] disabled:opacity-40",
                        )}
                        data-testid={`dlg-slot-${t}`}
                      >
                        <span className="text-sm font-semibold tabular-nums">{t}</span>
                        <span className={cn("text-[10px]", lleno ? "text-red-400/80" : "text-emerald-300/80")}>
                          {lleno ? "Lleno" : `${dlgCap - ocupados} libre${dlgCap - ocupados > 1 ? "s" : ""}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!dlgContact && <p className="text-[11px] text-amber-400/80">Primero elige un contacto.</p>}
            </div>

            {/* Nota */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Nota (opcional)</label>
              <Input value={dlgNote} onChange={(e) => setDlgNote(e.target.value)} maxLength={300} placeholder="Ej. interesado en modalidad virtual" className="border-slate-600/60 bg-slate-800/50 text-white" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
