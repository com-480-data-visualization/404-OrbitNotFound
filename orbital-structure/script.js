Promise.all([
    fetch("../data/satellites_clean.json").then(response => response.json()),
    fetch("../data/geo_celestrak_longitude.json").then(response => response.json())
])
.then(([data, geoSnapshot]) => {
    const geoSatellites = geoSnapshot.satellites;
    console.log("Loaded data:", data);
    console.log("Loaded GEO data:", geoSatellites);

    const ownerSelect = document.getElementById("owner-select");
    const geoOwnerSelect = document.getElementById("geo-select");
    const viz = document.getElementById("viz");
    const leoViz = document.getElementById("leo-viz");
    const meoViz = document.getElementById("meo-viz");
    const geoViz = document.getElementById("geo-viz");

    const geoOwners = [...new Set(geoSatellites.map(d => d.owner))].sort();
    geoOwners.forEach(owner => {
        const option = document.createElement("option");
        option.value = owner;
        option.textContent = owner;
        geoOwnerSelect.appendChild(option);
    });

    // -------------------------
    // 1. Fill dropdown
    // -------------------------
    const owners = [...new Set(data.map(d => d.owner))].sort();

    owners.forEach(owner => {
        const option = document.createElement("option");
        option.value = owner;
        option.textContent = owner;
        ownerSelect.appendChild(option);
    });

    // -------------------------
    // 2. SVG settings
    // -------------------------
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
    function randomPositionInRing(rMin, rMax) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.sqrt(
            Math.random() * (rMax * rMax - rMin * rMin) + rMin * rMin
        );

        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        return { x, y };
    }

    function randomPositionOnCircle(radius) {
        const angle = Math.random() * 2 * Math.PI;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        return { x, y };
    }

    function createSvgElement(tag) {
        return document.createElementNS("http://www.w3.org/2000/svg", tag);
    }

    // -------------------------
    // 4. Main draw function
    // -------------------------
    function drawVisualization(selectedOwner) {
        viz.innerHTML = "";

        const svg = createSvgElement("svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);

        // --- GEO zone
        const geo = createSvgElement("circle");
        geo.setAttribute("cx", cx);
        geo.setAttribute("cy", cy);
        geo.setAttribute("r", geoRadius);
        geo.setAttribute("class", "orbit-zone zone-geo");
        svg.appendChild(geo);

        // --- MEO zone
        const meo = createSvgElement("circle");
        meo.setAttribute("cx", cx);
        meo.setAttribute("cy", cy);
        meo.setAttribute("r", meoOuter);
        meo.setAttribute("class", "orbit-zone zone-meo");
        svg.appendChild(meo);

        // --- LEO zone
        const leo = createSvgElement("circle");
        leo.setAttribute("cx", cx);
        leo.setAttribute("cy", cy);
        leo.setAttribute("r", leoOuter);
        leo.setAttribute("class", "orbit-zone zone-leo");
        svg.appendChild(leo);

        // --- Cut out inner rings
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

        // --- Orbit boundaries
        const boundaryRadii = [
        { r: leoOuter, className: "boundary-leo" },
        { r: meoOuter, className: "boundary-meo" },
        { r: geoRadius, className: "boundary-geo" }
        ];

        boundaryRadii.forEach(item => {
            const boundary = createSvgElement("circle");
            boundary.setAttribute("cx", cx);
            boundary.setAttribute("cy", cy);
            boundary.setAttribute("r", item.r);
            boundary.setAttribute("class", `orbit-boundary ${item.className}`);
            svg.appendChild(boundary);
        });

        // --- Earth
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
        
        // --- Orbit labels (LEO, MEO, GEO)
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

        // --- Filter satellites
        let satellites = [];

        if (selectedOwner) {
            satellites = data.filter(d => d.owner === selectedOwner);
        }

        satellites = satellites.filter(d =>
            d.ORBIT_CLASS === "LEO" ||
            d.ORBIT_CLASS === "MEO" ||
            d.ORBIT_CLASS === "GEO"
        );

        // --- Draw satellites
        satellites.forEach(sat => {
            let pos;

            if (sat.ORBIT_CLASS === "LEO") {
                pos = randomPositionInRing(leoInner + 2, leoOuter - 2);
            } else if (sat.ORBIT_CLASS === "MEO") {
                pos = randomPositionInRing(meoInner + 2, meoOuter - 2);
            } else if (sat.ORBIT_CLASS === "GEO") {
                pos = randomPositionOnCircle(geoRadius);
            }

            const dot = createSvgElement("circle");
            dot.setAttribute("cx", pos.x);
            dot.setAttribute("cy", pos.y);
            dot.setAttribute("r", 2.5);
            dot.setAttribute("class", "satellite-dot");

            svg.appendChild(dot);
        });

        viz.appendChild(svg);
    }


    
    // -------------------------
    // LEO-MEO plot
    // -------------------------
    function drawOrbitZoom(orbitClass, container) {
        container.innerHTML = "";

        const width = 520;
        const height = 700;

        const svg = createSvgElement("svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);

        const orbitBounds = {
            LEO: { minAlt: 0, maxAlt: 2000, title: "LEO Zoom" },
            MEO: { minAlt: 2000, maxAlt: 35786, title: "MEO Zoom" }
        };
        const { minAlt, maxAlt, title: zoomTitle } = orbitBounds[orbitClass];
        const nSegments = 10;

        const xLeft = 160;
        const xRight = 360;
        const xCenter = (xLeft + xRight) / 2;

        const yTop = 80;
        const yBottom = 640;
        const columnHeight = yBottom - yTop;
        const segmentHeight = columnHeight / nSegments;

        // Keep only satellites from the selected orbit class
        let orbitData = data.filter(d => d.ORBIT_CLASS === orbitClass);

        // Compute average altitude
        orbitData = orbitData.map(d => ({
            ...d,
            altitude: (d.perigee + d.apogee) / 2
        }));

        // Keep only altitudes in range
        orbitData = orbitData.filter(d => d.altitude >= minAlt && d.altitude <= maxAlt);

        // Title
        const title = createSvgElement("text");
        title.setAttribute("x", width / 2);
        title.setAttribute("y", 40);
        title.setAttribute("class", "leo-title");
        title.textContent = zoomTitle;
        svg.appendChild(title);

        // Subtitle
        const subtitle = createSvgElement("text");
        subtitle.setAttribute("x", width / 2);
        subtitle.setAttribute("y", 62);
        subtitle.setAttribute("class", "label leo-subtitle");
        subtitle.textContent = "Dominant owner by altitude segment";
        svg.appendChild(subtitle);

        // Top and bottom guide lines
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

        // Segment rectangles
        for (let i = 0; i < nSegments; i++) {
            const altStart = minAlt + i * (maxAlt - minAlt) / nSegments;
            const altEnd = minAlt + (i + 1) * (maxAlt - minAlt) / nSegments;

            const y = yBottom - (i + 1) * segmentHeight;

            const segmentData = orbitData.filter(d =>
                d.altitude >= altStart && d.altitude < altEnd
            );

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

            const rect = createSvgElement("rect");
            rect.setAttribute("x", xLeft);
            rect.setAttribute("y", y);
            rect.setAttribute("width", xRight - xLeft);
            rect.setAttribute("height", segmentHeight);
            rect.setAttribute("fill", "#4cc9f0");
            rect.setAttribute("fill-opacity", i % 2 === 0 ? "0.22" : "0.14");
            rect.setAttribute("stroke", "white");
            rect.setAttribute("stroke-opacity", "0.35");
            rect.setAttribute("stroke-width", "1");
            svg.appendChild(rect);

            // Owner + ratio
            const mainText = createSvgElement("text");
            mainText.setAttribute("x", xCenter);
            mainText.setAttribute("y", y + segmentHeight / 2 - 5);
            mainText.setAttribute("class", "leo-owner-text");

            if (totalCount > 0) {
                mainText.textContent = `${dominantOwner} ${dominantCount}/${totalCount}`;
            } else {
                mainText.textContent = "None";
            }

            svg.appendChild(mainText);

            // Small subtitle
            if (totalCount > 0) {
                const smallText = createSvgElement("text");
                smallText.setAttribute("x", xCenter);
                smallText.setAttribute("y", y + segmentHeight / 2 + 16);
                smallText.setAttribute("class", "leo-small-text");
                smallText.textContent = "satellites";
                svg.appendChild(smallText);
            }
        }

        // Altitude label on left
        const altitudeLabel = createSvgElement("text");
        altitudeLabel.setAttribute("x", 65);
        altitudeLabel.setAttribute("y", (yTop + yBottom) / 2);
        altitudeLabel.setAttribute("class", "altitude-label");
        altitudeLabel.setAttribute("transform", `rotate(-90 65 ${(yTop + yBottom) / 2})`);
        altitudeLabel.textContent = "Altitude";
        svg.appendChild(altitudeLabel);

        // 2000 km
        const topLabel = createSvgElement("text");
        topLabel.setAttribute("x", xRight + 70);
        topLabel.setAttribute("y", yTop + 5);
        topLabel.setAttribute("fill", "#adb5bd");
        topLabel.setAttribute("font-size", "14");
        topLabel.setAttribute("font-family", "Arial, sans-serif");
        topLabel.textContent = "2000 km";
        svg.appendChild(topLabel);

        // 0 km
        const bottomLabel = createSvgElement("text");
        bottomLabel.setAttribute("x", xRight + 70);
        bottomLabel.setAttribute("y", yBottom + 5);
        bottomLabel.setAttribute("fill", "#adb5bd");
        bottomLabel.setAttribute("font-size", "14");
        bottomLabel.setAttribute("font-family", "Arial, sans-serif");
        bottomLabel.textContent = "0 km";
        svg.appendChild(bottomLabel);

        // Disclaimer
        const note = createSvgElement("text");
        note.setAttribute("x", width / 2);
        note.setAttribute("y", height - 18);
        note.setAttribute("fill", "#adb5bd");
        note.setAttribute("class", "note");
        note.textContent = "Not to scale • conceptual visualization";
        svg.appendChild(note);

        container.appendChild(svg);
    }


    // -------------------------
    // GEO plot
    // -------------------------



    function drawGeoZoom(selectedOwner = null) {
        geoViz.innerHTML = "";

        const width = 900;
        const height = 600;

        const svg = createSvgElement("svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);

        // -------------------------
        // 1. GEO belt (ligne en haut)
        // -------------------------
        const geoLine = createSvgElement("line");
        geoLine.setAttribute("x1", 50);
        geoLine.setAttribute("x2", width - 50);
        geoLine.setAttribute("y1", 100);
        geoLine.setAttribute("y2", 100);
        geoLine.setAttribute("class", "geo-line");
        svg.appendChild(geoLine);

        // -------------------------
        // 2. petit label GEO
        // -------------------------
        const geoLabel = createSvgElement("text");
        geoLabel.setAttribute("x", width / 2);
        geoLabel.setAttribute("y", 80);
        geoLabel.setAttribute("class", "geo-title");
        geoLabel.textContent = "GEO Belt (35,786 km)";
        svg.appendChild(geoLabel);

        // -------------------------
        // 3. zone map (placeholder)
        // -------------------------
        
        const mapX = 50;
        const mapY = 150;
        const mapW = width - 100;
        const mapH = 350;


        const mapRect = createSvgElement("rect");
        mapRect.setAttribute("x", 50);
        mapRect.setAttribute("y", 150);
        mapRect.setAttribute("width", width - 100);
        mapRect.setAttribute("height", 350);
        mapRect.setAttribute("class", "geo-map");
        svg.appendChild(mapRect);

        const mapImage = createSvgElement("image");
        mapImage.setAttribute("x", mapX);
        mapImage.setAttribute("y", mapY);
        mapImage.setAttribute("width", mapW);
        mapImage.setAttribute("height", mapH);
        mapImage.setAttribute("href", "assets/world_map.svg");
        mapImage.setAttribute("class", "geo-world-map");
        svg.appendChild(mapImage);

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
        // 1. Draw all satellites in orange
        geoSatellites.forEach(sat => {
            const lon = sat.longitude;

            if (lon === null || lon === undefined || Number.isNaN(lon)) return;

            const x = mapX + ((lon + 180) / 360) * mapW;

            const beltDot = createSvgElement("circle");
            beltDot.setAttribute("cx", x);
            beltDot.setAttribute("cy", 100);
            beltDot.setAttribute("r", 3);
            beltDot.setAttribute("class", "geo-satellite-dot");
            svg.appendChild(beltDot);
        });
        // 2. Draw selected satellites again in blue,so it goes on top
        if (selectedOwner) {
            geoSatellites
                .filter(sat => sat.owner === selectedOwner)
                .forEach(sat => {
                    const lon = sat.longitude;
                    if (lon === null || lon === undefined || Number.isNaN(lon)) return;

                    const x = mapX + ((lon + 180) / 360) * mapW;

                    const dot = createSvgElement("circle");
                    dot.setAttribute("cx", x);
                    dot.setAttribute("cy", 100);
                    dot.setAttribute("r", 3.5);
                    dot.setAttribute("class", "geo-satellite-dot-selected");
                    svg.appendChild(dot);
                });
        }
        // -------------------------
        // 5. Highlight selected owner's satellites on the map
        // -------------------------
        if (selectedOwner) {
            const selectedSatellites = geoSatellites.filter(
                d => d.owner === selectedOwner
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
                svg.appendChild(groundDot);
            });
        }

        geoViz.appendChild(svg);
    }


    // -------------------------
    // 5. Initial draw
    // -------------------------
    drawVisualization(null);
    drawOrbitZoom("LEO", leoViz);
    drawOrbitZoom("MEO", meoViz);
    drawGeoZoom();

    // -------------------------
    // 6. Redraw on selection
    // -------------------------
    ownerSelect.addEventListener("change", () => {
        drawVisualization(ownerSelect.value);
    });
    geoOwnerSelect.addEventListener("change", () => {
    drawGeoZoom(geoOwnerSelect.value);
});
})
.catch(error => {
    console.error("Error loading JSON:", error);
});