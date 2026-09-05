import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  ArrowLeft, 
  Bot, 
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Pencil,
  Package,
  X,
  Check,
  MessageSquare,
  Clock,
  Eye,
  EyeOff,
  Megaphone
} from "lucide-react";

interface AiSettings {
  id?: number;
  enabled: boolean;
  systemPrompt: string | null;
  catalog: string | null;
  maxTokens: number | null;
  temperature: number | null;
  aiProvider: string | null;
  model: string | null;
  maxPromptChars: number | null;
  conversationHistory: number | null;
  audioResponseEnabled: boolean | null;
  audioMode: string | null;
  audioVoice: string | null;
  ttsProvider: string | null;
  elevenlabsVoiceId: string | null;
  fishVoiceId: string | null;
  fishApiKey: string | null;
  ttsSpeed: number | null;
  ttsExpression: number | null;
  ttsInstructions: string | null;
  learningMode: boolean | null;
  followUpEnabled: boolean | null;
  followUpMinutes: number | null;
  followUpStage2Enabled: boolean | null;
  followUpStage2Message: string | null;
  followUpStage2Hours: number | null;
}

interface PromptProfiles {
  primaryPrompt: string;
  secondaryPrompt: string;
  activeSlot: "primary" | "secondary";
}

interface Product {
  id: number;
  name: string;
  keywords: string | null;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
  imageBottleUrl?: string | null;
  imageDoseUrl?: string | null;
  imageIngredientsUrl?: string | null;
  createdAt: string;
}

interface AiLog {
  id: number;
  conversationId: number | null;
  userMessage: string | null;
  aiResponse: string | null;
  tokensUsed: number | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

interface LearnedRule {
  id: number;
  rule: string;
  learnedFrom: string | null;
  conversationId: number | null;
  isActive: boolean;
  createdAt: string;
}

interface AdBanner {
  id: number;
  adId: string;
  problemText: string;
  imageUrl: string | null;
  segment: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PushLog {
  timestamp: string;
  title: string;
  message: string;
  event: string;
  success: boolean;
  error?: string;
}

interface PushSettings {
  notifyNewMessages: boolean;
  notifyPending: boolean;
}

export default function AIAgentPage() {
  const { toast } = useToast();
  const [primaryPrompt, setPrimaryPrompt] = useState("");
  const [secondaryPrompt, setSecondaryPrompt] = useState("");
  const [activePromptSlot, setActivePromptSlot] = useState<"primary" | "secondary">("primary");
  const [promptEdited, setPromptEdited] = useState(false);
  
  // AI config state
  const [maxTokens, setMaxTokens] = useState(120);
  const [temperature, setTemperature] = useState(70);
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [maxPromptChars, setMaxPromptChars] = useState(2000);
  const [conversationHistory, setConversationHistory] = useState(3);
  const [audioResponseEnabled, setAudioResponseEnabled] = useState(false);
  const [audioMode, setAudioMode] = useState("first");
  const [audioVoice, setAudioVoice] = useState("nova");
  const [ttsProvider, setTtsProvider] = useState("openai");
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("JBFqnCBsd6RMkjVDRZzb");
  const [fishVoiceId, setFishVoiceId] = useState("");
  const [fishApiKey, setFishApiKey] = useState("");
  const [showFishApiKey, setShowFishApiKey] = useState(false);
  const [fishGenderFilter, setFishGenderFilter] = useState("all");
  const [fishNationalityFilter, setFishNationalityFilter] = useState("all");
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(100);
  const [ttsExpression, setTtsExpression] = useState(70);
  const [ttsInstructions, setTtsInstructions] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpMinutes, setFollowUpMinutes] = useState(20);
  const [followUpStage2Enabled, setFollowUpStage2Enabled] = useState(true);
  const [followUpStage2Message, setFollowUpStage2Message] = useState("Conoce más de IQeXponencial: www.iqexponencial.com, testimonios en TikTok y testimonios en Facebook");
  const [followUpStage2Hours, setFollowUpStage2Hours] = useState(5);
  const [configEdited, setConfigEdited] = useState(false);

  const openAiModelOptions = [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (rapido, economico)" },
    { value: "gpt-4o", label: "GPT-4o (mas inteligente)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ];
  const geminiModelOptions = [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (rapido)" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (economico)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (mas completo)" },
  ];
  const modelOptions = aiProvider === "gemini" ? geminiModelOptions : openAiModelOptions;

  const getDefaultModelForProvider = (provider: "openai" | "gemini") =>
    provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini";
  
  // Product form state
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageBottleUrl, setNewImageBottleUrl] = useState("");
  const [newImageDoseUrl, setNewImageDoseUrl] = useState("");
  const [newImageIngredientsUrl, setNewImageIngredientsUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});
  
  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageBottleUrl, setEditImageBottleUrl] = useState("");
  const [editImageDoseUrl, setEditImageDoseUrl] = useState("");
  const [editImageIngredientsUrl, setEditImageIngredientsUrl] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<AiSettings>({
    queryKey: ["/api/ai/settings"],
  });

  const { data: promptProfiles } = useQuery<PromptProfiles>({
    queryKey: ["/api/ai/prompt-profiles"],
  });

  interface ElevenLabsVoice {
    voice_id: string;
    name: string;
    category: string;
    labels: Record<string, string>;
    preview_url: string;
    source?: "library" | "shared";
  }

  const { data: elevenLabsVoices = [], isLoading: elVoicesLoading, isError: elVoicesError } = useQuery<ElevenLabsVoice[]>({
    queryKey: ["/api/elevenlabs/voices"],
    enabled: ttsProvider === "elevenlabs" && audioResponseEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const { data: fishVoices = [], isLoading: fishVoicesLoading, isError: fishVoicesError } = useQuery<ElevenLabsVoice[]>({
    queryKey: ["/api/fish/voices"],
    enabled: ttsProvider === "fish" && audioResponseEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<AiLog[]>({
    queryKey: ["/api/ai/logs"],
    refetchInterval: 10000,
  });

  const { data: learnedRules = [], isLoading: rulesLoading } = useQuery<LearnedRule[]>({
    queryKey: ["/api/ai/rules"],
  });

  const { data: adBanners = [], isLoading: bannersLoading } = useQuery<AdBanner[]>({
    queryKey: ["/api/ad-banners"],
  });

  const { data: pushLogs = [], isLoading: pushLogsLoading, refetch: refetchPushLogs } = useQuery<PushLog[]>({
    queryKey: ["/api/push-logs"],
    refetchInterval: 10000,
  });
  const { data: pushSettings } = useQuery<PushSettings>({
    queryKey: ["/api/push-settings"],
  });

  const openAiVoiceOptions = [
    { value: "marin", label: "Marin", desc: "Realista", realistic: true },
    { value: "cedar", label: "Cedar", desc: "Realista", realistic: true },
    { value: "ash", label: "Ash", desc: "Realista", realistic: true },
    { value: "ballad", label: "Ballad", desc: "Realista", realistic: true },
    { value: "sage", label: "Sage", desc: "Realista", realistic: true },
    { value: "verse", label: "Verse", desc: "Realista", realistic: true },
    { value: "coral", label: "Coral", desc: "Basica", realistic: false },
    { value: "nova", label: "Nova", desc: "Basica", realistic: false },
    { value: "alloy", label: "Alloy", desc: "Basica", realistic: false },
    { value: "echo", label: "Echo", desc: "Basica", realistic: false },
    { value: "shimmer", label: "Shimmer", desc: "Basica", realistic: false },
    { value: "fable", label: "Fable", desc: "Basica", realistic: false },
    { value: "onyx", label: "Onyx", desc: "Basica", realistic: false },
  ];
  const normalizedVoiceSearch = voiceSearchQuery.toLowerCase().trim();
  const filteredOpenAiVoices = openAiVoiceOptions.filter((voice) => {
    if (!normalizedVoiceSearch) return true;
    return (
      voice.label.toLowerCase().includes(normalizedVoiceSearch) ||
      voice.desc.toLowerCase().includes(normalizedVoiceSearch) ||
      voice.value.toLowerCase().includes(normalizedVoiceSearch)
    );
  });
  const filteredElevenLabsVoices = elevenLabsVoices.filter((voice) => {
    if (!normalizedVoiceSearch) return true;
    const description = String(
      voice.labels?.description || voice.labels?.accent || voice.labels?.use_case || voice.category || "",
    ).toLowerCase();
    return (
      voice.name.toLowerCase().includes(normalizedVoiceSearch) ||
      description.includes(normalizedVoiceSearch) ||
      voice.voice_id.toLowerCase().includes(normalizedVoiceSearch)
    );
  });

  // State for editing rules
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editRuleText, setEditRuleText] = useState("");

  // State for ad banners modal
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerModalMode, setBannerModalMode] = useState<"create" | "edit">("create");
  const [bannerEditingId, setBannerEditingId] = useState<number | null>(null);
  const [bannerAdId, setBannerAdId] = useState("");
  const [bannerProblemText, setBannerProblemText] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerSegment, setBannerSegment] = useState("");

  const resetBannerForm = () => {
    setBannerModalMode("create");
    setBannerEditingId(null);
    setBannerAdId("");
    setBannerProblemText("");
    setBannerImageUrl("");
    setBannerSegment("");
  };

  const openCreateBanner = () => {
    resetBannerForm();
    setBannerModalOpen(true);
  };

  const openEditBanner = (banner: AdBanner) => {
    setBannerModalMode("edit");
    setBannerEditingId(banner.id);
    setBannerAdId(banner.adId);
    setBannerProblemText(banner.problemText);
    setBannerImageUrl(banner.imageUrl || "");
    setBannerSegment(banner.segment || "");
    setBannerModalOpen(true);
  };

  const createBannerMutation = useMutation({
    mutationFn: async (data: { adId: string; problemText: string; imageUrl: string | null; segment: string | null }) => {
      return apiRequest("POST", "/api/ad-banners", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-banners"] });
      setBannerModalOpen(false);
      resetBannerForm();
      toast({ title: "Banner guardado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar banner", description: error.message, variant: "destructive" });
    },
  });

  const updateBannerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AdBanner> }) => {
      return apiRequest("PATCH", `/api/ad-banners/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-banners"] });
      setBannerModalOpen(false);
      resetBannerForm();
      toast({ title: "Banner actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar banner", description: error.message, variant: "destructive" });
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ad-banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-banners"] });
      toast({ title: "Banner eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar banner", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveBanner = () => {
    if (!bannerAdId.trim()) {
      toast({ title: "El ID del anuncio es requerido", variant: "destructive" });
      return;
    }
    if (!bannerProblemText.trim()) {
      toast({ title: "El texto del anuncio es requerido", variant: "destructive" });
      return;
    }
    const payload = {
      adId: bannerAdId.trim(),
      problemText: bannerProblemText.trim(),
      imageUrl: bannerImageUrl.trim() || null,
      segment: bannerSegment.trim() || null,
    };
    if (bannerModalMode === "edit" && bannerEditingId !== null) {
      updateBannerMutation.mutate({ id: bannerEditingId, data: payload });
    } else {
      createBannerMutation.mutate(payload);
    }
  };

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ai/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/rules"] });
      toast({ title: "Regla eliminada" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, rule, isActive }: { id: number; rule?: string; isActive?: boolean }) => {
      return apiRequest("PATCH", `/api/ai/rules/${id}`, { rule, isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/rules"] });
      toast({ title: "Regla actualizada" });
      setEditingRuleId(null);
    },
  });

  const updatePushSettingsMutation = useMutation({
    mutationFn: async (data: Partial<PushSettings>) => {
      return apiRequest("PATCH", "/api/push-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/push-settings"] });
      toast({ title: "Preferencias de push guardadas" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar push", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (promptProfiles && !promptEdited) {
      setPrimaryPrompt(promptProfiles.primaryPrompt || "");
      setSecondaryPrompt(promptProfiles.secondaryPrompt || "");
      setActivePromptSlot(promptProfiles.activeSlot || "primary");
    }
    if (settings && !configEdited) {
      setMaxTokens(settings.maxTokens || 120);
      setTemperature(settings.temperature || 70);
      const provider = settings.aiProvider === "gemini" ? "gemini" : "openai";
      setAiProvider(provider);
      setModel(settings.model || getDefaultModelForProvider(provider));
      setMaxPromptChars(settings.maxPromptChars || 2000);
      setConversationHistory(settings.conversationHistory || 3);
      setAudioResponseEnabled(settings.audioResponseEnabled || false);
      setAudioMode(settings.audioMode || "first");
      setAudioVoice(settings.audioVoice || "nova");
      setTtsProvider(settings.ttsProvider || "openai");
      setElevenlabsVoiceId(settings.elevenlabsVoiceId || "JBFqnCBsd6RMkjVDRZzb");
      setFishVoiceId(settings.fishVoiceId || "");
      setFishApiKey(settings.fishApiKey || "");
      setTtsSpeed(settings.ttsSpeed || 100);
      setTtsExpression(settings.ttsExpression ?? 70);
      setTtsInstructions(settings.ttsInstructions || "");
      setFollowUpEnabled(settings.followUpEnabled || false);
      setFollowUpMinutes(settings.followUpMinutes || 20);
      setFollowUpStage2Enabled(settings.followUpStage2Enabled !== false);
      setFollowUpStage2Message(settings.followUpStage2Message || "Conoce más de IQeXponencial: www.iqexponencial.com, testimonios en TikTok y testimonios en Facebook");
      setFollowUpStage2Hours(Math.min(6, Math.max(1, Number(settings.followUpStage2Hours) || 5)));
    }
  }, [settings, promptProfiles, promptEdited, configEdited]);

  useEffect(() => {
    const validModels = new Set(modelOptions.map((option) => option.value));
    if (!validModels.has(model)) {
      setModel(getDefaultModelForProvider(aiProvider));
      setConfigEdited(true);
    }
  }, [aiProvider]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AiSettings>) => {
      return apiRequest("PATCH", "/api/ai/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "Configuración guardada" });
      setConfigEdited(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    },
  });

  const updatePromptProfilesMutation = useMutation({
    mutationFn: async (data: PromptProfiles) => {
      const response = await apiRequest("PATCH", "/api/ai/prompt-profiles", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/prompt-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "Prompts guardados" });
      setPromptEdited(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar prompts", description: error.message, variant: "destructive" });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setNewName("");
      setNewKeywords("");
      setNewDescription("");
      setNewPrice("");
      setNewImageUrl("");
      setNewImageBottleUrl("");
      setNewImageDoseUrl("");
      setNewImageIngredientsUrl("");
      setUploadProgress({});
      setUploadingSlots({});
      toast({ title: "Elemento agregado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al agregar el elemento", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Product> }) => {
      return apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingId(null);
      toast({ title: "Elemento actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar el elemento", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Elemento eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar el elemento", description: error.message, variant: "destructive" });
    },
  });

  const handleToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ enabled });
  };

  const handleSavePrompt = () => {
    updatePromptProfilesMutation.mutate({
      primaryPrompt,
      secondaryPrompt,
      activeSlot: activePromptSlot,
    });
  };

  const handleSaveConfig = () => {
    console.log("Saving config:", { maxTokens, temperature, model, maxPromptChars, conversationHistory });
    updateSettingsMutation.mutate({ aiProvider, maxTokens, temperature, model, maxPromptChars, conversationHistory, audioResponseEnabled, audioMode, audioVoice, ttsProvider, elevenlabsVoiceId, fishVoiceId, fishApiKey: fishApiKey.trim() || null, ttsSpeed, ttsExpression, ttsInstructions: ttsInstructions || null, followUpEnabled, followUpMinutes, followUpStage2Enabled, followUpStage2Message: followUpStage2Message.trim() || null, followUpStage2Hours });
  };

  const playVoicePreview = async () => {
    try {
      setPreviewPlaying(true);
      const payload =
        ttsProvider === "elevenlabs"
          ? {
              provider: "elevenlabs",
              elevenlabsVoiceId,
              text: "Hola, esta es una prueba de voz para tu CRM.",
            }
          : ttsProvider === "fish"
          ? {
              provider: "fish",
              fishVoiceId,
              speed: ttsSpeed,
              expression: ttsExpression,
              text: "Hola, esta es una prueba de voz para tu CRM.",
            }
          : {
              provider: "openai",
              voice: audioVoice,
              speed: ttsSpeed,
              instructions: ttsInstructions || null,
              text: "Hola, esta es una prueba de voz para tu CRM.",
            };

      const response = await fetch("/api/tts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = "No se pudo generar la muestra de voz";
        try {
          const errorData = await response.json();
          message = errorData.details || errorData.message || message;
        } catch {
          message = await response.text();
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPreviewPlaying(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPreviewPlaying(false);
        toast({ title: "Error", description: "No se pudo reproducir la muestra", variant: "destructive" });
      };
      await audio.play();
    } catch (error: any) {
      setPreviewPlaying(false);
      toast({
        title: "Error al generar muestra",
        description: error?.message || "No se pudo generar la muestra de voz",
        variant: "destructive",
      });
    }
  };

  const uploadProductImageWithProgress = (file: File, slotKey: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("image", file);
      const xhr = new XMLHttpRequest();

      setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));
      setUploadProgress((prev) => ({ ...prev, [slotKey]: 0 }));

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress((prev) => ({ ...prev, [slotKey]: percent }));
      };

      xhr.onerror = () => {
        setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
        reject(new Error("No se pudo subir la imagen"));
      };

      xhr.onload = () => {
        setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(xhr.responseText || "Error subiendo imagen"));
          return;
        }
        try {
          const parsed = JSON.parse(xhr.responseText) as { url?: string };
          if (!parsed.url) {
            reject(new Error("Respuesta de subida sin URL"));
            return;
          }
          setUploadProgress((prev) => ({ ...prev, [slotKey]: 100 }));
          resolve(parsed.url);
        } catch {
          reject(new Error("Respuesta invalida del servidor al subir imagen"));
        }
      };

      xhr.open("POST", "/api/products/upload-image");
      xhr.withCredentials = true;
      xhr.send(formData);
    });

  const handleSelectAndUploadProductImage = async (
    file: File | null,
    slotKey: string,
    setter: (url: string) => void
  ) => {
    if (!file) return;
    try {
      const uploadedUrl = await uploadProductImageWithProgress(file, slotKey);
      setter(uploadedUrl);
      toast({ title: "Imagen subida", description: uploadedUrl });
    } catch (error: any) {
      toast({
        title: "Error al subir imagen",
        description: error?.message || "No se pudo subir la imagen",
        variant: "destructive",
      });
    }
  };

  const resolveProductImageUrl = (rawUrl?: string | null) => {
    const value = (rawUrl || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) {
      if (typeof window !== "undefined") {
        return `${window.location.origin}${value}`;
      }
      return `https://iqexcelencia.com${value}`;
    }
    return value;
  };

  const renderImagePreview = (rawUrl: string, label: string, testId: string) => {
    const absoluteUrl = resolveProductImageUrl(rawUrl);
    if (!absoluteUrl) return null;
    return (
      <div className="rounded-md border border-slate-700/50 bg-slate-950/60 p-2 space-y-1" data-testid={testId}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-300">{label}</span>
          <a href={absoluteUrl} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-300 hover:text-cyan-200 underline">
            Abrir
          </a>
        </div>
        <img
          src={absoluteUrl}
          alt={label}
          className="h-16 w-16 rounded object-cover border border-slate-700/60 bg-slate-900"
          loading="lazy"
        />
        <p className="text-[10px] text-slate-400 break-all">{absoluteUrl}</p>
      </div>
    );
  };

  const handleAddProduct = () => {
    if (!newName.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }
    createProductMutation.mutate({
      name: newName,
      keywords: newKeywords || null,
      description: newDescription || null,
      price: newPrice || null,
      imageUrl: newImageUrl || null,
      imageBottleUrl: newImageBottleUrl || null,
      imageDoseUrl: newImageDoseUrl || null,
      imageIngredientsUrl: newImageIngredientsUrl || null,
    });
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditKeywords(product.keywords || "");
    setEditDescription(product.description || "");
    setEditPrice(product.price || "");
    setEditImageUrl(product.imageUrl || "");
    setEditImageBottleUrl(product.imageBottleUrl || "");
    setEditImageDoseUrl(product.imageDoseUrl || "");
    setEditImageIngredientsUrl(product.imageIngredientsUrl || "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateProductMutation.mutate({
      id: editingId,
      data: {
        name: editName,
        keywords: editKeywords || null,
        description: editDescription || null,
        price: editPrice || null,
        imageUrl: editImageUrl || null,
        imageBottleUrl: editImageBottleUrl || null,
        imageDoseUrl: editImageDoseUrl || null,
        imageIngredientsUrl: editImageIngredientsUrl || null,
      },
    });
  };

  if (settingsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Futuristic Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-r from-slate-800/90 via-slate-800/80 to-slate-800/90 backdrop-blur-xl border-b border-emerald-500/20">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-emerald-500/5" />
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 relative">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Agente IA</h1>
              <p className="text-xs text-slate-400">Configuración inteligente</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-sm font-medium ${settings?.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
              {settings?.enabled ? "Activo" : "Inactivo"}
            </span>
            <Switch
              checked={settings?.enabled || false}
              onCheckedChange={handleToggle}
              disabled={updateSettingsMutation.isPending}
              data-testid="switch-ai-enabled"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl pb-20">
        {/* Instructions Card - 3D Style */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Instrucciones del Agente</h3>
                <p className="text-xs text-slate-400">Define cómo debe comportarse (máx: {maxPromptChars} caracteres)</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="active-prompt-slot" className="text-slate-300">Prompt activo</Label>
                <Select
                  value={activePromptSlot}
                  onValueChange={(value: "primary" | "secondary") => {
                    setActivePromptSlot(value);
                    setPromptEdited(true);
                  }}
                >
                  <SelectTrigger
                    id="active-prompt-slot"
                    className="bg-slate-900/50 border-slate-600/50 text-white"
                    data-testid="select-active-prompt-slot"
                  >
                    <SelectValue placeholder="Seleccione prompt" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600/70 text-white">
                    <SelectItem value="primary">Prompt principal</SelectItem>
                    <SelectItem value="secondary">Prompt alternativo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  El prompt activo es el que usa la IA ahora. El otro queda guardado para cuando quiera volver a usarlo.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="primary-prompt" className="text-slate-300">Prompt principal</Label>
                    {activePromptSlot === "primary" && (
                      <span className="text-[11px] font-medium text-emerald-300">Activo ahora</span>
                    )}
                  </div>
                  <Textarea
                    id="primary-prompt"
                    placeholder="Ej: Eres {{AGENT_NAME}}, asesor de ventas de [empresa]. Responde siempre en español. Si el cliente necesita opciones, usa [BOTONES:] o [LISTA:]."
                    value={primaryPrompt}
                    onChange={(e) => {
                      const newValue = e.target.value.slice(0, maxPromptChars);
                      setPrimaryPrompt(newValue);
                      setPromptEdited(true);
                    }}
                    rows={6}
                    data-testid="textarea-primary-prompt"
                    className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500"
                  />
                  <div className={`text-xs ${primaryPrompt.length >= maxPromptChars ? 'text-red-400' : 'text-slate-500'}`}>
                    {primaryPrompt.length} / {maxPromptChars} caracteres
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="secondary-prompt" className="text-slate-300">Prompt alternativo</Label>
                    {activePromptSlot === "secondary" && (
                      <span className="text-[11px] font-medium text-cyan-300">Activo ahora</span>
                    )}
                  </div>
                  <Textarea
                    id="secondary-prompt"
                    placeholder="Ej: Flujo alternativo (soporte, reclutamiento, FAQs)."
                    value={secondaryPrompt}
                    onChange={(e) => {
                      const newValue = e.target.value.slice(0, maxPromptChars);
                      setSecondaryPrompt(newValue);
                      setPromptEdited(true);
                    }}
                    rows={6}
                    data-testid="textarea-secondary-prompt"
                    className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500"
                  />
                  <div className={`text-xs ${secondaryPrompt.length >= maxPromptChars ? 'text-red-400' : 'text-slate-500'}`}>
                    {secondaryPrompt.length} / {maxPromptChars} caracteres
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  {"Tip: puedes usar {{AGENT_NAME}} o {{NOMBRE_AGENTE}} en el prompt para insertar el nombre del asesor."}
                </p>
              </div>
            </div>
            {promptEdited && (
              <Button onClick={handleSavePrompt} disabled={updatePromptProfilesMutation.isPending} data-testid="button-save-prompt" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/30">
                {updatePromptProfilesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar Prompts
              </Button>
            )}
          </div>
        </div>

        {/* Ad Banners Card */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent rounded-2xl" />
          <div className="relative space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Publicidad / Banners</h3>
                  <p className="text-xs text-slate-400">Conecta cada anuncio (ad_id) con lo que dice, para que la IA enganche con el problema</p>
                </div>
              </div>
              <Button
                onClick={openCreateBanner}
                data-testid="button-add-ad-banner"
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/30"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo anuncio
              </Button>
            </div>

            {bannersLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : adBanners.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {adBanners.map((banner) => (
                  <div
                    key={banner.id}
                    className={`p-3 border rounded-xl bg-slate-900/50 ${!banner.isActive ? "opacity-50" : ""}`}
                    data-testid={`ad-banner-${banner.id}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3">
                      {banner.imageUrl ? (
                        <img
                          src={banner.imageUrl}
                          alt="Banner"
                          className="h-12 w-12 rounded object-cover border border-slate-700/60 bg-slate-900 flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-slate-800 flex items-center justify-center border border-slate-700/60 flex-shrink-0">
                          <Megaphone className="h-5 w-5 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs bg-black/40 rounded px-1.5 py-0.5 text-cyan-300 break-all">{banner.adId}</code>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${banner.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600/20 text-slate-400"}`}>
                            {banner.isActive ? "Activo" : "Inactivo"}
                          </span>
                          {banner.segment && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">{banner.segment}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 mt-1">"{banner.problemText}"</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 sm:mt-0">
                        <Switch
                          checked={banner.isActive}
                          onCheckedChange={(checked) => updateBannerMutation.mutate({ id: banner.id, data: { isActive: checked } })}
                          data-testid={`switch-ad-banner-active-${banner.id}`}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEditBanner(banner)} data-testid={`button-edit-ad-banner-${banner.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBannerMutation.mutate(banner.id)}
                          disabled={deleteBannerMutation.isPending}
                          data-testid={`button-delete-ad-banner-${banner.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay anuncios configurados. Agrega el ad_id de Meta y qué dice cada publicidad para que la IA conecte con el problema.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Para obtener el ID de un anuncio: Meta Ads Manager → campaña → columna "ID del anuncio". Solo se inyecta a la IA si el banner está <span className="text-emerald-400">Activo</span>.
            </p>
          </div>
        </div>

        {/* Interactive Messages Guide */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-violet-500/5 to-transparent rounded-2xl" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Botones y Listas Interactivas</h3>
                <p className="text-xs text-slate-400">Usa estos formatos en las instrucciones para que el agente envíe botones o listas</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/30">
                <p className="text-violet-400 font-medium mb-1">Botones de respuesta rápida (máx. 3)</p>
                <code className="text-xs text-slate-300 block bg-black/30 rounded p-2">
                  [BOTONES: Opción 1, Opción 2, Opción 3]
                </code>
                <p className="text-xs text-slate-400 mt-2">Ejemplo en instrucciones: <em className="text-slate-300">"Cuando el cliente pregunte por productos o servicios, responde: ¿Que te interesa? [BOTONES: Ver opciones, Ver precios, Hablar con asesor]"</em></p>
                <p className="text-xs text-yellow-400/80 mt-1">Máx. 20 caracteres por botón. El cliente toca y su respuesta llega al IA.</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/30">
                <p className="text-violet-400 font-medium mb-1">Lista de opciones (máx. 10)</p>
                <code className="text-xs text-slate-300 block bg-black/30 rounded p-2">
                  [LISTA: Título del botón | Opción 1, Opción 2, Opción 3, ...]
                </code>
                <p className="text-xs text-slate-400 mt-2">Ejemplo en instrucciones: <em className="text-slate-300">"Cuando pregunten que hay disponible, responde: Estas son nuestras opciones: [LISTA: Ver opciones | Producto A, Servicio B, Opcion C]"</em></p>
                <p className="text-xs text-yellow-400/80 mt-1">El título del botón máx. 20 caracteres. Cada opción máx. 24 caracteres.</p>
              </div>
              <p className="text-xs text-slate-400">El texto antes de [BOTONES:] o [LISTA:] se envía como mensaje. Cuando el cliente elige una opción, el IA recibe el texto de la opción elegida y responde según tus instrucciones.</p>
            </div>
          </div>
        </div>

        {/* Model Config Card - 3D Style */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent rounded-2xl" />
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Configuración del Modelo</h3>
                <p className="text-xs text-slate-400">Ajusta tokens, creatividad, modelo y contexto</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="maxTokens" className="text-slate-300">Máx. Tokens (respuesta)</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min={50}
                  max={500}
                  value={maxTokens}
                  onChange={(e) => {
                    setMaxTokens(parseInt(e.target.value) || 120);
                    setConfigEdited(true);
                  }}
                  data-testid="input-max-tokens"
                  className="bg-slate-800/50 border-slate-600/50 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">50-500. Más tokens = respuestas más largas</p>
              </div>
              <div>
                <Label htmlFor="temperature" className="text-slate-300">Temperatura (%)</Label>
                <Input
                  id="temperature"
                  type="number"
                  min={0}
                  max={100}
                  value={temperature}
                  onChange={(e) => {
                    setTemperature(parseInt(e.target.value) || 70);
                    setConfigEdited(true);
                  }}
                  data-testid="input-temperature"
                  className="bg-slate-800/50 border-slate-600/50 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">0=preciso, 100=creativo</p>
              </div>
              <div>
                <Label className="text-slate-300">Proveedor de respuesta</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiProvider("openai");
                      setConfigEdited(true);
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      aiProvider === "openai"
                        ? "border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/10"
                        : "border-slate-600/50 bg-slate-800/50 hover:border-emerald-500/40"
                    }`}
                    data-testid="provider-response-openai"
                  >
                    <div className="font-semibold text-sm text-white">OpenAI</div>
                    <div className="text-xs text-slate-400">Actual y estable</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiProvider("gemini");
                      setConfigEdited(true);
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      aiProvider === "gemini"
                        ? "border-cyan-500 bg-cyan-500/15 shadow-lg shadow-cyan-500/10"
                        : "border-slate-600/50 bg-slate-800/50 hover:border-cyan-500/40"
                    }`}
                    data-testid="provider-response-gemini"
                  >
                    <div className="font-semibold text-sm text-white">Gemini</div>
                    <div className="text-xs text-slate-400">Test con rollback rapido</div>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Solo cambia la IA que redacta. El audio sigue aparte.</p>
              </div>
              <div>
                <Label htmlFor="model" className="text-slate-300">Modelo</Label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setConfigEdited(true);
                  }}
                  className="w-full h-9 rounded-md border border-slate-600/50 bg-slate-800/50 px-3 text-sm text-white"
                  data-testid="select-model"
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {aiProvider === "gemini" ? "Modelo de Gemini para testeo" : "Modelo de OpenAI a usar"}
                </p>
              </div>
              <div>
                <Label htmlFor="maxPromptChars" className="text-slate-300">Máx. Caracteres (instrucciones)</Label>
                <Input
                  id="maxPromptChars"
                  type="number"
                  min={500}
                  max={20000}
                  value={maxPromptChars}
                  onChange={(e) => {
                    setMaxPromptChars(parseInt(e.target.value) || 2000);
                    setConfigEdited(true);
                  }}
                  data-testid="input-max-prompt-chars"
                  className="bg-slate-800/50 border-slate-600/50 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">500-20000. Límite de texto en instrucciones</p>
              </div>
              <div>
                <Label htmlFor="conversationHistory" className="text-slate-300">Mensajes de contexto</Label>
                <Input
                  id="conversationHistory"
                  type="number"
                  min={1}
                  max={20}
                  value={conversationHistory}
                  onChange={(e) => {
                    setConversationHistory(parseInt(e.target.value) || 3);
                    setConfigEdited(true);
                  }}
                  data-testid="input-conversation-history"
                  className="bg-slate-800/50 border-slate-600/50 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">1-20. Cuántos mensajes previos lee la IA</p>
              </div>
            </div>
            
            <div className="hidden items-center justify-between p-4 border border-slate-700/50 rounded-xl bg-slate-800/30">
              <div className="space-y-1">
                <Label htmlFor="fixedCommerceFlow" className="text-slate-300">Usar Flujo Comercial Fijo</Label>
                <p className="text-xs text-slate-500">
                  Mantiene activos los menus y respuestas fijas del CRM. Si el prompt tiene instrucciones, este flujo se ignora. Para usar solo el prompt del cliente y sus botones, desactívalo.
                </p>
              </div>
              <Switch
                id="fixedCommerceFlow"
                checked={false}
                onCheckedChange={() => {}}
                data-testid="switch-fixed-commerce-flow"
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-slate-700/50 rounded-xl bg-slate-800/30">
              <div className="space-y-1">
                <Label htmlFor="audioResponse" className="text-slate-300">Responder con Audio</Label>
                <p className="text-xs text-slate-500">
                  Activa la voz en las respuestas de la IA
                </p>
              </div>
              <Switch
                id="audioResponse"
                checked={audioResponseEnabled}
                onCheckedChange={(checked) => {
                  setAudioResponseEnabled(checked);
                  setConfigEdited(true);
                }}
                data-testid="switch-audio-response"
              />
            </div>

            {audioResponseEnabled && (
              <div className="space-y-3 p-4 border border-slate-700/50 rounded-xl bg-slate-800/30">
                <div className="space-y-2">
                  <Label className="text-slate-300">Cuándo usar audio</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { value: "all", label: "Todas las respuestas", desc: "La IA responde con voz en cada mensaje" },
                      { value: "first", label: "Solo primera respuesta", desc: "Voz solo en el primer mensaje de la conversación" },
                      { value: "until_second", label: "Hasta la segunda respuesta", desc: "Voz en las 2 primeras respuestas" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { setAudioMode(option.value); setConfigEdited(true); }}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          audioMode === option.value
                            ? "border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/10"
                            : "border-slate-600/50 bg-slate-800/50 hover:border-emerald-500/40"
                        }`}
                        data-testid={`audio-mode-${option.value}`}
                      >
                        <div className="font-semibold text-sm text-white">{option.label}</div>
                        <div className="text-xs text-slate-400">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-400/80">
                    Regla fija: si la respuesta habla de precios o costos, NO se envía audio (se envía texto), sin importar la opción elegida.
                  </p>
                </div>
              </div>
            )}
            
            {audioResponseEnabled && (
              <div className="space-y-3">
                <Label className="font-medium text-slate-300">Proveedor de Voz</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTtsProvider("openai"); setConfigEdited(true); }}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                      ttsProvider === "openai"
                        ? "border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                        : "border-slate-600/50 bg-slate-800/50 hover:border-cyan-500/50"
                    }`}
                    data-testid="provider-openai"
                  >
                    <div className="font-semibold text-sm text-white">OpenAI</div>
                    <div className="text-xs text-slate-400">Voces básicas y realistas</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTtsProvider("elevenlabs"); setConfigEdited(true); }}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                      ttsProvider === "elevenlabs"
                        ? "border-violet-500 bg-violet-500/20 shadow-lg shadow-violet-500/20"
                        : "border-slate-600/50 bg-slate-800/50 hover:border-violet-500/50"
                    }`}
                    data-testid="provider-elevenlabs"
                  >
                    <div className="font-semibold text-sm text-white">ElevenLabs</div>
                    <div className="text-xs text-slate-400">Voces ultra-realistas</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTtsProvider("fish"); setConfigEdited(true); }}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                      ttsProvider === "fish"
                        ? "border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                        : "border-slate-600/50 bg-slate-800/50 hover:border-emerald-500/50"
                    }`}
                    data-testid="provider-fish"
                  >
                    <div className="font-semibold text-sm text-white">Fish Audio</div>
                    <div className="text-xs text-slate-400">Voces realistas (S2.1)</div>
                  </button>
                </div>

                                {ttsProvider === "openai" && (
                  <>
                    <Label className="font-medium text-slate-300">Voz de OpenAI</Label>
                    <p className="text-xs text-slate-500">Voces realistas usan modelo avanzado (mayor calidad y costo)</p>
                    <Input
                      type="text"
                      placeholder="Buscar voz OpenAI..."
                      value={voiceSearchQuery}
                      onChange={(e) => setVoiceSearchQuery(e.target.value)}
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                      data-testid="input-search-voice-openai"
                    />
	                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
	                      {filteredOpenAiVoices.map((voice) => (
                        <button
                          key={voice.value}
                          type="button"
                          onClick={() => {
                            setAudioVoice(voice.value);
                            setConfigEdited(true);
                          }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            audioVoice === voice.value
                              ? "border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                              : voice.realistic
                                ? "border-amber-500/30 bg-amber-500/10 hover:border-amber-500 hover:bg-amber-500/20"
                                : "border-slate-600/50 bg-slate-800/50 hover:border-cyan-500/50 hover:bg-slate-700/50"
                          }`}
                          data-testid={`voice-${voice.value}`}
                        >
                          <div className="font-semibold text-sm text-white">{voice.label}</div>
                          <div className={`text-xs ${voice.realistic ? "text-amber-400" : "text-slate-400"}`}>{voice.desc}</div>
                        </button>
	                      ))}
	                    </div>
	                    <Button
	                      type="button"
	                      variant="outline"
	                      onClick={playVoicePreview}
	                      disabled={previewPlaying}
	                      className="border-emerald-500/40 hover:bg-emerald-500/10"
	                      data-testid="button-preview-openai-voice"
	                    >
	                      {previewPlaying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
	                      Probar voz seleccionada
	                    </Button>
	                  </>
	                )}

                {ttsProvider === "elevenlabs" && (
                  <>
                    <Label className="font-medium text-slate-300">Voz de ElevenLabs</Label>
                    <p className="text-xs text-slate-500">Selecciona una voz ultra-realista de tu cuenta ElevenLabs</p>
                    <Input
                      type="text"
                      placeholder="Buscar voz ElevenLabs..."
                      value={voiceSearchQuery}
                      onChange={(e) => setVoiceSearchQuery(e.target.value)}
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                      data-testid="input-search-voice-elevenlabs"
                    />
                    {elVoicesError ? (
                      <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
                        <p className="text-sm text-red-300">Error al cargar voces. Verifica tu conexión con ElevenLabs.</p>
                      </div>
                    ) : elVoicesLoading || elevenLabsVoices.length === 0 ? (
                      <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/10 text-center">
                        <p className="text-sm text-violet-300">Cargando voces de ElevenLabs...</p>
                      </div>
                    ) : (
                      <>
	                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
	                        {filteredElevenLabsVoices.map((voice) => (
                          <button
                            key={voice.voice_id}
                            type="button"
                            onClick={() => {
                              setElevenlabsVoiceId(voice.voice_id);
                              setConfigEdited(true);
                            }}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              elevenlabsVoiceId === voice.voice_id
                                ? "border-violet-500 bg-violet-500/20 shadow-lg shadow-violet-500/20"
                                : voice.source === "shared"
                                  ? "border-pink-500/30 bg-pink-500/5 hover:border-pink-500/60"
                                  : "border-slate-600/50 bg-slate-800/50 hover:border-violet-500/50"
                            }`}
                            data-testid={`voice-el-${voice.voice_id}`}
                          >
                            <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                              {voice.name}
                              {voice.source === "shared" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-normal">Latina</span>
                              )}
                            </div>
                            <div className="text-xs text-violet-400 truncate">{voice.labels?.description || voice.labels?.accent || voice.labels?.use_case || voice.category || "Custom"}</div>
                          </button>
	                        ))}
	                      </div>
	                      <Button
	                        type="button"
	                        variant="outline"
	                        onClick={playVoicePreview}
	                        disabled={previewPlaying}
	                        className="border-violet-500/40 hover:bg-violet-500/10"
	                        data-testid="button-preview-elevenlabs-voice"
		                      >
	                        {previewPlaying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
	                        Probar voz seleccionada
	                      </Button>
                      </>
	                    )}
	                  </>
	                )}

                {ttsProvider === "fish" && (
                  <>
                    <Label className="font-medium text-slate-300">Clave API de Fish Audio</Label>
                    <p className="text-xs text-slate-500">Se guarda en el CRM (no en variables del servidor). Si ya existe FISH_API_KEY en el entorno, tiene prioridad.</p>
                    <div className="relative">
                      <Input
                        type={showFishApiKey ? "text" : "password"}
                        placeholder="sk-fish-..."
                        value={fishApiKey}
                        onChange={(e) => {
                          setFishApiKey(e.target.value);
                          setConfigEdited(true);
                        }}
                        className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500 pr-12"
                        data-testid="input-fish-api-key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFishApiKey((prev) => !prev)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors focus:outline-none"
                        aria-label={showFishApiKey ? "Ocultar clave" : "Mostrar clave"}
                      >
                        {showFishApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <Label className="font-medium text-slate-300">Voz de Fish Audio</Label>
                    <p className="text-xs text-slate-500">Selecciona una voz realista de tu cuenta Fish Audio (S2.1)</p>
                    <Input
                      type="text"
                      placeholder="Buscar voz Fish..."
                      value={voiceSearchQuery}
                      onChange={(e) => setVoiceSearchQuery(e.target.value)}
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                      data-testid="input-search-voice-fish"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-slate-400 text-xs">Género</Label>
                        <Select value={fishGenderFilter} onValueChange={(v) => setFishGenderFilter(v)}>
                          <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white" data-testid="select-fish-gender">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600/70 text-white">
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="female">Mujer</SelectItem>
                            <SelectItem value="male">Hombre</SelectItem>
                            <SelectItem value="unknown">Sin identificar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Nacionalidad / acento</Label>
                        <Select value={fishNationalityFilter} onValueChange={(v) => setFishNationalityFilter(v)}>
                          <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white" data-testid="select-fish-nationality">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600/70 text-white">
                            <SelectItem value="all">Todas</SelectItem>
                            {Array.from(new Set(fishVoices.map((v) => v.labels?.nationality || "es").filter(Boolean))).sort().map((nat) => (
                              <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {fishVoicesError ? (
                      <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
                        <p className="text-sm text-red-300">Error al cargar voces. Verifica tu clave FISH_API_KEY en el servidor.</p>
                      </div>
                    ) : fishVoicesLoading || fishVoices.length === 0 ? (
                      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                        <p className="text-sm text-emerald-300">Cargando voces de Fish Audio...</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                          {fishVoices
                            .filter((voice) => {
                              const genderMatch = fishGenderFilter === "all" || (voice.labels?.gender || "unknown") === fishGenderFilter;
                              const natMatch = fishNationalityFilter === "all" || (voice.labels?.nationality || "es") === fishNationalityFilter;
                              if (!genderMatch || !natMatch) return false;
                              if (!normalizedVoiceSearch) return true;
                              const description = String(voice.labels?.description || voice.labels?.accent || voice.labels?.use_case || voice.category || "");
                              return (
                                voice.name.toLowerCase().includes(normalizedVoiceSearch) ||
                                description.toLowerCase().includes(normalizedVoiceSearch) ||
                                voice.voice_id.toLowerCase().includes(normalizedVoiceSearch)
                              );
                            })
                            .map((voice) => (
                            <button
                              key={voice.voice_id}
                              type="button"
                              onClick={() => {
                                setFishVoiceId(voice.voice_id);
                                setConfigEdited(true);
                              }}
                              className={`p-3 rounded-xl border-2 text-left transition-all ${
                                fishVoiceId === voice.voice_id
                                  ? "border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/20"
                                  : voice.source === "shared"
                                    ? "border-pink-500/30 bg-pink-500/5 hover:border-emerald-500/60"
                                    : "border-slate-600/50 bg-slate-800/50 hover:border-emerald-500/50"
                              }`}
                              data-testid={`voice-fish-${voice.voice_id}`}
                            >
                              <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                                {voice.name}
                                {voice.source === "shared" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-normal">Latina</span>
                                )}
                              </div>
                              <div className="text-xs text-emerald-400 truncate">
                                {voice.labels?.gender === "female" ? "Mujer" : voice.labels?.gender === "male" ? "Hombre" : "¿?"}
                                {voice.labels?.nationality ? ` · ${voice.labels.nationality}` : ""}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">{voice.labels?.description || voice.labels?.use_case || voice.category || "Custom"}</div>
                            </button>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={playVoicePreview}
                          disabled={previewPlaying}
                          className="border-emerald-500/40 hover:bg-emerald-500/10"
                          data-testid="button-preview-fish-voice"
                        >
                          {previewPlaying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Probar voz seleccionada
                        </Button>
                      </>
                    )}
                  </>
                )}

                <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-slate-700/50">
                  {(ttsProvider === "openai" || ttsProvider === "fish") && (
                    <div>
                      <Label htmlFor="ttsSpeed" className="text-slate-300">Velocidad de habla</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="ttsSpeed"
                          type="range"
                          min={50}
                          max={200}
                          step={5}
                          value={ttsSpeed}
                          onChange={(e) => {
                            setTtsSpeed(parseInt(e.target.value));
                            setConfigEdited(true);
                          }}
                          className="flex-1 accent-emerald-500"
                          data-testid="input-tts-speed"
                        />
                        <span className="text-sm font-medium w-14 text-center text-emerald-400">{(ttsSpeed / 100).toFixed(2)}x</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">0.5x (lento) - 2.0x (rápido)</p>
                    </div>
                  )}
                  {ttsProvider === "fish" && (
                    <div>
                      <Label htmlFor="ttsExpression" className="text-slate-300">Expresión</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="ttsExpression"
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={ttsExpression}
                          onChange={(e) => {
                            setTtsExpression(parseInt(e.target.value));
                            setConfigEdited(true);
                          }}
                          className="flex-1 accent-cyan-500"
                          data-testid="input-tts-expression"
                        />
                        <span className="text-sm font-medium w-14 text-center text-cyan-400">
                          {ttsExpression <= 30 ? "Plana" : ttsExpression >= 70 ? "Expresiva" : "Normal"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Fish Audio: temperature 0-1 (más alto = más expresión)</p>
                    </div>
                  )}
                  
                  {ttsProvider === "openai" && ["ash", "ballad", "sage", "verse", "marin", "cedar"].includes(audioVoice) && (
                    <div className="sm:col-span-2">
                      <Label htmlFor="ttsInstructions" className="text-slate-300">Instrucciones de tono (solo voces realistas)</Label>
                      <Textarea
                        id="ttsInstructions"
                        placeholder="Ej: Habla con entusiasmo y calidez, como un vendedor amable"
                        value={ttsInstructions}
                        onChange={(e) => {
                          setTtsInstructions(e.target.value);
                          setConfigEdited(true);
                        }}
                        rows={2}
                        className="mt-1 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                        data-testid="textarea-tts-instructions"
                      />
                      <p className="text-xs text-slate-500 mt-1">Describe cómo quieres que suene la voz (tono, emoción, estilo)</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 border border-slate-700/50 rounded-xl bg-slate-800/30">
              <div className="space-y-1">
                <Label htmlFor="followUp" className="text-slate-300 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Re-enganche automático
                </Label>
                <p className="text-xs text-slate-500">
                  Si el cliente te dejó en visto, el AI le escribe para retomar la conversación
                </p>
              </div>
              <Switch
                id="followUp"
                checked={followUpEnabled}
                onCheckedChange={(checked) => {
                  setFollowUpEnabled(checked);
                  setConfigEdited(true);
                }}
                data-testid="switch-follow-up"
              />
            </div>

            {followUpEnabled && (
              <div className="space-y-3 p-4 border border-slate-700/50 rounded-xl bg-slate-800/30">
                <Label className="text-slate-300">Minutos de espera antes de re-enganchar (Stage 1)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={60}
                    value={followUpMinutes}
                    onChange={(e) => {
                      setFollowUpMinutes(parseInt(e.target.value));
                      setConfigEdited(true);
                    }}
                    className="flex-1 accent-emerald-500"
                    data-testid="slider-follow-up-minutes"
                  />
                  <span className="text-emerald-400 font-bold min-w-[4rem] text-center">{followUpMinutes} min</span>
                </div>
                <p className="text-xs text-slate-500">Máximo 1 re-enganche por conversación. Solo dentro de las 72h de Meta.</p>

                <div className="pt-3 border-t border-slate-700/50 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-slate-300">Segundo reenganche</Label>
                      <p className="text-xs text-slate-500">Se envía solo 1 vez si el cliente sigue sin responder • Nunca de 00:00 a 06:00 (La Paz) ni fuera de 24h</p>
                    </div>
                    <Switch
                      checked={followUpStage2Enabled}
                      onCheckedChange={(checked) => {
                        setFollowUpStage2Enabled(checked);
                        setConfigEdited(true);
                      }}
                      data-testid="switch-follow-up-stage2-enabled"
                    />
                  </div>
                  {followUpStage2Enabled && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-slate-300 text-xs">Esperar</Label>
                        <Select
                          value={String(followUpStage2Hours)}
                          onValueChange={(v) => { setFollowUpStage2Hours(parseInt(v)); setConfigEdited(true); }}
                        >
                          <SelectTrigger className="w-[130px] bg-slate-900/50 border-slate-600/50 text-white" data-testid="select-stage2-hours">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600/70 text-white">
                            {[1,2,3,4,5,6].map((h) => (
                              <SelectItem key={h} value={String(h)}>{h} hora{h>1?"s":""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-slate-500">después del 1er reenganche</span>
                      </div>
                      <Textarea
                        value={followUpStage2Message}
                        onChange={(e) => {
                          setFollowUpStage2Message(e.target.value);
                          setConfigEdited(true);
                        }}
                        rows={3}
                        placeholder="Conoce más de IQeXponencial: www.iqexponencial.com, testimonios en TikTok y testimonios en Facebook"
                        className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500"
                        data-testid="textarea-follow-up-stage2-message"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setFollowUpStage2Message("Conoce más de IQeXponencial: www.iqexponencial.com, testimonios en TikTok y testimonios en Facebook"); setConfigEdited(true); }} data-testid="button-stage2-preset-text" className="text-xs border-slate-600 text-slate-300">Solo texto</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setFollowUpStage2Message("¿Quiere que le muestre opciones? [BOTONES: Ver info, TikTok, Facebook]"); setConfigEdited(true); }} data-testid="button-stage2-preset-botones" className="text-xs border-cyan-600 text-cyan-300">Con botones</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setFollowUpStage2Message("Conoce más de IQeXponencial: [LISTA: Ver más | Web oficial, TikTok testimonios, Facebook testimonios]"); setConfigEdited(true); }} data-testid="button-stage2-preset-lista" className="text-xs border-violet-600 text-violet-300">Con lista</Button>
                      </div>
                      <p className="text-xs text-slate-400">Tips: usa <code className="bg-black/30 px-1 rounded">[BOTONES: Op1, Op2, Op3]</code> (máx 3, 20 chars c/u) o <code className="bg-black/30 px-1 rounded">[LISTA: Título | Op1, Op2...]</code> (máx 10). Si dejas solo texto, se envía solo texto.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {configEdited && (
              <Button onClick={handleSaveConfig} disabled={updateSettingsMutation.isPending} data-testid="button-save-config" className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                {updateSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar Configuración
              </Button>
            )}
          </div>
        </div>

        {/* Products Card - 3D Style */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-violet-500/5 to-transparent rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Productos o servicios</h3>
                <p className="text-xs text-slate-400">La IA buscara solo el producto o servicio que mencione el cliente</p>
              </div>
            </div>
            <div className="grid gap-3 p-4 border border-slate-700/50 rounded-xl bg-slate-900/50">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Nombre *</Label>
                  <Input
                    placeholder="Ej: Producto o servicio A"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    data-testid="input-product-name"
                    className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Precio</Label>
                  <Input
                    placeholder="Ej: 280 Bs o consultar"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    data-testid="input-product-price"
                    className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Palabras clave (separadas por coma)</Label>
                <Input
                  placeholder="Ej: asesoria, soporte, plan premium"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  data-testid="input-product-keywords"
                  className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-slate-300">Descripción</Label>
                <Textarea
                  placeholder="Caracteristicas, beneficios, alcance, instrucciones..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  data-testid="textarea-product-description"
                  className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300">Imagenes del producto o servicio (con % de carga)</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      placeholder="URL imagen principal"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      data-testid="input-product-image-main"
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                    />
                    {renderImagePreview(newImageUrl, "Imagen principal", "preview-product-image-main")}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, "principal", setNewImageUrl)}
                      data-testid="input-product-image-main-file"
                      className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                    />
                    {uploadingSlots.principal && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress.principal || 0} className="h-2" />
                        <p className="text-xs text-slate-400">{uploadProgress.principal || 0}%</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="URL imagen frasco"
                      value={newImageBottleUrl}
                      onChange={(e) => setNewImageBottleUrl(e.target.value)}
                      data-testid="input-product-image-bottle"
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                    />
                    {renderImagePreview(newImageBottleUrl, "Imagen frasco", "preview-product-image-bottle")}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, "frasco", setNewImageBottleUrl)}
                      data-testid="input-product-image-bottle-file"
                      className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                    />
                    {uploadingSlots.frasco && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress.frasco || 0} className="h-2" />
                        <p className="text-xs text-slate-400">{uploadProgress.frasco || 0}%</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="URL imagen dosis"
                      value={newImageDoseUrl}
                      onChange={(e) => setNewImageDoseUrl(e.target.value)}
                      data-testid="input-product-image-dose"
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                    />
                    {renderImagePreview(newImageDoseUrl, "Imagen dosis", "preview-product-image-dose")}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, "dosis", setNewImageDoseUrl)}
                      data-testid="input-product-image-dose-file"
                      className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                    />
                    {uploadingSlots.dosis && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress.dosis || 0} className="h-2" />
                        <p className="text-xs text-slate-400">{uploadProgress.dosis || 0}%</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="URL imagen ingredientes"
                      value={newImageIngredientsUrl}
                      onChange={(e) => setNewImageIngredientsUrl(e.target.value)}
                      data-testid="input-product-image-ingredients"
                      className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                    />
                    {renderImagePreview(newImageIngredientsUrl, "Imagen ingredientes", "preview-product-image-ingredients")}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, "ingredientes", setNewImageIngredientsUrl)}
                      data-testid="input-product-image-ingredients-file"
                      className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                    />
                    {uploadingSlots.ingredientes && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress.ingredientes || 0} className="h-2" />
                        <p className="text-xs text-slate-400">{uploadProgress.ingredientes || 0}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button onClick={handleAddProduct} disabled={createProductMutation.isPending} data-testid="button-add-product" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/30">
                {createProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Agregar elemento
              </Button>
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : products.length > 0 ? (
              <div className="border rounded-md divide-y">
                {products.map((product) => (
                  <div key={product.id} className="p-3" data-testid={`product-item-${product.id}`}>
                    {editingId === product.id ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            placeholder="Nombre"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            data-testid={`input-edit-name-${product.id}`}
                            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                          />
                          <Input
                            placeholder="Precio"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            data-testid={`input-edit-price-${product.id}`}
                            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                          />
                        </div>
                        <Input
                          placeholder="Palabras clave"
                          value={editKeywords}
                          onChange={(e) => setEditKeywords(e.target.value)}
                          data-testid={`input-edit-keywords-${product.id}`}
                          className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                        />
                        <Textarea
                          placeholder="Descripción"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          data-testid={`textarea-edit-description-${product.id}`}
                          className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="URL imagen principal"
                            value={editImageUrl}
                            onChange={(e) => setEditImageUrl(e.target.value)}
                            data-testid={`input-edit-image-main-${product.id}`}
                            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                          />
                          {renderImagePreview(editImageUrl, "Imagen principal", `preview-edit-image-main-${product.id}`)}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, `edit-principal-${product.id}`, setEditImageUrl)}
                            data-testid={`input-edit-image-main-file-${product.id}`}
                            className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                          />
                          {(uploadingSlots[`edit-principal-${product.id}`] || false) && (
                            <div className="sm:col-span-2 space-y-1">
                              <Progress value={uploadProgress[`edit-principal-${product.id}`] || 0} className="h-2" />
                              <p className="text-xs text-slate-500">{uploadProgress[`edit-principal-${product.id}`] || 0}%</p>
                            </div>
                          )}
                          <Input
                            placeholder="URL imagen frasco"
                            value={editImageBottleUrl}
                            onChange={(e) => setEditImageBottleUrl(e.target.value)}
                            data-testid={`input-edit-image-bottle-${product.id}`}
                            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                          />
                          {renderImagePreview(editImageBottleUrl, "Imagen frasco", `preview-edit-image-bottle-${product.id}`)}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, `edit-frasco-${product.id}`, setEditImageBottleUrl)}
                            data-testid={`input-edit-image-bottle-file-${product.id}`}
                            className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                          />
                          {(uploadingSlots[`edit-frasco-${product.id}`] || false) && (
                            <div className="sm:col-span-2 space-y-1">
                              <Progress value={uploadProgress[`edit-frasco-${product.id}`] || 0} className="h-2" />
                              <p className="text-xs text-slate-500">{uploadProgress[`edit-frasco-${product.id}`] || 0}%</p>
                            </div>
                          )}
                          <Input
                            placeholder="URL imagen dosis"
                            value={editImageDoseUrl}
                            onChange={(e) => setEditImageDoseUrl(e.target.value)}
                            data-testid={`input-edit-image-dose-${product.id}`}
                            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                          />
                          {renderImagePreview(editImageDoseUrl, "Imagen dosis", `preview-edit-image-dose-${product.id}`)}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, `edit-dosis-${product.id}`, setEditImageDoseUrl)}
                            data-testid={`input-edit-image-dose-file-${product.id}`}
                            className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                          />
                          {(uploadingSlots[`edit-dosis-${product.id}`] || false) && (
                            <div className="sm:col-span-2 space-y-1">
                              <Progress value={uploadProgress[`edit-dosis-${product.id}`] || 0} className="h-2" />
                              <p className="text-xs text-slate-500">{uploadProgress[`edit-dosis-${product.id}`] || 0}%</p>
                            </div>
                          )}
                          <Input
                            placeholder="URL imagen ingredientes"
                            value={editImageIngredientsUrl}
                            onChange={(e) => setEditImageIngredientsUrl(e.target.value)}
                            data-testid={`input-edit-image-ingredients-${product.id}`}
                            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
                          />
                          {renderImagePreview(editImageIngredientsUrl, "Imagen ingredientes", `preview-edit-image-ingredients-${product.id}`)}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSelectAndUploadProductImage(e.target.files?.[0] || null, `edit-ingredientes-${product.id}`, setEditImageIngredientsUrl)}
                            data-testid={`input-edit-image-ingredients-file-${product.id}`}
                            className="bg-slate-900/80 text-slate-100 border-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-600"
                          />
                          {(uploadingSlots[`edit-ingredientes-${product.id}`] || false) && (
                            <div className="sm:col-span-2 space-y-1">
                              <Progress value={uploadProgress[`edit-ingredientes-${product.id}`] || 0} className="h-2" />
                              <p className="text-xs text-slate-500">{uploadProgress[`edit-ingredientes-${product.id}`] || 0}%</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={updateProductMutation.isPending}>
                            {updateProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                            Guardar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{product.name}</span>
                            {product.price && (
                              <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {product.price}
                              </span>
                            )}
                          </div>
                          {product.keywords && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Palabras clave: {product.keywords}
                            </p>
                          )}
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          {(product.imageUrl || product.imageBottleUrl || product.imageDoseUrl || product.imageIngredientsUrl) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Imagenes: {[
                                product.imageUrl ? "principal" : null,
                                product.imageBottleUrl ? "frasco" : null,
                                product.imageDoseUrl ? "dosis" : null,
                                product.imageIngredientsUrl ? "ingredientes" : null,
                              ].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditing(product)}
                            data-testid={`button-edit-product-${product.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteProductMutation.mutate(product.id)}
                            disabled={deleteProductMutation.isPending}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay elementos. Agrega tu primer producto o servicio arriba.
              </p>
            )}
          </div>
        </div>

        {/* Learned Rules Card - 3D Style */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent rounded-2xl" />
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Reglas Aprendidas</h3>
                <p className="text-xs text-slate-400">El agente usa estas reglas en sus respuestas</p>
              </div>
            </div>
            {rulesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : learnedRules.length > 0 ? (
              <div className="space-y-3">
                {learnedRules.map((rule) => (
                  <div 
                    key={rule.id} 
                    className={`p-3 border rounded-md ${!rule.isActive ? 'opacity-50' : ''}`}
                    data-testid={`learned-rule-${rule.id}`}
                  >
                    {editingRuleId === rule.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editRuleText}
                          onChange={(e) => setEditRuleText(e.target.value)}
                          rows={2}
                          data-testid="textarea-edit-rule"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => updateRuleMutation.mutate({ id: rule.id, rule: editRuleText })}
                            data-testid="button-save-rule-edit"
                          >
                            <Check className="h-3 w-3 mr-1" /> Guardar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingRuleId(null)}
                            data-testid="button-cancel-rule-edit"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm mb-2">{rule.rule}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {rule.learnedFrom || "General"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(rule.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={(checked) => updateRuleMutation.mutate({ id: rule.id, isActive: checked })}
                              data-testid={`switch-rule-active-${rule.id}`}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setEditRuleText(rule.rule);
                              }}
                              data-testid={`button-edit-rule-${rule.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                No hay reglas aprendidas aún. Usa el botón de bombilla en el chat para analizar conversaciones.
              </p>
            )}
          </div>
        </div>

        {/* Logs Card - 3D Style */}
        <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-500/5 to-transparent rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-slate-500/10 rounded-full blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                  <RefreshCw className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Logs de IA</h3>
                  <p className="text-xs text-slate-400">Historial de respuestas del agente</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ai/logs"] })}
                data-testid="button-refresh-logs"
                className="border-slate-600 hover:bg-slate-700/50"
            >
              <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {logsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : logs.length > 0 ? (
              <div className="border border-slate-700/50 rounded-xl divide-y divide-slate-700/50 max-h-80 overflow-y-auto bg-slate-900/50">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 text-sm" data-testid={`log-item-${log.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.tokensUsed !== null && log.tokensUsed !== undefined && (
                        <span className="text-xs bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-300">
                          {log.tokensUsed} tokens
                        </span>
                      )}
                    </div>
                    <div className="pl-6 space-y-1">
                      <p><span className="font-medium">Usuario:</span> {log.userMessage || "-"}</p>
                      {log.success ? (
                        <p><span className="font-medium">IA:</span> {log.aiResponse?.substring(0, 150)}{(log.aiResponse?.length || 0) > 150 ? "..." : ""}</p>
                      ) : (
                        <p className="text-destructive"><span className="font-medium">Error:</span> {log.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                No hay logs aún
              </p>
            )}
          </div>

          {/* Push Notification Controls */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 shadow-xl">
            <div className="mb-4">
              <h3 className="font-semibold text-white">Notificaciones por Columna</h3>
              <p className="text-xs text-slate-400">Activa o desactiva push para Nuevos y Esperando confirmacion</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-white">Nuevos</p>
                  <p className="text-xs text-slate-400">Push cuando entra mensaje nuevo</p>
                </div>
                <Switch
                  checked={pushSettings?.notifyNewMessages ?? true}
                  onCheckedChange={(checked) => updatePushSettingsMutation.mutate({ notifyNewMessages: checked })}
                  disabled={updatePushSettingsMutation.isPending}
                  data-testid="switch-push-new-messages"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-white">Esperando confirmacion</p>
                  <p className="text-xs text-slate-400">Push cuando pasa a Proceso/Pending</p>
                </div>
                <Switch
                  checked={pushSettings?.notifyPending ?? true}
                  onCheckedChange={(checked) => updatePushSettingsMutation.mutate({ notifyPending: checked })}
                  disabled={updatePushSettingsMutation.isPending}
                  data-testid="switch-push-pending"
                />
              </div>
            </div>
          </div>

          {/* Push Notification Logs */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white">Logs de Notificaciones Push</h3>
                <p className="text-xs text-slate-400">Solo: atención humana, pedido listo, llamar</p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => refetchPushLogs()}
                data-testid="button-refresh-push-logs"
                className="border-slate-600 hover:bg-slate-700/50"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {pushLogsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pushLogs.length > 0 ? (
              <div className="border border-slate-700/50 rounded-xl divide-y divide-slate-700/50 max-h-60 overflow-y-auto bg-slate-900/50">
                {pushLogs.map((log, idx) => (
                  <div key={idx} className="p-3 text-sm" data-testid={`push-log-${idx}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        log.event === 'human_attention' ? 'bg-orange-500/20 text-orange-400' :
                        log.event === 'order_ready' ? 'bg-emerald-500/20 text-emerald-400' :
                        log.event === 'should_call' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-slate-600/50 text-slate-300'
                      }`}>
                        {log.event === 'human_attention' ? 'Atención Humana' :
                         log.event === 'order_ready' ? 'Pedido Listo' :
                         log.event === 'should_call' ? 'Llamar' : log.event}
                      </span>
                    </div>
                    <div className="pl-6 space-y-1">
                      <p className="text-slate-300"><span className="font-medium text-white">{log.title}:</span> {log.message}</p>
                      {!log.success && log.error && (
                        <p className="text-red-400 text-xs">Error: {log.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                No hay logs de push aún. Se generarán cuando haya eventos de atención humana, pedidos listos, o llamadas.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Ad Banner Modal (responsive: bottom sheet on mobile, centered dialog on desktop) */}
      <AdBannerModal
        open={bannerModalOpen}
        mode={bannerModalMode}
        adId={bannerAdId}
        problemText={bannerProblemText}
        imageUrl={bannerImageUrl}
        segment={bannerSegment}
        saving={createBannerMutation.isPending || updateBannerMutation.isPending}
        onAdIdChange={setBannerAdId}
        onProblemTextChange={setBannerProblemText}
        onImageUrlChange={setBannerImageUrl}
        onSegmentChange={setBannerSegment}
        onCancel={() => { setBannerModalOpen(false); resetBannerForm(); }}
        onSave={handleSaveBanner}
      />
    </div>
  );
}

function AdBannerModal({
  open,
  mode,
  adId,
  problemText,
  imageUrl,
  segment,
  saving,
  onAdIdChange,
  onProblemTextChange,
  onImageUrlChange,
  onSegmentChange,
  onCancel,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  adId: string;
  problemText: string;
  imageUrl: string;
  segment: string;
  saving: boolean;
  onAdIdChange: (v: string) => void;
  onProblemTextChange: (v: string) => void;
  onImageUrlChange: (v: string) => void;
  onSegmentChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isMobile = useIsMobile();

  const formContent = (
    <>
      <div className="space-y-3">
        <div>
          <Label className="text-slate-300">ID del anuncio (ad_id) *</Label>
          <Input
            placeholder="Ej: 716182253839272"
            value={adId}
            onChange={(e) => onAdIdChange(e.target.value)}
            data-testid="input-ad-banner-id"
            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">Meta Ads Manager → campaña → "ID del anuncio"</p>
        </div>
        <div>
          <Label className="text-slate-300">Qué dice el anuncio (texto/imagen) *</Label>
          <Textarea
            placeholder='Ej: "Estudia pero no retiene"'
            value={problemText}
            onChange={(e) => onProblemTextChange(e.target.value)}
            rows={2}
            data-testid="textarea-ad-banner-problem"
            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">La IA conectará la conversación con este problema.</p>
        </div>
        <div>
          <Label className="text-slate-300">URL de la imagen (opcional)</Label>
          <Input
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => onImageUrlChange(e.target.value)}
            data-testid="input-ad-banner-image"
            className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500"
          />
        </div>
        <div>
          <Label className="text-slate-300">Segmento (opcional)</Label>
          <Select value={segment || undefined} onValueChange={(v) => onSegmentChange(v)}>
            <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white" data-testid="select-ad-banner-segment">
              <SelectValue placeholder="Sin segmento" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600/70 text-white">
              <SelectItem value="hijos">Para hijos</SelectItem>
              <SelectItem value="adulto">Para adulto</SelectItem>
              <SelectItem value="universitario">Universitario / profesional</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );

  const modalButtons = (
    <>
      <Button variant="outline" onClick={onCancel} className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50" data-testid="button-cancel-ad-banner">
        Cancelar
      </Button>
      <Button
        onClick={onSave}
        disabled={saving}
        data-testid="button-save-ad-banner"
        className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/30"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        {mode === "edit" ? "Guardar cambios" : "Guardar anuncio"}
      </Button>
    </>
  );

  const title = mode === "edit" ? "Editar anuncio" : "Nuevo anuncio";
  const description = "Vincula el ad_id de Meta con el texto del anuncio para que la IA enganche con el problema.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
        <SheetContent side="bottom" className="bg-slate-900 border-slate-700/50 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{title}</SheetTitle>
            <SheetDescription className="text-slate-400">{description}</SheetDescription>
          </SheetHeader>
          <div className="py-4">{formContent}</div>
          <SheetFooter>{modalButtons}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="bg-slate-900 border-slate-700/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-slate-400">{description}</DialogDescription>
        </DialogHeader>
        <div className="py-2">{formContent}</div>
        <DialogFooter>{modalButtons}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
