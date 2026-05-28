import json
import os
from datetime import datetime, timezone
from urllib.request import Request, urlopen


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
OUTPUT_PATH = os.path.join(BASE_DIR, "data", "active_tles.json")

TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"


def parse_tle_response(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    satellites = []

    for index in range(0, len(lines), 3):
        if index + 2 >= len(lines):
            continue

        name = lines[index]
        line1 = lines[index + 1]
        line2 = lines[index + 2]

        if not line1.startswith("1 ") or not line2.startswith("2 "):
            continue

        satellites.append({
            "name": name,
            "norad": int(line1[2:7]),
            "classification": line1[7].strip(),
            "international_designator": line1[9:17].strip(),
            "epoch": line1[18:32].strip(),
            "line1": line1,
            "line2": line2
        })

    return satellites


def fetch_active_tles():
    request = Request(
        TLE_URL,
        headers={
            "User-Agent": "404-OrbitNotFound/1.0"
        }
    )

    with urlopen(request) as response:
        return response.read().decode("utf-8")


def main():
    tle_text = fetch_active_tles()
    satellites = parse_tle_response(tle_text)

    output = {
        "source": TLE_URL,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(satellites),
        "satellites": satellites
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Saved {len(satellites)} active TLEs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
