import { useState } from "react";
import { ChevronDown, HelpCircle, Mail, MessageCircle, Phone } from "lucide-react";

type FaqItem = { q: string; a: string };

const FAQ: FaqItem[] = [
  {
    q: "Comment réinitialiser mon mot de passe ?",
    a: "Rendez-vous dans votre profil via le menu en haut à droite, puis dans la section « Sécurité ». Vous pouvez y modifier votre mot de passe en saisissant l'ancien et le nouveau.",
  },
  {
    q: "Comment mettre à jour ma photo de profil ?",
    a: "Dans votre profil, cliquez sur l'icône appareil photo superposée à votre avatar. Les formats acceptés sont PNG, JPG et WebP, jusqu'à 2 Mo.",
  },
  {
    q: "Je n'arrive pas à accéder à un cours, que faire ?",
    a: "Vérifiez que votre inscription est bien active dans « Mes parcours ». Si le problème persiste, contactez le support en utilisant le formulaire ci-dessous.",
  },
  {
    q: "Comment télécharger mon certificat de formation ?",
    a: "Une fois la formation terminée, rendez-vous dans « Mes résultats » puis cliquez sur « Télécharger le certificat » à côté du parcours concerné.",
  },
  {
    q: "Comment contacter un enseignant ?",
    a: "Depuis l'espace de travail d'un cours, vous pouvez envoyer un message à l'enseignant via la section « Devoirs » ou le forum de la session.",
  },
];

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="help-faq">
      {items.map((item, i) => (
        <div key={i} className={`help-faq__item${open === i ? " is-open" : ""}`}>
          <button type="button" className="help-faq__q" onClick={() => setOpen(open === i ? null : i)}>
            <span>{item.q}</span>
            <ChevronDown size={16} className={`help-faq__caret${open === i ? " is-open" : ""}`} />
          </button>
          {open === i && <p className="help-faq__a">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="help-page">
      <div className="help-hero">
        <HelpCircle size={32} className="help-hero__icon" />
        <h1 className="help-hero__title">Aide & support</h1>
        <p className="help-hero__sub">Comment pouvons-nous vous aider ?</p>
      </div>

      <div className="help-body">
        <section className="help-section">
          <h2 className="help-section__title">Questions fréquentes</h2>
          <FaqAccordion items={FAQ} />
        </section>

        <section className="help-section">
          <h2 className="help-section__title">Nous contacter</h2>
          <div className="help-contact-cards">
            <div className="help-contact-card">
              <Mail size={22} className="help-contact-card__icon" />
              <strong>E-mail</strong>
              <span>support@academiedes creatifs.fr</span>
              <a href="mailto:support@academiedescreatifs.fr" className="help-contact-card__btn">Envoyer un e-mail</a>
            </div>
            <div className="help-contact-card">
              <Phone size={22} className="help-contact-card__icon" />
              <strong>Téléphone</strong>
              <span>Lun – Ven, 9h – 18h</span>
              <a href="tel:+33100000000" className="help-contact-card__btn">+33 1 00 00 00 00</a>
            </div>
            <div className="help-contact-card">
              <MessageCircle size={22} className="help-contact-card__icon" />
              <strong>Chat en direct</strong>
              <span>Disponible en heures ouvrées</span>
              <button type="button" className="help-contact-card__btn">Démarrer le chat</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
