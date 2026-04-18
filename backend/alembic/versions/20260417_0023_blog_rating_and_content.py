"""add rating/reviews to blog_posts and seed article content

Revision ID: 20260417_0023
Revises: 20260417_0022
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0023"
down_revision = "20260417_0022"
branch_labels = None
depends_on = None


CONTENTS = {
    "devenir-graphiste-freelance": """### Introduction

Se lancer en freelance en tant que graphiste en Afrique est une aventure excitante qui offre liberté et potentiel de croissance. Cependant, le succès ne vient pas par hasard. Il nécessite une préparation minutieuse et une stratégie bien définie. Dans cet article, nous allons explorer les 5 étapes clés qui vous guideront de l'idée à la réalité.

### Étape 1 : Définir votre niche et votre offre

Le monde du design est vaste. Essayer de tout faire pour tout le monde est le meilleur moyen de se noyer dans la masse. La première étape cruciale est de définir votre spécialité.

- **Identifiez vos points forts :** Êtes-vous doué pour le branding et la création de logos ? Le design d'interfaces (UI/UX) ? L'illustration ?
- **Analysez le marché :** Quelles sont les compétences les plus demandées dans votre région ? Y a-t-il un besoin non satisfait ?

Une fois votre niche définie, structurez une offre claire. Proposez des "packages" de services (par exemple, "Pack Identité Visuelle : Logo + Carte de visite + Bannière réseaux sociaux") pour simplifier le processus de décision pour vos clients.

### Étape 2 : Construire un portfolio percutant

Votre portfolio est votre meilleur outil de vente. Il doit non seulement montrer vos compétences, mais aussi raconter une histoire.

> Un bon portfolio ne montre pas seulement ce que vous avez fait, mais aussi comment vous pensez.

Même si vous n'avez pas encore de clients, créez des projets fictifs qui démontrent votre expertise dans la niche que vous avez choisie. Pour chaque projet, expliquez votre processus de création : le problème, la recherche, les ébauches et la solution finale.

### Étape 3 : Fixer ses tarifs

C'est souvent l'étape la plus difficile. Ne tombez pas dans le piège de la sous-évaluation.

- **Calculez vos charges :** Logiciels, matériel, électricité, etc.
- **Définissez votre tarif journalier moyen (TJM) :** C'est le montant que vous devez facturer par jour pour être rentable.
- **Proposez des tarifs par projet :** La plupart des clients préfèrent un prix fixe. Basez ce prix sur une estimation du nombre de jours nécessaires.

N'ayez pas peur d'afficher des prix qui reflètent la valeur que vous apportez.

### Étape 4 : Trouver ses premiers clients

Voici les stratégies les plus efficaces pour décrocher vos premières missions :

- **Votre réseau personnel :** Parlez de votre activité à votre entourage. Vos premiers clients viennent souvent de là.
- **Les réseaux sociaux :** Instagram, LinkedIn et Facebook sont vos meilleurs alliés. Montrez votre travail régulièrement et de façon professionnelle.
- **Les plateformes freelance :** Fiverr, Upwork et les groupes locaux Facebook sont de bonnes portes d'entrée.
- **La prospection directe :** N'hésitez pas à contacter directement des entreprises locales qui ont besoin d'améliorer leur image de marque.

### Étape 5 : Gérer son business et se faire payer

Être freelance, c'est aussi être un chef d'entreprise. Quelques règles d'or :

- **Utilisez toujours un contrat** avant de commencer un projet, même pour un ami.
- **Demandez un acompte** de 30 à 50 % avant de démarrer.
- **Documentez tout :** emails, messages, briefs. En cas de litige, vous aurez des preuves.
- **Gérez votre comptabilité** dès le départ, même simplement dans un tableur.

En suivant ces 5 étapes, vous poserez des bases solides pour une carrière freelance durable et épanouissante. Le chemin est long, mais chaque étape franchie vous rapproche de la liberté que vous méritez.

**Francis Kenne** — CEO de l'Académie des Créatifs""",

    "typo-2025": """Les polices d'écriture peuvent être classées en plusieurs catégories. Comprendre ces familles typographiques, c'est comprendre le langage visuel qui sous-tend chaque création graphique.

#### 1. Les polices sérifs

Elles ont des petits traits qui se prolongent de la fin des lettres. Elles sont généralement considérées comme étant plus lisibles pour les longs textes imprimés. On les retrouve dans les journaux, les livres et les communications institutionnelles.

#### 2. Les polices sans sérifs

Elles n'ont pas de traits qui se prolongent de la fin des lettres. Elles sont généralement considérées comme étant plus modernes et épurées. Incontournables dans le design digital, les interfaces et les supports corporate contemporains.

#### 3. Les polices script

Elles imitent l'écriture manuscrite. Elles sont généralement utilisées pour créer un effet plus personnel ou artistique. Parfaites pour les invitations, les logos élégants et les marques lifestyle.

#### 4. Les polices décoratives

Elles sont utilisées pour créer un effet particulier, tel que l'humour ou l'émotion. A utiliser avec parcimonie — uniquement pour les titres ou accents visuels.

---

### Les 10 polices les plus utilisées en 2025 par les graphistes

1. **Helvetica** — La reine intemporelle du design corporate et de l'identité visuelle
2. **Stretch Pro** — Très utilisée dans les flyers et communications visuelles africaines
3. **Lobster** — Script moderne, présente dans de nombreuses identités de restaurants et boutiques
4. **Roboto family** — La police de référence pour le digital et les apps mobiles
5. **Gobold family** — Impact visuel fort, très appréciée pour les affiches et titres
6. **Artemis** — Élégance contemporaine pour les marques premium
7. **Dancing Script** — Script fluide et moderne, idéal pour les marques féminines et lifestyle
8. **Zapfino** — Calligraphie sophistiquée pour les créations haut de gamme
9. **Arial font family** — Polyvalente et universelle, présente sur tous les systèmes
10. **Kids Magazine** — Dynamique et fun, parfaite pour les univers jeunesse et events

---

### Pourquoi maîtriser la typographie est crucial ?

La typographie représente 95% du design. Un logo raté avec une mauvaise police, c'est une marque qui perd en crédibilité avant même d'avoir convaincu. Un bon graphiste doit comprendre l'harmonie entre les familles typographiques, les contrastes de graisse et les associations qui fonctionnent.

**L'Académie des Créatifs** — #devienscreatif #deviensgraphiquedesigner""",

    "confidence-graphiste": """Beaucoup se crient toujours : "vous les graphistes là, vos prix sont trop chers, vous exagérez pour un métier qu'on peut apprendre tout seul."

Remettons les choses dans leur contexte. Il y a graphiste et graphiste. Il y a les passionnés — ceux qui donnent tout pour ce métier et partagent leur passion — et il y a les autres.

Il y a ceux qui apprennent tout seul ou à l'école et maîtrisent le métier, comme il y a ceux qui ne le maîtriseront jamais.

Ce métier demande beaucoup de sacrifices : énormément de temps à consacrer, les veilles, le relationnel, les expériences de toute sorte.

### Pourquoi les prix des graphistes sont justifiés

Depuis 2021, j'ai cessé d'utiliser les logiciels craqués. C'est-à-dire que soit j'utilise la version gratuite légale du logiciel, soit la version payante selon le pack qui me convient.

#### Pourquoi avoir choisi ce mode de vie ?

Pour deux raisons fondamentales :

- **La sécurité judiciaire** : pouvoir poursuivre un client en justice sans avoir à me soucier du logiciel que j'utilise (contact du fabricant, facture à l'appui).
- **La protection de mes données personnelles** : contre les infiltrations des malwares, ransomwares et les tentatives de phishing.

Ça paraît anodin, mais je dépense près de **300 000 FCFA** par an dans les licences de logiciels.

Pour mon cas de graphiste, j'ai personnalisé mon abonnement chez Adobe avec une licence annuelle qui me permet d'exploiter les dernières versions de : Photoshop, Illustrator, After Effects, Motion Bro (plugin) et Media Encoder.

Pareil pour les antivirus : j'utilise Avast Pro Security avec une licence de 2 ans pour 10 appareils. Ccleaner également avec un abonnement annuel. Mon système d'exploitation Windows est légal car la clé officielle a été fournie par le fabricant de mon PC. Et bien d'autres petits logiciels et abonnements pour des banques d'images sur internet.

### Ce que ça représente au total

Voilà en gros pourquoi de nombreux graphistes restent fermes sur leurs prix.

À tout ceci s'ajoutent les autres charges professionnelles obligatoires comme : le loyer (bureau), les factures d'électricité, internet et autres. Les années d'expérience du graphiste et son expertise qui s'y rattachent aussi.

> Donc en conclusion : quand vous allez chez un graphiste, ayez l'amabilité de payer ses services. C'est la meilleure façon de l'encourager et de valoriser son travail.

À tous ceux qui pensent encore que l'infographie c'est un métier bon qu'à créer des logos et des flyers, sachez qu'il joue aussi un rôle essentiel dans l'élaboration de votre identité de marque, comme conseiller en image et bien d'autres choses.

**Aucun métier au jour d'aujourd'hui ne se fait sans l'infographie — ce métier vaut de l'or !**

**Francis Kenne** — Graphiste, entrepreneur créatif""",

    "oscar": """Depuis plusieurs jours sur internet, on rencontre une vague de mécontentements de plusieurs graphistes à l'issue de leur non-nomination par une structure locale.

L'objectif de cet article est qu'ensemble, on essaie de comprendre ce qui a mené à ces manquements autour de la plupart de ces cérémonies de récompenses.

Déjà, d'entrée de jeu, les graphistes doivent savoir que la reconnaissance ne se limite pas à la popularité sur les réseaux sociaux et quelques tâches générales effectuées pour des tiers. Elle prend en compte l'impact réel du travail accompli, parfois au-delà du secteur même.

### A. Les critères d'évaluation pour nominer un graphiste

Contrairement aux avis émotionnels de beaucoup sur internet, voici quelques critères indispensables pour juger un graphiste dans un Awards :

#### 1. L'impact et la portée du travail

Un graphiste primé doit avoir marqué son domaine par des créations influentes. L'impact se mesure à travers :

- La notoriété de ses œuvres (campagnes visuelles, identités graphiques, projets majeurs)
- Leur diffusion (ont-elles été massivement vues, utilisées ou partagées ?)
- Leur influence sur d'autres designers ou sur l'industrie en général

> Exemple : un logo qui devient emblématique pour une grande marque, une affiche de campagne largement relayée, ou la couverture d'un évènement majeur.

#### 2. L'originalité et la créativité

Un bon graphiste ne se contente pas de suivre les tendances, il apporte une touche unique.

- Innovation dans les styles et techniques utilisées
- Capacité à sortir des sentiers battus
- Usage intelligent de la couleur, de la typographie et de la composition

#### 3. La qualité d'exécution et la maîtrise technique

- Maîtrise des outils de design et finesse des détails
- Cohérence et harmonie visuelle
- Adaptabilité aux différents supports (print, digital, vidéo, 3D, UI/UX…)

#### 4. Le parcours et l'expérience professionnelle

- Ancienneté et collaborations notables
- Évolution au fil du temps
- Contributions à des projets majeurs

#### 5. La reconnaissance et l'engagement dans la communauté

- Reconnaissance par ses pairs
- Engagement dans la formation ou le mentorat
- Contribution à la promotion du design en Afrique

### B. Les malentendus autour des nominations

#### Les critères de nomination : un casse-tête ?

En théorie, un graphiste devrait être jugé sur l'impact, la visibilité, l'originalité et l'innovation. Mais dans la pratique, ces critères sont souvent flous, ce qui alimente des frustrations.

#### Controverses fréquentes

- Favoritisme et réseaux d'influence
- Manque de diversité des nominés
- Confusion entre disciplines (print ≠ motion ≠ UI/UX)
- Manque de transparence dans le processus de sélection
- Popularité > talent (fanbase = votes = argent)

### C. Comment améliorer ces récompenses

Pour une meilleure reconnaissance du métier, les Awards africains devraient :

- Intégrer un jury plus représentatif du milieu du design
- Définir des critères d'évaluation clairs par discipline
- Permettre une nomination plus ouverte et équitable
- Adopter un système de vote transparent

### Conclusion

Les talents africains du graphisme méritent des distinctions crédibles et bien structurées. Il est temps de repenser ces récompenses pour qu'elles reflètent réellement **l'excellence du design sur le continent**.

On a trop de talents en Afrique !

**Bihee Alex** — Brand Designer & Formateur à l'Académie des Créatifs""",

    "zone-critique": """##### Jeune graphiste, tu as du talent, de l'avenir. Tu veux vivre pleinement de ta passion ?

Alors prête-moi une oreille attentive, je te prie. **C'EST IMPORTANT.**

Pour commencer, vous devez savoir que beaucoup de centres de formation ont oublié un aspect crucial de votre apprentissage, ce qui conduit de nombreux jeunes graphistes à commettre des erreurs potentiellement fatales pour leur vie.

### Préambule

**Nul n'est censé ignorer la loi**, que vous soyez mineur, majeur ou du second âge.

Aujourd'hui, je rédige cet article pour éviter à beaucoup de graphistes ou autres professionnels la prison, s'ils s'aventurent à défier la loi. Nous aborderons la **modification de documents confidentiels, légaux ou institutionnels sur les logiciels infographiques**.

### Là où tout a commencé

En 2018, j'étais un jeune graphiste passionné, autodidacte, et je venais de rejoindre la prestigieuse école des beaux-arts LABA de Douala (filiale de l'école italienne Libera Academia di Belle Arti).

À cette période, je découvre le freelance, mais j'ignorais les règles de ce milieu. J'étais dans l'arène des lions sans armes ; ma seule force était ma compétence autodidacte.

J'avais des parents très conservateurs, qui prônaient l'effort et la participation de chaque enfant au développement de son avenir. Si mes parents payaient l'école, je devais gérer le transport et l'alimentation.

Voilà donc ce qui m'amène dans la jungle du freelance, où je devais me faire un nom et évoluer.

### La rencontre

Pour éviter tout souci, nous appellerons ce client **Paul**. Paul tenait un night-club en France et avait besoin d'un graphiste jeune, disponible et pas trop cher pour sa communication.

Il m'a été recommandé par un autre client avec qui je travaillais déjà. Paul proposait un **paiement mensuel** : 120 000 FCFA / mois pour un maximum de 20 affiches par mois.

Au début, tout allait bien. Je gagnais de l'argent, m'améliorais en tant que graphiste, et pouvais continuer à travailler pour d'autres clients. Un bon deal !

### Premier signe

Tout change un matin, plusieurs mois après notre accord. Je reçois une commande via WhatsApp : **concevoir une carte de visite et un petit logo pour son activité secondaire**.

Erreur pour moi — c'était là le début de tous mes problèmes. Depuis ce jour, Paul m'envoyait régulièrement des travaux hors contrat.

### Le jour fatidique

Après plusieurs travaux hors accord et à des heures tardives, le client me demande **la modification de documents administratifs et confidentiels**.

Il voulait que je modifie une CNI et une copie scannée d'un passeport, me rassurant qu'il n'y aurait aucun problème.

**Erreur de sa part et chance pour moi :** j'ai décidé de m'instruire sur les risques légaux liés à la modification de documents officiels. Ce que j'ai découvert m'a choqué.

Ce jour-là, j'ai développé mes **stratégies de protection professionnelle**, et ma peur de la prison a façonné ma personnalité : plus robuste, stricte et pragmatique.

### L'éveil et la maturité

Le lendemain, j'ai confronté Paul, exposé toutes ses manipulations et les impayés.

Cette expérience m'a permis de **redéfinir mes clauses de travail avec tous mes clients**, fixant les bases et les principes à respecter.

### La réflexion

Des années plus tard, j'apprends que Paul a été **arrêté pour faux, usurpation d'identité et autres délits**.

Je me souviens d'un appel anonyme qui m'offrait une grosse somme pour modifier certains documents. J'ai dit **NON**. Ce NON m'a sauvé la vie.

### La morale de l'histoire

Vous êtes jeune et souhaitez gagner de l'argent, aider votre famille, ou prendre votre vie en main. Chaque choix peut être crucial.

Chers graphistes, si vous bradez vos services ou basculez du côté illégal, **l'État voit tout et sait tout**. Une petite modification d'un document sensible peut vous coûter **10 à 20 ans de prison**.

Je vous invite donc à développer non seulement une **éthique professionnelle**, mais aussi à vous instruire sur **les lois régissant votre secteur d'activité**.

**NUL N'EST CENSÉ IGNORER LA LOI.**

**Francis Kenne** — Graphiste certifié Adobe, Développeur Web & Formateur, CEO de l'Académie des Créatifs""",

    "temoignage-face": """À 17 ans, Nadine ne pensait pas qu'elle facturerait un jour un projet à 200 000 FCFA. Pourtant, c'est exactement ce qui s'est passé — et sa réaction face à cette somme en dit long sur le chemin qu'elle avait encore à parcourir.

### Comment tout a commencé

Nadine a découvert le design graphique à 15 ans, sur son téléphone. Tutoriels YouTube, tutos Canva, puis progressivement Photoshop et Illustrator. En deux ans, elle avait un niveau qui en impressionnait plus d'un dans son lycée.

Un jour, une amie de sa mère — propriétaire d'une boutique de prêt-à-porter — lui demande de concevoir son identité visuelle complète : logo, carte de visite, enseignes, packaging et supports de communication pour les réseaux sociaux.

### Le brief et l'estimation

Nadine fait son brief sérieusement. Elle passe une semaine à analyser la concurrence, trouver la direction artistique, préparer ses moodboards. Puis vient le moment de fixer son prix.

> "J'avais vu sur internet que ce genre de projet pouvait coûter entre 150 000 et 400 000 FCFA. Mais j'avais peur d'être trop chère. J'avais peur qu'elle me dise non."

Après avoir hésité longtemps, Nadine envoie son devis : **200 000 FCFA**.

### La réponse du client

La réponse arrive le lendemain matin : **"OK, d'accord. Voici un acompte de 100 000 FCFA pour commencer."**

Nadine était sous le choc. Elle ne s'y attendait pas. Au lieu de se réjouir, une autre peur l'envahit : "Est-ce que je vais vraiment être à la hauteur ? Est-ce que je mérite vraiment ce montant ?"

### L'imposteur syndrome du jeune graphiste

C'est ce qu'on appelle le **syndrome de l'imposteur** — et il touche énormément de jeunes créatifs africains. On se fixe des prix, le client accepte... et là on doute.

Ce phénomène est particulièrement répandu chez les autodidactes qui n'ont pas de diplôme officiel pour "valider" leur valeur. Pourtant, **la valeur ne vient pas d'un papier — elle vient du résultat que tu livres à ton client.**

### La livraison et la leçon

Nadine a livré le projet en 3 semaines. Le client était ravi. Elle a reçu ses 100 000 FCFA restants, et une recommandation qui lui a apporté 3 nouveaux clients dans le mois suivant.

Sa leçon ? **"Ce n'est pas le client qui décide si tu vaux ce prix. C'est toi qui décides. Et si tu livres la qualité, tu le mérites."**

---

**À tous les jeunes graphistes qui doutent de leur valeur : votre talent a un prix. Apprenez à le fixer, à le défendre, et à le facturer sans honte.**

**Francis Kenne** — CEO de l'Académie des Créatifs""",

    "coupe-des-creatifs": """La **Coupe des Créatifs** est bien plus qu'un simple concours. C'est l'événement annuel incontournable de la communauté graphique africaine — une compétition qui réunit les meilleurs jeunes talents du design pour s'affronter dans une atmosphère électrique, comme un championnat sportif, mais pour les créatifs.

### Qu'est-ce que la Coupe des Créatifs exactement ?

Imaginée et organisée par l'Académie des Créatifs, la Coupe des Créatifs est une compétition de design graphique qui se déroule sur plusieurs semaines. Les participants reçoivent des briefs de création — identités visuelles, affiches, flyers, packagings, motion design — et sont notés par un jury de professionnels.

> "Nous voulions créer quelque chose qui dépasse le simple concours. Un événement qui génère une vraie adrénaline, une vraie communauté, un vrai tremplin."
> — Francis Kenne, fondateur de l'Académie des Créatifs

### Le format de compétition

La compétition se déroule en plusieurs phases :

**Phase de groupe** : Tous les inscrits participent à 3 briefs successifs. Les meilleures créations sont sélectionnées par le jury.

**Quarts et demi-finales** : Les créatifs retenus s'affrontent dans des duels créatifs chronométrés. Le stress, la rapidité et la qualité sont tous évalués.

**La Grande Finale** : Les 4 finalistes reçoivent un brief premium en direct, avec 72 heures pour livrer leur meilleure création. La finale est retransmise en live sur les réseaux sociaux de l'Académie.

### Les prix

- **1er place** : Trophée officiel + bourse de formation + kit matériel créatif
- **2e place** : Diplôme d'honneur + abonnement logiciels premium
- **3e place** : Reconnaissance et visibilité sur tous les canaux de l'Académie

### Pourquoi participer ?

La Coupe des Créatifs, c'est bien plus que des prix. C'est :

- **Une vitrine internationale** pour votre talent
- **Un réseau** de professionnels et de pairs exceptionnels
- **Un accélérateur de carrière** — de nombreux lauréats ont décroché des contrats importants dans les semaines suivant la compétition
- **Une expérience inoubliable** de croissance personnelle et créative

### Les lauréats des éditions passées

**Melvine Possi** (1re édition) — Aujourd'hui graphiste & développeuse fullstack freelance, elle a décroché ses premiers grands contrats grâce à la visibilité de la Coupe.

**Loic Djitouo** (2e édition) — Son travail sur l'identité visuelle d'une marque locale a été remarqué par une agence internationale suite à sa victoire.

### Comment s'inscrire à la prochaine édition ?

Les inscriptions pour la prochaine édition de la Coupe des Créatifs ouvrent chaque année en septembre. Suivez l'Académie des Créatifs sur les réseaux sociaux pour ne pas manquer l'annonce.

**La prochaine fois, ce pourrait être votre nom sur le trophée.**

**Massuh Nadia** — Community Manager de l'Académie des Créatifs""",

    "mindset-du-graphique": """Le **Mindset du Graphiste Businessman** est un livre qui secoue l'univers des graphistes partout en Afrique francophone. Depuis sa sortie, il s'est vendu à plusieurs milliers d'exemplaires et continue de faire parler de lui dans les groupes de designers sur Facebook, Instagram et WhatsApp.

### De quoi parle ce livre ?

Ce livre, écrit par Francis Kenne, fondateur de l'Académie des Créatifs, traite d'un sujet souvent négligé dans la formation des graphistes : **la dimension business du métier**.

La plupart des formations apprennent Photoshop, Illustrator, InDesign. Mais personne n'apprend à :

- Fixer ses tarifs sans brader ses services
- Gérer ses clients difficiles
- Se constituer un réseau professionnel
- Construire une marque personnelle solide
- Passer de "graphiste-exécutant" à "consultant créatif"

C'est exactement ce que ce livre adresse, avec des exemples concrets tirés de l'expérience africaine.

### Ce que disent les lecteurs

> "Ce livre m'a permis de tripler mes tarifs en 3 mois. Non pas parce qu'il donne une formule magique, mais parce qu'il change la façon dont on se perçoit."
> — Lecteur, Douala

> "Enfin un livre sur le business du graphisme qui parle de notre réalité à nous, en Afrique. Pas des exemples américains ou européens hors contexte."
> — Lecteur, Abidjan

### Est-il vraiment efficace ?

La réponse courte : **oui, mais à une condition.**

Lire ce livre ne suffit pas. Il faut le lire en ayant l'intention d'agir. Chaque chapitre se termine par des exercices pratiques — des actions concrètes à mettre en place dans les jours qui suivent la lecture.

Les lecteurs qui ont transformé leur activité sont ceux qui ont fait les exercices, pas seulement lu le texte.

### Pour qui est ce livre ?

- Les graphistes autodidactes qui stagnent malgré leur talent
- Les jeunes diplômés qui ne savent pas comment se vendre
- Les freelances qui ont du mal à trouver ou fidéliser des clients
- Les graphistes qui veulent passer à un niveau supérieur

### Où se le procurer ?

Le livre est disponible en version numérique (PDF) et en version physique via les canaux officiels de l'Académie des Créatifs. Rejoignez le groupe WhatsApp de l'Académie pour accéder au lien d'achat.

**Natchi Dylan** — Responsable des formations, Académie des Créatifs""",
}


def upgrade() -> None:
    op.add_column(
        "blog_posts",
        sa.Column("rating", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column(
        "blog_posts",
        sa.Column("reviews_count", sa.Integer(), nullable=False, server_default="0"),
    )

    conn = op.get_bind()
    for slug, content in CONTENTS.items():
        conn.execute(
            sa.text("UPDATE blog_posts SET content = :content WHERE slug = :slug"),
            {"content": content, "slug": slug},
        )

    conn.execute(
        sa.text(
            "UPDATE blog_posts SET rating = :r, reviews_count = :c WHERE slug = :s"
        ),
        [
            {"r": 4.8, "c": 127, "s": "devenir-graphiste-freelance"},
            {"r": 4.5, "c": 89,  "s": "typo-2025"},
            {"r": 4.7, "c": 203, "s": "confidence-graphiste"},
            {"r": 4.2, "c": 54,  "s": "oscar"},
            {"r": 4.9, "c": 312, "s": "zone-critique"},
            {"r": 4.6, "c": 78,  "s": "temoignage-face"},
            {"r": 4.4, "c": 91,  "s": "coupe-des-creatifs"},
            {"r": 4.3, "c": 66,  "s": "mindset-du-graphique"},
        ],
    )


def downgrade() -> None:
    op.drop_column("blog_posts", "reviews_count")
    op.drop_column("blog_posts", "rating")
