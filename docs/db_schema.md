# Schéma de données cible

## Principes

- une seule base pour commerce, apprentissage et gestion scolaire ;
- les tables doivent distinguer clairement `catalogue`, `inscription`, `paiement`, `progression` et `évaluation` ;
- les règles métier sensibles doivent pouvoir être auditées ;
- le modèle doit accepter plusieurs rôles par utilisateur.

## Utilisateurs et accès

### users

- id (PK)
- email (unique)
- password_hash
- first_name
- last_name
- phone
- status
- created_at
- updated_at

### roles

- id (PK)
- code (`student`, `teacher`, `admin`)
- label

### user_roles

- id (PK)
- user_id (FK -> users.id)
- role_id (FK -> roles.id)
- assigned_at

### student_profiles

- id (PK)
- user_id (FK -> users.id, unique)
- student_code (unique, nullable si pas de présentiel)
- onboarding_status
- created_at

### teacher_profiles

- id (PK)
- user_id (FK -> users.id, unique)
- bio
- specialty

## Catalogue

### formations

- id (PK)
- slug (unique)
- title
- short_description
- long_description
- delivery_mode (`online`, `onsite`)
- price_amount
- price_currency
- allow_installments (bool)
- status (`draft`, `published`, `archived`)
- cover_asset_path
- created_at
- updated_at

### formation_categories

- id (PK)
- name
- slug

### formation_category_links

- id (PK)
- formation_id (FK -> formations.id)
- category_id (FK -> formation_categories.id)

### onsite_sessions

- id (PK)
- formation_id (FK -> formations.id)
- label
- start_date
- end_date
- seat_capacity
- campus_label
- teacher_id (FK -> users.id, nullable)

## Contenu pédagogique online

### course_modules

- id (PK)
- formation_id (FK -> formations.id)
- title
- position
- is_required

### course_lessons

- id (PK)
- module_id (FK -> course_modules.id)
- title
- lesson_type (`video`, `text`, `resource`, `quiz`)
- position
- duration_seconds
- is_preview

### lesson_assets

- id (PK)
- lesson_id (FK -> course_lessons.id)
- asset_type
- storage_path
- mime_type

### quizzes

- id (PK)
- formation_id (FK -> formations.id)
- module_id (FK -> course_modules.id, nullable)
- title
- passing_score

### quiz_questions

- id (PK)
- quiz_id (FK -> quizzes.id)
- prompt
- question_type
- position

## Inscriptions et progression

### enrollments

- id (PK)
- user_id (FK -> users.id)
- formation_id (FK -> formations.id)
- onsite_session_id (FK -> onsite_sessions.id, nullable)
- enrollment_type (`online`, `onsite`)
- status (`pending`, `active`, `suspended`, `completed`, `cancelled`)
- access_granted_at
- completed_at
- created_at

### lesson_progress

- id (PK)
- enrollment_id (FK -> enrollments.id)
- lesson_id (FK -> course_lessons.id)
- progress_percent
- completed_at
- last_position_seconds

### quiz_attempts

- id (PK)
- enrollment_id (FK -> enrollments.id)
- quiz_id (FK -> quizzes.id)
- score
- passed
- attempted_at

### progress_snapshots

- id (PK)
- enrollment_id (FK -> enrollments.id)
- progress_percent
- badge_id (FK -> badges.id, nullable)
- computed_at
- source (`online`, `onsite`, `manual`)

## Gestion scolaire présentielle

### courses

- id (PK)
- onsite_session_id (FK -> onsite_sessions.id)
- teacher_id (FK -> users.id)
- title
- description
- scheduled_at

### assignments

- id (PK)
- onsite_session_id (FK -> onsite_sessions.id)
- title
- description
- due_at
- max_score

### assignment_submissions

- id (PK)
- assignment_id (FK -> assignments.id)
- enrollment_id (FK -> enrollments.id)
- submitted_at
- storage_path
- status

### gradebook_entries

- id (PK)
- enrollment_id (FK -> enrollments.id)
- assignment_id (FK -> assignments.id, nullable)
- course_id (FK -> courses.id, nullable)
- grade_value
- grade_scale
- comment
- graded_by_user_id (FK -> users.id)
- graded_at

## Badges

### badges

- id (PK)
- code (`aventurier`, `debutant`, `intermediaire`, `semi_pro`, `professionnel`)
- label
- level_order
- asset_path
- is_active

### badge_rules

- id (PK)
- badge_id (FK -> badges.id)
- rule_type
- threshold_value
- configuration_json
- is_active

### user_badges

- id (PK)
- enrollment_id (FK -> enrollments.id)
- badge_id (FK -> badges.id)
- awarded_at
- reason

## Commerce, paiement et facturation

### orders

- id (PK)
- user_id (FK -> users.id)
- reference (unique)
- status (`pending`, `paid`, `partially_paid`, `failed`, `cancelled`)
- total_amount
- currency
- created_at

### order_items

- id (PK)
- order_id (FK -> orders.id)
- formation_id (FK -> formations.id)
- unit_price
- quantity

### payment_plans

- id (PK)
- order_id (FK -> orders.id)
- enrollment_id (FK -> enrollments.id)
- status (`pending`, `active`, `completed`, `defaulted`, `cancelled`)
- total_amount
- installments_count
- started_at

### payment_installments

- id (PK)
- payment_plan_id (FK -> payment_plans.id)
- installment_number
- due_date
- amount
- status (`pending`, `paid`, `late`, `cancelled`)
- paid_at

### payments

- id (PK)
- order_id (FK -> orders.id)
- payment_plan_id (FK -> payment_plans.id, nullable)
- installment_id (FK -> payment_installments.id, nullable)
- provider_code
- provider_reference
- amount
- currency
- status (`pending`, `confirmed`, `failed`, `refunded`)
- paid_at
- raw_payload_json

### invoices

- id (PK)
- user_id (FK -> users.id)
- order_id (FK -> orders.id)
- payment_id (FK -> payments.id, nullable)
- payment_plan_id (FK -> payment_plans.id, nullable)
- invoice_number (unique)
- invoice_type (`purchase`, `installment`, `final`)
- status (`issued`, `paid`, `cancelled`)
- amount
- pdf_path
- issued_at

## Notifications et rappels

### notifications

- id (PK)
- user_id (FK -> users.id)
- channel (`in_app`, `email`, `sms`)
- category (`payment`, `pedagogy`, `system`)
- title
- body
- status (`pending`, `sent`, `read`, `failed`)
- scheduled_for
- sent_at

### reminder_logs

- id (PK)
- user_id (FK -> users.id)
- payment_plan_id (FK -> payment_plans.id, nullable)
- installment_id (FK -> payment_installments.id, nullable)
- notification_id (FK -> notifications.id, nullable)
- reminder_type
- triggered_by (`system`, `admin`)
- triggered_at

## Administration et audit

### audit_logs

- id (PK)
- actor_user_id (FK -> users.id)
- action
- entity_type
- entity_id
- payload_json
- created_at

## Notes de modélisation

- `student_code` ne doit pas être recalculé depuis le frontend ;
- `orders`, `payments`, `payment_plans` et `invoices` doivent rester séparés ;
- `enrollments` est la vraie porte d'entrée des dashboards ;
- `progress_snapshots` permet de figer l'état métier au fil du temps ;
- les badges restent configurables grâce à `badge_rules`.
