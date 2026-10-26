"""
Build the imported place and neighbourhood seed files from Overture Maps.

Sources
  * Overture Maps Foundation, places theme (CDLA Permissive 2.0)
  * Overture Maps Foundation, divisions theme (ODbL, derived from OpenStreetMap)

Usage
  pip install duckdb shapely
  python3 scripts/data/build_overture.py --release 2026-10-21.0 --out data/seed

The script downloads only the Jeddah bounding box (a few MB) using DuckDB's
HTTP range reads. If the AWS_* variables are set in your shell, unset them:
the Overture bucket is public and rejects unknown credentials.

Nothing in here invents data. Every record comes from Overture with its
source datasets kept for attribution. Records are filtered for confidence,
de-duplicated, mapped onto the app's categories and assigned to the OSM
neighbourhood polygon that contains them.
"""

import argparse
import hashlib
import json
import math
import os
import re
import sys
from collections import defaultdict

import duckdb
from shapely import wkt as shapely_wkt
from shapely.geometry import Point, mapping
from shapely.strtree import STRtree

BBOX = dict(xmin=39.03, xmax=39.36, ymin=21.25, ymax=21.95)

# Overture taxonomy -> (app category, secondary categories, minimum confidence)
FOOD = {
    "coffee_shop": ("cafes", [], 0.75),
    "coffee_roastery": ("cafes", [], 0.75),
    "cafe": ("cafes", [], 0.75),
    "tea_room": ("cafes", [], 0.8),
    "bubble_tea_shop": ("cafes", [], 0.8),
    "smoothie_juice_bar": ("cafes", [], 0.85),
    "ice_cream_shop": ("cafes", [], 0.8),
    "gelato_shop": ("cafes", [], 0.8),
    "frozen_yogurt_shop": ("cafes", [], 0.8),
    "dessert_shop": ("cafes", [], 0.8),
    "donut_shop": ("cafes", [], 0.85),
    "cupcake_shop": ("cafes", [], 0.85),
    "chocolatier": ("cafes", [], 0.85),
    "bakery": ("cafes", [], 0.85),
    "fast_food_restaurant": ("restaurants", [], 0.85),
    "sandwich_shop": ("restaurants", [], 0.85),
    "diner": ("restaurants", [], 0.8),
    "bistro": ("restaurants", [], 0.8),
    "food_truck_stand": ("restaurants", [], 0.85),
}
# Any taxonomy ending in _restaurant (plus a few others) is a restaurant.
RESTAURANT_MIN_CONF = 0.75
RESTAURANT_EXTRA = {"restaurant", "steakhouse", "salad_bar", "buffet_restaurant", "pancake_house", "cafeteria"}

# Mall records are full of shop units, hotels and supermarkets tagged as
# "shopping_mall", so malls also come only from the allowlist below.
SHOPPING_MALLS = [
    "Red Sea Mall  /  رد سي مول", "Mall of Arabia مول العرب", "Al Mahmal Center", "Corniche Commercial Center",
    "The Village", "مركز التحلية التجاري", "Al Salaam Mall Jeddah السلام مول", "Aziz Mall عزيز مول",
    "Al Yasmin Mall الياسمين مول", "Le Prestige", "Serafi Mega Mall", "Boulevard", "روشان مول", "haifaa Mall",
    "الحجاز مول جدة / Hijaz Mall Jeddah", "Al Khayyat Center", "سوق حراء الدولي", "Sultan Mall", "سوق الشاطئ التجاري",
]

# Well-known chains whose records often carry only one script. Official
# brand names in both languages, used so search and display work in either.
BRANDS = {
    "starbucks": ("Starbucks", "ستاربكس"), "ستاربوكس": ("Starbucks", "ستاربكس"), "ستاربكس": ("Starbucks", "ستاربكس"),
    "kfc": ("KFC", "كنتاكي"), "كنتاكي": ("KFC", "كنتاكي"),
    "albaik": ("Al Baik", "البيك"), "البيك": ("Al Baik", "البيك"),
    "krispykreme": ("Krispy Kreme", "كرسبي كريم"), "كرسبيكريم": ("Krispy Kreme", "كرسبي كريم"),
    "shawarmer": ("Shawarmer", "شاورمر"), "شاورمر": ("Shawarmer", "شاورمر"),
    "dunkin": ("Dunkin'", "دانكن"), "dunkindonuts": ("Dunkin'", "دانكن"),
    "mcdonalds": ("McDonald's", "ماكدونالدز"), "ماكدونالدز": ("McDonald's", "ماكدونالدز"),
    "baskinrobbins": ("Baskin Robbins", "باسكن روبنز"),
    "timhortons": ("Tim Hortons", "تيم هورتنز"),
    "pizzahut": ("Pizza Hut", "بيتزا هت"),
    "dominospizza": ("Domino's Pizza", "دومينوز بيتزا"),
    "burgerking": ("Burger King", "برجر كنج"),
    "subway": ("Subway", "صب واي"),
    "kudu": ("Kudu", "كودو"),
    "altazaj": ("Al Tazaj", "الطازج"),
    "maestropizza": ("Maestro Pizza", "مايسترو بيتزا"),
    "costacoffee": ("Costa Coffee", "كوستا كوفي"),
    "barns": ("Barn's", "بارنز"),
}

# Leisure venues are too noisy in Overture to import by category alone,
# so they are imported only from this hand-picked allowlist (Overture name ->
# category, secondary categories, venue type). Entries were picked by reading the
# Overture record (name, category, website); like every import they arrive
# as "unverified" until an editor confirms them in the admin area.
ALLOWLIST = {
    # cinemas
    "muvi Cinemas | موڤي سينما": ("entertainment", ["nightlife"], "movie_theater"),
    "VOX Cinemas": ("entertainment", ["nightlife"], "movie_theater"),
    "Empire Cinemas": ("entertainment", ["nightlife"], "movie_theater"),
    "Muvi Cinemas": ("entertainment", ["nightlife"], "movie_theater"),
    "AMC Stars Avenue 9": ("entertainment", ["nightlife"], "movie_theater"),
    "Grand Cinemas": ("entertainment", ["nightlife"], "movie_theater"),
    # games and indoor activities
    "NOVUS Escape Room KSA نوڤاس غرفه الهروب": ("entertainment", ["adventure"], "escape_room"),
    "MazeBox - Escape Room": ("entertainment", ["adventure"], "escape_room"),
    "GAME OVER Escape Rooms - Jeddah": ("entertainment", ["adventure"], "escape_room"),
    "Jump Up": ("adventure", ["family", "sports"], "trampoline_park"),
    "Jeddah Lanes Bowling Center": ("entertainment", ["sports"], "bowling_alley"),
    "The B Club": ("entertainment", ["sports"], "bowling_alley"),
    "Billy Beez Mall of Arabia": ("family", ["entertainment"], "sport_or_fitness_facility"),
    "Tekzone": ("entertainment", ["family"], "arcade"),
    "TAKEOFF CENTER": ("entertainment", ["family"], "arcade"),
    "AlComedy Club": ("entertainment", ["nightlife"], "comedy_club"),
    "Jeddah Drift Track": ("adventure", ["sports"], "race_track"),
    "Padel Cube": ("sports", [], "padel"),
    # water and outdoors
    "Natlus Divers": ("adventure", ["sports"], "scuba_diving_center"),
    "Descent Dive Club": ("adventure", ["sports"], "scuba_diving_center"),
    "Al-Haddad Scuba": ("adventure", ["sports"], "scuba_diving_center"),
    "Desert Sea Divers": ("adventure", ["sports"], "scuba_diving_center"),
    "Trio Sporting": ("adventure", ["sports"], "horseback_riding_service"),
    "Royalty Equestrian Club, Jeddah": ("adventure", ["sports"], "horseback_riding_service"),
    "Jeddah Cyclist": ("adventure", ["sports"], "bike_rental"),
    # art and culture
    "Athr Gallery": ("culture", [], "art_gallery"),
    "Hafez Gallery": ("culture", [], "art_gallery"),
    "دارة صفيه بن زقر": ("culture", [], "art_gallery"),
    "The Saudi Art Council - SAC": ("culture", [], "art_gallery"),
    "مركز طارق عبدالحكيم": ("culture", [], "museum"),
}

# Names that are clearly not a public venue even when the category says so.
NAME_REJECT = re.compile(
    r"\b(compound|residence|residential|apartment|apartments|villa|villas|office|company|est\.?|establishment|"
    r"trading|factory|supplier|wholesale|catering|kitchen supplies|head ?quarters?|hq|warehouse|clinic|hospital|"
    r"pharmacy|school|academy|consult|atm|bank|boutique|hotel)\b|شركة|مؤسسة|مستودع|مصنع|صراف|بنك|فندق",
    re.IGNORECASE,
)
GENERIC_NAMES = {"red sea", "jeddah", "جدة", "جده", "restaurant", "cafe", "coffee", "مطعم", "كافيه", "mall"}

ARABIC = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
LATIN = re.compile(r"[A-Za-z]")


def split_name(raw: str):
    """Split 'Mall of Arabia مول العرب' into ('Mall of Arabia', 'مول العرب')."""
    raw = re.sub(r"\s+", " ", raw.replace("⁧", "").replace("⁩", "")).strip()
    has_ar, has_lat = bool(ARABIC.search(raw)), bool(LATIN.search(raw))
    if has_ar and has_lat:
        parts = re.split(r"\s*[|/\-–—()]\s*", raw)
        ar = " ".join(p for p in parts if ARABIC.search(p) and not LATIN.search(p)).strip()
        en = " ".join(p for p in parts if LATIN.search(p) and not ARABIC.search(p)).strip()
        if not ar or not en:
            # Mixed inside one segment: split by script runs.
            tokens = raw.split(" ")
            ar = " ".join(t for t in tokens if ARABIC.search(t)).strip()
            en = " ".join(t for t in tokens if not ARABIC.search(t)).strip(" |/-")
        return (en or None), (ar or None)
    if has_ar:
        return None, raw
    return raw, None


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:60].strip("-")


def norm_key(name: str) -> str:
    n = name.lower()
    n = re.sub(r"[^\w؀-ۿ]+", "", n)
    return n


def haversine_m(a, b):
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    d = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(d))


def clean_url(url):
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if not re.match(r"^https?://", url):
        url = "https://" + url
    # Drop tracking parameters.
    url = re.sub(r"[?&](utm_[^=&]+|y_source|igshid|fbclid|mc|SEO_id|src|scid|CID|iata|pmf)=[^&]*", "", url)
    url = url.replace("?&", "?").rstrip("?&")
    if re.search(r"(google\.com/maps|goo\.gl|drive\.google|booking\.com|placeweb\.site|business\.site|wikipedia\.org)", url):
        return None
    return url


def clean_phone(phone):
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", phone)
    if digits.startswith("00966"):
        digits = "+" + digits[2:]
    if digits.startswith("05") and len(digits) == 10:
        digits = "+966" + digits[1:]
    if digits.startswith("01") and len(digits) == 10:
        digits = "+966" + digits[1:]
    if digits.startswith("966"):
        digits = "+" + digits
    if not digits.startswith("+966") and not digits.startswith("800") and not digits.startswith("920"):
        return None
    return digits


def instagram(socials):
    for s in socials or []:
        m = re.search(r"instagram\.com/([A-Za-z0-9_.]+)", s or "")
        if m and m.group(1) not in ("p", "explore"):
            return f"https://www.instagram.com/{m.group(1)}"
    return None


def classify(basic, tax):
    if tax in FOOD:
        return FOOD[tax]
    if basic in FOOD:
        return FOOD[basic]
    if tax and (tax.endswith("_restaurant") or tax in RESTAURANT_EXTRA):
        return ("restaurants", [], RESTAURANT_MIN_CONF)
    if basic == "restaurant":
        return ("restaurants", [], RESTAURANT_MIN_CONF)
    return None


def fetch(release: str, out_dir: str):
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
    places_path = os.path.join(out_dir, "..", "raw", "overture_places.parquet")
    divisions_path = os.path.join(out_dir, "..", "raw", "overture_divisions.parquet")
    os.makedirs(os.path.dirname(places_path), exist_ok=True)
    if not os.path.exists(places_path):
        print("Downloading Overture places for the Jeddah bbox...", file=sys.stderr)
        con.execute(f"""
            COPY (
              SELECT id, names, basic_category, taxonomy, confidence, websites, socials, phones,
                     addresses, operating_status, sources, ST_X(geometry) AS lon, ST_Y(geometry) AS lat
              FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)
              WHERE bbox.xmin BETWEEN {BBOX['xmin']} AND {BBOX['xmax']} AND bbox.ymin BETWEEN {BBOX['ymin']} AND {BBOX['ymax']}
            ) TO '{places_path}' (FORMAT parquet)""")
    if not os.path.exists(divisions_path):
        print("Downloading Overture division areas for Jeddah...", file=sys.stderr)
        con.execute(f"""
            COPY (
              SELECT id, names, subtype, ST_AsText(geometry) AS wkt
              FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=divisions/type=division_area/*', hive_partitioning=1)
              WHERE subtype = 'neighborhood' AND bbox.xmin > 38.95 AND bbox.xmax < 39.45 AND bbox.ymin > 21.2 AND bbox.ymax < 22.0
            ) TO '{divisions_path}' (FORMAT parquet)""")
    return con, places_path, divisions_path


def build_neighbourhoods(con, divisions_path):
    rows = con.execute(f"SELECT id, names.primary, names.common['en'], names.common['ar'], wkt FROM '{divisions_path}'").fetchall()
    hoods = []
    for oid, primary, en, ar, w in rows:
        if not en:
            continue
        geom = shapely_wkt.loads(w)
        if not geom.is_valid:
            geom = geom.buffer(0)
        simple = geom.simplify(0.0004, preserve_topology=True)
        centroid = geom.representative_point()
        name_en = en.replace("Al-", "Al-").strip()
        hoods.append({
            "overtureId": oid,
            "slug": slugify(name_en),
            "nameEn": name_en,
            "nameAr": (ar or primary or "").strip() or None,
            "center": [round(centroid.y, 6), round(centroid.x, 6)],
            "bbox": [round(v, 6) for v in geom.bounds],
            "polygon": json.loads(json.dumps(mapping(simple))),
            "geom": geom,
        })
    return hoods


def round_coords(obj, digits=5):
    if isinstance(obj, (list, tuple)):
        return [round_coords(v, digits) for v in obj]
    if isinstance(obj, float):
        return round(obj, digits)
    return obj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", default="2026-10-21.0")
    ap.add_argument("--out", default="data/seed")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    con, places_path, divisions_path = fetch(args.release, args.out)
    hoods = build_neighbourhoods(con, divisions_path)
    tree = STRtree([h["geom"] for h in hoods])

    def hood_for(lat, lon):
        pt = Point(lon, lat)
        for idx in tree.query(pt):
            if hoods[idx]["geom"].contains(pt):
                return hoods[idx]["slug"]
        return None

    rows = con.execute(f"""
        SELECT id, names.primary, basic_category, taxonomy.primary, confidence, websites, socials, phones,
               addresses[1].freeform, operating_status, [s.dataset for s in sources], lat, lon
        FROM '{places_path}'
        WHERE coalesce(operating_status, 'open') <> 'permanently_closed'
    """).fetchall()

    candidates = []
    stats = defaultdict(int)
    for (oid, primary, basic, tax, conf, websites, socials, phones, address, status, datasets, lat, lon) in rows:
        if not primary or lat is None:
            continue
        if not (BBOX["ymin"] <= lat <= BBOX["ymax"] and BBOX["xmin"] <= lon <= BBOX["xmax"]):
            continue
        forced_sub = None
        if primary in ALLOWLIST:
            category, secondary, forced_sub = ALLOWLIST[primary]
            min_conf = 0.6
        elif primary in SHOPPING_MALLS:
            category, secondary, min_conf = "shopping", ["family"], 0.6
            forced_sub = "shopping_mall"
        else:
            cls = classify(basic, tax)
            if not cls:
                continue
            category, secondary, min_conf = cls
        if conf is None or conf < min_conf:
            stats["low_confidence"] += 1
            continue
        if NAME_REJECT.search(primary) and primary not in ALLOWLIST and primary not in SHOPPING_MALLS:
            stats["rejected_name"] += 1
            continue
        if norm_key(primary) in {norm_key(g) for g in GENERIC_NAMES}:
            stats["generic_name"] += 1
            continue
        name_en, name_ar = split_name(primary)
        if name_en and len(name_en) < 2:
            name_en = None
        brand = BRANDS.get(norm_key(name_en or "")) or BRANDS.get(norm_key(name_ar or ""))
        if brand:
            name_en, name_ar = brand
        if not name_en and not name_ar:
            continue
        hood = hood_for(lat, lon)
        if hood is None:
            # Outside every mapped neighbourhood (sea, airport apron, desert edge).
            stats["outside_neighbourhoods"] += 1
            continue
        candidates.append({
            "overtureId": oid,
            "nameEn": name_en,
            "nameAr": name_ar,
            "category": category,
            "secondary": secondary,
            "subcategory": forced_sub or tax or basic,
            "confidence": round(conf, 3),
            "website": clean_url((websites or [None])[0]),
            "instagram": instagram(socials),
            "phone": clean_phone((phones or [None])[0]),
            "address": (address or "").strip() or None,
            "neighbourhood": hood,
            "lat": round(lat, 6),
            "lng": round(lon, 6),
            "sources": sorted(set(d for d in (datasets or []) if d)),
        })

    # De-duplicate: same normalised name within 150 m -> keep highest confidence.
    candidates.sort(key=lambda c: -c["confidence"])
    kept, by_key = [], defaultdict(list)
    for c in candidates:
        key = norm_key(c["nameEn"] or c["nameAr"])
        if any(haversine_m((c["lat"], c["lng"]), (k["lat"], k["lng"])) < 150 for k in by_key[key]):
            stats["duplicate"] += 1
            continue
        by_key[key].append(c)
        kept.append(c)

    # Stable, readable slugs.
    used = set()
    for c in kept:
        base = slugify(c["nameEn"] or "") or "place"
        suffix = hashlib.sha1(c["overtureId"].encode()).hexdigest()[:6]
        slug = f"{base}-{suffix}"
        while slug in used:
            slug += "x"
        used.add(slug)
        c["slug"] = slug

    kept.sort(key=lambda c: (c["category"], c["slug"]))
    with open(os.path.join(args.out, "overture-places.json"), "w", encoding="utf-8") as f:
        json.dump({
            "source": "Overture Maps Foundation — places theme",
            "license": "CDLA-Permissive-2.0",
            "release": args.release,
            "places": kept,
        }, f, ensure_ascii=False, indent=1)

    hood_out = []
    for h in hoods:
        h = dict(h)
        h.pop("geom")
        h["polygon"] = {"type": h["polygon"]["type"], "coordinates": round_coords(h["polygon"]["coordinates"])}
        hood_out.append(h)
    hood_out.sort(key=lambda h: h["slug"])
    with open(os.path.join(args.out, "neighbourhoods.json"), "w", encoding="utf-8") as f:
        json.dump({
            "source": "Overture Maps Foundation — divisions theme (from OpenStreetMap)",
            "license": "ODbL-1.0",
            "release": args.release,
            "neighbourhoods": hood_out,
        }, f, ensure_ascii=False)

    counts = defaultdict(int)
    for c in kept:
        counts[c["category"]] += 1
    print(json.dumps({"kept": len(kept), "by_category": counts, "skipped": stats, "neighbourhoods": len(hood_out)}, indent=1))


if __name__ == "__main__":
    main()
