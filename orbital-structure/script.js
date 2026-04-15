fetch("../data/satellites_clean.json")
    .then(response => response.json())
    .then(data => {
        console.log("Loaded data:", data);

        const ownerSelect = document.getElementById("owner-select");
        const viz = document.getElementById("viz");
        const leoViz = document.getElementById("leo-viz");

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
            geo.setAttribute("fill", "#f4a261");
            geo.setAttribute("opacity", 0.1);
            svg.appendChild(geo);

            // --- MEO zone
            const meo = createSvgElement("circle");
            meo.setAttribute("cx", cx);
            meo.setAttribute("cy", cy);
            meo.setAttribute("r", meoOuter);
            meo.setAttribute("fill", "#9d4edd");
            meo.setAttribute("opacity", 0.1);
            svg.appendChild(meo);

            // --- LEO zone
            const leo = createSvgElement("circle");
            leo.setAttribute("cx", cx);
            leo.setAttribute("cy", cy);
            leo.setAttribute("r", leoOuter);
            leo.setAttribute("fill", "#4cc9f0");
            leo.setAttribute("opacity", 0.1);
            svg.appendChild(leo);

            // --- Cut out inner rings
            const cutGeo = createSvgElement("circle");
            cutGeo.setAttribute("cx", cx);
            cutGeo.setAttribute("cy", cy);
            cutGeo.setAttribute("r", meoOuter);
            cutGeo.setAttribute("fill", "#101935");
            svg.appendChild(cutGeo);

            const cutMeo = createSvgElement("circle");
            cutMeo.setAttribute("cx", cx);
            cutMeo.setAttribute("cy", cy);
            cutMeo.setAttribute("r", leoOuter);
            cutMeo.setAttribute("fill", "#101935");
            svg.appendChild(cutMeo);

            const cutLeo = createSvgElement("circle");
            cutLeo.setAttribute("cx", cx);
            cutLeo.setAttribute("cy", cy);
            cutLeo.setAttribute("r", leoInner);
            cutLeo.setAttribute("fill", "#101935");
            svg.appendChild(cutLeo);

            // --- Orbit boundaries
            const boundaryRadii = [
                { r: leoOuter, color: "#4cc9f0" },
                { r: meoOuter, color: "#9d4edd" },
                { r: geoRadius, color: "#f4a261" }
            ];

            boundaryRadii.forEach(item => {
                const boundary = createSvgElement("circle");
                boundary.setAttribute("cx", cx);
                boundary.setAttribute("cy", cy);
                boundary.setAttribute("r", item.r);
                boundary.setAttribute("fill", "none");
                boundary.setAttribute("stroke", item.color);
                boundary.setAttribute("stroke-width", "1.2");
                boundary.setAttribute("stroke-dasharray", "5,5");
                svg.appendChild(boundary);
            });

            // --- Earth
            const earth = createSvgElement("circle");
            earth.setAttribute("cx", cx);
            earth.setAttribute("cy", cy);
            earth.setAttribute("r", earthRadius);
            earth.setAttribute("fill", "#1d3557");
            earth.setAttribute("stroke", "#e0e1dd");
            earth.setAttribute("stroke-width", "1");
            svg.appendChild(earth);
            addLabel("Earth", cx, cy + 4, "white");
            // tout 4a juste pour l'écrire en plus petit
            const note = createSvgElement("text");
            note.setAttribute("x", cx);
            note.setAttribute("y", height - 20);
            note.setAttribute("fill", "#adb5bd");
            note.setAttribute("font-size", "11");
            note.setAttribute("text-anchor", "middle");
            note.setAttribute("font-family", "Arial, sans-serif");
            note.setAttribute("opacity", "0.8");
            note.textContent = "Not to scale • conceptual visualization";
            svg.appendChild(note);
            
            // --- Orbit labels (LEO, MEO, GEO)
            function addLabel(text, x, y, color) {
            const label = createSvgElement("text");
            label.setAttribute("x", x);
            label.setAttribute("y", y);
            label.setAttribute("fill", color);
            label.setAttribute("font-size", "14");
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("font-family", "Arial, sans-serif");
            label.textContent = text;
            svg.appendChild(label);
            }

            addLabel("LEO", cx, cy - leoOuter + 18, "#4cc9f0");
            addLabel("MEO", cx, cy - meoOuter + 18, "#9d4edd");
            addLabel("GEO", cx, cy - geoRadius + 18, "#f4a261");

            // --- Filter satellites
            let satellites = [];

            function drawLeoZoom() {
                leoViz.innerHTML = "";

                const width = 520;
                const height = 700;

                const svg = createSvgElement("svg");
                svg.setAttribute("width", width);
                svg.setAttribute("height", height);

                const minAlt = 0;
                const maxAlt = 2000;
                const nSegments = 10;

                const xLeft = 160;
                const xRight = 360;
                const xCenter = (xLeft + xRight) / 2;

                const yTop = 80;
                const yBottom = 640;
                const columnHeight = yBottom - yTop;
                const segmentHeight = columnHeight / nSegments;

                // Keep only LEO satellites
                let leoData = data.filter(d => d.ORBIT_CLASS === "LEO");

                // Compute average altitude
                leoData = leoData.map(d => ({
                    ...d,
                    altitude: (d.perigee + d.apogee) / 2
                }));

                // Keep only altitudes in range
                leoData = leoData.filter(d => d.altitude >= minAlt && d.altitude <= maxAlt);

                // Title
                const title = createSvgElement("text");
                title.setAttribute("x", width / 2);
                title.setAttribute("y", 40);
                title.setAttribute("fill", "white");
                title.setAttribute("font-size", "24");
                title.setAttribute("font-weight", "bold");
                title.setAttribute("text-anchor", "middle");
                title.setAttribute("font-family", "Arial, sans-serif");
                title.textContent = "LEO Zoom";
                svg.appendChild(title);

                // Subtitle
                const subtitle = createSvgElement("text");
                subtitle.setAttribute("x", width / 2);
                subtitle.setAttribute("y", 62);
                subtitle.setAttribute("fill", "#adb5bd");
                subtitle.setAttribute("font-size", "14");
                subtitle.setAttribute("text-anchor", "middle");
                subtitle.setAttribute("font-family", "Arial, sans-serif");
                subtitle.textContent = "Dominant owner by altitude segment";
                svg.appendChild(subtitle);

                // Top and bottom guide lines
                const topLine = createSvgElement("line");
                topLine.setAttribute("x1", xLeft - 45);
                topLine.setAttribute("x2", xRight + 45);
                topLine.setAttribute("y1", yTop);
                topLine.setAttribute("y2", yTop);
                topLine.setAttribute("stroke", "white");
                topLine.setAttribute("stroke-width", "2");
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

                    const segmentData = leoData.filter(d =>
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
                    mainText.setAttribute("fill", "white");
                    mainText.setAttribute("font-size", "16");
                    mainText.setAttribute("font-weight", "bold");
                    mainText.setAttribute("text-anchor", "middle");
                    mainText.setAttribute("font-family", "Arial, sans-serif");

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
                        smallText.setAttribute("fill", "#cbd5e1");
                        smallText.setAttribute("font-size", "11");
                        smallText.setAttribute("text-anchor", "middle");
                        smallText.setAttribute("font-family", "Arial, sans-serif");
                        smallText.textContent = "satellites";
                        svg.appendChild(smallText);
                    }
                }

                // Altitude label on left
                const altitudeLabel = createSvgElement("text");
                altitudeLabel.setAttribute("x", 65);
                altitudeLabel.setAttribute("y", (yTop + yBottom) / 2);
                altitudeLabel.setAttribute("fill", "white");
                altitudeLabel.setAttribute("font-size", "16");
                altitudeLabel.setAttribute("text-anchor", "middle");
                altitudeLabel.setAttribute("font-family", "Arial, sans-serif");
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
                note.setAttribute("font-size", "11");
                note.setAttribute("text-anchor", "middle");
                note.setAttribute("font-family", "Arial, sans-serif");
                note.setAttribute("opacity", "0.8");
                note.textContent = "Not to scale • conceptual visualization";
                svg.appendChild(note);

                leoViz.appendChild(svg);
            }
;

            if (selectedOwner) {
                satellites = data.filter(d => d.owner === selectedOwner);
            }

            satellites = satellites.filter(d =>
                d.ORBIT_CLASS === "LEO" ||
                d.ORBIT_CLASS === "MEO" ||
                d.ORBIT_CLASS === "GEO"
            );

            console.log("Displayed satellites:", satellites.length);

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
                dot.setAttribute("fill", "#e0e1dd");
                dot.setAttribute("opacity", 0.8);

                svg.appendChild(dot);
            });

            viz.appendChild(svg);
        }

        function drawLeoZoom() {
            leoViz.innerHTML = "";

            const width = 520;
            const height = 700;

            const svg = createSvgElement("svg");
            svg.setAttribute("width", width);
            svg.setAttribute("height", height);

            const minAlt = 0;
            const maxAlt = 2000;
            const nSegments = 10;

            const xLeft = 160;
            const xRight = 360;
            const xCenter = (xLeft + xRight) / 2;

            const yTop = 80;
            const yBottom = 640;
            const columnHeight = yBottom - yTop;
            const segmentHeight = columnHeight / nSegments;

            // Keep only LEO satellites
            let leoData = data.filter(d => d.ORBIT_CLASS === "LEO");

            // Compute average altitude
            leoData = leoData.map(d => ({
                ...d,
                altitude: (d.perigee + d.apogee) / 2
            }));

            // Keep only altitudes in range
            leoData = leoData.filter(d => d.altitude >= minAlt && d.altitude <= maxAlt);

            // Title
            const title = createSvgElement("text");
            title.setAttribute("x", width / 2);
            title.setAttribute("y", 40);
            title.setAttribute("fill", "white");
            title.setAttribute("font-size", "24");
            title.setAttribute("font-weight", "bold");
            title.setAttribute("text-anchor", "middle");
            title.setAttribute("font-family", "Arial, sans-serif");
            title.textContent = "LEO Zoom";
            svg.appendChild(title);

            // Subtitle
            const subtitle = createSvgElement("text");
            subtitle.setAttribute("x", width / 2);
            subtitle.setAttribute("y", 62);
            subtitle.setAttribute("fill", "#adb5bd");
            subtitle.setAttribute("font-size", "14");
            subtitle.setAttribute("text-anchor", "middle");
            subtitle.setAttribute("font-family", "Arial, sans-serif");
            subtitle.textContent = "Dominant owner by altitude segment";
            svg.appendChild(subtitle);

            // Top and bottom guide lines
            const topLine = createSvgElement("line");
            topLine.setAttribute("x1", xLeft - 45);
            topLine.setAttribute("x2", xRight + 45);
            topLine.setAttribute("y1", yTop);
            topLine.setAttribute("y2", yTop);
            topLine.setAttribute("stroke", "white");
            topLine.setAttribute("stroke-width", "2");
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

                const segmentData = leoData.filter(d =>
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
                mainText.setAttribute("fill", "white");
                mainText.setAttribute("font-size", "16");
                mainText.setAttribute("font-weight", "bold");
                mainText.setAttribute("text-anchor", "middle");
                mainText.setAttribute("font-family", "Arial, sans-serif");

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
                    smallText.setAttribute("fill", "#cbd5e1");
                    smallText.setAttribute("font-size", "11");
                    smallText.setAttribute("text-anchor", "middle");
                    smallText.setAttribute("font-family", "Arial, sans-serif");
                    smallText.textContent = "satellites";
                    svg.appendChild(smallText);
                }
            }

            // Altitude label on left
            const altitudeLabel = createSvgElement("text");
            altitudeLabel.setAttribute("x", 65);
            altitudeLabel.setAttribute("y", (yTop + yBottom) / 2);
            altitudeLabel.setAttribute("fill", "white");
            altitudeLabel.setAttribute("font-size", "16");
            altitudeLabel.setAttribute("text-anchor", "middle");
            altitudeLabel.setAttribute("font-family", "Arial, sans-serif");
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
            note.setAttribute("font-size", "11");
            note.setAttribute("text-anchor", "middle");
            note.setAttribute("font-family", "Arial, sans-serif");
            note.setAttribute("opacity", "0.8");
            note.textContent = "Not to scale • conceptual visualization";
            svg.appendChild(note);

            leoViz.appendChild(svg);
        }
        // -------------------------
        // 5. Initial draw
        // -------------------------
        drawVisualization(null);
        drawLeoZoom();

        // -------------------------
        // 6. Redraw on selection
        // -------------------------
        ownerSelect.addEventListener("change", () => {
            drawVisualization(ownerSelect.value);
        });
    })
    .catch(error => {
        console.error("Error loading JSON:", error);
    });