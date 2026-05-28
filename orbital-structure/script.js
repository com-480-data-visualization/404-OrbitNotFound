// Load both datasets before drawing anything.
// satellites_clean.json drives the overview and LEO/MEO zoom plots.
// geo_celestrak_longitude.json drives the GEO longitude/map plot.
Promise.all([
    fetch("../data/satellites_clean.json").then(response => response.json()),
    fetch("../data/geo_celestrak_longitude.json").then(response => response.json()),
    fetch("../data/satcat_owners.json").then(response => response.json()),
    fetch("../data/raw/satcat_raw.csv").then(response => response.text())
])
.then(([data, geoSnapshot, ownerNames, satcatRawCsv]) => {
    // The GEO file has metadata plus a "satellites" array, so keep only the array here.
    const geoSatellites = geoSnapshot.satellites;
    console.log("Loaded data:", data);
    console.log("Loaded GEO data:", geoSatellites);

    // Store all DOM references once, so the rest of the script can reuse them.
    const ownerSelect = document.getElementById("owner-select");
    const statusSelect = document.getElementById("status-select");
    const geoOwnerSelect = document.getElementById("geo-select");
    const viz = document.getElementById("viz");
    const leoViz = document.getElementById("leo-plot");
    const meoViz = document.getElementById("meo-plot");
    const geoViz = document.getElementById("geo-viz");
    const segmentSelect = document.getElementById("segment-select");
    const meoSegmentSelect = document.getElementById("meo-segment-select");
    const zoomPopup = document.getElementById("orbit-zoom-popup");
    const zoomPopupText = document.getElementById("orbit-zoom-text");
    const zoomYes = document.getElementById("orbit-zoom-yes");
    const zoomNo = document.getElementById("orbit-zoom-no");
    const ownerTooltip = document.getElementById("owner-tooltip");
    const plotImportanceButton = document.getElementById("plot-importance-button");
    const plotImportancePopup = document.getElementById("plot-importance-popup");
    const plotImportanceClose = document.getElementById("plot-importance-close");
    const geoInfoButton = document.getElementById("geo-info-button");
    const geoInfoPopup = document.getElementById("geo-info-popup");
    const geoInfoClose = document.getElementById("geo-info-close");
    let activeOrbitTarget = null;
    let activeOrbitClass = null;
    let orbitPopupHideTimer = null;

    // Build a lookup table from NORAD ID to operational status.
    // The GEO longitude dataset does not contain status, so the GEO plot uses this table
    // to exclude decayed satellites based on satellites_clean.json.
    const statusByNorad = {};
    data.forEach(sat => {
        if (sat.norad === null || sat.norad === undefined) return;
        statusByNorad[Number(sat.norad)] = sat.status;
    });

    function parseCsvLine(line) {
        const values = [];
        let value = "";
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && insideQuotes && nextChar === '"') {
                value += '"';
                i++;
            } else if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === "," && !insideQuotes) {
                values.push(value);
                value = "";
            } else {
                value += char;
            }
        }

        values.push(value);
        return values;
    }

    const launchDateByNorad = {};
    const satcatLines = satcatRawCsv.trim().split(/\r?\n/);
    const satcatHeaders = parseCsvLine(satcatLines[0]);
    const noradColumn = satcatHeaders.indexOf("NORAD_CAT_ID");
    const launchDateColumn = satcatHeaders.indexOf("LAUNCH_DATE");

    satcatLines.slice(1).forEach(line => {
        const values = parseCsvLine(line);
        const norad = Number(values[noradColumn]);
        const launchDate = values[launchDateColumn];

        if (Number.isFinite(norad) && launchDate) {
            launchDateByNorad[norad] = launchDate;
        }
    });

    // Fill the GEO owner dropdown.
    // Counts are based on the current CelesTrak GEO snapshot, excluding decayed satellites.
    const geoOwnerCounts = {};
    geoSatellites.forEach(sat => {
        if (!sat.owner) return;
        if (getStatusGroup(statusByNorad[Number(sat.norad)]) === "excluded") return;
        geoOwnerCounts[sat.owner] = (geoOwnerCounts[sat.owner] || 0) + 1;
    });

    const geoOwners = Object.keys(geoOwnerCounts).sort();
    geoOwners.forEach(owner => {
        const option = document.createElement("option");
        option.value = owner;
        option.textContent = `${getOwnerDisplayName(owner)} (${geoOwnerCounts[owner]})`;
        geoOwnerSelect.appendChild(option);
    });

    // -------------------------
    // 1. Fill overview owner dropdown
    // -------------------------
    // Count non-decayed satellites per owner for the first plot dropdown.
    // This count is not orbit-specific; the first plot later filters to LEO/MEO/GEO visually.
    const ownerCounts = {};

    data.forEach(d => {
    if (!d.owner) return;
    if (getStatusGroup(d.status) === "excluded") return;
    ownerCounts[d.owner] = (ownerCounts[d.owner] || 0) + 1;
    });

    const owners = Object.keys(ownerCounts).sort();

    owners.forEach(owner => {
    const option = document.createElement("option");
    option.value = owner;
    option.textContent = `${getOwnerDisplayName(owner)} (${ownerCounts[owner]})`;
    ownerSelect.appendChild(option);
    });

    // -------------------------
    // 2. Overview SVG geometry
    // -------------------------
    // These values define the conceptual orbit diagram dimensions and ring radii.
    // They are visual radii, not real orbital distances.
    const width = 500;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;

    const earthRadius = 40;

    const leoInner = 41;
    const leoOuter = 80;

    const meoInner = 80;
    const meoOuter = 130;

    const geoRadius = 180;

    // -------------------------
    // 3. Helper functions
    // -------------------------
    function altitudeToRadius(altitude, minAltitude, maxAltitude, minRadius, maxRadius) {
        const t = Math.max(0, Math.min(1, (altitude - minAltitude) / (maxAltitude - minAltitude)));
        return minRadius + t * (maxRadius - minRadius);
    }

    function positionByAltitude(satellite, minAltitude, maxAltitude, minRadius, maxRadius) {
        const altitude = (satellite.perigee + satellite.apogee) / 2;
        const angle = Math.random() * 2 * Math.PI;
        const radius = altitudeToRadius(altitude, minAltitude, maxAltitude, minRadius, maxRadius);

        return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        };
    }

    // Small helper so every SVG shape/text element is created with the SVG namespace.
    function createSvgElement(tag) {
        return document.createElementNS("http://www.w3.org/2000/svg", tag);
    }

    // Convert raw OPS_STATUS_CODE values into the categories used by the UI.
    // "+" is operational; -, P, B, S and X are grouped as non-operational.
    // D and missing/unknown values are excluded from the status-filtered plots.
    function getStatusGroup(status) {
        if (status === "+") return "operational";
        if (["-", "P", "B", "S", "X"].includes(status)) return "non-operational";
        return "excluded";
    }

    // Display a human-readable owner name in dropdowns while keeping the owner code as value.
    function getOwnerDisplayName(owner) {
        return ownerNames[owner] || owner;
    }

    // Position the owner tooltip near the cursor without covering the row being inspected.
    function moveOwnerTooltip(event) {
        ownerTooltip.style.left = `${event.clientX + 14}px`;
        ownerTooltip.style.top = `${event.clientY + 14}px`;
    }

    // Show the owner acronym and, when available, its full SATCAT owner name.
    function showOwnerTooltip(event, ownerCode) {
        if (!ownerCode || ownerCode === "None") return;

        ownerTooltip.innerHTML = "";

        const code = document.createElement("strong");
        code.textContent = ownerCode;
        ownerTooltip.appendChild(code);

        const ownerName = getOwnerDisplayName(ownerCode);
        if (ownerName !== ownerCode) {
            const name = document.createElement("span");
            name.textContent = ownerName;
            ownerTooltip.appendChild(name);
        }

        moveOwnerTooltip(event);
        ownerTooltip.classList.add("visible");
    }

    // Fade the tooltip away. CSS handles the actual transition.
    function hideOwnerTooltip() {
        ownerTooltip.classList.remove("visible");
    }

    function formatLongitude(longitude) {
        const direction = longitude < 0 ? "W" : "E";
        return `${Math.abs(longitude).toFixed(2)}°${direction}`;
    }

    function addTooltipRow(label, value) {
        const row = document.createElement("span");
        row.className = "tooltip-row";
        row.textContent = `${label}: ${value || "--"}`;
        ownerTooltip.appendChild(row);
    }

    function showGeoSatelliteTooltip(event, satellite) {
        ownerTooltip.innerHTML = "";

        const title = document.createElement("strong");
        title.textContent = satellite.name || `NORAD ${satellite.norad}`;
        ownerTooltip.appendChild(title);

        addTooltipRow("NORAD", satellite.norad);
        addTooltipRow("Longitude", formatLongitude(satellite.longitude));
        addTooltipRow("Launch date", launchDateByNorad[Number(satellite.norad)]);

        moveOwnerTooltip(event);
        ownerTooltip.classList.add("visible");
    }

    // -------------------------
    // 4. Orbit zoom popup
    // -------------------------
    function clearOrbitPopupHideTimer() {
        if (orbitPopupHideTimer) {
            clearTimeout(orbitPopupHideTimer);
            orbitPopupHideTimer = null;
        }
    }

    function scheduleOrbitPopupHide() {
        clearOrbitPopupHideTimer();

        orbitPopupHideTimer = setTimeout(() => {
            hideOrbitPopup();
        }, 1500);
    }

    // Show a modal-style popup when the user hovers near an orbit in the overview.
    // The popup remembers which zoom plot it should scroll to if the user clicks "Yes".
    function showOrbitPopup(event, orbitClass, targetId) {
        clearOrbitPopupHideTimer();

        if (activeOrbitClass === orbitClass) return;

        activeOrbitClass = orbitClass;
        activeOrbitTarget = targetId;
        zoomPopup.classList.remove("popup-leo", "popup-meo", "popup-geo");
        zoomPopup.classList.add(`popup-${orbitClass.toLowerCase()}`);

        document.getElementById("orbit-zoom-title").textContent = `Zoom into ${orbitClass}?`;
        zoomPopupText.textContent = `Dive into the ${orbitClass} region and explore the satellites in more detail.`;

        zoomPopup.style.left = "auto";
        zoomPopup.style.right = "56px";
        zoomPopup.style.top = "50%";
        zoomPopup.style.transform = "translateY(-50%)";
        zoomPopup.style.display = "grid";

    }

    // Hide the popup and reset the stored target orbit.
    function hideOrbitPopup() {
        clearOrbitPopupHideTimer();
        zoomPopup.style.display = "none";
        activeOrbitTarget = null;
        activeOrbitClass = null;
    }

    // "Yes" button: scroll smoothly to the active LEO/MEO/GEO section.
    zoomYes.addEventListener("click", () => { // yess zoom popup button
        if (!activeOrbitTarget) return;

        document.getElementById(activeOrbitTarget).scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        hideOrbitPopup();
    });

    zoomNo.addEventListener("click", hideOrbitPopup); //close popup button

    // First-plot explanation popup.
    // It is separate from the orbit zoom popup because it explains the visualization,
    // rather than navigating to another section.
    function showPlotImportancePopup() {
        hideOwnerTooltip();
        hideOrbitPopup();
        plotImportancePopup.classList.add("visible");
        plotImportancePopup.setAttribute("aria-hidden", "false");
    }

    function hidePlotImportancePopup() {
        plotImportancePopup.classList.remove("visible");
        plotImportancePopup.setAttribute("aria-hidden", "true");
    }

    function showGeoInfoPopup() {
        hideOwnerTooltip();
        hideOrbitPopup();
        geoInfoPopup.classList.add("visible");
        geoInfoPopup.setAttribute("aria-hidden", "false");
    }

    function hideGeoInfoPopup() {
        geoInfoPopup.classList.remove("visible");
        geoInfoPopup.setAttribute("aria-hidden", "true");
    }

    plotImportanceButton.addEventListener("click", showPlotImportancePopup);
    plotImportanceClose.addEventListener("click", hidePlotImportancePopup);
    geoInfoButton.addEventListener("click", showGeoInfoPopup);
    geoInfoClose.addEventListener("click", hideGeoInfoPopup);

    plotImportancePopup.addEventListener("click", event => {
        if (event.target === plotImportancePopup) {
            hidePlotImportancePopup();
        }
    });

    geoInfoPopup.addEventListener("click", event => {
        if (event.target === geoInfoPopup) {
            hideGeoInfoPopup();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            hidePlotImportancePopup();
            hideGeoInfoPopup();
        }
    });

    // Close the popup when the user scrolls away from the first/orbit overview plot.
    // The threshold makes it disappear before the plot is completely off-screen.
    window.addEventListener("scroll", () => { //close popup when scroll
    if (zoomPopup.style.display === "none") return;

    const vizRect = viz.getBoundingClientRect();

    const hideThreshold = 400;

    const vizIsOffScreen =
        vizRect.bottom < hideThreshold ||
        vizRect.top > window.innerHeight - hideThreshold;

    if (vizIsOffScreen) {
        hideOrbitPopup();
    }
});



    // -------------------------
    // 5. Main orbit overview plot
    // -------------------------
    // Draws the conceptual Earth-orbit diagram.
    // The owner dropdown controls which satellites appear, and the status dropdown
    // controls whether operational or non-operational satellites are included.
    function drawVisualization(selectedOwner, selectedStatus) {
        // Remove the previous SVG before redrawing.
        viz.innerHTML = "";

        const svg = createSvgElement("svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);

        // Detect the hovered orbit by measuring cursor distance from Earth's center.
        // This avoids unreliable hover behavior from overlapping SVG circles.
        svg.addEventListener("mousemove", event => {
            const rect = svg.getBoundingClientRect();

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            const distance = Math.sqrt(
                (mouseX - cx) ** 2 +
                (mouseY - cy) ** 2
            );

            if (distance >= leoInner && distance <= leoOuter) {
                showOrbitPopup(event, "LEO", "leo-viz");
            } else if (distance > meoInner && distance <= meoOuter) {
                showOrbitPopup(event, "MEO", "meo-viz");
            } else if (distance > meoOuter && distance <= geoRadius + 10) {
                showOrbitPopup(event, "GEO", "geo-viz");
            } else if (activeOrbitClass && !orbitPopupHideTimer) {
                scheduleOrbitPopupHide();
            }
        });

        svg.addEventListener("mouseleave", () => {
            if (activeOrbitClass && !orbitPopupHideTimer) {
                scheduleOrbitPopupHide();
            }
        });


        // --- GEO zone: largest orbit layer.
        const geo = createSvgElement("circle");
        geo.setAttribute("cx", cx);
        geo.setAttribute("cy", cy);
        geo.setAttribute("r", geoRadius);
        geo.setAttribute("class", "orbit-zone zone-geo");
        svg.appendChild(geo);

        // --- MEO zone: middle orbit layer.
        const meo = createSvgElement("circle");
        meo.setAttribute("cx", cx);
        meo.setAttribute("cy", cy);
        meo.setAttribute("r", meoOuter);
        meo.setAttribute("class", "orbit-zone zone-meo");
        svg.appendChild(meo);

        // --- LEO zone: innermost orbit layer.
        const leo = createSvgElement("circle");
        leo.setAttribute("cx", cx);
        leo.setAttribute("cy", cy);
        leo.setAttribute("r", leoOuter);
        leo.setAttribute("class", "orbit-zone zone-leo");
        svg.appendChild(leo);

        // --- Cut out inner rings.
        // These circles mask the inside of larger zones so the diagram reads as layers.
        const cutGeo = createSvgElement("circle");
        cutGeo.setAttribute("cx", cx);
        cutGeo.setAttribute("cy", cy);
        cutGeo.setAttribute("r", meoOuter);
        cutGeo.setAttribute("class", "orbit-cutout");
        svg.appendChild(cutGeo);

        const cutMeo = createSvgElement("circle");
        cutMeo.setAttribute("cx", cx);
        cutMeo.setAttribute("cy", cy);
        cutMeo.setAttribute("r", leoOuter);
        cutMeo.setAttribute("class", "orbit-cutout");
        svg.appendChild(cutMeo);

        const cutLeo = createSvgElement("circle");
        cutLeo.setAttribute("cx", cx);
        cutLeo.setAttribute("cy", cy);
        cutLeo.setAttribute("r", leoInner);
        cutLeo.setAttribute("class", "orbit-cutout");
        svg.appendChild(cutLeo);

        // --- Orbit boundaries.
        // Dashed circles make the orbit limits visible and provide hover targets.
        const boundaryRadii = [
            { r: leoOuter, className: "boundary-leo", orbit: "LEO", target: "leo-viz" },
            { r: meoOuter, className: "boundary-meo", orbit: "MEO", target: "meo-viz" },
            { r: geoRadius, className: "boundary-geo", orbit: "GEO", target: "geo-viz" }
        ];

        boundaryRadii.forEach(item => {
            const boundary = createSvgElement("circle");
            boundary.setAttribute("cx", cx);
            boundary.setAttribute("cy", cy);
            boundary.setAttribute("r", item.r);
            boundary.setAttribute("class", `orbit-boundary ${item.className}`);
            svg.appendChild(boundary);
            boundary.addEventListener("mousemove", event => {
                showOrbitPopup(event, item.orbit, item.target);
            });
            
        });

        // --- Earth marker in the center of the conceptual orbit diagram.
        const earth = createSvgElement("circle");
        earth.setAttribute("cx", cx);
        earth.setAttribute("cy", cy);
        earth.setAttribute("r", earthRadius);
        earth.setAttribute("class", "earth");
        svg.appendChild(earth);
        // tout 4a juste pour l'écrire en plus petit
        const note = createSvgElement("text");
        note.setAttribute("x", cx);
        note.setAttribute("y", height - 20);
        note.setAttribute("class", "note");
        note.textContent = "Not to scale • conceptual visualization";
        svg.appendChild(note);
        
        // --- Orbit labels (Earth, LEO, MEO, GEO).
        function addLabel(text, x, y, className) {
        const label = createSvgElement("text");
        label.setAttribute("x", x);
        label.setAttribute("y", y);
        label.setAttribute("class", `label orbit-label ${className}`);
        label.textContent = text;
        svg.appendChild(label);
        }

        addLabel("Earth", cx, cy + 4, "label-earth");
        addLabel("LEO", cx, cy - leoOuter + 18, "label-leo");
        addLabel("MEO", cx, cy - meoOuter + 18, "label-meo");
        addLabel("GEO", cx, cy - geoRadius + 18, "label-geo");

        // --- Filter satellites for the overview plot.
        // If no owner is selected, no satellite dots are drawn.
        let satellites = [];

        if (selectedOwner) {
            satellites = data.filter(d => d.owner === selectedOwner);
        }

        // Apply operational/non-operational filtering and exclude decayed satellites.
        satellites = satellites.filter(d => {
            const statusGroup = getStatusGroup(d.status);
            if (statusGroup === "excluded") return false;
            if (!selectedStatus) return true;
            return statusGroup === selectedStatus;
        });

        // Keep only the orbit classes represented by this conceptual overview.
        satellites = satellites.filter(d =>
            d.ORBIT_CLASS === "LEO" ||
            d.ORBIT_CLASS === "MEO" ||
            d.ORBIT_CLASS === "GEO"
        );

        // --- Draw satellites.
        // Angle stays random, but radius is based on average altitude
        // computed from perigee and apogee.
        satellites.forEach(sat => {
            let pos;

            if (sat.ORBIT_CLASS === "LEO") {
                pos = positionByAltitude(sat, 0, 2000, leoInner + 2, leoOuter - 2);
            } else if (sat.ORBIT_CLASS === "MEO") {
                pos = positionByAltitude(sat, 2000, 35786, meoInner + 2, meoOuter - 2);
            } else if (sat.ORBIT_CLASS === "GEO") {
                pos = positionByAltitude(sat, 35286, 36286, geoRadius - 2, geoRadius + 2);
            }

            const dot = createSvgElement("circle");
            dot.setAttribute("cx", pos.x);
            dot.setAttribute("cy", pos.y);
            dot.setAttribute("r", 2.5);
            dot.setAttribute(
            "class",
            `satellite-dot satellite-${sat.ORBIT_CLASS.toLowerCase()}`
            );

            svg.appendChild(dot);
        });

        viz.appendChild(svg);
    }


    
    // -------------------------
    // LEO-MEO plot
    // -------------------------
    // Draw either the LEO or MEO altitude-layer plot.
    // The selected number of layers comes from the dropdown inside each zoom box.
    function drawOrbitZoom(orbitClass, container) {
        // Clear only the inner plot area, leaving the dropdown and explanatory text intact.
        container.innerHTML = "";
        hideOwnerTooltip();

        const width = 520;
        const height = 700;

        const svg = createSvgElement("svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);

        // Real altitude ranges used for each orbit zoom.
        const orbitBounds = {
            LEO: { minAlt: 0, maxAlt: 2000, title: "LEO Zoom" },
            MEO: { minAlt: 2000, maxAlt: 35786, title: "MEO Zoom" }
        };
        const { minAlt, maxAlt, title: zoomTitle } = orbitBounds[orbitClass];
        // LEO and MEO each have their own altitude-layer dropdown.
        const segmentControl = orbitClass === "MEO" ? meoSegmentSelect : segmentSelect;
        const nSegments = Number(segmentControl.value);

        // Layout constants for the row boxes, labels, and altitude axis.
        const xLeft = 160;
        const xRight = 500;
        const altitudeOffsetX = 18;
        const altitudeLabelOffsetX = 12;

        const yTop = 80;
        const yBottom = 640;
        const columnHeight = yBottom - yTop;
        const segmentHeight = columnHeight / nSegments;

        // Keep only non-decayed satellites from the selected orbit class.
        let orbitData = data.filter(d =>
            d.ORBIT_CLASS === orbitClass &&
            getStatusGroup(d.status) !== "excluded"
        );

        // Compute average altitude from perigee and apogee.
        orbitData = orbitData.map(d => ({
            ...d,
            altitude: (d.perigee + d.apogee) / 2
        }));

        // Keep only altitudes that belong in the selected orbit zoom range.
        orbitData = orbitData.filter(d => d.altitude >= minAlt && d.altitude <= maxAlt);

        // Title.
        const title = createSvgElement("text");
        title.setAttribute("x", width / 2);
        title.setAttribute("y", 40);
        title.setAttribute("class", "leo-title");
        title.textContent = zoomTitle;
        svg.appendChild(title);

        // Subtitle.
        const subtitle = createSvgElement("text");
        subtitle.setAttribute("x", width / 2);
        subtitle.setAttribute("y", 62);
        subtitle.setAttribute("class", "label leo-subtitle");
        subtitle.textContent = "Dominant owner by altitude segment";
        svg.appendChild(subtitle);

        // Top and bottom guide lines framing the altitude layers.
        const topLine = createSvgElement("line");
        topLine.setAttribute("x1", xLeft - 45);
        topLine.setAttribute("x2", xRight + 45);
        topLine.setAttribute("y1", yTop);
        topLine.setAttribute("y2", yTop);
        topLine.setAttribute("class", "leo-guide-line");
        svg.appendChild(topLine);

        const bottomLine = createSvgElement("line");
        bottomLine.setAttribute("x1", xLeft - 45);
        bottomLine.setAttribute("x2", xRight + 45);
        bottomLine.setAttribute("y1", yBottom);
        bottomLine.setAttribute("y2", yBottom);
        bottomLine.setAttribute("stroke", "white");
        bottomLine.setAttribute("stroke-width", "2");
        svg.appendChild(bottomLine);

        // Draw the altitude segments.
        // Each row shows the dominant owner in that altitude band.
        for (let i = 0; i < nSegments; i++) {
            const altStart = minAlt + i * (maxAlt - minAlt) / nSegments;
            const altEnd = minAlt + (i + 1) * (maxAlt - minAlt) / nSegments;

            const y = yBottom - (i + 1) * segmentHeight;

            const segmentData = orbitData.filter(d =>
                d.altitude >= altStart && d.altitude < altEnd
            );

            // Count satellites by owner in this altitude segment.
            let dominantOwner = "None";
            let dominantCount = 0;
            let totalCount = segmentData.length;

            if (totalCount > 0) {
                const counts = {};

                segmentData.forEach(d => {
                    counts[d.owner] = (counts[d.owner] || 0) + 1;
                });

                for (const owner in counts) {
                    if (counts[owner] > dominantCount) {
                        dominantOwner = owner;
                        dominantCount = counts[owner];
                    }
                }
            }

            // Dark rounded row background.
            const rect = createSvgElement("rect");
            rect.setAttribute("x", xLeft);
            rect.setAttribute("y", y + 4);
            rect.setAttribute("width", xRight - xLeft);
            rect.setAttribute("height", segmentHeight - 8);
            rect.setAttribute("rx", 9);
            rect.setAttribute("class", "zoom-row-box");
            svg.appendChild(rect);

            // Glowing left edge that gives the row its visual emphasis.
            const edgeGlow = createSvgElement("rect");
            edgeGlow.setAttribute("x", xLeft);
            edgeGlow.setAttribute("y", y + 4);
            edgeGlow.setAttribute("width", 3);
            edgeGlow.setAttribute("height", segmentHeight - 8);
            edgeGlow.setAttribute("rx", 2);
            edgeGlow.setAttribute("class", "zoom-row-edge");
            svg.appendChild(edgeGlow);

            // Altitude boundary label, placed between row boxes.
            const altitudeText = createSvgElement("text");
            altitudeText.setAttribute("x", xLeft - 36 - altitudeOffsetX);
            altitudeText.setAttribute("y", y + 5);
            altitudeText.setAttribute("class", "leo-altitude-text");
            altitudeText.textContent = `${Math.round(altEnd).toLocaleString()} km`;
            svg.appendChild(altitudeText);


            // Dominant owner name.
            const mainText = createSvgElement("text");
            mainText.setAttribute("x", xLeft + 36);
            mainText.setAttribute("y", y + segmentHeight / 2 + 8);
            mainText.setAttribute("class", "leo-owner-text");

            if (totalCount > 0) {
                mainText.textContent = dominantOwner;

            } else {
                mainText.textContent = "None";
            }

            svg.appendChild(mainText);
            // Dominant-owner count compared with all satellites in this segment.
            const countText = createSvgElement("text");
            countText.setAttribute("x", xLeft + 118);
            countText.setAttribute("y", y + segmentHeight / 2 + 6);
            countText.setAttribute("class", "zoom-row-count");
            countText.textContent = totalCount > 0 ? `${dominantCount} / ${totalCount}` : "0 / 0";
            svg.appendChild(countText);


            // Unit label on the right side of populated rows.
            if (totalCount > 0) {
                const smallText = createSvgElement("text");
                smallText.setAttribute("x", xRight - 36);
                smallText.setAttribute("y", y + segmentHeight / 2 + 6);
                smallText.setAttribute("class", "leo-small-text");
                smallText.textContent = "satellites";
                svg.appendChild(smallText);

                const hoverTarget = createSvgElement("rect");
                hoverTarget.setAttribute("x", xLeft);
                hoverTarget.setAttribute("y", y + 4);
                hoverTarget.setAttribute("width", xRight - xLeft);
                hoverTarget.setAttribute("height", segmentHeight - 8);
                hoverTarget.setAttribute("rx", 9);
                hoverTarget.setAttribute("fill", "transparent");
                hoverTarget.setAttribute("pointer-events", "all");
                hoverTarget.setAttribute("class", "zoom-row-hover-target");
                hoverTarget.addEventListener("mouseenter", event => {
                    showOwnerTooltip(event, dominantOwner);
                });
                hoverTarget.addEventListener("mousemove", moveOwnerTooltip);
                hoverTarget.addEventListener("mouseleave", hideOwnerTooltip);
                svg.appendChild(hoverTarget);
            }
        }

        // Rotated altitude axis label on the left.
        const altitudeLabel = createSvgElement("text");
        altitudeLabel.setAttribute("x", 65 - altitudeOffsetX - altitudeLabelOffsetX);
        altitudeLabel.setAttribute("y", (yTop + yBottom) / 2);
        altitudeLabel.setAttribute("class", "altitude-label");
        altitudeLabel.setAttribute("transform", `rotate(-90 ${65 - altitudeOffsetX - altitudeLabelOffsetX} ${(yTop + yBottom) / 2})`);
        altitudeLabel.textContent = "Altitude";
        svg.appendChild(altitudeLabel);

        container.appendChild(svg);
    }


    // -------------------------
    // GEO plot
    // -------------------------

    // Draw the geostationary longitude view.
    // This plot uses the current CelesTrak GEO snapshot, not the altitude-derived SATCAT
    // classification used in the overview.
    function drawGeoZoom(selectedOwner = null) {
        // Clear the previous GEO SVG before redrawing.
        geoViz.innerHTML = "";
        hideOwnerTooltip();

        const width = 820;
        const height = 600;

        const svg = createSvgElement("svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);

        // -------------------------
        // 1. GEO belt line
        // -------------------------
        // The horizontal line represents the geostationary belt at about 35,786 km.
        const geoLine = createSvgElement("line");
        geoLine.setAttribute("x1", 50);
        geoLine.setAttribute("x2", width - 50);
        geoLine.setAttribute("y1", 100);
        geoLine.setAttribute("y2", 100);
        geoLine.setAttribute("class", "geo-line");
        svg.appendChild(geoLine);

        // -------------------------
        // 2. GEO belt label
        // -------------------------
        const geoLabel = createSvgElement("text");
        geoLabel.setAttribute("x", width / 2);
        geoLabel.setAttribute("y", 40);
        geoLabel.setAttribute("class", "leo-title");
        geoLabel.textContent = "GEO Zoom";
        svg.appendChild(geoLabel);

        const geoSubtitle = createSvgElement("text");
        geoSubtitle.setAttribute("x", width / 2);
        geoSubtitle.setAttribute("y", 72);
        geoSubtitle.setAttribute("class", "label leo-subtitle");
        geoSubtitle.textContent = "Geostationary Belt (35'786 km)";
        svg.appendChild(geoSubtitle);

        // -------------------------
        // 3. Map area
        // -------------------------
        // The map gives a longitude reference for the satellite projections.
        
        const mapX = 50;
        const mapY = 150;
        const mapW = width - 100;
        const mapH = 350;


        // Background rectangle behind the world map.
        const mapRect = createSvgElement("rect");
        mapRect.setAttribute("x", 50);
        mapRect.setAttribute("y", 150);
        mapRect.setAttribute("width", width - 100);
        mapRect.setAttribute("height", 350);
        mapRect.setAttribute("class", "geo-map");
        svg.appendChild(mapRect);

        // World map image placed inside the map rectangle.
        const mapImage = createSvgElement("image");
        mapImage.setAttribute("x", mapX);
        mapImage.setAttribute("y", mapY);
        mapImage.setAttribute("width", mapW);
        mapImage.setAttribute("height", mapH);
        mapImage.setAttribute("href", "assets/world_map.svg");
        mapImage.setAttribute("class", "geo-world-map");
        svg.appendChild(mapImage);

        // Longitude grid lines and labels every 60 degrees.
        for (let lon = -180; lon <= 180; lon += 60) {
            const x = mapX + ((lon + 180) / 360) * mapW;

            const line = createSvgElement("line");
            line.setAttribute("x1", x);
            line.setAttribute("x2", x);
            line.setAttribute("y1", mapY);
            line.setAttribute("y2", mapY + mapH);
            line.setAttribute("class", "geo-grid-line");
            svg.appendChild(line);

            const label = createSvgElement("text");
            label.setAttribute("x", x);
            label.setAttribute("y", mapY - 12);
            label.setAttribute("class", "geo-longitude-label");
            let text;
            if (lon === 0) {  // EAST or WEST
                text = "0°";
            } else if (lon < 0) {
                text = `${Math.abs(lon)}°W`;
            } else {
                text = `${lon}°E`;
            }
            label.textContent = text;  
            svg.appendChild(label);
        }

        // Equator line through the middle of the map.
        const equator = createSvgElement("line");
        equator.setAttribute("x1", mapX);
        equator.setAttribute("x2", mapX + mapW);
        equator.setAttribute("y1", mapY + mapH / 2);
        equator.setAttribute("y2", mapY + mapH / 2);
        equator.setAttribute("class", "geo-equator");
        svg.appendChild(equator);

            
        // -------------------------
        // 4. Plot all GEO satellites on the belt
        // -------------------------
        // Draw every satellite from the current GEO snapshot as a faint orange point.
        geoSatellites.forEach(sat => {
            const lon = sat.longitude;

            if (lon === null || lon === undefined || Number.isNaN(lon)) return;

            const x = mapX + ((lon + 180) / 360) * mapW;

            const beltDot = createSvgElement("circle");
            beltDot.setAttribute("cx", x);
            beltDot.setAttribute("cy", 100);
            beltDot.setAttribute("r", 3);
            beltDot.setAttribute("class", "geo-satellite-dot");
            beltDot.addEventListener("mouseenter", event => {
                showGeoSatelliteTooltip(event, sat);
            });
            beltDot.addEventListener("mousemove", moveOwnerTooltip);
            beltDot.addEventListener("mouseleave", hideOwnerTooltip);
            svg.appendChild(beltDot);
        });
        // Draw selected owner's satellites again in blue, so they appear on top.
        // Decayed satellites are excluded using the SATCAT status lookup.
        if (selectedOwner) {
            geoSatellites
                .filter(sat => sat.owner === selectedOwner && getStatusGroup(statusByNorad[Number(sat.norad)]) !== "excluded")
                .forEach(sat => {
                    const lon = sat.longitude;
                    if (lon === null || lon === undefined || Number.isNaN(lon)) return;

                    const x = mapX + ((lon + 180) / 360) * mapW;

                    const dot = createSvgElement("circle");
                    dot.setAttribute("cx", x);
                    dot.setAttribute("cy", 100);
                    dot.setAttribute("r", 3.5);
                    dot.setAttribute("class", "geo-satellite-dot-selected");
                    dot.addEventListener("mouseenter", event => {
                        showGeoSatelliteTooltip(event, sat);
                    });
                    dot.addEventListener("mousemove", moveOwnerTooltip);
                    dot.addEventListener("mouseleave", hideOwnerTooltip);
                    svg.appendChild(dot);
                });
        }
        // -------------------------
        // 5. Project selected satellites onto the map
        // -------------------------
        // For the selected owner, draw vertical projection lines from the GEO belt
        // down to the corresponding longitude on the map.
        if (selectedOwner) {
            const selectedSatellites = geoSatellites.filter(
                d => d.owner === selectedOwner && getStatusGroup(statusByNorad[Number(d.norad)]) !== "excluded"
            );

            selectedSatellites.forEach(sat => {
                const lon = sat.longitude;

                if (lon === null || lon === undefined || Number.isNaN(lon)) return;

                const x = mapX + ((lon + 180) / 360) * mapW;

                const projection = createSvgElement("line");
                projection.setAttribute("x1", x);
                projection.setAttribute("x2", x);
                projection.setAttribute("y1", 100);
                projection.setAttribute("y2", mapY + mapH / 2);
                projection.setAttribute("class", "geo-projection-line");
                svg.appendChild(projection);

                const groundDot = createSvgElement("circle");
                groundDot.setAttribute("cx", x);
                groundDot.setAttribute("cy", mapY + mapH / 2);
                groundDot.setAttribute("r", 3);
                groundDot.setAttribute("class", "geo-ground-dot");
                groundDot.addEventListener("mouseenter", event => {
                    showGeoSatelliteTooltip(event, sat);
                });
                groundDot.addEventListener("mousemove", moveOwnerTooltip);
                groundDot.addEventListener("mouseleave", hideOwnerTooltip);
                svg.appendChild(groundDot);
            });
        }

        geoViz.appendChild(svg);
    }


    // -------------------------
    // 7. Initial draw
    // -------------------------
    // Render all plots once after the data has loaded.
    drawVisualization(null, statusSelect.value);
    drawOrbitZoom("LEO", leoViz);
    drawOrbitZoom("MEO", meoViz);
    drawGeoZoom();

    // -------------------------
    // 8. Redraw on user input
    // -------------------------
    // Changing owner or status redraws the first/orbit overview plot.
    ownerSelect.addEventListener("change", () => {
        drawVisualization(ownerSelect.value, statusSelect.value);
    });
    statusSelect.addEventListener("change", () => {
        drawVisualization(ownerSelect.value, statusSelect.value);
    });

    // Changing GEO owner redraws the GEO belt/map plot.
    geoOwnerSelect.addEventListener("change", () => {
    drawGeoZoom(geoOwnerSelect.value);
    });

    // Each altitude-layer dropdown redraws only its own zoom plot.
    segmentSelect.addEventListener("change", () => {
        drawOrbitZoom("LEO", leoViz);
    });
    meoSegmentSelect.addEventListener("change", () => {
        drawOrbitZoom("MEO", meoViz);
    });
})
.catch(error => {
    console.error("Error loading JSON:", error);
});
