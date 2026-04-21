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

type FormData = {
  firstName: string; lastName: string;
  domains: string[]; customDomain: string;
  selfRating: number; level: string;
  nationality: string; city: string; trainingType: string;
  whatsapp: string; expectations: string;
};

const TOTAL_STEPS = 7;

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
    selfRating: 5, level: "", nationality: "", city: "",
    trainingType: "", whatsapp: "", expectations: "",
  });

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((p) => ({ ...p, [key]: value }));
  }

  function goNext() { setDirection("forward"); setStep((s) => s + 1); }
  function goBack() { setDirection("back"); setStep((s) => s - 1); }

  function canContinue() {
    if (step === 1) return !!(data.firstName.trim() || data.lastName.trim());
    if (step === 2) return data.domains.length > 0 && (!data.domains.includes("Autre") || !!data.customDomain.trim());
    if (step === 3) return data.selfRating >= 1;
    if (step === 4) return !!data.level;
    if (step === 5) return !!(data.nationality && data.city.trim() && data.trainingType);
    if (step === 6) return !!(data.whatsapp && isValidPhoneNumber(data.whatsapp));
    if (step === 7) return !!data.expectations.trim();
    return true;
  }

  async function handleSubmit() {
    setLoading(true); setError("");
    try {
      const payload: DiagnosticData = {
        first_name: data.firstName, last_name: data.lastName,
        domain: data.domains.map(d => d === "Autre" ? data.customDomain : d).join(", "),
        self_rating: data.selfRating, level: data.level,
        nationality: data.nationality, city: data.city,
        training_type: data.trainingType, whatsapp: data.whatsapp,
        expectations: data.expectations,
      };
      const res = await getSuggestions(payload);
      setSuggestions(res.suggestions);
      setWaMessage(res.whatsapp_message);
      setDirection("forward");
      setStep(9);
    } catch (submissionError) {
      const message =
        submissionError instanceof Error && submissionError.message
          ? submissionError.message
          : "Une erreur est survenue. Veuillez réessayer.";
      setError(message);
      setStep(7);
    } finally { setLoading(false); }
  }

  function openWhatsApp() {
    const phone = "237680950319";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, "_blank");
  }

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const cls = `diag-step diag-step--${direction}`;

  return (
    <div className="diag-overlay">
      <button className="diag-close" onClick={() => navigate(-1)} aria-label="Quitter">
        <FaTimes />
      </button>

      {step >= 1 && step <= TOTAL_STEPS && (
        <div className="diag-progress">
          <div className="diag-progress__bar" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      )}

      <div className="diag-inner">

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
                  onClick={() => set("domains", data.domains.includes(d) ? data.domains.filter(x => x !== d) : [...data.domains, d])}>{d}
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
            <h2 className="diag-reveal diag-reveal--2">Sur 10, comment vous évaluez-vous dans ce domaine ?</h2>
            <p className="diag-hint diag-reveal diag-reveal--2">{data.domains.map(d => d === "Autre" ? data.customDomain : d).join(", ")}</p>
            <div className="diag-rating diag-reveal diag-reveal--3">
              <span className="diag-rating__score">{data.selfRating}</span>
              <span className="diag-rating__label">/ 10</span>
            </div>
            <input type="range" min={1} max={10} step={1} className="diag-slider diag-reveal diag-reveal--4"
              value={data.selfRating} onChange={(e) => set("selfRating", Number(e.target.value))} />
            <div className="diag-slider-labels diag-reveal diag-reveal--4"><span>Débutant</span><span>Expert</span></div>
            <div className="diag-stars diag-reveal diag-reveal--5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <FaStar key={n} className={n <= data.selfRating ? "diag-star--on" : "diag-star--off"}
                  onClick={() => set("selfRating", n)} />
              ))}
            </div>
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

        {/* Étape 7 */}
        {step === 7 && (
          <div className="diag-step" key="s7">
            <p className="diag-step-label diag-reveal diag-reveal--1">Étape 7 sur {TOTAL_STEPS}</p>
            <h2 className="diag-reveal diag-reveal--2">Qu'attendez-vous de nous ?</h2>
            <p className="diag-hint diag-reveal diag-reveal--3">Décrivez librement vos objectifs par rapport à cette formation.</p>
            <textarea className="diag-textarea diag-reveal diag-reveal--4" rows={5} autoFocus
              placeholder="Ex : Je veux apprendre le design depuis zéro pour travailler en freelance d'ici 6 mois…"
              value={data.expectations} onChange={(e) => set("expectations", e.target.value)} />
            {error && <p className="diag-field-error">{error}</p>}
            <div className="diag-nav-inline diag-reveal diag-reveal--5">
              <button className="diag-btn-back diag-btn--sm" onClick={goBack}><FaArrowLeft /> Retour</button>
              <button className="diag-btn-primary diag-btn--sm"
                onClick={() => { setStep(8); handleSubmit(); }}
                disabled={!canContinue() || loading}>
                Voir mes recommandations <FaArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* Chargement */}
        {step === 8 && (
          <div className="diag-step diag-step--forward diag-loading" key="s8">
            <div className="diag-spinner" />
            <p>Analyse de votre profil en cours…</p>
            <p className="diag-hint">Notre IA prépare vos recommandations personnalisées</p>
          </div>
        )}

        {/* Résultats */}
        {step === 9 && (
          <div className={cls} key="s9">
            <div className="diag-results">
              <FaCheckCircle className="diag-results__icon" />
              <h2>Vos formations recommandées</h2>
              <p className="diag-hint">Basées sur votre profil, voici nos suggestions :</p>
              <div className="diag-suggestions">
                {suggestions.map((s, i) => {
                  const clean = s.replace(/\*\*/g, "");
                  const sep = clean.indexOf(" — ");
                  const title = sep > -1 ? clean.slice(0, sep) : clean;
                  const reason = sep > -1 ? clean.slice(sep + 3) : "";
                  return (
                    <div key={i} className="diag-suggestion-card">
                      <span className="diag-suggestion-card__num">{i + 1}</span>
                      <div><strong>{title}</strong>{reason && <p>{reason}</p>}</div>
                    </div>
                  );
                })}
              </div>
              <button className="diag-btn-whatsapp" onClick={openWhatsApp}>
                <FaWhatsapp /> Envoyer sur WhatsApp &amp; être contacté
              </button>
              <button className="diag-btn-secondary" onClick={() => navigate("/formations")}>
                Voir toutes les formations
              </button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
