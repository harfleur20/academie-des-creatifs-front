"""create blog_posts table and seed initial posts

Revision ID: 20260417_0021
Revises: 20260417_0020
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0021"
down_revision = "20260417_0020"
branch_labels = None
depends_on = None

SEED_POSTS = [
    {
        "slug": "devenir-graphiste-freelance",
        "title": "Les 5 étapes clés pour devenir graphiste freelance en Afrique",
        "excerpt": "Se lancer en freelance peut sembler intimidant, mais avec la bonne méthode et les bons outils, tu peux bâtir une activité solide et rentable.",
        "cover_image": "/images-blog/img-couleur.jpg",
        "author": "Francis Kenne",
        "category": "Freelance",
        "is_featured": True,
        "is_popular": True,
        "published_at": "27 août 2025",
    },
    {
        "slug": "typo-2025",
        "title": "Voici 10 typo les plus utilisées en 2025 au Cameroun par les graphistes",
        "excerpt": "Les polices d'écriture peuvent être classées en plusieurs catégories. Dans cet article, on explore les 10 typographies incontournables du moment.",
        "cover_image": "/images-blog/typo-2025/typo-2025.jpg",
        "author": "Francis Kenne",
        "category": "Design Graphique",
        "is_featured": False,
        "is_popular": True,
        "published_at": "22 août 2025",
    },
    {
        "slug": "confidence-graphiste",
        "title": "Les réalités du design graphique en Afrique",
        "excerpt": "Les réalités du design graphique en Afrique — Témoignage poignant d'un graphiste professionnel sur les défis du métier.",
        "cover_image": "/images-blog/confidence-graphiste.jpg",
        "author": "Francis Kenne",
        "category": "Freelance",
        "is_featured": False,
        "is_popular": True,
        "published_at": "31 août 2025",
    },
    {
        "slug": "oscar",
        "title": "Voici pourquoi plusieurs récompenses pour la plupart des graphistes posent problème",
        "excerpt": "Depuis plusieurs jours sur internet, on rencontre une vague de mécontentements sur les récompenses accordées aux graphistes africains.",
        "cover_image": "/images-blog/oscar.jpg",
        "author": "Bihee Alex",
        "category": "Freelance",
        "is_featured": False,
        "is_popular": False,
        "published_at": "22 août 2025",
    },
    {
        "slug": "mindset-du-graphique",
        "title": "Le Mindset du graphiste businessman — un livre vraiment efficace ?",
        "excerpt": "À la découverte du livre qui secoue l'univers des graphistes partout en Afrique francophone.",
        "cover_image": "/images-blog/Mockup-Livre.jpg",
        "author": "Natchi Dylan",
        "category": "Découverte",
        "is_featured": False,
        "is_popular": False,
        "published_at": "25 novembre 2025",
    },
    {
        "slug": "zone-critique",
        "title": "Voici comment le design graphique a failli m'envoyer en prison",
        "excerpt": "Découvrez comment mon histoire pourrait te sauver la vie, jeune graphiste. Une leçon sur les droits d'auteur et la propriété intellectuelle.",
        "cover_image": "/images-blog/zone.jpg",
        "author": "Francis Kenne",
        "category": "Freelance",
        "is_featured": False,
        "is_popular": True,
        "published_at": "24 avril 2025",
    },
    {
        "slug": "temoignage-face",
        "title": "Il facture un projet graphique à 200 000f à 17 ans mais a peur de la somme",
        "excerpt": "À 17 ans, Nadine jeune graphiste facture son premier gros contrat grâce à ses idées de facturation venues d'internet.",
        "cover_image": "/images-blog/img-graphiste.webp",
        "author": "Francis Kenne",
        "category": "Design Graphique",
        "is_featured": False,
        "is_popular": True,
        "published_at": "22 mai 2025",
    },
    {
        "slug": "coupe-des-creatifs",
        "title": "Qu'est-ce que la coupe des créatifs — Le Esport des graphistes ?",
        "excerpt": "La compétition qui regroupe les meilleurs jeunes graphistes de la communauté créative africaine.",
        "cover_image": "/images-blog/coupe-des-creatifs.jpg",
        "author": "Massuh Nadia",
        "category": "Découverte",
        "is_featured": True,
        "is_popular": True,
        "published_at": "03 septembre 2025",
    },
]


def upgrade() -> None:
    op.create_table(
        "blog_posts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("excerpt", sa.Text, nullable=False, server_default=""),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("cover_image", sa.String(500), nullable=False, server_default=""),
        sa.Column("author", sa.String(180), nullable=False, server_default="Francis Kenne"),
        sa.Column("category", sa.String(120), nullable=False, server_default=""),
        sa.Column("is_featured", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_popular", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("published_at", sa.String(120), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    blog_posts = sa.table(
        "blog_posts",
        sa.column("slug", sa.String),
        sa.column("title", sa.String),
        sa.column("excerpt", sa.Text),
        sa.column("content", sa.Text),
        sa.column("cover_image", sa.String),
        sa.column("author", sa.String),
        sa.column("category", sa.String),
        sa.column("is_featured", sa.Boolean),
        sa.column("is_popular", sa.Boolean),
        sa.column("published_at", sa.String),
    )

    op.bulk_insert(blog_posts, [
        {**p, "content": ""} for p in SEED_POSTS
    ])


def downgrade() -> None:
    op.drop_table("blog_posts")
