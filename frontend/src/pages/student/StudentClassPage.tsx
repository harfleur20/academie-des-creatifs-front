import { useEffect, useState } from "react";
import { CalendarDays, GraduationCap, MapPin, Users } from "lucide-react";

import {
  fetchMyClasses,
  type StudentClass,
  type StudentClassmate,
} from "../../lib/studentApi";

const FORMAT_LABEL: Record<StudentClass["format_type"], string> = {
  live: "Live",
  ligne: "En ligne",
  presentiel: "Présentiel",
};

const STATUS_LABEL: Record<string, string> = {
  planned: "Planifiée",
  open: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const AVATAR_PALETTE = [
  ["#1f2559", "#18a7a3"],
  ["#0f766e", "#14b8a6"],
  ["#2563eb", "#06b6d4"],
  ["#7c3aed", "#2563eb"],
  ["#be185d", "#f97316"],
  ["#334155", "#0f766e"],
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarGradient(name: string) {
  const index = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_PALETTE.length;
  const [start, end] = AVATAR_PALETTE[index];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ClassmateCard({ classmate }: { classmate: StudentClassmate }) {
  const initials = getInitials(classmate.full_name);

  return (
    <article className={`student-classmate-card${classmate.is_current_user ? " is-current-user" : ""}`}>
      <div className="student-classmate-card__avatar" style={{ background: classmate.avatar_url ? "#fff" : avatarGradient(classmate.full_name) }}>
        {classmate.avatar_url ? (
          <img src={classmate.avatar_url} alt={classmate.full_name} />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <div className="student-classmate-card__body">
        <div className="student-classmate-card__title-row">
          <h3>{classmate.full_name}</h3>
          {classmate.is_current_user && <span>Vous</span>}
        </div>
        <p>{classmate.student_code ? `Matricule ${classmate.student_code}` : "Matricule non attribué"}</p>
      </div>

      <div className="student-classmate-card__badge">
        <img
          src={classmate.badge_image_url}
          alt={classmate.badge_label}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div>
          <span>Badge actuel</span>
          <strong>{classmate.badge_label}</strong>
        </div>
      </div>
    </article>
  );
}

export default function StudentClassPage() {
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchMyClasses()
      .then((list) => {
        if (!isMounted) return;
        setClasses(list);
        setError(null);
      })
      .catch((caughtError) => {
        if (!isMounted) return;
        setError(caughtError instanceof Error ? caughtError.message : "Impossible de charger votre classe.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalClassmates = classes.reduce((total, item) => total + item.classmates.length, 0);

  if (isLoading) {
    return <div className="dsh-page-loading">Chargement…</div>;
  }

  return (
    <div className="dsh-page student-class-page">
      <div className="dsh-page__header">
        <div>
          <h1>Ma classe</h1>
          <p className="dsh-page__subtitle">
            {classes.length} session{classes.length > 1 ? "s" : ""} suivie{classes.length > 1 ? "s" : ""} · {totalClassmates} étudiant{totalClassmates > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {error && <div className="dsh-error">{error}</div>}

      {!error && classes.length === 0 ? (
        <div className="dsh-empty">
          <Users size={34} />
          <p>Aucune classe active n'est disponible pour vos sessions actuelles.</p>
        </div>
      ) : (
        <div className="student-class-list">
          {classes.map((studentClass) => (
            <section className="student-class-section" key={studentClass.session_id}>
              <div className="student-class-section__header">
                <div>
                  <span className="student-class-section__eyebrow">
                    {FORMAT_LABEL[studentClass.format_type]} · {STATUS_LABEL[studentClass.status] ?? studentClass.status}
                  </span>
                  <h2>{studentClass.formation_title}</h2>
                  <p>{studentClass.session_label}</p>
                </div>

                <div className="student-class-section__meta">
                  <span><CalendarDays size={14} /> {formatDate(studentClass.start_date)} - {formatDate(studentClass.end_date)}</span>
                  {studentClass.teacher_name && <span><GraduationCap size={14} /> {studentClass.teacher_name}</span>}
                  {studentClass.campus_label && <span><MapPin size={14} /> {studentClass.campus_label}</span>}
                </div>
              </div>

              <div className="student-class-grid">
                {studentClass.classmates.map((classmate) => (
                  <ClassmateCard classmate={classmate} key={classmate.enrollment_id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
