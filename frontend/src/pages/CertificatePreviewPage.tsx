import type { CertificateView } from "../lib/catalogApi";
import { CertificateDocument } from "./CertificatePage";

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

export default function CertificatePreviewPage() {
  return <CertificateDocument cert={previewCertificate} />;
}
