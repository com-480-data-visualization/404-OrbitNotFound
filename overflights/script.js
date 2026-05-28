const mapNode = document.getElementById("map");
const timeRange = document.getElementById("timeRange");
const timeValue = document.getElementById("timeValue");
const periodLabel = document.getElementById("periodLabel");
const selectedCountryLabel = document.getElementById("selectedCountry");
const resultCountry = document.getElementById("resultCountry");
const resultCount = document.getElementById("resultCount");
const satelliteList = document.getElementById("satelliteList");
const loadingState = document.getElementById("loadingState");
const detailsNode = document.getElementById("satelliteDetails");
const satelliteLib = window.satellite;

const width = 1000;
const height = 520;
const maxSatellites = 700;
const detectionStepMinutes = 3;
const displayStepMinutes = 1;

const projection = d3.geoNaturalEarth1()
  .scale(178)
  .translate([width / 2, height / 2 + 8]);

const path = d3.geoPath(projection);

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
let currentOverpasses = [];

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

function vectorMagnitude(vector) {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

function propagateSatellite(satellite, date) {
  const positionAndVelocity = satelliteLib.propagate(satellite.satrec, date);

  if (!positionAndVelocity || !positionAndVelocity.position || !positionAndVelocity.velocity) {
    return null;
  }

  const gmst = satelliteLib.gstime(date);
  const geodetic = satelliteLib.eciToGeodetic(positionAndVelocity.position, gmst);
  const lon = satelliteLib.degreesLong(geodetic.longitude);
  const lat = satelliteLib.degreesLat(geodetic.latitude);
  const projected = projection([lon, lat]);

  if (!projected) {
    return null;
  }

  return {
    lon,
    lat,
    altitude: geodetic.height,
    speed: vectorMagnitude(positionAndVelocity.velocity),
    xy: projected
  };
}

function orbitalSpeedKmS(satellite) {
  const state = satellite.currentState || propagateSatellite(satellite, new Date());
  return state?.speed || 0;
}

function makeTrack(satellite, hours, stepMinutes = detectionStepMinutes) {
  const steps = Math.max(12, Math.ceil((hours * 60) / stepMinutes));
  const startTime = Date.now();
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = (index / steps) * hours;
    const date = new Date(startTime + t * 60 * 60 * 1000);
    const point = propagateSatellite(satellite, date);

    if (point) {
      points.push(point);
    }
  }

  return points;
}

function splitTrack(points) {
  const segments = [];
  let segment = [];

  points.forEach((point, index) => {
    if (index > 0) {
      const previous = points[index - 1];
      const lonJump = Math.abs(point.lon - previous.lon);
      const xJump = point.xy[0] - previous.xy[0];
      const yJump = point.xy[1] - previous.xy[1];
      const projectedJump = Math.sqrt(xJump ** 2 + yJump ** 2);
      const crossesAntimeridian = lonJump > 180;
      const projectionDiscontinuity = projectedJump > width * 0.22;

      if (crossesAntimeridian || projectionDiscontinuity) {
        if (segment.length > 1) {
          segments.push(segment);
        }

        segment = [];
      }
    }

    segment.push(point);
  });

  if (segment.length > 1) {
    segments.push(segment);
  }

  return segments;
}

function trackSegmentToGeoJson(segment) {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: segment.map(point => [point.lon, point.lat])
    }
  };
}

function pointInsideBounds(point, bounds) {
  return point.xy[0] >= bounds[0][0]
    && point.xy[0] <= bounds[1][0]
    && point.xy[1] >= bounds[0][1]
    && point.xy[1] <= bounds[1][1];
}

function passesOverCountry(satellite, feature, hours) {
  const bounds = path.bounds(feature);
  const track = makeTrack(satellite, hours, detectionStepMinutes);
  const hit = track.some(point => pointInsideBounds(point, bounds));

  return hit ? { ...satellite, track, currentState: track[0] } : null;
}

function renderDetails(satellite) {
  const state = satellite.currentState || propagateSatellite(satellite, new Date());
  const altitude = state ? Math.round(state.altitude) : null;
  const speed = state ? state.speed.toFixed(2) : "--";

  detailsNode.innerHTML = `
    <span>Launch date</span>
    <strong>${satellite.launchDate || "--"}</strong>
    <span>Launch site</span>
    <strong>${launchSiteName(satellite.launchSite)}</strong>
    <span>Country</span>
    <strong>${ownerName(satellite.owner)}</strong>
    <span>Speed</span>
    <strong>${speed === "--" ? "--" : `${speed} km/s`}</strong>
    <span>Altitude</span>
    <strong>${altitude === null ? "--" : `${altitude.toLocaleString()} km`}</strong>
  `;
}

function renderTrack(satellite) {
  tracksLayer.selectAll("*").remove();

  if (!satellite) {
    return;
  }

  const displayHours = Number(timeRange.value);
  const displayTrack = makeTrack(satellite, displayHours, displayStepMinutes);
  const displaySegments = splitTrack(displayTrack).map(trackSegmentToGeoJson);

  tracksLayer.selectAll("path")
    .data(displaySegments)
    .join("path")
    .attr("class", "track")
    .attr("d", path);

  const firstPoint = displayTrack[Math.floor(displayTrack.length * 0.2)]?.xy;

  if (firstPoint) {
    tracksLayer.append("circle")
      .attr("class", "track-point")
      .attr("cx", firstPoint[0])
      .attr("cy", firstPoint[1])
      .attr("r", 6);
  }
}

function resetDetails() {
  detailsNode.innerHTML = `
    <span>Launch date</span>
    <strong>--</strong>
    <span>Launch site</span>
    <strong>--</strong>
    <span>Country</span>
    <strong>--</strong>
    <span>Speed</span>
    <strong>--</strong>
    <span>Altitude</span>
    <strong>--</strong>
  `;
}

function ownerGroups(overpasses) {
  const groups = new Map();

  overpasses.forEach(satellite => {
    const owner = satellite.owner || "Unknown";

    if (!groups.has(owner)) {
      groups.set(owner, []);
    }

    groups.get(owner).push(satellite);
  });

  groups.forEach(ownerSatellites => {
    ownerSatellites.sort((a, b) => inclinationValue(a) - inclinationValue(b));
  });

  return Array.from(groups.entries())
    .sort((a, b) => ownerInclinationValue(a[1]) - ownerInclinationValue(b[1]));
}

function inclinationValue(satellite) {
  return Number.isFinite(satellite.inclination) ? satellite.inclination : Number.POSITIVE_INFINITY;
}

function ownerInclinationValue(ownerSatellites) {
  return ownerSatellites.length ? inclinationValue(ownerSatellites[0]) : Number.POSITIVE_INFINITY;
}

function renderOwnerList(overpasses) {
  satelliteList.innerHTML = "";
  resultCount.textContent = overpasses.length;
  activeSatellite = null;
  renderTrack(null);
  resetDetails();

  if (!selectedCountry) {
    resultCount.textContent = "0";
    loadingState.textContent = "Click a country to list satellites crossing it.";
    loadingState.style.display = "block";
    return;
  }

  if (!overpasses.length) {
    loadingState.textContent = "No estimated overflights for this period. Try a longer duration.";
    loadingState.style.display = "block";
    return;
  }

  loadingState.style.display = "none";

  ownerGroups(overpasses).forEach(([owner, ownerSatellites]) => {
    const button = document.createElement("button");
    button.className = "owner-item";
    button.type = "button";
    button.innerHTML = `
      <span>
        <strong>${ownerName(owner)}</strong>
        <span>${owner}</span>
      </span>
      <strong class="owner-count">${ownerSatellites.length}</strong>
    `;

    button.addEventListener("click", () => {
      renderSatelliteList(owner, ownerSatellites);
    });

    satelliteList.appendChild(button);
  });
}

function renderSatelliteList(owner, ownerSatellites) {
  satelliteList.innerHTML = "";
  loadingState.style.display = "none";

  const backButton = document.createElement("button");
  backButton.className = "owner-back-button";
  backButton.type = "button";
  backButton.textContent = "Back to owners";
  backButton.addEventListener("click", () => {
    renderOwnerList(currentOverpasses);
  });
  satelliteList.appendChild(backButton);

  ownerSatellites.forEach((satellite, index) => {
    const button = document.createElement("button");
    button.className = "satellite-item";
    button.type = "button";
    button.innerHTML = `
      <strong>${satellite.name}</strong>
      <span>${ownerName(owner)} - NORAD ${satellite.norad}</span>
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
    currentOverpasses = [];
    renderOwnerList([]);
    renderTrack(null);
    return;
  }

  loadingState.textContent = "Estimating overflights...";
  loadingState.style.display = "block";

  const overpasses = satellites
    .map(satellite => passesOverCountry(satellite, selectedFeature, hours))
    .filter(Boolean)
    .sort((a, b) => inclinationValue(a) - inclinationValue(b));

  currentOverpasses = overpasses;
  renderOwnerList(overpasses);
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

function parseSatcatMetadata(rows) {
  return new Map(rows
    .map(row => ({
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
    .filter(satellite => Number.isFinite(satellite.norad))
    .map(satellite => [satellite.norad, satellite]));
}

function averageAltitude(satellite) {
  if (!Number.isFinite(satellite.apogee) || !Number.isFinite(satellite.perigee)) {
    return Number.POSITIVE_INFINITY;
  }

  return (satellite.apogee + satellite.perigee) / 2;
}

function parseSatellites(tleData, satcatRows) {
  const satcatByNorad = parseSatcatMetadata(satcatRows);

  return tleData.satellites
    .map(tle => {
      const metadata = satcatByNorad.get(tle.norad) || {};

      try {
        const satrec = satelliteLib.twoline2satrec(tle.line1, tle.line2);

        if (satrec.error) {
          return null;
        }

        return {
          name: tle.name,
          norad: tle.norad,
          line1: tle.line1,
          line2: tle.line2,
          satrec,
          owner: metadata.owner,
          launchDate: metadata.launchDate,
          launchSite: metadata.launchSite,
          period: metadata.period,
          inclination: metadata.inclination,
          apogee: metadata.apogee,
          perigee: metadata.perigee,
          objectType: metadata.objectType,
          orbitType: metadata.orbitType,
          decayDate: metadata.decayDate
        };
      } catch (error) {
        return null;
      }
    })
    .filter(satellite => satellite
      && satellite.satrec
      && !satellite.decayDate
      && satellite.objectType !== "DEB")
    .sort((a, b) => {
      return averageAltitude(a) - averageAltitude(b);
    })
    .slice(0, maxSatellites);
}

async function boot() {
  try {
    if (!satelliteLib) {
      throw new Error("satellite.js is not loaded");
    }

    const [world, tleData, satcatRows, ownerData, siteRows] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
      d3.json("../data/active_tles.json"),
      d3.csv("../data/raw/satcat_raw.csv"),
      d3.json("../data/satcat_owners.json"),
      d3.csv("../data/launch_sites_coords.csv")
    ]);

    owners = ownerData;
    launchSites = new Map(siteRows.map(site => [site.code, site]));
    satellites = parseSatellites(tleData, satcatRows);

    drawCountries(world);
    loadingState.textContent = "Click a country to list satellites crossing it.";
  } catch (error) {
    console.error("Unable to load overflight data:", error);
    loadingState.textContent = "Unable to load the map, TLEs, or SATCAT metadata. Please run the page from a local web server.";
  }
}

timeRange.addEventListener("input", updateOverpasses);
boot();
