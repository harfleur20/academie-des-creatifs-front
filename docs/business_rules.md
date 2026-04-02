# Règles métier

## Types de formation

Une formation possède un `delivery_mode` :

- `online`
- `onsite`

Ce mode conditionne :

- le type de dashboard accessible ;
- les règles de progression ;
- l'éligibilité au paiement en tranches ;
- la présence ou non d'un code étudiant.

## Rôles

Le système gère trois rôles applicatifs principaux :

- `student`
- `teacher`
- `admin`

Règles :

- un utilisateur peut cumuler plusieurs rôles ;
- un enseignant connecté doit accéder à son dashboard enseignant ;
- un admin conserve un accès global ;
- un utilisateur ayant acheté une formation online reste `student` mais n'obtient pas automatiquement un code étudiant ;
- le code étudiant est généré pour les inscriptions présentielles.

## Code étudiant

Format :

- `AC25-002E`

Règles :

- `AC` = Académie ;
- `25` = année sur deux chiffres ;
- `002` = séquence ordonnée dans l'année ;
- `E` = étudiant ;
- la séquence est unique par année ;
- le code est généré au moment de la validation de l'inscription présentielle ;
- le code ne doit jamais être réutilisé, même si une inscription est annulée.

Exemple de masque :

- `AC{yy}-{sequence:03d}E`

## Paiement en tranches

Éligibilité initiale proposée :

- uniquement pour les formations `onsite` ;
- uniquement si le prix est strictement supérieur à `90 000 FCFA`.

Règles :

- le plan de paiement doit être défini par l'admin ;
- l'accès au dashboard présentiel est activé à la confirmation du premier paiement ;
- chaque échéance possède un montant, une date limite et un statut ;
- les statuts d'échéance sont `pending`, `paid`, `late`, `cancelled` ;
- le statut global de la scolarité est calculé depuis les échéances ;
- une échéance en retard déclenche des rappels automatiques.

## Badges

Référentiel badges :

- `aventurier`
- `débutant`
- `intermédiaire`
- `semi-pro`
- `professionnel`

Principe :

- chaque inscription possède un niveau de badge courant ;
- le niveau dépend de validations pédagogiques réelles ;
- le calcul doit être centralisé côté backend.

Proposition de règles initiales à valider :

- `aventurier` : inscription active, progression insuffisante pour un niveau supérieur ;
- `débutant` : premières validations obtenues ;
- `intermédiaire` : progression cohérente avec plusieurs modules ou évaluations validés ;
- `semi-pro` : majorité du parcours validée ;
- `professionnel` : parcours terminé avec validation finale.

Règle importante :

- la logique badge doit être paramétrable, pas codée en dur dans le frontend.

## Progression

### Online

La progression online se calcule à partir de :

- leçons vues ;
- chapitres terminés ;
- quiz réussis ;
- validations de modules.

### Onsite

La progression présentielle se calcule à partir de :

- présence ou suivi pédagogique ;
- notes ;
- exercices rendus ;
- évaluations validées ;
- jalons administratifs si nécessaire.

## Factures

Règles :

- une facture est générée après chaque paiement confirmé ;
- pour un paiement fractionné, chaque échéance payée génère une facture partielle ;
- une facture de clôture peut être générée quand le plan est intégralement réglé ;
- l'utilisateur doit retrouver tout son historique depuis son dashboard ;
- les factures doivent être exportables en PDF.

## Rappels de paiement

Canaux prévus :

- notification in-app ;
- email ;
- SMS en option future.

Cadence initiale proposée :

- rappel avant échéance ;
- rappel le jour de l'échéance ;
- rappel après retard si non payé ;
- relance manuelle possible par un admin.

## Permissions minimales

- `student` : consulter ses données uniquement ;
- `teacher` : gérer les cohortes et évaluations qui lui sont affectées ;
- `admin` : accès complet aux modules d'administration ;
- aucune action sensible ne doit dépendre d'un contrôle frontend seul.
