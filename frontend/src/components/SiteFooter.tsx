import { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowUpRightFromSquare,
  FaFacebookF,
  FaPinterestP,
  FaTiktok,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa6";
import { HelpCircle } from "lucide-react";

export default function SiteFooter() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <footer id="footer-droit">
      <div className="footer-container">
        <div className="news-letter">
          <div className="news-droit">
            <h2>Abonnez-vous à notre Newsletter</h2>
            <p>
              Recevez les dernières nouvelles et offres exclusives de l'Académie
              des Créatifs.
            </p>
          </div>

          <div className="btn-news">
            <form onSubmit={handleSubmit}>
              <input placeholder="Entrez votre email" required type="email" />
              <button className="btn-abonne" type="submit">
                S'abonner
              </button>
            </form>
          </div>
        </div>

        <div className="footer-content">
          <div className="footer-logo">
            <img src="/logo_academie_hd.png" alt="Logo Académie des Créatifs" />
            <p>
              Depuis 2023, au service des créatifs africains.
              <br />
              Un réseau pour révéler les talents créatifs.
            </p>
            <p>
              By <span className="span-five">Five Design Group SARL</span>
            </p>
            <p>
              RCCM : RC/DLA/2023/B/5645
              <br />
              NUI : MO92316045001
            </p>
          </div>

          <div className="footer-links">
            <h2>Liens utiles</h2>
            <ul>
              <li>
                <a href="/#apropos">À propos</a>
              </li>
              <li>
                <a href="/#formateur">Notre équipe</a>
              </li>
              <li>
                <a href="/#form-en-ligne">Formation en ligne</a>
              </li>
              <li>
                <a href="/#form-en-presentiel">Formation en présentiel</a>
              </li>
              <li>
                <a href="/#bg-progres">Nos badges de progression</a>
              </li>
              <li>
                <a href="/#temoignage">Témoignages</a>
              </li>
              <li>
                <a href="/#album">Espace étudiant</a>
              </li>
            </ul>
          </div>

          <div className="footer-contact">
            <h2>Contactez-nous</h2>
            <p>
              Douala : 680 95 03 19
              <br />
              Campus Douala - Ndokotti
              <br />
              Email: contact@academiecreatif.com
              <br />
              <a className="cgu" href="/">
                <FaArrowUpRightFromSquare />
                Conditions générales d'utilisation
              </a>
            </p>
            <p>
              Notre <a href="/">politique de formation</a>
            </p>

            <Link to="/aide" className="footer-help-link">
              <HelpCircle size={14} />
              Aide &amp; support
            </Link>

            <div className="social-media-link">
              <a
                aria-label="Facebook"
                href="https://www.facebook.com/academiecreatif"
                rel="noopener noreferrer"
                target="_blank"
              >
                <FaFacebookF />
              </a>
              <a
                aria-label="WhatsApp"
                href="https://wa.me/message/DMISDTO4HCUDC1"
                rel="noopener noreferrer"
                target="_blank"
              >
                <FaWhatsapp />
              </a>
              <a
                aria-label="TikTok"
                href="https://www.tiktok.com/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <FaTiktok />
              </a>
              <a
                aria-label="YouTube"
                href="https://www.youtube.com/@academiecreatif5"
                rel="noopener noreferrer"
                target="_blank"
              >
                <FaYoutube />
              </a>
              <a
                aria-label="Pinterest"
                href="https://fr.pinterest.com/myfivedesign"
                rel="noopener noreferrer"
                target="_blank"
              >
                <FaPinterestP />
              </a>
            </div>
          </div>
        </div>

        <div className="footer-copyright">
          <p>&copy; 2026 L'Académie des Créatifs. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
