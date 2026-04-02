# Académie des Créatifs

## Vision du projet

Académie des Créatifs est une plateforme hybride qui combine :

- un site e-commerce public pour vendre les formations ;
- un espace d'apprentissage en ligne pour les parcours digitaux ;
- un espace de gestion scolaire pour les formations en présentiel ;
- un espace enseignant ;
- un back-office admin.

Le site public constitue l'unique porte d'entrée. Le produit ne doit pas être pensé comme un site vitrine enrichi, mais comme un système de gestion de formation avec commerce, progression pédagogique, facturation et pilotage administratif.

## Objectifs produit

- vendre des formations en ligne et en présentiel depuis un catalogue unique ;
- donner une expérience type Udemy aux apprenants des formations en ligne ;
- donner une expérience plus scolaire aux apprenants du présentiel ;
- gérer les rôles `étudiant`, `enseignant` et `admin` dans un même système ;
- gérer badges, progression, notes, exercices, factures et rappels de paiement ;
- permettre le paiement en tranches pour certaines formations présentielles.

## Surfaces applicatives

- `Site public / e-commerce` : accueil, catalogue, détail formation, panier, checkout, authentification.
- `Dashboard étudiant online` : vidéos, chapitres, quiz, progression, badges, factures.
- `Dashboard étudiant présentiel` : notes, exercices, rappels, échéancier, badges.
- `Dashboard enseignant` : cours, cohortes, notes, évaluations, suivi pédagogique.
- `Dashboard admin` : formations, utilisateurs, paiements, factures, relances, statistiques.

## Principes d'architecture

- une seule base utilisateurs, plusieurs rôles ;
- une seule base catalogue pour les formations ;
- deux expériences post-achat distinctes selon le type de formation ;
- des règles métier explicites pour le présentiel, notamment le code étudiant et les paiements en tranches ;
- une séparation claire entre contenu pédagogique, commerce, facturation et notifications.

## Stack cible

- `Frontend` : React + TypeScript + Vite
- `Backend API` : Python + FastAPI
- `Base de données` : PostgreSQL
- `Stockage médias` : stockage objet compatible S3
- `Jobs asynchrones` : worker pour emails, rappels, factures PDF, webhooks
- `Authentification` : JWT avec refresh token et contrôle des rôles

## MVP recommandé

Le MVP doit couvrir le flux complet le plus critique :

1. catalogue + détail formation + checkout ;
2. authentification + rôles ;
3. achat d'une formation online avec accès au dashboard online ;
4. achat d'une formation présentielle avec échéancier et dashboard scolaire ;
5. progression, badges, factures et rappels ;
6. espace enseignant minimal ;
7. admin minimal pour piloter formations, utilisateurs et paiements.

## Documentation à lire

- `docs/architecture.md`
- `docs/business_rules.md`
- `docs/db_schema.md`
- `docs/api_endpoints.md`
- `docs/react_components.md`
- `docs/roadmap.md`
- `docs/assets_strategy.md`

## Structure projet cible

- `frontend/` : interface publique et dashboards React
- `backend/` : API FastAPI, logique métier, jobs, intégrations
- `shared/` : contrats partagés, types, schémas et conventions
- `assets/` : logos, badges et visuels canoniques retenus
- `docs/` : cadrage fonctionnel, technique et roadmap

## État actuel

Le dépôt actuel n'implémente pas encore cette cible. La documentation de ce dossier décrit la plateforme à construire, pas seulement l'existant.
