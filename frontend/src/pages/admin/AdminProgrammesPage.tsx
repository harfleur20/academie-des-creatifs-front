import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImageIcon, Save, Upload } from "lucide-react";
import { uploadAdminAsset, updateSiteContent } from "../../lib/catalogApi";
import { fetchPublicSiteContent, type ProgrammeConfig } from "../../lib/siteContentApi";

const DEFAULT_PROGRAMMES: ProgrammeConfig[] = [
  {
    id: "focus-talklive",
    name: "Focus TalkLive",
    tagline: "Des conférences live pour s'inspirer et progresser",
    description:
      "Focus TalkLive rassemble des créatifs et professionnels du digital autour de sessions de talks en direct. Des échanges concrets, des invités du terrain et une communauté active qui débat et grandit ensemble.",
    logoColored: "/logos-programme/logos-focus-TalkLive.png",
    logoWhite: "/logos-programme/1.png",
    heroImage: "/Album/album-7.jpg",
    primary: "#1c2a5e",
    primaryDark: "#0f1a3d",
    accent: "#f97316",
    accentText: "#ffffff",
    highlights: [
      { title: "Speakers du terrain", text: "Des intervenants actifs qui partagent leur vécu professionnel sans filtre." },
      { title: "Sessions en direct", text: "Des lives interactifs avec Q&A en temps réel pour apprendre en communauté." },
      { title: "Replays accessibles", text: "Retrouve chaque session dans ton espace personnel après le live." },
    ],
    photos: ["/Album/album-1.jpg", "/Album/album-2.jpg", "/Album/album-3.jpg", "/Album/album-7.jpg"],
    ctaLabel: "Voir les sessions à venir",
    ctaPath: "/formations",
  },
  {
    id: "graphic-talent",
    name: "Graphic Talent Insider",
    tagline: "La compétition qui révèle les talents créatifs",
    description:
      "Graphic Talent Insider est le programme phare pour les designers en devenir. Chaque session soumet des créatifs à des briefs réels évalués par un jury de professionnels — un tremplin concret pour ton portfolio et ta carrière.",
    logoColored: "/logos-programme/2.png",
    logoWhite: "/logos-programme/2.png",
    heroImage: "/Album/album-5.jpg",
    primary: "#1a1a2e",
    primaryDark: "#0d0d1a",
    accent: "#eab308",
    accentText: "#1a1a2e",
    highlights: [
      { title: "Briefs réels", text: "Relève des challenges inspirés du vrai marché et forge ton style en conditions réelles." },
      { title: "Jury de pros", text: "Ton travail évalué par des professionnels actifs du design et de la communication." },
      { title: "Portfolio & palmarès", text: "Intègre tes meilleurs rendus dans ton portfolio et accède au classement public." },
    ],
    photos: ["/Album/album-4.jpg", "/Album/album-5.jpg", "/Album/album-6.jpg", "/Album/album-9.jpg"],
    ctaLabel: "Rejoindre la compétition",
    ctaPath: "/formations",
  },
  {
    id: "tuto-en-ligne",
    name: "Tuto en Ligne",
    tagline: "Apprends à ton rythme, avance par la pratique",
    description:
      "Tuto en Ligne propose des formations vidéo guidées en design, motion et digital. Un parcours pensé pour progresser de manière autonome, avec des projets concrets à chaque module et des retours de la communauté.",
    logoColored: "/logos-programme/logoChat.png",
    logoWhite: "/logos-programme/3.png",
    heroImage: "/Album/album-8.jpg",
    primary: "#c2410c",
    primaryDark: "#7c2d12",
    accent: "#fb923c",
    accentText: "#ffffff",
    highlights: [
      { title: "Vidéos guidées", text: "Des tutos pas à pas sur Illustrator, After Effects, Figma et bien plus." },
      { title: "Projets pratiques", text: "Chaque module se termine par un rendu concret à créer et à soumettre." },
      { title: "Communauté active", text: "Partage tes créations, commente celles des autres et grandis ensemble." },
    ],
    photos: ["/Album/album-8.jpg", "/Album/album-3.jpg", "/Album/album-6.jpg", "/Album/album-1.jpg"],
    ctaLabel: "Découvrir les formations",
    ctaPath: "/formations",
  },
  {
    id: "coupe-des-creatifs",
    name: "Coupe des Créatifs",
    tagline: "L'ultime défi pour les créatifs de la communauté",
    description:
      "La Coupe des Créatifs est le challenge annuel ouvert à tous les membres de l'Académie. Présente ton meilleur projet, défie tes pairs et gagne une place au classement de la communauté créative.",
    logoColored: "/logos-programme/logo_coupe des créatifs.png",
    logoWhite: "/logos-programme/logo_coupe des créatifs.png",
    heroImage: "/Album/coupecreatif.jpg",
    primary: "#1565c0",
    primaryDark: "#0d47a1",
    accent: "#38bdf8",
    accentText: "#0d47a1",
    highlights: [
      { title: "Défi ouvert à tous", text: "Soumets ton projet et entre en compétition avec toute la communauté créative." },
      { title: "Vote & jury", text: "Les participants et un jury de pros évaluent chaque création soumise." },
      { title: "Trophée & reconnaissance", text: "Les gagnants rejoignent le hall of fame de l'Académie des Créatifs." },
    ],
    photos: ["/Album/coupecreatif.jpg", "/Album/album-2.jpg", "/Album/album-4.jpg", "/Album/album-9.jpg"],
    ctaLabel: "Participer à la prochaine édition",
    ctaPath: "/formations",
  },
];

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { public_url } = await uploadAdminAsset(file);
      onChange(public_url);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="admprog-img-field">
      <span className="admprog-img-label">{label}</span>
      <div className="admprog-img-row">
        {value ? (
          <img src={value} alt="" className="admprog-img-preview" />
        ) : (
          <div className="admprog-img-placeholder"><ImageIcon size={18} /></div>
        )}
        <div className="admprog-img-controls">
          <input
            className="adm-form-field__input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="URL de l'image"
          />
          <label className="adm-upload-btn" style={{ cursor: uploading ? "wait" : "pointer" }}>
            <Upload size={13} /> {uploading ? "Envoi…" : "Uploader"}
            <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>
  );
}

function ProgrammeAccordion({
  prog,
  open,
  onToggle,
  onChange,
}: {
  prog: ProgrammeConfig;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ProgrammeConfig>) => void;
}) {
  function setHighlight(i: number, field: "title" | "text", val: string) {
    const next = prog.highlights.map((h, idx) => idx === i ? { ...h, [field]: val } : h);
    onChange({ highlights: next });
  }
  function setPhoto(i: number, val: string) {
    const next = prog.photos.map((p, idx) => idx === i ? val : p);
    onChange({ photos: next });
  }

  return (
    <div className={`admprog-accordion${open ? " admprog-accordion--open" : ""}`}>
      <button type="button" className="admprog-accordion__head" onClick={onToggle}>
        <div className="admprog-accordion__title-row">
          <span className="admprog-accordion__dot" style={{ background: prog.accent }} />
          <strong>{prog.name}</strong>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="admprog-accordion__body">

          {/* ── TEXTES ── */}
          <div className="adm-card">
            <div className="adm-card__header">
              <h3 className="adm-card__title">Textes</h3>
            </div>
            <div className="adm-form-grid">
              <label className="adm-form-field adm-form-field--full">
                <span className="adm-form-field__label">Accroche (tagline)</span>
                <input
                  className="adm-form-field__input"
                  value={prog.tagline}
                  onChange={(e) => onChange({ tagline: e.target.value })}
                />
              </label>
              <label className="adm-form-field adm-form-field--full">
                <span className="adm-form-field__label">Description</span>
                <textarea
                  className="adm-form-field__input"
                  rows={3}
                  value={prog.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                />
              </label>
              <label className="adm-form-field">
                <span className="adm-form-field__label">Texte du bouton CTA</span>
                <input
                  className="adm-form-field__input"
                  value={prog.ctaLabel}
                  onChange={(e) => onChange({ ctaLabel: e.target.value })}
                />
              </label>
              <label className="adm-form-field">
                <span className="adm-form-field__label">Lien du bouton CTA</span>
                <input
                  className="adm-form-field__input"
                  value={prog.ctaPath}
                  onChange={(e) => onChange({ ctaPath: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* ── IMAGES ── */}
          <div className="adm-card">
            <div className="adm-card__header">
              <h3 className="adm-card__title">Images</h3>
            </div>
            <div className="admprog-images-grid">
              <ImageUploadField
                label="Image hero (fond)"
                value={prog.heroImage}
                onChange={(url) => onChange({ heroImage: url })}
              />
              <ImageUploadField
                label="Logo coloré"
                value={prog.logoColored}
                onChange={(url) => onChange({ logoColored: url })}
              />
              <ImageUploadField
                label="Logo blanc"
                value={prog.logoWhite}
                onChange={(url) => onChange({ logoWhite: url })}
              />
              {prog.photos.map((photo, i) => (
                <ImageUploadField
                  key={i}
                  label={`Photo galerie ${i + 1}`}
                  value={photo}
                  onChange={(url) => setPhoto(i, url)}
                />
              ))}
            </div>
          </div>

          {/* ── POINTS FORTS ── */}
          <div className="adm-card">
            <div className="adm-card__header">
              <h3 className="adm-card__title">Points forts (3 cartes)</h3>
            </div>
            <div className="admprog-highlights-grid">
              {prog.highlights.map((h, i) => (
                <div key={i} className="admprog-highlight-card">
                  <span className="admprog-highlight-num" style={{ background: prog.accent + "22", color: prog.primary }}>
                    {i + 1}
                  </span>
                  <label className="adm-form-field adm-form-field--full">
                    <span className="adm-form-field__label">Titre</span>
                    <input
                      className="adm-form-field__input"
                      value={h.title}
                      onChange={(e) => setHighlight(i, "title", e.target.value)}
                    />
                  </label>
                  <label className="adm-form-field adm-form-field--full">
                    <span className="adm-form-field__label">Texte</span>
                    <textarea
                      className="adm-form-field__input"
                      rows={2}
                      value={h.text}
                      onChange={(e) => setHighlight(i, "text", e.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ── COULEURS ── */}
          <div className="adm-card">
            <div className="adm-card__header">
              <h3 className="adm-card__title">Couleurs</h3>
            </div>
            <div className="adm-form-grid">
              {(
                [
                  { key: "primary", label: "Couleur principale" },
                  { key: "primaryDark", label: "Couleur principale foncée" },
                  { key: "accent", label: "Couleur accent" },
                  { key: "accentText", label: "Texte sur accent" },
                ] as { key: keyof ProgrammeConfig; label: string }[]
              ).map(({ key, label }) => (
                <label key={key} className="adm-form-field">
                  <span className="adm-form-field__label">{label}</span>
                  <div className="admprog-color-row">
                    <input
                      type="color"
                      value={prog[key] as string}
                      onChange={(e) => onChange({ [key]: e.target.value })}
                      className="admprog-color-swatch"
                    />
                    <input
                      className="adm-form-field__input"
                      value={prog[key] as string}
                      onChange={(e) => onChange({ [key]: e.target.value })}
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default function AdminProgrammesPage() {
  const [programmes, setProgrammes] = useState<ProgrammeConfig[]>(DEFAULT_PROGRAMMES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicSiteContent()
      .then((data) => {
        if (data.programmes?.length) {
          setProgrammes(
            DEFAULT_PROGRAMMES.map((def) => {
              const api = data.programmes.find((p) => p.id === def.id);
              return api ? { ...def, ...api } : def;
            }),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function updateProg(id: string, patch: Partial<ProgrammeConfig>) {
    setProgrammes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSiteContent({ programmes: JSON.stringify(programmes) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silently ignore — user will retry
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="adm-empty">Chargement…</p>;

  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Contenu du site</p>
          <h1 className="adm-page-title">Programmes</h1>
          <p className="adm-page-desc">
            Modifiez les textes, images et couleurs de chaque onglet de la page Programmes.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="admprog-list">
          {programmes.map((prog) => (
            <ProgrammeAccordion
              key={prog.id}
              prog={prog}
              open={openId === prog.id}
              onToggle={() => setOpenId((id) => (id === prog.id ? null : prog.id))}
              onChange={(patch) => updateProg(prog.id, patch)}
            />
          ))}
        </div>

        <div className="adm-form-footer" style={{ marginTop: "1.5rem" }}>
          <button
            type="submit"
            className="adm-btn adm-btn--primary"
            disabled={saving}
          >
            <Save size={15} />
            {saving ? "Enregistrement…" : saved ? "Enregistré ✓" : "Enregistrer tous les programmes"}
          </button>
        </div>
      </form>
    </div>
  );
}
