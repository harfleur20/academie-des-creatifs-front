import { Outlet } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaChevronRight,
  FaClock,
  FaCrown,
  FaEdit,
  FaEye,
  FaFire,
  FaImage,
  FaLaptop,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaPlus,
  FaSave,
  FaSearch,
  FaStar,
  FaSyncAlt,
  FaTag,
  FaTimes,
  FaUsers,
  FaVideo,
} from "react-icons/fa";
import {
  BadgeDollarSign,
  BookOpen,
  GalleryHorizontalEnd,
  ImagePlus,
  LayoutTemplate,
  PackageOpen,
  Save,
  Tag,
  X,
} from "lucide-react";

import {
  type AdminEnrollment,
  type AdminFormation,
  createAdminOnsiteSession,
  fetchAdminEnrollments,
  createAdminFormation,
  sendAdminPaymentReminder,
  updateAdminEnrollment,
  fetchAdminFormations,
  fetchAdminOnsiteSessions,
  fetchAdminOrders,
  fetchAdminOverview,
  fetchAdminPayments,
  fetchAdminUsers,
  updateAdminOnsiteSession,
  updateAdminOrder,
  updateAdminPayment,
  updateAdminUser,
  updateAdminFormation,
  uploadAdminAsset,
  type AdminFormationSessionCreatePayload,
  type AdminFormationCreatePayload,
  type AdminEnrollmentUpdatePayload,
  type AdminOnsiteSession,
  type AdminOnsiteSessionUpdatePayload,
  type AdminOrder,
  type AdminOrderUpdatePayload,
  type AdminOverview,
  type AdminPayment,
  type AdminPaymentUpdatePayload,
  type AdminUser,
  type AdminUserUpdatePayload,
  type EnrollmentStatus,
  type FormationFaq,
  type FormationFormat,
  type FormationModule,
  type FormationProject,
  type MarketingBadge,
  type OrderStatus,
  type PaymentStatus,
  type SessionStatus,
  type SessionState,
  type UserRole,
  type UserStatus,
} from "../lib/catalogApi";
import type { AdminDashboardOutletContext } from "../admin/adminDashboardContext";
import {
  EMPTY_SITE_CONTENT,
  fetchPublicSiteContent,
  type TrainerProfile,
} from "../lib/siteContentApi";
import { useToast } from "../toast/ToastContext";

type DraftValues = {
  title: string;
  category: string;
  level: string;
  image: string;
  formatType: FormationFormat;
  rating: string;
  reviews: string;
  currentPrice: string;
  originalPrice: string;
  promoEndsAt: string;
  isFeaturedHome: boolean;
  homeFeatureRank: string;
  badges: MarketingBadge[];
  intro: string;
  mentorName: string;
  mentorLabel: string;
  mentorImage: string;
  included: string[];
  objectives: string[];
  projects: FormationProject[];
  audienceText: string;
  modules: FormationModule[];
  faqs: FormationFaq[];
};

type Feedback = {
  type: "success" | "error";
  message: string;
  field?: string;
};

type UserDraft = {
  role: UserRole;
  status: UserStatus;
};

type SessionDraft = {
  formationId: string;
  label: string;
  startDate: string;
  endDate: string;
  campusLabel: string;
  seatCapacity: string;
  teacherName: string;
  status: SessionStatus;
  meetingLink: string;
};

type SessionCreateDraft = {
  formationId: string;
  label: string;
  startDate: string;
  endDate: string;
  campusLabel: string;
  seatCapacity: string;
  teacherName: string;
  status: SessionStatus;
  meetingLink: string;
};

type OrderDraft = {
  status: OrderStatus;
};

type EnrollmentDraft = {
  status: EnrollmentStatus;
  sessionId: number | null;
};

type PaymentDraft = {
  providerCode: string;
  status: PaymentStatus;
};

type CatalogDisplayFilter = "all" | "featured";

const marketingBadges: MarketingBadge[] = ["premium", "populaire"];
const baseCategoryOptions = [
  "Design graphique",
  "No-Code & Tech",
  "Intelligence artificielle",
  "UI/UX Design",
  "Branding",
  "Marketing digital",
  "Motion design",
  "Audiovisuel",
  "Photographie",
];
const levelOptions = [
  "Tous niveaux",
  "Débutant",
  "Intermédiaire",
  "Avancé",
  "Professionnel",
];
const formationFormatOptions: Array<{
  value: FormationFormat;
  label: string;
  subtitle: string;
  icon: ReactNode;
}> = [
  {
    value: "live",
    label: "Live",
    subtitle: "Sessions animees en direct",
    icon: <FaVideo />,
  },
  {
    value: "ligne",
    label: "En ligne",
    subtitle: "Parcours classique a suivre a distance",
    icon: <FaLaptop />,
  },
  {
    value: "presentiel",
    label: "Presentiel",
    subtitle: "Cohorte accompagnee sur place",
    icon: <FaMapMarkerAlt />,
  },
];
const userRoles: UserRole[] = ["guest", "student", "teacher", "admin"];
const userStatuses: UserStatus[] = ["active", "suspended"];
const enrollmentStatuses: EnrollmentStatus[] = ["pending", "active", "suspended", "completed", "cancelled"];
const sessionStatuses: SessionStatus[] = ["planned", "open", "completed", "cancelled"];
const orderStatuses: OrderStatus[] = ["pending", "paid", "partially_paid", "failed", "cancelled"];
const paymentStatuses: PaymentStatus[] = ["pending", "late", "confirmed", "failed", "cancelled"];

class FormationDraftError extends Error {
  field: keyof DraftValues | "slug";

  constructor(message: string, field: keyof DraftValues | "slug") {
    super(message);
    this.name = "FormationDraftError";
    this.field = field;
  }
}

function normalizeOptionLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionKey(value: string) {
  return normalizeOptionLabel(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function resolveOptionValue(value: string, options: string[]) {
  const label = normalizeOptionLabel(value);

  if (!label) {
    return "";
  }

  const key = normalizeOptionKey(label);
  return options.find((option) => normalizeOptionKey(option) === key) ?? label;
}

function hasEquivalentOption(options: string[], value: string) {
  const label = normalizeOptionLabel(value);

  if (!label) {
    return false;
  }

  const key = normalizeOptionKey(label);
  return options.some((option) => normalizeOptionKey(option) === key);
}

function badgeIcon(badge: string) {
  if (badge === "premium") {
    return <FaCrown />;
  }

  if (badge === "populaire") {
    return <FaFire />;
  }

  return <FaTag />;
}

function badgeLabel(badge: string) {
  if (badge === "premium") {
    return "Premium";
  }

  if (badge === "populaire") {
    return "Populaire";
  }

  return "Promo";
}

function formatTypeLabel(formatType: FormationFormat) {
  if (formatType === "ligne") {
    return "Ligne";
  }

  if (formatType === "presentiel") {
    return "Presentiel";
  }

  return "Live";
}

function dashboardTypeLabel(formatType: FormationFormat) {
  return formatType === "ligne" ? "Classique" : "Guide";
}

function shouldAllowInstallments(formatType: FormationFormat, currentPrice: number) {
  return formatType === "presentiel" && currentPrice > 90000;
}

function isValidRating(value: number) {
  if (value < 0 || value > 5) {
    return false;
  }

  return Number.isInteger(value * 2);
}

function statusClassName(status: string) {
  return `admin-status admin-status--${status}`;
}

function statusLabel(status: string) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function sessionStateLabel(state: SessionState) {
  switch (state) {
    case "unscheduled":
      return "Aucune session";
    case "upcoming":
      return "A venir";
    case "started_open":
      return "En cours / ouverte";
    case "started_closed":
      return "En cours / fermee";
    case "ended":
      return "Terminee";
    case "not_applicable":
      return "Sans session";
    default:
      return "A venir";
  }
}

function sessionStateHint(state: SessionState) {
  switch (state) {
    case "unscheduled":
      return "La prochaine date doit encore etre programmee.";
    case "upcoming":
      return "Les inscriptions et paiements sont ouverts.";
    case "started_open":
      return "La formation a deja demarre, mais les inscriptions restent ouvertes.";
    case "started_closed":
      return "La formation a demarre et la fenetre d'inscription est fermee.";
    case "ended":
      return "La session est cloturee, une nouvelle peut etre planifiee.";
    case "not_applicable":
      return "Ce format ne fonctionne pas avec une logique de session.";
    default:
      return "";
  }
}

function sessionStateClassName(state: SessionState) {
  return `admin-status admin-status--session admin-status--session-${state}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);
}

function trimValue(value: string | null | undefined) {
  return (value ?? "").trim();
}

function stripModuleTitlePrefix(value: string | null | undefined) {
  return trimValue(value).replace(/^module\s*\d+\s*[-:–—]\s*/i, "");
}

function updateItemAtIndex<T>(items: T[], index: number, nextItem: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function removeItemAtIndex<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function emptyProject(): FormationProject {
  return {
    title: "",
    image: "",
    kind: "image",
    poster: "",
  };
}

function emptyModule(): FormationModule {
  return {
    title: "",
    summary: "",
    duration: "",
    lessons: [],
  };
}

function emptyFaq(): FormationFaq {
  return {
    question: "",
    answer: "",
  };
}

function normalizeStringList(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function normalizeProjects(projects: FormationProject[]) {
  return projects.reduce<FormationProject[]>((accumulator, project) => {
    const title = trimValue(project.title);
    const image = trimValue(project.image);
    const poster = trimValue(project.poster);
    const kind = project.kind === "video" ? "video" : "image";

    if (!title && !image && !poster) {
      return accumulator;
    }

    if (!title || !image) {
      throw new Error("Chaque projet doit avoir un titre et un media.");
    }

    accumulator.push({
      title,
      image,
      kind,
      ...(poster ? { poster } : {}),
    });
    return accumulator;
  }, []);
}

function normalizeModules(modules: FormationModule[]) {
  return modules.reduce<FormationModule[]>((accumulator, module) => {
    const title = stripModuleTitlePrefix(module.title);
    const summary = trimValue(module.summary);
    const duration = trimValue(module.duration);
    const lessons = normalizeStringList(module.lessons ?? []);

    if (!title && !summary && !duration && lessons.length === 0) {
      return accumulator;
    }

    if (!title) {
      throw new Error("Chaque module doit avoir un titre.");
    }

    accumulator.push({
      title,
      summary,
      duration,
      lessons,
    });
    return accumulator;
  }, []);
}

function normalizeFaqs(faqs: FormationFaq[]) {
  return faqs.reduce<FormationFaq[]>((accumulator, faq) => {
    const question = trimValue(faq.question);
    const answer = trimValue(faq.answer);

    if (!question && !answer) {
      return accumulator;
    }

    if (!question || !answer) {
      throw new Error("Chaque FAQ doit contenir une question et une reponse.");
    }

    accumulator.push({ question, answer });
    return accumulator;
  }, []);
}

function toggleBadge(
  currentBadges: MarketingBadge[],
  badge: MarketingBadge,
  onChange: (nextBadges: MarketingBadge[]) => void,
) {
  const nextBadges = currentBadges.includes(badge)
    ? currentBadges.filter((item) => item !== badge)
    : [...currentBadges, badge];

  onChange(nextBadges);
}

function FormatPicker({
  value,
  onChange,
}: {
  value: FormationFormat;
  onChange: (value: FormationFormat) => void;
}) {
  return (
    <div className="fe-format-picker" role="radiogroup" aria-label="Format de formation">
      {formationFormatOptions.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`fe-format-card${isActive ? " is-active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span className={`fe-format-card__icon fe-format-card__icon--${option.value}`}>
              {option.icon}
            </span>
            <span className="fe-format-card__copy">
              <strong>{option.label}</strong>
              <small>{option.subtitle}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DetailListEditor({
  title,
  hint,
  items,
  placeholder,
  addLabel,
  onChange,
}: {
  title: string;
  hint: string;
  items: string[];
  placeholder: string;
  addLabel: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <section className="fe-composer">
      <div className="fe-composer__head">
        <div>
          <h5>{title}</h5>
          <p>{hint}</p>
        </div>
        <button
          className="fe-add-btn"
          type="button"
          onClick={() => onChange([...items, ""])}
        >
          <FaPlus />
          {addLabel}
        </button>
      </div>

      {items.length ? (
        <div className="fe-input-list">
          {items.map((item, index) => (
            <div className="fe-input-row" key={`${title}-${index}`}>
              <span className="fe-index-pill">{index + 1}</span>
              <input
                type="text"
                value={item}
                placeholder={placeholder}
                onChange={(event) =>
                  onChange(updateItemAtIndex(items, index, event.target.value))
                }
              />
              <button
                aria-label={`Supprimer ${title.toLowerCase()} ${index + 1}`}
                className="fe-icon-btn fe-icon-btn--danger"
                type="button"
                onClick={() => onChange(removeItemAtIndex(items, index))}
              >
                <FaTimes />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="fe-empty-card">
          <p>Aucun element ajoute pour le moment.</p>
        </div>
      )}
    </section>
  );
}

function ProjectEditor({
  projects,
  onChange,
}: {
  projects: FormationProject[];
  onChange: (projects: FormationProject[]) => void;
}) {
  return (
    <section className="fe-composer">
      <div className="fe-composer__head">
        <div>
          <h5>Projets et livrables</h5>
          <p>Ajoute les cas pratiques, mockups ou rendus qui doivent apparaitre sur la fiche.</p>
        </div>
        <button
          className="fe-add-btn"
          type="button"
          onClick={() => onChange([...projects, emptyProject()])}
        >
          <FaPlus />
          Ajouter un projet
        </button>
      </div>

      {projects.length ? (
        <div className="fe-card-list">
          {projects.map((project, index) => (
            <article className="fe-card-block" key={`project-${index}`}>
              <div className="fe-card-block__head">
                <div>
                  <strong>Projet {index + 1}</strong>
                  <span>Media de vitrine ou livrable du parcours</span>
                </div>
                <button
                  aria-label={`Supprimer le projet ${index + 1}`}
                  className="fe-icon-btn fe-icon-btn--danger"
                  type="button"
                  onClick={() => onChange(removeItemAtIndex(projects, index))}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="fe-card-block__body fe-card-block__body--grid">
                <label className="admin-field fe-span-full">
                  <span>Titre</span>
                  <input
                    type="text"
                    placeholder="Ex : Refonte d'identite pour une marque cosmetique"
                    value={project.title}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(projects, index, {
                          ...project,
                          title: event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Type</span>
                  <select
                    value={project.kind === "video" ? "video" : "image"}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(projects, index, {
                          ...project,
                          kind: event.target.value === "video" ? "video" : "image",
                        }),
                      )
                    }
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </label>

                <div className="fe-span-full">
                  <CoverUploadZone
                    value={project.image}
                    onChange={(url) =>
                      onChange(
                        updateItemAtIndex(projects, index, {
                          ...project,
                          image: url,
                        }),
                      )
                    }
                    label="Media"
                    emptyTitle={
                      project.kind === "video"
                        ? "Uploader la video du projet"
                        : "Uploader le visuel du projet"
                    }
                    accept={project.kind === "video" ? "video/*" : "image/*"}
                    mediaKind={project.kind === "video" ? "video" : "image"}
                    helperText={project.kind === "video" ? "MP4 · WebM · OGG" : "PNG · JPG · WebP"}
                  />
                </div>

                {project.kind === "video" ? (
                  <div className="fe-span-full">
                    <CoverUploadZone
                      value={project.poster ?? ""}
                      onChange={(url) =>
                        onChange(
                          updateItemAtIndex(projects, index, {
                            ...project,
                            poster: url,
                          }),
                        )
                      }
                      label="Poster video"
                      emptyTitle="Uploader l'image d'aperçu"
                      accept="image/*"
                      mediaKind="image"
                      helperText="PNG · JPG · WebP"
                    />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="fe-empty-card">
          <p>Aucun projet n'est encore rattache a cette formation.</p>
        </div>
      )}
    </section>
  );
}

function ModuleEditor({
  modules,
  onChange,
}: {
  modules: FormationModule[];
  onChange: (modules: FormationModule[]) => void;
}) {
  return (
    <section className="fe-composer">
      <div className="fe-composer__head">
        <div>
          <h5>Programme</h5>
          <p>Structure chaque module avec son resume, sa duree et ses lecons principales.</p>
        </div>
        <button
          className="fe-add-btn"
          type="button"
          onClick={() => onChange([...modules, emptyModule()])}
        >
          <FaPlus />
          Ajouter un module
        </button>
      </div>

      {modules.length ? (
        <div className="fe-card-list">
          {modules.map((module, index) => (
            <article className="fe-card-block" key={`module-${index}`}>
              <div className="fe-card-block__head">
                <div>
                  <strong>Module {index + 1}</strong>
                  <span>Organisation pedagogique du parcours</span>
                </div>
                <button
                  aria-label={`Supprimer le module ${index + 1}`}
                  className="fe-icon-btn fe-icon-btn--danger"
                  type="button"
                  onClick={() => onChange(removeItemAtIndex(modules, index))}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="fe-card-block__body">
                <div className="fe-inline-grid">
                  <label className="admin-field fe-span-full">
                    <span>Titre du module</span>
                    <input
                      type="text"
                      placeholder="Ex : Fondations et methode"
                      value={module.title}
                      onChange={(event) =>
                        onChange(
                          updateItemAtIndex(modules, index, {
                            ...module,
                            title: event.target.value,
                          }),
                        )
                      }
                      onBlur={() =>
                        onChange(
                          updateItemAtIndex(modules, index, {
                            ...module,
                            title: stripModuleTitlePrefix(module.title),
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="admin-field">
                    <span>Duree</span>
                    <input
                      type="text"
                      placeholder="Ex : 2h 30"
                      value={module.duration ?? ""}
                      onChange={(event) =>
                        onChange(
                          updateItemAtIndex(modules, index, {
                            ...module,
                            duration: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="admin-field fe-span-full">
                    <span>Resume</span>
                    <textarea
                      rows={3}
                      placeholder="Explique l'objectif et le resultat attendu du module."
                      value={module.summary ?? ""}
                      onChange={(event) =>
                        onChange(
                          updateItemAtIndex(modules, index, {
                            ...module,
                            summary: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                </div>

                <DetailListEditor
                  title="Lecons"
                  hint="Une ligne correspond a une lecon ou un point aborde dans le module."
                  items={module.lessons}
                  placeholder="Ex : Analyse des references et construction du systeme graphique"
                  addLabel="Ajouter une lecon"
                  onChange={(lessons) =>
                    onChange(
                      updateItemAtIndex(modules, index, {
                        ...module,
                        lessons,
                      }),
                    )
                  }
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="fe-empty-card">
          <p>Aucun module n'est encore defini.</p>
        </div>
      )}
    </section>
  );
}

function FaqEditor({
  faqs,
  onChange,
}: {
  faqs: FormationFaq[];
  onChange: (faqs: FormationFaq[]) => void;
}) {
  return (
    <section className="fe-composer">
      <div className="fe-composer__head">
        <div>
          <h5>FAQ</h5>
          <p>Prepare les reponses visibles sur la page detail pour lever les freins d'achat.</p>
        </div>
        <button
          className="fe-add-btn"
          type="button"
          onClick={() => onChange([...faqs, emptyFaq()])}
        >
          <FaPlus />
          Ajouter une question
        </button>
      </div>

      {faqs.length ? (
        <div className="fe-card-list">
          {faqs.map((faq, index) => (
            <article className="fe-card-block" key={`faq-${index}`}>
              <div className="fe-card-block__head">
                <div>
                  <strong>Question {index + 1}</strong>
                  <span>Bloc d'information public</span>
                </div>
                <button
                  aria-label={`Supprimer la question ${index + 1}`}
                  className="fe-icon-btn fe-icon-btn--danger"
                  type="button"
                  onClick={() => onChange(removeItemAtIndex(faqs, index))}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="fe-card-block__body fe-card-block__body--grid">
                <label className="admin-field fe-span-full">
                  <span>Question</span>
                  <input
                    type="text"
                    placeholder="Ex : Quand l'acces est-il active ?"
                    value={faq.question}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(faqs, index, {
                          ...faq,
                          question: event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="admin-field fe-span-full">
                  <span>Reponse</span>
                  <textarea
                    rows={4}
                    placeholder="Explique la reponse de maniere claire et concise."
                    value={faq.answer}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(faqs, index, {
                          ...faq,
                          answer: event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="fe-empty-card">
          <p>Aucune FAQ n'a encore ete preparee.</p>
        </div>
      )}
    </section>
  );
}

function CoverUploadZone({
  value,
  onChange,
  label = "Image / cover",
  emptyTitle = "Glisser-déposer une image ici",
  accept = "image/*",
  mediaKind = "image",
  helperText = "PNG · JPG · WebP",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  emptyTitle?: string;
  accept?: string;
  mediaKind?: "image" | "video";
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [localPreview, setLocalPreview] = useState("");

  useEffect(() => {
    return () => {
      if (localPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  async function handleFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    if (localPreview.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview);
    }

    setLocalPreview(objectUrl);
    setUploadError("");
    setUploading(true);

    try {
      const uploaded = await uploadAdminAsset(file);
      if (objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
      setLocalPreview(uploaded.public_url);
      onChange(uploaded.public_url);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Upload impossible pour le moment.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (mediaKind === "image" && !file.type.startsWith("image/")) {
      setUploadError("Selectionne une image valide.");
      return;
    }

    if (mediaKind === "video" && !file.type.startsWith("video/")) {
      setUploadError("Selectionne une video valide.");
      return;
    }

    void handleFile(file);
  }

  const previewValue = localPreview || value;
  const isPreview = Boolean(previewValue);

  return (
    <div className="admin-cover-upload">
      <span className="admin-cover-upload__label">{label}</span>

      <div
        className={`admin-cover-upload__drop${isDragOver ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && !isPreview && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={handleFileInput} style={{ display: "none" }} />

        {isPreview ? (
          <>
            {mediaKind === "video" ? (
              <video className="admin-cover-upload__preview-media" src={previewValue} controls muted playsInline />
            ) : (
              <img className="admin-cover-upload__preview-media" src={previewValue} alt="Preview" />
            )}
            <div className="admin-cover-upload__preview-bar">
              <span>{uploading ? "Televersement en cours..." : "Fichier televerse"}</span>
              <button type="button" className="admin-cover-upload__clear" onClick={(e) => {
                e.stopPropagation();
                if (localPreview.startsWith("blob:")) {
                  URL.revokeObjectURL(localPreview);
                }
                setLocalPreview("");
                setUploadError("");
                onChange("");
              }}>
                Supprimer
              </button>
              <button type="button" className="admin-cover-upload__clear" style={{ background: "#f0fdf4", color: "#15803d", borderColor: "rgba(34,197,94,0.25)" }} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                Changer
              </button>
            </div>
          </>
        ) : (
          <div className="admin-cover-upload__empty">
            <span className="admin-cover-upload__icon"><FaImage /></span>
            <strong>{emptyTitle}</strong>
            <span>{uploading ? "Televersement..." : "cliquer pour parcourir"}</span>
            <div className="admin-cover-upload__specs">
              <span className="admin-cover-upload__spec-tag">1280 × 720 px recommandé</span>
              <span className="admin-cover-upload__spec-tag">{helperText}</span>
              <span className="admin-cover-upload__spec-tag">{mediaKind === "video" ? "max 50 Mo" : "max 5 Mo"}</span>
            </div>
          </div>
        )}
      </div>

      {uploadError ? (
        <p className="admin-feedback admin-feedback--error">{uploadError}</p>
      ) : null}
    </div>
  );
}

function AdminModal({
  title,
  subtitle,
  onClose,
  size = "wide",
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: "wide" | "narrow";
  children: ReactNode;
}) {
  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <button
        aria-label="Fermer"
        className="admin-modal__backdrop"
        type="button"
        onClick={onClose}
      />
      <div className={`admin-modal__panel admin-modal__panel--${size}`}>
        <div className="admin-modal__header">
          <div>
            <p className="admin-modal__eyebrow">Edition admin</p>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          <button
            aria-label="Fermer le panneau"
            className="admin-icon-button admin-icon-button--close"
            type="button"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
}

function AdminDrawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-drawer" role="dialog" aria-modal="true">
      <button
        aria-label="Fermer"
        className="admin-drawer__backdrop"
        type="button"
        onClick={onClose}
      />
      <div className="admin-drawer__panel">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-modal__eyebrow">Edition admin</p>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          <button
            aria-label="Fermer le panneau"
            className="admin-icon-button admin-icon-button--close"
            type="button"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="admin-drawer__body">{children}</div>
      </div>
    </div>
  );
}

function buildDraftFromFormation(formation: AdminFormation): DraftValues {
  return {
    title: formation.title,
    category: formation.category,
    level: formation.level,
    image: formation.image,
    formatType: formation.format_type,
    rating: formation.rating.toString(),
    reviews: formation.reviews.toString(),
    currentPrice: formation.current_price_amount.toString(),
    originalPrice: formation.original_price_amount?.toString() ?? "",
    promoEndsAt: formation.promo_ends_at ?? "",
    isFeaturedHome: formation.is_featured_home,
    homeFeatureRank: formation.home_feature_rank.toString(),
    badges: formation.badges.filter(
      (badge): badge is MarketingBadge => badge === "premium" || badge === "populaire",
    ),
    intro: formation.intro,
    mentorName: formation.mentor_name,
    mentorLabel: formation.mentor_label,
    mentorImage: formation.mentor_image,
    included: [...formation.included],
    objectives: [...formation.objectives],
    projects: formation.projects.map((project) => ({
      title: project.title,
      image: project.image,
      kind: project.kind === "video" ? "video" : "image",
      poster: project.poster ?? "",
    })),
    audienceText: formation.audience_text,
    modules: formation.modules.map((module) => ({
      title: stripModuleTitlePrefix(module.title),
      summary: module.summary ?? "",
      duration: module.duration ?? "",
      lessons: [...module.lessons],
    })),
    faqs: formation.faqs.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    })),
  };
}

function emptyCreateDraft(): DraftValues {
  return {
    title: "",
    category: "",
    level: "",
    image: "",
    formatType: "live",
    rating: "0",
    reviews: "0",
    currentPrice: "",
    originalPrice: "",
    promoEndsAt: "",
    isFeaturedHome: false,
    homeFeatureRank: "100",
    badges: [],
    intro: "",
    mentorName: "",
    mentorLabel: "",
    mentorImage: "",
    included: [],
    objectives: [],
    projects: [],
    audienceText: "",
    modules: [],
    faqs: [],
  };
}

function emptySessionCreateDraft(): SessionCreateDraft {
  return {
    formationId: "",
    label: "",
    startDate: "",
    endDate: "",
    campusLabel: "",
    seatCapacity: "0",
    teacherName: "",
    status: "planned",
    meetingLink: "",
  };
}

function buildPayloadFromDraft(
  draft: DraftValues,
  categoryOptions: string[] = [],
): { payload: Omit<AdminFormationCreatePayload, "slug">; currentPrice: number } {
  const rating = Number.parseFloat(draft.rating);
  const reviews = Number.parseInt(draft.reviews, 10);
  const currentPrice = Number.parseInt(draft.currentPrice, 10);
  const originalPrice = draft.originalPrice.trim()
    ? Number.parseInt(draft.originalPrice, 10)
    : null;
  const promoEndsAt = draft.promoEndsAt.trim() || null;
  const homeFeatureRank = Number.parseInt(draft.homeFeatureRank, 10);

  if (!draft.title.trim()) {
    throw new FormationDraftError("Le titre ne peut pas etre vide.", "title");
  }

  if (!draft.category.trim()) {
    throw new FormationDraftError("La categorie ne peut pas etre vide.", "category");
  }

  if (!draft.level.trim()) {
    throw new FormationDraftError("Le niveau ne peut pas etre vide.", "level");
  }

  if (!draft.image.trim()) {
    throw new FormationDraftError("L'image ne peut pas etre vide.", "image");
  }

  if (!Number.isFinite(rating) || !isValidRating(rating)) {
    throw new FormationDraftError("La note doit etre comprise entre 0 et 5, par pas de 0.5.", "rating");
  }

  if (!Number.isInteger(reviews) || reviews < 0) {
    throw new FormationDraftError("Le nombre d'avis doit etre un entier positif ou nul.", "reviews");
  }

  if (!Number.isInteger(currentPrice) || currentPrice < 0) {
    throw new FormationDraftError("Le prix actuel doit etre un entier positif.", "currentPrice");
  }

  if (originalPrice !== null && (!Number.isInteger(originalPrice) || originalPrice < currentPrice)) {
    throw new FormationDraftError("Le prix barre doit etre vide ou superieur ou egal au prix actuel.", "originalPrice");
  }

  if (promoEndsAt && originalPrice === null) {
    throw new FormationDraftError("Ajoute un prix barre avant de definir une date limite de promo.", "promoEndsAt");
  }

  if (!Number.isInteger(homeFeatureRank) || homeFeatureRank < 0) {
    throw new FormationDraftError("L'ordre d'affichage accueil doit etre un entier positif ou nul.", "homeFeatureRank");
  }

  const included = normalizeStringList(draft.included);
  const objectives = normalizeStringList(draft.objectives);
  const projects = normalizeProjects(draft.projects);
  const modules = normalizeModules(draft.modules);
  const faqs = normalizeFaqs(draft.faqs);
  const category = resolveOptionValue(draft.category, categoryOptions);

  return {
    currentPrice,
    payload: {
      title: trimValue(draft.title),
      category,
      level: trimValue(draft.level),
      image: trimValue(draft.image),
      format_type: draft.formatType,
      rating,
      reviews,
      current_price_amount: currentPrice,
      original_price_amount: originalPrice,
      promo_ends_at: promoEndsAt,
      is_featured_home: draft.isFeaturedHome,
      home_feature_rank: homeFeatureRank,
      badges: draft.badges,
      intro: trimValue(draft.intro),
      mentor_name: trimValue(draft.mentorName),
      mentor_label: trimValue(draft.mentorLabel),
      mentor_image: trimValue(draft.mentorImage),
      included,
      objectives,
      projects,
      audience_text: trimValue(draft.audienceText),
      modules,
      faqs,
    },
  };
}

function scrollFormationEditorToError(field?: string) {
  window.setTimeout(() => {
    const target = field
      ? document.querySelector<HTMLElement>(`[data-field="${field}"]`)
      : document.querySelector<HTMLElement>(".admin-feedback--error");

    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = target.querySelector<HTMLElement>("input, select, textarea, button");
    focusable?.focus({ preventScroll: true });
  }, 80);
}

function buildUserDraft(user: AdminUser): UserDraft {
  return {
    role: user.role,
    status: user.status,
  };
}

function buildSessionDraft(session: AdminOnsiteSession): SessionDraft {
  return {
    formationId: session.formation_id.toString(),
    label: session.label,
    startDate: session.start_date,
    endDate: session.end_date,
    campusLabel: session.campus_label,
    seatCapacity: session.seat_capacity.toString(),
    teacherName: session.teacher_name,
    status: session.status,
    meetingLink: session.meeting_link ?? "",
  };
}

function buildOrderDraft(order: AdminOrder): OrderDraft {
  return {
    status: order.status,
  };
}

function buildEnrollmentDraft(enrollment: AdminEnrollment): EnrollmentDraft {
  return {
    status: enrollment.status,
    sessionId: enrollment.session_id ?? null,
  };
}

function buildPaymentDraft(payment: AdminPayment): PaymentDraft {
  return {
    providerCode: payment.provider_code,
    status: payment.status,
  };
}

function FormationDetailFields({
  draft,
  trainers,
  onChange,
}: {
  draft: DraftValues;
  trainers: TrainerProfile[];
  onChange: <K extends keyof DraftValues>(field: K, value: DraftValues[K]) => void;
}) {
  return (
    <div className="fe-detail-stack">
      <div className="admin-detail-editor">
        <div className="admin-detail-editor__heading">
          <h4>Fiche detail</h4>
          <p>
            Structure la page publique avec des sections claires, des listes utiles
            et un programme vraiment exploitable.
          </p>
        </div>

        <div className="fe-detail-grid">
          <label className="admin-field fe-span-full">
            <span>Introduction</span>
            <textarea
              rows={4}
              placeholder="Resume la promesse de la formation, son rythme et le resultat attendu."
              value={draft.intro}
              onChange={(event) => onChange("intro", event.target.value)}
            />
          </label>

          <label className="admin-field fe-span-full">
            <span>Formateur assigné</span>
            <select
              value={trainers.find((t) => t.name === draft.mentorName)?.name ?? ""}
              onChange={(event) => {
                const trainer = trainers.find((t) => t.name === event.target.value);
                if (trainer) {
                  onChange("mentorName", trainer.name);
                  onChange("mentorLabel", trainer.label);
                  onChange("mentorImage", trainer.image);
                } else {
                  onChange("mentorName", "");
                  onChange("mentorLabel", "");
                  onChange("mentorImage", "");
                }
              }}
            >
              <option value="">— Choisir un formateur —</option>
              {trainers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} · {t.label}
                </option>
              ))}
            </select>
          </label>

          {draft.mentorName && (
            <div className="fe-mentor-preview fe-span-full">
              <img src={draft.mentorImage} alt={draft.mentorName} />
              <div>
                <strong>{draft.mentorName}</strong>
                <span>{draft.mentorLabel}</span>
              </div>
            </div>
          )}

          <label className="admin-field fe-span-full">
            <span>Public vise</span>
            <textarea
              rows={4}
              placeholder="Explique a qui s'adresse cette formation et ce qu'elle debloque."
              value={draft.audienceText}
              onChange={(event) => onChange("audienceText", event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="fe-detail-grid fe-detail-grid--split">
        <DetailListEditor
          title="Inclus dans la formation"
          hint="Liste les ressources, l'accompagnement et les avantages concrets de l'offre."
          items={draft.included}
          placeholder="Ex : Acces aux lives et aux replays"
          addLabel="Ajouter un element"
          onChange={(items) => onChange("included", items)}
        />

        <DetailListEditor
          title="Objectifs pedagogiques"
          hint="Formule les competences ou resultats visibles en fin de parcours."
          items={draft.objectives}
          placeholder="Ex : Construire une direction artistique coherente"
          addLabel="Ajouter un objectif"
          onChange={(items) => onChange("objectives", items)}
        />
      </div>

      <ProjectEditor
        projects={draft.projects}
        onChange={(projects) => onChange("projects", projects)}
      />

      <ModuleEditor
        modules={draft.modules}
        onChange={(modules) => onChange("modules", modules)}
      />

      <FaqEditor faqs={draft.faqs} onChange={(faqs) => onChange("faqs", faqs)} />
    </div>
  );
}

export default function DashboardPage() {
  const { success, error: toastError } = useToast();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [formations, setFormations] = useState<AdminFormation[]>([]);
  const [sessions, setSessions] = useState<AdminOnsiteSession[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [trainers, setTrainers] = useState<TrainerProfile[]>(EMPTY_SITE_CONTENT.trainers);
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [userDrafts, setUserDrafts] = useState<Record<number, UserDraft>>({});
  const [sessionDrafts, setSessionDrafts] = useState<Record<number, SessionDraft>>({});
  const [enrollmentDrafts, setEnrollmentDrafts] = useState<Record<number, EnrollmentDraft>>({});
  const [orderDrafts, setOrderDrafts] = useState<Record<number, OrderDraft>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, PaymentDraft>>({});
  const [createDraft, setCreateDraft] = useState<DraftValues>(emptyCreateDraft);
  const [createSessionDraft, setCreateSessionDraft] = useState<SessionCreateDraft>(
    emptySessionCreateDraft,
  );
  const [feedbackBySlug, setFeedbackBySlug] = useState<Record<string, Feedback>>({});
  const [sessionFeedbackById, setSessionFeedbackById] = useState<Record<number, Feedback>>({});
  const [createFeedback, setCreateFeedback] = useState<Feedback | null>(null);
  const [createSessionFeedback, setCreateSessionFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [savingSessionId, setSavingSessionId] = useState<number | null>(null);
  const [savingEnrollmentId, setSavingEnrollmentId] = useState<number | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [savingPaymentId, setSavingPaymentId] = useState<number | null>(null);
  const [remindingPaymentId, setRemindingPaymentId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [catalogDisplayFilter, setCatalogDisplayFilter] =
    useState<CatalogDisplayFilter>("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [formationEditorState, setFormationEditorState] = useState<
    { mode: "create" } | { mode: "edit"; slug: string } | null
  >(null);
  const [sessionEditorState, setSessionEditorState] = useState<
    { mode: "create" } | { mode: "edit"; sessionId: number } | null
  >(null);

  const featuredFormationsCount = useMemo(
    () => formations.filter((formation) => formation.is_featured_home).length,
    [formations],
  );
  const categoryOptions = useMemo(() => {
    const options = new Map<string, string>();
    const addOption = (value: string) => {
      const label = normalizeOptionLabel(value);

      if (!label) {
        return;
      }

      const key = normalizeOptionKey(label);

      if (!options.has(key)) {
        options.set(key, label);
      }
    };

    baseCategoryOptions.forEach(addOption);
    formations.forEach((formation) => addOption(formation.category));

    return Array.from(options.values()).sort((left, right) =>
      left.localeCompare(right, "fr", { sensitivity: "base" }),
    );
  }, [formations]);

  const visibleFormations = useMemo(() => {
    if (catalogDisplayFilter === "featured") {
      return formations.filter((formation) => formation.is_featured_home);
    }

    return formations;
  }, [catalogDisplayFilter, formations]);
  const filteredFormations = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();

    if (!query) {
      return visibleFormations;
    }

    return visibleFormations.filter((formation) =>
      [formation.title, formation.category, formation.level, formation.format_type]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [catalogSearch, visibleFormations]);

  const sessionCapableFormations = useMemo(
    () => formations.filter((formation) => formation.format_type !== "ligne"),
    [formations],
  );
  const teacherUsers = useMemo(
    () =>
      users
        .filter((user) => user.role === "teacher" && user.status === "active")
        .sort((left, right) => left.full_name.localeCompare(right.full_name)),
    [users],
  );
  const availableSessionCreateFormations = useMemo(
    () => sessionCapableFormations,
    [sessionCapableFormations],
  );
  const activeFormation = useMemo(
    () =>
      formationEditorState?.mode === "edit"
        ? formations.find((formation) => formation.slug === formationEditorState.slug) ?? null
        : null,
    [formationEditorState, formations],
  );
  const activeSession = useMemo(
    () =>
      sessionEditorState?.mode === "edit"
        ? sessions.find((session) => session.id === sessionEditorState.sessionId) ?? null
        : null,
    [sessionEditorState, sessions],
  );
  const eligibleSessionFormationIds = useMemo(
    () => new Set(availableSessionCreateFormations.map((formation) => formation.id)),
    [availableSessionCreateFormations],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchAdminOverview(),
      fetchAdminFormations(),
      fetchAdminOnsiteSessions(),
      fetchAdminUsers(),
      fetchAdminEnrollments(),
      fetchAdminOrders(),
      fetchAdminPayments(),
      fetchPublicSiteContent(),
    ])
      .then(([overviewData, formationsData, sessionsData, usersData, enrollmentsData, ordersData, paymentsData, siteContent]) => {
        if (!isMounted) {
          return;
        }

        setOverview(overviewData);
        setFormations(formationsData);
        setSessions(sessionsData);
        setUsers(usersData);
        setEnrollments(enrollmentsData);
        setOrders(ordersData);
        setPayments(paymentsData);
        setTrainers(siteContent.trainers);
        setDrafts(
          Object.fromEntries(
            formationsData.map((formation) => [formation.slug, buildDraftFromFormation(formation)]),
          ),
        );
        setUserDrafts(
          Object.fromEntries(usersData.map((user) => [user.id, buildUserDraft(user)])),
        );
        setSessionDrafts(
          Object.fromEntries(
            sessionsData.map((session) => [session.id, buildSessionDraft(session)]),
          ),
        );
        setEnrollmentDrafts(
          Object.fromEntries(
            enrollmentsData.map((enrollment) => [enrollment.id, buildEnrollmentDraft(enrollment)]),
          ),
        );
        setOrderDrafts(
          Object.fromEntries(ordersData.map((order) => [order.id, buildOrderDraft(order)])),
        );
        setPaymentDrafts(
          Object.fromEntries(
            paymentsData.map((payment) => [payment.id, buildPaymentDraft(payment)]),
          ),
        );
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setLoadingError(
          "Impossible de charger le dashboard admin. Verifie que l'API backend tourne et que votre compte admin est bien connecte.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const syncDraft = <K extends keyof DraftValues>(
    slug: string,
    field: K,
    value: DraftValues[K],
  ) => {
    setDrafts((current) => ({
      ...current,
      [slug]: {
        ...(current[slug] ?? emptyCreateDraft()),
        [field]: value,
      },
    }));

    setFeedbackBySlug((current) => {
      if (!(slug in current)) {
        return current;
      }

      const next = { ...current };
      delete next[slug];
      return next;
    });
  };

  const syncCreateDraft = <K extends keyof DraftValues>(
    field: K,
    value: DraftValues[K],
  ) => {
    setCreateDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setCreateFeedback(null);
  };

  const syncCreateSessionDraft = (
    field: keyof SessionCreateDraft,
    value: string | SessionStatus,
  ) => {
    setCreateSessionDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setCreateSessionFeedback(null);
  };

  const syncUserDraft = (
    userId: number,
    field: keyof UserDraft,
    value: UserRole | UserStatus,
  ) => {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? { role: "student", status: "active" }),
        [field]: value,
      },
    }));
  };

  const syncSessionDraft = (
    sessionId: number,
    field: keyof SessionDraft,
    value: string | SessionStatus,
  ) => {
    setSessionDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...(current[sessionId] ?? buildSessionDraft(sessions.find((item) => item.id === sessionId)!)),
        [field]: value,
      },
    }));
    setSessionFeedbackById((current) => {
      if (!(sessionId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
  };

  const syncEnrollmentDraft = (enrollmentId: number, status: EnrollmentStatus) => {
    setEnrollmentDrafts((current) => ({
      ...current,
      [enrollmentId]: {
        ...(current[enrollmentId] ?? { status, sessionId: null }),
        status,
      },
    }));
  };

  const syncEnrollmentSessionDraft = (enrollmentId: number, sessionId: number | null) => {
    setEnrollmentDrafts((current) => ({
      ...current,
      [enrollmentId]: {
        ...(current[enrollmentId] ?? { status: "pending", sessionId }),
        sessionId,
      },
    }));
  };

  const syncOrderDraft = (orderId: number, status: OrderStatus) => {
    setOrderDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? { status }),
        status,
      },
    }));
  };

  const syncPaymentDraft = (
    paymentId: number,
    field: keyof PaymentDraft,
    value: string | PaymentStatus,
  ) => {
    setPaymentDrafts((current) => ({
      ...current,
      [paymentId]: {
        ...(current[paymentId] ?? { providerCode: "", status: "pending" }),
        [field]: value,
      },
    }));
  };

  const openCreateFormationEditor = () => {
    setCreateDraft(emptyCreateDraft());
    setCreateFeedback(null);
    setFormationEditorState({ mode: "create" });
  };

  const openEditFormationEditor = (slug: string) => {
    setFeedbackBySlug((current) => {
      if (!(slug in current)) {
        return current;
      }
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setFormationEditorState({ mode: "edit", slug });
  };

  const closeFormationEditor = () => {
    setFormationEditorState(null);
    setCreateFeedback(null);
  };

  const openCreateSessionEditor = (formationId?: number) => {
    setCreateSessionDraft({
      ...emptySessionCreateDraft(),
      formationId: formationId ? String(formationId) : "",
    });
    setCreateSessionFeedback(null);
    setSessionEditorState({ mode: "create" });
  };

  const openEditSessionEditor = (sessionId: number) => {
    setSessionFeedbackById((current) => {
      if (!(sessionId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setSessionEditorState({ mode: "edit", sessionId });
  };

  const closeSessionEditor = () => {
    setSessionEditorState(null);
    setCreateSessionFeedback(null);
  };

  const refreshOverview = async () => {
    const nextOverview = await fetchAdminOverview();
    setOverview(nextOverview);
  };

  const refreshFormationsAndSessions = async () => {
    const [nextFormations, nextSessions, nextEnrollments] = await Promise.all([
      fetchAdminFormations(),
      fetchAdminOnsiteSessions(),
      fetchAdminEnrollments(),
    ]);

    setFormations(nextFormations);
    setSessions(nextSessions);
    setEnrollments(nextEnrollments);
    setDrafts(
      Object.fromEntries(
        nextFormations.map((formation) => [formation.slug, buildDraftFromFormation(formation)]),
      ),
    );
    setSessionDrafts(
      Object.fromEntries(nextSessions.map((session) => [session.id, buildSessionDraft(session)])),
    );
    setEnrollmentDrafts(
      Object.fromEntries(
        nextEnrollments.map((enrollment) => [enrollment.id, buildEnrollmentDraft(enrollment)]),
      ),
    );
  };

  const handleSave = async (formation: AdminFormation) => {
    const draft = drafts[formation.slug];

    try {
      const { payload, currentPrice } = buildPayloadFromDraft(draft, categoryOptions);
      setSavingSlug(formation.slug);

      const updated = await updateAdminFormation(formation.slug, payload);

      setFormations((current) =>
        current.map((item) => (item.slug === updated.slug ? updated : item)),
      );

      setDrafts((current) => ({
        ...current,
        [updated.slug]: buildDraftFromFormation(updated),
      }));

      setFeedbackBySlug((current) => ({
        ...current,
        [formation.slug]: {
          type: "success",
          message:
            updated.format_type === "presentiel" && shouldAllowInstallments(updated.format_type, currentPrice)
              ? "Formation mise a jour. Les tranches sont maintenant actives pour ce presentiel."
              : "La formation a ete mise a jour.",
        },
      }));

      await refreshOverview();
      return true;
    } catch (error) {
      const field = error instanceof FormationDraftError ? error.field : undefined;
      setFeedbackBySlug((current) => ({
        ...current,
        [formation.slug]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
            : "Echec de sauvegarde. Reessaie quand l'API admin est disponible.",
          field,
        },
      }));
      scrollFormationEditorToError(field);
      return false;
    } finally {
      setSavingSlug(null);
    }
  };

  const handleCreate = async () => {
    try {
      const slug = slugify(createDraft.title);
      if (!slug) {
        throw new Error("Le titre doit permettre de generer un slug valide.");
      }

      const { payload, currentPrice } = buildPayloadFromDraft(createDraft, categoryOptions);
      setIsCreating(true);

      const created = await createAdminFormation({
        slug,
        ...payload,
      });

      setFormations((current) => [created, ...current]);
      setDrafts((current) => ({
        ...current,
        [created.slug]: buildDraftFromFormation(created),
      }));
      setCreateDraft(emptyCreateDraft());
      setCreateFeedback({
        type: "success",
        message:
          created.format_type === "presentiel" && shouldAllowInstallments(created.format_type, currentPrice)
            ? "Formation creee. Le paiement en tranches est automatiquement active."
            : "Nouvelle formation creee dans le catalogue.",
      });

      await refreshOverview();
      return true;
    } catch (error) {
      const field = error instanceof FormationDraftError ? error.field : undefined;
      setCreateFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de creer la formation pour le moment.",
        field,
      });
      scrollFormationEditorToError(field);
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveUser = async (user: AdminUser) => {
    const draft = userDrafts[user.id];
    const payload: AdminUserUpdatePayload = {};

    if (!draft) {
      return;
    }

    if (draft.role !== user.role) {
      payload.role = draft.role;
    }
    if (draft.status !== user.status) {
      payload.status = draft.status;
    }
    if (Object.keys(payload).length === 0) {
      success("Aucun changement à enregistrer.");
      return;
    }

    try {
      setSavingUserId(user.id);
      const updated = await updateAdminUser(user.id, payload);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setUserDrafts((current) => ({
        ...current,
        [updated.id]: buildUserDraft(updated),
      }));
      const refreshedEnrollments = await fetchAdminEnrollments();
      setEnrollments(refreshedEnrollments);
      setEnrollmentDrafts(
        Object.fromEntries(
          refreshedEnrollments.map((enrollment) => [enrollment.id, buildEnrollmentDraft(enrollment)]),
        ),
      );
      success("Utilisateur mis à jour.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Échec de mise à jour utilisateur.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSaveEnrollment = async (enrollment: AdminEnrollment) => {
    const draft = enrollmentDrafts[enrollment.id];
    if (!draft) {
      return;
    }

    const statusChanged = draft.status !== enrollment.status;
    const sessionChanged = draft.sessionId !== (enrollment.session_id ?? null);
    if (!statusChanged && !sessionChanged) {
      success("Aucun changement à enregistrer.");
      return;
    }

    const payload: AdminEnrollmentUpdatePayload = {};
    if (statusChanged) {
      payload.status = draft.status;
    }
    if (sessionChanged) {
      payload.session_id = draft.sessionId;
    }

    try {
      setSavingEnrollmentId(enrollment.id);
      const updated = await updateAdminEnrollment(enrollment.id, payload);
      setEnrollments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEnrollmentDrafts((current) => ({
        ...current,
        [updated.id]: buildEnrollmentDraft(updated),
      }));
      success("Inscription mise à jour.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Échec de mise à jour inscription.");
    } finally {
      setSavingEnrollmentId(null);
    }
  };

  const handleSaveSession = async (session: AdminOnsiteSession) => {
    const draft = sessionDrafts[session.id];
    if (!draft) {
      return;
    }

    const payload: AdminOnsiteSessionUpdatePayload = {};
    if (draft.label !== session.label) {
      payload.label = draft.label.trim();
    }
    if (draft.startDate !== session.start_date) {
      payload.start_date = draft.startDate;
    }
    if (draft.endDate !== session.end_date) {
      payload.end_date = draft.endDate;
    }
    if (draft.campusLabel !== session.campus_label) {
      payload.campus_label = draft.campusLabel.trim();
    }
    if (draft.teacherName !== session.teacher_name) {
      payload.teacher_name = draft.teacherName.trim() || null;
    }
    const seatCapacity = Number.parseInt(draft.seatCapacity, 10);
    if (Number.isInteger(seatCapacity) && seatCapacity !== session.seat_capacity) {
      payload.seat_capacity = seatCapacity;
    }
    if (draft.status !== session.status) {
      payload.status = draft.status;
    }
    const draftLink = draft.meetingLink.trim() || null;
    if (draftLink !== (session.meeting_link ?? null)) {
      payload.meeting_link = draftLink;
    }
    if (Object.keys(payload).length === 0) {
      setSessionFeedbackById((current) => ({
        ...current,
        [session.id]: { type: "success", message: "Aucun changement a enregistrer." },
      }));
      return;
    }

    try {
      setSavingSessionId(session.id);
      const updated = await updateAdminOnsiteSession(session.id, payload);
      setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSessionDrafts((current) => ({
        ...current,
        [updated.id]: buildSessionDraft(updated),
      }));
      await refreshFormationsAndSessions();
      await refreshOverview();
      setSessionFeedbackById((current) => ({
        ...current,
        [session.id]: { type: "success", message: "Session mise a jour." },
      }));
      return true;
    } catch (error) {
      setSessionFeedbackById((current) => ({
        ...current,
        [session.id]: {
          type: "error",
          message: error instanceof Error ? error.message : "Echec de mise a jour session.",
        },
      }));
      return false;
    } finally {
      setSavingSessionId(null);
    }
  };

  const handleCreateSession = async () => {
    const formationId = Number.parseInt(createSessionDraft.formationId, 10);
    const seatCapacity = Number.parseInt(createSessionDraft.seatCapacity, 10);

    try {
      if (!Number.isInteger(formationId) || formationId <= 0) {
        throw new Error("Selectionnez d'abord une formation live ou presentiel.");
      }
      if (!createSessionDraft.label.trim()) {
        throw new Error("Le libelle de session ne peut pas etre vide.");
      }
      if (!createSessionDraft.startDate) {
        throw new Error("La date de debut est obligatoire.");
      }
      if (!createSessionDraft.endDate) {
        throw new Error("La date de fin est obligatoire.");
      }
      if (createSessionDraft.endDate < createSessionDraft.startDate) {
        throw new Error("La date de fin doit etre posterieure ou egale a la date de debut.");
      }
      if (!Number.isInteger(seatCapacity) || seatCapacity < 0) {
        throw new Error("La capacite doit etre un entier positif ou nul.");
      }

      const payload: AdminFormationSessionCreatePayload = {
        formation_id: formationId,
        label: createSessionDraft.label.trim(),
        start_date: createSessionDraft.startDate,
        end_date: createSessionDraft.endDate,
        campus_label: createSessionDraft.campusLabel.trim() || null,
        seat_capacity: seatCapacity,
        teacher_name: createSessionDraft.teacherName.trim() || null,
        status: createSessionDraft.status,
        meeting_link: createSessionDraft.meetingLink.trim() || null,
      };

      setIsCreatingSession(true);
      const created = await createAdminOnsiteSession(payload);
      setSessions((current) =>
        [...current, created].sort((left, right) =>
          left.start_date.localeCompare(right.start_date),
        ),
      );
      setSessionDrafts((current) => ({
        ...current,
        [created.id]: buildSessionDraft(created),
      }));
      setCreateSessionDraft(emptySessionCreateDraft());
      setCreateSessionFeedback({
        type: "success",
        message: "Nouvelle session creee avec succes.",
      });
      await refreshFormationsAndSessions();
      await refreshOverview();
      return true;
    } catch (error) {
      setCreateSessionFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de creer la session pour le moment.",
      });
      return false;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSaveOrder = async (order: AdminOrder) => {
    const draft = orderDrafts[order.id];
    if (!draft) {
      return;
    }
    const payload: AdminOrderUpdatePayload = { status: draft.status };
    if (draft.status === order.status) {
      success("Aucun changement à enregistrer.");
      return;
    }
    try {
      setSavingOrderId(order.id);
      const updated = await updateAdminOrder(order.id, payload);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setOrderDrafts((current) => ({
        ...current,
        [updated.id]: buildOrderDraft(updated),
      }));
      const refreshedEnrollments = await fetchAdminEnrollments();
      setEnrollments(refreshedEnrollments);
      setEnrollmentDrafts(
        Object.fromEntries(
          refreshedEnrollments.map((enrollment) => [enrollment.id, buildEnrollmentDraft(enrollment)]),
        ),
      );
      await refreshOverview();
      success("Commande mise à jour.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Échec de mise à jour commande.");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleSavePayment = async (payment: AdminPayment) => {
    const draft = paymentDrafts[payment.id];
    if (!draft) {
      return;
    }
    const payload: AdminPaymentUpdatePayload = {};
    if (draft.providerCode.trim() !== payment.provider_code) {
      payload.provider_code = draft.providerCode.trim();
    }
    if (draft.status !== payment.status) {
      payload.status = draft.status;
    }
    if (Object.keys(payload).length === 0) {
      success("Aucun changement à enregistrer.");
      return;
    }
    try {
      setSavingPaymentId(payment.id);
      const updated = await updateAdminPayment(payment.id, payload);
      setPayments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setPaymentDrafts((current) => ({
        ...current,
        [updated.id]: buildPaymentDraft(updated),
      }));
      const [refreshedOrders, refreshedEnrollments] = await Promise.all([
        fetchAdminOrders(),
        fetchAdminEnrollments(),
      ]);
      setOrders(refreshedOrders);
      setEnrollments(refreshedEnrollments);
      setEnrollmentDrafts(
        Object.fromEntries(
          refreshedEnrollments.map((enrollment) => [enrollment.id, buildEnrollmentDraft(enrollment)]),
        ),
      );
      await refreshOverview();
      success("Paiement mis à jour.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Échec de mise à jour paiement.");
    } finally {
      setSavingPaymentId(null);
    }
  };

  const handleSendPaymentReminder = async (payment: AdminPayment) => {
    try {
      setRemindingPaymentId(payment.id);
      const updated = await sendAdminPaymentReminder(payment.id);
      setPayments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setPaymentDrafts((current) => ({
        ...current,
        [updated.id]: buildPaymentDraft(updated),
      }));
      const [refreshedOrders, refreshedEnrollments] = await Promise.all([
        fetchAdminOrders(),
        fetchAdminEnrollments(),
      ]);
      setOrders(refreshedOrders);
      setEnrollments(refreshedEnrollments);
      setEnrollmentDrafts(
        Object.fromEntries(
          refreshedEnrollments.map((enrollment) => [enrollment.id, buildEnrollmentDraft(enrollment)]),
        ),
      );
      success("Relance envoyée.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Échec d'envoi de relance.");
    } finally {
      setRemindingPaymentId(null);
    }
  };

  const formationEditorDraft =
    formationEditorState?.mode === "create"
      ? createDraft
      : activeFormation
        ? drafts[activeFormation.slug] ?? buildDraftFromFormation(activeFormation)
        : null;
  const formationEditorFeedback =
    formationEditorState?.mode === "create"
      ? createFeedback
      : activeFormation
        ? feedbackBySlug[activeFormation.slug] ?? null
        : null;
  const sessionEditorDraft =
    sessionEditorState?.mode === "create"
      ? createSessionDraft
      : activeSession
        ? sessionDrafts[activeSession.id] ?? buildSessionDraft(activeSession)
        : null;
  const sessionEditorFeedback =
    sessionEditorState?.mode === "create"
      ? createSessionFeedback
      : activeSession
        ? sessionFeedbackById[activeSession.id] ?? null
        : null;
  const outletContext: AdminDashboardOutletContext = {
    overview,
    formations,
    sessions,
    users,
    enrollments,
    orders,
    payments,
    loading,
    loadingError,
    filteredFormations,
    featuredFormationsCount,
    sessionCapableFormations,
    availableSessionCreateFormations,
    eligibleSessionFormationIds,
    catalogSearch,
    catalogDisplayFilter,
    setCatalogSearch,
    setCatalogDisplayFilter,
    openCreateFormationEditor,
    openEditFormationEditor,
    openCreateSessionEditor,
    openEditSessionEditor,
    userDrafts,
    userRoles,
    userStatuses,
    syncUserDraft,
    savingUserId,
    handleSaveUser,
    userFeedbackById: {},
    enrollmentDrafts,
    enrollmentStatuses,
    syncEnrollmentDraft,
    syncEnrollmentSessionDraft,
    savingEnrollmentId,
    handleSaveEnrollment,
    enrollmentFeedbackById: {},
    orderDrafts,
    orderStatuses,
    syncOrderDraft,
    savingOrderId,
    handleSaveOrder,
    orderFeedbackById: {},
    paymentDrafts,
    paymentStatuses,
    syncPaymentDraft,
    savingPaymentId,
    remindingPaymentId,
    handleSavePayment,
    handleSendPaymentReminder,
    paymentFeedbackById: {},
  };
  const formationErrorField =
    formationEditorFeedback?.type === "error" ? formationEditorFeedback.field : undefined;
  const formationFieldClass = (field: keyof DraftValues | "slug") =>
    formationErrorField === field ? " is-invalid" : "";

  return (
    <>
      <Outlet context={outletContext} />

      {formationEditorState && formationEditorDraft ? (
        <AdminDrawer
          title={
            formationEditorState.mode === "create"
              ? "Nouvelle formation"
              : `Edition · ${activeFormation?.title ?? "Formation"}`
          }
          subtitle={
            formationEditorState.mode === "create"
              ? "Cree une nouvelle offre puis enrichis sa fiche publique."
              : "Mets a jour le produit, sa vitrine et son contenu detaille."
          }
          onClose={closeFormationEditor}
        >
          {/* ── Formation editor layout ── */}
          <div className="fe-layout">

            {/* ── Left: form ── */}
            <div className="fe-form">

              {/* Section 1 — Identité */}
              <section className="fe-section">
                <div className="fe-section__head">
                  <span className="fe-section__icon"><PackageOpen size={15} strokeWidth={2} /></span>
                  <div>
                    <h4>Identité produit</h4>
                    <p>Titre, catégorie, format et cover.</p>
                  </div>
                </div>

                <div className="fe-fields">
                  <label className={`admin-field fe-span-full${formationFieldClass("title")}`} data-field="title">
                    <span>Titre de la formation</span>
                    <input
                      type="text"
                      placeholder="Ex : Maîtrisez le Design Packaging de A à Z"
                      value={formationEditorDraft.title}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("title", e.target.value)
                          : syncDraft(formationEditorState.slug, "title", e.target.value)
                      }
                    />
                  </label>

                  <label className={`admin-field${formationFieldClass("category")}`} data-field="category">
                    <span>Catégorie</span>
                    <select
                      value={resolveOptionValue(formationEditorDraft.category, categoryOptions)}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("category", e.target.value)
                          : syncDraft(formationEditorState.slug, "category", e.target.value)
                      }
                    >
                      <option value="">— Choisir une catégorie —</option>
                      {!hasEquivalentOption(categoryOptions, formationEditorDraft.category) && formationEditorDraft.category ? (
                        <option value={formationEditorDraft.category}>{formationEditorDraft.category}</option>
                      ) : null}
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={`admin-field${formationFieldClass("level")}`} data-field="level">
                    <span>Niveau</span>
                    <select
                      value={formationEditorDraft.level}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("level", e.target.value)
                          : syncDraft(formationEditorState.slug, "level", e.target.value)
                      }
                    >
                      <option value="">— Choisir un niveau —</option>
                      {!levelOptions.includes(formationEditorDraft.level) && formationEditorDraft.level ? (
                        <option value={formationEditorDraft.level}>{formationEditorDraft.level}</option>
                      ) : null}
                      {levelOptions.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </label>

          <label className="admin-field fe-span-full" data-field="formatType">
            <span>Format</span>
            <FormatPicker
              value={formationEditorDraft.formatType}
              onChange={(value) =>
                formationEditorState.mode === "create"
                  ? syncCreateDraft("formatType", value)
                  : syncDraft(formationEditorState.slug, "formatType", value)
              }
            />
          </label>

          <label className="admin-field">
            <span>Libelle format</span>
            <input type="text" value={formatTypeLabel(formationEditorDraft.formatType)} disabled />
          </label>

          <label className="admin-field">
            <span>Dashboard derive</span>
            <input type="text" value={dashboardTypeLabel(formationEditorDraft.formatType)} disabled />
          </label>

                  {/* Cover upload — full width */}
                  <div className={`fe-span-full${formationFieldClass("image")}`} data-field="image">
                    <p className="fe-field-label">Image / Cover</p>
                    <CoverUploadZone
                      value={formationEditorDraft.image}
                      onChange={(url) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("image", url)
                          : syncDraft(formationEditorState.slug, "image", url)
                      }
                    />
                  </div>
                </div>
              </section>

              {/* Section 2 — Prix & vitrine */}
              <section className="fe-section">
                <div className="fe-section__head">
                  <span className="fe-section__icon"><BadgeDollarSign size={15} strokeWidth={2} /></span>
                  <div>
                    <h4>Prix &amp; vitrine</h4>
                    <p>Tarification, mise en avant et badges marketing.</p>
                  </div>
                </div>

                <div className="fe-fields">
                  <label className={`admin-field${formationFieldClass("currentPrice")}`} data-field="currentPrice">
                    <span>Prix actuel (FCFA)</span>
                    <input
                      type="number" min="0" step="1"
                      placeholder="50000"
                      value={formationEditorDraft.currentPrice}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("currentPrice", e.target.value)
                          : syncDraft(formationEditorState.slug, "currentPrice", e.target.value)
                      }
                    />
                  </label>

                  <label className={`admin-field${formationFieldClass("originalPrice")}`} data-field="originalPrice">
                    <span>Prix barré (FCFA)</span>
                    <input
                      type="number" min="0" step="1"
                      placeholder="75000"
                      value={formationEditorDraft.originalPrice}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("originalPrice", e.target.value)
                          : syncDraft(formationEditorState.slug, "originalPrice", e.target.value)
                      }
                    />
                  </label>

                  <label className={`admin-field${formationFieldClass("promoEndsAt")}`} data-field="promoEndsAt">
                    <span>Date limite promo</span>
                    <input
                      type="date"
                      value={formationEditorDraft.promoEndsAt}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("promoEndsAt", e.target.value)
                          : syncDraft(formationEditorState.slug, "promoEndsAt", e.target.value)
                      }
                    />
                  </label>

                  <label className={`admin-field${formationFieldClass("rating")}`} data-field="rating">
                    <span>Note (/ 5)</span>
                    <input
                      type="number" min="0" max="5" step="0.5"
                      value={formationEditorDraft.rating}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("rating", e.target.value)
                          : syncDraft(formationEditorState.slug, "rating", e.target.value)
                      }
                    />
                  </label>

                  <label className={`admin-field${formationFieldClass("reviews")}`} data-field="reviews">
                    <span>Nombre d'avis</span>
                    <input
                      type="number" min="0" step="1"
                      value={formationEditorDraft.reviews}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("reviews", e.target.value)
                          : syncDraft(formationEditorState.slug, "reviews", e.target.value)
                      }
                    />
                  </label>

                  <label className="admin-field">
                    <span>Vedette accueil</span>
                    <select
                      value={formationEditorDraft.isFeaturedHome ? "oui" : "non"}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("isFeaturedHome", e.target.value === "oui")
                          : syncDraft(formationEditorState.slug, "isFeaturedHome", e.target.value === "oui")
                      }
                    >
                      <option value="non">Non</option>
                      <option value="oui">Oui — affiché en accueil</option>
                    </select>
                  </label>

                  <label className={`admin-field${formationFieldClass("homeFeatureRank")}`} data-field="homeFeatureRank">
                    <span>Ordre accueil</span>
                    <input
                      type="number" min="0" step="1"
                      value={formationEditorDraft.homeFeatureRank}
                      onChange={(e) =>
                        formationEditorState.mode === "create"
                          ? syncCreateDraft("homeFeatureRank", e.target.value)
                          : syncDraft(formationEditorState.slug, "homeFeatureRank", e.target.value)
                      }
                    />
                  </label>
                </div>

                {/* Badges */}
                <div className="fe-badges-block">
                  <p className="fe-field-label">Badges marketing</p>
                  <div className="fe-badges-row">
                    {marketingBadges.map((badge) => (
                      <button
                        key={badge}
                        type="button"
                        className={`fe-badge-btn fe-badge-btn--${badge}${formationEditorDraft.badges.includes(badge) ? " is-on" : ""}`}
                        onClick={() =>
                          toggleBadge(formationEditorDraft.badges, badge, (next) =>
                            formationEditorState.mode === "create"
                              ? syncCreateDraft("badges", next)
                              : syncDraft(formationEditorState.slug, "badges", next)
                          )
                        }
                      >
                        {badgeIcon(badge)} {badgeLabel(badge)}
                      </button>
                    ))}
                  </div>
                  <p className="fe-hint">Le badge <em>Promo</em> est automatique si prix barré &gt; prix actuel.</p>
                </div>

                {formationEditorFeedback && (
                  <p
                    className={`admin-feedback admin-feedback--${formationEditorFeedback.type} fe-feedback`}
                    role={formationEditorFeedback.type === "error" ? "alert" : "status"}
                  >
                    {formationEditorFeedback.message}
                  </p>
                )}
              </section>

              {/* Section 3 — Détail / contenu */}
              <section className="fe-section">
                <div className="fe-section__head">
                  <span className="fe-section__icon"><BookOpen size={15} strokeWidth={2} /></span>
                  <div>
                    <h4>Contenu &amp; détails</h4>
                    <p>Description, programme, objectifs pédagogiques.</p>
                  </div>
                </div>
                <div className="fe-fields">
                  <FormationDetailFields
                    draft={formationEditorDraft}
                    trainers={trainers}
                    onChange={(field, value) =>
                      formationEditorState.mode === "create"
                        ? syncCreateDraft(field, value)
                        : syncDraft(formationEditorState.slug, field, value)
                    }
                  />
                </div>
              </section>

              <div className="fe-form__footer">
                <button className="admin-secondary-button" type="button" onClick={closeFormationEditor}>
                  <X size={15} /> Annuler
                </button>
                <button
                  className="admin-action-button"
                  type="button"
                  disabled={
                    formationEditorState.mode === "create"
                      ? isCreating
                      : savingSlug === formationEditorState.slug
                  }
                  onClick={() => {
                    void (async () => {
                      const ok =
                        formationEditorState.mode === "create"
                          ? await handleCreate()
                          : activeFormation
                            ? await handleSave(activeFormation)
                            : false;
                      if (ok) closeFormationEditor();
                    })();
                  }}
                >
                  <Save size={15} />
                  {formationEditorState.mode === "create"
                    ? isCreating ? "Création…" : "Créer la formation"
                    : savingSlug === formationEditorState.slug ? "Sauvegarde…" : "Enregistrer"}
                </button>
              </div>

            </div>

            {/* ── Right: live preview ── */}
            <aside className="fe-preview">
              <p className="fe-preview__label"><GalleryHorizontalEnd size={13} /> Aperçu vitrine</p>

              <div className="fe-preview__card">
                {/* Cover */}
                <div className="fe-preview__cover">
                  {formationEditorDraft.image
                    ? <img src={formationEditorDraft.image} alt="" />
                    : <div className="fe-preview__cover-empty"><ImagePlus size={28} strokeWidth={1.5} /><span>Aucune image</span></div>
                  }
                </div>

                {/* Info */}
                <div className="fe-preview__body">
                  <span className={`adm-format-pill adm-format-pill--${formationEditorDraft.formatType}`}>
                    {formatTypeLabel(formationEditorDraft.formatType)}
                  </span>
                  <h4 className="fe-preview__title">
                    {formationEditorDraft.title || <span className="fe-preview__placeholder">Titre de la formation</span>}
                  </h4>
                  <p className="fe-preview__slug">
                    /formations/{slugify(formationEditorDraft.title) || "slug-genere-automatiquement"}
                  </p>
                  <p className="fe-preview__meta">
                    {formationEditorDraft.category || "Catégorie"} · {formationEditorDraft.level || "Niveau"}
                  </p>
                  {formationEditorDraft.intro ? (
                    <p className="fe-preview__excerpt">{formationEditorDraft.intro}</p>
                  ) : null}
                  <div className="fe-preview__price">
                    <strong>
                      {formationEditorDraft.currentPrice
                        ? `${Number.parseInt(formationEditorDraft.currentPrice || "0", 10).toLocaleString("fr-FR")} FCFA`
                        : "Prix à définir"}
                    </strong>
                  {formationEditorDraft.originalPrice && (
                      <small>
                        {Number.parseInt(formationEditorDraft.originalPrice || "0", 10).toLocaleString("fr-FR")} FCFA
                      </small>
                    )}
                    {formationEditorDraft.originalPrice && formationEditorDraft.promoEndsAt ? (
                      <em>Promo jusqu'au {new Date(`${formationEditorDraft.promoEndsAt}T00:00:00`).toLocaleDateString("fr-FR")}</em>
                    ) : null}
                  </div>
                  {formationEditorDraft.badges.length > 0 && (
                    <div className="fe-preview__badges">
                      {formationEditorDraft.badges.map((b) => (
                        <span key={b} className={`adm-market-badge adm-market-badge--${b}`}>
                          {badgeIcon(b)} {badgeLabel(b)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Meta indicators */}
              <div className="fe-preview__meta-pills">
                <span className="fe-meta-pill">
                  <LayoutTemplate size={12} />
                  {dashboardTypeLabel(formationEditorDraft.formatType)}
                </span>
                {formationEditorDraft.isFeaturedHome && (
                  <span className="fe-meta-pill fe-meta-pill--star">
                    <Tag size={12} />
                    Accueil #{formationEditorDraft.homeFeatureRank}
                  </span>
                )}
              </div>

              <div className="fe-preview__stats">
                <div className="fe-preview__stat">
                  <span>Inclus</span>
                  <strong>{normalizeStringList(formationEditorDraft.included).length}</strong>
                </div>
                <div className="fe-preview__stat">
                  <span>Projets</span>
                  <strong>
                    {formationEditorDraft.projects.filter(
                      (project) =>
                        trimValue(project.title) ||
                        trimValue(project.image) ||
                        trimValue(project.poster),
                    ).length}
                  </strong>
                </div>
                <div className="fe-preview__stat">
                  <span>Modules</span>
                  <strong>
                    {formationEditorDraft.modules.filter(
                      (module) =>
                        trimValue(module.title) ||
                        trimValue(module.summary) ||
                        trimValue(module.duration) ||
                        normalizeStringList(module.lessons ?? []).length > 0,
                    ).length}
                  </strong>
                </div>
                <div className="fe-preview__stat">
                  <span>FAQ</span>
                  <strong>
                    {formationEditorDraft.faqs.filter(
                      (faq) => trimValue(faq.question) || trimValue(faq.answer),
                    ).length}
                  </strong>
                </div>
              </div>
            </aside>
          </div>
        </AdminDrawer>
      ) : null}

      {sessionEditorState && sessionEditorDraft ? (
        <AdminModal
          title={
            sessionEditorState.mode === "create"
              ? "Nouvelle session"
              : `Édition session · ${activeSession?.label ?? ""}`
          }
          subtitle="Les sessions ne concernent que les formations live et présentiel."
          onClose={closeSessionEditor}
          size="wide"
        >
          <div className="admin-editor-stack">
            <section className="admin-editor-card admin-session-editor-card">
              <div className="admin-editor-card__heading admin-session-editor-card__heading">
                <div>
                  <h4>Paramètres de session</h4>
                  <p>Organisez la cohorte, le planning et l'accès live sans tasser les informations.</p>
                </div>
                <div className="admin-session-editor-card__hint">
                  <strong>Vue rapide</strong>
                  <span>Le lien Jitsi reste facultatif. S'il est vide, il sera généré automatiquement.</span>
                </div>
              </div>

              <div className="admin-session-form">
                <section className="admin-session-form__section">
                  <div className="admin-session-form__section-heading">
                    <strong>Cohorte</strong>
                    <span>Choisissez la formation, le libellé affiché et l'intervenant responsable.</span>
                  </div>

                  <div className="admin-session-form__grid admin-session-form__grid--identity">
                    <label className="admin-field admin-session-form__field">
                      <span>Formation</span>
                      {sessionEditorState.mode === "create" ? (
                        <select
                          value={sessionEditorDraft.formationId}
                          onChange={(event) => syncCreateSessionDraft("formationId", event.target.value)}
                        >
                          <option value="">Choisir une formation</option>
                          {availableSessionCreateFormations.map((formation) => (
                            <option key={formation.id} value={formation.id}>
                              {formation.title} · {formatTypeLabel(formation.format_type)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" value={activeSession?.formation_title ?? ""} disabled />
                      )}
                    </label>

                    <label className="admin-field admin-session-form__field">
                      <span>Libellé</span>
                      <input
                        type="text"
                        value={sessionEditorDraft.label}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("label", event.target.value)
                            : syncSessionDraft(activeSession!.id, "label", event.target.value)
                        }
                      />
                    </label>

                    <label className="admin-field admin-session-form__field">
                      <span>Intervenant</span>
                      <select
                        value={sessionEditorDraft.teacherName}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("teacherName", event.target.value)
                            : syncSessionDraft(activeSession!.id, "teacherName", event.target.value)
                        }
                      >
                        <option value="">Non assigné</option>
                        {sessionEditorDraft.teacherName &&
                          !teacherUsers.some((teacher) => teacher.full_name === sessionEditorDraft.teacherName) && (
                            <option value={sessionEditorDraft.teacherName}>{sessionEditorDraft.teacherName}</option>
                          )}
                        {teacherUsers.map((teacher) => (
                          <option key={teacher.id} value={teacher.full_name}>
                            {teacher.full_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="admin-field admin-session-form__field">
                      <span>Statut</span>
                      <select
                        value={sessionEditorDraft.status}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("status", event.target.value as SessionStatus)
                            : syncSessionDraft(activeSession!.id, "status", event.target.value as SessionStatus)
                        }
                      >
                        {sessionStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="admin-session-form__section">
                  <div className="admin-session-form__section-heading">
                    <strong>Planning</strong>
                    <span>Renseignez la période, le lieu et la capacité de la cohorte.</span>
                  </div>

                  <div className="admin-session-form__grid admin-session-form__grid--schedule">
                    <label className="admin-field admin-session-form__field">
                      <span>Début</span>
                      <input
                        type="date"
                        value={sessionEditorDraft.startDate}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("startDate", event.target.value)
                            : syncSessionDraft(activeSession!.id, "startDate", event.target.value)
                        }
                      />
                    </label>

                    <label className="admin-field admin-session-form__field">
                      <span>Fin</span>
                      <input
                        type="date"
                        value={sessionEditorDraft.endDate}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("endDate", event.target.value)
                            : syncSessionDraft(activeSession!.id, "endDate", event.target.value)
                        }
                      />
                    </label>

                    <label className="admin-field admin-session-form__field">
                      <span>Campus / lieu</span>
                      <input
                        type="text"
                        value={sessionEditorDraft.campusLabel}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("campusLabel", event.target.value)
                            : syncSessionDraft(activeSession!.id, "campusLabel", event.target.value)
                        }
                      />
                    </label>

                    <label className="admin-field admin-session-form__field">
                      <span>Places</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={sessionEditorDraft.seatCapacity}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("seatCapacity", event.target.value)
                            : syncSessionDraft(activeSession!.id, "seatCapacity", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="admin-session-form__section">
                  <div className="admin-session-form__section-heading">
                    <strong>Diffusion live</strong>
                    <span>Ajoutez un lien Jitsi si vous voulez imposer une salle précise.</span>
                  </div>

                  <div className="admin-session-form__grid admin-session-form__grid--single">
                    <label className="admin-field admin-session-form__field admin-session-form__field--full">
                      <span>Lien Jitsi (généré automatiquement si vide)</span>
                      <input
                        type="url"
                        placeholder="https://meet.jit.si/..."
                        value={sessionEditorDraft.meetingLink}
                        onChange={(event) =>
                          sessionEditorState.mode === "create"
                            ? syncCreateSessionDraft("meetingLink", event.target.value)
                            : syncSessionDraft(activeSession!.id, "meetingLink", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
              </div>

              {sessionEditorFeedback ? (
                <p className={`admin-feedback admin-feedback--${sessionEditorFeedback.type}`}>
                  {sessionEditorFeedback.message}
                </p>
              ) : null}
            </section>
          </div>

          <div className="admin-modal__footer">
            <button className="admin-secondary-button" type="button" onClick={closeSessionEditor}>
              Annuler
            </button>
            <button
              className="admin-action-button"
              type="button"
              disabled={
                sessionEditorState.mode === "create"
                  ? isCreatingSession
                  : savingSessionId === activeSession?.id
              }
              onClick={() => {
                void (async () => {
                  const ok =
                    sessionEditorState.mode === "create"
                      ? await handleCreateSession()
                      : activeSession
                        ? await handleSaveSession(activeSession)
                        : false;
                  if (ok) {
                    closeSessionEditor();
                  }
                })();
              }}
            >
              <FaSave />
              {sessionEditorState.mode === "create"
                ? isCreatingSession
                  ? "Creation..."
                  : "Creer la session"
                : savingSessionId === activeSession?.id
                  ? "Sauvegarde..."
                  : "Enregistrer"}
            </button>
          </div>
        </AdminModal>
      ) : null}
    </>
  );

  /*
  return (
    <div className="admin-dashboard-page">
      <section className="section-heading section-heading--spaced" id="admin-overview">
        <p className="eyebrow">Dashboard admin</p>
        <h1>Pilotage du catalogue, des inscriptions et des flux e-commerce</h1>
        <p className="page-intro">
          Le catalogue gere maintenant les trois vraies modalites du projet:
          live, ligne et presentiel. Les dashboards sont derives du format, et
          le badge promo est applique automatiquement a partir du prix barre.
        </p>
      </section>

      {loading ? (
        <div className="admin-state-card">
          <FaSyncAlt className="admin-spin" />
          <p>Chargement du dashboard admin...</p>
        </div>
      ) : null}

      {loadingError ? (
        <div className="admin-state-card admin-state-card--error">
          <p>{loadingError}</p>
        </div>
      ) : null}

      {!loading && !loadingError && overview ? (
        <>
          <div className="admin-summary-grid">
            <article className="admin-summary-card">
              <span>Formations publiees</span>
              <strong>{overview.formations_count}</strong>
            </article>
            <article className="admin-summary-card">
              <span>Live</span>
              <strong>{overview.live_formations_count}</strong>
            </article>
            <article className="admin-summary-card">
              <span>Ligne</span>
              <strong>{overview.ligne_formations_count}</strong>
            </article>
            <article className="admin-summary-card">
              <span>Presentiel</span>
              <strong>{overview.presentiel_formations_count}</strong>
            </article>
            <article className="admin-summary-card">
              <span>Sessions live / presentiel</span>
              <strong>{overview.presentiel_sessions_count}</strong>
            </article>
            <article className="admin-summary-card">
              <span>Utilisateurs</span>
              <strong>{overview.users_count}</strong>
            </article>
            <article className="admin-summary-card">
              <span>CA confirme</span>
              <strong>{overview.total_confirmed_revenue_label}</strong>
            </article>
            <article className="admin-summary-card">
              <span>Commandes payees</span>
              <strong>{overview.paid_orders_count}</strong>
            </article>
          </div>

          <div className="admin-note">
            <FaCheckCircle />
            <p>
              `premium` et `populaire` restent marketing et modifiables par
              l'admin. `promo` est maintenant derive du couple prix actuel /
              prix barre. `live` et `presentiel` pointent vers un dashboard
              guide, `ligne` vers un dashboard classique. Une formation peut
              porter plusieurs sessions, chacune avec sa propre periode.
            </p>
          </div>

          <section className="admin-section" id="admin-catalogue">
            <div className="admin-section__heading">
              <div>
                <h2>Catalogue e-commerce</h2>
                <p>
                  Cree ici une nouvelle formation, puis ajuste ses donnees
                  marketing et son format metier.
                </p>
              </div>

              <div className="admin-section__controls">
                <div
                  className="admin-filter-toggle"
                  aria-label="Filtrer les formations du catalogue"
                >
                  <button
                    className={catalogDisplayFilter === "all" ? "is-active" : ""}
                    type="button"
                    onClick={() => {
                      setCatalogDisplayFilter("all");
                    }}
                  >
                    Toutes
                    <strong>{formations.length}</strong>
                  </button>
                  <button
                    className={catalogDisplayFilter === "featured" ? "is-active" : ""}
                    type="button"
                    onClick={() => {
                      setCatalogDisplayFilter("featured");
                    }}
                  >
                    Vedettes accueil
                    <strong>{featuredFormationsCount}</strong>
                  </button>
                </div>
              </div>
            </div>

            <article className="admin-create-card">
              <div className="admin-create-card__heading">
                <div>
                  <p className="admin-formation-card__category">Nouvelle formation</p>
                  <h3>Ajouter une offre live, ligne ou presentiel</h3>
                </div>
                <button
                  className="admin-save-button"
                  type="button"
                  disabled={isCreating}
                  onClick={() => {
                    void handleCreate();
                  }}
                >
                  <FaPlus />
                  {isCreating ? "Creation..." : "Creer la formation"}
                </button>
              </div>

              <div className="admin-formation-form">
                <label className="admin-field admin-field--span-2">
                  <span>Titre</span>
                  <input
                    type="text"
                    value={createDraft.title}
                    onChange={(event) => syncCreateDraft("title", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Categorie</span>
                  <select
                    value={resolveOptionValue(createDraft.category, categoryOptions)}
                    onChange={(event) => syncCreateDraft("category", event.target.value)}
                  >
                    <option value="">— Choisir une catégorie —</option>
                    {!hasEquivalentOption(categoryOptions, createDraft.category) && createDraft.category ? (
                      <option value={createDraft.category}>{createDraft.category}</option>
                    ) : null}
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Niveau</span>
                  <select
                    value={createDraft.level}
                    onChange={(event) => syncCreateDraft("level", event.target.value)}
                  >
                    <option value="">— Choisir un niveau —</option>
                    {!levelOptions.includes(createDraft.level) && createDraft.level ? (
                      <option value={createDraft.level}>{createDraft.level}</option>
                    ) : null}
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Format</span>
                  <select
                    value={createDraft.formatType}
                    onChange={(event) =>
                      syncCreateDraft("formatType", event.target.value as FormationFormat)
                    }
                  >
                    <option value="live">Live</option>
                    <option value="ligne">Ligne</option>
                    <option value="presentiel">Presentiel</option>
                  </select>
                </label>

                <label className="admin-field">
                  <span>Dashboard derive</span>
                  <input
                    type="text"
                    value={dashboardTypeLabel(createDraft.formatType)}
                    disabled
                  />
                </label>

                <label className="admin-field admin-field--span-2">
                  <span>Image / cover</span>
                  <input
                    type="text"
                    value={createDraft.image}
                    onChange={(event) => syncCreateDraft("image", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Produit vedette accueil</span>
                  <select
                    value={createDraft.isFeaturedHome ? "oui" : "non"}
                    onChange={(event) =>
                      syncCreateDraft("isFeaturedHome", event.target.value === "oui")
                    }
                  >
                    <option value="non">Non</option>
                    <option value="oui">Oui</option>
                  </select>
                </label>

                <label className="admin-field">
                  <span>Ordre accueil</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={createDraft.homeFeatureRank}
                    onChange={(event) => syncCreateDraft("homeFeatureRank", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Prix actuel (FCFA)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={createDraft.currentPrice}
                    onChange={(event) => syncCreateDraft("currentPrice", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Prix barre (FCFA)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={createDraft.originalPrice}
                    onChange={(event) => syncCreateDraft("originalPrice", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Note admin</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={createDraft.rating}
                    onChange={(event) => syncCreateDraft("rating", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Nombre d'avis</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={createDraft.reviews}
                    onChange={(event) => syncCreateDraft("reviews", event.target.value)}
                  />
                </label>
              </div>

              <div className="admin-badge-config">
                <div className="admin-badge-list">
                  {marketingBadges.map((badge) => (
                    <button
                      className={
                        createDraft.badges.includes(badge)
                          ? `admin-badge admin-badge--${badge} is-selected`
                          : `admin-badge admin-badge--${badge}`
                      }
                      key={badge}
                      type="button"
                      onClick={() =>
                        toggleBadge(createDraft.badges, badge, (nextBadges) =>
                          syncCreateDraft("badges", nextBadges),
                        )
                      }
                    >
                      {badgeIcon(badge)}
                      {badgeLabel(badge)}
                    </button>
                  ))}
                </div>
                <p className="admin-hint">
                  Le badge promo est automatique des qu'un prix barre est
                  superieur au prix actuel.
                </p>
              </div>

              <FormationDetailFields
                draft={createDraft}
                trainers={trainers}
                onChange={(field, value) => syncCreateDraft(field, value)}
              />

              {createFeedback ? (
                <p className={`admin-feedback admin-feedback--${createFeedback.type}`}>
                  {createFeedback.message}
                </p>
              ) : null}
            </article>

            <div className="admin-formation-list">
              {visibleFormations.length > 0 ? (
                visibleFormations.map((formation) => {
                const draft = drafts[formation.slug];
                const feedback = feedbackBySlug[formation.slug];
                const isSaving = savingSlug === formation.slug;

                return (
                  <article className="admin-formation-card" key={formation.slug}>
                    <div className="admin-formation-card__media">
                      <img src={formation.image} alt={formation.title} />
                    </div>

                    <div className="admin-formation-card__body">
                      <div className="admin-formation-card__header">
                        <div>
                          <p className="admin-formation-card__category">
                            {formation.category}
                          </p>
                          <h2>{formation.title}</h2>
                          <p className="admin-formation-card__meta">
                            {formation.level} · {formatTypeLabel(formation.format_type)} ·{" "}
                            {formation.session_label ?? "Pas de session planifiee"}
                          </p>
                        </div>

                        <div className="admin-badge-list">
                          {formation.badges.map((badge) => (
                            <span
                              className={`admin-badge admin-badge--${badge} is-selected`}
                              key={`${formation.slug}-${badge}`}
                            >
                              {badgeIcon(badge)}
                              {badgeLabel(badge)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="admin-formation-card__stats admin-formation-card__stats--wide">
                        <div>
                          <span>Format</span>
                          <strong>{formatTypeLabel(formation.format_type)}</strong>
                        </div>
                        <div>
                          <span>Dashboard</span>
                          <strong>{dashboardTypeLabel(formation.format_type)}</strong>
                        </div>
                        <div>
                          <span>Etat session</span>
                          <strong>{statusLabel(formation.session_state)}</strong>
                        </div>
                        <div>
                          <span>Achat</span>
                          <strong>{formation.can_purchase ? "Ouvert" : "Ferme"}</strong>
                        </div>
                        <div>
                          <span>Tranches</span>
                          <strong>{formation.allow_installments ? "Actives" : "Non"}</strong>
                        </div>
                        <div>
                          <span>Note actuelle</span>
                          <strong>{formation.rating.toFixed(1)} / 5</strong>
                        </div>
                        <div>
                          <span>Avis affiches</span>
                          <strong>{formation.reviews.toLocaleString("fr-FR")}</strong>
                        </div>
                        <div>
                          <span>Prix actuel</span>
                          <strong>{formation.current_price_label}</strong>
                        </div>
                        <div>
                          <span>Accueil</span>
                          <strong>
                            {formation.is_featured_home ? "Vedette" : "Catalogue seul"}
                          </strong>
                        </div>
                      </div>

                      <div className="admin-formation-form">
                        <label className="admin-field admin-field--span-2">
                          <span>Titre</span>
                          <input
                            type="text"
                            value={draft?.title ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "title", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Categorie</span>
                          <select
                            value={resolveOptionValue(draft?.category ?? "", categoryOptions)}
                            onChange={(event) =>
                              syncDraft(formation.slug, "category", event.target.value)
                            }
                          >
                            <option value="">— Choisir une catégorie —</option>
                            {draft?.category && !hasEquivalentOption(categoryOptions, draft.category) ? (
                              <option value={draft.category}>{draft.category}</option>
                            ) : null}
                            {categoryOptions.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="admin-field">
                          <span>Niveau</span>
                          <select
                            value={draft?.level ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "level", event.target.value)
                            }
                          >
                            <option value="">— Choisir un niveau —</option>
                            {draft?.level && !levelOptions.includes(draft.level) ? (
                              <option value={draft.level}>{draft.level}</option>
                            ) : null}
                            {levelOptions.map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="admin-field">
                          <span>Format</span>
                          <select
                            value={draft?.formatType ?? "live"}
                            onChange={(event) =>
                              syncDraft(
                                formation.slug,
                                "formatType",
                                event.target.value as FormationFormat,
                              )
                            }
                          >
                            <option value="live">Live</option>
                            <option value="ligne">Ligne</option>
                            <option value="presentiel">Presentiel</option>
                          </select>
                        </label>

                        <label className="admin-field">
                          <span>Dashboard derive</span>
                          <input
                            type="text"
                            value={dashboardTypeLabel(draft?.formatType ?? "live")}
                            disabled
                          />
                        </label>

                        <label className="admin-field admin-field--span-2">
                          <span>Image / cover</span>
                          <input
                            type="text"
                            value={draft?.image ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "image", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Produit vedette accueil</span>
                          <select
                            value={(draft?.isFeaturedHome ?? false) ? "oui" : "non"}
                            onChange={(event) =>
                              syncDraft(
                                formation.slug,
                                "isFeaturedHome",
                                event.target.value === "oui",
                              )
                            }
                          >
                            <option value="non">Non</option>
                            <option value="oui">Oui</option>
                          </select>
                        </label>

                        <label className="admin-field">
                          <span>Ordre accueil</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft?.homeFeatureRank ?? "100"}
                            onChange={(event) =>
                              syncDraft(formation.slug, "homeFeatureRank", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Prix actuel (FCFA)</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft?.currentPrice ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "currentPrice", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Prix barre (FCFA)</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft?.originalPrice ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "originalPrice", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Note admin</span>
                          <input
                            type="number"
                            min="0"
                            max="5"
                            step="0.5"
                            value={draft?.rating ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "rating", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Nombre d'avis</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft?.reviews ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "reviews", event.target.value)
                            }
                          />
                        </label>
                      </div>

                      <div className="admin-badge-config">
                        <div className="admin-badge-list">
                          {marketingBadges.map((badge) => (
                            <button
                              className={
                                draft?.badges.includes(badge)
                                  ? `admin-badge admin-badge--${badge} is-selected`
                                  : `admin-badge admin-badge--${badge}`
                              }
                              key={badge}
                              type="button"
                              onClick={() =>
                                toggleBadge(draft?.badges ?? [], badge, (nextBadges) =>
                                  syncDraft(formation.slug, "badges", nextBadges),
                                )
                              }
                            >
                              {badgeIcon(badge)}
                              {badgeLabel(badge)}
                            </button>
                          ))}
                        </div>
                        <p className="admin-hint">
                          Promo n'est plus un toggle: il se derive automatiquement
                          du prix barre.
                        </p>
                      </div>

                      {draft ? (
                        <FormationDetailFields
                          draft={draft}
                          trainers={trainers}
                          onChange={(field, value) =>
                            syncDraft(formation.slug, field, value)
                          }
                        />
                      ) : null}

                      <button
                        className="admin-save-button"
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          void handleSave(formation);
                        }}
                      >
                        <FaSave />
                        {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                      </button>

                      {feedback ? (
                        <p className={`admin-feedback admin-feedback--${feedback.type}`}>
                          {feedback.message}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
                })
              ) : (
                <article className="admin-empty-state">
                  <p className="admin-formation-card__category">Vitrine accueil</p>
                  <h3>Aucune formation n'est encore marquee comme vedette.</h3>
                  <p>
                    Active `Produit vedette accueil` sur une ou plusieurs
                    formations pour les faire remonter plus vite dans la vitrine
                    du site.
                  </p>
                </article>
              )}
            </div>
          </section>

          <section className="admin-section" id="admin-sessions">
            <div className="admin-section__heading">
              <h2>Sessions live et presentiel</h2>
              <p>
                Creez et gerez les prochaines sessions. Tant qu'une session n'est
                pas terminee pour une formation, aucune nouvelle session ne peut
                etre ouverte pour cette meme offre.
              </p>
            </div>

            <article className="admin-create-card">
              <div className="admin-create-card__heading">
                <div>
                  <p className="admin-formation-card__category">Nouvelle session</p>
                  <h3>Programmer une session pour une offre live ou presentiel</h3>
                </div>
                <button
                  className="admin-save-button"
                  type="button"
                  disabled={isCreatingSession}
                  onClick={() => {
                    void handleCreateSession();
                  }}
                >
                  <FaPlus />
                  {isCreatingSession ? "Creation..." : "Creer la session"}
                </button>
              </div>

              <div className="admin-formation-form">
                <label className="admin-field admin-field--span-2">
                  <span>Formation</span>
                  <select
                    value={createSessionDraft.formationId}
                    onChange={(event) =>
                      syncCreateSessionDraft("formationId", event.target.value)
                    }
                  >
                    <option value="">Selectionnez une formation</option>
                    {availableSessionCreateFormations.map((formation) => (
                      <option key={formation.id} value={formation.id}>
                        {formation.title} ({formatTypeLabel(formation.format_type)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field admin-field--span-2">
                  <span>Libelle</span>
                  <input
                    type="text"
                    value={createSessionDraft.label}
                    onChange={(event) => syncCreateSessionDraft("label", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Date de debut</span>
                  <input
                    type="date"
                    value={createSessionDraft.startDate}
                    onChange={(event) =>
                      syncCreateSessionDraft("startDate", event.target.value)
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Date de fin</span>
                  <input
                    type="date"
                    value={createSessionDraft.endDate}
                    onChange={(event) =>
                      syncCreateSessionDraft("endDate", event.target.value)
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Campus / lieu</span>
                  <input
                    type="text"
                    value={createSessionDraft.campusLabel}
                    onChange={(event) =>
                      syncCreateSessionDraft("campusLabel", event.target.value)
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Capacite</span>
                  <input
                    type="number"
                    min="0"
                    value={createSessionDraft.seatCapacity}
                    onChange={(event) =>
                      syncCreateSessionDraft("seatCapacity", event.target.value)
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Formateur</span>
                  <select
                    value={createSessionDraft.teacherName}
                    onChange={(event) =>
                      syncCreateSessionDraft("teacherName", event.target.value)
                    }
                  >
                    <option value="">Non assigné</option>
                    {createSessionDraft.teacherName &&
                      !teacherUsers.some((teacher) => teacher.full_name === createSessionDraft.teacherName) && (
                        <option value={createSessionDraft.teacherName}>{createSessionDraft.teacherName}</option>
                      )}
                    {teacherUsers.map((teacher) => (
                      <option key={teacher.id} value={teacher.full_name}>
                        {teacher.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Statut</span>
                  <select
                    value={createSessionDraft.status}
                    onChange={(event) =>
                      syncCreateSessionDraft(
                        "status",
                        event.target.value as SessionStatus,
                      )
                    }
                  >
                    {sessionStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field fe-span-full">
                  <span>Lien Jitsi (généré automatiquement si vide)</span>
                  <input
                    type="url"
                    placeholder="https://meet.jit.si/..."
                    value={createSessionDraft.meetingLink}
                    onChange={(event) =>
                      syncCreateSessionDraft("meetingLink", event.target.value)
                    }
                  />
                </label>
              </div>

              {createSessionFeedback ? (
                <p className={`admin-feedback admin-feedback--${createSessionFeedback.type}`}>
                  {createSessionFeedback.message}
                </p>
              ) : null}
              {availableSessionCreateFormations.length === 0 ? (
                <p className="admin-hint">
                  Aucune formation live ou présentiel n'est disponible pour créer une session.
                </p>
              ) : null}
            </article>

            <div className="admin-grid-two">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <article className="admin-info-card" key={session.id}>
                    <div className="admin-info-card__header">
                      <div>
                        <h3>{session.label}</h3>
                        <p>{session.formation_title}</p>
                      </div>
                      <span className={statusClassName(session.status)}>
                        {statusLabel(session.status)}
                      </span>
                    </div>
                    <div className="admin-formation-card__stats">
                      <div>
                        <span>Format</span>
                        <strong>{formatTypeLabel(session.format_type)}</strong>
                      </div>
                      <div>
                        <span>Etat public</span>
                        <strong>{statusLabel(session.session_state)}</strong>
                      </div>
                      <div>
                        <span>Achat</span>
                        <strong>{session.can_purchase ? "Ouvert" : "Ferme"}</strong>
                      </div>
                    </div>
                    <div className="admin-inline-form admin-inline-form--session">
                      <label className="admin-field">
                        <span>Libelle</span>
                        <input
                          type="text"
                          value={sessionDrafts[session.id]?.label ?? session.label}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "label", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Date de debut</span>
                        <input
                          type="date"
                          value={sessionDrafts[session.id]?.startDate ?? session.start_date}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "startDate", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Date de fin</span>
                        <input
                          type="date"
                          value={sessionDrafts[session.id]?.endDate ?? session.end_date}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "endDate", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Campus</span>
                        <input
                          type="text"
                          value={sessionDrafts[session.id]?.campusLabel ?? session.campus_label}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "campusLabel", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Places</span>
                        <input
                          type="number"
                          min="0"
                          value={sessionDrafts[session.id]?.seatCapacity ?? session.seat_capacity}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "seatCapacity", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Formateur</span>
                        <select
                          value={sessionDrafts[session.id]?.teacherName ?? session.teacher_name}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "teacherName", event.target.value)
                          }
                        >
                          <option value="">Non assigné</option>
                          {(sessionDrafts[session.id]?.teacherName ?? session.teacher_name) &&
                            !teacherUsers.some(
                              (teacher) =>
                                teacher.full_name ===
                                (sessionDrafts[session.id]?.teacherName ?? session.teacher_name),
                            ) && (
                              <option value={sessionDrafts[session.id]?.teacherName ?? session.teacher_name}>
                                {sessionDrafts[session.id]?.teacherName ?? session.teacher_name}
                              </option>
                            )}
                          {teacherUsers.map((teacher) => (
                            <option key={teacher.id} value={teacher.full_name}>
                              {teacher.full_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-field">
                        <span>Statut</span>
                        <select
                          value={sessionDrafts[session.id]?.status ?? session.status}
                          onChange={(event) =>
                            syncSessionDraft(
                              session.id,
                              "status",
                              event.target.value as SessionStatus,
                            )
                          }
                        >
                          {sessionStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <ul className="admin-mini-list">
                      <li>
                        <FaUsers />
                        {session.enrolled_count}/{session.seat_capacity} inscrits
                      </li>
                      <li>
                        <FaMapMarkerAlt />
                        {session.campus_label || "A preciser"}
                      </li>
                      <li>
                        <FaCalendarAlt />
                        {session.start_date} {"->"} {session.end_date}
                      </li>
                      <li>
                        <FaClock />
                        {session.session_label ?? "Pas de message public"}
                      </li>
                    </ul>
                    <button
                      className="admin-save-button admin-save-button--inline"
                      type="button"
                      disabled={savingSessionId === session.id}
                      onClick={() => {
                        void handleSaveSession(session);
                      }}
                    >
                      <FaSave />
                      {savingSessionId === session.id ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                    {sessionFeedbackById[session.id] ? (
                      <p
                        className={`admin-feedback admin-feedback--${sessionFeedbackById[session.id].type}`}
                      >
                        {sessionFeedbackById[session.id].message}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <article className="admin-empty-state">
                  <p className="admin-formation-card__category">Aucune session</p>
                  <h3>Aucune session live ou presentiel n'est encore planifiee.</h3>
                  <p>
                    Creez une session pour ouvrir les inscriptions et afficher la
                    prochaine date sur les cartes publiques.
                  </p>
                </article>
              )}
            </div>
          </section>

          <section className="admin-section" id="admin-users">
            <div className="admin-section__heading">
              <h2>Utilisateurs</h2>
              <p>Edition rapide des roles et statuts de compte.</p>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className="admin-table__select"
                          value={userDrafts[user.id]?.role ?? user.role}
                          onChange={(event) =>
                            syncUserDraft(user.id, "role", event.target.value as UserRole)
                          }
                        >
                          {userRoles.map((role) => (
                            <option key={role} value={role}>
                              {statusLabel(role)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="admin-table__select"
                          value={userDrafts[user.id]?.status ?? user.status}
                          onChange={(event) =>
                            syncUserDraft(user.id, "status", event.target.value as UserStatus)
                          }
                        >
                          {userStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="admin-save-button admin-save-button--table"
                          type="button"
                          disabled={savingUserId === user.id}
                          onClick={() => {
                            void handleSaveUser(user);
                          }}
                        >
                          {savingUserId === user.id ? "..." : "Sauver"}
                        </button>
                        {userFeedbackById[user.id] ? (
                          <p className={`admin-feedback admin-feedback--${userFeedbackById[user.id].type}`}>
                            {userFeedbackById[user.id].message}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section" id="admin-orders">
            <div className="admin-section__heading">
              <h2>Commandes</h2>
              <p>Suivi du tunnel d'achat et correction manuelle des statuts.</p>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Client</th>
                    <th>Formation</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.reference}</td>
                      <td>{order.customer_name}</td>
                      <td>{order.formation_title}</td>
                      <td>{order.total_amount_label}</td>
                      <td>
                        <select
                          className="admin-table__select"
                          value={orderDrafts[order.id]?.status ?? order.status}
                          onChange={(event) =>
                            syncOrderDraft(order.id, event.target.value as OrderStatus)
                          }
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="admin-save-button admin-save-button--table"
                          type="button"
                          disabled={savingOrderId === order.id}
                          onClick={() => {
                            void handleSaveOrder(order);
                          }}
                        >
                          {savingOrderId === order.id ? "..." : "Sauver"}
                        </button>
                        {orderFeedbackById[order.id] ? (
                          <p className={`admin-feedback admin-feedback--${orderFeedbackById[order.id].type}`}>
                            {orderFeedbackById[order.id].message}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section" id="admin-payments">
            <div className="admin-section__heading">
              <h2>Paiements</h2>
              <p>Controle des flux confirms, en attente ou a relancer.</p>
            </div>
            <div className="admin-grid-two">
              {payments.map((payment) => (
                <article className="admin-info-card" key={payment.id}>
                  <div className="admin-info-card__header">
                    <h3>{payment.order_reference}</h3>
                    <span className={statusClassName(payment.status)}>
                      {statusLabel(payment.status)}
                    </span>
                  </div>
                  <p>{payment.payer_name}</p>
                  <div className="admin-inline-form admin-inline-form--payment">
                    <label className="admin-field">
                      <span>Prestataire</span>
                      <input
                        type="text"
                        value={paymentDrafts[payment.id]?.providerCode ?? payment.provider_code}
                        onChange={(event) =>
                          syncPaymentDraft(payment.id, "providerCode", event.target.value)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Statut</span>
                      <select
                        value={paymentDrafts[payment.id]?.status ?? payment.status}
                        onChange={(event) =>
                          syncPaymentDraft(
                            payment.id,
                            "status",
                            event.target.value as PaymentStatus,
                          )
                        }
                      >
                        {paymentStatuses.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ul className="admin-mini-list">
                    <li>
                      <FaMoneyBillWave />
                      {payment.amount_label}
                    </li>
                    <li>
                      <FaTag />
                      Prestataire: {payment.provider_code}
                    </li>
                    <li>
                      <FaClock />
                      {payment.paid_at ? `Regle le ${payment.paid_at}` : "Paiement pas encore confirme"}
                    </li>
                  </ul>
                  <button
                    className="admin-save-button admin-save-button--inline"
                    type="button"
                    disabled={savingPaymentId === payment.id}
                    onClick={() => {
                      void handleSavePayment(payment);
                    }}
                  >
                    <FaSave />
                    {savingPaymentId === payment.id ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  {paymentFeedbackById[payment.id] ? (
                    <p className={`admin-feedback admin-feedback--${paymentFeedbackById[payment.id].type}`}>
                      {paymentFeedbackById[payment.id].message}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
  */
}
