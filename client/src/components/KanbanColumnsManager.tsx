import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Settings2, Plus, Eye, EyeOff, Trash2, Check, Loader2 } from "lucide-react";

interface KanbanColumnDef {
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

export function KanbanColumnsManager({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: columns = [], isLoading } = useQuery<KanbanColumnDef[]>({
    queryKey: ["/api/kanban-columns"],
    enabled: isAdmin && open,
    staleTime: 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/kanban-columns"] });
    queryClient.invalidateQueries({ queryKey: ["/api/kanban-labels"] });
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
  };

  const createMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await fetch("/api/kanban-columns", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "No se pudo crear");
      return res.json();
    },
    onSuccess: () => { invalidate(); setNewLabel(""); toast({ title: "Columna creada" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: { label?: string; isActive?: boolean } }) => {
      const res = await fetch(`/api/kanban-columns/${key}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditingKey(null); toast({ title: "Columna actualizada" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/kanban-columns/${key}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Columna eliminada", description: "Los chats pasaron a Esperando Confirmación" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 border-slate-600/70 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80"
          title="Columnas del Kanban"
          data-testid="button-kanban-columns"
        >
          <Settings2 className="h-4 w-4 text-slate-300" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Columnas del Kanban</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nueva columna (ej. En evaluación)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) createMutation.mutate(newLabel.trim()); }}
              data-testid="input-new-column"
            />
            <Button
              onClick={() => { if (newLabel.trim()) createMutation.mutate(newLabel.trim()); }}
              disabled={createMutation.isPending || !newLabel.trim()}
              data-testid="button-create-column"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {columns.map((col) => (
                <div key={col.key} className={cn("flex items-center gap-2 rounded-lg border p-2", col.isActive ? "" : "opacity-60")} data-testid={`column-row-${col.key}`}>
                  {editingKey === col.key ? (
                    <>
                      <Input
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editLabel.trim()) updateMutation.mutate({ key: col.key, data: { label: editLabel.trim() } });
                          if (e.key === "Escape") setEditingKey(null);
                        }}
                        className="h-8"
                      />
                      <Button size="icon" className="h-8 w-8" onClick={() => { if (editLabel.trim()) updateMutation.mutate({ key: col.key, data: { label: editLabel.trim() } }); }}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setEditingKey(col.key); setEditLabel(col.label); }}
                        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                        title="Renombrar"
                      >
                        {col.label}
                        {col.isSystem && <span className="ml-1 text-[10px] text-slate-400">(sistema)</span>}
                      </button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => updateMutation.mutate({ key: col.key, data: { isActive: !col.isActive } })}
                        title={col.isActive ? "Ocultar" : "Mostrar"}
                      >
                        {col.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      {!col.isSystem && (
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                          onClick={() => { if (confirm(`Eliminar columna "${col.label}"? Los chats pasarán a Esperando Confirmación.`)) deleteMutation.mutate(col.key); }}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Los agentes verán las columnas activas y podrán mover chats. Solo el admin crea/oculta/elimina.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
