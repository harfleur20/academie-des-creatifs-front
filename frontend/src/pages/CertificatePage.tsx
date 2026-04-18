import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaDownload, FaArrowLeft, FaMedal } from "react-icons/fa";

import { fetchCertificate, type CertificateView } from "../lib/catalogApi";

function getFormatLabel(formatType: string) {
  if (formatType === "ligne") return "En ligne";
  if (formatType === "presentiel") return "Présentiel";
  return "Live";
}

export default function CertificatePage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [cert, setCert] = useState<CertificateView | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = Number.parseInt(enrollmentId ?? "", 10);
    if (!Number.isInteger(id)) {
      navigate("/espace/etudiant", { replace: true });
      return;
    }
    fetchCertificate(id)
      .then(setCert)
      .catch(() => setError("Certificat non disponible pour cette inscription."))
      .finally(() => setIsLoading(false));
  }, [enrollmentId, navigate]);

  if (isLoading) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Certificat</p>
          <h1>Chargement…</h1>
        </section>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="page page--narrow">
        <section className="auth-card auth-card--centered">
          <p className="eyebrow">Certificat</p>
          <h1>Non disponible</h1>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
            {error || "Ce certificat n'est pas encore disponible."}
          </p>
          <Link className="button button--secondary" to="/espace/etudiant">
            Retour à mon espace
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page cert-page">
      {/* ── Actions bar (hidden when printing) ── */}
      <div className="cert-actions no-print">
        <Link className="cert-actions__back" to="/espace/etudiant">
          <FaArrowLeft /> Retour à mon espace
        </Link>
        <button
          type="button"
          className="button button--primary"
          onClick={() => window.print()}
        >
          <FaDownload /> Télécharger / Imprimer
        </button>
      </div>

      {/* ── Certificate ── */}
      <div className="cert-wrapper">
        <div className="cert-document">

          {/* Top decorative bar */}
          <div className="cert-bar cert-bar--top" />

          {/* Header */}
          <header className="cert-header">
            <div className="cert-logo-area">
              <FaMedal className="cert-logo-icon" />
              <div>
                <p className="cert-school">Académie des Créatifs</p>
                <p className="cert-school-sub">Excellence · Créativité · Avenir</p>
              </div>
            </div>
            <div className="cert-type">
              <h1>Certificat de Complétion</h1>
            </div>
          </header>

          {/* Divider ornament */}
          <div className="cert-ornament">
            <span />
            <span className="cert-ornament__diamond" />
            <span />
          </div>

          {/* Body */}
          <div className="cert-body">
            <p className="cert-body__intro">Ce certificat est décerné à</p>
            <p className="cert-recipient">{cert.student_name}</p>
            <p className="cert-body__mid">
              pour avoir complété avec succès la formation
            </p>
            <p className="cert-formation">{cert.formation_title}</p>
            <div className="cert-meta">
              <span className="cert-meta__tag">{getFormatLabel(cert.format_type)}</span>
              {cert.level && (
                <span className="cert-meta__tag">{cert.level}</span>
              )}
              {cert.session_label && (
                <span className="cert-meta__tag">{cert.session_label}</span>
              )}
            </div>
          </div>

          {/* Divider ornament */}
          <div className="cert-ornament">
            <span />
            <span className="cert-ornament__diamond" />
            <span />
          </div>

          {/* Footer: signatures + date */}
          <footer className="cert-footer">
            <div className="cert-sig">
              <div className="cert-sig__line" />
              <p className="cert-sig__name">{cert.mentor_name || "Équipe pédagogique"}</p>
              <p className="cert-sig__role">Formateur référent</p>
            </div>

            <div className="cert-seal">
              <div className="cert-seal__circle">
                <FaMedal />
                <span>Validé</span>
              </div>
            </div>

            <div className="cert-sig">
              <div className="cert-sig__line" />
              <p className="cert-sig__name">Direction Académique</p>
              <p className="cert-sig__role">Académie des Créatifs</p>
            </div>
          </footer>

          {/* Date + certificate number */}
          <div className="cert-footnote">
            <span>Émis le {cert.issued_date}</span>
            <span>N° {cert.certificate_number}</span>
          </div>

          {/* Bottom decorative bar */}
          <div className="cert-bar cert-bar--bottom" />
        </div>
      </div>
    </div>
  );
}
