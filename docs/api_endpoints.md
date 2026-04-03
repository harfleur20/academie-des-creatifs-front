# API cible

Base :

- `/api/v1`

Principes :

- endpoints versionnes ;
- authentification par session HTTPOnly ;
- controle des roles cote backend ;
- routes separees par domaine metier.

## Authentification

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## Catalogue public

- `GET /api/v1/formations`
- `GET /api/v1/formations/{slug}`

Chaque formation expose :

- `format_type` (`live`, `ligne`, `presentiel`)
- `dashboard_type` (`classic`, `guided`)
- `current_price_amount`
- `original_price_amount`
- `badges`

## Commerce

- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `DELETE /api/v1/cart/items/{formation_slug}`
- `POST /api/v1/cart/checkout`

Le checkout cree :

- une commande ;
- un paiement mock ;
- une ou plusieurs inscriptions ;
- un `student_code` si le format est `presentiel`.

## Profil connecte

- `GET /api/v1/me/dashboard`
- `GET /api/v1/me/enrollments`

Le dashboard retourne :

- comptes par format `live`, `ligne`, `presentiel`
- comptes par dashboard `classic`, `guided`
- listes `classic_enrollments` et `guided_enrollments`

## Dashboard enseignant

- `GET /api/v1/teacher/sessions`
- `GET /api/v1/teacher/sessions/{session_id}/students`
- `POST /api/v1/teacher/sessions/{session_id}/assignments`
- `POST /api/v1/teacher/assignments/{assignment_id}/grades`

## Administration

- `GET /api/v1/admin/stats/overview`
- `GET /api/v1/admin/formations`
- `POST /api/v1/admin/formations`
- `PATCH /api/v1/admin/formations/{slug}`
- `GET /api/v1/admin/onsite-sessions`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/payments`

Regles admin sur les formations :

- `premium` et `populaire` sont manuels ;
- `promo` est derive automatiquement du prix barre ;
- `format_type` pilote automatiquement `dashboard_type` ;
- `presentiel` + prix > `90 000 FCFA` active les tranches.

## Conventions d'acces

- `public` : catalogue
- `authenticated` : panier, checkout, espace personnel
- `teacher` : ressources pedagogiques affectees
- `admin` : administration globale

Les routes admin ne doivent jamais dependre d'un controle frontend seul.
