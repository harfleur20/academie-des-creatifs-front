import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Users, BookOpen, ClipboardList } from "lucide-react";
import { FaVideo, FaMapMarkerAlt } from "react-icons/fa";
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

export default function TeacherOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [formations, setFormations] = useState<TeacherFormationItem[]>([]);
  const [sessionsByFormation, setSessionsByFormation] = useState<Record<number, TeacherFullSession[]>>({});
  const [expandedFormation, setExpandedFormation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Live events per session
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
    } catch {
      // ignore
    }
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

  return (
    <div className="dsh-page">
      <div className="dsh-page__header">
        <h1>Bonjour, {firstName}</h1>
        <p className="dsh-page__subtitle">Préparez les cours, les lives Jitsi, les journées de cours, les présences et les notes de vos sessions assignées.</p>
      </div>

      {overview && (
        <div className="dsh-kpi-grid">
          <div className="dsh-kpi-card">
            <CalendarDays size={22} className="dsh-kpi-card__icon" />
            <strong>{overview.assigned_sessions_count}</strong>
            <span>Sessions totales</span>
          </div>
          <div className="dsh-kpi-card">
            <BookOpen size={22} className="dsh-kpi-card__icon" />
            <strong>{overview.open_sessions_count}</strong>
            <span>Ouvertes</span>
          </div>
          <div className="dsh-kpi-card">
            <ClipboardList size={22} className="dsh-kpi-card__icon" />
            <strong>{overview.planned_sessions_count}</strong>
            <span>Planifiées</span>
          </div>
          <div className="dsh-kpi-card">
            <Users size={22} className="dsh-kpi-card__icon" />
            <strong>{overview.total_students_count}</strong>
            <span>Étudiants</span>
          </div>
        </div>
      )}

      {/* Formations assignées */}
      <section className="dsh-section">
        <div className="dsh-section__header">
          <h2>Mes formations</h2>
          <span className="dsh-section__count">{formations.length}</span>
        </div>

        {formations.length === 0 ? (
          <div className="dsh-empty">Aucune formation ne vous est encore assignée.</div>
        ) : (
          <div className="dsh-formation-list">
            {formations.map((f) => (
              <div className="dsh-formation-item" key={f.id}>
                <div className="dsh-formation-item__main">
                  <img src={f.image} alt={f.title} className="dsh-formation-item__img" />
                  <div className="dsh-formation-item__info">
                    <strong>{f.title}</strong>
                    <span className="dsh-formation-item__meta">
                      {formatFormationType(f.format_type)}
                      {f.session_label && ` · ${f.session_label}`}
                    </span>
                  </div>
                  <div className="dsh-formation-item__actions">
                    <button
                      className="dsh-btn dsh-btn--sm dsh-btn--ghost"
                      type="button"
                      onClick={() => toggleFormation(f.id)}
                    >
                      {expandedFormation === f.id ? "Masquer" : "Voir sessions"}
                    </button>
                  </div>
                </div>

                {expandedFormation === f.id && (
                  <div className="dsh-sessions-list">
                    {!sessionsByFormation[f.id] ? (
                      <p className="dsh-sessions-list__loading">Chargement…</p>
                    ) : sessionsByFormation[f.id].length === 0 ? (
                      <p className="dsh-sessions-list__empty">Aucune session ne vous est assignée pour cette formation.</p>
                    ) : (
                      sessionsByFormation[f.id].map((s) => (
                        <div className="dsh-session-block" key={s.id}>
                          <div className="dsh-session-row">
                            <div className="dsh-session-row__info">
                              <span className={sessionStateBadge(s.session_state)}>
                                {sessionStateLabel(s.session_state)}
                              </span>
                              <strong>{s.label}</strong>
                              <span className="dsh-session-row__dates">
                                {new Date(s.start_date).toLocaleDateString("fr-FR")} →{" "}
                                {new Date(s.end_date).toLocaleDateString("fr-FR")}
                              </span>
                              <span className="dsh-session-row__enrolled">
                                {s.enrolled_count}/{s.seat_capacity} inscrits
                              </span>
                              {s.campus_label && (
                                <span className="dsh-session-row__loc">
                                  <FaMapMarkerAlt size={11} /> {s.campus_label}
                                </span>
                              )}
                              {s.meeting_link && s.format_type === "live" && (
                                <button className="dsh-session-row__link" type="button" onClick={() => navigate(`/live/${s.id}`)}>
                                  <FaVideo size={11} /> Démarrer le live
                                </button>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
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

                          {/* Live events calendar */}
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
                                  {/* Event form */}
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
                                    {liveEventError && (
                                      <p className="admin-feedback admin-feedback--error">{liveEventError}</p>
                                    )}
                                  </div>

                                  {/* Events for selected day */}
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
                                              setEventDraft({ title: ev.title, scheduled_at: `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`, duration_minutes: String(ev.duration_minutes) });
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
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
