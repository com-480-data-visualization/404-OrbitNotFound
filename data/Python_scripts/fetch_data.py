import pandas as pd

class SatelliteDataProcessor:
    def __init__(self, file_path):
        self.file_path = file_path
        self.df = None
        self.df_clean = None

    def load_csv(self):
        self.df = pd.read_csv(self.file_path, low_memory=False)
        return self.df
    """
    def inspect_data(self):
        print("Columns in dataset:")
        print(self.df.columns)

        print("\nFirst rows:")
        print(self.df.head())
    """
    def classify_orbit(self, row):
        if pd.isna(row["PERIGEE"]) or pd.isna(row["APOGEE"]):
            return "UNKNOWN"

        altitude = (row["PERIGEE"] + row["APOGEE"]) / 2

        if altitude < 2000:
            return "LEO"
        elif altitude < 35786:
            return "MEO"
        elif abs(altitude - 35786) <= 500:
            return "GEO"
        else:
            return "OTHER"

    def clean_data(self):
        columns_to_keep = [
            "OBJECT_NAME",
            "NORAD_CAT_ID",
            "OWNER",
            "PERIOD",
            "APOGEE",
            "PERIGEE"
        ]

        columns_to_keep = [col for col in columns_to_keep if col in self.df.columns]
        self.df_clean = self.df[columns_to_keep].copy()

        self.df_clean = self.df_clean.dropna(subset=["OWNER"])
        self.df_clean["OWNER"] = self.df_clean["OWNER"].str.strip()

        if "PERIGEE" in self.df_clean.columns and "APOGEE" in self.df_clean.columns:
            self.df_clean["ORBIT_CLASS"] = self.df_clean.apply(self.classify_orbit, axis=1)

        self.df_clean = self.df_clean.rename(columns={
            "OBJECT_NAME": "name",
            "NORAD_CAT_ID": "norad",
            "OWNER": "owner",
            "PERIOD": "period",
            "APOGEE": "apogee",
            "PERIGEE": "perigee"
        })

        return self.df_clean

    def save_to_json(self, output_path="../satellites_clean.json"):
        self.df_clean.to_json(output_path, orient="records", indent=2)
        print(f"\nCleaned data saved to {output_path}")
        print(self.df_clean.head())


processor = SatelliteDataProcessor("../satcat.csv")
processor.load_csv()
#processor.inspect_data()
processor.clean_data()
processor.save_to_json("satellites_clean.json")

