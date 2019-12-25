import React, { useEffect, useState, useRef } from "react";
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
  const [country, setCountry] = useState(null);
  const [focused, setFocused] = useState(false);
  const ref = useRef();
  let previews = [];
  if (searchValue.length && ref.current === document.activeElement) {
    previews = previews
      .concat(
        countryList.filter(
          countryObj =>
            countryObj.name.substring(0, searchValue.length) === searchValue
        )
      )
      .slice(0, 5);
  }

  if (!focused && ref.current) {
    ref.current.blur();
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
              let countryCode = feature.properties.WB_A3;
              if (countryCode === "-99") {
                countryCode = feature.properties.ADM0_A3;
              }

              if (gdpData[countryCode]) {
                feature.GDP = gdpData[countryCode].gdpLevel;
              } else {
                feature.GDP = minGdpScale;
              }

              countryList.push({
                name: feature.properties.NAME,
                bounds: feature.bbox,
                gdp: feature.GDP
              });

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

  useEffect(() => {
    if (country && map) {
      const bounds = L.latLngBounds(
        L.latLng(country.bounds[1], country.bounds[0]),
        L.latLng(country.bounds[3], country.bounds[2])
      );
      map.fitBounds(bounds);
    }
  }, [country]);

  return (
    <div className="App">
      <div className="search-bar">
        <input
          ref={ref}
          className="input"
          onFocus={() => setFocused(true)}
          onChange={e => setSearchValue(e.target.value)}
          onKeyDown={e => {
            if (e.keyCode === 13) {
              const country = countryList.filter(
                countryObj => countryObj.name === searchValue
              )[0];
              if (country) {
                setFocused(false);
                setCountry(Object.assign({}, country));
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
                setCountry(Object.assign({}, previewObj));
              }}
            >
              {previewObj.name}
            </div>
          ))}
        </div>
      </div>
      <div
        id="gpem-map"
        onClick={() => {
          setFocused(false);
        }}
      ></div>
      {country ? (
        <div className="country-info">
          <div className="close-button" onClick={() => setCountry(null)}>
            x
          </div>
          <div className="country-name">{country.name}</div>
          <div className="country-gdp">{country.gdp}</div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
