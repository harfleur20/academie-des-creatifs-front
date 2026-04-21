import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileText,
  HelpCircle,
  Star,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { FaMapMarkerAlt, FaVideo } from "react-icons/fa";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchTeacherOverview,
  fetchMyFormations,
  fetchMyFormationSessions,
  fetchSessionLiveEvents,
  createLiveEvent,
  updateLiveEvent,
  deleteLiveEvent,
  type TeacherOverview,
  type TeacherFormationItem,
  type TeacherFullSession,
  type LiveEvent,
  type LiveEventCreatePayload,
} from "../../lib/teacherApi";
import LiveCalendar from "../../components/LiveCalendar";

/* ── helpers ── */
function sessionStateBadge(state: string) {
  if (state === "upcoming") return "dsh-badge dsh-badge--blue";
  if (state === "started_open") return "dsh-badge dsh-badge--green";
  if (state === "started_closed") return "dsh-badge dsh-badge--yellow";
  if (state === "ended") return "dsh-badge dsh-badge--gray";
  return "dsh-badge dsh-badge--gray";
}

function sessionStateLabel(state: string) {
  if (state === "upcoming") return "À venir";
  if (state === "started_open") return "En cours";
  if (state === "started_closed") return "En cours (fermé)";
  if (state === "ended") return "Terminée";
  if (state === "unscheduled") return "Non planifiée";
  return state;
}

function formatFormationType(formatType: string) {
  if (formatType === "live") return "Live Jitsi";
  if (formatType === "presentiel") return "Présentiel";
  if (formatType === "ligne") return "En ligne";
  return formatType;
}

/* ── KPI card ── */
interface KpiProps {
  label: string;
  value: number | string;
  color: "green" | "blue" | "yellow" | "purple" | "pink" | "dark";
  icon: React.ReactNode;
  sub?: string;
}
function KpiCard({ label, value, color, icon, sub }: KpiProps) {
  return (
    <div className={`stu-kpi-card stu-kpi-card--${color}`}>
      <span className="stu-kpi-card__label">{label}</span>
      <strong className="stu-kpi-card__value">{value}</strong>
      {sub && <small className="stu-kpi-card__sub">{sub}</small>}
      <span className="stu-kpi-card__bg-icon" aria-hidden>{icon}</span>
    </div>
  );
}

/* ── Shortcut card ── */
interface ShortcutProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}
function ShortcutCard({ to, label, icon, color }: ShortcutProps) {
  return (
    <Link to={to} className="stu-shortcut-card">
      <span className="stu-shortcut-card__icon" style={{ background: color }}>{icon}</span>
      <span className="stu-shortcut-card__label">{label}</span>
      <ChevronRight size={14} className="stu-shortcut-card__arrow" />
    </Link>
  );
}

/* ── Teacher illustration ── */
function TeacherIllustration() {
  return (
    <img
      src="/img-bg-8.png"
      alt=""
      aria-hidden
      className="stu-hero__illus"
      draggable={false}
    />
  );
}

/* ════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════ */
export default function TeacherOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [formations, setFormations] = useState<TeacherFormationItem[]>([]);
  const [sessionsByFormation, setSessionsByFormation] = useState<Record<number, TeacherFullSession[]>>({});
  const [expandedFormation, setExpandedFormation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [liveEventsBySession, setLiveEventsBySession] = useState<Record<number, LiveEvent[]>>({});
  const [expandedLiveSession, setExpandedLiveSession] = useState<number | null>(null);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState({ title: "", scheduled_at: "", duration_minutes: "90" });
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [liveEventError, setLiveEventError] = useState("");

  useEffect(() => {
    Promise.all([fetchTeacherOverview(), fetchMyFormations()])
      .then(([ov, fms]) => {
        setOverview(ov);
        setFormations(fms);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => setIsLoading(false));
  }, []);

  const loadSessions = async (formationId: number) => {
    if (sessionsByFormation[formationId]) return;
    try {
      const sessions = await fetchMyFormationSessions(formationId);
      setSessionsByFormation((prev) => ({ ...prev, [formationId]: sessions }));
    } catch { /* ignore */ }
  };

  const loadLiveEvents = async (sessionId: number) => {
    try {
      const events = await fetchSessionLiveEvents(sessionId);
      setLiveEventsBySession((prev) => ({ ...prev, [sessionId]: events }));
    } catch { /* ignore */ }
  };

  const toggleLiveSession = (sessionId: number) => {
    if (expandedLiveSession === sessionId) {
      setExpandedLiveSession(null);
    } else {
      setExpandedLiveSession(sessionId);
      setSelectedCalDate(null);
      setEditingEvent(null);
      setLiveEventError("");
      void loadLiveEvents(sessionId);
    }
  };

  const handleSaveEvent = async (sessionId: number) => {
    setSavingEvent(true);
    setLiveEventError("");
    try {
      const payload: LiveEventCreatePayload = {
        title: eventDraft.title.trim(),
        scheduled_at: new Date(eventDraft.scheduled_at).toISOString(),
        duration_minutes: Number(eventDraft.duration_minutes),
      };
      if (editingEvent) {
        await updateLiveEvent(editingEvent.id, payload);
      } else {
        await createLiveEvent(sessionId, payload);
      }
      setEventDraft({ title: "", scheduled_at: "", duration_minutes: "90" });
      setEditingEvent(null);
      setSelectedCalDate(null);
      const events = await fetchSessionLiveEvents(sessionId);
      setLiveEventsBySession((prev) => ({ ...prev, [sessionId]: events }));
    } catch (err: unknown) {
      setLiveEventError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde de la séance.");
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: number, sessionId: number) => {
    await deleteLiveEvent(eventId);
    const events = await fetchSessionLiveEvents(sessionId);
    setLiveEventsBySession((prev) => ({ ...prev, [sessionId]: events }));
  };

  const toggleFormation = (id: number) => {
    if (expandedFormation === id) {
      setExpandedFormation(null);
    } else {
      setExpandedFormation(id);
      void loadSessions(id);
    }
  };

  if (isLoading) return <div className="dsh-page-loading">Chargement…</div>;
  if (error) return <div className="dsh-page-error">{error}</div>;

  const firstName = user?.full_name?.split(" ")[0] ?? "Enseignant";
  const openSessions = overview?.open_sessions_count ?? 0;
  const totalSessions = overview?.assigned_sessions_count ?? 0;
  const totalStudents = overview?.total_students_count ?? 0;
  const plannedSessions = overview?.planned_sessions_count ?? 0;

  /* upcoming sessions across all formations */
  const upcomingSessions: (TeacherFullSession & { formationTitle: string })[] = [];
  for (const [fid, sessions] of Object.entries(sessionsByFormation)) {
    const fTitle = formations.find((f) => f.id === Number(fid))?.title ?? "";
    for (const s of sessions) {
      if (s.session_state === "upcoming" || s.session_state === "started_open") {
        upcomingSessions.push({ ...s, formationTitle: fTitle });
      }
    }
  }
  upcomingSessions.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return (
    <div className="stu-ov-page">
      <div className="stu-ov-grid">

        {/* ══════ LEFT COLUMN ══════ */}
        <div className="stu-ov-left">

          {/* Hero */}
          <div className="stu-hero">
            <div className="stu-hero__content">
              <p className="stu-hero__eyebrow">Espace enseignant</p>
              <h2 className="stu-hero__title">Bonjour, {firstName}&nbsp;👋</h2>
              <p className="stu-hero__sub">
                Code enseignant&nbsp;: <strong>{overview?.teacher_code ?? "Non attribué"}</strong>
              </p>
              <p className="stu-hero__desc">
                {openSessions} session{openSessions !== 1 ? "s" : ""} ouverte{openSessions !== 1 ? "s" : ""}. Gérez vos cours, lives, présences et notes pour chaque session.
              </p>
            </div>
            <TeacherIllustration />
          </div>

          {/* Formations */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title">
                <BookOpen size={16} />
                Mes formations
              </span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6366f1" }}>
                {formations.length} formation{formations.length !== 1 ? "s" : ""}
              </span>
            </div>

            {formations.length === 0 ? (
              <p className="stu-courses-empty">Aucune formation ne vous est encore assignée.</p>
            ) : (
              <div className="tch-formation-list">
                {formations.map((f) => {
                  const badgeCls = f.format_type === "presentiel"
                    ? "tch-formation-item__badge--presentiel"
                    : f.format_type === "live"
                    ? "tch-formation-item__badge--live"
                    : f.format_type === "online"
                    ? "tch-formation-item__badge--online"
                    : "tch-formation-item__badge--default";
                  return (
                  <div className="tch-formation-item" key={f.id}>
                    <div className="tch-formation-item__main">
                      <img src={f.image} alt={f.title} className="tch-formation-item__img" />
                      <div className="tch-formation-item__info">
                        <strong>{f.title}</strong>
                        <span className={`tch-formation-item__badge ${badgeCls}`}>
                          {formatFormationType(f.format_type)}
                          {f.session_label && ` · ${f.session_label}`}
                        </span>
                      </div>
                      <button
                        className="dsh-btn dsh-btn--sm dsh-btn--primary"
                        type="button"
                        onClick={() => toggleFormation(f.id)}
                      >
                        {expandedFormation === f.id ? <><ChevronUp size={13} /> Masquer</> : <><ChevronDown size={13} /> Voir sessions</>}
                      </button>
                    </div>

                    <div className={`tch-sessions-list${expandedFormation === f.id ? " is-open" : ""}`}>
                        {!sessionsByFormation[f.id] ? (
                          <p className="stu-courses-empty">Chargement…</p>
                        ) : sessionsByFormation[f.id].length === 0 ? (
                          <p className="stu-courses-empty">Aucune session assignée.</p>
                        ) : (
                          sessionsByFormation[f.id].map((s) => (
                            <div className="tch-session-block" key={s.id}>
                              <div className="tch-session-row">
                                <div className="tch-session-row__info">
                                  <span className={sessionStateBadge(s.session_state)}>
                                    {sessionStateLabel(s.session_state)}
                                  </span>
                                  <strong>{s.label}</strong>
                                  <span className="tch-session-row__dates">
                                    {new Date(s.start_date).toLocaleDateString("fr-FR")} → {new Date(s.end_date).toLocaleDateString("fr-FR")}
                                  </span>
                                  <span className="tch-session-row__meta">
                                    <Users size={11} /> {s.enrolled_count}/{s.seat_capacity} inscrits
                                    {s.campus_label && <><FaMapMarkerAlt size={10} /> {s.campus_label}</>}
                                  </span>
                                  {s.meeting_link && s.format_type === "live" && (
                                    <button className="tch-session-row__live-btn" type="button" onClick={() => navigate(`/live/${s.id}`)}>
                                      <FaVideo size={11} /> Démarrer le live
                                    </button>
                                  )}
                                </div>
                                <div className="tch-session-row__actions">
                                  <button className="dsh-btn dsh-btn--sm dsh-btn--ghost" type="button" onClick={() => navigate(`/espace/enseignant/session/${s.id}`)}>
                                    <BookOpen size={13} /> Journées & suivi
                                  </button>
                                  {s.format_type === "live" && (
                                    <button className="dsh-btn dsh-btn--sm dsh-btn--primary" type="button" onClick={() => toggleLiveSession(s.id)}>
                                      <CalendarDays size={13} /> Calendrier live
                                    </button>
                                  )}
                                </div>
                              </div>

                              {s.format_type === "live" && expandedLiveSession === s.id && (() => {
                                const events = liveEventsBySession[s.id] ?? [];
                                const calEvents = events.map((e) => ({ date: e.scheduled_at.slice(0, 10), label: e.title }));
                                const dayEvents = selectedCalDate ? events.filter((e) => e.scheduled_at.slice(0, 10) === selectedCalDate) : [];
                                return (
                                  <div className="dsh-live-panel">
                                    <div className="dsh-live-panel__cal">
                                      <LiveCalendar
                                        events={calEvents}
                                        selectedDate={selectedCalDate}
                                        initialDate={s.start_date}
                                        minDate={s.start_date}
                                        maxDate={s.end_date}
                                        onDayClick={(d) => {
                                          setSelectedCalDate(d === selectedCalDate ? null : d);
                                          setEditingEvent(null);
                                          setLiveEventError("");
                                          setEventDraft({ title: "", scheduled_at: d + "T09:00", duration_minutes: "90" });
                                        }}
                                      />
                                    </div>
                                    <div className="dsh-live-panel__side">
                                      <div className="dsh-live-form">
                                        <p className="dsh-live-form__title">{editingEvent ? "Modifier la séance" : "Ajouter une séance"}</p>
                                        <p className="dsh-live-form__hint">Chaque séance Jitsi devient une journée de cours utilisable pour les présences, devoirs, quiz et notes.</p>
                                        <input
                                          className="dsh-input"
                                          placeholder="Titre (ex: Cours 1 — Introduction)"
                                          value={eventDraft.title}
                                          onChange={(e) => setEventDraft((p) => ({ ...p, title: e.target.value }))}
                                        />
                                        <input
                                          className="dsh-input"
                                          type="datetime-local"
                                          value={eventDraft.scheduled_at}
                                          min={`${s.start_date}T00:00`}
                                          max={`${s.end_date}T23:59`}
                                          onChange={(e) => setEventDraft((p) => ({ ...p, scheduled_at: e.target.value }))}
                                        />
                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                          <label className="dsh-label">Durée (min)</label>
                                          <input
                                            className="dsh-input"
                                            type="number"
                                            min={15}
                                            max={480}
                                            value={eventDraft.duration_minutes}
                                            onChange={(e) => setEventDraft((p) => ({ ...p, duration_minutes: e.target.value }))}
                                            style={{ width: 80 }}
                                          />
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                          <button
                                            className="dsh-btn dsh-btn--primary"
                                            type="button"
                                            disabled={!eventDraft.title || !eventDraft.scheduled_at || savingEvent}
                                            onClick={() => void handleSaveEvent(s.id)}
                                          >
                                            {savingEvent ? "…" : editingEvent ? "Mettre à jour" : "Ajouter"}
                                          </button>
                                          {editingEvent && (
                                            <button className="dsh-btn dsh-btn--ghost" type="button" onClick={() => { setEditingEvent(null); setEventDraft({ title: "", scheduled_at: "", duration_minutes: "90" }); }}>
                                              Annuler
                                            </button>
                                          )}
                                        </div>
                                        {liveEventError && <p className="admin-feedback admin-feedback--error">{liveEventError}</p>}
                                      </div>

                                      {selectedCalDate && (
                                        <div className="dsh-live-day">
                                          <p className="dsh-live-day__label">
                                            {new Date(selectedCalDate + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                                          </p>
                                          {dayEvents.length === 0 ? (
                                            <p className="dsh-empty">Aucune séance ce jour.</p>
                                          ) : dayEvents.map((ev) => (
                                            <div className="dsh-live-event-item" key={ev.id}>
                                              <div>
                                                <strong>{ev.title}</strong>
                                                <span>{new Date(ev.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {ev.duration_minutes} min</span>
                                              </div>
                                              <div style={{ display: "flex", gap: 6 }}>
                                                <button className="dsh-btn dsh-btn--xs dsh-btn--ghost" type="button" onClick={() => {
                                                  setEditingEvent(ev);
                                                  setLiveEventError("");
                                                  const local = new Date(ev.scheduled_at);
                                                  const pad = (n: number) => String(n).padStart(2, "0");
                                                  setEventDraft({ title: ev.title, scheduled_at: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`, duration_minutes: String(ev.duration_minutes) });
                                                }}>Éditer</button>
                                                <button className="dsh-btn dsh-btn--xs dsh-btn--danger" type="button" onClick={() => void handleDeleteEvent(ev.id, s.id)}>✕</button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ))
                        )}
                      </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accès rapide */}
          <div className="stu-ov-card">
            <div className="stu-ov-card__head">
              <span className="stu-ov-card__title">
                <Star size={16} />
                Accès rapide
              </span>
            </div>
            <div className="stu-shortcuts-grid">
              <ShortcutCard
                to="/espace/enseignant/cours"
                label="Mes cours"
                icon={<BookOpen size={18} />}
                color="linear-gradient(135deg,#6366f1,#4f46e5)"
              />
              <ShortcutCard
                to="/espace/enseignant/quizz"
                label="Quiz & examens"
                icon={<HelpCircle size={18} />}
                color="linear-gradient(135deg,#10b981,#059669)"
              />
              <ShortcutCard
                to="/espace/enseignant/devoirs"
                label="Devoirs"
                icon={<ClipboardList size={18} />}
                color="linear-gradient(135deg,#8b5cf6,#7c3aed)"
              />
              <ShortcutCard
                to="/espace/enseignant/ressources"
                label="Ressources"
                icon={<FileText size={18} />}
                color="linear-gradient(135deg,#0ea5e9,#0284c7)"
              />
              <ShortcutCard
                to="/espace/enseignant/sessions"
                label="Mes sessions"
                icon={<Video size={18} />}
                color="linear-gradient(135deg,#f59e0b,#d97706)"
              />
              <ShortcutCard
                to="/espace/enseignant/resultats"
                label="Résultats"
                icon={<Award size={18} />}
                color="linear-gradient(135deg,#ec4899,#db2777)"
              />
            </div>
          </div>
        </div>

        {/* ══════ RIGHT COLUMN ══════ */}
        <div className="stu-ov-right">

          {/* KPI cards */}
          <div className="stu-kpi-row">
            <KpiCard
              label="Sessions totales"
              value={totalSessions}
              color="blue"
              icon={<CalendarDays size={52} />}
              sub={`${openSessions} ouverte${openSessions !== 1 ? "s" : ""}`}
            />
            <KpiCard
              label="Sessions planifiées"
              value={plannedSessions}
              color="yellow"
              icon={<TrendingUp size={52} />}
              sub="À venir"
            />
            <KpiCard
              label="Étudiants suivis"
              value={totalStudents}
              color="green"
              icon={<Users size={52} />}
              sub="Toutes sessions confondues"
            />
            <KpiCard
              label="Formations"
              value={formations.length}
              color="purple"
              icon={<BookOpen size={52} />}
              sub="Assignées"
            />
          </div>

          {/* Sessions actives */}
          <div className="stu-alert-card">
            <div className="stu-alert-card__head">
              <span>Sessions actives & à venir</span>
              <strong>{openSessions + plannedSessions}</strong>
            </div>
            {upcomingSessions.length > 0 ? (
              <div className="stu-alert-list">
                {upcomingSessions.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="stu-alert-item stu-alert-item--info"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                    onClick={() => navigate(`/espace/enseignant/session/${s.id}`)}
                  >
                    <span className="stu-alert-item__dot" aria-hidden />
                    <span className="stu-alert-item__body">
                      <strong>{s.label}</strong>
                      <small>{s.formationTitle} · {new Date(s.start_date).toLocaleDateString("fr-FR")} → {new Date(s.end_date).toLocaleDateString("fr-FR")}</small>
                    </span>
                    <span className="stu-alert-item__action">
                      Ouvrir <ChevronRight size={12} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="stu-alert-card__empty">
                <strong>Aucune session active</strong>
                <span>Développez une formation pour voir les sessions.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
