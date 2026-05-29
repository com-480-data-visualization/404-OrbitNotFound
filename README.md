# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
|Lepère Thomas|369279|
|Shen Kaifun Kevin|326034|
|Spiess Alexandre|342757|

[Milestone 1](./reports/Milestone_1/report.md) • [Milestone 2](./reports/Milestone_2/Milestone_2_report.pdf) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)

**10% of the final grade**

[Milestone 1](./reports/Milestone_1/report.md)


## Milestone 2 (17th April, 5pm)

**10% of the final grade**

- Website: [Open the project website](https://com-480-data-visualization.github.io/404-OrbitNotFound/)
- Report: [Read the Milestone 2 report](./reports/Milestone_2/Milestone_2_report.pdf)

### Visualizations

- [Orbital Structure](./orbital-structure/)
- [Space Actors](./space-actors/)


## Milestone 3 (29th May, 5pm)

**80% of the final grade**

- [Website](https://com-480-data-visualization.github.io/404-OrbitNotFound/)
- [Process book](./reports/Milestone_3/404-OrbitNotFound.pdf)
- [Screencast](./reports/Milestone_3/Screencast.mp4)


## Repository Structure

The repository is organized around the final interactive website and the data pipeline used to build it. The root files (`index.html`, `script.js`, and `style.css`) define the landing page and connect the three visualization modules.

The `orbital-structure/`, `space-actors/`, and `overflights/` folders each contain a self-contained visualization with its own HTML, JavaScript, CSS, and visual assets when needed. The `data/` folder stores the processed datasets consumed by the website, while `data/raw/` keeps the original downloaded source files.

The `scripts/` folder contains the Python scripts used to fetch, clean, and prepare satellite, TLE, geostationary, and space-actor data. The `reports/` folder gathers the deliverables for each milestone. Finally, `env/environment.yml` documents the Python environment required to reproduce the data preparation workflow.

## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

