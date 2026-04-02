# API cible

Base recommandée :

- `/api/v1`

Principes :

- endpoints versionnés ;
- auth par bearer token ;
- contrôle des rôles côté backend ;
- routes séparées par domaine métier ;
- webhooks de paiement isolés.

## Authentification

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

## Profil utilisateur

- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `GET /api/v1/me/roles`
- `GET /api/v1/me/notifications`
- `PATCH /api/v1/me/notifications/{notification_id}/read`

## Catalogue public

- `GET /api/v1/formations`
- `GET /api/v1/formations/{slug}`
- `GET /api/v1/formations/{id}/related`
- `GET /api/v1/categories`

## Commerce

- `POST /api/v1/cart/items`
- `GET /api/v1/cart`
- `DELETE /api/v1/cart/items/{item_id}`
- `POST /api/v1/checkout/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/{order_id}`

## Paiement et facturation

- `POST /api/v1/payments/initialize`
- `POST /api/v1/payments/webhooks/{provider_code}`
- `GET /api/v1/payments/{payment_id}`
- `GET /api/v1/payment-plans/{plan_id}`
- `GET /api/v1/payment-plans/{plan_id}/installments`
- `POST /api/v1/payment-plans/{plan_id}/installments/{installment_id}/pay`
- `GET /api/v1/invoices`
- `GET /api/v1/invoices/{invoice_id}`
- `GET /api/v1/invoices/{invoice_id}/download`

## Dashboard étudiant online

- `GET /api/v1/student/online/formations`
- `GET /api/v1/student/online/enrollments/{enrollment_id}`
- `GET /api/v1/student/online/enrollments/{enrollment_id}/modules`
- `GET /api/v1/student/online/lessons/{lesson_id}`
- `POST /api/v1/student/online/lessons/{lesson_id}/progress`
- `POST /api/v1/student/online/quizzes/{quiz_id}/attempts`
- `GET /api/v1/student/online/enrollments/{enrollment_id}/progress`

## Dashboard étudiant présentiel

- `GET /api/v1/student/onsite/enrollments`
- `GET /api/v1/student/onsite/enrollments/{enrollment_id}`
- `GET /api/v1/student/onsite/enrollments/{enrollment_id}/courses`
- `GET /api/v1/student/onsite/enrollments/{enrollment_id}/assignments`
- `GET /api/v1/student/onsite/enrollments/{enrollment_id}/grades`
- `GET /api/v1/student/onsite/enrollments/{enrollment_id}/payment-status`
- `GET /api/v1/student/onsite/enrollments/{enrollment_id}/student-code`

## Badges et progression

- `GET /api/v1/badges`
- `GET /api/v1/student/enrollments/{enrollment_id}/badges`
- `GET /api/v1/student/enrollments/{enrollment_id}/progress`
- `POST /api/v1/admin/enrollments/{enrollment_id}/recompute-progress`

## Dashboard enseignant

- `GET /api/v1/teacher/sessions`
- `GET /api/v1/teacher/sessions/{session_id}/students`
- `POST /api/v1/teacher/sessions/{session_id}/assignments`
- `PATCH /api/v1/teacher/assignments/{assignment_id}`
- `POST /api/v1/teacher/assignments/{assignment_id}/grades`
- `GET /api/v1/teacher/courses`
- `POST /api/v1/teacher/courses`

## Administration

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{user_id}`
- `PATCH /api/v1/admin/users/{user_id}/roles`
- `GET /api/v1/admin/formations`
- `POST /api/v1/admin/formations`
- `PATCH /api/v1/admin/formations/{formation_id}`
- `POST /api/v1/admin/onsite-sessions`
- `PATCH /api/v1/admin/payment-plans/{plan_id}`
- `POST /api/v1/admin/payment-plans/{plan_id}/reminders`
- `GET /api/v1/admin/stats/overview`

## Conventions d'accès

- `public` : catalogue et authentification ;
- `student` : dashboards personnels ;
- `teacher` : ressources pédagogiques affectées ;
- `admin` : administration globale ;
- les routes admin ne doivent jamais être exposées selon une logique purement frontend.
