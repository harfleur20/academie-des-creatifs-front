import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  ClipboardCheck,
  CreditCard,
  HelpCircle,
  Info,
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  ShoppingBag,
  UserRound,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { ApiRequestError } from "../lib/apiClient";
import { sendAiChatMessage, type AiChatAction, type AiChatMessage } from "../lib/aiApi";

type AssistantMode =
  | "student_learning"
  | "ecommerce_support"
  | "teacher_assistant"
  | "admin_assistant";

type Props = {
  formationTitle: string;
  moduleTitle?: string;
  lessonTitle?: string;
  enrollmentId?: number;
  assistantMode?: AssistantMode;
  assistantTitle?: string;
  panelSubtitle?: string;
  introTitle?: string;
  introText?: string;
  placeholder?: string;
  dialogLabel?: string;
  suggestions?: string[];
  showPersonalizedWelcome?: boolean;
  welcomeMessage?: string;
  welcomeVideoUrl?: string | null;
};

const ACADEMY_WELCOME_VIDEO_URL = "https://www.youtube.com/watch?v=BVJzUFxpU1E";
const ACADEMY_WHATSAPP_NUMBER = "237680950319";
const ACADEMY_WHATSAPP_MESSAGE =
  "Bonjour l'Académie des Créatifs, j'aimerais avoir des informations.";
const CHAT_HISTORY_STORAGE_PREFIX = "academie-ai-chat-history-v1";
const CHAT_HISTORY_MAX_MESSAGES = 40;

function buildWhatsAppUrl(message = ACADEMY_WHATSAPP_MESSAGE) {
  return `https://wa.me/${ACADEMY_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:)/.test(href);
}

function slugStoragePart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "global";
}

function buildChatHistoryStorageKey(
  assistantMode: AssistantMode,
  userId: number | null,
  formationTitle: string,
  enrollmentId?: number,
) {
  const userScope = userId ? `user-${userId}` : "guest";

  if (assistantMode === "ecommerce_support") {
    return `${CHAT_HISTORY_STORAGE_PREFIX}:${userScope}:ecommerce`;
  }

  if (assistantMode === "student_learning") {
    const learningScope = enrollmentId ? `enrollment-${enrollmentId}` : slugStoragePart(formationTitle);
    return `${CHAT_HISTORY_STORAGE_PREFIX}:${userScope}:student:${learningScope}`;
  }

  return `${CHAT_HISTORY_STORAGE_PREFIX}:${userScope}:${assistantMode}:${slugStoragePart(formationTitle)}`;
}

function normalizeStoredChatMessage(value: unknown): AiChatMessage | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<AiChatMessage>;
  if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") {
    return null;
  }

  const actions = Array.isArray(candidate.actions)
    ? candidate.actions.filter((action): action is AiChatAction => (
        !!action &&
        typeof action === "object" &&
        typeof (action as AiChatAction).id === "string" &&
        typeof (action as AiChatAction).label === "string" &&
        typeof (action as AiChatAction).href === "string"
      ))
    : undefined;

  return {
    role: candidate.role,
    content: candidate.content,
    ...(actions?.length ? { actions } : {}),
  };
}

function readStoredChatHistory(storageKey: string): AiChatMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { messages?: unknown[] } | unknown[];
    const rawMessages = Array.isArray(parsed) ? parsed : parsed.messages;
    if (!Array.isArray(rawMessages)) return [];

    return rawMessages
      .map(normalizeStoredChatMessage)
      .filter((message): message is AiChatMessage => message !== null)
      .slice(-CHAT_HISTORY_MAX_MESSAGES);
  } catch {
    return [];
  }
}

function writeStoredChatHistory(storageKey: string, messages: AiChatMessage[]) {
  if (typeof window === "undefined") return;

  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ messages: messages.slice(-CHAT_HISTORY_MAX_MESSAGES) }),
    );
  } catch {
    // Storage can fail in private mode or when quota is reached; the chat still works in memory.
  }
}

function ChatActions({ actions }: { actions?: AiChatAction[] }) {
  if (!actions?.length) return null;

  const iconByActionId = {
    about: Info,
    cart: ShoppingBag,
    diagnostic: ClipboardCheck,
    formations: BookOpen,
    help: HelpCircle,
    student_help: HelpCircle,
    student_paths: BookOpen,
    student_payments: CreditCard,
    team: UserRound,
    whatsapp: MessageCircle,
  };

  return (
    <div className="ai-chat-actions">
      {actions.map((action) => {
        const isExternal = isExternalHref(action.href);
        const Icon = iconByActionId[action.id as keyof typeof iconByActionId] ?? MessageCircle;

        return (
          <a
            key={action.id}
            className={`ai-chat-actions__btn ai-chat-actions__btn--${action.style ?? "secondary"}`}
            href={action.href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
          >
            <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
            {action.label}
          </a>
        );
      })}
    </div>
  );
}

function BotIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="7" width="14" height="10" rx="4" fill="currentColor" opacity="0.16" />
      <path d="M12 4v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 7h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 17v2.2M15 17v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.4" cy="11" r="1.1" fill="currentColor" />
      <circle cx="14.6" cy="11" r="1.1" fill="currentColor" />
      <circle cx="12" cy="3.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function normalizeChatMarkdown(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="ai-chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ node: _node, href, children, ...props }) {
            const isExternal = href ? isExternalHref(href) : false;

            return (
              <a
                {...props}
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {normalizeChatMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}

function getYouTubeVideoId(videoUrl: string) {
  try {
    const parsedUrl = new URL(videoUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const videoId = parsedUrl.pathname.replace("/", "");
      return videoId || null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (parsedUrl.pathname.startsWith("/embed/")) {
        const [, , videoId] = parsedUrl.pathname.split("/");
        return videoId || null;
      }

      return parsedUrl.searchParams.get("v");
    }
  } catch {
    return null;
  }

  return null;
}

function getYouTubeThumbnailUrl(videoUrl: string) {
  const videoId = getYouTubeVideoId(videoUrl);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function getYouTubeEmbedUrl(videoUrl: string) {
  const videoId = getYouTubeVideoId(videoUrl);
  if (!videoId) return null;

  const params = new URLSearchParams({
    autoplay: "1",
    controls: "0",
    disablekb: "1",
    enablejsapi: "1",
    fs: "0",
    iv_load_policy: "3",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
  });

  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function WelcomeVideoCard({ videoUrl }: { videoUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLIFrameElement | null>(null);
  const thumbnailUrl = getYouTubeThumbnailUrl(videoUrl);
  const embedUrl = getYouTubeEmbedUrl(videoUrl);

  const sendPlayerCommand = (command: "pauseVideo" | "playVideo") => {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "https://www.youtube-nocookie.com",
    );
  };

  const handleTogglePlayback = () => {
    const nextIsPaused = !isPaused;
    sendPlayerCommand(nextIsPaused ? "pauseVideo" : "playVideo");
    setIsPaused(nextIsPaused);
  };

  const handleFullScreen = () => {
    void videoFrameRef.current?.requestFullscreen?.();
  };

  if (isPlaying && embedUrl) {
    return (
      <div className="ai-chat-welcome__video ai-chat-welcome__video--player">
        <div className="ai-chat-welcome__video-frame" ref={videoFrameRef}>
          <iframe
            ref={playerRef}
            src={embedUrl}
            title="Vidéo de bienvenue de l'Académie des Créatifs"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="ai-chat-welcome__video-controls">
            <button
              type="button"
              className="ai-chat-welcome__video-control"
              onClick={handleTogglePlayback}
              aria-label={isPaused ? "Reprendre la vidéo" : "Mettre la vidéo en pause"}
              title={isPaused ? "Lecture" : "Pause"}
            >
              {isPaused ? (
                <Play size={16} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Pause size={16} strokeWidth={2.4} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="ai-chat-welcome__video-control"
              onClick={handleFullScreen}
              aria-label="Afficher la vidéo en plein écran"
              title="Plein écran"
            >
              <Maximize2 size={17} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="ai-chat-welcome__video ai-chat-welcome__video--button"
      onClick={() => {
        if (embedUrl) setIsPlaying(true);
      }}
      aria-label="Lire la vidéo de bienvenue de l'Académie des Créatifs"
    >
      <div className="ai-chat-welcome__video-cover">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            aria-hidden="true"
          />
        )}
        <span className="ai-chat-welcome__play" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M9 7.8v8.4L16.2 12 9 7.8Z" fill="currentColor" />
          </svg>
        </span>
      </div>
      <div className="ai-chat-welcome__video-caption">
        Découvrir l'Académie des Créatifs
      </div>
    </button>
  );
}

export default function AiChatWidget({
  formationTitle,
  moduleTitle,
  lessonTitle,
  enrollmentId,
  assistantMode = "student_learning",
  assistantTitle = "Assistant IA",
  panelSubtitle,
  introTitle = "Bonjour ! Je suis Emily votre assistante pédagogique.",
  introText,
  placeholder = "Posez votre question…",
  dialogLabel = "Assistant IA",
  suggestions = [],
  showPersonalizedWelcome,
  welcomeMessage = "Bienvenue à l'Académie des Créatifs",
  welcomeVideoUrl = ACADEMY_WELCOME_VIDEO_URL,
}: Props) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipNextHistoryPersistRef = useRef(false);
  const chatStorageKey = buildChatHistoryStorageKey(
    assistantMode,
    user?.id ?? null,
    formationTitle,
    enrollmentId,
  );

  useEffect(() => {
    if (isOpen) {
      if (history.length > 0 || isLoading) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, history, isLoading]);

  useEffect(() => {
    skipNextHistoryPersistRef.current = true;
    setHistory(readStoredChatHistory(chatStorageKey));
    setInput("");
    setError(null);
  }, [chatStorageKey]);

  useEffect(() => {
    if (skipNextHistoryPersistRef.current) {
      skipNextHistoryPersistRef.current = false;
      return;
    }

    writeStoredChatHistory(chatStorageKey, history);
  }, [chatStorageKey, history]);

  const sendMessage = async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isLoading) return;

    const userMessage: AiChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...history, userMessage];
    setHistory(nextHistory);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await sendAiChatMessage({
        message: trimmed,
        formation_title: formationTitle,
        module_title: moduleTitle,
        lesson_title: lessonTitle,
        enrollment_id: enrollmentId,
        assistant_mode: assistantMode,
        history: history.map(({ role, content }) => ({ role, content })),
      });
      setHistory([
        ...nextHistory,
        {
          role: "assistant",
          content: response.reply,
          actions: response.actions ?? [],
        },
      ]);
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError) {
        setError(caughtError.message);
      } else {
        setError("Impossible de contacter l'assistant. Réessayez.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    void sendMessage(input);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleResetConversation = () => {
    setHistory([]);
    writeStoredChatHistory(chatStorageKey, []);
    setInput("");
    setError(null);
    inputRef.current?.focus();
  };

  const subtitle = panelSubtitle ?? formationTitle;
  const introCopy = introText ?? `Posez-moi vos questions sur ${formationTitle}.`;
  const shouldShowPersonalizedWelcome =
    showPersonalizedWelcome ?? ["ecommerce_support", "student_learning"].includes(assistantMode);
  const visitorName = user?.full_name?.trim() || "invité";
  const resolvedIntroTitle = shouldShowPersonalizedWelcome ? `Hi ${visitorName}! 👋` : introTitle;
  const resolvedIntroCopy = shouldShowPersonalizedWelcome ? welcomeMessage : introCopy;
  const resolvedWelcomeVideoUrl = shouldShowPersonalizedWelcome ? welcomeVideoUrl : null;
  const welcomeActions: AiChatAction[] = assistantMode === "ecommerce_support"
    ? [
        {
          id: "diagnostic",
          label: "Passer un diagnostic",
          href: "/diagnostic",
          style: "primary",
        },
        {
          id: "whatsapp",
          label: "Nous écrire sur WhatsApp",
          href: buildWhatsAppUrl(),
          style: "secondary",
        },
      ]
    : assistantMode === "student_learning"
      ? [
          {
            id: "whatsapp",
            label: "Nous écrire sur WhatsApp",
            href: buildWhatsAppUrl(
              "Bonjour l'Académie des Créatifs, j'ai besoin d'aide dans mon espace étudiant.",
            ),
            style: "secondary",
          },
        ]
      : [];
  const contextHint = moduleTitle
    ? `Contexte actuel : ${moduleTitle}${lessonTitle ? ` — ${lessonTitle}` : ""}`
    : null;

  return (
    <>
      <button
        type="button"
        className={`ai-chat-fab${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? `Fermer ${dialogLabel}` : `Ouvrir ${dialogLabel}`}
        title={dialogLabel}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <BotIcon size={20} />
        )}
      </button>

      {isOpen && (
        <div className="ai-chat-panel" role="dialog" aria-label={dialogLabel}>
          <div className="ai-chat-panel__header">
            <div className="ai-chat-panel__header-info">
              <div className="ai-chat-panel__avatar">
                <BotIcon size={22} />
              </div>
              <div className="ai-chat-panel__identity">
                <strong>{assistantTitle}</strong>
                <div className="ai-chat-panel__status">
                  <span className="ai-chat-panel__dot" />
                  <span>En ligne</span>
                  <span className="ai-chat-panel__status-separator">•</span>
                  <span>{subtitle}</span>
                </div>
              </div>
            </div>

            <div className="ai-chat-panel__actions">
              <button
                type="button"
                className="ai-chat-panel__icon-btn"
                onClick={handleResetConversation}
                aria-label="Nouvelle conversation"
                title="Nouvelle conversation"
                disabled={isLoading || history.length === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              <button
                type="button"
                className="ai-chat-panel__icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="ai-chat-panel__messages">
            {history.length === 0 && (
              shouldShowPersonalizedWelcome ? (
                <div className="ai-chat-welcome">
                  <span className="ai-chat-welcome__corner" aria-hidden="true" />
                  <p className="ai-chat-welcome__hello">{resolvedIntroTitle}</p>
                  <h2>{resolvedIntroCopy}</h2>
                  {resolvedWelcomeVideoUrl && <WelcomeVideoCard videoUrl={resolvedWelcomeVideoUrl} />}
                  <ChatActions actions={welcomeActions} />
                  {suggestions.length > 0 && (
                    <div className="ai-chat-panel__suggestions">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="ai-chat-panel__suggestion"
                          onClick={() => void sendMessage(suggestion)}
                          disabled={isLoading}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  {contextHint && (
                    <p className="ai-chat-panel__context-hint">{contextHint}</p>
                  )}
                </div>
              ) : (
                <div className="ai-chat-msg ai-chat-msg--assistant ai-chat-msg--intro">
                  <div className="ai-chat-msg__avatar">
                    <BotIcon size={18} />
                  </div>
                  <div className="ai-chat-msg__stack">
                    <span className="ai-chat-msg__author">{assistantTitle}</span>
                    <div className="ai-chat-msg__bubble"><ChatMarkdown content={resolvedIntroTitle} /></div>
                    <div className="ai-chat-msg__bubble ai-chat-msg__bubble--secondary">
                      <ChatMarkdown content={resolvedIntroCopy} />
                    </div>
                    {suggestions.length > 0 && (
                      <div className="ai-chat-panel__suggestions">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="ai-chat-panel__suggestion"
                            onClick={() => void sendMessage(suggestion)}
                            disabled={isLoading}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    {contextHint && (
                      <p className="ai-chat-panel__context-hint">{contextHint}</p>
                    )}
                  </div>
                </div>
              )
            )}

            {history.map((message, index) => (
              message.role === "assistant" ? (
                <div key={`${message.role}-${index}`} className="ai-chat-msg ai-chat-msg--assistant">
                  <div className="ai-chat-msg__avatar">
                    <BotIcon size={18} />
                  </div>
                  <div className="ai-chat-msg__stack">
                    <span className="ai-chat-msg__author">{assistantTitle}</span>
                    <div className="ai-chat-msg__bubble">
                      <ChatMarkdown content={message.content} />
                    </div>
                    <ChatActions actions={message.actions} />
                  </div>
                </div>
              ) : (
                <div key={`${message.role}-${index}`} className="ai-chat-msg ai-chat-msg--user">
                  <div className="ai-chat-msg__stack">
                    <div className="ai-chat-msg__bubble">
                      <ChatMarkdown content={message.content} />
                    </div>
                  </div>
                </div>
              )
            ))}

            {isLoading && (
              <div className="ai-chat-msg ai-chat-msg--assistant">
                <div className="ai-chat-msg__avatar">
                  <BotIcon size={18} />
                </div>
                <div className="ai-chat-msg__stack">
                  <span className="ai-chat-msg__author">{assistantTitle}</span>
                  <div className="ai-chat-msg__bubble ai-chat-msg__bubble--typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-panel__footer">
            {error && <div className="ai-chat-panel__error">{error}</div>}
            <div className="ai-chat-panel__composer">
              <textarea
                ref={inputRef}
                className="ai-chat-panel__input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={2}
                disabled={isLoading}
              />
              <button
                type="button"
                className="ai-chat-panel__send"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
