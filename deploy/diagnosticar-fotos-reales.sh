#!/usr/bin/env bash
# SAFE PUBLIC PHOTO DIAGNOSTICS: GET only, no DB, Stripe, PM2 or merchant writes.
set -euo pipefail
export PATH="/usr/sbin:/sbin:$PATH"
command -v curl >/dev/null;command -v python3 >/dev/null
HOST="https://web-talaeats.alan-palacios-dev.com"
# Uses the LIVE public frontend same-origin API; never reads private media paths.
export TALA_PHOTO_PUBLIC_HOST="$HOST"
python3 - <<'PY'
import json,os,subprocess,sys
from urllib.parse import urljoin,urlsplit
host=os.environ["TALA_PHOTO_PUBLIC_HOST"]
def getjson(url):
 result=subprocess.run(["curl","-fsS","--max-time","12",url],capture_output=True,text=True,timeout=16)
 if result.returncode:raise RuntimeError("Catalog API read failed (no writes)")
 return json.loads(result.stdout)
def status(url):
 cmd=["curl","-sS","-L","--max-time","10","--max-filesize","10485760","--range","0-0","-o","/dev/null","-w","%{http_code} %{content_type}",url]
 try:
  res=subprocess.run(cmd,capture_output=True,text=True,timeout=14)
  return (res.stdout.strip() if res.returncode==0 else "GET_FAILED")
 except subprocess.TimeoutExpired:return "TIMEOUT"
try:
 entries=getjson(host+"/api/v1/restaurants?market_code=TALA-JAL&limit=20&offset=0")
 if not isinstance(entries,list):raise RuntimeError("The server did not return a public catalog list")
 print("PUBLIC_IMAGE_DIAGNOSTIC=READ_ONLY")
 print("RESTAURANTS_FOUND=",len(entries))
 for r in entries[:5]:
  if not isinstance(r,dict) or not isinstance(r.get("id"),int):continue
  detail=getjson(host+"/api/v1/restaurants/"+str(r["id"]))
  if not isinstance(detail,dict):continue
  photos=[("COMMERCE_COVER",detail.get("cover_image_url"))]
  for dish in (detail.get("menu_items") or [])[:4]:
   if isinstance(dish,dict):photos.append(("PRODUCT_"+str(dish.get("id")),dish.get("image_url")))
  print("COMMERCE_ID=",r["id"])
  for label,uri in photos:
   if not uri or not isinstance(uri,str):
    print(" ",label,"NO_IMAGE_UPLOADED");continue
   target=urljoin(host+"/",uri)
   parts=urlsplit(target)
   if parts.scheme!="https" or parts.netloc!="web-talaeats.alan-palacios-dev.com":
    # No outbound requests to attacker-supplied addresses.
    print(" ",label,"CROSS_ORIGIN_OR_UNSAFE_URL",parts.scheme+"://"+parts.netloc);continue
   if not parts.path.startswith("/api/v1/uploads/catalog/"):
    print(" ",label,"UNEXPECTED_PUBLIC_MEDIA_PATH",parts.path[:100]);continue
   print(" ",label,"HTTP",status(target),"PATH",parts.path[:100])
 print("DIAGNOSTIC_DONE=PASS_NO_WRITES")
except Exception as e:
 print("DIAGNOSTIC_ABORT="+str(e),file=sys.stderr)
 sys.exit(1)
PY
