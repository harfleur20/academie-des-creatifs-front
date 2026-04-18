import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import {
  fetchSiteConfig,
  updateSiteConfig,
  uploadAdminAsset,
  type SiteConfig,
} from "../../lib/catalogApi";

const siteTabs = [
  { to: "/admin/site/general",  label: "Général" },
  { to: "/admin/site/banniere", label: "Bannière" },
  { to: "/admin/site/theme",    label: "Thème & couleurs" },
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSiteConfig()
      .then(setConfig)
      .catch(() => setError("Impossible de charger la configuration."))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch: SiteConfig) {
    setSaving(true);
    setError("");
    try {
      const next = await updateSiteConfig(patch);
      setConfig(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  return { config, loading, saving, saved, error, save };
}

/* ── General ─────────────────────────────────────────── */
export function AdminSiteGeneralPage() {
  const { config, loading, saving, saved, error, save } = useSiteConfig();
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
        {error  && <span className="adm-feedback adm-feedback--error">{error}</span>}
        {saved  && <span className="adm-feedback adm-feedback--success">Modifications enregistrées ✓</span>}
        <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/* ── Bannière ─────────────────────────────────────────── */
export function AdminSiteBannierePage() {
  const { config, loading, saving, saved, error, save } = useSiteConfig();
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
        {error && <span className="adm-feedback adm-feedback--error">{error}</span>}
        {saved && <span className="adm-feedback adm-feedback--success">Modifications enregistrées ✓</span>}
        <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/* ── Thème ────────────────────────────────────────────── */
export function AdminSiteThemePage() {
  const { config, loading, saving, saved, error, save } = useSiteConfig();
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
        {error && <span className="adm-feedback adm-feedback--error">{error}</span>}
        {saved && <span className="adm-feedback adm-feedback--success">Thème enregistré ✓</span>}
        <button className="adm-btn adm-btn--primary" type="submit" disabled={saving}>
          {saving ? "Application…" : "Appliquer le thème"}
        </button>
      </div>
    </form>
  );
}
