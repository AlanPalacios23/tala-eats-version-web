#!/usr/bin/env python3
"""Materializa EN GITHUB los archivos del splash a partir de la foto original.
Uso: python tools/gh_generate_splash_assets.py

La fuente original, aportada por el usuario, se fija por SHA-256.
No actualiza producción ni necesita credenciales de Stripe o Kali.
"""
from __future__ import annotations

import hashlib
import io
import struct
import urllib.request
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = (
    "https://d2ol7oe51mr4n9.cloudfront.net/"
    "user_3JRVgcDQUmpH7yGXahR2Kecqub1/"
    "3df57709-504c-4475-a6ee-2a5f51e9d5f2.png"
)
SOURCE_SHA256 = "0af1596f2384cb93484324e73825c67956e37692ca79777523897a544a6a188d"
RAW = ROOT / "assets/splash/source-1000260473.png"
WEBP = ROOT / "public/branding/splash-exacto-728x1536.webp"
ZIP = ROOT / "deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip"
INSTALLER = ROOT / "deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    # Reuse the identical committed source to avoid reliance on remote CDN.
    # Download only if the pinned original is not already in the checkout.
    if RAW.is_file():
        source = RAW.read_bytes()
    else:
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "TalaEatsSplashSource/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            source = response.read(1_000_000)
    assert sha256(source) == SOURCE_SHA256, "La fuente no coincide con la foto original"
    image = Image.open(io.BytesIO(source)).convert("RGB")
    assert image.size == (728, 1536), "La fotografía debe medir 728x1536"
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_bytes(source)

    # Cubrir SOLAMENTE los elementos simulados de Android (hora, red y batería).
    # El resto de la fotografía (hamburguesa, branding y paginación) se conserva.
    pixels = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
    mask = np.zeros(pixels.shape[:2], np.uint8)
    cv2.rectangle(mask, (25, 12), (158, 94), 255, -1)
    cv2.rectangle(mask, (518, 12), (710, 94), 255, -1)
    background = cv2.inpaint(pixels, mask, 18, cv2.INPAINT_TELEA)

    # Exact user instruction: remove ONLY the three small pill-shaped page
    # indicators at the bottom of the already approved splash. The logo,
    # burger, fries, all copy, and the interactive orange arrow stay unchanged.
    # Source/reference canvas is strictly 728 x 1536 pixels.
    dots_mask = np.zeros(pixels.shape[:2], np.uint8)
    for x0, x1 in ((225, 312), (321, 408), (417, 503)):
        cv2.rectangle(dots_mask, (x0, 1434), (x1, 1457), 255, -1)
    background = cv2.inpaint(background, dots_mask, 4, cv2.INPAINT_TELEA)
    # All color/text/image content outside this narrow bottom region is not
    # retouched; the native arrow remains rendered separately by React.
    assert not np.any(cv2.cvtColor(background, cv2.COLOR_BGR2GRAY)[1441:1449, 230:500] > 65), (
        "Los tres indicadores inferiores siguen visibles"
    )
    clean = Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB))
    WEBP.parent.mkdir(parents=True, exist_ok=True)
    clean.save(WEBP, "WEBP", quality=90, method=6)
    content = WEBP.read_bytes()
    assert content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    assert content[12:16] == b"VP8 ", "El instalador exige WebP VP8"
    signature = content.find(b"\x9d\x01\x2a", 12, 100)
    assert signature != -1, "No se pudo confirmar el tamaño del WebP"
    width, height = struct.unpack_from("<HH", content, signature + 3)
    assert (width & 0x3fff, height & 0x3fff) == (728, 1536)
    assert INSTALLER.is_file(), "Falta el instalador GitHub en la rama"

    ZIP.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(ZIP, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        archive.write(WEBP, "branding/splash-exacto-728x1536.webp")
        archive.write(INSTALLER, "INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh")
        archive.writestr(
            "LEEME.txt",
            "Tala Eats Usuarios Web - splash 728x1536 sin barra falsa Android\n"
            "La imagen también está versionada en GitHub en public/branding/.\n"
            "Despliegue en Kali: bash INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh\n"
            "Solo se reemplazan archivos estáticos del sitio 18195, con respaldo.\n",
        )
    print("ORIGINAL_SOURCE_SHA256=PASS")
    print("SPLASH_WEBP_DIMENSIONS=728x1536 PASS")
    print("SPLASH_THREE_BOTTOM_INDICATORS_REMOVED=PASS")
    print(f"SPLASH_WEBP_SHA256={sha256(content)}")
    print(f"SPLASH_ZIP_SHA256={sha256(ZIP.read_bytes())}")
    print("GITHUB_BINARY_FILES_GENERATED=PASS")


if __name__ == "__main__":
    main()
