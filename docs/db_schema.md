# Schema de donnees cible

## Principes

- une seule base pour commerce, apprentissage et gestion scolaire ;
- les tables doivent distinguer `catalogue`, `achat`, `inscription`, `paiement`, `progression` et `evaluation` ;
- les regles metier sensibles doivent rester auditables ;
- le modele doit accepter plusieurs roles par utilisateur ;
- le catalogue doit distinguer le format pedagogique et le type de dashboard.

## Utilisateurs et acces

### users

- id (PK)
- full_name
- email (unique)
- phone
- password_hash
- role principal (`student`, `teacher`, `admin`)
- status
- student_code (nullable, unique)
- created_at
- updated_at

### auth_sessions

- id (PK)
- user_id (FK -> users.id)
- token_hash
- expires_at
- revoked_at
- created_at

### student_code_counters

- id (PK)
- year (unique)
- last_sequence

## Catalogue

### formations

- id (PK)
- slug (unique)
- title
- category
- level
- image
- format_type (`live`, `ligne`, `presentiel`)
- dashboard_type (`classic`, `guided`)
- session_label
- current_price_amount
- original_price_amount (nullable)
- price_currency
- allow_installments (bool)
- rating
- reviews
- badges (JSON: `premium`, `populaire`; `promo` derive)
- created_at
- updated_at

Regles de derivation :

- `ligne` -> `dashboard_type = classic`
- `live` -> `dashboard_type = guided`
- `presentiel` -> `dashboard_type = guided`
- `allow_installments = true` seulement pour `presentiel` au-dessus de `90 000 FCFA`
- `promo` est derive si `original_price_amount > current_price_amount`

### onsite_sessions

- id (PK)
- formation_title
- label
- start_date
- campus_label
- seat_capacity
- enrolled_count
- teacher_name
- status
- created_at
- updated_at

## Contenu pedagogique classique

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

### quizzes

- id (PK)
- formation_id (FK -> formations.id)
- module_id (FK -> course_modules.id, nullable)
- title
- passing_score

## Inscriptions et progression

### enrollments

- id (PK)
- user_id (FK -> users.id)
- formation_id (FK -> formations.id)
- order_reference
- format_type (`live`, `ligne`, `presentiel`)
- dashboard_type (`classic`, `guided`)
- status (`pending`, `active`, `suspended`, `completed`, `cancelled`)
- created_at
- updated_at

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
- source (`classic`, `guided`, `manual`)

## Gestion guidee et presentielle

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

## Commerce, panier, paiement et facturation

### cart_items

- id (PK)
- user_id (FK -> users.id)
- formation_id (FK -> formations.id)
- created_at

### orders

- id (PK)
- reference (unique)
- user_id (FK -> users.id, nullable)
- formation_id (FK -> formations.id, nullable)
- customer_name
- formation_title
- format_type (`live`, `ligne`, `presentiel`)
- dashboard_type (`classic`, `guided`)
- total_amount
- currency
- status (`pending`, `paid`, `partially_paid`, `failed`, `cancelled`)
- created_at
- updated_at

### payments

- id (PK)
- order_reference
- payer_name
- amount
- currency
- provider_code
- status (`pending`, `confirmed`, `failed`)
- paid_at
- created_at
- updated_at
