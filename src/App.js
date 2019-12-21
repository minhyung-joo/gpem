import React, { useEffect, useRef } from 'react';
import './App.scss';
import { csv } from 'd3';
import { scaleQuantize } from 'd3-scale';
import { schemeBlues } from 'd3-scale-chromatic';

import L from 'leaflet';
import gdpCSV from './gdp_data.csv';

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};
const geoJsonUrl = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"

function App() {
  const ref = useRef()

  useEffect(() => {
    fetch(geoJsonUrl).then(response => {
      response.json().then(geoData => {
        csv(gdpCSV)
          .then(rawData => rawData.filter(row => row["2018"].length))
          .then(filteredData => filteredData.reduce(
            (prev, row) => {
              prev[row["Country Code"]] = {
                
                gdp: row["2018"],
                gdpLevel: Math.round(Math.log10(parseFloat(row["2018"])))
              }; 
              return prev;
            }
          , {}))
          .then(gdpData => {
            const gdps = [];
            Object.keys(gdpData).forEach(key => gdps.push(gdpData[key].gdpLevel));
            const minGdpScale = gdps.min();
            const maxGdpScale = gdps.max();
            const color = scaleQuantize([minGdpScale, maxGdpScale], schemeBlues[maxGdpScale - minGdpScale])
            const map = L.map('gpem-map', {
              minZoom: 2,
              maxZoom: 10,
              maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180))
            }).setView([0, 0], 4);
            const features = geoData.features.map(feature => {
              let countryCode = feature.properties.WB_A3;
              if (countryCode === '-99') {
                countryCode = feature.properties.ADM0_A3;
              }

              if (gdpData[countryCode]) {
                feature.GDP = gdpData[countryCode].gdpLevel
              } else {
                feature.GDP = minGdpScale;
              }
              
              return feature;
            })
            let geojson;
            function onEachFeature(feature, layer) {
              layer.on({
                  mouseover: highlightFeature,
                  mouseout: resetHighlight,
                  click: zoomToFeature
              });
            }
            
            function highlightFeature(e) {
              const layer = e.target;
            
              // Change style on mouse over
              /*
              layer.setStyle({
                fillOpacity: 1,
              });
              */
            
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
              }
            }
            
            function resetHighlight(e) {
              geojson.resetStyle(e.target);
            }
            
            function zoomToFeature(e) {
              map.fitBounds(e.target.getBounds());
            }

            geojson = L.geoJSON(features, {
              onEachFeature,
              attribution: "Data source <a href='https://github.com/nvkelso/' target='_blank'>@nvkelso</a>",
              style: function(feature) {
                return {
                  color: color(feature.GDP),
                  fillOpacity: 0.8
                }
              },
            }).addTo(map);
          })
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
