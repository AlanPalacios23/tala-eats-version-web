#!/usr/bin/env python3
"""Byte-exact validation of the four private HD assets of Flutter Users v1.0.46.

Source-of-truth digests:
tala-eats-mobile@f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d
tala-eats-usuarios/ci/verify_landing_assets.py

All four must come from the user's approved ZIP. Never add stock photos,
rendered substitutes or recompressed logos.
"""
from __future__ import annotations
import argparse
import hashlib
import pathlib
import struct
import sys
import zipfile

EXPECTED = {
 "food_fiesta.webp":("0e6123346ee3624c909c8f8061d103c00aa47098c7c919907d828d742076d313",100_000),
 "food_tala.webp":("074b1c1325a4b3a75ff07ffbcae72ece5960389bd78d623728deba1ec899a45d",100_000),
 "tala_eats_original_wordmark.png":("45c04843f88d4b8bd353020e7397192bb57faa693d19c9a261dac75ff8e03b8c",50_000),
 "tala_eats_wordmark_transparent.png":("2220c61bd3cf7403c4c23c5ec7b1c500d6b366aa1d3f3a68eea43d12a5782a0a",70_000),
}
DEST=pathlib.Path(__file__).resolve().parents[1]/"public"/"landing"

def validate(name: str, data: bytes)->None:
 digest,minimum=EXPECTED[name]
 if len(data)<minimum or len(data)>20_000_000:
  raise ValueError(f"bad size: {name}")
 if name.endswith(".png"):
  if data[:8]!=b"\x89PNG\r\n\x1a\n" or data[12:16]!=b"IHDR":
   raise ValueError(f"invalid PNG: {name}")
  width,height=struct.unpack(">II",data[16:24])
  if width<400 or height<100: raise ValueError(f"invalid PNG dimensions: {name}")
  if name=="tala_eats_wordmark_transparent.png" and data[25]!=6:
   raise ValueError("transparent wordmark must be PNG RGBA")
 else:
  if data[:4]!=b"RIFF" or data[8:12]!=b"WEBP":
   raise ValueError(f"invalid WebP: {name}")
  if struct.unpack("<I",data[4:8])[0]+8!=len(data):
   raise ValueError(f"truncated WebP: {name}")
 if hashlib.sha256(data).hexdigest()!=digest:
  raise ValueError(f"SHA256 mismatch: {name}")
 print(f"PASS {name}")

def main()->int:
 parser=argparse.ArgumentParser()
 parser.add_argument("--zip",type=pathlib.Path,help="original approved ZIP (required for install)")
 parser.add_argument("--install",action="store_true",help="write all four files after validation")
 args=parser.parse_args()
 if args.install and args.zip is None:parser.error("--install requires --zip")
 try:
  if args.zip is None:
   for name in EXPECTED:validate(name,(DEST/name).read_bytes())
  else:
   with zipfile.ZipFile(args.zip) as z:
    names=[x for x in z.infolist() if not x.is_dir() and pathlib.PurePosixPath(x.filename).name in EXPECTED]
    found={}
    for entry in names:
     name=pathlib.PurePosixPath(entry.filename).name
     if name in found:raise ValueError(f"duplicate asset: {name}")
     if entry.file_size>20_000_000:raise ValueError(f"oversized asset: {name}")
     content=z.read(entry)
     validate(name,content)
     found[name]=content
    if set(found)!=set(EXPECTED):
     raise ValueError("missing approved original assets: "+",".join(sorted(set(EXPECTED)-set(found))))
    if args.install:
     DEST.mkdir(parents=True,exist_ok=True)
     for name,data in found.items():
      path=DEST/name
      if path.is_symlink():raise ValueError(f"symlink output forbidden: {name}")
      if path.exists() and path.read_bytes()!=data:
       raise ValueError(f"refusing to overwrite different local asset: {name}")
     for name,data in found.items():(DEST/name).write_bytes(data)
  print("TALA_EATS_ORIGINAL_MEDIA=4/4_PASS")
  return 0
 except (ValueError,FileNotFoundError,zipfile.BadZipFile,OSError) as e:
  print(f"TALA_EATS_ORIGINAL_MEDIA=HOLD ({e})",file=sys.stderr)
  return 1

if __name__=="__main__":
 sys.exit(main())
