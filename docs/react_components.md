# Architecture frontend React

## Routes publiques

- `/` : page d'accueil orientée conversion
- `/formations` : catalogue unifié avec filtres `online` et `onsite`
- `/formations/:slug` : détail d'une formation
- `/panier` : résumé commande
- `/checkout` : paiement
- `/login` : connexion
- `/register` : inscription
- `/forgot-password` : récupération d'accès
- `/factures` : historique utilisateur simple si connecté

## Routes privées étudiant

- `/dashboard` : redirection contextuelle selon les inscriptions
- `/dashboard/online` : vue globale des formations online
- `/dashboard/online/:enrollmentId` : player, modules, progression, quiz
- `/dashboard/onsite` : vue globale des inscriptions présentielles
- `/dashboard/onsite/:enrollmentId` : notes, exercices, rappels, échéancier, badge
- `/dashboard/profile` : profil utilisateur
- `/dashboard/billing` : paiements et factures

## Routes privées enseignant

- `/teacher`
- `/teacher/sessions`
- `/teacher/sessions/:sessionId`
- `/teacher/assignments`
- `/teacher/grades`

## Routes privées admin

- `/admin`
- `/admin/formations`
- `/admin/users`
- `/admin/orders`
- `/admin/payment-plans`
- `/admin/invoices`
- `/admin/analytics`

## Layouts principaux

- `PublicLayout`
- `StudentLayout`
- `TeacherLayout`
- `AdminLayout`
- `AuthLayout`

## Modules UI publics

- `Header`
- `Footer`
- `Hero`
- `FormationCard`
- `FormationGrid`
- `FormationFilters`
- `TestimonialsSection`
- `BadgesShowcase`
- `CheckoutSummary`
- `PaymentMethodSelector`

## Modules UI dashboard online

- `EnrollmentSidebar`
- `CoursePlayer`
- `LessonList`
- `LessonContent`
- `ProgressBar`
- `QuizPanel`
- `CourseCompletionCard`
- `BadgePanel`

## Modules UI dashboard présentiel

- `StudentIdentityCard`
- `StudentCodeCard`
- `TuitionStatusCard`
- `InstallmentTimeline`
- `GradesTable`
- `AssignmentsList`
- `PedagogicSchedule`
- `ReminderList`
- `BadgeProgressCard`

## Modules UI enseignant

- `TeacherSessionTable`
- `TeacherSessionOverview`
- `AssignmentEditor`
- `GradeEntryTable`
- `StudentFollowUpCard`

## Modules UI admin

- `AdminStatsCards`
- `FormationTable`
- `UserTable`
- `OrderTable`
- `InvoiceTable`
- `ReminderTriggerForm`
- `PaymentPlanEditor`

## Composants transverses

- `ProtectedRoute`
- `RoleGuard`
- `AppBreadcrumbs`
- `EmptyState`
- `DataTable`
- `StatusBadge`
- `NotificationCenter`
- `ConfirmDialog`
- `FileDownloadButton`

## État frontend recommandé

- `React Query` pour la donnée serveur ;
- `React Router` pour le routage ;
- `Zod` pour la validation de formulaires côté client ;
- un state local léger pour l'UI ;
- aucune logique métier sensible calculée uniquement dans le navigateur.
