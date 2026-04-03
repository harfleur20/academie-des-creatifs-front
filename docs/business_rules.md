# Regles metier

## Types de formation

Une formation possede maintenant un `format_type` :

- `live`
- `ligne`
- `presentiel`

Chaque format derive automatiquement un `dashboard_type` :

- `ligne` -> `classic`
- `live` -> `guided`
- `presentiel` -> `guided`

Ce couple conditionne :

- le type de dashboard accessible apres achat ;
- les regles de progression ;
- l'eligibilite au paiement en tranches ;
- la presence ou non d'un code etudiant.

## Roles

Le systeme gere trois roles applicatifs principaux :

- `student`
- `teacher`
- `admin`

Regles :

- l'inscription publique cree un compte `student` uniquement ;
- `teacher` et `admin` sont attribues par l'administration ;
- un utilisateur peut cumuler plusieurs roles ;
- un enseignant connecte accede a son espace enseignant ;
- un admin conserve un acces global ;
- un achat `ligne` n'attribue pas de code etudiant ;
- un achat `presentiel` attribue un code etudiant ;
- un achat `live` utilise le dashboard guide, mais sans code etudiant.

## Code etudiant

Format :

- `AC25-002E`

Regles :

- `AC` = Academie ;
- `25` = annee sur deux chiffres ;
- `002` = sequence ordonnee dans l'annee ;
- `E` = etudiant ;
- la sequence est unique par annee ;
- le code est genere a la validation d'une inscription `presentiel` ;
- le code ne doit jamais etre reutilise.

Masque :

- `AC{yy}-{sequence:03d}E`

## Paiement en tranches

Eligibilite :

- uniquement pour les formations `presentiel` ;
- uniquement si le prix actuel est strictement superieur a `90 000 FCFA`.

Regles :

- l'eligibilite est derivee automatiquement du format et du prix ;
- le plan de paiement est pilote par l'admin ;
- le dashboard guide presentiel est active a la confirmation du premier paiement ;
- chaque echeance possede un montant, une date limite et un statut ;
- les statuts d'echeance sont `pending`, `paid`, `late`, `cancelled` ;
- une echeance en retard declenche des rappels automatiques.

## Badges marketing du catalogue

Badges actuellement supportes :

- `premium`
- `populaire`
- `promo`

Regles :

- `premium` est manuel ;
- `populaire` est manuel ;
- `promo` est automatique des que `original_price_amount > current_price_amount` ;
- `promo` ne doit pas etre saisi manuellement dans l'admin.

## Badges pedagogiques

Referentiel badges :

- `aventurier`
- `debutant`
- `intermediaire`
- `semi-pro`
- `professionnel`

Principe :

- chaque inscription possede un niveau de badge courant ;
- le niveau depend de validations pedagogiques reelles ;
- le calcul doit rester centralise cote backend.

## Progression

### Dashboard classique

La progression `classic` se calcule a partir de :

- lecons vues ;
- chapitres termines ;
- quiz reussis ;
- validations de modules.

### Dashboard guide

La progression `guided` se calcule a partir de :

- presence ou suivi pedagogique ;
- notes ;
- exercices rendus ;
- evaluations validees ;
- jalons pedagogiques et administratifs.

## Factures

Regles :

- une facture est generee apres chaque paiement confirme ;
- pour un paiement fractionne, chaque echeance payee genere une facture partielle ;
- une facture finale peut etre generee quand le plan est integralement regle ;
- l'utilisateur doit retrouver son historique depuis son espace.

## Rappels de paiement

Canaux prevus :

- notification in-app ;
- email ;
- SMS plus tard.

Cadence initiale :

- rappel avant echeance ;
- rappel le jour de l'echeance ;
- rappel apres retard si non paye ;
- relance manuelle possible par un admin.

## Permissions minimales

- `student` : consulter uniquement ses donnees et inscriptions ;
- `teacher` : gerer les cohortes et evaluations qui lui sont affectees ;
- `admin` : acces complet aux modules d'administration ;
- aucune action sensible ne doit dependre d'un controle frontend seul.
