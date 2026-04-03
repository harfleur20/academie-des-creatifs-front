# Architecture cible

## Vue d'ensemble

La plateforme est decoupee en domaines metier coherents :

- `catalog-commerce`
- `identity-access`
- `learning-classic`
- `learning-guided`
- `billing-payments`
- `badges-progression`
- `notifications`
- `admin-reporting`

## Architecture applicative

### Frontend

Une seule application React avec plusieurs zones fonctionnelles :

- routes publiques pour le site e-commerce ;
- routes privees pour les dashboards ;
- composants partages pour layout, cartes, formulaires et navigation ;
- guards d'acces par role et par contexte d'achat.

### Backend

Une API FastAPI modulaire avec :

- endpoints REST versionnes ;
- services metier par domaine ;
- schemas Pydantic pour validation d'entree et de sortie ;
- couche d'acces aux donnees isolee de la logique metier ;
- jobs asynchrones pour facturation, notifications et webhooks de paiement.

### Donnees

Une base PostgreSQL centralise :

- utilisateurs et roles ;
- catalogue et contenus pedagogiques ;
- inscriptions, progression, badges ;
- notes, exercices, evaluations ;
- transactions, echeanciers, factures ;
- notifications et historique.

### Stockage fichier

Le code ne doit pas stocker videos et PDF directement dans le serveur d'application. Prevoir :

- stockage objet pour videos et pieces jointes ;
- generation de liens signes pour la lecture ;
- stockage des factures PDF et exports.

## Modules metier

### 1. Catalog Commerce

Responsabilites :

- catalogue de formations ;
- pages detail ;
- panier ;
- checkout ;
- commandes et historique d'achat.

### 2. Identity Access

Responsabilites :

- inscription ;
- connexion ;
- gestion des roles ;
- regles d'acces aux dashboards.

### 3. Learning Classic

Responsabilites :

- modules ;
- chapitres ;
- lecons ;
- lecture video ;
- quiz ;
- calcul de progression.

### 4. Learning Guided

Responsabilites :

- parcours `live` ;
- parcours `presentiel` ;
- suivi pedagogique ;
- notes et exercices ;
- code etudiant pour le presentiel ;
- rappels de scolarite.

### 5. Billing Payments

Responsabilites :

- paiement initial ;
- webhooks ;
- paiements en tranches ;
- echeances ;
- factures partielles et finales ;
- statut de reglement.

### 6. Badges Progression

Responsabilites :

- referentiel de badges ;
- regles d'attribution ;
- historique des changements de niveau ;
- affichage dashboard ;
- badges marketing derives pour le catalogue.

### 7. Notifications

Responsabilites :

- notifications dashboard ;
- envois email ;
- rappels automatiques ;
- relances manuelles par l'admin.

### 8. Admin Reporting

Responsabilites :

- gestion formations ;
- gestion utilisateurs ;
- supervision paiements ;
- supervision inscriptions ;
- statistiques de base.

## Decisions techniques recommandees

- structurer le backend par modules metier, pas par fichier unique ;
- centraliser les regles metier cote backend ;
- ne jamais deriver le role utilisateur uniquement depuis le frontend ;
- deriver `dashboard_type` a partir de `format_type` ;
- deriver `promo` a partir du prix barre ;
- isoler le fournisseur de paiement derriere une couche d'adaptation ;
- prevoir l'asynchrone des le debut pour factures, emails et rappels.

## Hors perimetre MVP

- live streaming temps reel ;
- forum communautaire ;
- mobile native app ;
- analytics avances ;
- moteur de recommandation ;
- multi-tenant.
