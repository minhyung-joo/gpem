import React, { useEffect, useRef } from 'react';
import './App.scss';
import { select } from 'd3';
import { geoPath } from 'd3-geo';
import { geoNaturalEarth } from 'd3-geo-projection';
import L from 'leaflet';

const geoJsonUrl = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"

function App() {
  const ref = useRef()

  useEffect(() => {
    fetch(geoJsonUrl).then(response => {
      response.json().then(geoData => {
        const map = L.map('gpem-map').setView([0, 0], 4);
        L.geoJSON(geoData.features).addTo(map);
        const svg = select(map.getPanes().overlayPane).append('svg');
        const g = svg.append('g').attr('class', 'leaflet-zoom-hide');
        const projection = geoNaturalEarth();
        const path = geoPath().projection(projection);
        g.selectAll("path")
          .data(geoData.features).enter()
          .append("path").attr("fill", "#69b3a2")
          .attr("d", path)
          .style("pointer-events","visible")
          .style("stroke", "#fff")
          .on('mouseover', function (d, i) {
            select(this).transition()
              .duration("500")
              .attr("fill", "#89d3c2")
          })
          .on('mouseout', function (d, i) {
            select(this).transition()
              .duration("500")
              .attr("fill", "#69b3a2")
          })
        
        const bounds = path.bounds(geoData);
        console.log(bounds);
        const topLeft = bounds[0];
        const bottomRight = bounds[1];
        svg.attr("width", bottomRight[0] - topLeft[0])
          .attr("height", bottomRight[1] - topLeft[1])
          .style("left", topLeft[0] + "px")
          .style("top", topLeft[1] + "px");
        g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
      });
    })
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <div id="gpem-map"></div>
        <svg ref={ref} width="1600" height="900"></svg>
      </header>
    </div>
  );
}

export default App;
