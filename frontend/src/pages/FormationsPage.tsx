import { Link } from "react-router-dom";
import { FaArrowRight, FaClock, FaGraduationCap } from "react-icons/fa";

import {
  getFormationPath,
  onlineCourses,
} from "../data/ecommerceHomeData";

export default function FormationsPage() {
  return (
    <div className="formation-index-page">
      <section className="formation-index-hero">
        <p className="formation-index-hero__eyebrow">Catalogue des formations</p>
        <h1>Choisissez le parcours qui correspond a votre niveau et a votre objectif.</h1>
        <p className="formation-index-hero__lead">
          Retrouvez nos formations acceleres en ligne, consultez leur fiche
          complete et preparez votre prochaine inscription sur la plateforme.
        </p>
      </section>

      <section className="formation-index-grid">
        {onlineCourses.map((course) => (
          <article className="formation-index-card" key={course.slug}>
            <div className="formation-index-card__image">
              <img src={course.image} alt={course.title} />
            </div>

            <div className="formation-index-card__body">
              <p className="formation-index-card__level">
                <FaGraduationCap />
                {course.level}
              </p>
              <h2>{course.title}</h2>
              <p className="formation-index-card__session">
                <FaClock />
                {course.sessionLabel}
              </p>
              <div className="formation-index-card__footer">
                <strong>{course.currentPrice}</strong>
                <Link to={getFormationPath(course.slug)}>
                  Voir la fiche
                  <FaArrowRight />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
