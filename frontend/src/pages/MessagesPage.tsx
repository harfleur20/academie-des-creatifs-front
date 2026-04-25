import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageCircle, Plus, Search, Send, UserRound, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  createMessageThread,
  createMessagingSocket,
  fetchMessageRecipients,
  fetchMessageThread,
  fetchMessageThreads,
  markMessageThreadRead,
  sendMessage,
  type MessageThread,
  type MessageThreadDetail,
  type MessageUser,
  type MessagingSocketEvent,
} from "../lib/messagingApi";

function formatMessageDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Enseignant";
  if (role === "student") return "Étudiant";
  return role;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const recipientFromUrl = searchParams.get("recipient");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [threadDetail, setThreadDetail] = useState<MessageThreadDetail | null>(null);
  const [recipients, setRecipients] = useState<MessageUser[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recipientBoxRef = useRef<HTMLDivElement>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const selectedRecipient = useMemo(
    () => recipients.find((r) => String(r.id) === selectedRecipientId) ?? null,
    [recipients, selectedRecipientId],
  );

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        roleLabel(r.role).toLowerCase().includes(q),
    );
  }, [recipients, recipientSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (recipientBoxRef.current && !recipientBoxRef.current.contains(e.target as Node)) {
        setRecipientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function reloadThreads(nextSelectedId = selectedThreadId) {
    const items = await fetchMessageThreads();
    setThreads(items);
    if (!nextSelectedId && items.length > 0) {
      setSelectedThreadId(items[0].id);
    }
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchMessageThreads(), fetchMessageRecipients()])
      .then(([threadItems, recipientItems]) => {
        if (!mounted) return;
        setThreads(threadItems);
        setRecipients(recipientItems);
        if (recipientFromUrl && recipientItems.some((recipient) => String(recipient.id) === recipientFromUrl)) {
          setSelectedRecipientId(recipientFromUrl);
          setIsComposing(true);
        }
        if (threadItems.length > 0) {
          setSelectedThreadId(threadItems[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les messages."))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [recipientFromUrl]);

  useEffect(() => {
    if (!selectedThreadId) {
      setThreadDetail(null);
      return;
    }
    let mounted = true;
    fetchMessageThread(selectedThreadId)
      .then((detail) => {
        if (!mounted) return;
        setThreadDetail(detail);
        markMessageThreadRead(selectedThreadId).catch(() => undefined);
        reloadThreads(selectedThreadId).catch(() => undefined);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Conversation introuvable."));
    return () => {
      mounted = false;
    };
  }, [selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [threadDetail?.messages.length]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let reconnectDelay = 3000;

    const connect = () => {
      if (closed) return;
      socket = createMessagingSocket();
      socket.onopen = () => {
        reconnectDelay = 3000;
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as MessagingSocketEvent;
          if (data.type === "messages.thread_created") {
            reloadThreads(data.thread_id).catch(() => undefined);
            setSelectedThreadId((current) => current ?? data.thread_id);
          }
          if (data.type === "messages.message_created") {
            reloadThreads(data.thread_id).catch(() => undefined);
            if (data.thread_id === selectedThreadId) {
              fetchMessageThread(data.thread_id)
                .then(setThreadDetail)
                .then(() => markMessageThreadRead(data.thread_id))
                .catch(() => undefined);
            }
          }
        } catch {
          // Ignore malformed socket frames.
        }
      };
      socket.onclose = () => {
        if (!closed) {
          const delay = reconnectDelay;
          reconnectDelay = Math.min(reconnectDelay * 2, 60000);
          window.setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [selectedThreadId]);

  async function handleCreateThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipientId = Number(selectedRecipientId);
    if (!recipientId || !newBody.trim()) return;
    setError("");
    const detail = await createMessageThread({
      participant_ids: [recipientId],
      subject: newSubject.trim(),
      body: newBody.trim(),
    });
    setIsComposing(false);
    setSelectedRecipientId("");
    setNewSubject("");
    setNewBody("");
    setSelectedThreadId(detail.id);
    setThreadDetail(detail);
    await reloadThreads(detail.id);
  }

  async function handleSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThreadId || !replyBody.trim()) return;
    const body = replyBody.trim();
    setReplyBody("");
    await sendMessage(selectedThreadId, body);
    const detail = await fetchMessageThread(selectedThreadId);
    setThreadDetail(detail);
    await reloadThreads(selectedThreadId);
  }

  const visibleMessages = threadDetail?.messages ?? [];

  if (isLoading) {
    return <div className="dsh-page-loading">Chargement…</div>;
  }

  return (
    <section className="messages-page">
      <div className="messages-header">
        <div>
          <p className="eyebrow">Messagerie</p>
          <h1>Messages</h1>
        </div>
        <button type="button" className="messages-new-btn" onClick={() => setIsComposing((value) => !value)}>
          <Plus size={16} />
          Nouveau
        </button>
      </div>

      {error && <p className="admin-feedback admin-feedback--error">{error}</p>}

      {isComposing && (
        <div className="messages-modal-backdrop" onClick={() => setIsComposing(false)}>
          <div className="messages-modal" onClick={(e) => e.stopPropagation()}>
            <div className="messages-modal__header">
              <h2>Nouveau message</h2>
              <button type="button" className="messages-modal__close" onClick={() => setIsComposing(false)} aria-label="Fermer">✕</button>
            </div>
            <form className="messages-compose" onSubmit={handleCreateThread}>
              <div className="messages-recipient-field">
                <span>Destinataire</span>
                <div className="messages-recipient-box" ref={recipientBoxRef}>
                  {selectedRecipient ? (
                    <div className="messages-recipient-selected">
                      <span className="messages-recipient-selected__avatar">
                        {selectedRecipient.full_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="messages-recipient-selected__name">
                        {selectedRecipient.full_name}
                        <small>{roleLabel(selectedRecipient.role)}</small>
                      </span>
                      <button
                        type="button"
                        className="messages-recipient-selected__clear"
                        onClick={() => { setSelectedRecipientId(""); setRecipientSearch(""); }}
                        aria-label="Effacer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="messages-recipient-search">
                      <Search size={15} className="messages-recipient-search__icon" />
                      <input
                        type="text"
                        placeholder="Rechercher un contact…"
                        value={recipientSearch}
                        onChange={(e) => { setRecipientSearch(e.target.value); setRecipientDropdownOpen(true); }}
                        onFocus={() => setRecipientDropdownOpen(true)}
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {recipientDropdownOpen && !selectedRecipient && (
                    <div className="messages-recipient-dropdown">
                      {filteredRecipients.length === 0 ? (
                        <div className="messages-recipient-dropdown__empty">Aucun contact trouvé</div>
                      ) : (
                        filteredRecipients.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className="messages-recipient-option"
                            onClick={() => {
                              setSelectedRecipientId(String(r.id));
                              setRecipientDropdownOpen(false);
                              setRecipientSearch("");
                            }}
                          >
                            <span className="messages-recipient-option__avatar">
                              {r.full_name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="messages-recipient-option__info">
                              <strong>{r.full_name}</strong>
                              <small>{roleLabel(r.role)}</small>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <input type="hidden" value={selectedRecipientId} required />
              </div>
              <label>
                <span>Sujet</span>
                <input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="Sujet de la conversation" />
              </label>
              <label className="messages-compose__body">
                <span>Message</span>
                <textarea value={newBody} onChange={(event) => setNewBody(event.target.value)} rows={5} required />
              </label>
              <button type="submit">
                <Send size={15} />
                Envoyer
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="messages-shell">
        <aside className="messages-list" aria-label="Conversations">
          {threads.length === 0 ? (
            <div className="messages-empty">
              <MessageCircle size={28} />
              <p>Aucune conversation pour le moment.</p>
            </div>
          ) : (
            threads.map((thread) => {
              const others = thread.participants.filter((participant) => participant.id !== user?.id);
              const title = thread.subject || others.map((participant) => participant.full_name).join(", ");
              return (
                <button
                  key={thread.id}
                  type="button"
                  className={`messages-thread${thread.id === selectedThreadId ? " is-active" : ""}`}
                  onClick={() => setSelectedThreadId(thread.id)}
                >
                  <span className="messages-thread__avatar">
                    {others[0]?.avatar_url ? <img src={others[0].avatar_url} alt="" /> : <UserRound size={18} />}
                  </span>
                  <span className="messages-thread__body">
                    <strong>{title}</strong>
                    <small>{thread.last_message?.body ?? "Conversation ouverte"}</small>
                  </span>
                  <span className="messages-thread__meta">
                    {formatMessageDate(thread.last_message_at)}
                    {thread.unread_count > 0 && <b>{thread.unread_count}</b>}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <article className="messages-detail">
          {!selectedThread ? (
            <div className="messages-empty messages-empty--detail">
              <MessageCircle size={34} />
              <p>Sélectionnez une conversation.</p>
            </div>
          ) : (
            <>
              <header className="messages-detail__header">
                {(() => {
                  const others = selectedThread.participants.filter((p) => p.id !== user?.id);
                  const first = others[0];
                  return (
                    <>
                      <div className="messages-detail__header-avatar">
                        {first?.avatar_url ? <img src={first.avatar_url} alt="" /> : <UserRound size={18} />}
                      </div>
                      <div className="messages-detail__header-info">
                        <h2>{selectedThread.subject || others.map((p) => p.full_name).join(", ")}</h2>
                        <p>{others.map((p) => `${p.full_name} · ${roleLabel(p.role)}`).join(", ")}</p>
                      </div>
                    </>
                  );
                })()}
              </header>

              <div className="messages-feed">
                {visibleMessages.map((message) => {
                  const isMine = message.sender_user_id === user?.id;
                  return (
                    <div key={message.id} className={`messages-bubble-row${isMine ? " is-mine" : ""}`}>
                      <div className="messages-bubble">
                        <span className="messages-bubble__author">
                          {message.sender_name}
                          <time>{formatMessageDate(message.created_at)}</time>
                        </span>
                        <p>{message.body}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form className="messages-reply" onSubmit={handleSendReply}>
                <textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  rows={2}
                  placeholder="Écrire un message…"
                />
                <button type="submit" disabled={!replyBody.trim()}>
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
