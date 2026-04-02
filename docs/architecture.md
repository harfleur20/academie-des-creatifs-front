# Architecture cible

## Vue d'ensemble

La plateforme doit être découpée en domaines métiers cohérents plutôt qu'en simples pages frontend :

- `catalog-commerce`
- `identity-access`
- `learning-online`
- `school-onsite`
- `billing-payments`
- `badges-progression`
- `notifications`
- `admin-reporting`

## Architecture applicative

### Frontend

Une seule application React avec plusieurs zones fonctionnelles :

- routes publiques pour le site e-commerce ;
- routes privées pour les dashboards ;
- composants partagés pour layout, tables, cartes, formulaires et navigation ;
- guards d'accès par rôle et par type d'inscription.

### Backend

Une API FastAPI modulaire avec :

- endpoints REST versionnés ;
- services métier par domaine ;
- schémas Pydantic pour validation d'entrée et de sortie ;
- couche d'accès aux données isolée de la logique métier ;
- jobs asynchrones pour facturation, notifications et webhooks de paiement.

### Données

Une base PostgreSQL centralise :

- utilisateurs et rôles ;
- catalogue et contenus pédagogiques ;
- inscriptions, progression, badges ;
- notes, exercices, évaluations ;
- transactions, échéanciers, factures ;
- notifications et historique.

### Stockage fichier

Le code ne doit pas stocker vidéos et PDF directement dans le serveur d'application. Prévoir :

- stockage objet pour vidéos et pièces jointes ;
- génération de liens signés pour la lecture ;
- stockage des factures PDF et exports.

## Modules métier

### 1. Catalog Commerce

Responsabilités :

- catalogue de formations ;
- pages détail ;
- panier ;
- checkout ;
- commandes et historique d'achat.

### 2. Identity Access

Responsabilités :

- inscription ;
- connexion ;
- gestion des rôles ;
- récupération de mot de passe ;
- règles d'accès aux dashboards.

### 3. Learning Online

Responsabilités :

- modules ;
- chapitres ;
- leçons ;
- lecture vidéo ;
- quiz ;
- calcul de progression.

### 4. School Onsite

Responsabilités :

- inscription présentielle ;
- code étudiant ;
- cours ;
- exercices ;
- notes ;
- rappels de scolarité ;
- suivi pédagogique par cohorte.

### 5. Billing Payments

Responsabilités :

- paiement initial ;
- webhooks ;
- paiements en tranches ;
- échéances ;
- factures partielles et finales ;
- statut de règlement.

### 6. Badges Progression

Responsabilités :

- référentiel de badges ;
- règles d'attribution ;
- historique des changements de niveau ;
- affichage dashboard.

### 7. Notifications

Responsabilités :

- notifications dashboard ;
- envois email ;
- rappels automatiques ;
- relances manuelles par l'admin.

### 8. Admin Reporting

Responsabilités :

- gestion formations ;
- gestion utilisateurs ;
- supervision paiements ;
- supervision inscriptions ;
- statistiques de base.

## Décisions techniques recommandées

- adopter `Vite` comme base frontend et supprimer les reliquats `Create React App` ;
- structurer le backend par modules métier, pas par fichier unique ;
- centraliser les règles métier côté backend ;
- ne jamais dériver le rôle utilisateur uniquement depuis le frontend ;
- isoler le fournisseur de paiement derrière une couche d'adaptation ;
- prévoir l'asynchrone dès le début pour factures, emails et rappels.

## Hors périmètre MVP

- live streaming ;
- forum communautaire ;
- mobile native app ;
- analytics avancés ;
- moteur de recommandation ;
- multi-tenant.
