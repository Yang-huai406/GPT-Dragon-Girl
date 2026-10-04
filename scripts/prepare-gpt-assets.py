"""Prepare supplied artwork; preserve GIF bytes and use premultiplied resampling."""
from pathlib import Path
from PIL import Image
import argparse
import base64
import json
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--png', type=Path, required=True)
parser.add_argument('--gif', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
rgba = Image.open(args.png).convert('RGBA')

def fit(size):
    image = rgba.convert('RGBa')
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    image = image.convert('RGBA')
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((size-image.width)//2, (size-image.height)//2))
    return canvas

fit(768).save(root/'assets/gpt-chibi.png')
fit(128).save(root/'assets/gpt-icon.png')
shutil.copyfile(args.gif, root/'assets/gpt-petpet.gif')
fallback = base64.b64encode((root/'assets/gpt-icon.png').read_bytes()).decode('ascii')
(root/'desktop/ui/gpt-fallback.js').write_text(
    'window.GPT_FALLBACK_IMAGE = '+json.dumps('data:image/png;base64,'+fallback)+';\n', encoding='utf-8')
print('Prepared GPT artwork and byte-identical animation.')
