import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes } from "react-icons/fa";
import { useToast } from "../../toast/ToastContext";

import {
  fetchSiteConfig,
  updateSiteConfig,
  updateSiteContent,
  uploadAdminAsset,
  type SiteConfig,
} from "../../lib/catalogApi";
import {
  fetchPublicSiteContent,
  DEFAULT_HERO_SLIDE_ITEMS,
  DEFAULT_HERO_COUNTER_ITEMS,
  type TestimonialItem,
  type AlbumItem,
  type HeroSlideItem,
  type HeroCounterItem,
  type BadgeLevelItem,
  type TrainerProfile,
} from "../../lib/siteContentApi";

const siteTabs = [
  { to: "/admin/site/general",      label: "Général" },
  { to: "/admin/site/banniere",     label: "Bannière" },
  { to: "/admin/site/theme",        label: "Thème & couleurs" },
  { to: "/admin/site/sections",     label: "Sections du site" },
  { to: "/admin/site/programmes",   label: "Programmes" },
];

export default function AdminSitePage() {
  return (
    <div className="adm-workspace">
      <div className="adm-page-header">
        <div>
          <p className="adm-eyebrow">Configuration</p>
          <h1 className="adm-page-title">Paramètres du site</h1>
          <p className="adm-page-desc">Personnalisez le logo, la bannière et les couleurs de la plateforme.</p>
        </div>
      </div>

      <div className="adm-tabs">
        {siteTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `adm-tab${isActive ? " is-active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}

/* ── Shared hook ─────────────────────────────────────── */
function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    fetchSiteConfig()
      .then(setConfig)
      .catch(() => toastError("Impossible de charger la configuration."))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch: SiteConfig) {
    setSaving(true);
    try {
      const next = await updateSiteConfig(patch);
      setConfig(next);
      success("Modifications enregistrées avec succès.");
    } catch {
      toastError("Erreur lors de la sauvegarde. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  }

  return { config, loading, saving, save };
}

/* ── General ─────────────────────────────────────────── */
export function AdminSiteGeneralPage() {
  const { config, loading, saving, save } = useSiteConfig();
  const [siteName, setSiteName]     = useState("");
  const [tagline, setTagline]       = useState("");
  const [seoDesc, setSeoDesc]       = useState("");
  const [logoPreview, setLogoPreview]       = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const logoRef    = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  /* Populate form when config loads */
  useEffect(() => {
    if (!loading) {
      setSiteName(config.site_name ?? "Académie des Créatifs");
      setTagline(config.tagline ?? "Formez-vous. Créez. Évoluez.");
      setSeoDesc(config.seo_description ?? "");
      if (config.logo_url)    setLogoPreview(config.logo_url);
      if (config.favicon_url) setFaviconPreview(config.favicon_url);
    }
  }, [loading]);

  async function handleFileUpload(
    file: File,
    onDone: (url: string) => void,
  ) {
    setUploading(true);
    try {
      const asset = await uploadAdminAsset(file);
      onDone(asset.public_url);
    } catch {
      /* ignore upload error */
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await save({
      site_name:       siteName,
      tagline:         tagline,
      seo_description: seoDesc,
      logo_url:        logoPreview ?? "",
      favicon_url:     faviconPreview ?? "",
    });
  }

  if (loading) return <p className="adm-empty">Chargement…</p>;

  return (
    <form className="adm-site-form" onSubmit={(e) => { void handleSave(e); }}>
      <div className="adm-site-grid">
        {/* Logo */}
        <div className="adm-card">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Logo principal</h2>
            <p className="adm-card__desc">Format recommandé : PNG transparent, 200×60px minimum.</p>
          </div>
          <div className="adm-upload-zone">
            <div className="adm-upload-zone__preview">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" />
                : <img src="/logo_academie_hd.png" alt="Logo actuel" />}
            </div>
            <label className="adm-upload-btn">
              <input
                type="file" accept="image/*" hidden ref={logoRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file, (url) => setLogoPreview(url));
                }}
              />
              {uploading ? "Upload…" : "Choisir un fichier"}
            </label>
            <p className="adm-upload-hint">PNG, SVG, JPG · max 2 Mo</p>
          </div>
        </div>

        {/* Favicon */}
        <div className="adm-card">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Favicon</h2>
            <p className="adm-card__desc">Icône affichée dans l'onglet du navigateur. Format carré : 32×32px.</p>
          </div>
          <div className="adm-upload-zone">
            <div className="adm-upload-zone__preview adm-upload-zone__preview--sm">
              {faviconPreview
                ? <img src={faviconPreview} alt="Favicon" />
                : <div className="adm-upload-zone__placeholder">Aucun</div>}
            </div>
            <label className="adm-upload-btn">
              <input
                type="file" accept="image/*" hidden ref={faviconRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file, (url) => setFaviconPreview(url));
                }}
              />
              {uploading ? "Upload…" : "Choisir un fichier"}
            </label>
            <p className="adm-upload-hint">ICO, PNG · max 512 Ko</p>
          </div>
        </div>

        {/* Infos générales */}
        <div className="adm-card adm-card--wide">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Informations générales</h2>
          </div>
          <div className="adm-form-grid">
            <label className="adm-form-field">
              <span>Nom du site</span>
              <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </label>
            <label className="adm-form-field">
              <span>Tagline / Sous-titre</span>
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </label>
            <label className="adm-form-field adm-form-field--full">
              <span>Description SEO</span>
              <textarea
                rows={3}
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                placeholder="Description courte pour les moteurs de recherche…"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="adm-form-footer">
        <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/* ── Bannière ─────────────────────────────────────────── */
export function AdminSiteBannierePage() {
  const { config, loading, saving, save } = useSiteConfig();
  const [bannerTitle,    setBannerTitle]    = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [bannerCta,      setBannerCta]      = useState("");
  const [bannerImage,    setBannerImage]    = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setBannerTitle(config.banner_title    ?? "Formez-vous avec les meilleurs");
      setBannerSubtitle(config.banner_subtitle ?? "Découvrez nos formations en ligne, en live et en présentiel.");
      setBannerCta(config.banner_cta        ?? "Découvrir le catalogue");
      if (config.banner_image_url) setBannerImage(config.banner_image_url);
    }
  }, [loading]);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const asset = await uploadAdminAsset(file);
      setBannerImage(asset.public_url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await save({
      banner_title:     bannerTitle,
      banner_subtitle:  bannerSubtitle,
      banner_cta:       bannerCta,
      banner_image_url: bannerImage ?? "",
    });
  }

  if (loading) return <p className="adm-empty">Chargement…</p>;

  return (
    <form className="adm-site-form" onSubmit={(e) => { void handleSave(e); }}>
      <div className="adm-site-grid">
        <div className="adm-card adm-card--wide">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Textes de la bannière</h2>
          </div>
          <div className="adm-form-grid">
            <label className="adm-form-field adm-form-field--full">
              <span>Titre principal</span>
              <input type="text" value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} />
            </label>
            <label className="adm-form-field adm-form-field--full">
              <span>Sous-titre</span>
              <textarea rows={2} value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} />
            </label>
            <label className="adm-form-field">
              <span>Texte du bouton CTA</span>
              <input type="text" value={bannerCta} onChange={(e) => setBannerCta(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Image de fond</h2>
            <p className="adm-card__desc">Format recommandé : 1440×600px, JPG ou WebP.</p>
          </div>
          <div className="adm-upload-zone">
            <div className="adm-upload-zone__preview adm-upload-zone__preview--wide">
              {bannerImage
                ? <img src={bannerImage} alt="Bannière" />
                : <div className="adm-upload-zone__placeholder">Aucune image sélectionnée</div>}
            </div>
            <label className="adm-upload-btn">
              <input
                type="file" accept="image/*" hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }}
              />
              {uploading ? "Upload…" : "Choisir une image"}
            </label>
            <p className="adm-upload-hint">JPG, WebP, PNG · max 5 Mo</p>
          </div>
        </div>

        {/* Prévisualisation */}
        <div className="adm-card adm-card--wide">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Prévisualisation</h2>
          </div>
          <div
            className="adm-banner-preview"
            style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : {}}
          >
            <div className="adm-banner-preview__content">
              <h2>{bannerTitle}</h2>
              <p>{bannerSubtitle}</p>
              <button type="button">{bannerCta}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="adm-form-footer">
        <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/* ── Thème ────────────────────────────────────────────── */
export function AdminSiteThemePage() {
  const { config, loading, saving, save } = useSiteConfig();
  const [primaryColor, setPrimaryColor] = useState("#1f2559");
  const [accentColor,  setAccentColor]  = useState("#18a7a3");
  const [fontHeading,  setFontHeading]  = useState("Space Grotesk");
  const [fontBody,     setFontBody]     = useState("Manrope");

  useEffect(() => {
    if (!loading) {
      setPrimaryColor(config.color_primary  ?? "#1f2559");
      setAccentColor(config.color_accent    ?? "#18a7a3");
      setFontHeading(config.font_heading    ?? "Space Grotesk");
      setFontBody(config.font_body          ?? "Manrope");
    }
  }, [loading]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await save({
      color_primary: primaryColor,
      color_accent:  accentColor,
      font_heading:  fontHeading,
      font_body:     fontBody,
    });
  }

  if (loading) return <p className="adm-empty">Chargement…</p>;

  return (
    <form className="adm-site-form" onSubmit={(e) => { void handleSave(e); }}>
      <div className="adm-site-grid">
        <div className="adm-card">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Palette de couleurs</h2>
          </div>
          <div className="adm-color-grid">
            <label className="adm-color-field">
              <span>Couleur principale</span>
              <div className="adm-color-input">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                <input type="text"  value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </label>
            <label className="adm-color-field">
              <span>Couleur d'accent</span>
              <div className="adm-color-input">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                <input type="text"  value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              </div>
            </label>
          </div>
          <div className="adm-color-preview">
            <div style={{ background: primaryColor }} className="adm-color-swatch">
              <span>Principal</span>
            </div>
            <div style={{ background: accentColor }} className="adm-color-swatch">
              <span>Accent</span>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card__header">
            <h2 className="adm-card__title">Typographie</h2>
          </div>
          <div className="adm-form-grid">
            <label className="adm-form-field">
              <span>Police des titres</span>
              <select value={fontHeading} onChange={(e) => setFontHeading(e.target.value)}>
                <option>Space Grotesk</option>
                <option>Inter</option>
                <option>Poppins</option>
                <option>Syne</option>
              </select>
            </label>
            <label className="adm-form-field">
              <span>Police du corps</span>
              <select value={fontBody} onChange={(e) => setFontBody(e.target.value)}>
                <option>Manrope</option>
                <option>Inter</option>
                <option>Poppins</option>
                <option>DM Sans</option>
              </select>
            </label>
          </div>
          <div className="adm-font-preview">
            <p style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: "1.4rem" }}>
              Titre avec {fontHeading}
            </p>
            <p style={{ fontFamily: fontBody }}>
              Corps de texte avec {fontBody} — lorem ipsum dolor sit amet consectetur.
            </p>
          </div>
        </div>
      </div>

      <div className="adm-form-footer">
        <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
          {saving ? "Application…" : "Appliquer le thème"}
        </button>
      </div>
    </form>
  );
}

/* ── Sections du site ────────────────────────────────── */

type TestimonialDraft = TestimonialItem & { _editing?: boolean };
type HeroSlideDraft = HeroSlideItem & { _editing?: boolean };
type TrainerDraft = TrainerProfile & { _editing?: boolean };
type BadgeDraft = BadgeLevelItem & { _editing?: boolean };
type SectionKey = "testimonials" | "album" | "videos" | "hero_slides" | "hero_counters" | "badge_levels" | "trainers";

function emptyTestimonial(): TestimonialDraft {
  return { name: "", role: "", detail: "", quote: "", image: "", _editing: true };
}

function emptyHeroSlide(): HeroSlideDraft {
  return {
    eyebrow: "", navLabel: "", title: "", titleEmphasis: "",
    description: "", image: "", imagePosition: "center center",
    cta1Label: "", cta1Url: "", cta1External: false,
    cta2Label: "", cta2Url: "", cta2External: false,
    _editing: true,
  };
}

function emptyHeroCounter(): HeroCounterItem {
  return { value: "", copy: "", icon: "graduation" };
}

function emptyBadge(): BadgeDraft {
  return { name: "", image: "", className: "", _editing: true };
}

function emptyTrainer(): TrainerDraft {
  return { name: "", image: "", role: "", label: "", _editing: true };
}

export function AdminSiteContentPage() {
  const [testimonials, setTestimonials] = useState<TestimonialDraft[]>([]);
  const [albumItems, setAlbumItems] = useState<AlbumItem[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlideDraft[]>([]);
  const [heroCounters, setHeroCounters] = useState<HeroCounterItem[]>([]);
  const [badgeLevels, setBadgeLevels] = useState<BadgeDraft[]>([]);
  const [trainers, setTrainers] = useState<TrainerDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const { success, error: toastError } = useToast();
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newAlbumUrl, setNewAlbumUrl] = useState("");
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    fetchPublicSiteContent()
      .then((data) => {
        setTestimonials(data.testimonials);
        setAlbumItems(data.album_items);
        setVideos(data.videos);
        setHeroSlides(data.hero_slides.length > 0 ? data.hero_slides : DEFAULT_HERO_SLIDE_ITEMS);
        setHeroCounters(data.hero_counters.length > 0 ? data.hero_counters : DEFAULT_HERO_COUNTER_ITEMS);
        setBadgeLevels(data.badge_levels);
        setTrainers(data.trainers);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveSection(section: SectionKey, value: unknown) {
    setSaving(section);
    try {
      const key = section === "album" ? "album_items" : section;
      await updateSiteContent({ [key]: JSON.stringify(value) });
      success("Section enregistrée avec succès.");
    } catch {
      toastError("Erreur lors de la sauvegarde. Veuillez réessayer.");
    } finally {
      setSaving(null);
    }
  }

  async function handleImgUpload(file: File, onDone: (url: string) => void) {
    setUploadingImg(true);
    try {
      const asset = await uploadAdminAsset(file);
      onDone(asset.public_url);
    } finally {
      setUploadingImg(false);
    }
  }

  function updateTestimonial(i: number, patch: Partial<TestimonialDraft>) {
    setTestimonials((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function updateHeroSlide(i: number, patch: Partial<HeroSlideDraft>) {
    setHeroSlides((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function updateHeroCounter(i: number, patch: Partial<HeroCounterItem>) {
    setHeroCounters((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function updateBadge(i: number, patch: Partial<BadgeDraft>) {
    setBadgeLevels((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function updateTrainer(i: number, patch: Partial<TrainerDraft>) {
    setTrainers((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  if (loading) return <p className="adm-empty">Chargement…</p>;

  return (
    <div className="adm-sections-page">

      {/* ── Témoignages ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Témoignages</h2>
            <p className="adm-card__desc">Carousel affiché sur la page d'accueil.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => setTestimonials((t) => [...t, emptyTestimonial()])}>
              <FaPlus /> Ajouter
            </button>
            <button
              className="adm-btn adm-btn--primary" type="button" disabled={saving === "testimonials"}
              onClick={() => void saveSection("testimonials", testimonials.map(({ _editing: _, ...t }) => t))}
            >
              <FaSave /> {saving === "testimonials" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>

        <div className="adm-sections-list">
          {testimonials.length === 0 && <p className="adm-empty">Aucun témoignage.</p>}
          {testimonials.map((t, i) => (
            <div key={i} className="adm-section-item">
              {t._editing ? (
                <div className="adm-section-item__form">
                  <div className="adm-section-item__form-grid">
                    <label className="adm-form-field">
                      <span>Nom</span>
                      <input type="text" value={t.name} onChange={(e) => updateTestimonial(i, { name: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>Rôle / Titre</span>
                      <input type="text" value={t.role} onChange={(e) => updateTestimonial(i, { role: e.target.value })} />
                    </label>
                    <label className="adm-form-field adm-form-field--full">
                      <span>Détail (ex: Ancienne étudiante de l'Académie…)</span>
                      <input type="text" value={t.detail} onChange={(e) => updateTestimonial(i, { detail: e.target.value })} />
                    </label>
                    <label className="adm-form-field adm-form-field--full">
                      <span>Citation</span>
                      <textarea rows={3} value={t.quote} onChange={(e) => updateTestimonial(i, { quote: e.target.value })} />
                    </label>
                    <div className="adm-form-field adm-form-field--full">
                      <span>Photo</span>
                      <div className="adm-section-item__img-row">
                        {t.image && <img src={t.image} alt={t.name} className="adm-section-item__thumb" />}
                        <label className="adm-btn adm-btn--ghost">
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImgUpload(f, (url) => updateTestimonial(i, { image: url })); e.target.value = ""; }} />
                          {uploadingImg ? "Upload…" : "📷 Choisir une photo"}
                        </label>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="adm-btn adm-btn--ghost" style={{ marginTop: "0.5rem" }} onClick={() => updateTestimonial(i, { _editing: false })}>
                    <FaTimes /> Fermer
                  </button>
                </div>
              ) : (
                <div className="adm-section-item__preview">
                  {t.image && <img src={t.image} alt={t.name} className="adm-section-item__thumb" />}
                  <div className="adm-section-item__info">
                    <strong>{t.name}</strong>
                    <span>{t.role} · {t.detail}</span>
                    <p>"{t.quote}"</p>
                  </div>
                  <div className="adm-section-item__btns">
                    <button type="button" className="adm-icon-btn adm-icon-btn--accent" onClick={() => updateTestimonial(i, { _editing: true })}><FaEdit /></button>
                    <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setTestimonials((arr) => arr.filter((_, j) => j !== i))}><FaTrash /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Galerie ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Galerie photos</h2>
            <p className="adm-card__desc">Album affiché sur la page d'accueil.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="adm-btn adm-btn--primary" type="button" disabled={saving === "album"} onClick={() => void saveSection("album", albumItems)}>
              <FaSave /> {saving === "album" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
        <div className="adm-sections-add-row">
          <input type="text" placeholder="Titre" value={newAlbumTitle} onChange={(e) => setNewAlbumTitle(e.target.value)} className="adm-sections-input" />
          <label className="adm-btn adm-btn--ghost">
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImgUpload(f, (url) => setNewAlbumUrl(url)); e.target.value = ""; }} />
            {uploadingImg ? "Upload…" : "📷 Upload image"}
          </label>
          {newAlbumUrl && <span style={{ fontSize: "0.75rem", color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{newAlbumUrl}</span>}
          <button type="button" className="adm-btn adm-btn--primary" disabled={!newAlbumUrl.trim()} onClick={() => { setAlbumItems((a) => [...a, { image: newAlbumUrl, title: newAlbumTitle }]); setNewAlbumUrl(""); setNewAlbumTitle(""); }}>
            <FaPlus /> Ajouter
          </button>
        </div>
        <div className="adm-sections-gallery">
          {albumItems.length === 0 && <p className="adm-empty">Aucune photo.</p>}
          {albumItems.map((item, i) => (
            <div key={i} className="adm-gallery-item">
              <img src={item.image} alt={item.title} />
              <div className="adm-gallery-item__overlay">
                <span>{item.title}</span>
                <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setAlbumItems((a) => a.filter((_, j) => j !== i))}><FaTrash /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Vidéos ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Vidéos</h2>
            <p className="adm-card__desc">URLs des vidéos affichées sur le site.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="adm-btn adm-btn--primary" type="button" disabled={saving === "videos"} onClick={() => void saveSection("videos", videos)}>
              <FaSave /> {saving === "videos" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
        <div className="adm-sections-add-row">
          <input type="text" placeholder="URL de la vidéo (YouTube embed…)" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} className="adm-sections-input" />
          <button type="button" className="adm-btn adm-btn--primary" disabled={!newVideoUrl.trim()} onClick={() => { setVideos((v) => [...v, newVideoUrl.trim()]); setNewVideoUrl(""); }}>
            <FaPlus /> Ajouter
          </button>
        </div>
        <div className="adm-sections-list">
          {videos.length === 0 && <p className="adm-empty">Aucune vidéo.</p>}
          {videos.map((url, i) => (
            <div key={i} className="adm-section-item adm-section-item--video">
              <span className="adm-section-item__url">{url}</span>
              <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setVideos((v) => v.filter((_, j) => j !== i))}><FaTrash /></button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Slides Hero ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Slides du hero</h2>
            <p className="adm-card__desc">Carrousel principal en haut de la page d'accueil. Si vide, les slides par défaut sont utilisés.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => setHeroSlides((s) => [...s, emptyHeroSlide()])}>
              <FaPlus /> Ajouter
            </button>
            <button className="adm-btn adm-btn--primary" type="button" disabled={saving === "hero_slides"}
              onClick={() => void saveSection("hero_slides", heroSlides.map(({ _editing: _, ...s }) => s))}>
              <FaSave /> {saving === "hero_slides" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
        <div className="adm-sections-list">
          {heroSlides.length === 0 && <p className="adm-empty">Aucun slide.</p>}
          {heroSlides.map((slide, i) => (
            <div key={i} className="adm-section-item">
              {slide._editing ? (
                <div className="adm-section-item__form">
                  <div className="adm-section-item__form-grid">
                    <label className="adm-form-field">
                      <span>Label nav (court)</span>
                      <input type="text" value={slide.navLabel} placeholder="ex: Formations" onChange={(e) => updateHeroSlide(i, { navLabel: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>Position image</span>
                      <select value={slide.imagePosition} onChange={(e) => updateHeroSlide(i, { imagePosition: e.target.value })}>
                        <option value="center center">Centre</option>
                        <option value="center top">Haut</option>
                        <option value="center bottom">Bas</option>
                        <option value="center 25%">1/4 haut</option>
                        <option value="center 35%">1/3 haut</option>
                        <option value="center 75%">3/4 bas</option>
                      </select>
                    </label>
                    <label className="adm-form-field adm-form-field--full">
                      <span>Eyebrow (texte au-dessus du titre)</span>
                      <input type="text" value={slide.eyebrow} onChange={(e) => updateHeroSlide(i, { eyebrow: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>Titre — partie normale</span>
                      <input type="text" value={slide.title} placeholder="ex: Apprends les métiers du digital" onChange={(e) => updateHeroSlide(i, { title: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>Titre — partie en évidence (span)</span>
                      <input type="text" value={slide.titleEmphasis} placeholder="ex: par la pratique" onChange={(e) => updateHeroSlide(i, { titleEmphasis: e.target.value })} />
                    </label>
                    <label className="adm-form-field adm-form-field--full">
                      <span>Description</span>
                      <textarea rows={2} value={slide.description} onChange={(e) => updateHeroSlide(i, { description: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>CTA 1 — Texte</span>
                      <input type="text" value={slide.cta1Label} onChange={(e) => updateHeroSlide(i, { cta1Label: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>CTA 1 — URL</span>
                      <input type="text" value={slide.cta1Url} placeholder="/formations ou https://…" onChange={(e) => updateHeroSlide(i, { cta1Url: e.target.value })} />
                    </label>
                    <label className="adm-form-field adm-form-field--checkbox">
                      <input type="checkbox" checked={slide.cta1External} onChange={(e) => updateHeroSlide(i, { cta1External: e.target.checked })} />
                      <span>CTA 1 — lien externe (nouvelle fenêtre)</span>
                    </label>
                    <label className="adm-form-field">
                      <span>CTA 2 — Texte</span>
                      <input type="text" value={slide.cta2Label} onChange={(e) => updateHeroSlide(i, { cta2Label: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>CTA 2 — URL</span>
                      <input type="text" value={slide.cta2Url} onChange={(e) => updateHeroSlide(i, { cta2Url: e.target.value })} />
                    </label>
                    <label className="adm-form-field adm-form-field--checkbox">
                      <input type="checkbox" checked={slide.cta2External} onChange={(e) => updateHeroSlide(i, { cta2External: e.target.checked })} />
                      <span>CTA 2 — lien externe (nouvelle fenêtre)</span>
                    </label>
                    <div className="adm-form-field adm-form-field--full">
                      <span>Image de fond</span>
                      <div className="adm-section-item__img-row">
                        {slide.image && <img src={slide.image} alt="Slide" className="adm-section-item__thumb adm-section-item__thumb--wide" />}
                        <label className="adm-btn adm-btn--ghost">
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImgUpload(f, (url) => updateHeroSlide(i, { image: url })); e.target.value = ""; }} />
                          {uploadingImg ? "Upload…" : "📷 Choisir une image"}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <button type="button" className="adm-btn adm-btn--ghost" onClick={() => updateHeroSlide(i, { _editing: false })}><FaTimes /> Fermer</button>
                    <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setHeroSlides((arr) => arr.filter((_, j) => j !== i))}><FaTrash /></button>
                  </div>
                </div>
              ) : (
                <div className="adm-section-item__preview">
                  {slide.image && <img src={slide.image} alt={slide.navLabel} className="adm-section-item__thumb adm-section-item__thumb--wide" />}
                  <div className="adm-section-item__info">
                    <strong>{slide.navLabel}</strong>
                    <span>{slide.eyebrow}</span>
                    <p>«{slide.title}{slide.titleEmphasis ? ` ${slide.titleEmphasis}` : ""}»</p>
                  </div>
                  <div className="adm-section-item__btns">
                    <button type="button" className="adm-icon-btn adm-icon-btn--accent" onClick={() => updateHeroSlide(i, { _editing: true })}><FaEdit /></button>
                    <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setHeroSlides((arr) => arr.filter((_, j) => j !== i))}><FaTrash /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Compteurs ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Compteurs (chiffres clés)</h2>
            <p className="adm-card__desc">Bande de statistiques juste sous le slider. Si vide, les valeurs par défaut sont actives.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            {heroCounters.length < 6 && (
              <button className="adm-btn adm-btn--ghost" type="button" onClick={() => setHeroCounters((c) => [...c, emptyHeroCounter()])}>
                <FaPlus /> Ajouter
              </button>
            )}
            <button className="adm-btn adm-btn--primary" type="button" disabled={saving === "hero_counters"}
              onClick={() => void saveSection("hero_counters", heroCounters)}>
              <FaSave /> {saving === "hero_counters" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
        {heroCounters.length === 0 && <p className="adm-empty" style={{ padding: "1rem 1.25rem" }}>Aucun compteur.</p>}
        <div className="adm-counters-grid">
          {heroCounters.map((counter, i) => (
            <div key={i} className="adm-counter-item">
              <label className="adm-form-field adm-form-field--full">
                <span>Valeur (ex: +2000, 24h)</span>
                <input type="text" value={counter.value} onChange={(e) => updateHeroCounter(i, { value: e.target.value })} />
              </label>
              <label className="adm-form-field">
                <span>Icône</span>
                <select value={counter.icon} onChange={(e) => updateHeroCounter(i, { icon: e.target.value })}>
                  <option value="graduation">Diplôme</option>
                  <option value="lightning">Éclair</option>
                  <option value="gauge">Jauge</option>
                  <option value="check">Checklist</option>
                  <option value="trophy">Trophée</option>
                  <option value="users">Équipe</option>
                  <option value="rocket">Fusée</option>
                </select>
              </label>
              <label className="adm-form-field adm-form-field--full">
                <span>Description</span>
                <input type="text" value={counter.copy} onChange={(e) => updateHeroCounter(i, { copy: e.target.value })} />
              </label>
              <button type="button" className="adm-icon-btn adm-icon-btn--danger adm-counter-item__del" onClick={() => setHeroCounters((c) => c.filter((_, j) => j !== i))}>
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Badges ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Badges de progression</h2>
            <p className="adm-card__desc">Affichés dans la section "Nos badges de progression".</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => setBadgeLevels((b) => [...b, emptyBadge()])}>
              <FaPlus /> Ajouter
            </button>
            <button className="adm-btn adm-btn--primary" type="button" disabled={saving === "badge_levels"}
              onClick={() => void saveSection("badge_levels", badgeLevels.map(({ _editing: _, ...b }) => b))}>
              <FaSave /> {saving === "badge_levels" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
        <div className="adm-sections-list">
          {badgeLevels.length === 0 && <p className="adm-empty">Aucun badge.</p>}
          {badgeLevels.map((badge, i) => (
            <div key={i} className="adm-section-item">
              {badge._editing ? (
                <div className="adm-section-item__form">
                  <div className="adm-section-item__form-grid">
                    <label className="adm-form-field">
                      <span>Nom du badge</span>
                      <input type="text" value={badge.name} placeholder="ex: Bronze, Argent, Or…" onChange={(e) => updateBadge(i, { name: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>Classe CSS</span>
                      <input type="text" value={badge.className} placeholder="ex: badge-bronze" onChange={(e) => updateBadge(i, { className: e.target.value })} />
                    </label>
                    <div className="adm-form-field adm-form-field--full">
                      <span>Image du badge</span>
                      <div className="adm-section-item__img-row">
                        {badge.image && <img src={badge.image} alt={badge.name} className="adm-section-item__thumb" />}
                        <label className="adm-btn adm-btn--ghost">
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImgUpload(f, (url) => updateBadge(i, { image: url })); e.target.value = ""; }} />
                          {uploadingImg ? "Upload…" : "📷 Choisir une image"}
                        </label>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="adm-btn adm-btn--ghost" style={{ marginTop: "0.5rem" }} onClick={() => updateBadge(i, { _editing: false })}><FaTimes /> Fermer</button>
                </div>
              ) : (
                <div className="adm-section-item__preview">
                  {badge.image && <img src={badge.image} alt={badge.name} className="adm-section-item__thumb" />}
                  <div className="adm-section-item__info">
                    <strong>{badge.name}</strong>
                    <code className="adm-code">{badge.className}</code>
                  </div>
                  <div className="adm-section-item__btns">
                    <button type="button" className="adm-icon-btn adm-icon-btn--accent" onClick={() => updateBadge(i, { _editing: true })}><FaEdit /></button>
                    <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setBadgeLevels((arr) => arr.filter((_, j) => j !== i))}><FaTrash /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Formateurs ── */}
      <div className="adm-card adm-card--wide">
        <div className="adm-card__header">
          <div>
            <h2 className="adm-card__title">Formateurs</h2>
            <p className="adm-card__desc">Section "Formateurs" visible sur la page d'accueil uniquement si au moins 1 formateur est renseigné.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => setTrainers((t) => [...t, emptyTrainer()])}>
              <FaPlus /> Ajouter
            </button>
            <button className="adm-btn adm-btn--primary" type="button" disabled={saving === "trainers"}
              onClick={() => void saveSection("trainers", trainers.map(({ _editing: _, ...t }) => t))}>
              <FaSave /> {saving === "trainers" ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
        <div className="adm-sections-list">
          {trainers.length === 0 && <p className="adm-empty">Aucun formateur — la section sera masquée sur le site.</p>}
          {trainers.map((trainer, i) => (
            <div key={i} className="adm-section-item">
              {trainer._editing ? (
                <div className="adm-section-item__form">
                  <div className="adm-section-item__form-grid">
                    <label className="adm-form-field">
                      <span>Nom</span>
                      <input type="text" value={trainer.name} onChange={(e) => updateTrainer(i, { name: e.target.value })} />
                    </label>
                    <label className="adm-form-field">
                      <span>Rôle / Spécialité</span>
                      <input type="text" value={trainer.role} placeholder="ex: Formateur UI/UX" onChange={(e) => updateTrainer(i, { role: e.target.value })} />
                    </label>
                    <label className="adm-form-field adm-form-field--full">
                      <span>Label court (ex: 5 ans d'expérience)</span>
                      <input type="text" value={trainer.label} onChange={(e) => updateTrainer(i, { label: e.target.value })} />
                    </label>
                    <div className="adm-form-field adm-form-field--full">
                      <span>Photo</span>
                      <div className="adm-section-item__img-row">
                        {trainer.image && <img src={trainer.image} alt={trainer.name} className="adm-section-item__thumb" />}
                        <label className="adm-btn adm-btn--ghost">
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImgUpload(f, (url) => updateTrainer(i, { image: url })); e.target.value = ""; }} />
                          {uploadingImg ? "Upload…" : "📷 Choisir une photo"}
                        </label>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="adm-btn adm-btn--ghost" style={{ marginTop: "0.5rem" }} onClick={() => updateTrainer(i, { _editing: false })}><FaTimes /> Fermer</button>
                </div>
              ) : (
                <div className="adm-section-item__preview">
                  {trainer.image && <img src={trainer.image} alt={trainer.name} className="adm-section-item__thumb" />}
                  <div className="adm-section-item__info">
                    <strong>{trainer.name}</strong>
                    <span>{trainer.role}</span>
                    <p>{trainer.label}</p>
                  </div>
                  <div className="adm-section-item__btns">
                    <button type="button" className="adm-icon-btn adm-icon-btn--accent" onClick={() => updateTrainer(i, { _editing: true })}><FaEdit /></button>
                    <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => setTrainers((arr) => arr.filter((_, j) => j !== i))}><FaTrash /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
