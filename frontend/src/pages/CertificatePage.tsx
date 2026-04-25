import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaDownload,
  FaFacebookF,
  FaLinkedin,
  FaShieldAlt,
  FaTwitter,
  FaWhatsapp,
} from "react-icons/fa";
import { useReactToPrint } from "react-to-print";

import certificateBadgeImage from "../assets/brand/badge-certificat.png";
import CertificateQrCode from "../components/CertificateQrCode";
import { fetchCertificate, type CertificateView } from "../lib/catalogApi";
import "../styles/certificate.css";

function getFormatLabel(formatType: string) {
  if (formatType === "ligne") return "En ligne";
  if (formatType === "presentiel") return "Présentiel";
  return "Live";
}

type CertificateDocumentProps = {
  cert: CertificateView;
};

const CERTIFICATE_SECURITY_BAND =
  "ACADEMIE DES CREATIFS • ACADEMIE DES CREATIFS • ACADEMIE DES CREATIFS";

function getVerificationUrl(cert: CertificateView) {
  if (cert.verification_url) return cert.verification_url;
  if (cert.verification_path && typeof window !== "undefined") {
    return `${window.location.origin}${cert.verification_path}`;
  }
  return "https://academie-des-creatifs.local/certificats/verifier/apercu";
}

function buildShareText(cert: CertificateView, shareUrl: string) {
  return [
    "J'ai obtenu mon certificat de fin de formation à l'Académie des Créatifs.",
    `Étudiant : ${cert.student_name}`,
    `Matricule : ${cert.student_code ?? "Non attribué"}`,
    `Formation : ${cert.formation_title}`,
    `ID certificat : ${cert.certificate_number}`,
    "Lien de vérification :",
    shareUrl,
  ].join("\n");
}

const CERTIFICATE_PRINT_STYLE = `
  @page { size: A4 landscape; margin: 0; }

  @media print {
    html,
    body {
      width: 297mm !important;
      height: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      display: block !important;
    }

    .cert-document {
      width: 297mm !important;
      min-width: 297mm !important;
      max-width: none !important;
      height: 210mm !important;
      margin: 0 !important;
      aspect-ratio: auto !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }
  }
`;

export function CertificateDocument({ cert }: CertificateDocumentProps) {
  const verificationPath = cert.verification_path;
  const verificationUrl = getVerificationUrl(cert);
  const shareUrl = cert.share_url || verificationUrl;
  const shareText = buildShareText(cert, shareUrl);
  const encodedShareText = encodeURIComponent(shareText);
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareTitle = encodeURIComponent(
    `Certificat de ${cert.student_name} - ${cert.formation_title}`,
  );
  const certificateRef = useRef<HTMLElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: certificateRef,
    documentTitle: `Certificat - ${cert.student_name}`,
    pageStyle: CERTIFICATE_PRINT_STYLE,
  });

  return (
    <div className="page cert-page">
      <div className="cert-actions no-print">
        <div className="cert-share" aria-label="Partager le certificat">
          <span className="cert-share__label">Partager</span>
          <a
            className="cert-share__link cert-share__link--whatsapp"
            href={`https://wa.me/?text=${encodedShareText}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Partager le certificat sur WhatsApp"
            title="WhatsApp"
          >
            <FaWhatsapp />
          </a>
          <a
            className="cert-share__link cert-share__link--facebook"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}&quote=${encodedShareText}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Partager le certificat sur Facebook"
            title="Facebook"
          >
            <FaFacebookF />
          </a>
          <a
            className="cert-share__link cert-share__link--linkedin"
            href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedShareUrl}&title=${encodedShareTitle}&summary=${encodedShareText}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Partager le certificat sur LinkedIn"
            title="LinkedIn"
          >
            <FaLinkedin />
          </a>
          <a
            className="cert-share__link cert-share__link--twitter"
            href={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Partager le certificat sur X"
            title="X"
          >
            <FaTwitter />
          </a>
        </div>
        <div className="cert-actions__buttons">
          {verificationPath ? (
            <Link className="button button--secondary" to={verificationPath}>
              Vérifier <FaShieldAlt />
            </Link>
          ) : null}
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handlePrint()}
          >
            Télécharger / imprimer <FaDownload />
          </button>
        </div>
      </div>

      <div className="cert-wrapper">
        <article
          ref={certificateRef}
          className="cert-document cert-document--official"
          aria-label="Attestation de fin de formation"
        >
          <div className="cert-ribbon cert-ribbon--top-right" />
          <div className="cert-ribbon cert-ribbon--top-left" />
          <div className="cert-ribbon cert-ribbon--bottom-left" />
          <div className="cert-ribbon cert-ribbon--bottom-right" />
          <div className="cert-pattern" aria-hidden="true" />
          <div className="cert-security-bands" aria-hidden="true">
            <span>{CERTIFICATE_SECURITY_BAND}</span>
            <span>{CERTIFICATE_SECURITY_BAND}</span>
            <span>{CERTIFICATE_SECURITY_BAND}</span>
            <span>{CERTIFICATE_SECURITY_BAND}</span>
          </div>

          <div className="cert-medal" aria-hidden="true">
            <img src={certificateBadgeImage} className="cert-medal__image" alt="" />
          </div>

          <div className="cert-inner">
            <header className="cert-header">
              <img
                className="cert-brand-logo"
                src="/logo_academie_hd.png"
                alt="Académie des Créatifs"
              />
              <div className="cert-title-block">
                <h1>Attestation</h1>
                <div className="cert-subtitle">
                  <span />
                  <strong>de fin de formation</strong>
                  <span />
                </div>
              </div>
            </header>

            <section className="cert-body">
              <p className="cert-body__intro">
                Cette attestation est fièrement décernée à
              </p>
              <p className="cert-recipient">{cert.student_name}</p>
              <div className="cert-recipient-line" />
              <p className="cert-body__copy">
                {cert.formation_duration ? (
                  <>
                    pour avoir suivi pendant{" "}
                    <strong>{cert.formation_duration}</strong> et validé avec
                    succès les notions et épreuves de notre formation complète
                    et pratique en <strong>{cert.formation_title}</strong>.
                  </>
                ) : (
                  <>
                    pour avoir suivi et validé avec succès les notions et
                    épreuves de notre formation complète et pratique en{" "}
                    <strong>{cert.formation_title}</strong>.
                  </>
                )}
              </p>
              <p className="cert-body__copy cert-body__copy--legal">
                En foi de quoi lui est décernée cette attestation pour servir
                et valoir ce que de droit.
              </p>
              {/* <div className="cert-meta">
                <span>{getFormatLabel(cert.format_type)}</span>
                {cert.level ? <span>{cert.level}</span> : null}
                {cert.session_label ? <span>{cert.session_label}</span> : null}
              </div> */}
            </section>

            <footer className="cert-footer">
              <div className="cert-signature cert-signature--academy">
                <img
                  src="/signature_KenneTsasse_academie.png" className="signal-logo-ac"
                  alt="Signature du responsable de l'académie"
                />
                <div className="cert-signature__line" />
                <p>Signature Responsable de l'Académie des Créatifs</p>
              </div>

              <div className="cert-company">
                <img
                  src="/logo%20five%20groupe%20sarl.png"
                  alt="Five Design Group"
                />
                <strong>RCCM : RC/DLA/2023/B/5645</strong>
                <strong>NUI : M092316045001P</strong>
              </div>

              <div className="cert-signature cert-signature--five">
                <img
                  src="/signature_five_design.png"
                  alt="Signature responsable Five Design Group"
                />
                <div className="cert-signature__line" />
                <p>Signature Responsable de Five Design Group Sarl</p>
              </div>

              <div className="cert-qr">
                <CertificateQrCode value={verificationUrl} />
                <p>Scanner pour vérifier</p>
              </div>
            </footer>

            <div className="cert-footnote">
              <span>Émis le {cert.issued_date}</span>
              <span>ID certificat {cert.certificate_number}</span>
              {cert.student_code ? <span>Matricule {cert.student_code}</span> : null}
              <span className="cert-verify">Vérification : {verificationUrl}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
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

  return <CertificateDocument cert={cert} />;
}
