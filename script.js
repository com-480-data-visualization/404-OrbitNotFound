const startButton = document.getElementById("startButton");
const choicePanel = document.getElementById("choicePanel");
const heroStats = document.querySelector(".hero-stats");
const satelliteCount = document.getElementById("satelliteCount");
const ownerCount = document.getElementById("ownerCount");
const orbitRegionCount = document.getElementById("orbitRegionCount");

function formatCount(value) {
  if (value >= 1000) {
    return `${Math.floor(value / 100) / 10}k+`;
  }

  return `${value}`;
}

fetch("data/satellites_clean.json")
  .then(response => response.json())
  .then(data => {
    const owners = new Set(
      data
        .map(satellite => satellite.owner)
        .filter(Boolean)
    );

    const displayedRegions = new Set(
      data
        .map(satellite => satellite.ORBIT_CLASS)
        .filter(region => ["LEO", "MEO", "GEO"].includes(region))
    );

    satelliteCount.textContent = formatCount(data.length);
    ownerCount.textContent = `${owners.size}+`;
    orbitRegionCount.textContent = displayedRegions.size;
  })
  .catch(error => {
    console.error("Error loading homepage statistics:", error);
  });

startButton.addEventListener("click", () => {
  heroStats.classList.add("visible");
  choicePanel.classList.add("visible");

  choicePanel.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});


function createD3Earth() {
  const planet = document.querySelector(".planet");

  if (!planet || !window.d3 || !window.topojson) {
    return;
  }

  const size = 92;

  const svg = d3
    .select(planet)
    .append("svg")
    .attr("viewBox", `0 0 ${size} ${size}`)
    .attr("aria-hidden", "true");

  const projection = d3
    .geoOrthographic()
    .scale(size / 2.15)
    .translate([size / 2, size / 2])
    .clipAngle(90);

  const path = d3.geoPath(projection);

  svg
    .append("path")
    .datum({ type: "Sphere" })
    .attr("class", "earth-ocean")
    .attr("d", path);

  const landPath = svg
    .append("path")
    .attr("class", "earth-land");

  svg
    .append("path")
    .datum({ type: "Sphere" })
    .attr("class", "earth-glow")
    .attr("d", path);

  svg
    .append("circle")
    .attr("class", "earth-shade")
    .attr("cx", size * 0.68)
    .attr("cy", size * 0.62)
    .attr("r", size * 0.42);

  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
    .then(world => {
      const land = topojson.feature(world, world.objects.land);

      d3.timer(elapsed => {
        const rotationSpeed = elapsed * 0.018;

        projection.rotate([rotationSpeed, -12]);

        landPath.datum(land).attr("d", path);

        svg
          .select(".earth-ocean")
          .attr("d", path);

        svg
          .select(".earth-glow")
          .attr("d", path);
      });
    })
    .catch(error => {
      console.error("Could not load D3 Earth:", error);
    });
}

createD3Earth();