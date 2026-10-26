#!/usr/bin/env python3
"""Import the user's EXACT 729×1536 taco onboarding screenshot to GitHub.

Only the painted orange/white button in the lower right is removed.
The real React button uses the EXACT same .customer-splash-next class as
the first splash. All other photo pixels and typography remain unchanged.
"""
from __future__ import annotations
import hashlib
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://d2ol7oe51mr4n9.cloudfront.net/user_3JRVgcDQUmpH7yGXahR2Kecqub1/563f17d8-60d8-45cc-9e4a-6f65aad32766.png"
SOURCE_SHA256 = "e0859b78f979a43392e6a18ac20473708b37d4ef7ebbe2ca05d4f8c016782ddc"
SOURCE_FILE = ROOT / "assets/onboarding/comida-tu-ciudad-original-729x1536.png"
IMAGE_FILE = ROOT / "public/branding/onboarding-comida-tu-ciudad-729x1536.webp"

def main():
    req = Request(SOURCE, headers={"User-Agent": "TalaEatsOnboardingAssetImporter/1.0"})
    with urlopen(req, timeout=40) as r:
        original = r.read(2_000_000)
    assert hashlib.sha256(original).hexdigest() == SOURCE_SHA256, "Source differs from user photo — fail closed"
    im = Image.open(BytesIO(original)).convert("RGB")
    assert im.size == (729,1536), f"Unexpected user image dimensions {im.size}"
    SOURCE_FILE.parent.mkdir(parents=True,exist_ok=True)
    SOURCE_FILE.write_bytes(original)
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    # Circular baked-in orange arrow was at (627,1374), radius 45.
    # Inpaint just its boundary, preserving taco photo + typeset text.
    mask = np.zeros(bgr.shape[:2],np.uint8)
    cv2.circle(mask,(627,1374),51,255,-1)
    clean = cv2.inpaint(bgr,mask,16,cv2.INPAINT_TELEA)
    IMAGE_FILE.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(cv2.cvtColor(clean,cv2.COLOR_BGR2RGB)).save(
        IMAGE_FILE,"WEBP",quality=94,method=6)
    data=IMAGE_FILE.read_bytes()
    assert data[:4]==b"RIFF" and data[8:12]==b"WEBP" and data[12:16]==b"VP8 "
    assert Image.open(IMAGE_FILE).size==(729,1536)
    print("TACOS_ORIGINAL_SHA256=PASS")
    print("TACOS_ONBOARDING_DIMENSIONS=729x1536 PASS")
    print("TACOS_WEBP_SHA256="+hashlib.sha256(data).hexdigest())
    print("TACOS_WEBP_BYTES="+str(len(data)))

if __name__ == "__main__":
    main()
