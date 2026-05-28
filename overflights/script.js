const mapNode = document.getElementById("map");
const timeRange = document.getElementById("timeRange");
const timeValue = document.getElementById("timeValue");
const periodLabel = document.getElementById("periodLabel");
const selectedCountryLabel = document.getElementById("selectedCountry");
const resultCountry = document.getElementById("resultCountry");
const satelliteList = document.getElementById("satelliteList");
const loadingState = document.getElementById("loadingState");
const detailsNode = document.getElementById("satelliteDetails");

const width = 1000;
const height = 520;
const earthRadiusKm = 6371;
const maxSatellites = 700;
const maxListedPasses = 90;
const activeTleUrl = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";

const projection = d3.geoNaturalEarth1()
  .scale(178)
  .translate([width / 2, height / 2 + 8]);

const path = d3.geoPath(projection);
const line = d3.line()
  .defined(point => point)
  .x(point => point[0])
  .y(point => point[1])
  .curve(d3.curveCatmullRom.alpha(0.5));

const svg = d3.select(mapNode)
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("role", "img")
  .attr("aria-label", "Interactive world map of satellite overflights");

const countriesLayer = svg.append("g");
const tracksLayer = svg.append("g");

let countries = [];
let satellites = [];
let owners = {};
let launchSites = new Map();
let selectedCountry = null;
let selectedFeature = null;
let activeSatellite = null;

function normalizeText(value) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countryName(feature) {
  return feature.properties.name || feature.properties.NAME || "Unknown country";
}

function ownerName(code) {
  return owners[code] || code || "Unknown";
}

function launchSiteName(code) {
  return launchSites.get(code)?.site_name || code || "Unknown";
}

function orbitalSpeedKmS(satellite) {
  const velocity = satellite.track?.find(point => point.velocityKmS)?.velocityKmS;

  if (velocity) {
    return velocity;
  }

  const altitude = (satellite.apogee + satellite.perigee) / 2;
  const radius = earthRadiusKm + altitude;
  return Math.sqrt(398600.4418 / radius);
}

function velocityMagnitudeKmS(velocity) {
  return Math.sqrt((velocity.x ** 2) + (velocity.y ** 2) + (velocity.z ** 2));
}

function makeTrack(satelliteData, hours) {
  const steps = Math.min(360, Math.max(72, Math.ceil(hours * 12)));
  const startTime = Date.now();
  const durationMs = hours * 60 * 60 * 1000;
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const date = new Date(startTime + ((index / steps) * durationMs));
    const positionAndVelocity = satellite.propagate(satelliteData.satrec, date);

    if (!positionAndVelocity.position || !positionAndVelocity.velocity) {
      continue;
    }

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    const lon = satellite.degreesLong(geodetic.longitude);
    const lat = satellite.degreesLat(geodetic.latitude);
    const projected = projection([lon, lat]);

    if (projected) {
      points.push({
        lon,
        lat,
        altitudeKm: geodetic.height,
        velocityKmS: velocityMagnitudeKmS(positionAndVelocity.velocity),
        xy: projected
      });
    }
  }

  return points;
}

function splitTrack(points) {
  const segments = [];
  let segment = [];

  points.forEach((point, index) => {
    if (index > 0 && Math.abs(point.xy[0] - points[index - 1].xy[0]) > width * 0.42) {
      if (segment.length > 1) {
        segments.push(segment);
      }
      segment = [];
    }

    segment.push(point.xy);
  });

  if (segment.length > 1) {
    segments.push(segment);
  }

  return segments;
}

function passesOverCountry(satellite, feature, hours) {
  const track = makeTrack(satellite, hours);
  const hit = track.some(point => d3.geoContains(feature, [point.lon, point.lat]));

  return hit ? { ...satellite, track } : null;
}

function renderDetails(satellite) {
  const livePoint = satellite.track?.find(point => point.altitudeKm);
  const altitude = Math.round(livePoint?.altitudeKm ?? ((satellite.apogee + satellite.perigee) / 2));
  const speed = orbitalSpeedKmS(satellite).toFixed(2);

  detailsNode.innerHTML = `
    <span>Launch date</span>
    <strong>${satellite.launchDate || "--"}</strong>
    <span>Launch site</span>
    <strong>${launchSiteName(satellite.launchSite)}</strong>
    <span>Country</span>
    <strong>${ownerName(satellite.owner)}</strong>
    <span>Speed</span>
    <strong>${speed} km/s</strong>
    <span>Altitude</span>
    <strong>${altitude.toLocaleString()} km</strong>
  `;
}

function renderTrack(satellite) {
  tracksLayer.selectAll("*").remove();

  if (!satellite) {
    return;
  }

  tracksLayer.selectAll("path")
    .data(splitTrack(satellite.track))
    .join("path")
    .attr("class", "track")
    .attr("d", segment => line(segment));

  const firstPoint = satellite.track[Math.floor(satellite.track.length * 0.2)]?.xy;

  if (firstPoint) {
    tracksLayer.append("circle")
      .attr("class", "track-point")
      .attr("cx", firstPoint[0])
      .attr("cy", firstPoint[1])
      .attr("r", 6);
  }
}

function renderList(overpasses) {
  satelliteList.innerHTML = "";

  if (!selectedCountry) {
    loadingState.textContent = "Click a country to list satellites crossing it.";
    loadingState.style.display = "block";
    return;
  }

  if (!overpasses.length) {
    loadingState.textContent = "No TLE-propagated overflights for this period. Try a longer duration.";
    loadingState.style.display = "block";
    return;
  }

  loadingState.style.display = "none";

  overpasses.forEach((satellite, index) => {
    const button = document.createElement("button");
    button.className = "satellite-item";
    button.type = "button";
    button.innerHTML = `
      <strong>${satellite.name}</strong>
      <span>${ownerName(satellite.owner)} - NORAD ${satellite.norad}</span>
    `;

    button.addEventListener("click", () => {
      activeSatellite = satellite;
      document.querySelectorAll(".satellite-item").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      renderTrack(activeSatellite);
      renderDetails(activeSatellite);
    });

    satelliteList.appendChild(button);

    if (index === 0) {
      button.click();
    }
  });
}

function updateOverpasses() {
  const hours = Number(timeRange.value);
  timeValue.textContent = hours;
  periodLabel.textContent = `${hours} h`;

  if (!selectedFeature) {
    renderList([]);
    renderTrack(null);
    return;
  }

  loadingState.textContent = "Estimating overflights...";
  loadingState.style.display = "block";

  const overpasses = satellites
    .map(satellite => passesOverCountry(satellite, selectedFeature, hours))
    .filter(Boolean)
    .sort((a, b) => orbitalSpeedKmS(b) - orbitalSpeedKmS(a))
    .slice(0, maxListedPasses);

  renderList(overpasses);
}

function chooseCountry(feature, node) {
  selectedFeature = feature;
  selectedCountry = countryName(feature);
  selectedCountryLabel.textContent = selectedCountry;
  resultCountry.textContent = selectedCountry;

  countriesLayer.selectAll(".country").classed("selected", false);
  d3.select(node).classed("selected", true);

  updateOverpasses();
}

function drawCountries(world) {
  countries = topojson.feature(world, world.objects.countries).features;

  countriesLayer.selectAll("path")
    .data(countries)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .on("click", function handleClick(event, feature) {
      chooseCountry(feature, this);
    })
    .append("title")
    .text(countryName);

  const france = countries.find(feature => normalizeText(countryName(feature)) === "france");
  const franceNode = countriesLayer.selectAll(".country")
    .filter(feature => feature === france)
    .node();

  if (france && franceNode) {
    chooseCountry(france, franceNode);
  }
}

function parseSatellites(rows) {
  return rows
    .map(row => ({
      name: row.OBJECT_NAME,
      norad: Number.parseInt(row.NORAD_CAT_ID, 10),
      objectType: row.OBJECT_TYPE,
      owner: row.OWNER,
      launchDate: row.LAUNCH_DATE,
      launchSite: row.LAUNCH_SITE,
      period: toNumber(row.PERIOD),
      inclination: toNumber(row.INCLINATION),
      apogee: toNumber(row.APOGEE),
      perigee: toNumber(row.PERIGEE),
      orbitType: row.ORBIT_TYPE,
      decayDate: row.DECAY_DATE
    }))
    .filter(satellite => satellite.name
      && Number.isFinite(satellite.norad)
      && satellite.period
      && satellite.apogee !== null
      && satellite.perigee !== null
      && satellite.orbitType === "ORB"
      && !satellite.decayDate
      && satellite.objectType !== "DEB")
    .sort((a, b) => {
      const aAltitude = (a.apogee + a.perigee) / 2;
      const bAltitude = (b.apogee + b.perigee) / 2;
      return aAltitude - bAltitude;
    })
}

function parseActiveTles(tleText) {
  const lines = tleText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const tleByNorad = new Map();

  for (let index = 0; index < lines.length - 2; index += 3) {
    const name = lines[index];
    const line1 = lines[index + 1];
    const line2 = lines[index + 2];

    if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) {
      continue;
    }

    const norad = Number.parseInt(line1.slice(2, 7), 10);

    if (!Number.isFinite(norad)) {
      continue;
    }

    try {
      tleByNorad.set(norad, {
        name,
        line1,
        line2,
        satrec: satellite.twoline2satrec(line1, line2)
      });
    } catch (error) {
      console.warn("Unable to parse TLE:", name, error);
    }
  }

  return tleByNorad;
}

function attachTles(satcatRows, tleByNorad) {
  return parseSatellites(satcatRows)
    .map(satcatSatellite => {
      const tle = tleByNorad.get(satcatSatellite.norad);

      if (!tle) {
        return null;
      }

      return {
        ...satcatSatellite,
        tleName: tle.name,
        tleLine1: tle.line1,
        tleLine2: tle.line2,
        satrec: tle.satrec
      };
    })
    .filter(Boolean)
    .slice(0, maxSatellites);
}

async function boot() {
  try {
    const [world, satcatRows, ownerData, siteRows, activeTles] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
      d3.csv("../data/raw/satcat_raw.csv"),
      d3.json("../data/satcat_owners.json"),
      d3.csv("../data/launch_sites_coords.csv"),
      d3.text(activeTleUrl)
    ]);

    owners = ownerData;
    launchSites = new Map(siteRows.map(site => [site.code, site]));
    satellites = attachTles(satcatRows, parseActiveTles(activeTles));

    drawCountries(world);
    loadingState.textContent = "Click a country to list TLE-propagated satellite passes.";
  } catch (error) {
    console.error("Unable to load overflight data:", error);
    loadingState.textContent = "Unable to load the map, SATCAT, or CelesTrak TLE data. Please run the page from a local web server.";
  }
}

timeRange.addEventListener("input", updateOverpasses);
boot();
