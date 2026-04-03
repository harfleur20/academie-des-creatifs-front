# Roadmap d'implementation

## Phase 0. Cadrage

Objectif :

- figer le perimetre MVP ;
- valider les regles metier ;
- valider l'architecture.

Livrables :

- documentation produit ;
- schema de donnees cible ;
- contrat d'API ;
- strategie assets et branding.

## Phase 1. Socle technique

Objectif :

- rendre le projet buildable et maintenable ;
- poser la structure frontend/backend ;
- installer la base auth.

Livrables :

- frontend Vite propre ;
- backend FastAPI modulaire ;
- migrations Alembic ;
- authentification et roles.

## Phase 2. E-commerce central

Objectif :

- permettre la vente des trois formats de formation.

Livrables :

- home ;
- catalogue ;
- detail formation ;
- panier ;
- checkout ;
- creation de commande ;
- premier paiement mock ;
- premiere facture.

## Phase 3. Dashboard classic

Objectif :

- fournir le parcours d'apprentissage digital pour les formations `ligne`.

Livrables :

- liste des formations achetees ;
- modules, chapitres, lecons ;
- player video ;
- quiz ;
- progression ;
- badges.

## Phase 4. Dashboard guided

Objectif :

- fournir le parcours guide pour `live` et `presentiel`.

Livrables :

- acces par cohorte ou session ;
- suivi pedagogique ;
- code etudiant pour le presentiel ;
- echeancier ;
- notes ;
- exercices ;
- rappels ;
- badge de progression ;
- affichage des factures.

## Phase 5. Espace enseignant

Objectif :

- permettre le pilotage pedagogique de base.

Livrables :

- liste des cohortes ;
- affectation cours ;
- publication exercices ;
- saisie des notes ;
- suivi etudiant minimal.

## Phase 6. Back-office admin

Objectif :

- centraliser le pilotage du systeme.

Livrables :

- gestion formations ;
- gestion utilisateurs et roles ;
- supervision paiements ;
- supervision commandes ;
- relances manuelles ;
- statistiques de base.

## Ordre recommande de developpement

1. socle technique
2. auth + roles
3. catalogue + panier + checkout
4. paiements + factures
5. dashboard classic
6. dashboard guided
7. enseignant
8. admin

## Criteres de fiabilite avant production

- build frontend reproductible ;
- tests API critiques ;
- webhooks paiement idempotents ;
- generation code etudiant sans collision ;
- facturation coherente avec les paiements ;
- audit minimal des actions admin.
