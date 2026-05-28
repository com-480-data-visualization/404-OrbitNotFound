let countries = [];
let selectedCountry = null;
let selectedMetric = "total";

const categoryColors = {
  total: "#4cc9f0",
  payloads: "#4cc9f0",
  debris: "#f4a261",
  rocket_bodies: "#9d8cff",
  unknown: "#94a3b8"
};

const metricLabels = {
  total: "Total objects",
  payloads: "Payloads",
  debris: "Debris",
  rocket_bodies: "Rocket bodies",
  unknown: "Unknown"
};

d3.json("../data/space_actors.json")
  .then(data => {
    countries = data.countries;

    populateCountrySelect();
    setupMetricSelect();

    selectedCountry = countries[0].country;
    d3.select("#countrySelect").property("value", selectedCountry);

    updateDashboard();
  })
  .catch(error => {
    console.error("Error loading space_actors.json:", error);
  });


function populateCountrySelect() {
  const select = d3.select("#countrySelect");

  select.selectAll("option").remove();

  select
    .selectAll("option")
    .data(countries)
    .enter()
    .append("option")
    .attr("value", d => d.country)
    .text(d => `${d.display_name || d.country} (${d.total.toLocaleString()})`);

  select.on("change", event => {
    selectedCountry = event.target.value;
    updateDashboard();
  });
}


function setupMetricSelect() {
  d3.select("#metricSelect").on("change", event => {
    selectedMetric = event.target.value;
    drawRankingChart();
  });
}


function getSelectedCountryData() {
  return countries.find(d => d.country === selectedCountry);
}


const numberFormat = d3.format(",d");

function animateNumber(selector, targetValue) {
  const element = d3.select(selector);

  const currentText = element.text();
  const currentValue = Number(currentText.replace(/[^\d.-]/g, "")) || 0;

  element
    .interrupt()
    .transition()
    .duration(1000)
    .ease(d3.easeCubicOut)
    .tween("text", function () {
      const interpolator = d3.interpolateNumber(currentValue, targetValue || 0);

      return function (t) {
        this.textContent = numberFormat(Math.round(interpolator(t)));
      };
    });
}


function updateDashboard() {
  const data = getSelectedCountryData();

  if (!data) return;

  d3.select("#selectedCountry").text(data.display_name || data.country);

  animateNumber("#totalObjects", data.total);
  animateNumber("#payloads", data.payloads);
  animateNumber("#debris", data.debris);
  animateNumber("#rocketBodies", data.rocket_bodies);
  animateNumber("#unknown", data.unknown);

  d3.select("#detailsTitle")
    .text(`Global overview`);

  d3.select("#detailsSubtitle")
    .text(`Summary of ${data.display_name || data.country}'s space objects across all years.`);

  drawTimeChart(data);
  drawRankingChart();
  drawTopActorsTimeline();
}


function drawTimeChart(countryData) {
  const container = d3.select("#timeChart");
  container.selectAll("*").remove();

  const yearly = countryData.yearly_activity || [];

  if (yearly.length === 0) {
    container.text("No yearly data available.");
    return;
  }

  const keys = ["payloads", "debris", "rocket_bodies", "unknown"];

  const color = d3.scaleOrdinal()
    .domain(keys)
    .range(["#4cc9f0", "#f4a261", "#9d8cff", "#94a3b8"]);

  const data = yearly.slice().map(d => {
    const row = {
      year: d.year,
      payloads: d.payloads || 0,
      debris: d.debris || 0,
      rocket_bodies: d.rocket_bodies || 0,
      unknown: d.unknown || 0
    };

    row.total =
      row.payloads +
      row.debris +
      row.rocket_bodies +
      row.unknown;

    return row;
  });

  const width = document.getElementById("timeChart").clientWidth;
  const height = 360;

  const margin = {
    top: 30,
    right: 30,
    bottom: 60,
    left: 60
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.total) || 1])
    .nice()
    .range([innerHeight, 0]);

  const stackedData = d3.stack()
    .keys(keys)(data);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .tickValues(x.domain().filter((d, i) => i % 5 === 0))
    );

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5));

  g.selectAll(".stack-layer")
    .data(stackedData)
    .join("g")
    .attr("class", "stack-layer")
    .attr("fill", d => color(d.key))
    .selectAll("rect")
    .data(d => d.map(value => ({
      key: d.key,
      year: value.data.year,
      value: value.data[d.key],
      total: value.data.total,
      y0: value[0],
      y1: value[1]
    })))
    .join("rect")
    .attr("x", d => x(d.year))
    .attr("y", d => y(d.y1))
    .attr("width", x.bandwidth())
    .attr("height", d => y(d.y0) - y(d.y1))
    .attr("opacity", 0.88);

  g.append("text")
    .attr("class", "chart-note")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "middle")
    .text("Launch year");
}


function drawRankingChart() {
  const container = d3.select("#rankingChart");

  const selectedData = getSelectedCountryData();
  if (!selectedData) return;

  const sorted = countries
    .slice()
    .sort((a, b) => d3.descending(a[selectedMetric], b[selectedMetric]));

  const selectedRank =
    sorted.findIndex(d => d.country === selectedCountry) + 1;

  d3.select("#rankingSubtitle")
    .text(`${metricLabels[selectedMetric]} ranking. ${selectedData.display_name || selectedData.country} is ranked #${selectedRank}.`);

  let data = sorted.slice(0, 10);

  if (!data.some(d => d.country === selectedCountry)) {
    data.push(selectedData);
  }

  // Smallest at bottom, biggest at top
  data = data.sort((a, b) => d3.ascending(a[selectedMetric], b[selectedMetric]));

  const width = document.getElementById("rankingChart").clientWidth;
  const height = 500;

  const margin = {
    top: 35,
    right: 120,
    bottom: 70,
    left: 190
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  let svg = container.select("svg");

  if (svg.empty()) {
    svg = container
      .append("svg")
      .attr("height", height);

    svg.append("g").attr("class", "ranking-plot");
    svg.append("g").attr("class", "x-axis axis");
    svg.append("g").attr("class", "y-axis axis");
    svg.append("text").attr("class", "chart-note ranking-note");
  }

  svg.attr("width", width);

  const g = svg
    .select(".ranking-plot")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xAxisG = svg
    .select(".x-axis")
    .attr("transform", `translate(${margin.left}, ${margin.top + innerHeight})`);

  const yAxisG = svg
    .select(".y-axis")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[selectedMetric]) || 1])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.country))
    .range([innerHeight, 0])
    .padding(0.25);

  const t = svg
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut);

  xAxisG
    .transition(t)
    .call(
      d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d3.format("~s"))
    );

  yAxisG
    .transition(t)
    .call(
      d3.axisLeft(y)
        .tickFormat(code => {
          const item = data.find(d => d.country === code);
          return item.display_name || item.country;
        })
    );

  g.selectAll(".ranking-bar")
    .data(data, d => d.country)
    .join(
      enter => enter
        .append("rect")
        .attr("class", d =>
          d.country === selectedCountry
            ? "ranking-bar d3-bar selected-bar"
            : "ranking-bar d3-bar"
        )
        .attr("x", 0)
        .attr("y", d => y(d.country))
        .attr("height", y.bandwidth())
        .attr("width", 0)
        .attr("opacity", 0)
        .call(enter => enter
          .transition(t)
          .attr("opacity", 1)
          .attr("width", d => x(d[selectedMetric]))
        ),

      update => update
        .attr("class", d =>
          d.country === selectedCountry
            ? "ranking-bar d3-bar selected-bar"
            : "ranking-bar d3-bar"
        )
        .call(update => update
          .transition(t)
          .attr("y", d => y(d.country))
          .attr("height", y.bandwidth())
          .attr("width", d => x(d[selectedMetric]))
        ),

      exit => exit
        .call(exit => exit
          .transition(t)
          .attr("width", 0)
          .attr("opacity", 0)
          .remove()
        )
    );

  g.selectAll(".ranking-value")
    .data(data, d => d.country)
    .join(
      enter => enter
        .append("text")
        .attr("class", "ranking-value bar-text")
        .attr("x", 0)
        .attr("y", d => y(d.country) + y.bandwidth() / 2 + 4)
        .attr("opacity", 0)
        .text(d => d[selectedMetric].toLocaleString())
        .call(enter => enter
          .transition(t)
          .attr("x", d => x(d[selectedMetric]) + 8)
          .attr("opacity", 1)
        ),

      update => update
        .text(d => d[selectedMetric].toLocaleString())
        .call(update => update
          .transition(t)
          .attr("x", d => x(d[selectedMetric]) + 8)
          .attr("y", d => y(d.country) + y.bandwidth() / 2 + 4)
        ),

      exit => exit
        .call(exit => exit
          .transition(t)
          .attr("opacity", 0)
          .remove()
        )
    );

  svg.select(".ranking-note")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", margin.top + innerHeight + 50)
    .attr("text-anchor", "middle")
    .text(metricLabels[selectedMetric]);
}


function drawTopActorsTimeline() {
  const container = d3.select("#topActorsChart");
  container.selectAll("*").remove();

  if (!countries || countries.length === 0) return;

  // Top 5 actors by total number of objects
  const topActors = countries
    .slice()
    .sort((a, b) => d3.descending(a.total, b.total))
    .slice(0, 5);

  const allYears = topActors
    .flatMap(actor => actor.yearly_activity || [])
    .map(d => +d.year)
    .filter(year => !Number.isNaN(year));

  if (allYears.length === 0) {
    container.text("No yearly data available.");
    return;
  }

  const minYear = d3.min(allYears);
  const maxYear = d3.max(allYears);
  const years = d3.range(minYear, maxYear + 1);

  const series = topActors.map(actor => {
    const yearlyMap = new Map(
      (actor.yearly_activity || []).map(d => [+d.year, +d.count || 0])
    );

    const values = years.map(year => ({
      year,
      count: yearlyMap.get(year) || 0
    }));

    return {
      country: actor.country,
      display_name: actor.display_name || actor.country,
      full_name: actor.full_name || actor.display_name || actor.country,
      values
    };
  });

  const width = document.getElementById("topActorsChart").clientWidth;
  const height = 520;

  const margin = {
    top: 30,
    right: 45,
    bottom: 135,
    left: 70
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Tooltip only for this chart
  const topActorsTooltip = d3.select("body")
    .selectAll(".top-actors-hover-tooltip")
    .data([null])
    .join("div")
    .attr("class", "top-actors-hover-tooltip");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const x = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([
      0,
      d3.max(series, actor => d3.max(actor.values, d => d.count)) || 1
    ])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(series.map(d => d.country))
    .range([
      "#4cc9f0",
      "#f4a261",
      "#9d8cff",
      "#2a9d8f",
      "#e76f51"
    ]);

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.count))
    .curve(d3.curveMonotoneX);

  // X axis
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(
      d3.axisBottom(x)
        .ticks(8)
        .tickFormat(d3.format("d"))
    );

  // Y axis
  g.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d3.format(","))
    );

  // Lines
  g.selectAll(".actor-line")
    .data(series, d => d.country)
    .join("path")
    .attr("class", d =>
      d.country === selectedCountry
        ? "actor-line selected-line"
        : "actor-line"
    )
    .attr("fill", "none")
    .attr("stroke", d => color(d.country))
    .attr("d", d => line(d.values));

  // Hover group: vertical line + dots
  const hoverGroup = g
    .append("g")
    .attr("class", "hover-group")
    .style("display", "none");

  hoverGroup
    .append("line")
    .attr("class", "hover-line")
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const hoverDots = hoverGroup
    .selectAll(".hover-dot")
    .data(series)
    .join("circle")
    .attr("class", "hover-dot")
    .attr("r", 5)
    .attr("fill", d => color(d.country));

  // Invisible rectangle to capture mouse movement
  g.append("rect")
    .attr("class", "hover-capture")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .style("pointer-events", "all")
    .on("mouseenter", () => {
      hoverGroup.style("display", null);
    })
    .on("mousemove", function(event) {
      const [mouseX] = d3.pointer(event, this);

      const hoveredYear = Math.round(x.invert(mouseX));
      const clampedYear = Math.max(minYear, Math.min(maxYear, hoveredYear));

      const valuesAtYear = series
        .map(actor => {
          const value = actor.values.find(d => d.year === clampedYear);

          return {
            country: actor.country,
            display_name: actor.display_name,
            full_name: actor.full_name,
            count: value ? value.count : 0
          };
        })
        .sort((a, b) => d3.descending(a.count, b.count));

      // Move vertical line
      hoverGroup
        .select(".hover-line")
        .attr("x1", x(clampedYear))
        .attr("x2", x(clampedYear));

      // Move dots on each curve
      hoverDots
        .attr("cx", x(clampedYear))
        .attr("cy", actor => {
          const value = actor.values.find(d => d.year === clampedYear);
          return y(value ? value.count : 0);
        });

      // Tooltip content
      const tooltipHtml = `
        <div class="tooltip-year">${clampedYear}</div>
        ${valuesAtYear.map(d => `
          <div class="tooltip-row">
            <span class="tooltip-name">
              <span class="tooltip-swatch" style="background:${color(d.country)}"></span>
              ${d.display_name}
            </span>
            <span class="tooltip-value">${d.count.toLocaleString()}</span>
          </div>
        `).join("")}
      `;

      topActorsTooltip
        .html(tooltipHtml)
        .style("opacity", 1);

      const tooltipWidth = topActorsTooltip.node().getBoundingClientRect().width;
      const leftPosition = Math.max(12, event.pageX - tooltipWidth - 18);

      topActorsTooltip
        .style("left", `${leftPosition}px`)
        .style("top", `${event.pageY + 18}px`);
    })
    .on("mouseleave", () => {
      hoverGroup.style("display", "none");
      topActorsTooltip.style("opacity", 0);
    });

  // X axis label
  g.append("text")
    .attr("class", "chart-note")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 55)
    .attr("text-anchor", "middle")
    .text("Launch year");

  // Y axis label
  g.append("text")
    .attr("class", "chart-note")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -52)
    .attr("text-anchor", "middle")
    .text("Catalogued objects per year");

  // Legend below the x-axis label
  const legend = g
    .append("g")
    .attr("class", "line-legend")
    .attr("transform", `translate(0, ${innerHeight + 95})`);

  const itemWidth = 190;
  const itemsPerRow = Math.max(1, Math.floor(innerWidth / itemWidth));

  const legendItems = legend
    .selectAll(".legend-item")
    .data(series)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => {
      const xPos = (i % itemsPerRow) * itemWidth;
      const yPos = Math.floor(i / itemsPerRow) * 24;
      return `translate(${xPos}, ${yPos})`;
    });

  legendItems.append("line")
    .attr("x1", 0)
    .attr("x2", 28)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", d => color(d.country))
    .attr("stroke-width", 4)
    .attr("stroke-linecap", "round");

  legendItems.append("text")
    .attr("x", 38)
    .attr("y", 5)
    .attr("fill", d => color(d.country))
    .text(d => d.display_name);
}


window.addEventListener("resize", () => {
  if (countries.length > 0 && selectedCountry !== null) {
    updateDashboard();
  }
});