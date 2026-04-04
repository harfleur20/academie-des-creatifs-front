import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaCrown,
  FaFire,
  FaLaptop,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaPlus,
  FaSave,
  FaSyncAlt,
  FaTag,
  FaUsers,
  FaVideo,
} from "react-icons/fa";

import {
  type AdminFormation,
  createAdminOnsiteSession,
  createAdminFormation,
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
  type AdminFormationSessionCreatePayload,
  type AdminFormationCreatePayload,
  type AdminOnsiteSession,
  type AdminOnsiteSessionUpdatePayload,
  type AdminOrder,
  type AdminOrderUpdatePayload,
  type AdminOverview,
  type AdminPayment,
  type AdminPaymentUpdatePayload,
  type AdminUser,
  type AdminUserUpdatePayload,
  type FormationFaq,
  type FormationFormat,
  type FormationModule,
  type FormationProject,
  type MarketingBadge,
  type OrderStatus,
  type PaymentStatus,
  type SessionStatus,
  type UserRole,
  type UserStatus,
} from "../lib/catalogApi";

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
  isFeaturedHome: boolean;
  homeFeatureRank: string;
  badges: MarketingBadge[];
  intro: string;
  mentorName: string;
  mentorLabel: string;
  mentorImage: string;
  includedText: string;
  objectivesText: string;
  projectsText: string;
  audienceText: string;
  certificateCopy: string;
  certificateImage: string;
  modulesText: string;
  faqsText: string;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

type UserDraft = {
  role: UserRole;
  status: UserStatus;
};

type SessionDraft = {
  label: string;
  startDate: string;
  endDate: string;
  campusLabel: string;
  seatCapacity: string;
  teacherName: string;
  status: SessionStatus;
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
};

type OrderDraft = {
  status: OrderStatus;
};

type PaymentDraft = {
  providerCode: string;
  status: PaymentStatus;
};

type CatalogDisplayFilter = "all" | "featured";

const marketingBadges: MarketingBadge[] = ["premium", "populaire"];
const userRoles: UserRole[] = ["student", "teacher", "admin"];
const userStatuses: UserStatus[] = ["active", "suspended"];
const sessionStatuses: SessionStatus[] = ["planned", "open", "completed", "cancelled"];
const orderStatuses: OrderStatus[] = ["pending", "paid", "partially_paid", "failed", "cancelled"];
const paymentStatuses: PaymentStatus[] = ["pending", "confirmed", "failed"];

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);
}

function joinTextLines(items: string[]) {
  return items.join("\n");
}

function serializeProjects(projects: FormationProject[]) {
  return projects
    .map((project) =>
      [
        project.title,
        project.image,
        project.kind === "video" ? "video" : "image",
        project.poster ?? "",
      ]
        .filter((part, index) => index < 2 || part)
        .join(" || "),
    )
    .join("\n");
}

function serializeModules(modules: FormationModule[]) {
  return modules
    .map((module) => [module.title, ...(module.lessons ?? [])].join("\n"))
    .join("\n\n");
}

function serializeFaqs(faqs: FormationFaq[]) {
  return faqs
    .map((faq) => [faq.question, faq.answer].join("\n"))
    .join("\n\n");
}

function parseLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseProjects(value: string): FormationProject[] {
  const lines = parseLineList(value);
  return lines.map((line) => {
    const [title = "", image = "", kindRaw = "", poster = ""] = line
      .split("||")
      .map((part) => part.trim());

    if (!title || !image) {
      throw new Error(
        "Chaque projet doit suivre le format : titre || media || type optionnel || poster optionnel.",
      );
    }

    return {
      title,
      image,
      kind: kindRaw === "video" ? "video" : "image",
      poster: poster || undefined,
    };
  });
}

function parseModules(value: string): FormationModule[] {
  const blocks = value
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const [title = "", ...lessons] = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!title) {
      throw new Error("Chaque module doit avoir un titre.");
    }

    return {
      title,
      lessons,
      summary: "",
      duration: "",
    };
  });
}

function parseFaqs(value: string): FormationFaq[] {
  const blocks = value
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const [question = "", ...answerLines] = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const answer = answerLines.join(" ");

    if (!question || !answer) {
      throw new Error("Chaque FAQ doit contenir une question puis une reponse.");
    }

    return { question, answer };
  });
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
    isFeaturedHome: formation.is_featured_home,
    homeFeatureRank: formation.home_feature_rank.toString(),
    badges: formation.badges.filter(
      (badge): badge is MarketingBadge => badge === "premium" || badge === "populaire",
    ),
    intro: formation.intro,
    mentorName: formation.mentor_name,
    mentorLabel: formation.mentor_label,
    mentorImage: formation.mentor_image,
    includedText: joinTextLines(formation.included),
    objectivesText: joinTextLines(formation.objectives),
    projectsText: serializeProjects(formation.projects),
    audienceText: formation.audience_text,
    certificateCopy: formation.certificate_copy,
    certificateImage: formation.certificate_image,
    modulesText: serializeModules(formation.modules),
    faqsText: serializeFaqs(formation.faqs),
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
    isFeaturedHome: false,
    homeFeatureRank: "100",
    badges: [],
    intro: "",
    mentorName: "",
    mentorLabel: "",
    mentorImage: "",
    includedText: "",
    objectivesText: "",
    projectsText: "",
    audienceText: "",
    certificateCopy: "",
    certificateImage: "",
    modulesText: "",
    faqsText: "",
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
  };
}

function buildPayloadFromDraft(
  draft: DraftValues,
): { payload: Omit<AdminFormationCreatePayload, "slug">; currentPrice: number } {
  const rating = Number.parseFloat(draft.rating);
  const reviews = Number.parseInt(draft.reviews, 10);
  const currentPrice = Number.parseInt(draft.currentPrice, 10);
  const originalPrice = draft.originalPrice.trim()
    ? Number.parseInt(draft.originalPrice, 10)
    : null;
  const homeFeatureRank = Number.parseInt(draft.homeFeatureRank, 10);

  if (!draft.title.trim()) {
    throw new Error("Le titre ne peut pas etre vide.");
  }

  if (!draft.category.trim()) {
    throw new Error("La categorie ne peut pas etre vide.");
  }

  if (!draft.level.trim()) {
    throw new Error("Le niveau ne peut pas etre vide.");
  }

  if (!draft.image.trim()) {
    throw new Error("L'image ne peut pas etre vide.");
  }

  if (!Number.isFinite(rating) || !isValidRating(rating)) {
    throw new Error("La note doit etre comprise entre 0 et 5, par pas de 0.5.");
  }

  if (!Number.isInteger(reviews) || reviews < 0) {
    throw new Error("Le nombre d'avis doit etre un entier positif ou nul.");
  }

  if (!Number.isInteger(currentPrice) || currentPrice < 0) {
    throw new Error("Le prix actuel doit etre un entier positif.");
  }

  if (originalPrice !== null && (!Number.isInteger(originalPrice) || originalPrice < currentPrice)) {
    throw new Error("Le prix barre doit etre vide ou superieur ou egal au prix actuel.");
  }

  if (!Number.isInteger(homeFeatureRank) || homeFeatureRank < 0) {
    throw new Error("L'ordre d'affichage accueil doit etre un entier positif ou nul.");
  }

  return {
    currentPrice,
    payload: {
      title: draft.title.trim(),
      category: draft.category.trim(),
      level: draft.level.trim(),
      image: draft.image.trim(),
      format_type: draft.formatType,
      rating,
      reviews,
      current_price_amount: currentPrice,
      original_price_amount: originalPrice,
      is_featured_home: draft.isFeaturedHome,
      home_feature_rank: homeFeatureRank,
      badges: draft.badges,
      intro: draft.intro.trim(),
      mentor_name: draft.mentorName.trim(),
      mentor_label: draft.mentorLabel.trim(),
      mentor_image: draft.mentorImage.trim(),
      included: parseLineList(draft.includedText),
      objectives: parseLineList(draft.objectivesText),
      projects: parseProjects(draft.projectsText),
      audience_text: draft.audienceText.trim(),
      certificate_copy: draft.certificateCopy.trim(),
      certificate_image: draft.certificateImage.trim(),
      modules: parseModules(draft.modulesText),
      faqs: parseFaqs(draft.faqsText),
    },
  };
}

function buildUserDraft(user: AdminUser): UserDraft {
  return {
    role: user.role,
    status: user.status,
  };
}

function buildSessionDraft(session: AdminOnsiteSession): SessionDraft {
  return {
    label: session.label,
    startDate: session.start_date,
    endDate: session.end_date,
    campusLabel: session.campus_label,
    seatCapacity: session.seat_capacity.toString(),
    teacherName: session.teacher_name,
    status: session.status,
  };
}

function buildOrderDraft(order: AdminOrder): OrderDraft {
  return {
    status: order.status,
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
  onChange,
}: {
  draft: DraftValues;
  onChange: (field: keyof DraftValues, value: string) => void;
}) {
  return (
    <div className="admin-detail-editor">
      <div className="admin-detail-editor__heading">
        <h4>Fiche detail</h4>
        <p>
          Ces contenus alimentent directement la page description. Une ligne =
          un point. Un bloc vide entre deux elements separe une FAQ ou un
          module.
        </p>
      </div>

      <div className="admin-formation-form admin-formation-form--details">
        <label className="admin-field admin-field--span-4">
          <span>Introduction</span>
          <textarea
            value={draft.intro}
            onChange={(event) => onChange("intro", event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Mentor</span>
          <input
            type="text"
            value={draft.mentorName}
            onChange={(event) => onChange("mentorName", event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Poste mentor</span>
          <input
            type="text"
            value={draft.mentorLabel}
            onChange={(event) => onChange("mentorLabel", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>Image mentor</span>
          <input
            type="text"
            value={draft.mentorImage}
            onChange={(event) => onChange("mentorImage", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>Inclus dans la formation</span>
          <textarea
            value={draft.includedText}
            onChange={(event) => onChange("includedText", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>Objectifs</span>
          <textarea
            value={draft.objectivesText}
            onChange={(event) => onChange("objectivesText", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-4">
          <span>Projets (titre || media || type optionnel || poster optionnel)</span>
          <textarea
            value={draft.projectsText}
            onChange={(event) => onChange("projectsText", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-4">
          <span>Public vise</span>
          <textarea
            value={draft.audienceText}
            onChange={(event) => onChange("audienceText", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>Texte certificat</span>
          <textarea
            value={draft.certificateCopy}
            onChange={(event) => onChange("certificateCopy", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>Image certificat</span>
          <input
            type="text"
            value={draft.certificateImage}
            onChange={(event) => onChange("certificateImage", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>Modules (1 bloc = 1 module, 1re ligne = titre, lignes suivantes = lecons)</span>
          <textarea
            value={draft.modulesText}
            onChange={(event) => onChange("modulesText", event.target.value)}
          />
        </label>

        <label className="admin-field admin-field--span-2">
          <span>FAQ (1 bloc = question puis reponse)</span>
          <textarea
            value={draft.faqsText}
            onChange={(event) => onChange("faqsText", event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [formations, setFormations] = useState<AdminFormation[]>([]);
  const [sessions, setSessions] = useState<AdminOnsiteSession[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [userDrafts, setUserDrafts] = useState<Record<number, UserDraft>>({});
  const [sessionDrafts, setSessionDrafts] = useState<Record<number, SessionDraft>>({});
  const [orderDrafts, setOrderDrafts] = useState<Record<number, OrderDraft>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, PaymentDraft>>({});
  const [createDraft, setCreateDraft] = useState<DraftValues>(emptyCreateDraft);
  const [createSessionDraft, setCreateSessionDraft] = useState<SessionCreateDraft>(
    emptySessionCreateDraft,
  );
  const [feedbackBySlug, setFeedbackBySlug] = useState<Record<string, Feedback>>({});
  const [userFeedbackById, setUserFeedbackById] = useState<Record<number, Feedback>>({});
  const [sessionFeedbackById, setSessionFeedbackById] = useState<Record<number, Feedback>>({});
  const [orderFeedbackById, setOrderFeedbackById] = useState<Record<number, Feedback>>({});
  const [paymentFeedbackById, setPaymentFeedbackById] = useState<Record<number, Feedback>>({});
  const [createFeedback, setCreateFeedback] = useState<Feedback | null>(null);
  const [createSessionFeedback, setCreateSessionFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [savingSessionId, setSavingSessionId] = useState<number | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [savingPaymentId, setSavingPaymentId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [catalogDisplayFilter, setCatalogDisplayFilter] =
    useState<CatalogDisplayFilter>("all");

  const featuredFormationsCount = useMemo(
    () => formations.filter((formation) => formation.is_featured_home).length,
    [formations],
  );

  const visibleFormations = useMemo(() => {
    if (catalogDisplayFilter === "featured") {
      return formations.filter((formation) => formation.is_featured_home);
    }

    return formations;
  }, [catalogDisplayFilter, formations]);

  const sessionCapableFormations = useMemo(
    () => formations.filter((formation) => formation.format_type !== "ligne"),
    [formations],
  );
  const availableSessionCreateFormations = useMemo(
    () =>
      sessionCapableFormations.filter(
        (formation) =>
          formation.session_state === "unscheduled" || formation.session_state === "ended",
      ),
    [sessionCapableFormations],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchAdminOverview(),
      fetchAdminFormations(),
      fetchAdminOnsiteSessions(),
      fetchAdminUsers(),
      fetchAdminOrders(),
      fetchAdminPayments(),
    ])
      .then(([overviewData, formationsData, sessionsData, usersData, ordersData, paymentsData]) => {
        if (!isMounted) {
          return;
        }

        setOverview(overviewData);
        setFormations(formationsData);
        setSessions(sessionsData);
        setUsers(usersData);
        setOrders(ordersData);
        setPayments(paymentsData);
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

  const syncDraft = (
    slug: string,
    field: keyof DraftValues,
    value: string | boolean | MarketingBadge[] | FormationFormat,
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

  const syncCreateDraft = (
    field: keyof DraftValues,
    value: string | boolean | MarketingBadge[] | FormationFormat,
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
    setUserFeedbackById((current) => {
      if (!(userId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[userId];
      return next;
    });
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

  const syncOrderDraft = (orderId: number, status: OrderStatus) => {
    setOrderDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? { status }),
        status,
      },
    }));
    setOrderFeedbackById((current) => {
      if (!(orderId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[orderId];
      return next;
    });
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
    setPaymentFeedbackById((current) => {
      if (!(paymentId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[paymentId];
      return next;
    });
  };

  const toggleBadge = (
    currentBadges: MarketingBadge[],
    badge: MarketingBadge,
    onChange: (nextBadges: MarketingBadge[]) => void,
  ) => {
    const nextBadges = currentBadges.includes(badge)
      ? currentBadges.filter((item) => item !== badge)
      : [...currentBadges, badge];

    onChange(nextBadges);
  };

  const refreshOverview = async () => {
    const nextOverview = await fetchAdminOverview();
    setOverview(nextOverview);
  };

  const refreshFormationsAndSessions = async () => {
    const [nextFormations, nextSessions] = await Promise.all([
      fetchAdminFormations(),
      fetchAdminOnsiteSessions(),
    ]);

    setFormations(nextFormations);
    setSessions(nextSessions);
    setDrafts(
      Object.fromEntries(
        nextFormations.map((formation) => [formation.slug, buildDraftFromFormation(formation)]),
      ),
    );
    setSessionDrafts(
      Object.fromEntries(nextSessions.map((session) => [session.id, buildSessionDraft(session)])),
    );
  };

  const handleSave = async (formation: AdminFormation) => {
    const draft = drafts[formation.slug];

    try {
      const { payload, currentPrice } = buildPayloadFromDraft(draft);
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
    } catch (error) {
      setFeedbackBySlug((current) => ({
        ...current,
        [formation.slug]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Echec de sauvegarde. Reessaie quand l'API admin est disponible.",
        },
      }));
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

      const { payload, currentPrice } = buildPayloadFromDraft(createDraft);
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
    } catch (error) {
      setCreateFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de creer la formation pour le moment.",
      });
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
      setUserFeedbackById((current) => ({
        ...current,
        [user.id]: { type: "success", message: "Aucun changement a enregistrer." },
      }));
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
      setUserFeedbackById((current) => ({
        ...current,
        [user.id]: { type: "success", message: "Utilisateur mis a jour." },
      }));
    } catch (error) {
      setUserFeedbackById((current) => ({
        ...current,
        [user.id]: {
          type: "error",
          message: error instanceof Error ? error.message : "Echec de mise a jour utilisateur.",
        },
      }));
    } finally {
      setSavingUserId(null);
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
      payload.teacher_name = draft.teacherName.trim();
    }
    const seatCapacity = Number.parseInt(draft.seatCapacity, 10);
    if (Number.isInteger(seatCapacity) && seatCapacity !== session.seat_capacity) {
      payload.seat_capacity = seatCapacity;
    }
    if (draft.status !== session.status) {
      payload.status = draft.status;
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
    } catch (error) {
      setSessionFeedbackById((current) => ({
        ...current,
        [session.id]: {
          type: "error",
          message: error instanceof Error ? error.message : "Echec de mise a jour session.",
        },
      }));
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
    } catch (error) {
      setCreateSessionFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de creer la session pour le moment.",
      });
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
      setOrderFeedbackById((current) => ({
        ...current,
        [order.id]: { type: "success", message: "Aucun changement a enregistrer." },
      }));
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
      await refreshOverview();
      setOrderFeedbackById((current) => ({
        ...current,
        [order.id]: { type: "success", message: "Commande mise a jour." },
      }));
    } catch (error) {
      setOrderFeedbackById((current) => ({
        ...current,
        [order.id]: {
          type: "error",
          message: error instanceof Error ? error.message : "Echec de mise a jour commande.",
        },
      }));
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
      setPaymentFeedbackById((current) => ({
        ...current,
        [payment.id]: { type: "success", message: "Aucun changement a enregistrer." },
      }));
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
      const refreshedOrders = await fetchAdminOrders();
      setOrders(refreshedOrders);
      await refreshOverview();
      setPaymentFeedbackById((current) => ({
        ...current,
        [payment.id]: { type: "success", message: "Paiement mis a jour." },
      }));
    } catch (error) {
      setPaymentFeedbackById((current) => ({
        ...current,
        [payment.id]: {
          type: "error",
          message: error instanceof Error ? error.message : "Echec de mise a jour paiement.",
        },
      }));
    } finally {
      setSavingPaymentId(null);
    }
  };

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
              guide, `ligne` vers un dashboard classique. Une formation ne peut
              avoir qu'une seule session non terminee a la fois.
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
                  <input
                    type="text"
                    value={createDraft.category}
                    onChange={(event) => syncCreateDraft("category", event.target.value)}
                  />
                </label>

                <label className="admin-field">
                  <span>Niveau</span>
                  <input
                    type="text"
                    value={createDraft.level}
                    onChange={(event) => syncCreateDraft("level", event.target.value)}
                  />
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
                          <input
                            type="text"
                            value={draft?.category ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "category", event.target.value)
                            }
                          />
                        </label>

                        <label className="admin-field">
                          <span>Niveau</span>
                          <input
                            type="text"
                            value={draft?.level ?? ""}
                            onChange={(event) =>
                              syncDraft(formation.slug, "level", event.target.value)
                            }
                          />
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
                  <input
                    type="text"
                    value={createSessionDraft.teacherName}
                    onChange={(event) =>
                      syncCreateSessionDraft("teacherName", event.target.value)
                    }
                  />
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
              </div>

              {createSessionFeedback ? (
                <p className={`admin-feedback admin-feedback--${createSessionFeedback.type}`}>
                  {createSessionFeedback.message}
                </p>
              ) : null}
              {availableSessionCreateFormations.length === 0 ? (
                <p className="admin-hint">
                  Toutes les formations live et presentiel ont deja une session
                  non terminee. Cloturez d'abord la session en cours avant d'en
                  programmer une nouvelle.
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
                        <input
                          type="text"
                          value={sessionDrafts[session.id]?.teacherName ?? session.teacher_name}
                          onChange={(event) =>
                            syncSessionDraft(session.id, "teacherName", event.target.value)
                          }
                        />
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
}
