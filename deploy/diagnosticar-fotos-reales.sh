#!/usr/bin/env bash
# READ-ONLY: compare public catalog photo URLs with the exact allowed stage and
# LIVE catalog-image endpoints. No secrets, DB writes, downloads or file edits.
set -euo pipefail
set +x
export PATH="/usr/sbin:/sbin:$PATH"
for cmd in curl python3; do command -v "$cmd" >/dev/null; done
python3 - <<'PY'
import json,re,subprocess,sys
from urllib.parse import urlsplit,urlunsplit,quote
LIVE="https://web-talaeats.alan-palacios-dev.com"
STAGE="https://api-stage-talaeats.alan-palacios-dev.com"
PREFIX="/api/v1/uploads/catalog/"
# Catalog image filenames are not secret and are restricted to common image
# extensions. Reject URL query strings/fragments to avoid leaking signed URLs.
NAME=re.compile(r"^[A-Za-z0-9_-]{3,110}\.(?:jpg|jpeg|png|webp)$",re.I)
def curl(*args,timeout=16):
 return subprocess.run(["curl","--silent","--show-error","--max-time","12","--max-redirs","0",*args],capture_output=True,text=True,timeout=timeout)
def get_json(path):
 v=curl("--fail",LIVE+path)
 if v.returncode:raise RuntimeError("PUBLIC_CATALOG_UNAVAILABLE: "+str(v.returncode))
 return json.loads(v.stdout)
def identify(original):
 if not isinstance(original,str) or not original.strip():return "NONE",None
 uri=urlsplit(original.strip())
 if uri.query or uri.fragment or uri.username or uri.password:return "UNSAFE_OR_SIGNED_URL",None
 if original.startswith("/"):
  uri=urlsplit(LIVE+original)
 if uri.scheme!="https" or uri.netloc not in {urlsplit(LIVE).netloc,urlsplit(STAGE).netloc}:
  return "UNKNOWN_ORIGIN",None
 if not uri.path.startswith(PREFIX) or not NAME.fullmatch(uri.path[len(PREFIX):]):
  return "NOT_A_PUBLIC_CATALOG_IMAGE",None
 return ("STAGE" if uri.netloc==urlsplit(STAGE).netloc else "LIVE"),uri.path
def head(url):
 # HEAD only: no photo bytes or local temp files. Some servers return 405;
 # the real on-disk presence is still unknown when this happens.
 v=curl("--head","--output","/dev/null","--write-out","%{http_code}|%{content_type}|%{redirect_url}",url)
 if v.returncode:return "CURL_ERROR_"+str(v.returncode)
 h=(v.stdout or "").strip().split("|",2)
 if len(h)<3:return "UNREADABLE_RESPONSE"
 code,mime,redir=h
 if redir:return code+"_REDIRECT_NOT_FOLLOWED"
 if code=="200":
  return "HTTP_200_"+("IMAGE_OK" if mime.lower().split(";")[0] in {"image/jpeg","image/png","image/webp"} else "NOT_IMAGE_"+mime[:48])
 return "HTTP_"+code
try:
 records=get_json("/api/v1/restaurants?market_code=TALA-JAL&limit=20&offset=0")
 if not isinstance(records,list):raise RuntimeError("PUBLIC_CATALOG_NOT_LIST")
 print("MEDIA_DIAGNOSTIC=READ_ONLY_HEAD_ONLY")
 print("PUBLIC_RESTAURANTS="+str(len(records)))
 for record in records[:5]:
  ident=record.get("id") if isinstance(record,dict) else None
  if not isinstance(ident,int) or ident<1:continue
  detail=get_json("/api/v1/restaurants/"+str(ident))
  if not isinstance(detail,dict):continue
  photos=[("COVER",detail.get("cover_image_url"))]
  for n,item in enumerate((detail.get("menu_items") or [])[:6]):
   if isinstance(item,dict):photos.append(("MENU_"+str(item.get("id",n)),item.get("image_url")))
  print("RESTAURANT_ID="+str(ident))
  for name,raw in photos:
   origin,path=identify(raw)
   print(" "+name+" SOURCE="+origin)
   if path is None:continue
   print(" "+name+" PATH="+path)
   print(" "+name+" LIVE_MEDIA="+head(LIVE+path))
   if origin=="STAGE":print(" "+name+" STAGE_MEDIA="+head(STAGE+path))
 print("MEDIA_DIAGNOSTIC_COMPLETE=PASS_NO_WRITES")
except Exception as e:
 print("MEDIA_DIAGNOSTIC_ABORT="+str(e),file=sys.stderr)
 sys.exit(1)
PY
