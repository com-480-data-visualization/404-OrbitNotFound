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
