import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  HelpCircle,
  MapPin,
  Monitor,
  School,
  Users,
  Video,
} from "lucide-react";
import { FaChalkboardTeacher } from "react-icons/fa";
import { fetchTeacherOverview, type TeacherSession } from "../../lib/teacherApi";

type StatusFilter = "all" | "planned" | "open" | "completed" | "cancelled";

const STATUS_META: Record<string, { label: string; color: string; dot: string; grad: string }> = {
  planned:   { label: "Planifiée", color: "tch-status--planned",   dot: "#f59e0b", grad: "linear-gradient(160deg,#f59e0b,#d97706)" },
  open:      { label: "Ouverte",   color: "tch-status--open",      dot: "#22c55e", grad: "linear-gradient(160deg,#10b981,#0d9488)" },
  completed: { label: "Terminée", color: "tch-status--done",       dot: "#9ca3af", grad: "linear-gradient(160deg,#64748b,#475569)" },
  cancelled: { label: "Annulée",  color: "tch-status--cancelled",  dot: "#ef4444", grad: "linear-gradient(160deg,#ef4444,#dc2626)" },
};

function statusLabel(status: string) {
  return STATUS_META[status]?.label ?? status;
}

const FORMAT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  live:       { label: "Live Jitsi",   icon: <Video size={11} /> },
  presentiel: { label: "Présentiel",   icon: <School size={11} /> },
  ligne:      { label: "En ligne",     icon: <Monitor size={11} /> },
};

function SessionCard({ session }: { session: TeacherSession }) {
  const meta   = STATUS_META[session.status] ?? { label: session.status, color: "", dot: "#9ca3af", grad: "linear-gradient(160deg,#64748b,#475569)" };
  const fmt    = FORMAT_META[session.format_type] ?? { label: session.format_type, icon: null };
  const start  = new Date(session.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const end    = new Date(session.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <article className="tch-enroll-card">
      {/* Left — formation image */}
      <div className="tch-enroll-card__thumb">
        {session.formation_image
          ? <img src={session.formation_image} alt={session.formation_title} />
          : <div className="tch-enroll-card__no-img" style={{ background: meta.grad }}>
              <FaChalkboardTeacher size={26} />
            </div>
        }
      </div>

      {/* Right body */}
      <div className="tch-enroll-card__body">
        <div className="stp-card-meta">
          <span className={`tch-status ${meta.color}`}>
            <span className="tch-status__dot" style={{ background: meta.dot }} />
            {meta.label}
          </span>
          <span className="dsh-badge dsh-badge--gray" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            {fmt.icon}{fmt.label}
          </span>
        </div>

        <h3 className="tch-enroll-card__title">{session.formation_title}</h3>
        <p className="tch-enroll-card__sublabel">{session.label}</p>

        <ul className="tch-enroll-card__meta">
          <li><CalendarDays size={12} /> {start} → {end}</li>
          {session.campus_label && <li><MapPin size={12} /> {session.campus_label}</li>}
          <li><Users size={12} /> {session.enrolled_count} / {session.seat_capacity} étudiant{session.enrolled_count !== 1 ? "s" : ""}</li>
        </ul>

        <Link to={`/espace/enseignant/session/${session.id}`} className="button button--secondary stp-card-btn tch-enroll-card__cta">
          <FaChalkboardTeacher size={13} />
          Gérer la session
        </Link>
      </div>
    </article>
  );
}

export default function TeacherSessionsPage() {
  const [sessions, setSessions] = useState<TeacherSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchTeacherOverview()
      .then((o) => setSessions(o.sessions))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="dsh-page-loading">Chargement des sessions…</div>;
  if (error) return <div className="dsh-page-error">{error}</div>;

  const filtered = filter === "all" ? sessions : sessions.filter((s) => s.status === filter);

  const counts = {
    all: sessions.length,
    planned: sessions.filter((s) => s.status === "planned").length,
    open: sessions.filter((s) => s.status === "open").length,
    completed: sessions.filter((s) => s.status === "completed").length,
    cancelled: sessions.filter((s) => s.status === "cancelled").length,
  };

  return (
    <div className="stu-ov-page">

      {/* Hero */}
      <div className="stu-hero tch-sessions-hero">
        <div className="stu-hero__content">
          <p className="stu-hero__eyebrow">Espace enseignant</p>
          <h2 className="stu-hero__title">Mes sessions</h2>
          <p className="stu-hero__sub">
            <strong>{sessions.length}</strong> session{sessions.length !== 1 ? "s" : ""} assignée{sessions.length !== 1 ? "s" : ""}
          </p>
          <p className="stu-hero__desc">Gérez les présences, notes et contenus de chaque cohorte.</p>
        </div>

        {/* Mini stats in hero */}
        <div className="tch-sessions-hero__stats">
          <div className="tch-hero-stat">
            <span className="tch-hero-stat__dot" style={{ background: "#22c55e" }} />
            <strong>{counts.open}</strong>
            <span>Ouverte{counts.open !== 1 ? "s" : ""}</span>
          </div>
          <div className="tch-hero-stat">
            <span className="tch-hero-stat__dot" style={{ background: "#f59e0b" }} />
            <strong>{counts.planned}</strong>
            <span>Planifiée{counts.planned !== 1 ? "s" : ""}</span>
          </div>
          <div className="tch-hero-stat">
            <span className="tch-hero-stat__dot" style={{ background: "#9ca3af" }} />
            <strong>{counts.completed}</strong>
            <span>Terminée{counts.completed !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="tch-filter-bar">
        {(["all", "open", "planned", "completed", "cancelled"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`tch-filter-pill${filter === s ? " is-active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "Toutes" : statusLabel(s)}
            <span className="tch-filter-pill__count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Session cards or empty */}
      {filtered.length === 0 ? (
        <div className="stu-ov-card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <BookOpen size={40} strokeWidth={1.2} style={{ color: "#d1d5db" }} />
            <strong style={{ color: "#374151" }}>
              Aucune session{filter !== "all" ? ` "${statusLabel(filter)}"` : ""}
            </strong>
            <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
              {filter !== "all" ? "Essayez un autre filtre." : "Aucune session ne vous est encore assignée."}
            </span>
          </div>
        </div>
      ) : (
        <div className="tch-sessions-grid">
          {filtered.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      {/* Quick links row */}
      <div className="stu-ov-card">
        <div className="stu-ov-card__head">
          <span className="stu-ov-card__title">Autres outils</span>
        </div>
        <div className="stu-shortcuts-grid">
          <Link to="/espace/enseignant/cours" className="stu-shortcut-card">
            <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}><BookOpen size={18} /></span>
            <span className="stu-shortcut-card__label">Mes cours</span>
            <ChevronRight size={14} className="stu-shortcut-card__arrow" />
          </Link>
          <Link to="/espace/enseignant/quizz" className="stu-shortcut-card">
            <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}><HelpCircle size={18} /></span>
            <span className="stu-shortcut-card__label">Quiz & examens</span>
            <ChevronRight size={14} className="stu-shortcut-card__arrow" />
          </Link>
          <Link to="/espace/enseignant/devoirs" className="stu-shortcut-card">
            <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}><ClipboardList size={18} /></span>
            <span className="stu-shortcut-card__label">Devoirs</span>
            <ChevronRight size={14} className="stu-shortcut-card__arrow" />
          </Link>
          <Link to="/espace/enseignant/ressources" className="stu-shortcut-card">
            <span className="stu-shortcut-card__icon" style={{ background: "linear-gradient(135deg,#0ea5e9,#0284c7)" }}><FileText size={18} /></span>
            <span className="stu-shortcut-card__label">Ressources</span>
            <ChevronRight size={14} className="stu-shortcut-card__arrow" />
          </Link>
        </div>
      </div>
    </div>
  );
}
