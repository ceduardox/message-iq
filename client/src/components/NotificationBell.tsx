import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

declare global {
  interface Window {
    subscribeToNotifications: () => Promise<{ success: boolean; subscribed?: boolean; reason?: string; message?: string }>;
    getNotificationStatus: () => { ready: boolean; permission: boolean; subscribed: boolean; error?: string | null };
    oneSignalReady: boolean;
  }
}

type NotificationState = "loading" | "subscribed" | "unsubscribed" | "denied";

export function NotificationBell() {
  const [status, setStatus] = useState<NotificationState>("loading");
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMac = /Macintosh|Mac OS X/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent);
  const isChrome = /Chrome|Chromium/.test(userAgent) && !/Edg\//.test(userAgent);

  const checkStatus = () => {
    if (window.getNotificationStatus) {
      const result = window.getNotificationStatus();
      console.log("[NotificationBell] Status check:", result);

      if (!result.ready) {
        setStatus("loading");
        return;
      }

      if (result.subscribed) {
        setStatus("subscribed");
      } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setStatus("denied");
      } else {
        setStatus("unsubscribed");
      }
    } else {
      setStatus("loading");
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      checkStatus();
      if (window.oneSignalReady) {
        clearInterval(timer);
      }
    }, 1000);

    checkStatus();
    return () => clearInterval(timer);
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (!window.subscribeToNotifications) {
        toast({
          title: "Cargando...",
          description: "El sistema de notificaciones se esta inicializando",
        });
        return;
      }

      const result = await window.subscribeToNotifications();
      console.log("[NotificationBell] Subscribe result:", result);

      if (result.success) {
        setStatus("subscribed");
        setShowDialog(false);
        toast({
          title: "Notificaciones activadas",
          description: "Recibiras alertas cuando lleguen mensajes nuevos",
        });
      } else {
        if (result.reason?.toLowerCase().includes("denied")) {
          setStatus("denied");
          toast({
            title: "Permiso denegado",
            description: "Revise permisos del navegador para habilitar notificaciones",
            variant: "destructive",
          });
        } else {
          toast({
            title: "No se pudo activar",
            description: result.reason || "Intenta de nuevo",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("[NotificationBell] Error:", error);
      toast({
        title: "Error",
        description: "No se pudieron activar las notificaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      checkStatus();
    }
  };

  const handleClick = () => {
    if (status === "subscribed") {
      toast({
        title: "Notificaciones activas",
        description: "Ya estas recibiendo notificaciones push",
      });
      return;
    }

    if (status === "denied") {
      setShowDialog(true);
      return;
    }

    handleSubscribe();
  };

  const getTooltipText = () => {
    switch (status) {
      case "subscribed":
        return "Notificaciones activas";
      case "denied":
        return "Notificaciones bloqueadas - click para mas info";
      case "loading":
        return "Cargando...";
      default:
        return "Activar notificaciones";
    }
  };

  const getDeniedTitle = () => {
    if (isMac && isSafari) return "Notificaciones bloqueadas en Safari (Mac)";
    if (isMac && isChrome) return "Notificaciones bloqueadas en Chrome (Mac)";
    return "Notificaciones bloqueadas";
  };

  const getDeniedSteps = () => {
    if (isMac && isSafari) {
      return [
        "Safari > Configuracion > Sitios web > Notificaciones.",
        `Busque este dominio exacto: ${hostname}.`,
        "Marque el sitio en Permitir.",
        "macOS > Configuracion del sistema > Notificaciones > Safari.",
        "Recargue la pagina y pulse Intentar de nuevo.",
      ];
    }

    if (isMac && isChrome) {
      return [
        "Chrome > Configuracion > Privacidad y seguridad > Configuracion de sitios > Notificaciones.",
        `Busque este dominio exacto: ${hostname}.`,
        "Si aparece en Bloqueado, paselo a Permitido.",
        "macOS > Configuracion del sistema > Notificaciones > Google Chrome.",
        "Recargue la pagina y pulse Intentar de nuevo.",
      ];
    }

    return [
      "Haga clic en el icono de candado/info en la barra de direcciones.",
      "Busque Notificaciones en permisos del sitio.",
      "Cambielo a Permitir.",
      "Recargue la pagina y pulse Intentar de nuevo.",
    ];
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            disabled={loading}
            data-testid="button-notification-bell"
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all ${
              status === "subscribed"
                ? "text-emerald-400 bg-emerald-500/20"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {status === "subscribed" ? (
              <Bell className="h-5 w-5" />
            ) : status === "denied" ? (
              <BellOff className="h-5 w-5 text-red-400" />
            ) : loading || status === "loading" ? (
              <BellRing className="h-5 w-5 animate-pulse" />
            ) : (
              <BellOff className="h-5 w-5" />
            )}
            <span className="text-[10px] mt-0.5 font-medium">Notif</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDeniedTitle()}</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>Las notificaciones estan bloqueadas en este navegador.</p>
              <p className="text-xs text-muted-foreground">
                Dominio detectado: <strong>{hostname || "desconocido"}</strong>
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {getDeniedSteps().map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
              {isMac && (
                <p className="text-xs text-muted-foreground pt-1">
                  Si el sitio no aparece en la lista, abra en pestana normal (no privada), recargue y vuelva a pulsar Notif.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Entendido
            </Button>
            <Button
              onClick={() => {
                setShowDialog(false);
                handleSubscribe();
              }}
            >
              Intentar de nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
