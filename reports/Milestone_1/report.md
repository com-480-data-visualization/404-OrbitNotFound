# Dataset

The main dataset used in this project comes from the Satellite Catalog (SATCAT) provided by [CelesTrak](https://celestrak.org/satcat/).

This catalog contains information about objects currently present in Earth orbit. The objects are categorized into several groups, including active satellites, inactive satellites, rocket bodies, and unidentified objects.
For each object, the dataset includes orbital information in the form of Two-Line Element sets (TLEs), which allow the orbit of the object to be reconstructed. In addition, the dataset provides metadata such as:

- Operational status
- Decay rate
- Owner or operating country/organization
- Launch site
- Launch date

These attributes make the dataset suitable for both orbital analysis and statistical exploration of space activity.


# Problematic

The goal of this project is to give a general audience interested in space traffic and satellite activity a better understanding of the number of objects currently orbiting Earth. While satellites are frequently mentioned in the media, it is often difficult for the public to visualize how many objects are actually present in space and how they are distributed.
One objective is therefore to provide a clear visual representation of how crowded different orbital regions are, such as:
- Low Earth Orbit (LEO)
- Medium Earth Orbit (MEO)
- Geostationary Orbit (GEO)

Another important aspect concerns the allocation of orbital space. In most orbital regions, access to orbit effectively follows a first-come, first-served principle (with stricter regulations mainly applying to GEO). Satellites cannot simply be placed anywhere; operators must avoid collision trajectories and respect orbital dynamics constraints.

As a result, launching satellites also implies occupying and managing orbital space. By visualizing the number of satellites owned or operated by different countries or organizations, it becomes possible to highlight which actors currently occupy the largest share of orbital resources. This can provide insight into the relative influence of different countries in space activities.


# Exploratory Data Analysis

You can use the python environment by running in the `env` directory:

```bash
cd this_repo/env_setup
conda env create -f environment.yml
```

Several exploratory analyses will be performed to better understand the dataset and identify relevant patterns:

![image](./img/launch_sites_map.png)

![image](./img/launches_per_year.png)

![image](./img/debris_per_owner_bar.png)

![image](./img/satellites_per_orbit_pie.png)

These analyses will help reveal trends in space activity, such as the growth of satellite constellations or the accumulation of debris in certain orbital regimes.

# Related work

One example of related work: https://nattybumppo.github.io/rocket-launch-history/

This project presents the history of rocket launches over time, allowing users to explore launch activity through an interactive interface.


# Originality of the approach

Our approach focuses on highlighting the current distribution of orbital objects and the actors responsible for them.

In a geopolitical context, having satellites in orbit can provide strategic advantages. Satellites enable communication, navigation, Earth observation, and intelligence gathering... Additionally, occupying certain orbital positions can make it easier to deploy future satellites in the same regions.

By visualizing satellite ownership and orbital distribution, our project aims to highlight which countries or organizations are currently the dominant players in space and to what extent.


# Sources of inspiration

The project is also inspired by concepts discussed in the course Space Mission Design and Operations (EE-585), which covers topics such as orbital mechanics, satellite deployment, and space operations.