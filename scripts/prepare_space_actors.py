import os
import json
import pandas as pd


BASE_DIR = os.path.dirname(os.path.dirname(__file__))

RAW_PATH = os.path.join(BASE_DIR, "data", "raw", "satcat_raw.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "data", "space_actors.json")


OWNER_LABELS = {
    "US": "United States",
    "PRC": "China",
    "CIS": "Russia / CIS",
    "FR": "France",
    "IND": "India",
    "JPN": "Japan",
    "UK": "United Kingdom",
    "ESA": "European Space Agency",
    "EUME": "EUMETSAT",
    "EUTE": "Eutelsat",
    "ITSO": "Intelsat",
    "IM": "Inmarsat",
}


def extract_year(value):
    if pd.isna(value) or value == "":
        return None

    value = str(value).strip()

    try:
        return int(value[:4])
    except ValueError:
        return None


def normalize_object_type(value):
    if pd.isna(value) or value == "":
        return "unknown"

    value = str(value).strip().upper()

    if value in ["PAY"]:
        return "payloads"

    if value in ["DEB"]:
        return "debris"

    if value in ["R/B"]:
        return "rocket_bodies"
    
    if value in ["UNK"]:
        return "unknown"
    
    return "unknown"


def main():
    df = pd.read_csv(RAW_PATH)

     # Keep only useful columns
    df = df[["OWNER", "OBJECT_TYPE", "LAUNCH_DATE"]].copy()

    # Clean OWNER
    df = df.dropna(subset=["OWNER"])
    df["OWNER"] = df["OWNER"].astype(str).str.strip()
    df = df[df["OWNER"] != ""]
    df = df[df["OWNER"].str.lower() != "nan"]

    # Create object_category column
    df["object_category"] = df["OBJECT_TYPE"].apply(normalize_object_type)

    # Create launch_year column
    df["launch_year"] = df["LAUNCH_DATE"].apply(extract_year)




    # 1. Total objects by owner
    total_by_owner = df.groupby("OWNER").size().reset_index(name="total")
    

    # 2. Object type composition by owner
    composition = df.groupby(["OWNER", "object_category"]).size().unstack(fill_value=0).reset_index()

    for col in ["payloads", "debris", "rocket_bodies", "unknown"]:
        if col not in composition.columns:
            composition[col] = 0

    # 3. Yearly activity by owner and object type
    yearly = (
        df.dropna(subset=["launch_year"])
        .groupby(["OWNER", "launch_year", "object_category"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )

    # Make sure all categories exist, even if absent in the data
    for col in ["payloads", "debris", "rocket_bodies", "unknown"]:
        if col not in yearly.columns:
            yearly[col] = 0

    # Total count per year
    yearly["count"] = (
        yearly["payloads"] +
        yearly["debris"] +
        yearly["rocket_bodies"] +
        yearly["unknown"]
    )


    # Merge total + composition into one DataFrame
    actors_df = total_by_owner.merge(composition, on="OWNER", how="left")


     # Sort by total
    actors_df = actors_df.sort_values("total", ascending=False).reset_index(drop=True)





    countries = []

    for index, row in actors_df.iterrows():
        owner = row["OWNER"]

        # Get the yearly activity for this owner
        actor_yearly = yearly[yearly["OWNER"] == owner]

        yearly_activity = [
        {
            "year": int(year_row["launch_year"]),
            "count": int(year_row["count"]),
            "payloads": int(year_row["payloads"]),
            "debris": int(year_row["debris"]),
            "rocket_bodies": int(year_row["rocket_bodies"]),
            "unknown": int(year_row["unknown"])
        }
        for _, year_row in actor_yearly.sort_values("launch_year").iterrows()
        ]

        countries.append({
            "country": owner,
            "display_name": OWNER_LABELS.get(owner, owner),
            "total": int(row["total"]),
            "payloads": int(row["payloads"]),
            "debris": int(row["debris"]),
            "rocket_bodies": int(row["rocket_bodies"]),
            "unknown": int(row["unknown"]),
            "rank_total": index + 1,
            "yearly_activity": yearly_activity
        })

    output = {
        "count": len(countries),
        "countries": countries
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Saved {len(countries)} actors to {OUTPUT_PATH}")
    print("Example:")
    print(json.dumps(countries[0], indent=2))


    

    


if __name__ == "__main__":
    main()