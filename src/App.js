import React, { useEffect, useState } from "react";
import "./App.scss";
import { csv } from "d3";
import { scaleQuantize } from "d3-scale";
import { schemeBlues } from "d3-scale-chromatic";

import L from "leaflet";
import gdpCSV from "./gdp_data.csv";

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};
const geoJsonUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const countryList = [];
let map = null;
function App() {
  const [searchValue, setSearchValue] = useState("");
  let previews = [];
  if (searchValue.length) {
    previews = previews
      .concat(
        countryList.filter(
          countryObj =>
            countryObj.name.substring(0, searchValue.length) === searchValue &&
            countryObj.name !== searchValue
        )
      )
      .slice(0, 5);
  }

  useEffect(() => {
    fetch(geoJsonUrl).then(response => {
      response.json().then(geoData => {
        csv(gdpCSV)
          .then(rawData => rawData.filter(row => row["2018"].length))
          .then(filteredData =>
            filteredData.reduce((prev, row) => {
              prev[row["Country Code"]] = {
                gdp: row["2018"],
                gdpLevel: Math.round(Math.log10(parseFloat(row["2018"])))
              };
              return prev;
            }, {})
          )
          .then(gdpData => {
            const gdps = [];
            Object.keys(gdpData).forEach(key =>
              gdps.push(gdpData[key].gdpLevel)
            );
            const minGdpScale = gdps.min();
            const maxGdpScale = gdps.max();
            const color = scaleQuantize(
              [minGdpScale, maxGdpScale],
              schemeBlues[maxGdpScale - minGdpScale]
            );
            map = L.map("gpem-map", {
              minZoom: 2,
              maxZoom: 10,
              maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180))
            }).setView([0, 0], 4);
            const features = geoData.features.map(feature => {
              countryList.push({
                name: feature.properties.NAME,
                bounds: feature.bbox
              });
              let countryCode = feature.properties.WB_A3;
              if (countryCode === "-99") {
                countryCode = feature.properties.ADM0_A3;
              }

              if (gdpData[countryCode]) {
                feature.GDP = gdpData[countryCode].gdpLevel;
              } else {
                feature.GDP = minGdpScale;
              }

              return feature;
            });
            let geojson;
            function onEachFeature(feature, layer) {
              layer.bindTooltip(feature.properties.NAME, {
                direction: "top",
                sticky: true
              });
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
              attribution:
                "Data source <a href='https://github.com/nvkelso/' target='_blank'>@nvkelso</a>",
              style: function(feature) {
                return {
                  color: color(feature.GDP),
                  fillOpacity: 0.8
                };
              }
            }).addTo(map);
          });
      });
    });
  }, []);

  return (
    <div className="App">
      <div className="search-bar">
        <input
          className="input"
          onChange={e => setSearchValue(e.target.value)}
          onKeyDown={e => {
            if (e.keyCode === 13) {
              const country = countryList.filter(
                countryObj => countryObj.name === searchValue
              )[0];
              if (country && map) {
                const bounds = L.latLngBounds(
                  L.latLng(country.bounds[1], country.bounds[0]),
                  L.latLng(country.bounds[3], country.bounds[2])
                );
                map.fitBounds(bounds);
              }
            }
          }}
          value={searchValue}
        />
        <div className="preview-list">
          {previews.map((previewObj, index) => (
            <div
              key={index}
              className="preview-item"
              onClick={() => {
                setSearchValue(previewObj.name);
                const bounds = L.latLngBounds(
                  L.latLng(previewObj.bounds[1], previewObj.bounds[0]),
                  L.latLng(previewObj.bounds[3], previewObj.bounds[2])
                );
                map.fitBounds(bounds);
              }}
            >
              {previewObj.name}
            </div>
          ))}
        </div>
      </div>
      <div id="gpem-map"></div>
    </div>
  );
}

export default App;
