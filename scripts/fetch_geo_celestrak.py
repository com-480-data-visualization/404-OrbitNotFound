import os
import json
from skyfield.api import load, EarthSatellite

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

GEO_LONGITUDE_PATH = os.path.join(BASE_DIR, "data", "geo_celestrak_longitude.json")
SATELLITES_CLEAN_PATH = os.path.join(BASE_DIR, "data", "satellites_clean.json")

ts = load.timescale()
t = ts.now()

from urllib.request import urlopen

URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=json"

with urlopen(URL) as response:
    geo_data = json.loads(response.read().decode("utf-8"))

snapshot_date = t.utc_iso()  


with open(SATELLITES_CLEAN_PATH, "r", encoding="utf-8") as f:
    clean_satellites = json.load(f)



result = []

owner_by_norad = {
    int(sat["norad"]): sat.get("owner")
    for sat in clean_satellites
    if sat.get("norad") is not None
}

for sat in geo_data:
    try:
        satellite = EarthSatellite.from_omm(ts, sat)
        subpoint = satellite.at(t).subpoint()
        norad = int(sat.get("NORAD_CAT_ID"))

        result.append({
            "norad": norad,
            "name": sat.get("OBJECT_NAME"),
            "owner": owner_by_norad.get(norad, "UNKNOWN"),
            "longitude": subpoint.longitude.degrees,
            "latitude": subpoint.latitude.degrees
        })

    except Exception as e:
        print("Error with satellite:", sat.get("OBJECT_NAME"), e)

output = {
    "source": "CelesTrak",
    "snapshot_date": t.utc_iso(),
    "computed_date": t.utc_iso(),
    "count": len(result),
    "satellites": result
}

with open(GEO_LONGITUDE_PATH, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print(f"Saved {len(result)} satellites with longitude")