#!/usr/bin/env python3
"""Generate PharmaOS brand assets: app icon, adaptive icon layers, splash (light+dark), favicon.

Design: two-tone pharmacy capsule at 45deg on brand green, wordmark for splash. Flat, deterministic.
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
GREEN = "#1B5E20"
GREEN_BRIGHT = "#2E7D32"
GREEN_DEEP = "#0D3B0F"
MINT = "#A5D6A7"
WHITE = (255, 255, 255, 255)

def hex_rgba(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (a,)

def draw_capsule(img, cx, cy, L, W):
    """Two-tone capsule at 45deg: bright-green half + white half, antialiased via SS."""
    SS = 4
    S = img.size[0]
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    a = math.radians(45)
    ca, sa = math.cos(a), math.sin(a)
    r = W / 2

    def pt(along, side):
        return (cx + along * ca - side * sa, cy + along * sa + side * ca)

    # silhouette: rounded-rect path as polygon + end circles
    sil = [pt(-L/2 + r, -W/2), pt(L/2 - r, -W/2), pt(L/2 - r, W/2), pt(-L/2 + r, W/2)]
    md.polygon(sil, fill=255)
    for sign in (-1, 1):
        mx, my = cx + sign * (L/2 - r) * ca, cy + sign * (L/2 - r) * sa
        md.ellipse([mx - r, my - r, mx + r, my + r], fill=255)

    # half-plane masks split perpendicular to axis at center
    def half(side_sign):
        hm = Image.new("L", (S, S), 0)
        hmd = ImageDraw.Draw(hm)
        px, py = -sa, ca
        B = 10 * S
        if side_sign > 0:
            pts = [(cx + px*B, cy + py*B), (cx - px*B, cy - py*B),
                   (cx - px*B - ca*B, cy - py*B - sa*B), (cx + px*B - ca*B, cy + py*B - sa*B)]
        else:
            pts = [(cx + px*B, cy + py*B), (cx - px*B, cy - py*B),
                   (cx - px*B + ca*B, cy - py*B + sa*B), (cx + px*B + ca*B, cy + py*B + sa*B)]
        hmd.polygon(pts, fill=255)
        return hm

    def mul(m1, m2):
        from PIL import ImageChops
        return ImageChops.multiply(m1, m2)

    green_side = mul(half(+1), mask)
    white_side = mul(half(-1), mask)
    layer.paste(Image.new("RGBA", (S, S), hex_rgba(GREEN_BRIGHT)), (0, 0), green_side)
    layer.paste(Image.new("RGBA", (S, S), WHITE), (0, 0), white_side)

    # gloss highlight on white half
    gloss = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    hx, hy = cx - L*0.14*ca + W*0.18*sa, cy - L*0.14*sa - W*0.18*ca
    gd.ellipse([hx - W*0.16, hy - W*0.09, hx + W*0.16, hy + W*0.09], fill=(255, 255, 255, 130))
    layer.paste(gloss, (0, 0), mul(gloss.split()[3], white_side))
    return layer

def icon(size):
    """Full-bleed brand icon: rounded green square + capsule."""
    SS = 4
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(S * 0.02)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=int(S * 0.22), fill=hex_rgba(GREEN))
    # subtle top-to-bottom darkening
    grad = Image.new("L", (1, S))
    for y in range(S):
        grad.putpixel((0, y), int(30 * (y / S)))
    dark = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    dark.putalpha(grad.resize((S, S)))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, S - pad, S - pad], radius=int(S * 0.22), fill=255)
    img.paste(Image.alpha_composite(img, dark), (0, 0), mask)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    mark = draw_capsule(img, size*0.5, size*0.5, size*0.52, size*0.52*0.42)
    return Image.alpha_composite(img, mark)

def mark_only(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = draw_capsule(img, size*0.5, size*0.5, size*0.56, size*0.56*0.42)
    return Image.alpha_composite(img, mark)

def splash(size, dark=False):
    """Splash screen: white/soft badge with capsule + PHARMAOS wordmark + tagline."""
    img = Image.new("RGBA", (size, size), hex_rgba(GREEN_DEEP if dark else GREEN))
    d = ImageDraw.Draw(img)
    badge_d = int(size * 0.34)
    bx, by = (size - badge_d) // 2, int(size * 0.22)
    d.ellipse([bx, by, bx + badge_d, by + badge_d], fill=WHITE)
    m = mark_only(int(badge_d * 0.66))
    img.paste(m, (bx + (badge_d - m.size[0]) // 2, by + (badge_d - m.size[1]) // 2), m)

    font = "/usr/share/fonts/TTF/Arialbd.TTF"
    try:
        f_big = ImageFont.truetype(font, int(size * 0.085))
        f_small = ImageFont.truetype(font, int(size * 0.026))
    except OSError:
        f_big = f_small = ImageFont.load_default()

    def spaced_text(text, f, fill, y, spacing_ratio):
        sp = int(size * spacing_ratio)
        widths = [d.textbbox((0, 0), ch, font=f) for ch in text]
        total = sum(b[2] - b[0] for b in widths) + sp * (len(text) - 1)
        x = (size - total) / 2
        for ch, b in zip(text, widths):
            d.text((x, y), ch, font=f, fill=fill)
            x += (b[2] - b[0]) + sp

    spaced_text("PHARMAOS", f_big, WHITE, int(size * 0.60), 0.014)
    spaced_text("B2B PHARMA TRADE NETWORK", f_small, hex_rgba(MINT), int(size * 0.70), 0.005)
    return img

if __name__ == "__main__":
    icon(1024).save(f"{OUT}/icon.png")
    mark_only(1024).save(f"{OUT}/android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), hex_rgba(GREEN)).save(f"{OUT}/android-icon-background.png")
    mono = mark_only(1024)
    white = Image.new("RGBA", (1024, 1024), WHITE)
    white.putalpha(mono.split()[3])
    white.save(f"{OUT}/android-icon-monochrome.png")
    splash(2048, dark=False).save(f"{OUT}/splash-icon.png")
    splash(2048, dark=True).save(f"{OUT}/splash-icon-dark.png")
    icon(48).save(f"{OUT}/favicon.png")
    print("OK:", sorted(f for f in os.listdir(OUT) if f.endswith('.png')))
