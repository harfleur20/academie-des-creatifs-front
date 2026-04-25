"""Transactional email service.

Priority:
  1. Resend REST API  — when RESEND_API_KEY is set
  2. SMTP             — when SMTP_HOST is set
  3. Console log      — dev/fallback mode

All sends are fire-and-forget in a daemon thread so they never block a response.
"""
from __future__ import annotations

import logging
import smtplib
import threading
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Shared palette ──────────────────────────────────────────────
_ACCENT = "#6366f1"
_DARK = "#1f2937"
_MUTED = "#6b7280"
_BG = "#f9fafb"


# ── Low-level send ───────────────────────────────────────────────
def _send_via_resend(to: str, subject: str, html: str, text: str) -> None:
    payload: dict = {
        "from": f"{settings.smtp_from_name} <{settings.smtp_from}>",
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.error("Resend error %s: %s", resp.status_code, resp.text)
    except Exception:
        logger.exception("Failed to send email via Resend to %s", to)


def _send_via_smtp(to: str, subject: str, html: str, text: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from}>"
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if settings.smtp_port == 465:
            ctx = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
        else:
            ctx = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            ctx.ehlo()
            ctx.starttls()

        with ctx as smtp:
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, [to], msg.as_string())
    except Exception:
        logger.exception("Failed to send email via SMTP to %s", to)


def _send_sync(to: str, subject: str, html: str, text: str) -> None:
    if settings.resend_api_key:
        _send_via_resend(to, subject, html, text)
    elif settings.smtp_host:
        _send_via_smtp(to, subject, html, text)
    else:
        logger.info(
            "[EMAIL — dev mode]\nTo: %s\nSubject: %s\n\n%s\n%s",
            to, subject, "-" * 60, text,
        )


def send_email(to: str, subject: str, html: str, text: str = "") -> None:
    """Non-blocking: spawns a daemon thread and returns immediately."""
    threading.Thread(
        target=_send_sync,
        args=(to, subject, html, text or subject),
        daemon=True,
    ).start()


# ── HTML shell ───────────────────────────────────────────────────
def _wrap(content: str, preview: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Académie des Créatifs</title>
</head>
<body style="margin:0;padding:0;background:{_BG};font-family:'Segoe UI',Arial,sans-serif;color:{_DARK};">
{"<span style='display:none;max-height:0;overflow:hidden;'>" + preview + "</span>" if preview else ""}
<table width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:8px;overflow:hidden;
                  box-shadow:0 2px 16px rgba(0,0,0,0.07);max-width:600px;width:100%;">

      <!-- Header bar -->
      <tr>
        <td style="background:linear-gradient(90deg,{_ACCENT},{_ACCENT});
                   padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;
                    letter-spacing:.04em;">Académie des Créatifs</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.7);
                    letter-spacing:.1em;text-transform:uppercase;">
            Excellence · Créativité · Avenir</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px 28px;">
          {content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:16px 40px 24px;border-top:1px solid #f3f4f6;
                   text-align:center;">
          <p style="margin:0;font-size:11px;color:{_MUTED};">
            Académie des Créatifs — Ce message est automatique, merci de ne pas y répondre.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""


def _h1(text: str) -> str:
    return (
        f'<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:{_DARK};">'
        f"{text}</h1>"
    )


def _p(text: str, muted: bool = False) -> str:
    color = _MUTED if muted else _DARK
    return f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:{color};">{text}</p>'


def _btn(label: str, href: str) -> str:
    return (
        f'<p style="margin:24px 0 0;text-align:center;">'
        f'<a href="{href}" style="display:inline-block;background:{_ACCENT};color:#fff;'
        f'text-decoration:none;padding:12px 28px;border-radius:6px;'
        f'font-weight:700;font-size:14px;">{label}</a></p>'
    )


def _box(content: str) -> str:
    return (
        f'<div style="background:#f5f3ff;border-left:3px solid {_ACCENT};'
        f'border-radius:4px;padding:14px 18px;margin:16px 0;">{content}</div>'
    )


def _row(label: str, value: str) -> str:
    return (
        f'<tr>'
        f'<td style="padding:6px 0;font-size:13px;color:{_MUTED};width:40%;">{label}</td>'
        f'<td style="padding:6px 0;font-size:13px;font-weight:600;color:{_DARK};">{value}</td>'
        f'</tr>'
    )


# ── Template: Welcome ─────────────────────────────────────────────
def send_welcome_email(to: str, name: str) -> None:
    subject = f"Bienvenue à l'Académie des Créatifs, {name} !"
    content = "\n".join([
        _h1(f"Bienvenue, {name} !"),
        _p("Votre compte a été créé avec succès. Vous faites maintenant partie de la "
           "communauté de l'Académie des Créatifs."),
        _p("Explorez notre catalogue de formations et commencez votre parcours dès aujourd'hui.", muted=True),
        _btn("Découvrir les formations", f"{settings.frontend_url}/formations"),
        _p("<br>À très bientôt sur la plateforme&nbsp;!", muted=True),
    ])
    html = _wrap(content, preview=f"Bienvenue {name} — votre compte est prêt")
    text = (
        f"Bienvenue {name} !\n\n"
        "Votre compte a été créé avec succès.\n"
        f"Explorez notre catalogue : {settings.frontend_url}/formations\n\n"
        "— Académie des Créatifs"
    )
    send_email(to, subject, html, text)


# ── Template: Order confirmation ──────────────────────────────────
class OrderEmailData:
    def __init__(
        self,
        reference: str,
        formation_title: str,
        format_type: str,
        total_amount: int,
        currency: str,
        installment_plan: str,
        installment_lines: list[dict] | None = None,
    ) -> None:
        self.reference = reference
        self.formation_title = formation_title
        self.format_type = format_type
        self.total_amount = total_amount
        self.currency = currency
        self.installment_plan = installment_plan
        self.installment_lines = installment_lines or []


def _fmt_price(amount: int, currency: str = "XAF") -> str:
    try:
        import locale
        return f"{amount:,} {currency}".replace(",", "\u202f")
    except Exception:
        return f"{amount} {currency}"


def _fmt_date(d: date) -> str:
    months = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ]
    return f"{d.day} {months[d.month - 1]} {d.year}"


def _format_label(fmt: str) -> str:
    return {"ligne": "En ligne", "presentiel": "Présentiel", "live": "Live"}.get(fmt, fmt)


def send_order_confirmation(to: str, name: str, orders: list[OrderEmailData]) -> None:
    if not orders:
        return

    subject = (
        f"Confirmation d'inscription — {orders[0].formation_title}"
        if len(orders) == 1
        else f"Confirmation de vos {len(orders)} inscriptions"
    )

    blocks: list[str] = [
        _h1("Votre inscription est confirmée !"),
        _p(f"Bonjour {name}, merci pour votre confiance. "
           "Voici le récapitulatif de votre commande."),
    ]

    for order in orders:
        rows = "\n".join([
            _row("Référence", order.reference),
            _row("Formation", order.formation_title),
            _row("Format", _format_label(order.format_type)),
            _row("Montant total", _fmt_price(order.total_amount, order.currency)),
            _row("Mode de paiement", "3 fois sans frais" if order.installment_plan == "3x" else "Paiement complet"),
        ])
        table = (
            f'<table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">'
            f"{rows}</table>"
        )
        order_block = table

        if order.installment_plan == "3x" and order.installment_lines:
            schedule_rows = []
            for line in order.installment_lines:
                due = line.get("due_date")
                due_str = _fmt_date(due) if isinstance(due, date) else str(due)
                if line.get("status") == "confirmed":
                    status_badge = '<span style="color:#16a34a;font-weight:700;">✓ Payé</span>'
                elif line.get("status") == "late":
                    status_badge = '<span style="color:#dc2626;font-weight:700;">En retard</span>'
                elif line.get("status") == "cancelled":
                    status_badge = '<span style="color:#6b7280;">Annulé</span>'
                else:
                    status_badge = '<span style="color:#d97706;">En attente</span>'
                schedule_rows.append(
                    f'<tr>'
                    f'<td style="padding:4px 8px;font-size:12px;color:{_MUTED};">Tranche {line.get("number")}</td>'
                    f'<td style="padding:4px 8px;font-size:12px;">{due_str}</td>'
                    f'<td style="padding:4px 8px;font-size:12px;font-weight:600;">'
                    f'{_fmt_price(line.get("amount", 0), order.currency)}</td>'
                    f'<td style="padding:4px 8px;font-size:12px;">{status_badge}</td>'
                    f'</tr>'
                )
            schedule_html = (
                '<p style="margin:12px 0 4px;font-size:13px;font-weight:600;color:{_DARK};">Échéancier</p>'
                '<table width="100%" cellpadding="0" cellspacing="0" '
                'style="border-collapse:collapse;">'
                + "".join(schedule_rows)
                + "</table>"
            )
            order_block += schedule_html

        blocks.append(_box(order_block))

    blocks += [
        _p("Vous pouvez accéder à votre espace étudiant pour suivre vos inscriptions.", muted=True),
        _btn("Mon espace étudiant", f"{settings.frontend_url}/espace/etudiant"),
    ]

    html = _wrap("\n".join(blocks), preview="Votre inscription est confirmée")

    # Plain-text fallback
    lines = [f"Bonjour {name},\n", "Vos inscriptions sont confirmées :\n"]
    for o in orders:
        lines.append(f"  • {o.formation_title} — réf. {o.reference} — {_fmt_price(o.total_amount, o.currency)}")
        if o.installment_plan == "3x":
            lines.append("    Mode : 3 fois sans frais")
    lines += ["", "— Académie des Créatifs"]
    text = "\n".join(lines)

    send_email(to, subject, html, text)


def send_password_reset_email(to: str, name: str, reset_link: str) -> None:
    subject = "Réinitialisation de votre mot de passe — Académie des Créatifs"
    content = "\n".join([
        _h1("Réinitialisation du mot de passe"),
        _p(f"Bonjour {name}, vous avez demandé à réinitialiser votre mot de passe."),
        _p("Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. "
           "Ce lien est valable pendant <strong>30 minutes</strong>."),
        _btn("Réinitialiser mon mot de passe", reset_link),
        _p("Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — "
           "votre mot de passe actuel reste inchangé.", muted=True),
    ])
    html = _wrap(content, preview="Réinitialisez votre mot de passe Académie des Créatifs")
    text = (
        f"Bonjour {name},\n\n"
        "Vous avez demandé à réinitialiser votre mot de passe.\n"
        f"Cliquez ici : {reset_link}\n\n"
        "Ce lien est valable 30 minutes.\n\n"
        "— Académie des Créatifs"
    )
    send_email(to, subject, html, text)


def send_payment_reminder(
    *,
    to: str,
    name: str,
    formation_title: str,
    order_reference: str,
    amount: int,
    currency: str,
    due_date: date | None,
    installment_number: int | None,
    status: str,
) -> None:
    due_label = _fmt_date(due_date) if due_date is not None else "dès que possible"
    tranche_label = (
        f"Tranche {installment_number}"
        if installment_number is not None
        else "Paiement"
    )
    subject = (
        f"Échéance en retard — {formation_title}"
        if status == "late"
        else f"Rappel de paiement — {formation_title}"
    )

    content = "\n".join(
        [
            _h1("Rappel d'échéance"),
            _p(
                f"Bonjour {name}, nous vous écrivons au sujet de votre inscription à "
                f"{formation_title}."
            ),
            _box(
                "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0;\">"
                + _row("Référence", order_reference)
                + _row("Échéance", tranche_label)
                + _row("Montant", _fmt_price(amount, currency))
                + _row("Date limite", due_label)
                + _row("Statut", "En retard" if status == "late" else "En attente")
                + "</table>"
            ),
            _p(
                "Merci de régulariser cette échéance afin de maintenir votre suivi administratif "
                "et pédagogique actif."
            ),
            _btn("Voir mes notifications", f"{settings.frontend_url}/notifications"),
            _p("Si vous avez déjà effectué le règlement, ignorez ce message.", muted=True),
        ]
    )

    html = _wrap(content, preview=f"Rappel de paiement pour {formation_title}")
    text = "\n".join(
        [
            f"Bonjour {name},",
            "",
            f"Rappel concernant {formation_title}.",
            f"Référence : {order_reference}",
            f"Échéance : {tranche_label}",
            f"Montant : {_fmt_price(amount, currency)}",
            f"Date limite : {due_label}",
            f"Statut : {'En retard' if status == 'late' else 'En attente'}",
            "",
            "Merci de régulariser cette échéance.",
            "— Académie des Créatifs",
        ]
    )
    send_email(to, subject, html, text)


def send_admin_invitation_email(to: str, name: str, token: str) -> None:
    link = f"{settings.frontend_url}/invitation/admin/{token}"
    content = "\n".join([
        _h1("Invitation administrateur"),
        _p(f"Bonjour {name}, vous avez été invité à rejoindre l'équipe d'administration de l'<strong>Académie des Créatifs</strong>."),
        _p("Ce lien est valable <strong>7 jours</strong>. Cliquez ci-dessous pour définir votre mot de passe et accéder à votre espace."),
        _btn("Accepter l'invitation", link),
        _p(f"Ou copiez ce lien : {link}", muted=True),
    ])
    html = _wrap(content, preview=f"Invitation administrateur — {name}")
    text = f"Bonjour {name},\n\nVous êtes invité à devenir administrateur.\nLien : {link}\n\n— Académie des Créatifs"
    send_email(to, f"Invitation administrateur — Académie des Créatifs", html, text)
