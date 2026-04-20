export const OTHER_TEACHER_SPECIALTY = "Autre";

export const TEACHER_SPECIALTY_OPTIONS = [
  "Designer graphique",
  "Motion designer",
  "Photographe",
  "Community manager",
  "Social media content",
  "Brand strategist",
  "Développeur web",
  "Vibe coding",
  "Modélisateur 3D",
  "Illustrateur",
  OTHER_TEACHER_SPECIALTY,
] as const;

export function isTeacherSpecialtyOption(value: string) {
  return (TEACHER_SPECIALTY_OPTIONS as readonly string[]).includes(value);
}

export function splitTeacherSubject(subject: string | null | undefined) {
  const normalizedSubject = subject?.trim() ?? "";
  if (!normalizedSubject) {
    return { customSubject: "", selectedSubject: "" };
  }
  if (isTeacherSpecialtyOption(normalizedSubject)) {
    return { customSubject: "", selectedSubject: normalizedSubject };
  }
  return {
    customSubject: normalizedSubject,
    selectedSubject: OTHER_TEACHER_SPECIALTY,
  };
}

export function resolveTeacherSubject(selectedSubject: string, customSubject: string) {
  if (selectedSubject === OTHER_TEACHER_SPECIALTY) {
    return customSubject.trim();
  }
  return selectedSubject.trim();
}
