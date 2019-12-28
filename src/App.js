import React, { useEffect, useState, useRef } from "react";
import "./App.scss";
import { csv } from "d3";
import { scaleQuantize } from "d3-scale";
import { schemeBlues, schemeReds } from "d3-scale-chromatic";
import { IoIosClose } from "react-icons/io";

import L from "leaflet";
import gdpCSV from "./gdp_data.csv";
import populationCSV from "./population_data.csv";

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
              const gdp = parseFloat(row["2018"]);
              prev[row["Country Code"]] = {
                gdp,
                gdpLevel: Math.round(Math.log10(gdp))
              };
              return prev;
            }, {})
          )
          .then(gdpData => {
            return new Promise((resolve, reject) => {
              csv(populationCSV)
                .then(rawData => rawData.filter(row => row["2018"].length))
                .then(populationData => {
                  populationData.forEach(row => {
                    if (!gdpData.hasOwnProperty(row["Country Code"])) {
                      gdpData[row["Country Code"]] = {};
                    }

                    const population = parseFloat(row["2018"]);

                    gdpData[row["Country Code"]].population = population;
                    gdpData[row["Country Code"]].populationLevel = Math.round(
                      Math.log10(population)
                    );
                  });
                  resolve(gdpData);
                })
                .catch(reject);
            });
          })
          .then(gdpData => {
            const gdps = [];
            const populations = [];
            Object.keys(gdpData).forEach(key => {
              if (gdpData[key].gdpLevel) {
                gdps.push(gdpData[key].gdpLevel);
              }

              if (gdpData[key].populationLevel) {
                populations.push(gdpData[key].populationLevel);
              }
            });
            console.log(gdpData);
            const minGdpScale = gdps.min();
            const maxGdpScale = gdps.max();
            const minPopScale = populations.min();
            const maxPopScale = populations.max();
            const color = scaleQuantize(
              [minGdpScale, maxGdpScale],
              schemeBlues[maxGdpScale - minGdpScale]
            );
            const popColor = scaleQuantize(
              [minPopScale, maxPopScale],
              schemeReds[maxPopScale - minPopScale]
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
                if (gdpData[countryCode].gdpLevel) {
                  feature.GDPLevel = gdpData[countryCode].gdpLevel;
                  feature.GDP = gdpData[countryCode].gdp;
                } else {
                  feature.GDPLevel = minGdpScale;
                  feature.GDP = 0;
                }

                if (gdpData[countryCode].populationLevel) {
                  feature.populationLevel =
                    gdpData[countryCode].populationLevel;
                  feature.population = gdpData[countryCode].population;
                } else {
                  feature.populationLevel = minPopScale;
                  feature.population = 0;
                }
              } else {
                feature.GDPLevel = minGdpScale;
                feature.GDP = 0;
                feature.populationLevel = minPopScale;
                feature.population = 0;
              }

              countryList.push({
                name: feature.properties.NAME,
                bounds: feature.bbox,
                gdp: feature.GDP,
                population: feature.population
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
                click: handleClick
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

            function handleClick(e) {
              console.log(e.target.feature);
              const countryName = e.target.feature.properties.NAME;
              const country = countryList.filter(
                countryObj => countryObj.name === countryName
              )[0];
              setSearchValue(e.target.feature.properties.NAME);
              setCountry(Object.assign({}, country));
              map.fitBounds(e.target.getBounds());
            }

            geojson = L.geoJSON(features, {
              onEachFeature,
              attribution:
                "Data source <a href='https://github.com/nvkelso/' target='_blank'>@nvkelso</a>",
              style: function(feature) {
                return {
                  color: color(feature.GDPLevel),
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
            <IoIosClose />
          </div>
          <div className="country-name">{country.name}</div>
          <div className="country-gdp">
            <span>GDP: </span>
            {format(country.gdp, "$")}
          </div>
          <div className="country-population">
            <span>Population: </span>
            {format(country.population)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function format(value, prefix) {
  const valueStr = value + "";
  const chars = [];
  for (let i = 0; i < valueStr.length; i++) {
    if (i > 0 && i % 3 === 0) {
      chars.push(",");
    }

    chars.push(valueStr.charAt(valueStr.length - 1 - i));
  }

  if (prefix) {
    chars.push(prefix);
  }

  return chars.reverse().join("");
}

export default App;
