import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Eye,
  EyeOff,
  Pencil,
  Save,
  X,
  Zap,
  Bot,
  BotOff,
  MessageSquare,
  Clock,
  TrendingUp,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Agent } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

interface AgentWithStats extends Agent {
  assignedConversations?: number;
  inboundMessages?: number;
  inboundChats?: number;
  newLeads?: number;
  shouldCallCount?: number;
  lastActivityAt?: string | null;
}

interface AgentAiColumnStatus {
  exists: boolean;
}

interface AdRoutingRule {
  id: number;
  adId: string;
  agentIds: number[];
  isActive: boolean;
  updatedAt?: string | null;
}

interface DailyCostSetting {
  date: string;
  unitCostBs: number;
  officialRateBs: number;
  parallelRateBs: number;
  updatedAt?: string | null;
}

interface AnalyticsViewPermission {
  viewerAgentId: number;
  visibleAgentIds: number[];
  updatedAt?: string | null;
}

const glowAnimation = `
@keyframes glow-line {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.animate-glow-line { 
  background: linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent);
  background-size: 200% 100%;
  animation: glow-line 3s ease-in-out infinite;
}
`;

function parsePositiveNumber(value: string, fallback = 0): number {
  const normalized = String(value || "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatBs(value: number): string {
  return `${value.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs`;
}

function formatUsd(value: number): string {
  return `USD ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [weight, setWeight] = useState(1);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [routingAdId, setRoutingAdId] = useState("");
  const [routingIsActive, setRoutingIsActive] = useState(true);
  const [routingAgentIds, setRoutingAgentIds] = useState<number[]>([]);
  const [costDate, setCostDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [costPerInboundChatBs, setCostPerInboundChatBs] = useState("");
  const [officialRateBs, setOfficialRateBs] = useState("");
  const [parallelRateBs, setParallelRateBs] = useState("");
  const [analyticsPermissionsDraft, setAnalyticsPermissionsDraft] = useState<Record<number, number[]>>({});
  const [activeSection, setActiveSection] = useState<"resumen" | "agentes" | "costos" | "anuncios" | "permisos">("resumen");
  const [agentDetailId, setAgentDetailId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: agents = [], isLoading } = useQuery<AgentWithStats[]>({
    queryKey: ["/api/agents", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const suffix = params.toString();
      const res = await fetch(`/api/agents${suffix ? `?${suffix}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudo cargar la lista de agentes");
      return res.json();
    },
  });

  const { data: agentAiColumnStatus } = useQuery<AgentAiColumnStatus>({
    queryKey: ["/api/agents/ai-column-status"],
    queryFn: async () => {
      const res = await fetch("/api/agents/ai-column-status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudo verificar la columna de IA por agente");
      return res.json();
    },
  });

  const { data: adRoutingRules = [] } = useQuery<AdRoutingRule[]>({
    queryKey: ["/api/ad-routing-rules"],
    queryFn: async () => {
      const res = await fetch("/api/ad-routing-rules", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudo cargar reglas por anuncio");
      return res.json();
    },
  });

  const { data: analyticsViewPermissions = [] } = useQuery<AnalyticsViewPermission[]>({
    queryKey: ["/api/analytics-view-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/analytics-view-permissions", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudo cargar permisos de analytics");
      return res.json();
    },
  });

  const { data: costSettingsForDate = [] } = useQuery<DailyCostSetting[]>({
    queryKey: ["/api/daily-cost-settings", costDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("dateFrom", costDate);
      params.set("dateTo", costDate);
      const res = await fetch(`/api/daily-cost-settings?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudo cargar el costo diario");
      return res.json();
    },
    enabled: Boolean(costDate),
  });

  useEffect(() => {
    const row = costSettingsForDate[0];
    if (!row) {
      setCostPerInboundChatBs("");
      setOfficialRateBs("");
      setParallelRateBs("");
      return;
    }
    setCostPerInboundChatBs(String(row.unitCostBs));
    setOfficialRateBs(String(row.officialRateBs));
    setParallelRateBs(String(row.parallelRateBs));
  }, [costSettingsForDate]);

  useEffect(() => {
    const next: Record<number, number[]> = {};
    const fromServer = new Map<number, number[]>(
      analyticsViewPermissions.map((row) => [Number(row.viewerAgentId), Array.isArray(row.visibleAgentIds) ? row.visibleAgentIds : []]),
    );
    for (const agent of agents) {
      next[agent.id] = fromServer.get(agent.id) ?? [];
    }
    setAnalyticsPermissionsDraft(next);
  }, [agents, analyticsViewPermissions]);

  const saveDailyCostMutation = useMutation({
    mutationFn: async () => {
      const unitCostBs = parsePositiveNumber(costPerInboundChatBs, 0);
      const officialRate = parsePositiveNumber(officialRateBs, 0);
      const parallelRate = parsePositiveNumber(parallelRateBs, 0);

      if (!costDate) {
        throw new Error("Seleccione una fecha");
      }
      if (unitCostBs <= 0) {
        throw new Error("Costo por chat invalido");
      }
      if (officialRate <= 0) {
        throw new Error("Tipo de cambio oficial invalido");
      }
      if (parallelRate <= 0) {
        throw new Error("Dolar paralelo invalido");
      }

      const res = await fetch(`/api/daily-cost-settings/${costDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          unitCostBs,
          officialRateBs: officialRate,
          parallelRateBs: parallelRate,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || "No se pudo guardar el costo diario");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-cost-settings", costDate] });
      toast({ title: "Costo diario guardado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; username: string; password: string; weight: number }) => {
      return apiRequest("POST", "/api/agents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      resetForm();
      toast({ title: "Agente creado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: any }) => {
      return apiRequest("PATCH", `/api/agents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setEditingId(null);
      toast({ title: "Agente actualizado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agente eliminado" });
    },
  });

  const upsertAdRoutingMutation = useMutation({
    mutationFn: async (data: { adId: string; agentIds: number[]; isActive: boolean }) => {
      return apiRequest("PUT", "/api/ad-routing-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-routing-rules"] });
      setRoutingAdId("");
      setRoutingAgentIds([]);
      setRoutingIsActive(true);
      toast({ title: "Regla de anuncio guardada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAdRoutingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ad-routing-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-routing-rules"] });
      toast({ title: "Regla eliminada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveAnalyticsPermissionMutation = useMutation({
    mutationFn: async (data: { viewerAgentId: number; visibleAgentIds: number[] }) => {
      const res = await apiRequest(
        "PUT",
        `/api/analytics-view-permissions/${data.viewerAgentId}`,
        { visibleAgentIds: data.visibleAgentIds },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics-view-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-stats"] });
      toast({ title: "Permiso de analytics guardado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setName("");
    setUsername("");
    setPassword("");
    setWeight(1);
  };

  const handleCreate = () => {
    if (!name || !username || !password) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name, username, password, weight });
  };

  const toggleActive = (agent: Agent) => {
    updateMutation.mutate({ id: agent.id, isActive: !agent.isActive });
  };

  const toggleAgentAiAutoReply = (agent: Agent) => {
    updateMutation.mutate({
      id: agent.id,
      isAiAutoReplyEnabled: !agent.isAiAutoReplyEnabled,
    });
  };

  const formatDateInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setDateFrom(formatDateInput(start));
    setDateTo(formatDateInput(end));
  };

  const activeAgents = agents.filter(a => a.isActive);
  const inactiveAgents = agents.filter(a => !a.isActive);
  const totalInboundMessages = agents.reduce((acc, agent) => acc + (agent.inboundMessages || 0), 0);
  const totalInboundChats = agents.reduce((acc, agent) => acc + (agent.inboundChats || 0), 0);
  const totalShouldCall = agents.reduce((acc, agent) => acc + (agent.shouldCallCount || 0), 0);
  const activeAgentIdSet = new Set(activeAgents.map((a) => a.id));
  const unitCostBs = parsePositiveNumber(costPerInboundChatBs, 0);
  const officialRate = parsePositiveNumber(officialRateBs, 0);
  const parallelRate = parsePositiveNumber(parallelRateBs, 0);
  const hasValidCostConfig = unitCostBs > 0 && officialRate > 0 && parallelRate > 0;
  const totalBaseCostBs = hasValidCostConfig ? totalInboundChats * unitCostBs : null;
  const totalCostUsd = hasValidCostConfig && totalBaseCostBs != null ? totalBaseCostBs / officialRate : null;
  const totalParallelCostBs =
    hasValidCostConfig && totalCostUsd != null ? totalCostUsd * parallelRate : null;

  const toggleRoutingAgent = (agentId: number) => {
    setRoutingAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };

  const toggleAnalyticsVisibleAgent = (viewerAgentId: number, visibleAgentId: number) => {
    setAnalyticsPermissionsDraft((prev) => {
      const current = Array.isArray(prev[viewerAgentId]) ? prev[viewerAgentId] : [];
      const next = current.includes(visibleAgentId)
        ? current.filter((id) => id !== visibleAgentId)
        : [...current, visibleAgentId];
      return { ...prev, [viewerAgentId]: next };
    });
  };

  const getAgentName = (id: number) => agents.find((a) => a.id === id)?.name || `Agente ${id}`;

  const performanceData = agents
    .map((agent) => ({
      name: agent.name.split(" ")[0],
      mensajes: agent.inboundMessages || 0,
      chats: agent.assignedConversations || 0,
    }))
    .sort((a, b) => b.mensajes - a.mensajes)
    .slice(0, 8);

  const distributionData = activeAgents
    .map((agent) => ({
      name: agent.name.split(" ")[0],
      value: agent.assignedConversations || 0,
    }))
    .filter((item) => item.value > 0);

  const pieColors = ["#10b981", "#06b6d4", "#0ea5e9", "#22d3ee", "#14b8a6", "#0891b2"];

  const SECTIONS = [
    { key: "resumen", label: "Resumen", icon: LayoutDashboard },
    { key: "agentes", label: "Agentes", icon: Users },
    { key: "costos", label: "Costos", icon: Wallet },
    { key: "anuncios", label: "Anuncios", icon: Megaphone },
    { key: "permisos", label: "Permisos", icon: ShieldCheck },
  ] as const;

  const topAgents = [...agents]
    .sort((a, b) => (b.inboundMessages || 0) - (a.inboundMessages || 0))
    .slice(0, 5);

  const agentDetail = agents.find((agent) => agent.id === agentDetailId) || null;
  const rangeLabel = dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : "Acumulado";

  const chartsBlock = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 shadow-xl backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Mensajes por agente</h3>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(16,185,129,0.08)" }}
                contentStyle={{
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: "12px",
                  color: "#e2e8f0",
                }}
              />
              <Bar dataKey="mensajes" radius={[8, 8, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 shadow-xl backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Distribución de chats (activos)</h3>
        </div>
        <div className="h-56">
          {distributionData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Sin chats asignados aún
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white relative">
      <style dangerouslySetInnerHTML={{ __html: glowAnimation }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="relative z-10 mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0 text-slate-400" data-testid="button-back-agents">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/20">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-white">Gestión de Agentes</h1>
            <p className="truncate text-xs text-slate-500">{rangeLabel} · {agents.length} agentes</p>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-6xl gap-6 px-4 pb-28 pt-4 lg:pb-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Secciones</p>
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
                  activeSection === key
                    ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-white ring-1 ring-emerald-500/40"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}

            <div className="mt-4 space-y-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resumen rápido</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Activos</span>
                <span className="font-semibold tabular-nums text-emerald-300">{activeAgents.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Chats inbound</span>
                <span className="font-semibold tabular-nums">{totalInboundChats}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Por llamar</span>
                <span className="font-semibold tabular-nums text-amber-300">{totalShouldCall}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Costo paralelo</span>
                <span className="font-semibold tabular-nums text-violet-300">
                  {totalParallelCostBs == null ? "—" : formatBs(totalParallelCostBs)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">

        {agentAiColumnStatus && (
          <div
            className={cn(
              "mb-5 rounded-2xl border px-4 py-3 text-sm",
              agentAiColumnStatus.exists
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/30 bg-red-500/10 text-red-100",
            )}
            data-testid="alert-agent-ai-column-status"
          >
            {agentAiColumnStatus.exists
              ? "Columna OK: is_ai_auto_reply_enabled existe en la base de datos. El toggle IA auto por agente puede guardarse."
              : "Alerta: falta la columna is_ai_auto_reply_enabled en la base de datos. El toggle IA auto por agente no se guardara bien hasta corregir eso."}
          </div>
        )}

        <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Rango de fechas</h3>
            <span className="hidden text-xs text-slate-500 sm:inline">{rangeLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className="ml-auto h-8 border-slate-700 bg-slate-900/60 text-xs text-slate-200 lg:hidden"
              data-testid="button-agents-toggle-filters"
            >
              {rangeLabel}
              <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
          </div>

          <div className={cn("mt-3 space-y-2", !filtersOpen && "hidden lg:block")}>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 bg-slate-800/60 border-slate-700/50 text-white"
                data-testid="input-agents-date-from"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 bg-slate-800/60 border-slate-700/50 text-white"
                data-testid="input-agents-date-to"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-600 text-slate-200"
              onClick={() => setQuickRange(1)}
              data-testid="button-agents-range-today"
            >
              Hoy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-600 text-slate-200"
              onClick={() => setQuickRange(7)}
              data-testid="button-agents-range-7d"
            >
              7 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-600 text-slate-200"
              onClick={() => setQuickRange(30)}
              data-testid="button-agents-range-30d"
            >
              30 dias
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-slate-400"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              data-testid="button-agents-range-clear"
            >
              Limpiar
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {dateFrom || dateTo
              ? `Mostrando metricas del rango ${dateFrom || "..."} a ${dateTo || "..."}`
              : "Mostrando metricas acumuladas (sin filtro de fechas)"}
          </p>
          </div>
        </div>

        {activeSection === "costos" && (
          <>
        <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 backdrop-blur-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">Costo por agente (base: Chats con inbound)</h3>
            <p className="text-xs text-slate-400">
              Formula: (Chats con inbound * costo unitario Bs) / TC oficial * TC paralelo
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha de costo diario</label>
              <Input
                type="date"
                value={costDate}
                onChange={(e) => setCostDate(e.target.value)}
                className="h-9 bg-slate-800/60 border-slate-700/50 text-white"
                data-testid="input-cost-date"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Costo por chat con inbound (Bs)</label>
              <Input
                value={costPerInboundChatBs}
                onChange={(e) => setCostPerInboundChatBs(e.target.value)}
                placeholder="Ej. 1.23"
                className="h-9 bg-slate-800/60 border-slate-700/50 text-white"
                data-testid="input-cost-per-inbound-chat-bs"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tipo de cambio oficial (Bs/USD)</label>
              <Input
                value={officialRateBs}
                onChange={(e) => setOfficialRateBs(e.target.value)}
                placeholder="Ej. 6.6"
                className="h-9 bg-slate-800/60 border-slate-700/50 text-white"
                data-testid="input-official-rate-bs-usd"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Dolar paralelo (Bs/USD)</label>
              <Input
                value={parallelRateBs}
                onChange={(e) => setParallelRateBs(e.target.value)}
                placeholder="Ej. 9.23"
                className="h-9 bg-slate-800/60 border-slate-700/50 text-white"
                data-testid="input-parallel-rate-bs-usd"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => saveDailyCostMutation.mutate()}
              disabled={saveDailyCostMutation.isPending || !costDate}
              className="h-9 bg-gradient-to-r from-emerald-600 to-cyan-600 border-0"
              data-testid="button-save-daily-cost"
            >
              {saveDailyCostMutation.isPending ? "Guardando..." : "Guardar dia"}
            </Button>
            <p className="text-xs text-slate-500">
              Si no guarda precio para una fecha, el monto se muestra como `—`.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-cyan-300">Costo base total</p>
              <p className="text-lg font-semibold text-white mt-1">
                {totalBaseCostBs == null ? "—" : formatBs(totalBaseCostBs)}
              </p>
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-violet-200">Equivalente USD</p>
              <p className="text-lg font-semibold text-white mt-1">
                {totalCostUsd == null ? "—" : formatUsd(totalCostUsd)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-emerald-300">Costo paralelo total</p>
              <p className="text-lg font-semibold text-white mt-1">
                {totalParallelCostBs == null ? "—" : formatBs(totalParallelCostBs)}
              </p>
            </div>
          </div>
        </div>
          </>
        )}

        {activeSection === "anuncios" && (
          <>
        <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 backdrop-blur-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">Asignacion por anuncio (ad_id)</h3>
            <p className="text-xs text-slate-400">
              Opcional: si no hay regla o agentes activos en esa regla, el sistema usa la asignacion normal actual.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-3">
            <Input
              value={routingAdId}
              onChange={(e) => setRoutingAdId(e.target.value)}
              placeholder="ad_id del anuncio (ej: 120221998877665)"
              className="bg-slate-800/60 border-slate-700/50 text-white"
              data-testid="input-ad-routing-ad-id"
            />
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
              <span className="text-xs text-slate-300">Activo</span>
              <Switch
                checked={routingIsActive}
                onCheckedChange={setRoutingIsActive}
                data-testid="switch-ad-routing-active"
              />
            </div>
          </div>
          <div className="mb-3">
            <p className="text-xs text-slate-400 mb-2">Agentes destino</p>
            <div className="flex flex-wrap gap-2">
              {activeAgents.map((agent) => {
                const selected = routingAgentIds.includes(agent.id);
                return (
                  <Button
                    key={`routing-agent-${agent.id}`}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className={selected ? "bg-emerald-600 hover:bg-emerald-500" : "border-slate-600 text-slate-300"}
                    onClick={() => toggleRoutingAgent(agent.id)}
                    data-testid={`button-ad-routing-agent-${agent.id}`}
                  >
                    {agent.name}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const cleanAdId = routingAdId.trim();
                const selectedActiveAgents = routingAgentIds.filter((id) => activeAgentIdSet.has(id));
                if (!cleanAdId) {
                  toast({ title: "Ingrese ad_id", variant: "destructive" });
                  return;
                }
                if (selectedActiveAgents.length === 0) {
                  toast({ title: "Seleccione al menos un agente activo", variant: "destructive" });
                  return;
                }
                upsertAdRoutingMutation.mutate({
                  adId: cleanAdId,
                  agentIds: selectedActiveAgents,
                  isActive: routingIsActive,
                });
              }}
              disabled={upsertAdRoutingMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 border-0"
              data-testid="button-save-ad-routing-rule"
            >
              {upsertAdRoutingMutation.isPending ? "Guardando..." : "Guardar regla"}
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {adRoutingRules.length === 0 ? (
              <p className="text-xs text-slate-500">Sin reglas por anuncio. Todo sigue con asignacion normal.</p>
            ) : (
              adRoutingRules.map((rule) => (
                <div
                  key={`ad-rule-${rule.id}`}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 flex flex-wrap items-center gap-2 justify-between"
                  data-testid={`card-ad-routing-rule-${rule.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium break-all">ad_id: {rule.adId}</p>
                    <p className="text-xs text-slate-400">
                      {rule.isActive ? "Activo" : "Inactivo"} · {rule.agentIds.map(getAgentName).join(", ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm(`Eliminar regla ad_id ${rule.adId}?`)) {
                        deleteAdRoutingMutation.mutate(rule.id);
                      }
                    }}
                    disabled={deleteAdRoutingMutation.isPending}
                    data-testid={`button-delete-ad-routing-rule-${rule.id}`}
                  >
                    Eliminar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
          </>
        )}

        {activeSection === "permisos" && (
          <>
        <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 backdrop-blur-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">Permisos de Analytics entre agentes</h3>
            <p className="text-xs text-slate-400">
              Defina que agentes puede ver cada agente en la pagina de Analytics. Cada agente siempre mantiene acceso a sus propios datos.
            </p>
          </div>
          <div className="space-y-3">
            {agents.length === 0 ? (
              <p className="text-xs text-slate-500">No hay agentes para configurar.</p>
            ) : (
              agents.map((viewerAgent) => {
                const selectedVisibleIds = (analyticsPermissionsDraft[viewerAgent.id] || []).filter((id) => id !== viewerAgent.id);
                const selectedSummary = selectedVisibleIds.length > 0
                  ? selectedVisibleIds.map(getAgentName).join(", ")
                  : "Solo sus propias metricas";
                const savingThisAgent =
                  saveAnalyticsPermissionMutation.isPending &&
                  saveAnalyticsPermissionMutation.variables?.viewerAgentId === viewerAgent.id;

                return (
                  <div
                    key={`analytics-permission-${viewerAgent.id}`}
                    className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3"
                    data-testid={`card-analytics-permissions-${viewerAgent.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{viewerAgent.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 break-words">
                          Puede ver: {selectedSummary}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-8 bg-gradient-to-r from-emerald-600 to-cyan-600 border-0"
                        disabled={saveAnalyticsPermissionMutation.isPending}
                        onClick={() => {
                          saveAnalyticsPermissionMutation.mutate({
                            viewerAgentId: viewerAgent.id,
                            visibleAgentIds: selectedVisibleIds,
                          });
                        }}
                        data-testid={`button-save-analytics-permissions-${viewerAgent.id}`}
                      >
                        {savingThisAgent ? "Guardando..." : "Guardar"}
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {agents
                        .filter((targetAgent) => targetAgent.id !== viewerAgent.id)
                        .map((targetAgent) => {
                          const selected = selectedVisibleIds.includes(targetAgent.id);
                          return (
                            <Button
                              key={`analytics-permission-target-${viewerAgent.id}-${targetAgent.id}`}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              className={selected ? "bg-emerald-600 hover:bg-emerald-500" : "border-slate-600 text-slate-300"}
                              onClick={() => toggleAnalyticsVisibleAgent(viewerAgent.id, targetAgent.id)}
                              data-testid={`button-analytics-permission-target-${viewerAgent.id}-${targetAgent.id}`}
                            >
                              {targetAgent.name}
                            </Button>
                          );
                        })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
          </>
        )}

        {activeSection === "resumen" && (
          <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-emerald-300">Agentes activos</p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums">{activeAgents.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-600/40 bg-slate-700/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Inactivos</p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums">{inactiveAgents.length}</p>
          </div>
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-sky-300">Chats con inbound</p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums">{totalInboundChats}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-amber-300">Pendientes llamar</p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums">{totalShouldCall}</p>
          </div>
        </div>

        {chartsBlock}

        <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Top agentes por mensajes</h3>
            <span className="ml-auto text-[11px] text-slate-500">Toca para ver detalle</span>
          </div>
          {topAgents.length > 0 ? (
            <div className="space-y-3">
              {topAgents.map((agent) => {
                const max = topAgents[0]?.inboundMessages || 1;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setAgentDetailId(agent.id)}
                    className="w-full text-left transition-transform active:scale-[0.99]"
                    data-testid={`button-agent-top-${agent.id}`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-[10px] font-bold text-white">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate font-medium">{agent.name}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-slate-400">{agent.inboundMessages || 0}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style={{ width: `${Math.round(((agent.inboundMessages || 0) / max) * 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay agentes para mostrar.</p>
          )}
        </div>
          </>
        )}

        {activeSection === "agentes" && (
          <>
        <Button
          onClick={() => setShowForm(true)}
          className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 border-0 shadow-lg shadow-emerald-500/20 transition-transform active:scale-[0.98] sm:w-auto"
          data-testid="button-add-agent"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Agente
        </Button>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin h-10 w-10 border-3 border-emerald-500 border-t-transparent rounded-full" />
            <span className="text-slate-500 text-sm mt-4">Cargando agentes...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-slate-700/30">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
              <Users className="h-6 w-6 text-slate-600" />
            </div>
            <p className="text-slate-400 text-sm">No hay agentes creados</p>
            <p className="text-slate-600 text-xs mt-1">Los mensajes se manejan solo desde la cuenta admin</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAgents.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-slate-700/30 shadow-xl shadow-emerald-500/10 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600/80 to-teal-600/80 px-4 py-3 relative overflow-hidden">
                  <div className="absolute inset-0 animate-glow-line" />
                  <div className="relative flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="font-semibold text-sm text-white">Agentes Activos</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm font-bold">
                      {activeAgents.length}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {activeAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      editingId={editingId}
                      setEditingId={setEditingId}
                      showPassword={showPasswords[agent.id] || false}
                      togglePassword={() => setShowPasswords(p => ({ ...p, [agent.id]: !p[agent.id] }))}
                      onToggleActive={() => toggleActive(agent)}
                      onToggleAgentAiAutoReply={() => toggleAgentAiAutoReply(agent)}
                      onDelete={() => {
                        if (confirm(`¿Eliminar agente "${agent.name}"?`)) {
                          deleteMutation.mutate(agent.id);
                        }
                      }}
                      onUpdate={(updates) => updateMutation.mutate({ id: agent.id, ...updates })}
                      onOpenDetail={() => setAgentDetailId(agent.id)}
                      isPending={updateMutation.isPending}
                      unitCostBs={unitCostBs}
                      officialRate={officialRate}
                      parallelRate={parallelRate}
                    />
                  ))}
                </div>
              </div>
            )}

            {inactiveAgents.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-slate-700/30 shadow-xl shadow-slate-500/10 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600/80 to-slate-700/80 px-4 py-3 relative overflow-hidden">
                  <div className="absolute inset-0 animate-glow-line" />
                  <div className="relative flex items-center gap-2">
                    <PowerOff className="h-4 w-4" />
                    <span className="font-semibold text-sm text-white">Inactivos</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm font-bold">
                      {inactiveAgents.length}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {inactiveAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      editingId={editingId}
                      setEditingId={setEditingId}
                      showPassword={showPasswords[agent.id] || false}
                      togglePassword={() => setShowPasswords(p => ({ ...p, [agent.id]: !p[agent.id] }))}
                      onToggleActive={() => toggleActive(agent)}
                      onToggleAgentAiAutoReply={() => toggleAgentAiAutoReply(agent)}
                      onDelete={() => {
                        if (confirm(`¿Eliminar agente "${agent.name}"?`)) {
                          deleteMutation.mutate(agent.id);
                        }
                      }}
                      onUpdate={(updates) => updateMutation.mutate({ id: agent.id, ...updates })}
                      onOpenDetail={() => setAgentDetailId(agent.id)}
                      isPending={updateMutation.isPending}
                      unitCostBs={unitCostBs}
                      officialRate={officialRate}
                      parallelRate={parallelRate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700/60 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1 py-1.5">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-medium transition-all active:scale-90",
                activeSection === key ? "bg-emerald-500/10 text-emerald-300" : "text-slate-400 hover:text-slate-200",
              )}
              data-testid={`button-agents-section-${key}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <Dialog open={showForm} onOpenChange={(open) => (open ? setShowForm(true) : resetForm())}>
        <DialogContent className="max-w-md border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" /> Crear agente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nombre</label>
                <Input
                  placeholder="Ej: María García"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-600"
                  data-testid="input-agent-name"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Usuario</label>
                <Input
                  placeholder="Ej: maria"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-600"
                  data-testid="input-agent-username"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Contraseña</label>
                <Input
                  type="text"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-600"
                  data-testid="input-agent-password"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Peso (proporción de chats)</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={weight}
                  onChange={(e) => setWeight(parseInt(e.target.value) || 1)}
                  className="bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-600"
                  data-testid="input-agent-weight"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Peso = proporción de chats. Agente con peso 3 recibe 3x más que uno con peso 1.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 border-0 transition-transform active:scale-[0.98]"
                data-testid="button-save-agent"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Creando..." : "Crear agente"}
              </Button>
              <Button variant="ghost" onClick={resetForm} className="text-slate-400" data-testid="button-cancel-agent">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={agentDetailId != null} onOpenChange={(open) => { if (!open) setAgentDetailId(null); }}>
        <DialogContent className="max-w-md border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              {agentDetail?.name ?? "Detalle del agente"}
            </DialogTitle>
          </DialogHeader>
          {agentDetail ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-300">Chats inbound</p>
                  <p className="text-2xl font-bold tabular-nums">{agentDetail.inboundChats || 0}</p>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-sky-300">Mensajes inbound</p>
                  <p className="text-2xl font-bold tabular-nums">{agentDetail.inboundMessages || 0}</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-amber-300">Por llamar</p>
                  <p className="text-2xl font-bold tabular-nums">{agentDetail.shouldCallCount || 0}</p>
                </div>
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-violet-300">Nuevos leads</p>
                  <p className="text-2xl font-bold tabular-nums">{agentDetail.newLeads || 0}</p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-700/60 bg-slate-950/50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Usuario</span>
                  <span className="min-w-0 truncate font-medium">@{agentDetail.username}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Estado</span>
                  <span className={agentDetail.isActive ? "font-medium text-emerald-300" : "font-medium text-red-300"}>
                    {agentDetail.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">IA automática</span>
                  <span className={agentDetail.isAiAutoReplyEnabled ? "font-medium text-cyan-300" : "font-medium text-slate-400"}>
                    {agentDetail.isAiAutoReplyEnabled ? "ON" : "OFF"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Peso</span>
                  <span className="font-medium tabular-nums">{agentDetail.weight || 1}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Chats asignados</span>
                  <span className="font-medium tabular-nums">{agentDetail.assignedConversations || 0}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Costo estimado (Meta Ads)</p>
                {hasValidCostConfig ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Base</span>
                      <span className="font-semibold tabular-nums">{formatBs((agentDetail.inboundChats || 0) * unitCostBs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">USD</span>
                      <span className="font-semibold tabular-nums">
                        {formatUsd(((agentDetail.inboundChats || 0) * unitCostBs) / officialRate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Paralelo</span>
                      <span className="font-semibold tabular-nums text-violet-300">
                        {formatBs((((agentDetail.inboundChats || 0) * unitCostBs) / officialRate) * parallelRate)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Configura el costo diario en la sección Costos.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No se encontró el agente.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentCard({
  agent,
  editingId,
  setEditingId,
  showPassword,
  togglePassword,
  onToggleActive,
  onToggleAgentAiAutoReply,
  onDelete,
  onUpdate,
  onOpenDetail,
  isPending,
  unitCostBs,
  officialRate,
  parallelRate,
}: {
  agent: AgentWithStats;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  showPassword: boolean;
  togglePassword: () => void;
  onToggleActive: () => void;
  onToggleAgentAiAutoReply: () => void;
  onDelete: () => void;
  onUpdate: (updates: Record<string, any>) => void;
  onOpenDetail: () => void;
  isPending: boolean;
  unitCostBs: number;
  officialRate: number;
  parallelRate: number;
}) {
  const isEditing = editingId === agent.id;
  const [editName, setEditName] = useState(agent.name);
  const [editWeight, setEditWeight] = useState(agent.weight || 1);
  const [editPassword, setEditPassword] = useState(agent.password);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const inboundChats = agent.inboundChats || 0;
  const baseCostBs = inboundChats * unitCostBs;
  const equivalentUsd = officialRate > 0 ? baseCostBs / officialRate : 0;
  const parallelCostBs = equivalentUsd * parallelRate;
  const formatLastActivity = (value?: string | null) => {
    if (!value) return "Sin actividad";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sin actividad";
    return date.toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const startEdit = () => {
    setEditName(agent.name);
    setEditWeight(agent.weight || 1);
    setEditPassword(agent.password);
    setEditingId(agent.id);
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 backdrop-blur-sm border border-slate-700/50 shadow-lg shadow-black/20",
        "transition-transform duration-100 active:scale-[0.98]",
        agent.isActive
          ? "border-l-2 border-l-emerald-500 bg-slate-800/80"
          : "border-l-2 border-l-slate-600 bg-slate-800/40 opacity-70"
      )}
      data-testid={`agent-card-${agent.id}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 min-w-0 w-full">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg",
            agent.isActive
              ? "bg-gradient-to-br from-emerald-500 to-cyan-600"
              : "bg-gradient-to-br from-slate-500 to-slate-600"
          )}>
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-800/60 border-slate-700/50 text-white h-8 w-40"
                    placeholder="Nombre"
                    data-testid="input-edit-agent-name"
                  />
                  <Input
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="bg-slate-800/60 border-slate-700/50 text-white h-8 w-32"
                    placeholder="Contraseña"
                    data-testid="input-edit-agent-password"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editWeight}
                    onChange={(e) => setEditWeight(parseInt(e.target.value) || 1)}
                    className="bg-slate-800/60 border-slate-700/50 text-white h-8 w-20"
                    data-testid="input-edit-agent-weight"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      onUpdate({ name: editName, password: editPassword, weight: editWeight });
                      setEditingId(null);
                    }}
                    disabled={isPending}
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600 border-0 h-7 text-xs"
                    data-testid="button-save-edit-agent"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    className="text-slate-400 h-7 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-semibold text-white truncate">{agent.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span>@{agent.username}</span>
                  <span className="flex items-center gap-1">
                    {showPassword ? agent.password : "••••••"}
                    <button onClick={togglePassword} className="text-slate-500">
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium border border-current/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    Peso: {agent.weight || 1}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-current/20",
                    agent.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", agent.isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                    {agent.isActive ? "Activo" : "Inactivo"}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-current/20",
                    agent.isAiAutoReplyEnabled ? "bg-cyan-500/20 text-cyan-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {agent.isAiAutoReplyEnabled ? <Bot className="h-3 w-3" /> : <BotOff className="h-3 w-3" />}
                    {agent.isAiAutoReplyEnabled ? "IA auto ON" : "IA auto OFF"}
                  </span>
                </div>
                {!isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobileStats((prev) => !prev)}
                    className="md:hidden mt-2 h-7 px-2 text-xs text-cyan-300"
                    data-testid={`button-toggle-agent-stats-${agent.id}`}
                  >
                    {showMobileStats ? "Ocultar info" : "Ver info"}
                  </Button>
                )}
                <div className={cn(
                  "mt-3 gap-2.5",
                  showMobileStats ? "grid grid-cols-1" : "hidden",
                  "md:grid md:grid-cols-2 lg:grid-cols-4",
                )}>
                  <div className="group relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
                    <div className="absolute left-0 top-0 h-0.5 w-full bg-emerald-400/80" />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-emerald-300" />
                      Chats con inbound
                    </p>
                    <p className="mt-1 text-xl font-black text-white tabular-nums">{inboundChats}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">chats unicos con inbound</p>
                  </div>

                  <div className="group relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
                    <div className="absolute left-0 top-0 h-0.5 w-full bg-cyan-400/80" />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Costo estimado</p>
                    <p className="mt-1 text-[11px] text-slate-200">Base: <span className="font-semibold text-white">{formatBs(baseCostBs)}</span></p>
                    <p className="text-[11px] text-slate-300">USD: <span className="font-semibold text-white">{formatUsd(equivalentUsd)}</span></p>
                    <p className="text-[11px] text-slate-300">Paralelo: <span className="font-semibold text-white">{formatBs(parallelCostBs)}</span></p>
                  </div>

                  <div className="group relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
                    <div className="absolute left-0 top-0 h-0.5 w-full bg-amber-400/80" />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Por llamar</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xl font-black text-white tabular-nums">{agent.shouldCallCount || 0}</p>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border",
                        (agent.shouldCallCount || 0) > 0
                          ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                          : "border-slate-600/60 bg-slate-800/70 text-slate-400"
                      )}>
                        {(agent.shouldCallCount || 0) > 0 ? "accion" : "ok"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">seguimiento comercial</p>
                  </div>

                  <div className="group relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
                    <div className="absolute left-0 top-0 h-0.5 w-full bg-violet-300/70" />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-violet-200" />
                      Ultima actividad
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-100 leading-tight">{formatLastActivity(agent.lastActivityAt)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">timestamp de mensajes</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1 self-end md:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenDetail}
              title="Ver detalle"
              className="text-cyan-300"
              data-testid={`button-detail-agent-${agent.id}`}
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              title="Editar"
              className="text-slate-400"
              data-testid={`button-edit-agent-${agent.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleAgentAiAutoReply}
              title={agent.isAiAutoReplyEnabled ? "Desactivar IA automática" : "Activar IA automática"}
              className={agent.isAiAutoReplyEnabled ? "text-cyan-400" : "text-red-400"}
              data-testid={`button-toggle-agent-ai-${agent.id}`}
            >
              {agent.isAiAutoReplyEnabled ? <Bot className="h-4 w-4" /> : <BotOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleActive}
              title={agent.isActive ? "Desactivar" : "Activar"}
              className={agent.isActive ? "text-emerald-400" : "text-red-400"}
              data-testid={`button-toggle-agent-${agent.id}`}
            >
              {agent.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              title="Eliminar"
              className="text-slate-400"
              data-testid={`button-delete-agent-${agent.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
