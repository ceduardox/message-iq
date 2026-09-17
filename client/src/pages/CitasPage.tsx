import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  sede: string;
  startAt: string;
  endAt: string;
  estado: string;
  note: string | null;
  contactName: string | null;
  waId: string | null;
}

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SEDE_LABEL: Record<string, string> = { centro: "Centro", norte: "Norte" };
const SEDE_ADDR: Record<string, string> = { centro: "Cochabamba #694", norte: "Los Cusis #139" };
const SEDE_ACCENT: Record<string, { tab: string; chip: string; dot: string }> = {
  centro: {
    tab: "border-cyan-500 bg-cyan-500/15 text-cyan-200",
    chip: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
    dot: "bg-cyan-400",
  },
  norte: {
    tab: "border-violet-500 bg-violet-500/15 text-violet-200",
    chip: "border-violet-500/40 bg-violet-500/10 text-violet-200",
    dot: "bg-violet-400",
  },
};
const ESTADOS = ["reservada", "confirmada", "asistio", "cancelada"];
const ESTADO_STYLE: Record<string, string> = {
  reservada: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  confirmada: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  asistio: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  cancelada: "bg-slate-600/20 text-slate-400 border-slate-500/40 line-through",
};

export default function CitasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Availability form (range-based, mobile first)
  const [sede, setSede] = useState("centro");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [morningOn, setMorningOn] = useState(true);
  const [morningStart, setMorningStart] = useState("08:00");
  const [morningEnd, setMorningEnd] = useState("12:00");
  const [afternoonOn, setAfternoonOn] = useState(true);
  const [afternoonStart, setAfternoonStart] = useState("14:00");
  const [afternoonEnd, setAfternoonEnd] = useState("18:00");

  // Citas filters (supports deep-link: /citas?date=YYYY-MM-DD&cita=<id>)
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const [filterDate, setFilterDate] = useState(searchParams.get("date") || "");
  const [estadoFilter, setEstadoFilter] = useState("todas");
  const [highlightCitaId, setHighlightCitaId] = useState<number | null>(
    searchParams.get("cita") ? parseInt(searchParams.get("cita") as string) : null,
  );

  useEffect(() => {
    const date = searchParams.get("date");
    const cita = searchParams.get("cita");
    if (date) setFilterDate(date);
    if (cita) setHighlightCitaId(parseInt(cita));
  }, [searchParams]);

  const { data: avail = [], isLoading: availLoading, refetch: refetchAvail } = useQuery<Availability[]>({
    queryKey: ["/api/availabilities"],
    queryFn: async () => {
      const res = await fetch("/api/availabilities", { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const { data: citasData, isLoading: citasLoading, refetch: refetchCitas } = useQuery<Cita[]>({
    queryKey: ["/api/citas", filterDate],
    queryFn: async () => {
      const qs = filterDate ? `?date=${filterDate}` : "";
      const res = await fetch(`/api/citas${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });
  const citas: Cita[] = Array.isArray(citasData) ? (citasData as Cita[]) : [];

  const groupedBySede = useMemo(() => {
    const map: Record<string, Map<number, Availability[]>> = { centro: new Map(), norte: new Map() };
    for (const a of avail) {
      const byDay = map[a.sede] || (map[a.sede] = new Map());
      const list = byDay.get(a.weekday) || [];
      list.push(a);
      byDay.set(a.weekday, list);
    }
    return map;
  }, [avail]);

  const filteredCitas = useMemo(
    () => (estadoFilter === "todas" ? citas : citas.filter((c) => c.estado === estadoFilter)),
    [citas, estadoFilter],
  );

  const groupedCitas = useMemo(() => {
    const map = new Map<string, Cita[]>();
    for (const c of filteredCitas) {
      const key = new Date(c.startAt).toLocaleDateString("es-BO", { weekday: "long", day: "2-digit", month: "long" });
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [filteredCitas]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const upcomingCount = days.length * ((morningOn ? 1 : 0) + (afternoonOn ? 1 : 0));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (days.length === 0) throw new Error("Selecciona al menos un día");
      if (!morningOn && !afternoonOn) throw new Error("Activa al menos un turno");
      if (morningOn && morningStart >= morningEnd) throw new Error("Turno mañana: la hora de inicio debe ser menor");
      if (afternoonOn && afternoonStart >= afternoonEnd) throw new Error("Turno tarde: la hora de inicio debe ser menor");

      // Replace availability for the selected weekdays + sede (predictable editing).
      const existing = avail.filter((a) => a.sede === sede && days.includes(a.weekday));
      for (const a of existing) {
        await apiRequest("DELETE", `/api/availabilities/${a.id}`);
      }
      for (const wd of days) {
        if (morningOn) {
          await apiRequest("POST", "/api/availabilities", { weekday: wd, startTime: morningStart, endTime: morningEnd, sede });
        }
        if (afternoonOn) {
          await apiRequest("POST", "/api/availabilities", { weekday: wd, startTime: afternoonStart, endTime: afternoonEnd, sede });
        }
      }
      return { dias: days.length, turnos: upcomingCount };
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
      for (const a of existing) {
        await apiRequest("DELETE", `/api/availabilities/${a.id}`);
      }
      return existing.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["/api/availabilities"] });
      toast({ title: n > 0 ? `${n} bloque(s) quitado(s)` : "No había bloques en esos días" });
    },
  });

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

  const todayKey = new Date().toDateString();
  const accent = SEDE_ACCENT[sede] || SEDE_ACCENT.centro;

  useEffect(() => {
    if (!highlightCitaId || filteredCitas.length === 0) return;
    const el = document.getElementById(`cita-${highlightCitaId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightCitaId, filteredCitas]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-28 text-slate-100 lg:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-xl">
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
            <div>
              <h1 className="text-base font-bold leading-tight">Mis horarios y citas</h1>
              <p className="text-xs text-slate-400">Diagnóstico gratuito · 1 hora</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/reminders">
              <Button variant="outline" size="sm" className="border-slate-600 bg-slate-900/40 text-slate-100">Recordatorios</Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-800/70" onClick={() => { refetchAvail(); refetchCitas(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        {/* ===== Configurar horario ===== */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Configurar horario</h2>
          </div>

          {/* Sede */}
          <div className="mb-4">
            <Label className="mb-2 block text-xs text-slate-400">Sede</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["centro", "norte"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSede(s)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all",
                    sede === s ? SEDE_ACCENT[s].tab : "border-slate-600/50 bg-slate-800/50 text-slate-300 hover:border-slate-500",
                  )}
                  data-testid={`button-sede-${s}`}
                >
                  <MapPin className={cn("h-4 w-4", sede === s ? "" : "text-slate-500")} />
                  <span>
                    <span className="block text-sm font-semibold">{SEDE_LABEL[s]}</span>
                    <span className="block text-[11px] opacity-70">{SEDE_ADDR[s]}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Días */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs text-slate-400">Días</Label>
              <div className="flex gap-1.5">
                <button onClick={() => setDays([1, 2, 3, 4, 5])} className="rounded-full border border-slate-600/50 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50" data-testid="shortcut-lv">Lun–Vie</button>
                <button onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="rounded-full border border-slate-600/50 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50" data-testid="shortcut-all">Todos</button>
                <button onClick={() => setDays([])} className="rounded-full border border-slate-600/50 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 hover:border-red-500/50" data-testid="shortcut-none">Ninguno</button>
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
                      "flex h-12 flex-col items-center justify-center rounded-xl border-2 text-xs font-semibold transition-all",
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

          {/* Turnos */}
          <div className="space-y-3">
            <div className={cn("rounded-xl border p-3 transition-all", morningOn ? "border-amber-500/50 bg-amber-500/10" : "border-slate-600/50 bg-slate-800/40")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className={cn("h-4 w-4", morningOn ? "text-amber-400" : "text-slate-500")} />
                  <span className="text-sm font-medium">Turno mañana</span>
                </div>
                <Switch checked={morningOn} onCheckedChange={setMorningOn} data-testid="switch-morning" />
              </div>
              {morningOn && (
                <div className="mt-3 flex items-center gap-2">
                  <Input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} className="flex-1 bg-slate-900/60 border-slate-600/60 text-white" data-testid="input-morning-start" />
                  <span className="text-slate-500">–</span>
                  <Input type="time" value={morningEnd} onChange={(e) => setMorningEnd(e.target.value)} className="flex-1 bg-slate-900/60 border-slate-600/60 text-white" data-testid="input-morning-end" />
                </div>
              )}
            </div>

            <div className={cn("rounded-xl border p-3 transition-all", afternoonOn ? "border-indigo-500/50 bg-indigo-500/10" : "border-slate-600/50 bg-slate-800/40")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className={cn("h-4 w-4", afternoonOn ? "text-indigo-300" : "text-slate-500")} />
                  <span className="text-sm font-medium">Turno tarde</span>
                </div>
                <Switch checked={afternoonOn} onCheckedChange={setAfternoonOn} data-testid="switch-afternoon" />
              </div>
              {afternoonOn && (
                <div className="mt-3 flex items-center gap-2">
                  <Input type="time" value={afternoonStart} onChange={(e) => setAfternoonStart(e.target.value)} className="flex-1 bg-slate-900/60 border-slate-600/60 text-white" data-testid="input-afternoon-start" />
                  <span className="text-slate-500">–</span>
                  <Input type="time" value={afternoonEnd} onChange={(e) => setAfternoonEnd(e.target.value)} className="flex-1 bg-slate-900/60 border-slate-600/60 text-white" data-testid="input-afternoon-end" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white" data-testid="button-save-schedule">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Guardar horario
            </Button>
            <Button variant="outline" onClick={() => clearDayMutation.mutate()} disabled={clearDayMutation.isPending} className="border-slate-600 bg-slate-800/60 text-slate-200" data-testid="button-clear-days">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Reemplaza el horario de {SEDE_LABEL[sede]} en los días elegidos. Se crean citas de 1 hora.</p>
        </section>

        {/* ===== Resumen semanal ===== */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Mi semana</h2>
          </div>
          {availLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-3">
              {(["centro", "norte"] as const).map((s) => {
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
                                  <span key={a.id} className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] tabular-nums", SEDE_ACCENT[s].chip)} data-testid={`avail-${a.id}`}>
                                    {a.startTime}–{a.endTime}
                                    <button onClick={() => apiRequest("DELETE", `/api/availabilities/${a.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/availabilities"] }))} className="ml-0.5 opacity-50 hover:opacity-100" data-testid={`button-del-avail-${a.id}`}>
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

        {/* ===== Citas ===== */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold">{filterDate ? "Citas del día" : "Próximas citas"}</h2>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-9 w-auto border-slate-600/60 bg-slate-800/60 text-slate-100" data-testid="input-citas-date" />
            {filterDate && (
              <Button variant="outline" size="sm" onClick={() => setFilterDate("")} className="border-slate-600 bg-slate-800/60 text-slate-200" data-testid="button-citas-ver-proximas">
                Ver próximas
              </Button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {["todas", ...ESTADOS].map((e) => (
              <button key={e} onClick={() => setEstadoFilter(e)} className={cn("rounded-full border px-3 py-1 text-xs capitalize transition-all", estadoFilter === e ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200" : "border-slate-600/50 bg-slate-800/40 text-slate-400 hover:text-slate-200")} data-testid={`filter-estado-${e}`}>
                {e}
              </button>
            ))}
          </div>

          {citasLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filteredCitas.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarPlus className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">Sin citas {filterDate ? "este día" : "próximas"}.</p>
              <p className="text-xs text-slate-600">Se agendan solas cuando Lexi confirma un horario.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedCitas.entries()).map(([dayLabel, list]) => {
                const isToday = new Date(list[0].startAt).toDateString() === todayKey;
                return (
                  <div key={dayLabel}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", isToday ? "text-emerald-400" : "text-slate-400")}>{isToday ? "Hoy" : dayLabel}</span>
                      <span className="h-px flex-1 bg-slate-700/60" />
                      <span className="text-xs text-slate-500">{list.length} cita{list.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="space-y-2">
                      {list.map((c) => (
                        <div
                          key={c.id}
                          id={`cita-${c.id}`}
                          className={cn(
                            "flex flex-wrap items-center gap-3 rounded-xl border bg-slate-800/40 p-3 transition-colors hover:border-slate-600",
                            highlightCitaId === c.id ? "border-emerald-500/70 ring-2 ring-emerald-500/40" : "border-slate-700/60",
                          )}
                          data-testid={`cita-${c.id}`}
                        >
                          <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-900/70 text-center">
                            <span className="text-sm font-bold leading-none">{new Date(c.startAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                            <span className="text-[10px] text-slate-500">1 hora</span>
                          </div>
                          <div className="min-w-[140px] flex-1">
                            <p className="truncate text-sm font-medium">{c.contactName || c.waId}</p>
                            <p className="flex items-center gap-1 text-xs text-slate-400">
                              <MapPin className="h-3 w-3" /> {SEDE_LABEL[c.sede] || c.sede}
                              {c.note && <span className="ml-1 truncate text-slate-500">· {c.note}</span>}
                            </p>
                          </div>
                          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs capitalize", ESTADO_STYLE[c.estado] || ESTADO_STYLE.reservada)}>{c.estado}</span>
                          <select value={c.estado} onChange={(e) => updateCita.mutate({ id: c.id, estado: e.target.value })} className="h-8 rounded-lg border border-slate-600/60 bg-slate-900/70 px-2 text-xs capitalize text-slate-200" data-testid={`select-cita-estado-${c.id}`}>
                            {ESTADOS.map((e) => <option key={e} value={e} className="capitalize">{e}</option>)}
                          </select>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-500/10" onClick={() => deleteCita.mutate(c.id)} data-testid={`button-del-cita-${c.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Sticky save bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-700/60 bg-slate-900/95 p-3 backdrop-blur-xl lg:hidden">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white" data-testid="button-save-sticky">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Guardar horario · {SEDE_LABEL[sede]} · {upcomingCount} bloque(s)
        </Button>
      </div>
    </div>
  );
}
