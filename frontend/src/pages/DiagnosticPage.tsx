import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { FaTimes, FaArrowRight, FaArrowLeft, FaWhatsapp, FaStar, FaCheckCircle } from "react-icons/fa";
import { getSuggestions, type DiagnosticData } from "../lib/diagnosticApi";
import "../styles/diagnostic.css";
import { IoMdRocket } from "react-icons/io";
import { SiBoat } from "react-icons/si";
import { IoSearchCircle } from "react-icons/io5";
import { FaVideo } from "react-icons/fa6";
import { GiSchoolBag } from "react-icons/gi";
import { WiStars } from "react-icons/wi";

const DOMAINS = [
  "Design Graphique", "Marketing Digital", "Vidéo & Motion",
  "Intelligence Artificielle", "No-Code & Tech", "Freelance & Business Créatif",
  "Community Management", "Photoshop", "Autre",
];

const COUNTRIES = [
  { name: "Cameroun", flag: "🇨🇲" }, { name: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Sénégal", flag: "🇸🇳" }, { name: "Mali", flag: "🇲🇱" },
  { name: "Burkina Faso", flag: "🇧🇫" }, { name: "Guinée", flag: "🇬🇳" },
  { name: "Bénin", flag: "🇧🇯" }, { name: "Togo", flag: "🇹🇬" },
  { name: "Niger", flag: "🇳🇪" }, { name: "Tchad", flag: "🇹🇩" },
  { name: "Congo", flag: "🇨🇬" }, { name: "RD Congo", flag: "🇨🇩" },
  { name: "Gabon", flag: "🇬🇦" }, { name: "Madagascar", flag: "🇲🇬" },
  { name: "Rwanda", flag: "🇷🇼" }, { name: "Maroc", flag: "🇲🇦" },
  { name: "Algérie", flag: "🇩🇿" }, { name: "Tunisie", flag: "🇹🇳" },
  { name: "France", flag: "🇫🇷" }, { name: "Belgique", flag: "🇧🇪" },
  { name: "Suisse", flag: "🇨🇭" }, { name: "Canada", flag: "🇨🇦" },
  { name: "États-Unis", flag: "🇺🇸" }, { name: "Autre", flag: "🌍" },
];

const DOMAIN_FALLBACK_TITLES: Record<string, string> = {
  "Design Graphique": "Design Graphique",
  "Marketing Digital": "Marketing Digital",
  "Vidéo & Motion": "Vidéo & Motion Design",
  "Intelligence Artificielle": "Intelligence Artificielle créative",
  "No-Code & Tech": "No-Code & outils digitaux",
  "Freelance & Business Créatif": "Freelance & Business Créatif",
  "Community Management": "Community Management",
  Photoshop: "Photoshop",
};

type FormData = {
  firstName: string; lastName: string;
  domains: string[]; customDomain: string;
  selfRating: number; selfRatings: Record<string, number>; level: string;
  nationality: string; city: string; trainingType: string; availability: string;
  whatsapp: string; expectations: string;
};

const TOTAL_STEPS = 8;

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [waMessage, setWaMessage] = useState("");
  const [error, setError] = useState("");
  const [countrySearch, setCountrySearch] = useState("");

  const [data, setData] = useState<FormData>({
    firstName: "", lastName: "", domains: [], customDomain: "",
    selfRating: 5, selfRatings: {}, level: "", nationality: "", city: "",
    trainingType: "", availability: "", whatsapp: "", expectations: "",
  });

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((p) => ({ ...p, [key]: value }));
  }

  function domainLabel(domain: string) {
    return domain === "Autre" ? data.customDomain.trim() || "Autre" : domain;
  }

  function getDomainRating(domain: string) {
    return data.selfRatings[domain] ?? data.selfRating;
  }

  function setDomainRating(domain: string, value: number) {
    setData((p) => ({
      ...p,
      selfRating: value,
      selfRatings: { ...p.selfRatings, [domain]: value },
    }));
  }

  function toggleDomain(domain: string) {
    setData((p) => {
      const isSelected = p.domains.includes(domain);
      const nextDomains = isSelected ? p.domains.filter((item) => item !== domain) : [...p.domains, domain];
      const nextRatings = { ...p.selfRatings };
      if (isSelected) delete nextRatings[domain];
      else nextRatings[domain] = nextRatings[domain] ?? p.selfRating;
      return { ...p, domains: nextDomains, selfRatings: nextRatings };
    });
  }

  function averageSelfRating() {
    if (data.domains.length === 0) return data.selfRating;
    const sum = data.domains.reduce((total, domain) => total + getDomainRating(domain), 0);
    return Math.round(sum / data.domains.length);
  }

  function formattedDomainsWithRatings() {
    return data.domains
      .map((domain) => `${domainLabel(domain)} (${getDomainRating(domain)}/10)`)
      .join(", ");
  }

  function trainingTypeLabel() {
    return {
      online: "en ligne",
      presentiel: "en présentiel",
      both: "en ligne ou en présentiel",
    }[data.trainingType] ?? data.trainingType;
  }

  function availabilityLabel() {
    return {
      day: "cours du jour",
      evening: "cours du soir",
      flexible: "horaires flexibles",
    }[data.availability] ?? data.availability;
  }

  function levelLabel() {
    return data.level === "debutant" ? "débutant" : "intermédiaire";
  }

  function primaryDomain() {
    if (data.domains.length === 0) return "";
    return [...data.domains].sort((a, b) => getDomainRating(b) - getDomainRating(a))[0];
  }

  function profileTitle() {
    const domainsText = data.domains.map(domainLabel).join(" ").toLowerCase();
    const expectationsText = data.expectations.toLowerCase();
    const profileText = `${domainsText} ${expectationsText}`;
    if (profileText.includes("freelance") || profileText.includes("business")) return "Futur créatif freelance";
    if (profileText.includes("intelligence") || profileText.includes("ia")) return "Créatif augmenté par l’IA";
    if (profileText.includes("design") || profileText.includes("photoshop")) return "Futur designer visuel";
    if (profileText.includes("marketing") || profileText.includes("community")) return "Stratège digital en devenir";
    return "Créatif en progression";
  }

  function profileScoreLabel() {
    const score = averageSelfRating();
    if (score <= 3) return "Fondations à construire";
    if (score <= 6) return "Bases solides à structurer";
    return "Profil avancé à spécialiser";
  }

  function scoreLevelLabel() {
    const score = averageSelfRating();
    if (score <= 3) return "débutant";
    if (score <= 6) return "intermédiaire";
    return "avancé";
  }

  function firstAction() {
    const domain = domainLabel(primaryDomain()).toLowerCase();
    if (domain.includes("ia") || domain.includes("intelligence")) {
      return "Créer 5 prompts utiles pour votre domaine et comparer les résultats obtenus.";
    }
    if (domain.includes("design") || domain.includes("photoshop")) {
      return "Reproduire 3 visuels simples avec une palette imposée et les publier dans un mini-portfolio.";
    }
    if (domain.includes("marketing") || domain.includes("community")) {
      return "Préparer un calendrier de 7 contenus pour une marque fictive ou votre propre projet.";
    }
    if (domain.includes("freelance") || domain.includes("business")) {
      return "Définir une offre simple : service, prix de départ, livrable et délai.";
    }
    return "Choisir un projet concret à réaliser cette semaine pour mesurer votre progression.";
  }

  function cleanSuggestion(suggestion: string) {
    const clean = suggestion.replace(/\*\*/g, "");
    const sep = clean.indexOf(" — ");
    return {
      title: sep > -1 ? clean.slice(0, sep) : clean,
      reason: sep > -1 ? clean.slice(sep + 3) : "",
    };
  }

  function resultPathTitles() {
    const titles = suggestions.map((suggestion) => cleanSuggestion(suggestion).title).filter(Boolean);
    while (titles.length < 3) {
      const fallback = ["Fondations créatives", "Pratique guidée", "Projet portfolio"][titles.length];
      titles.push(fallback);
    }
    return titles.slice(0, 3);
  }

  function recommendedFormationsLabel() {
    const count = resultPathTitles().length;
    return count > 1
      ? `Nous te recommandons ces ${count} formations`
      : "Nous te recommandons cette formation";
  }

  function starterFormationTitle() {
    return resultPathTitles()[0];
  }

  function formationPlanItems() {
    const [first, second, third] = resultPathTitles();
    return [
      { title: first, prefix: "Démarre avec", suffix: "pour poser les bases." },
      { title: second, prefix: "Ajoute", suffix: "pour élargir ton profil." },
      { title: third, prefix: "Complète avec", suffix: "pour renforcer ton projet." },
      { title: "un livrable", prefix: "Prépare", suffix: "pour montrer ton niveau." },
    ];
  }

  function formationPlanLines() {
    return formationPlanItems().map((item) => `${item.prefix} ${item.title}, ${item.suffix}`);
  }

  function buildClientFallbackSuggestions() {
    const selected = data.domains.length > 0 ? data.domains : ["Design Graphique", "Marketing Digital"];
    const uniqueTitles = Array.from(new Set(selected.map((domain) => DOMAIN_FALLBACK_TITLES[domain] ?? domainLabel(domain))));
    const titles = uniqueTitles.slice(0, 3);
    while (titles.length < 3) {
      const candidate = ["Design Graphique", "Marketing Digital", "Community Management"][titles.length];
      if (!titles.includes(candidate)) titles.push(candidate);
    }
    return titles.map((title) => (
      `**${title}** — Recommandation basée sur votre niveau ${levelLabel()}, ` +
      `vos intérêts (${formattedDomainsWithRatings()}) et votre préférence ${trainingTypeLabel()} / ${availabilityLabel()}.`
    ));
  }

  function buildClientFallbackWhatsAppMessage(nextSuggestions: string[]) {
    const name = (data.firstName || data.lastName).trim() || "l'apprenant";
    const lines = [
      "Bonjour ! Je viens de completer le diagnostic de l'Academie des Creatifs.",
      "",
      `Nom : ${name}`,
      `Domaine : ${formattedDomainsWithRatings()}`,
      `Auto-evaluation moyenne : ${averageSelfRating()}/10`,
      `Niveau : ${levelLabel()}`,
      `Pays : ${data.nationality}`,
      `Ville : ${data.city}`,
      `Preference : ${trainingTypeLabel()}`,
      `Disponibilites : ${availabilityLabel()}`,
      `Attentes : ${data.expectations}`,
      "",
      "Formations suggerees :",
      ...nextSuggestions.map((suggestion) => `- ${suggestion.replace(/\*\*/g, "")}`),
    ];
    return lines.join("\n");
  }

  function buildResultWhatsAppMessage() {
    const name = (data.firstName || data.lastName).trim() || "l'apprenant";
    const suggestionLines = suggestions.map((suggestion) => `- ${suggestion.replace(/\*\*/g, "")}`);
    return [
      "Bonjour ! Je viens de completer le diagnostic de l'Academie des Creatifs.",
      "",
      `Nom : ${name}`,
      `Profil : ${profileTitle()}`,
      `Niveau estime : ${profileScoreLabel()} (${averageSelfRating()}/10)`,
      `Domaines : ${formattedDomainsWithRatings()}`,
      `Ville/Pays : ${data.city}, ${data.nationality}`,
      `Preference : ${trainingTypeLabel()} / ${availabilityLabel()}`,
      `Objectif : ${data.expectations}`,
      "",
      "Parcours conseille :",
      ...resultPathTitles().map((title, index) => `${index + 1}. ${title}`),
      "",
      "Plan de formation conseille :",
      ...formationPlanLines(),
      "",
      "Formation a demarrer en priorite :",
      starterFormationTitle(),
      "",
      "Formations recommandees :",
      ...suggestionLines,
    ].join("\n");
  }

  function displayName() {
    return data.firstName.trim() || data.lastName.trim() || "créatif";
  }

  function greetingLabel() {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
  }

  function goNext() { setDirection("forward"); setStep((s) => s + 1); }
  function goBack() { setDirection("back"); setStep((s) => s - 1); }

  function canContinue() {
    if (step === 1) return !!(data.firstName.trim() || data.lastName.trim());
    if (step === 2) return data.domains.length > 0 && (!data.domains.includes("Autre") || !!data.customDomain.trim());
    if (step === 3) return data.domains.every((domain) => getDomainRating(domain) >= 1);
    if (step === 4) return !!data.level;
    if (step === 5) return !!(data.nationality && data.city.trim() && data.trainingType);
    if (step === 6) return !!data.availability;
    if (step === 7) return !!(data.whatsapp && isValidPhoneNumber(data.whatsapp));
    if (step === 8) return !!data.expectations.trim();
    return true;
  }

  async function handleSubmit() {
    setLoading(true); setError("");
    try {
      const payload: DiagnosticData = {
        first_name: data.firstName, last_name: data.lastName,
        domain: formattedDomainsWithRatings(),
        self_rating: averageSelfRating(), level: data.level,
        nationality: data.nationality, city: data.city,
        training_type: data.trainingType, availability: data.availability, whatsapp: data.whatsapp,
        expectations: data.expectations,
      };
      const res = await getSuggestions(payload);
      setSuggestions(res.suggestions);
      setWaMessage(res.whatsapp_message);
      setDirection("forward");
      setStep(10);
    } catch (submissionError) {
      const fallbackSuggestions = buildClientFallbackSuggestions();
      setSuggestions(fallbackSuggestions);
      setWaMessage(buildClientFallbackWhatsAppMessage(fallbackSuggestions));
      setError("");
      setDirection("forward");
      setStep(10);
    } finally { setLoading(false); }
  }

  function openWhatsApp() {
    const phone = "237680950319";
    const message = suggestions.length > 0 ? buildResultWhatsAppMessage() : waMessage;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const cls = `diag-step diag-step--${direction}`;

  return (
    <div className={`diag-overlay${step === 10 ? " diag-overlay--results" : ""}`}>
      <button className="diag-close" onClick={() => navigate(-1)} aria-label="Quitter">
        <FaTimes />
      </button>

      {step >= 1 && step <= TOTAL_STEPS && (
        <div className="diag-progress">
          <div className="diag-progress__bar" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      )}

      <div className={`diag-inner${step === 10 ? " diag-inner--results" : ""}`}>

        {/* Accueil */}
        {step === 0 && (
          <div className="diag-step diag-step--forward" key="s0">
            <div className="diag-welcome">
              <img src="/logo_academie_hd.png" alt="Académie des Créatifs" className="diag-logo diag-reveal diag-reveal--1" />
              <h1 className="diag-reveal diag-reveal--2">Bienvenue à l'Académie<br />des Créatifs</h1>
              <p className="diag-reveal diag-reveal--3">Ce test de diagnostic nous permet de mieux vous connaître afin de vous accompagner vers la formation qui vous correspond le mieux.</p>
              <p className="diag-welcome__sub diag-reveal diag-reveal--4">⏱ Moins de <strong>5 minutes</strong> suffisent</p>
              <div className="diag-reveal diag-reveal--5">
                <button className="diag-btn-primary" onClick={goNext}>
                  Commencer <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 1 */}
        {step === 1 && (
          <div className="diag-step" key="s1">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 1 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Comment on vous appelle ?</h2>
            <p className="diag-hint diag-reveal diag-reveal--3">Renseignez au moins l'un des deux champs.</p>
            <div className="diag-fields diag-reveal diag-reveal--4">
              <input className="diag-input" placeholder="Prénom" autoFocus
                value={data.firstName} onChange={(e) => set("firstName", e.target.value)} />
              <input className="diag-input" placeholder="Nom"
                value={data.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div className="diag-nav-inline diag-reveal diag-reveal--5">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 2 */}
        {step === 2 && (
          <div className="diag-step" key="s2">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 2 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Quel domaine souhaitez-vous apprendre ?</h2>
            <div className="diag-chips diag-reveal diag-reveal--3">
              {DOMAINS.map((d) => (
                <button key={d} type="button"
                  className={`diag-chip${data.domains.includes(d) ? " is-selected" : ""}`}
                  onClick={() => toggleDomain(d)}>{d}
                </button>
              ))}
            </div>
            {data.domains.includes("Autre") && (
              <input className="diag-input diag-reveal diag-reveal--4" style={{ marginTop: "1rem" }}
                placeholder="Précisez le domaine…" autoFocus
                value={data.customDomain} onChange={(e) => set("customDomain", e.target.value)} />
            )}
            <div className="diag-nav-inline diag-reveal diag-reveal--4">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 3 */}
        {step === 3 && (
          <div className="diag-step" key="s3">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 3 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">
              {data.domains.length > 1
                ? "Sur 10, comment vous évaluez-vous dans chaque domaine ?"
                : "Sur 10, comment vous évaluez-vous dans ce domaine ?"}
            </h2>
            {data.domains.length === 1 ? (
              <>
                <p className="diag-hint diag-reveal diag-reveal--2">{domainLabel(data.domains[0])}</p>
                <div className="diag-rating diag-reveal diag-reveal--3">
                  <span className="diag-rating__score">{getDomainRating(data.domains[0])}</span>
                  <span className="diag-rating__label">/ 10</span>
                </div>
                <input type="range" min={1} max={10} step={1} className="diag-slider diag-reveal diag-reveal--4"
                  value={getDomainRating(data.domains[0])} onChange={(e) => setDomainRating(data.domains[0], Number(e.target.value))} />
                <div className="diag-slider-labels diag-reveal diag-reveal--4"><span>Débutant</span><span>Expert</span></div>
                <div className="diag-stars diag-reveal diag-reveal--5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <FaStar key={n} className={n <= getDomainRating(data.domains[0]) ? "diag-star--on" : "diag-star--off"}
                      onClick={() => setDomainRating(data.domains[0], n)} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="diag-hint diag-reveal diag-reveal--2">Ajustez votre niveau pour chaque domaine choisi.</p>
                <div className="diag-domain-ratings diag-reveal diag-reveal--3">
                  {data.domains.map((domain) => {
                    const rating = getDomainRating(domain);
                    return (
                      <div className="diag-domain-rating-card" key={domain}>
                        <div className="diag-domain-rating-card__head">
                          <strong>{domainLabel(domain)}</strong>
                          <span>{rating}/10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          className="diag-slider diag-slider--compact"
                          value={rating}
                          onChange={(e) => setDomainRating(domain, Number(e.target.value))}
                        />
                        <div className="diag-domain-stars">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <FaStar
                              key={n}
                              className={n <= rating ? "diag-star--on" : "diag-star--off"}
                              onClick={() => setDomainRating(domain, n)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="diag-nav-inline diag-reveal diag-reveal--5">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 4 */}
        {step === 4 && (
          <div className="diag-step" key="s4">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 4 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Quel est votre niveau actuel ?</h2>
            <div className="diag-level-cards diag-reveal diag-reveal--3">
              {[
                { value: "debutant", label: "Débutant", desc: "Je commence depuis zéro", emoji: <SiBoat className="rocket"/> },
                { value: "intermediaire", label: "Intermédiaire", desc: "J'ai quelques bases", emoji: <IoMdRocket className="rocket" /> },
              ].map(({ value, label, desc, emoji }) => (
                <button key={value} type="button"
                  className={`diag-level-card${data.level === value ? " is-selected" : ""}`}
                  onClick={() => set("level", value)}>
                  <span className="diag-level-card__emoji">{emoji}</span>
                  <strong>{label}</strong>
                  <span>{desc}</span>
                </button>
              ))}
            </div>
            <div className="diag-nav-inline diag-reveal diag-reveal--4">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 5 */}
        {step === 5 && (
          <div className="diag-step" key="s5">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 5 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Où êtes-vous basé ?</h2>
            <div className="diag-fields diag-reveal diag-reveal--3">
              <div className="diag-country-wrap">
                <span className="diag-input-icon">
                 <IoSearchCircle />
                  </span>
                <input className="diag-input" placeholder="Nationalité…"
                  value={countrySearch}
                  onChange={(e) => { setCountrySearch(e.target.value); set("nationality", ""); }} />
                {countrySearch && !data.nationality && filtered.length > 0 && (
                  <div className="diag-country-list">
                    {filtered.map((c) => (
                      <button key={c.name} type="button" className="diag-country-item"
                        onClick={() => { set("nationality", c.name); setCountrySearch(c.name); }}>
                        {c.flag} {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input className="diag-input" placeholder="Votre ville actuelle"
                value={data.city} onChange={(e) => set("city", e.target.value)} />
              <p className="diag-sublabel">Type de formation souhaité</p>
              <div className="diag-chips diag-chips--training">
                {[
                    { value: "online", label: "En ligne", icon: FaVideo },
                    { value: "presentiel", label: "En présentiel", icon: GiSchoolBag },
                    { value: "both", label: "Les deux", icon: WiStars },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      className={`diag-chip${data.trainingType === value ? " is-selected" : ""}`}
                      onClick={() => set("trainingType", value)}
                    >
                      <Icon className="diag-chip-icon" />
                      {label}
                    </button>
                  ))}
              </div>
            </div>
            <div className="diag-nav-inline diag-reveal diag-reveal--4">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 6 */}
        {step === 6 && (
          <div className="diag-step" key="s6">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 6 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Quelles sont vos disponibilités ?</h2>
            <p className="diag-hint diag-reveal diag-reveal--3">Choisissez le créneau qui vous arrange le mieux pour suivre la formation.</p>
            <div className="diag-chips diag-chips--training diag-reveal diag-reveal--4">
              {[
                { value: "day", label: "Cours du jour" },
                { value: "evening", label: "Cours du soir" },
                { value: "flexible", label: "Flexible" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`diag-chip${data.availability === value ? " is-selected" : ""}`}
                  onClick={() => set("availability", value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="diag-nav-inline diag-reveal diag-reveal--5">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 7 */}
        {step === 7 && (
          <div className="diag-step" key="s7">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 7 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Votre contact WhatsApp</h2>
            <p className="diag-hint diag-reveal diag-reveal--3">Nous vous répondrons directement sur WhatsApp.</p>
            <div className="diag-phone-wrap diag-reveal diag-reveal--4">
              <PhoneInput international defaultCountry="CM"
                value={data.whatsapp} onChange={(v) => set("whatsapp", v ?? "")}
                className="diag-phone-input" />
              {data.whatsapp && !isValidPhoneNumber(data.whatsapp) && (
                <p className="diag-field-error">Numéro invalide</p>
              )}
            </div>
            <div className="diag-nav-inline diag-reveal diag-reveal--5">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm" onClick={goNext} disabled={!canContinue()}>Continuer <FaArrowRight /></button>
            </div>
          </div>
        )}

        {/* Étape 8 */}
        {step === 8 && (
          <div className="diag-step" key="s8">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 8 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Qu'attendez-vous de nous ?</h2>
            <p className="diag-hint diag-reveal diag-reveal--3">Décrivez librement vos objectifs par rapport à cette formation.</p>
            <textarea className="diag-textarea diag-reveal diag-reveal--4" rows={5} autoFocus
              placeholder="Ex : Je veux apprendre le design depuis zéro pour travailler en freelance d'ici 6 mois…"
              value={data.expectations} onChange={(e) => set("expectations", e.target.value)} />
            {error && <p className="diag-field-error">{error}</p>}
            <div className="diag-nav-inline diag-reveal diag-reveal--5">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm"
                onClick={() => { setStep(9); handleSubmit(); }}
                disabled={!canContinue() || loading}>
                Voir mes recommandations <FaArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* Chargement */}
        {step === 9 && (
          <div className="diag-step diag-step--forward diag-loading" key="s9">
            <div className="diag-spinner" />
            <p>Analyse de votre profil en cours…</p>
            <p className="diag-hint">Notre IA prépare vos recommandations personnalisées</p>
          </div>
        )}

        {/* Résultats */}
        {step === 10 && (
          <div className={cls} key="s10">
            <div className="diag-results diag-results--complete">
              <div className="diag-complete-head">
                <span className="diag-results__badge"><FaCheckCircle /> Diagnostic complété</span>
                <p className="diag-complete-intro">
                  {greetingLabel()} {displayName()} ! Score : {averageSelfRating()}/10 · Niveau {scoreLevelLabel()}.
                  Voici le plan conseillé pour démarrer.
                </p>
              </div>

              <div className="diag-complete-stack">
                <section className="diag-summary-block" aria-label="Résumé du diagnostic">
                  <div className="diag-summary-column diag-summary-column--profile">
                    <span className="diag-complete-card__eyebrow">Votre profil</span>
                    <strong>{profileTitle()}</strong>
                    <p>{profileScoreLabel()}</p>
                  </div>

                  <div className="diag-summary-column">
                    <span className="diag-complete-card__eyebrow">Point de départ</span>
                    <strong>{levelLabel()}</strong>
                    <p>{domainLabel(primaryDomain()) || "Domaine créatif"} · moyenne {averageSelfRating()}/10</p>
                  </div>

                  <div className="diag-summary-column">
                    <span className="diag-complete-card__eyebrow">Rythme conseillé</span>
                    <strong>{availabilityLabel()}</strong>
                    <p>{trainingTypeLabel()} · {data.city || data.nationality}</p>
                  </div>
                </section>

                <section className="diag-bottom-block" aria-label="Parcours et plan de progression">
                  <div className="diag-bottom-head">
                    <div>
                      <span className="diag-complete-card__eyebrow">Parcours recommandé</span>
                      <strong>{recommendedFormationsLabel()}</strong>
                    </div>
                  </div>
                  <ol className="diag-mini-path diag-mini-path--horizontal">
                    {resultPathTitles().map((title, index) => (
                      <li key={`${title}-${index}`}>
                        <span>{index + 1}</span>
                        <p><strong>{title}</strong></p>
                      </li>
                    ))}
                  </ol>

                  <div className="diag-bottom-head diag-bottom-head--plan">
                    <div>
                      <span className="diag-complete-card__eyebrow">Plan de formation</span>
                      <strong>Démarre en priorité avec {starterFormationTitle()}</strong>
                    </div>
                  </div>
                  <div className="diag-mini-plan">
                    {formationPlanItems().map((item, index) => (
                      <p key={`${item.title}-${index}`}>
                        <span>{index + 1}</span>
                        {item.prefix} <strong>{item.title}</strong>, {item.suffix}
                      </p>
                    ))}
                  </div>

                  <div className="diag-action-line">
                    <span>Prochaine action</span>
                    <strong>Choisis {starterFormationTitle()} comme première formation et demande ton programme personnalisé.</strong>
                  </div>

                  <div className="diag-complete-actions diag-complete-actions--bottom">
                    <button className="diag-btn-whatsapp" onClick={openWhatsApp}>
                      <FaWhatsapp /> Recevoir sur WhatsApp
                    </button>
                    <button className="diag-btn-secondary" onClick={() => navigate("/formations")}>
                      Voir les formations
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
