import os
from urllib.request import urlretrieve

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")

os.makedirs(RAW_DIR, exist_ok=True)

sources = {
    "satcat_raw.csv": "https://celestrak.org/pub/satcat.csv",
}

for filename, url in sources.items():
    output_path = os.path.join(RAW_DIR, filename)

    print(f"Downloading: {url}")
    urlretrieve(url, output_path)
    print(f"Saved to: {output_path}")
