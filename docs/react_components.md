# Architecture frontend React

## Routes publiques

- `/` : page d'accueil orientee conversion
- `/formations` : catalogue unifie avec filtres `live`, `ligne`, `presentiel`
- `/formations/:slug` : detail d'une formation
- `/panier` : panier protege si connecte
- `/checkout` : checkout protege
- `/login` : connexion
- `/register` : inscription

## Routes privees utilisateur

- `/espace` : redirection contextuelle selon le role
- `/espace/etudiant` : dashboard etudiant unifie
- `/espace/enseignant` : dashboard enseignant
- `/favoris`
- `/notifications`

Le dashboard etudiant est pilote par `dashboard_type` :

- `classic` pour les formations `ligne`
- `guided` pour les formations `live` et `presentiel`

## Routes privees admin

- `/admin`

Navigation interne actuelle :

- `#admin-overview`
- `#admin-catalogue`
- `#admin-sessions`
- `#admin-users`
- `#admin-orders`
- `#admin-payments`

## Layouts principaux

- `PublicLayout`
- `AdminLayout`

## Modules UI publics

- `SiteHeader`
- `SiteFooter`
- `Hero`
- `FormationCard`
- `FormationFilters`
- `CheckoutSummary`
- `TestimonialsSection`
- `BadgesShowcase`

## Modules UI dashboard etudiant classique

- `LessonList`
- `LessonContent`
- `ProgressBar`
- `QuizPanel`
- `BadgePanel`

## Modules UI dashboard guide

- `StudentIdentityCard`
- `StudentCodeCard`
- `GradesTable`
- `AssignmentsList`
- `ReminderList`
- `BadgeProgressCard`

## Modules UI enseignant

- `TeacherSessionTable`
- `TeacherSessionOverview`
- `AssignmentEditor`
- `GradeEntryTable`

## Modules UI admin

- `AdminStatsCards`
- `FormationEditor`
- `FormationCreateCard`
- `SessionOverviewCards`
- `UserTable`
- `OrderTable`
- `PaymentCards`

## Composants transverses

- `ProtectedRoute`
- `AccountRedirectPage`
- `EmptyState`
- `StatusBadge`
- `NotificationCenter`

## Etat frontend recommande

- `React Router` pour le routage ;
- `Context` pour l'auth et le panier ;
- validation de formulaires cote client + validation serveur ;
- aucune logique metier sensible calculee uniquement dans le navigateur.
