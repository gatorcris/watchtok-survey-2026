from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "watchtok-survey-social.png"

INK = (17, 24, 39)
INK_SOFT = (57, 65, 80)
CARD = (255, 253, 248)
GOLD = (189, 139, 46)
GOLD_DARK = (134, 94, 25)
TEAL = (88, 196, 198)
CREAM = (214, 200, 170)

SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def draw_mark(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    scale = size / 96
    p = lambda value: round(value * scale)
    draw.ellipse((x + p(3), y + p(3), x + p(93), y + p(93)), fill=INK, outline=CARD, width=p(2))
    draw.ellipse((x + p(12), y + p(12), x + p(84), y + p(84)), outline=CREAM, width=p(2))
    draw.arc((x + p(16), y + p(12), x + p(80), y + p(76)), 220, 320, fill=TEAL, width=p(5))
    draw.line((x + p(48), y + p(48), x + p(36), y + p(31)), fill=CARD, width=p(5))
    draw.line((x + p(48), y + p(48), x + p(66), y + p(35)), fill=GOLD, width=p(5))
    draw.ellipse((x + p(43), y + p(43), x + p(53), y + p(53)), fill=TEAL, outline=CARD, width=p(2))
    for bx, by, bh in ((31, 59, 8), (40, 56, 11), (49, 52, 15)):
        draw.rounded_rectangle((x + p(bx), y + p(by), x + p(bx + 6), y + p(by + bh)), radius=p(1.5), fill=TEAL)


def build() -> None:
    image = Image.new("RGB", (1200, 630), CARD)
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 20, 630), fill=GOLD)
    draw_mark(draw, 74, 62, 88)
    draw.text((184, 72), "WATCHTOK SURVEY", font=font(SANS_BOLD, 38), fill=INK)
    draw.text((185, 120), "INDEPENDENT ENTHUSIAST RESEARCH", font=font(SANS_BOLD, 17), fill=GOLD_DARK)

    draw.text((74, 224), "YOUR VOICE.", font=font(SERIF_BOLD, 74), fill=INK)
    draw.text((74, 316), "REAL DATA.", font=font(SERIF_BOLD, 74), fill=INK)

    draw.text((78, 437), "The 2026 WatchTok Enthusiast Survey", font=font(SANS, 31), fill=INK_SOFT)
    draw.line((78, 512, 1122, 512), fill=CREAM, width=2)
    draw.text((78, 548), "watchtoksurvey.com", font=font(SANS_BOLD, 25), fill=GOLD_DARK)
    draw.text((782, 551), "Creator-led  •  Brand-independent", font=font(SANS_BOLD, 18), fill=INK_SOFT)

    image.save(OUT, quality=96, optimize=True)


if __name__ == "__main__":
    build()
