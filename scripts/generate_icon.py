"""
Generates assets/icon.png (512x512) for EmulatorFlow.
Run once locally before building:
    python scripts/generate_icon.py

Requires: pip install Pillow
"""
import math
import os
from PIL import Image, ImageDraw

SIZE = 512
OUT  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icon.png')

# Colours
BG     = (13,  17,  23,  255)   # #0d1117 — app background
PURPLE = (168, 85,  247, 255)   # #a855f7
WHITE  = (240, 240, 255, 255)

img  = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Rounded-rectangle background
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=100, fill=BG)

cx, cy = SIZE // 2, SIZE // 2

# Outer diamond (purple)
r = 170
outer = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
draw.polygon(outer, fill=PURPLE)

# Inner diamond (background colour) — creates a ring effect
r2 = 80
inner = [(cx, cy - r2), (cx + r2, cy), (cx, cy + r2), (cx - r2, cy)]
draw.polygon(inner, fill=BG)

# Small play-triangle inside the inner cutout
tri_r = 38
# Equilateral triangle pointing right, centred slightly left of cx
tx = cx - 8
pts = [
    (tx + tri_r,              cy),
    (tx - tri_r // 2,         cy - int(tri_r * 0.87)),
    (tx - tri_r // 2,         cy + int(tri_r * 0.87)),
]
draw.polygon(pts, fill=PURPLE)

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
img.save(OUT, 'PNG')
print(f"Saved {os.path.abspath(OUT)}")
