import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarCheck, Loader2, Send } from "lucide-react";

interface Conversation {
  id: number;
  waId: string;
  contactName: string | null;
}

interface Msg {
  id: number | string;
  direction: "in" | "out" | "sys";
  text: string;
}

export default function DevChatPage() {
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastCita, setLastCita] = useState<{ sede: string; startAt: string; sedeLabel: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", "dev-chat"],
    queryFn: async () => {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando conversaciones");
      return res.json();
    },
  });

  useEffect(() => {
    if (conversationId === null && conversations.length > 0) setConversationId(conversations[0].id);
  }, [conversations, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setMessages(
          (data.messages || []).map((m: any) => ({ id: m.id, direction: m.direction, text: m.text || `[${m.type}]` })),
        );
      } catch {
        /* ignore */
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || !conversationId || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, direction: "in", text }]);
    setSending(true);
    try {
      const res = await fetch("/api/dev/simulate-message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (res.status === 404) {
        toast({ title: "Simulador desactivado", description: "Reinicia el server con ENABLE_DEV_SIMULATOR=true", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, direction: "out", text: data.response || "(sin respuesta)" }]);
      if (data.cita && !data.cita.clash) {
        setLastCita(data.cita);
        setMessages((prev) => [
          ...prev,
          { id: `s_${Date.now()}`, direction: "sys", text: `Cita agendada: ${data.cita.sedeLabel} · ${new Date(data.cita.startAt).toLocaleString("es-BO", { weekday: "long", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` },
        ]);
        toast({ title: "Cita agendada por Lexi" });
      } else if (data.cita?.clash) {
        setMessages((prev) => [...prev, { id: `c_${Date.now()}`, direction: "sys", text: "El horario ya estaba ocupado (no se agendó)." }]);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((c) => c.id === conversationId);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-slate-300"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-lg font-semibold">Simulador Lexi (local)</h1>
          <Link href="/citas">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-200">
              <CalendarCheck className="h-4 w-4 mr-2" /> Ver citas
            </Button>
          </Link>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200">Chat con Lexi (simula mensaje entrante)</CardTitle>
            <select
              value={conversationId ?? ""}
              onChange={(e) => setConversationId(parseInt(e.target.value))}
              className="mt-2 h-9 w-full rounded-md border border-slate-600 bg-slate-900 px-2 text-sm text-white"
              data-testid="select-dev-conversation"
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>{c.contactName || c.waId} (#{c.id})</option>
              ))}
            </select>
          </CardHeader>
          <CardContent>
            <div ref={scrollRef} className="h-[420px] overflow-y-auto rounded-lg bg-slate-950/60 p-3 space-y-2">
              {messages.length === 0 && <p className="text-sm text-slate-500">Escribe "Hola, quiero agendar una cita" para empezar.</p>}
              {messages.map((m) => (
                <div key={m.id} className={m.direction === "sys" ? "flex justify-center" : m.direction === "out" ? "flex justify-start" : "flex justify-end"}>
                  {m.direction === "sys" ? (
                    <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200">{m.text}</span>
                  ) : (
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.direction === "out" ? "bg-[#202c33] text-slate-100" : "bg-[#005c4b] text-white"}`}>
                      {m.text}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-[#202c33] px-3 py-2 text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lexi escribiendo...
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Escribe como si fueras el cliente..."
                className="bg-slate-900 border-slate-600 text-white"
                data-testid="input-dev-message"
              />
              <Button onClick={send} disabled={sending || !input.trim()} data-testid="button-dev-send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {lastCita && (
              <p className="mt-2 text-xs text-emerald-300">
                Última cita: {lastCita.sedeLabel} · {new Date(lastCita.startAt).toLocaleString("es-BO")}
              </p>
            )}
            {selected && <p className="mt-2 text-xs text-slate-500">Conversación #{selected.id} · {selected.contactName || selected.waId}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
