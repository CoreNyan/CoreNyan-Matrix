"""Render the shared artwork with proportional scaling and antialiased corners."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'frontend/brand/icon-source.png').convert('RGBA')

def icon(size):
    scale = 4
    edge = size * scale
    canvas = Image.new('RGBA', (edge, edge), '#000000')
    artwork = ImageOps.contain(source, (edge, edge), Image.Resampling.LANCZOS)
    canvas.alpha_composite(artwork, ((edge-artwork.width)//2, (edge-artwork.height)//2))
    mask = Image.new('L', (edge, edge))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, edge-1, edge-1), radius=edge*.21, fill=255)
    canvas.putalpha(mask)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)

for name in ['frontend/brand/icon.png', 'frontend/windows/icon.png', 'frontend/web/assets/app-icon.png']:
    icon(512).save(ROOT / name)
for name in ['frontend/windows/icon.ico', 'frontend/web/assets/favicon.ico']:
    icon(256).save(ROOT / name, sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    icon(size).save(ROOT / f'frontend/android/app/src/main/res/drawable-{density}/app_icon.png')
print('Prepared shared Web, Windows and Android icons')
