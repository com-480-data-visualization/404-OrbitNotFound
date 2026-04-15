fetch("data/satellites_clean.json")
    .then(response => response.json())
    .then(data => {
        console.log("Loaded data:", data);

        const ownerSelect = document.getElementById("owner-select");
        const viz = document.getElementById("viz");

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

        const leoInner = 50;
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
            svg.appendChild(earth);

            // --- Filter satellites
            let satellites = [];
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
                    pos = randomPositionInRing(leoInner + 8, leoOuter - 8);
                } else if (sat.ORBIT_CLASS === "MEO") {
                    pos = randomPositionInRing(meoInner + 8, meoOuter - 8);
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

        // -------------------------
        // 5. Initial draw
        // -------------------------
        drawVisualization(null);

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