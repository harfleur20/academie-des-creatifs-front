import { useRef } from "react";
import { Download, FileText, Image as ImageIcon, Paperclip, SendHorizontal, Video, X } from "lucide-react";

type ConversationComment = {
  id: number;
  author_role: "student" | "teacher";
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
};

type Props = {
  comments: ConversationComment[];
  currentRole: "student" | "teacher";
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  sending: boolean;
  placeholder?: string;
  emptyLabel: string;
  attachmentUrl: string;
  attachmentLabel: string;
  uploadingAttachment: boolean;
  uploadError: string;
  composerError: string;
  onUploadAttachment: (file: File) => void | Promise<void>;
  onClearAttachment: () => void;
};

const EMOJIS = ["✨", "👏", "🎯", "🔥", "💡", "🖼️"];

function formatCommentDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAttachmentKind(url: string) {
  const normalized = url.toLowerCase().split("?")[0];
  if (/\.(png|jpe?g|webp|gif)$/i.test(normalized)) return "image";
  if (/\.(mp4|webm|mov)$/i.test(normalized)) return "video";
  if (/\.pdf$/i.test(normalized)) return "pdf";
  return "file";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function AttachmentBlock({ url }: { url: string }) {
  const kind = getAttachmentKind(url);

  if (kind === "image") {
    return (
      <div className="asg-thread__attachment">
        <img src={url} alt="Pièce jointe" className="asg-thread__attachment-image" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="dsh-btn dsh-btn--ghost dsh-btn--sm">
          <Download size={13} />
          Télécharger
        </a>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="asg-thread__attachment">
        <video src={url} controls className="asg-thread__attachment-video" />
        <a href={url} target="_blank" rel="noopener noreferrer" className="dsh-btn dsh-btn--ghost dsh-btn--sm">
          <Download size={13} />
          Télécharger
        </a>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="asg-thread__attachment-link">
      {kind === "pdf" ? <FileText size={15} /> : <Paperclip size={15} />}
      {kind === "pdf" ? "Télécharger le PDF" : "Ouvrir la pièce jointe"}
    </a>
  );
}

export default function AssignmentConversationPanel({
  comments,
  currentRole,
  draft,
  onDraftChange,
  onSend,
  loading,
  sending,
  placeholder = "Écrivez votre message…",
  emptyLabel,
  attachmentUrl,
  attachmentLabel,
  uploadingAttachment,
  uploadError,
  composerError,
  onUploadAttachment,
  onClearAttachment,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="asg-thread">
      <div className="asg-thread__stream">
        {loading ? (
          <div className="dsh-empty dsh-empty--inline"><p>Chargement des échanges…</p></div>
        ) : comments.length === 0 ? (
          <div className="dsh-empty dsh-empty--inline"><p>{emptyLabel}</p></div>
        ) : (
          comments.map((comment) => {
            const isMine = comment.author_role === currentRole;
            const roleLabel = comment.author_role === "teacher" ? "🧑‍🏫 Formateur" : "🎓 Étudiant";
            const attachmentKind = comment.attachment_url ? getAttachmentKind(comment.attachment_url) : null;
            return (
              <article
                key={comment.id}
                className={`asg-thread__message${isMine ? " is-mine" : ""}`}
              >
                <div className="asg-thread__avatar">
                  {comment.author_avatar_url ? (
                    <img src={comment.author_avatar_url} alt={comment.author_name} className="asg-thread__avatar-image" />
                  ) : (
                    <span>{comment.author_role === "teacher" ? "🧑‍🏫" : initials(comment.author_name) || "🎓"}</span>
                  )}
                </div>
                <div className="asg-thread__bubble">
                  <div className="asg-thread__meta">
                    <strong>{comment.author_name}</strong>
                    <span>{roleLabel}</span>
                    <time>{formatCommentDate(comment.created_at)}</time>
                  </div>
                  {comment.body ? <p>{comment.body}</p> : null}
                  {comment.attachment_url ? (
                    <div className={`asg-thread__attachment-wrap asg-thread__attachment-wrap--${attachmentKind}`}>
                      <AttachmentBlock url={comment.attachment_url} />
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="asg-thread__composer">
        <div className="asg-thread__emoji-row">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="asg-thread__emoji-btn"
              onClick={() => onDraftChange(draft ? `${draft} ${emoji}` : emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <textarea
          className="dsh-textarea asg-thread__textarea"
          rows={4}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.zip,.rar,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUploadAttachment(file);
            e.target.value = "";
          }}
        />

        <div className="asg-thread__toolbar">
          <button
            type="button"
            className="dsh-btn dsh-btn--ghost dsh-btn--sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAttachment}
          >
            {uploadingAttachment ? <Paperclip size={14} /> : <ImageIcon size={14} />}
            {uploadingAttachment ? "Upload…" : "Ajouter une pièce jointe"}
          </button>

          <button
            type="button"
            className="dsh-btn dsh-btn--primary dsh-btn--sm"
            onClick={onSend}
            disabled={sending || (draft.trim().length === 0 && !attachmentUrl)}
          >
            <SendHorizontal size={14} />
            {sending ? "Envoi…" : "Envoyer"}
          </button>
        </div>

        {attachmentUrl ? (
          <div className="asg-thread__pending-attachment">
            <span>📎 {attachmentLabel || "Pièce jointe prête"}</span>
            <button type="button" className="dsh-icon-btn" onClick={onClearAttachment}>
              <X size={14} />
            </button>
          </div>
        ) : null}

        {uploadError ? <p className="dsh-error">{uploadError}</p> : null}
        {composerError ? <p className="dsh-error">{composerError}</p> : null}
      </div>
    </div>
  );
}
