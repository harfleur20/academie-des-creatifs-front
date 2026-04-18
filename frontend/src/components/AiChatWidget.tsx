import { useEffect, useRef, useState } from "react";
import { sendAiChatMessage, type AiChatMessage } from "../lib/aiApi";

type Props = {
  formationTitle: string;
  moduleTitle?: string;
  lessonTitle?: string;
};

export default function AiChatWidget({ formationTitle, moduleTitle, lessonTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isOpen, history]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: AiChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const res = await sendAiChatMessage({
        message: trimmed,
        formation_title: formationTitle,
        module_title: moduleTitle,
        lesson_title: lessonTitle,
        history: history,
      });
      setHistory([...nextHistory, { role: "assistant", content: res.reply }]);
    } catch {
      setError("Impossible de contacter l'assistant. Réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        className={`ai-chat-fab${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA"}
        title="Assistant IA"
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a10 10 0 0 1-10-10C2 6.48 6.48 2 12 2z" />
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            <path d="M9.5 9.5h.01M14.5 9.5h.01M9.5 14.5a2.5 2.5 0 0 0 5 0" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="ai-chat-panel" role="dialog" aria-label="Assistant pédagogique IA">
          <div className="ai-chat-panel__header">
            <div className="ai-chat-panel__header-info">
              <span className="ai-chat-panel__dot" />
              <div>
                <strong>Assistant IA</strong>
                <p>{formationTitle}</p>
              </div>
            </div>
            <button
              type="button"
              className="ai-chat-panel__close"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="ai-chat-panel__messages">
            {history.length === 0 && (
              <div className="ai-chat-panel__empty">
                <p>Bonjour ! Je suis votre assistant pédagogique.</p>
                <p>Posez-moi vos questions sur <strong>{formationTitle}</strong>.</p>
                {moduleTitle && (
                  <p className="ai-chat-panel__context-hint">
                    Contexte actuel : <em>{moduleTitle}</em>
                    {lessonTitle && <> — <em>{lessonTitle}</em></>}
                  </p>
                )}
              </div>
            )}
            {history.map((msg, i) => (
              <div key={i} className={`ai-chat-msg ai-chat-msg--${msg.role}`}>
                <div className="ai-chat-msg__bubble">
                  {msg.content.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-chat-msg ai-chat-msg--assistant">
                <div className="ai-chat-msg__bubble ai-chat-msg__bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            {error && (
              <div className="ai-chat-panel__error">{error}</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-panel__footer">
            <textarea
              ref={inputRef}
              className="ai-chat-panel__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question… (Entrée pour envoyer)"
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
