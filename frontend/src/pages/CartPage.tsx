import { Link } from "react-router-dom";

export default function CartPage() {
  return (
    <div className="formation-detail-page">
      <section className="formation-detail-empty">
        <p className="formation-detail-empty__eyebrow">Panier</p>
        <h1>Votre panier est encore vide.</h1>
        <p>
          Ajoutez une formation depuis le catalogue pour préparer votre
          inscription et retrouver vos choix ici.
        </p>
        <Link className="button button--primary" to="/formations">
          Voir les formations
        </Link>
      </section>
    </div>
  );
}
