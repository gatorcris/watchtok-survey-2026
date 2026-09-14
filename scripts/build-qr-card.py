from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.graphics.barcode import qr as reportlab_qr


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "watchtok-survey-qr-mobile.png"
URL = "https://watchtoksurvey.com/"

INK = (17, 24, 39)
INK_SOFT = (57, 65, 80)
CARD = (255, 253, 248)
GOLD_DARK = (134, 94, 25)
RUST = (168, 68, 47)
LINE = (217, 208, 192)

SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def centered(draw: ImageDraw.ImageDraw, text: str, y: int, fnt, fill) -> None:
    box = draw.textbbox((0, 0), text, font=fnt)
    x = (1080 - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=fnt, fill=fill)


def make_qr(data: str, box_size: int = 23, border: int = 4) -> Image.Image:
    code = reportlab_qr.QrCodeWidget(data, barLevel="H").qr
    code.make()
    modules = code.getModuleCount()
    size = (modules + border * 2) * box_size
    image = Image.new("RGB", (size, size), "white")
    draw = ImageDraw.Draw(image)
    for row in range(modules):
        for col in range(modules):
            if code.isDark(row, col):
                left = (col + border) * box_size
                top = (row + border) * box_size
                draw.rectangle((left, top, left + box_size - 1, top + box_size - 1), fill="#111827")
    return image


def build() -> None:
    image = Image.new("RGB", (1080, 1920), CARD)
    draw = ImageDraw.Draw(image)

    centered(draw, "WATCHTOK SURVEY", 72, font(SANS_BOLD, 40), GOLD_DARK)
    centered(draw, "THE 2026 ENTHUSIAST SURVEY", 128, font(SANS_BOLD, 25), INK_SOFT)
    centered(draw, "YOUR VOICE.", 190, font(SERIF_BOLD, 76), INK)
    centered(draw, "REAL DATA.", 281, font(SERIF_BOLD, 76), INK)
    centered(draw, "Scan to take the survey", 382, font(SANS, 38), INK_SOFT)

    qr_img = make_qr(URL)

    qr_size = qr_img.width
    qr_x = (1080 - qr_size) // 2
    qr_y = 464
    draw.rounded_rectangle(
        (qr_x - 18, qr_y - 18, qr_x + qr_size + 18, qr_y + qr_size + 18),
        radius=20,
        fill=(255, 255, 255),
        outline=LINE,
        width=3,
    )
    image.paste(qr_img, (qr_x, qr_y))

    instruction_y = qr_y + qr_size + 55
    centered(draw, "SCREENSHOT  •  OPEN PHOTOS", instruction_y, font(SANS_BOLD, 30), RUST)
    centered(draw, "LONG-PRESS THE CODE", instruction_y + 54, font(SANS_BOLD, 30), RUST)

    centered(draw, "OR GO TO", instruction_y + 151, font(SANS_BOLD, 26), GOLD_DARK)
    centered(draw, "watchtoksurvey.com", instruction_y + 198, font(SERIF_BOLD, 52), INK)

    centered(draw, "Creator-led  •  Brand-independent", 1812, font(SANS_BOLD, 24), INK_SOFT)

    image.save(OUT, quality=96, optimize=True)


if __name__ == "__main__":
    build()
