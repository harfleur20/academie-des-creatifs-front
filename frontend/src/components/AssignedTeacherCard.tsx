import { MessageCircleMore, UserRound } from "lucide-react";

import type { AssignedTeacher } from "../lib/commerceApi";
import UserAvatar from "./UserAvatar";
import VerifiedBadge from "./VerifiedBadge";

type AssignedTeacherCardProps = {
  teacher: AssignedTeacher | null | undefined;
  className?: string;
};

function avatarGradient(name: string) {
  const palettes = [
    ["#4f46e5", "#0891b2"],
    ["#ec4899", "#8b5cf6"],
    ["#0f766e", "#2563eb"],
    ["#f97316", "#ef4444"],
  ] as const;
  const seed = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [start, end] = palettes[seed % palettes.length];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

export default function AssignedTeacherCard({
  teacher,
  className = "",
}: AssignedTeacherCardProps) {
  const teacherName = teacher?.full_name ?? "Affectation en cours";
  const teacherCode = teacher?.teacher_code ?? "Code en attente";

  return (
    <section className={`workspace-teacher-card ${!teacher ? "workspace-teacher-card--placeholder" : ""} ${className}`.trim()}>
      {teacher ? (
        <UserAvatar
          user={{
            full_name: teacher.full_name,
            avatar_initials: teacher.avatar_initials,
            avatar_url: teacher.avatar_url,
          }}
          className="workspace-teacher-card__avatar"
          fallbackStyle={{ background: avatarGradient(teacher.full_name) }}
        />
      ) : (
        <span className="workspace-teacher-card__avatar workspace-teacher-card__avatar--placeholder">
          <UserRound size={24} />
        </span>
      )}

      <div className="workspace-teacher-card__identity">
        <span className="workspace-teacher-card__label">Votre enseignant assigne est :</span>
        <span className="workspace-teacher-card__name-row">
          <strong title={teacherName}>{teacherName}</strong>
          <VerifiedBadge size={13} />
        </span>
        <span className="workspace-teacher-card__code">
          {teacherCode}
        </span>
      </div>

      <button
        type="button"
        className="button button--secondary button--sm workspace-teacher-card__contact"
        disabled
        title="Le chat enseignant sera branche ici"
      >
        <MessageCircleMore size={12} />
        Contacter
      </button>
    </section>
  );
}
