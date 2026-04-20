import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FaEdit,
  FaGraduationCap,
  FaIdBadge,
  FaSearch,
  FaShieldAlt,
  FaUserTie,
} from "react-icons/fa";
import {
  GraduationCap,
  ShieldCheck,
  UserCog,
  UserMinus,
  Users,
} from "lucide-react";

import { useAdminDashboard } from "../../admin/adminDashboardContext";
import {
  AdminTablePager,
  getPageItems,
  getTotalPages,
  includesSearchValue,
  statusLabel,
} from "../../admin/adminDashboardUtils";

const PAGE_SIZE = 10;

type Tab = "students" | "teachers" | "roles";

function statusBadge(status: string) {
  return status === "active"
    ? "adm-badge adm-badge--green"
    : "adm-badge adm-badge--red";
}

function roleBadge(role: string) {
  if (role === "admin") return "adm-badge adm-badge--purple";
  if (role === "teacher") return "adm-badge adm-badge--blue";
  return "adm-badge adm-badge--gray";
}

function UserAvatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="usr-avatar" style={{ background: color }}>
      {initials}
    </span>
  );
}

const AVATAR_COLORS = [
  "#4f46e5","#0ea5e9","#f59e0b","#10b981","#ec4899","#8b5cf6","#14b8a6","#f43f5e",
];
function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function AdminUsersPage() {
  const location = useLocation();
  const rolesMode = location.pathname.startsWith("/admin/roles");
  const {
    loading,
    loadingError,
    users,
    userDrafts,
    userRoles,
    userStatuses,
    syncUserDraft,
    savingUserId,
    handleSaveUser,
    userFeedbackById,
  } = useAdminDashboard();

  const [tab, setTab] = useState<Tab>(rolesMode ? "roles" : "students");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);
  const teachers = useMemo(() => users.filter((u) => u.role === "teacher"), [users]);

  useEffect(() => {
    if (rolesMode) {
      setTab("roles");
      return;
    }
    setPage(1);
    setSearch("");
  }, [rolesMode, tab]);

  useEffect(() => { setPage(1); }, [search]);

  // Filtered list per tab
  const baseList = tab === "students" ? students : tab === "teachers" ? teachers : users;

  const filtered = useMemo(
    () =>
      baseList.filter((u) =>
        includesSearchValue(
          [u.full_name, u.email, u.role, u.status, u.student_code ?? ""],
          search,
        ),
      ),
    [baseList, search],
  );

  const totalPages = getTotalPages(filtered.length, PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => getPageItems(filtered, safePage, PAGE_SIZE),
    [filtered, safePage],
  );

  const activeStudents = students.filter((u) => u.status === "active").length;
  const activeTeachers = teachers.filter((u) => u.status === "active").length;

  return (
    <div className="adm-workspace">
      {/* Header */}
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Gestion</p>
          <h1 className="adm-page-title">{rolesMode ? "Administrateurs & rôles" : "Utilisateurs"}</h1>
          <p className="adm-page-desc">
            {rolesMode
              ? "Contrôlez les rôles système, les accès administrateurs et les statuts de compte."
              : "Gérez les étudiants, enseignants et permissions de la plateforme."}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="adm-kpi-row">
        <div className="adm-kpi-card adm-kpi-card--yellow">
          <span className="adm-kpi-card__bg-icon"><GraduationCap strokeWidth={1.2} /></span>
          <span>Étudiants</span>
          <strong>{students.length}</strong>
          <small>{activeStudents} actifs</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--purple">
          <span className="adm-kpi-card__bg-icon"><UserCog strokeWidth={1.2} /></span>
          <span>Enseignants</span>
          <strong>{teachers.length}</strong>
          <small>{activeTeachers} actifs</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--blue">
          <span className="adm-kpi-card__bg-icon"><Users strokeWidth={1.2} /></span>
          <span>Total comptes</span>
          <strong>{users.length}</strong>
          <small>tous rôles</small>
        </div>
        <div className="adm-kpi-card adm-kpi-card--red">
          <span className="adm-kpi-card__bg-icon"><UserMinus strokeWidth={1.2} /></span>
          <span>Suspendus</span>
          <strong>{users.filter((u) => u.status !== "active").length}</strong>
          <small>comptes bloqués</small>
        </div>
      </div>

      {loading && <div className="adm-state-card"><p>Chargement…</p></div>}
      {loadingError && (
        <div className="adm-state-card adm-state-card--error"><p>{loadingError}</p></div>
      )}

      {!loading && !loadingError && (
        <div className="adm-card">
          {/* Tab bar */}
          <div className="usr-tabs">
            {!rolesMode && (
              <>
                <button
                  type="button"
                  className={`usr-tab${tab === "students" ? " is-active" : ""}`}
                  onClick={() => setTab("students")}
                >
                  <FaGraduationCap />
                  Étudiants
                  <span className="usr-tab__count">{students.length}</span>
                </button>
                <button
                  type="button"
                  className={`usr-tab${tab === "teachers" ? " is-active" : ""}`}
                  onClick={() => setTab("teachers")}
                >
                  <FaUserTie />
                  Enseignants
                  <span className="usr-tab__count">{teachers.length}</span>
                </button>
              </>
            )}
            <button
              type="button"
              className={`usr-tab${tab === "roles" ? " is-active" : ""}`}
              onClick={() => setTab("roles")}
            >
              <FaShieldAlt />
              Rôles &amp; Accès
              <span className="usr-tab__count">{users.length}</span>
            </button>
          </div>

          {/* Card header with search */}
          <div className="adm-card__header" style={{ borderTop: "1px solid #f0f2f8" }}>
            <div>
              {tab === "students" && (
                <>
                  <h2 className="adm-card__title">Liste des étudiants</h2>
                  <p className="adm-card__desc">Code académique, formations et statut d'inscription.</p>
                </>
              )}
              {tab === "teachers" && (
                <>
                  <h2 className="adm-card__title">Liste des enseignants</h2>
                  <p className="adm-card__desc">Coordonnées, sessions assignées et statut.</p>
                </>
              )}
              {tab === "roles" && (
                <>
                  <h2 className="adm-card__title">Gestion des rôles</h2>
                  <p className="adm-card__desc">Modifiez les rôles et statuts directement dans le tableau.</p>
                </>
              )}
            </div>
            <label className="adm-search">
              <FaSearch />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "students"
                    ? "Nom, email, code académique…"
                    : "Rechercher…"
                }
              />
            </label>
          </div>

          {/* ── STUDENTS TAB ── */}
          {tab === "students" && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    <th>Code académique</th>
                    <th>Formations</th>
                    <th>Téléphone</th>
                    <th>Statut</th>
                    <th>Inscription</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? (
                    paginated.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="adm-user-cell">
                            <UserAvatar name={user.full_name} color={avatarColor(user.id)} />
                            <div>
                              <strong style={{ display: "block", fontSize: "0.875rem", color: "#111827" }}>
                                {user.full_name}
                              </strong>
                              <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {user.student_code ? (
                            <span className="usr-code-pill">
                              <FaIdBadge style={{ marginRight: "0.3rem", opacity: 0.6 }} />
                              {user.student_code}
                            </span>
                          ) : (
                            <span style={{ color: "#c0cad8", fontSize: "0.8rem" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className="usr-enroll-count">
                            {user.enrollments_count}
                            <span style={{ color: "#8a95b0", fontSize: "0.75rem", marginLeft: "0.2rem" }}>
                              {user.enrollments_count === 1 ? "formation" : "formations"}
                            </span>
                          </span>
                        </td>
                        <td className="adm-td-muted">
                          {user.phone ?? <span style={{ color: "#c0cad8" }}>—</span>}
                        </td>
                        <td>
                          <span className={statusBadge(user.status)}>
                            {statusLabel(user.status)}
                          </span>
                        </td>
                        <td className="adm-td-muted">
                          {new Date(user.created_at).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="adm-empty">Aucun étudiant trouvé.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── TEACHERS TAB ── */}
          {tab === "teachers" && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Enseignant</th>
                    <th>Téléphone</th>
                    <th>Statut</th>
                    <th>Depuis</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? (
                    paginated.map((user) => {
                      const draft = userDrafts[user.id];
                      const feedback = userFeedbackById[user.id];
                      const isSaving = savingUserId === user.id;
                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="adm-user-cell">
                              <UserAvatar name={user.full_name} color={avatarColor(user.id)} />
                              <div>
                                <strong style={{ display: "block", fontSize: "0.875rem", color: "#111827" }}>
                                  {user.full_name}
                                </strong>
                                <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="adm-td-muted">
                            {user.phone ?? <span style={{ color: "#c0cad8" }}>—</span>}
                          </td>
                          <td>
                            <select
                              className="adm-select"
                              value={draft?.status ?? user.status}
                              onChange={(e) =>
                                syncUserDraft(user.id, "status", e.target.value as typeof user.status)
                              }
                            >
                              {userStatuses.map((s) => (
                                <option key={s} value={s}>{statusLabel(s)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="adm-td-muted">
                            {new Date(user.created_at).toLocaleDateString("fr-FR")}
                          </td>
                          <td>
                            <div className="adm-row-actions">
                              <button
                                className="adm-btn adm-btn--sm adm-btn--primary"
                                type="button"
                                disabled={!draft || isSaving}
                                onClick={() => handleSaveUser(user)}
                              >
                                {isSaving ? "…" : <><FaEdit /> Enregistrer</>}
                              </button>
                              {feedback && (
                                <span className={`adm-feedback adm-feedback--${feedback.type}`}>
                                  {feedback.message}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <div className="adm-empty">Aucun enseignant trouvé.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── ROLES TAB ── */}
          {tab === "roles" && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Rôle actuel</th>
                    <th>Statut</th>
                    <th>Changer rôle</th>
                    <th>Changer statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length ? (
                    paginated.map((user) => {
                      const draft = userDrafts[user.id];
                      const feedback = userFeedbackById[user.id];
                      const isSaving = savingUserId === user.id;
                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="adm-user-cell">
                              <UserAvatar name={user.full_name} color={avatarColor(user.id)} />
                              <div>
                                <strong style={{ display: "block", fontSize: "0.875rem", color: "#111827" }}>
                                  {user.full_name}
                                </strong>
                                <span style={{ fontSize: "0.75rem", color: "#8a95b0" }}>
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={roleBadge(user.role)}>
                              {statusLabel(user.role)}
                            </span>
                          </td>
                          <td>
                            <span className={statusBadge(user.status)}>
                              {statusLabel(user.status)}
                            </span>
                          </td>
                          <td>
                            <select
                              className="adm-select"
                              value={draft?.role ?? user.role}
                              onChange={(e) =>
                                syncUserDraft(user.id, "role", e.target.value as typeof user.role)
                              }
                            >
                              {userRoles.map((r) => (
                                <option key={r} value={r}>{statusLabel(r)}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="adm-select"
                              value={draft?.status ?? user.status}
                              onChange={(e) =>
                                syncUserDraft(user.id, "status", e.target.value as typeof user.status)
                              }
                            >
                              {userStatuses.map((s) => (
                                <option key={s} value={s}>{statusLabel(s)}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="adm-row-actions">
                              <button
                                className="adm-btn adm-btn--sm adm-btn--primary"
                                type="button"
                                disabled={!draft || isSaving}
                                onClick={() => handleSaveUser(user)}
                              >
                                {isSaving ? "…" : "Enregistrer"}
                              </button>
                              {feedback && (
                                <span className={`adm-feedback adm-feedback--${feedback.type}`}>
                                  {feedback.message}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="adm-empty">Aucun utilisateur trouvé.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <AdminTablePager
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            label={tab === "students" ? "Étudiants" : tab === "teachers" ? "Enseignants" : "Utilisateurs"}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
