from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.schemas.commerce import CertificateView

OG_IMAGE_WIDTH = 1200
OG_IMAGE_HEIGHT = 630

_REPO_ROOT = Path(__file__).resolve().parents[3]
_PUBLIC_ROOT = _REPO_ROOT / "frontend" / "public"

_LOGO_PATH = _PUBLIC_ROOT / "logo_academie_hd.png"
_BADGE_PATH = _PUBLIC_ROOT / "badge-certificat.png"
_VERIFIED_BADGE_PATH = _PUBLIC_ROOT / "verification-badge.png"


def build_certificate_share_title(certificate: CertificateView) -> str:
    return (
        f"{certificate.student_name} · Certificat vérifiable · "
        "Académie des Créatifs"
    )


def build_certificate_share_description(certificate: CertificateView) -> str:
    details = [
        f"Formation : {certificate.formation_title}",
        f"Matricule : {certificate.student_code or 'Non attribué'}",
        f"ID certificat : {certificate.certificate_number}",
    ]
    if certificate.formation_duration:
        details.insert(1, f"Durée : {certificate.formation_duration}")
    return " | ".join(details)


def render_certificate_share_image(certificate: CertificateView) -> bytes:
    canvas = Image.new("RGBA", (OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT), "#ffffff")
    draw = ImageDraw.Draw(canvas)

    _draw_background(draw)
    _draw_header_shapes(draw)
    _draw_branding(canvas)
    _draw_badges(canvas)
    _draw_main_copy(canvas, certificate)
    _draw_footer(draw, certificate)

    output = BytesIO()
    canvas.convert("RGB").save(output, format="PNG", optimize=True)
    return output.getvalue()


def _draw_background(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 0, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT), fill="#fbfcfd")


def _draw_header_shapes(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(
        [(0, 0), (650, 0), (525, 154), (0, 192)],
        fill="#0f4654",
    )
    draw.polygon(
        [(760, 0), (OG_IMAGE_WIDTH, 0), (OG_IMAGE_WIDTH, 224), (710, 170)],
        fill="#9bd53d",
    )
    draw.polygon(
        [(0, OG_IMAGE_HEIGHT), (245, OG_IMAGE_HEIGHT), (0, OG_IMAGE_HEIGHT - 58)],
        fill="#9bd53d",
    )
    draw.polygon(
        [
            (875, OG_IMAGE_HEIGHT),
            (OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT),
            (OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT - 72),
        ],
        fill="#0f4654",
    )


def _draw_branding(canvas: Image.Image) -> None:
    logo = _load_asset(_LOGO_PATH)
    if logo is None:
        return
    logo = ImageOps.contain(logo, (280, 112))
    canvas.alpha_composite(logo, (457, 52))


def _draw_badges(canvas: Image.Image) -> None:
    badge = _load_asset(_BADGE_PATH)
    if badge is not None:
        badge = ImageOps.contain(badge, (240, 330))
        canvas.alpha_composite(badge, (78, 54))

    verified = _load_asset(_VERIFIED_BADGE_PATH)
    if verified is not None:
        verified = ImageOps.contain(verified, (118, 118))
        canvas.alpha_composite(verified, (1000, 76))


def _draw_main_copy(canvas: Image.Image, certificate: CertificateView) -> None:
    draw = ImageDraw.Draw(canvas)
    dark = "#0b3a45"
    muted = "#45646d"
    accent = "#9bd53d"

    eyebrow_font = _load_font(22, weight="bold")
    title_font = _load_fit_font(
        draw,
        certificate.student_name,
        max_width=650,
        initial_size=84,
        minimum_size=46,
        style="serif",
        italic=True,
    )
    body_font = _load_font(30, weight="regular")
    details_font = _load_font(26, weight="regular")
    meta_font = _load_font(22, weight="bold")

    draw.text(
        (720, 170),
        "CERTIFICAT NUMERIQUE VERIFIABLE",
        fill=muted,
        font=eyebrow_font,
        anchor="mm",
    )
    draw.text(
        (720, 235),
        "Partagé par l'Académie des Créatifs",
        fill=dark,
        font=_load_font(40, weight="bold"),
        anchor="mm",
    )
    draw.text(
        (720, 335),
        certificate.student_name,
        fill=muted,
        font=title_font,
        anchor="mm",
    )
    draw.line((404, 404, 1036, 404), fill=accent, width=5)

    formation_lines = _wrap_text(
        draw,
        (
            f"A validé avec succès la formation {certificate.formation_title}"
            if not certificate.formation_duration
            else (
                f"A suivi pendant {certificate.formation_duration} et validé "
                f"avec succès la formation {certificate.formation_title}"
            )
        ),
        body_font,
        780,
        max_lines=2,
    )
    current_y = 440
    for line in formation_lines:
        draw.text((720, current_y), line, fill=dark, font=body_font, anchor="mm")
        current_y += 38

    draw.text(
        (720, 536),
        (
            f"Matricule {certificate.student_code or 'Non attribué'}"
            f"   •   ID {certificate.certificate_number}"
        ),
        fill=dark,
        font=meta_font,
        anchor="mm",
    )
    draw.text(
        (720, 572),
        f"Émis le {certificate.issued_date}",
        fill=muted,
        font=details_font,
        anchor="mm",
    )


def _draw_footer(draw: ImageDraw.ImageDraw, certificate: CertificateView) -> None:
    draw.rounded_rectangle(
        (840, 505, 1130, 592),
        radius=24,
        fill=(255, 255, 255, 235),
        outline=(11, 58, 69, 26),
        width=2,
    )
    draw.text(
        (985, 536),
        "Vérification instantanée",
        fill="#0b3a45",
        font=_load_font(20, weight="bold"),
        anchor="mm",
    )
    share_hint = certificate.share_url or certificate.verification_url or ""
    display_domain = share_hint.replace("https://", "").replace("http://", "")
    if len(display_domain) > 31:
        display_domain = display_domain[:28] + "..."
    draw.text(
        (985, 565),
        display_domain,
        fill="#5f7680",
        font=_load_font(16, weight="regular"),
        anchor="mm",
    )


@lru_cache(maxsize=8)
def _load_asset(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    return Image.open(path).convert("RGBA")


def _load_fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    max_width: int,
    initial_size: int,
    minimum_size: int,
    style: str,
    italic: bool,
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for size in range(initial_size, minimum_size - 1, -2):
        font = _load_font(size, weight="regular", style=style, italic=italic)
        width = _text_size(draw, text, font)[0]
        if width <= max_width:
            return font
    return _load_font(minimum_size, weight="regular", style=style, italic=italic)


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    max_width: int,
    *,
    max_lines: int,
) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if _text_size(draw, candidate, font)[0] <= max_width:
            current = candidate
            continue
        lines.append(current)
        current = word
        if len(lines) == max_lines - 1:
            break

    remaining_words = words[len(" ".join(lines + [current]).split()):]
    if remaining_words:
        current = f"{current} {' '.join(remaining_words)}".strip()
    lines.append(current)

    if len(lines) > max_lines:
        lines = lines[:max_lines]
    if len(lines[-1]) > 80:
        trimmed = lines[-1][:77].rstrip()
        lines[-1] = f"{trimmed}..."
    return lines


def _text_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
) -> tuple[int, int]:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def _load_font(
    size: int,
    *,
    weight: str = "regular",
    style: str = "sans",
    italic: bool = False,
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in _font_candidates(weight=weight, style=style, italic=italic):
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def _font_candidates(*, weight: str, style: str, italic: bool) -> list[Path]:
    windows = Path("C:/Windows/Fonts")
    linux = Path("/usr/share/fonts/truetype")
    mac = Path("/System/Library/Fonts")

    if style == "serif":
        names = (
            ["georgiai.ttf", "timesi.ttf"]
            if italic
            else ["georgia.ttf", "times.ttf"]
        )
        linux_names = (
            ["dejavu/DejaVuSerif-Italic.ttf"]
            if italic
            else ["dejavu/DejaVuSerif.ttf"]
        )
        mac_names = ["Times.ttc", "Times New Roman.ttf"]
    else:
        names = (
            ["segoeuib.ttf", "arialbd.ttf"]
            if weight == "bold"
            else ["segoeui.ttf", "arial.ttf"]
        )
        linux_names = (
            ["dejavu/DejaVuSans-Bold.ttf"]
            if weight == "bold"
            else ["dejavu/DejaVuSans.ttf"]
        )
        mac_names = ["Helvetica.ttc", "Arial.ttf"]

    candidates = [windows / name for name in names]
    candidates.extend(linux / name for name in linux_names)
    candidates.extend(mac / name for name in mac_names)
    return candidates
