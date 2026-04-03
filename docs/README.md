# Academie des Creatifs

## Vision du projet

Academie des Creatifs est une plateforme hybride qui combine :

- un site e-commerce public pour vendre les formations ;
- un dashboard classique pour les formations `ligne` ;
- un dashboard guide pour les formations `live` ;
- un dashboard guide a logique scolaire pour les formations `presentiel` ;
- un espace enseignant ;
- un back-office admin.

Le site public constitue l'unique porte d'entree. Le produit ne doit pas etre pense comme un simple site vitrine, mais comme un systeme de gestion de formation avec commerce, progression pedagogique, facturation et pilotage administratif.

## Objectifs produit

- vendre des formations `live`, `ligne` et `presentiel` depuis un catalogue unique ;
- offrir une experience type Udemy pour les parcours `ligne` ;
- offrir une experience guidee pour `live` ;
- offrir une experience scolaire et administrative pour `presentiel` ;
- gerer les roles `student`, `teacher` et `admin` dans un meme systeme ;
- gerer badges, progression, notes, exercices, factures et rappels de paiement ;
- permettre le paiement en tranches pour certaines formations presencielles.

## Surfaces applicatives

- `Site public / e-commerce` : accueil, catalogue, detail formation, panier, checkout, authentification.
- `Dashboard etudiant classic` : videos, chapitres, quiz, progression, badges, factures.
- `Dashboard etudiant guided` : coaching, suivi, rappels, notes, exercices, badges.
- `Dashboard enseignant` : cohortes, notes, evaluations, suivi pedagogique.
- `Dashboard admin` : formations, utilisateurs, paiements, commandes, statistiques.

## Principes d'architecture

- une seule base utilisateurs, plusieurs roles ;
- une seule base catalogue pour les formations ;
- un `format_type` metier (`live`, `ligne`, `presentiel`) ;
- un `dashboard_type` derive (`classic`, `guided`) ;
- des regles metier explicites pour le presentiel, notamment le code etudiant et les paiements en tranches ;
- une separation claire entre contenu pedagogique, commerce, facturation et notifications.

## Stack cible

- `Frontend` : React + TypeScript + Vite
- `Backend API` : Python + FastAPI
- `Base de donnees` : PostgreSQL
- `Stockage medias` : stockage objet compatible S3
- `Jobs asynchrones` : worker pour emails, rappels, factures PDF, webhooks
- `Authentification` : sessions HTTPOnly + controle des roles

## MVP recommande

Le MVP doit couvrir le flux complet le plus critique :

1. catalogue + detail formation + panier + checkout ;
2. authentification + roles ;
3. achat d'une formation `ligne` avec acces au dashboard `classic` ;
4. achat d'une formation `live` avec acces au dashboard `guided` ;
5. achat d'une formation `presentiel` avec code etudiant, echeancier et dashboard guide ;
6. progression, badges, factures et rappels ;
7. espace enseignant minimal ;
8. admin minimal pour piloter formations, utilisateurs et paiements.

## Documentation a lire

- `docs/architecture.md`
- `docs/business_rules.md`
- `docs/db_schema.md`
- `docs/api_endpoints.md`
- `docs/react_components.md`
- `docs/roadmap.md`
- `docs/assets_strategy.md`

## Structure projet cible

- `frontend/` : interface publique et dashboards React
- `backend/` : API FastAPI, logique metier, jobs, integrations
- `shared/` : contrats partages, types, schemas et conventions
- `assets/` : logos, badges et visuels canoniques retenus
- `docs/` : cadrage fonctionnel, technique et roadmap

## Etat actuel

Le depot implemente deja :

- le catalogue public ;
- l'authentification ;
- le panier et le checkout mock ;
- le dashboard admin ;
- le decoupage `live / ligne / presentiel` avec derivation `classic / guided`.

Il reste encore a etendre les dashboards et les modules pedagogiques profonds.
