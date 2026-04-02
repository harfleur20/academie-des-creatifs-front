# Roadmap d'implémentation

## Phase 0. Cadrage

Objectif :

- figer le périmètre MVP ;
- valider les règles métier ;
- valider l'architecture.

Livrables :

- documentation produit ;
- schéma de données cible ;
- contrat d'API ;
- stratégie assets et branding.

## Phase 1. Socle technique

Objectif :

- rendre le projet buildable et maintenable ;
- supprimer les incohérences CRA/Vite ;
- poser la structure backend.

Livrables :

- frontend Vite propre ;
- backend FastAPI modulaire ;
- configuration environnement ;
- conventions shared.

## Phase 2. E-commerce central

Objectif :

- permettre la vente des deux types de formation.

Livrables :

- home ;
- catalogue ;
- détail formation ;
- panier ;
- checkout ;
- création de commande ;
- initialisation paiement ;
- première facture.

## Phase 3. Dashboard online

Objectif :

- fournir le parcours d'apprentissage digital.

Livrables :

- liste des formations achetées ;
- modules, chapitres, leçons ;
- player vidéo ;
- quiz ;
- progression ;
- badges.

## Phase 4. Dashboard présentiel

Objectif :

- fournir le parcours administratif et pédagogique du présentiel.

Livrables :

- code étudiant ;
- échéancier ;
- notes ;
- exercices ;
- rappels ;
- badge de progression ;
- affichage des factures.

## Phase 5. Espace enseignant

Objectif :

- permettre le pilotage pédagogique de base.

Livrables :

- liste des cohortes ;
- affectation cours ;
- publication exercices ;
- saisie des notes ;
- suivi étudiant minimal.

## Phase 6. Back-office admin

Objectif :

- centraliser le pilotage du système.

Livrables :

- gestion formations ;
- gestion utilisateurs et rôles ;
- supervision paiements ;
- relances manuelles ;
- statistiques de base.

## Ordre recommandé de développement

1. socle technique
2. auth + rôles
3. catalogue + checkout
4. paiements + factures
5. dashboard online
6. dashboard présentiel
7. enseignant
8. admin

## Critères de fiabilité avant production

- build frontend reproductible ;
- tests API critiques ;
- webhooks paiement idempotents ;
- génération code étudiant sans collision ;
- facturation cohérente avec les paiements ;
- audit minimal des actions admin.
