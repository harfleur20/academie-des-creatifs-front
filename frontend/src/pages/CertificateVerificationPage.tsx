import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";

import { verifyCertificate, type CertificateView } from "../lib/catalogApi";
import "../styles/certificate.css";

const previewCertificate: CertificateView = {
  enrollment_id: 0,
  certificate_number: "CERT-2026-Q8MK-4T2P-X9DA",
  verification_token: null,
  verification_path: "/certificats/verifier/apercu",
  verification_url: "http://localhost:5173/certificats/verifier/apercu",
  share_path: null,
  share_url: null,
  share_image_url: null,
  student_name: "Ndemgne Estelle",
  student_code: "AC26-002E",
  formation_title: "Infographie",
  formation_duration: "3 mois",
  format_type: "presentiel",
  dashboard_type: "guided",
  mentor_name: "Francis Kenne",
  level: "Tous niveaux",
  session_label: "Aperçu",
  issued_date: "23 avril 2026",
  is_valid: true,
};

export default function CertificateVerificationPage() {
  const { token } = useParams();
  const [certificate, setCertificate] = useState<CertificateView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien de vérification invalide.");
      setIsLoading(false);
      return;
    }

    if (token === "apercu") {
      setCertificate(previewCertificate);
      setIsLoading(false);
      return;
    }

    verifyCertificate(token)
      .then(setCertificate)
      .catch(() => setError("Ce certificat est introuvable ou n'est pas valide."))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="page cert-verify-page">
        <section className="cert-verify-card">
          <p className="eyebrow">Vérification</p>
          <h1>Vérification du certificat…</h1>
        </section>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="page cert-verify-page">
        <section className="cert-verify-card cert-verify-card--error">
          <FaTimesCircle />
          <p className="eyebrow">Certificat non valide</p>
          <h1>Impossible de vérifier ce certificat</h1>
          <p>{error || "Le lien utilisé ne correspond à aucun certificat valide."}</p>
          <Link className="button button--secondary" to="/">
            Retour à l'accueil
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page cert-verify-page">
      <section className="cert-verify-card">
        <FaCheckCircle />
        <p className="eyebrow">Certificat vérifié</p>
        <h1>{certificate.student_name}</h1>
        <p>
          Ce certificat de fin de formation a été émis par l'Académie des
          Créatifs.
        </p>
        <dl className="cert-verify-list">
          <div>
            <dt>Formation</dt>
            <dd>{certificate.formation_title}</dd>
          </div>
          <div>
            <dt>ID certificat</dt>
            <dd>{certificate.certificate_number}</dd>
          </div>
          <div>
            <dt>Matricule</dt>
            <dd>{certificate.student_code ?? "Non attribué"}</dd>
          </div>
          <div>
            <dt>Date d'émission</dt>
            <dd>{certificate.issued_date}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>Valide</dd>
          </div>
        </dl>
        <Link className="button button--primary" to="/">
          Retour au site
        </Link>
      </section>
    </div>
  );
}
