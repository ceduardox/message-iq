import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  UploadCloud,
  Users,
  Video,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SendStatus = "pending" | "success" | "error";

type RecipientResult = {
  text?: { status: SendStatus; error?: string };
  video?: { status: SendStatus; error?: string };
};

const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const MIN_PHONE_LENGTH = 8;
const MAX_PHONE_LENGTH = 15;
const MIN_DELAY_SECONDS = 0;
const MAX_DELAY_SECONDS = 60;

const isValidNumber = (value: string) =>
  value.length >= MIN_PHONE_LENGTH && value.length <= MAX_PHONE_LENGTH;

const normalizeNumber = (value: string) => value.replace(/[^\d]/g, "");

const splitNumbers = (value: string) => {
  const chunks = value.split(/[\n,;]+/);
  const numbers: string[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const collapsed = normalizeNumber(trimmed);
    if (isValidNumber(collapsed)) {
      numbers.push(collapsed);
      continue;
    }
    trimmed
      .split(/\s+/)
      .map((token) => normalizeNumber(token))
      .filter(Boolean)
      .forEach((num) => numbers.push(num));
  }

  return numbers;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export default function BulkSendPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [numbersInput, setNumbersInput] = useState("");
  const [numbers, setNumbers] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [delaySecondsInput, setDelaySecondsInput] = useState("1");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Record<string, RecipientResult>>({});
  const [progress, setProgress] = useState({ total: 0, done: 0 });

  const invalidNumbers = useMemo(
    () => numbers.filter((number) => !isValidNumber(number)),
    [numbers],
  );
  const validNumbers = useMemo(
    () => numbers.filter((number) => isValidNumber(number)),
    [numbers],
  );
  const hasMessage = messageText.trim().length > 0;
  const hasVideo = Boolean(videoFile);
  const videoTooLarge = videoFile ? videoFile.size > MAX_VIDEO_BYTES : false;
  const delaySeconds = useMemo(() => {
    const parsed = Number(delaySecondsInput);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(Math.max(Math.round(parsed), MIN_DELAY_SECONDS), MAX_DELAY_SECONDS);
  }, [delaySecondsInput]);

  const totalOperations =
    validNumbers.length * (Number(hasMessage) + Number(hasVideo));
  const progressTotal = progress.total || totalOperations;
  const progressValue =
    progressTotal > 0 ? Math.round((progress.done / progressTotal) * 100) : 0;

  const addNumbers = () => {
    const parsed = splitNumbers(numbersInput);
    if (!parsed.length) {
      toast({ title: "Agrega al menos un numero valido" });
      return;
    }
    setNumbers((prev) => {
      const next = new Set(prev);
      parsed.forEach((num) => next.add(num));
      return Array.from(next);
    });
    setNumbersInput("");
  };

  const removeNumber = (value: string) => {
    setNumbers((prev) => prev.filter((num) => num !== value));
  };

  const clearNumbers = () => {
    setNumbers([]);
    setResults({});
    setProgress({ total: 0, done: 0 });
  };

  const removeInvalidNumbers = () => {
    setNumbers((prev) => prev.filter((num) => isValidNumber(num)));
  };

  const markResult = (to: string, kind: "text" | "video", status: SendStatus, error?: string) => {
    setResults((prev) => {
      const current = prev[to] || {};
      return {
        ...prev,
        [to]: {
          ...current,
          [kind]: { status, error },
        },
      };
    });
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const sendTextMessage = async (to: string, text: string) => {
    const res = await fetch("/api/send", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, type: "text", text }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const details = payload?.error?.details || payload?.message || "Error al enviar";
      throw new Error(details);
    }
  };

  const sendVideoMessage = async (to: string, file: File, caption: string) => {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("to", to);
    if (caption) formData.append("caption", caption);
    const res = await fetch("/api/send-video", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const details = payload?.error || payload?.message || "Error al enviar video";
      throw new Error(details);
    }
  };

  const handleSend = async () => {
    if (sending) return;
    if (!validNumbers.length) {
      toast({ title: "Agrega al menos un numero valido" });
      return;
    }
    if (!hasMessage && !hasVideo) {
      toast({ title: "Escribe un mensaje o agrega un video" });
      return;
    }
    if (videoTooLarge) {
      toast({ title: "El video supera el limite de 64 MB" });
      return;
    }

    const textToSend = messageText.trim();
    const captionToSend = videoCaption.trim();
    const operations: Array<{ to: string; kind: "text" | "video" }> = [];
    const numbersToSend = [...validNumbers];

    for (const to of numbersToSend) {
      if (hasMessage) operations.push({ to, kind: "text" });
      if (hasVideo) operations.push({ to, kind: "video" });
    }

    setResults(() => {
      const next: Record<string, RecipientResult> = {};
      for (const to of validNumbers) {
        next[to] = {
          ...(hasMessage ? { text: { status: "pending" } } : {}),
          ...(hasVideo ? { video: { status: "pending" } } : {}),
        };
      }
      return next;
    });
    setProgress({ total: operations.length, done: 0 });
    setSending(true);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < numbersToSend.length; i += 1) {
      const target = numbersToSend[i];
      const opsForTarget = operations.filter((op) => op.to === target);

      for (const op of opsForTarget) {
        try {
          if (op.kind === "text") {
            await sendTextMessage(op.to, textToSend);
          } else {
            if (!videoFile) throw new Error("Falta el video");
            await sendVideoMessage(op.to, videoFile, captionToSend);
          }
          markResult(op.to, op.kind, "success");
          successCount += 1;
        } catch (error: any) {
          markResult(op.to, op.kind, "error", error?.message || "Error desconocido");
          errorCount += 1;
        } finally {
          setProgress((prev) => ({ total: prev.total, done: prev.done + 1 }));
        }
      }

      if (i < numbersToSend.length - 1 && delaySeconds > 0) {
        await delay(delaySeconds * 1000);
      }
    }

    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    toast({
      title: "Envio finalizado",
      description: `Exitos: ${successCount} - Errores: ${errorCount}`,
    });
  };

  const resultNumbers = useMemo(() => Object.keys(results), [results]);
  const hasResults = resultNumbers.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-slate-300" data-testid="button-back-bulk-send">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Envio masivo</h1>
            <p className="text-sm text-slate-400">
              Envia el mismo mensaje o video a varios numeros con codigo de pais.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="bg-slate-900/70 border-slate-700/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                Destinatarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="numbers-input" className="text-slate-200">
                  Numeros (ej: 59160939906)
                </Label>
                <Textarea
                  id="numbers-input"
                  value={numbersInput}
                  onChange={(e) => setNumbersInput(e.target.value)}
                  placeholder="Pega numeros separados por coma, espacio o salto de linea."
                  rows={4}
                  className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  disabled={sending}
                />
                <div className="text-xs text-slate-500">
                  Se eliminan espacios, signos y duplicados automaticamente.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={addNumbers} disabled={sending} data-testid="button-add-numbers">
                  Agregar numeros
                </Button>
                <Button
                  variant="outline"
                  onClick={removeInvalidNumbers}
                  disabled={sending || invalidNumbers.length === 0}
                >
                  Quitar invalidos
                </Button>
                <Button variant="ghost" onClick={clearNumbers} disabled={sending || numbers.length === 0}>
                  Limpiar lista
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                  Total: {numbers.length}
                </Badge>
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200">
                  Validos: {validNumbers.length}
                </Badge>
                <Badge variant="secondary" className="bg-red-500/20 text-red-200">
                  Invalidos: {invalidNumbers.length}
                </Badge>
                <span className="text-slate-500">Se enviara solo a numeros validos (8-15 digitos).</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 max-h-56 overflow-y-auto">
                {numbers.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin numeros cargados.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {numbers.map((num) => {
                      const invalid = !isValidNumber(num);
                      return (
                        <span
                          key={num}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-mono",
                            invalid
                              ? "border-red-500/60 bg-red-500/15 text-red-100"
                              : "border-slate-700 bg-slate-800/80 text-slate-100",
                          )}
                        >
                          {num}
                          <button
                            className="text-slate-400 hover:text-white"
                            onClick={() => removeNumber(num)}
                            disabled={sending}
                            aria-label={`Quitar ${num}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-cyan-400" />
                Contenido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-message" className="text-slate-200">
                  Mensaje de texto
                </Label>
                <Textarea
                  id="bulk-message"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe el mensaje que se enviara a todos."
                  rows={5}
                  className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  disabled={sending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-delay" className="text-slate-200">
                  Pausa entre numeros (segundos)
                </Label>
                <Input
                  id="bulk-delay"
                  type="number"
                  min={MIN_DELAY_SECONDS}
                  max={MAX_DELAY_SECONDS}
                  step={1}
                  value={delaySecondsInput}
                  onChange={(e) => setDelaySecondsInput(e.target.value)}
                  className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  disabled={sending}
                />
                <div className="text-xs text-slate-500">
                  Se espera {delaySeconds}s entre cada numero para evitar bloqueos.
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-video" className="text-slate-200">
                  Video (opcional)
                </Label>
                <Input
                  id="bulk-video"
                  type="file"
                  accept="video/mp4,video/quicktime,video/3gpp,video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  disabled={sending}
                  className="bg-slate-950/70 border-slate-700 text-slate-200"
                />
                {videoFile ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-cyan-300" />
                      <span className="truncate max-w-[220px]">{videoFile.name}</span>
                      <span className="text-slate-400">({formatBytes(videoFile.size)})</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-white"
                      onClick={() => setVideoFile(null)}
                      disabled={sending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <UploadCloud className="h-4 w-4" />
                    MP4, MOV o 3GP. Limite 64 MB antes de comprimir.
                  </div>
                )}
                {videoTooLarge && (
                  <div className="text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    El archivo supera 64 MB. Recortalo o comprime antes de enviar.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-caption" className="text-slate-200">
                  Texto del video (opcional)
                </Label>
                <Input
                  id="video-caption"
                  value={videoCaption}
                  onChange={(e) => setVideoCaption(e.target.value)}
                  placeholder="Texto corto para acompanar el video."
                  className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  disabled={sending || !videoFile}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/70 border-slate-700/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-400" />
              Envio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-500">Destinatarios validos</div>
                <div className="text-2xl font-semibold text-white">{validNumbers.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-500">Mensajes</div>
                <div className="text-2xl font-semibold text-white">
                  {hasMessage ? validNumbers.length : 0}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs text-slate-500">Videos</div>
                <div className="text-2xl font-semibold text-white">
                  {hasVideo ? validNumbers.length : 0}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSend} disabled={sending || totalOperations === 0 || videoTooLarge}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar ahora
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResults({});
                  setProgress({ total: 0, done: 0 });
                }}
                disabled={sending || !hasResults}
              >
                Limpiar resultado
              </Button>
            </div>

            {progressTotal > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Progreso: {progress.done}/{progressTotal}
                  </span>
                  <span>{progressValue}%</span>
                </div>
                <Progress value={progressValue} />
              </div>
            )}
          </CardContent>
        </Card>

        {hasResults && (
          <Card className="bg-slate-900/70 border-slate-700/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Resultados por numero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resultNumbers.map((num) => {
                const entry = results[num];
                if (!entry) return null;
                return (
                  <div
                    key={num}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-slate-200">{num}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {entry.text && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                              entry.text.status === "success"
                                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
                                : entry.text.status === "error"
                                  ? "border-red-500/60 bg-red-500/15 text-red-100"
                                  : "border-slate-600 bg-slate-800 text-slate-200",
                            )}
                          >
                            {entry.text.status === "pending" && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {entry.text.status === "error" && (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {entry.text.status === "success" && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Texto
                          </span>
                        )}
                        {entry.video && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                              entry.video.status === "success"
                                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-100"
                                : entry.video.status === "error"
                                  ? "border-red-500/60 bg-red-500/15 text-red-100"
                                  : "border-slate-600 bg-slate-800 text-slate-200",
                            )}
                          >
                            {entry.video.status === "pending" && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {entry.video.status === "error" && (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {entry.video.status === "success" && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Video
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-400">
                      {entry.text?.status === "error" && (
                        <div>Texto: {entry.text.error}</div>
                      )}
                      {entry.video?.status === "error" && (
                        <div>Video: {entry.video.error}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
