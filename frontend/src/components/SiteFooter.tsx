export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__eyebrow">Académie des Créatifs</p>
          <p className="site-footer__copy">
            Plateforme hybride pour vendre, apprendre, suivre et piloter les
            formations en ligne et en présentiel.
          </p>
        </div>

        <div className="site-footer__grid">
          <div>
            <p className="site-footer__title">Parcours</p>
            <p className="site-footer__item">Catalogue e-commerce</p>
            <p className="site-footer__item">Dashboard online</p>
            <p className="site-footer__item">Dashboard présentiel</p>
          </div>

          <div>
            <p className="site-footer__title">Pilotage</p>
            <p className="site-footer__item">Espace enseignant</p>
            <p className="site-footer__item">Back-office admin</p>
            <p className="site-footer__item">Factures et rappels</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
