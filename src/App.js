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
let gdpLayer;
let popLayer;
function App() {
  const [searchValue, setSearchValue] = useState("");
  const [country, setCountry] = useState(null);
  const [focused, setFocused] = useState(false);
  const [currentLayer, setCurrentLayer] = useState("gdp");
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
    (async function() {
      const response = await fetch(geoJsonUrl);
      const geoData = await response.json();
      const rawGdpData = await csv(gdpCSV);
      const rawPopData = await csv(populationCSV);
      const countryData = rawGdpData
        .filter(row => row["2018"].length)
        .reduce((prev, row) => {
          const gdp = parseFloat(row["2018"]);
          prev[row["Country Code"]] = {
            gdp,
            gdpLevel: Math.round(Math.log10(gdp))
          };
          return prev;
        }, {});
      rawPopData
        .filter(row => row["2018"].length)
        .forEach(row => {
          if (!countryData.hasOwnProperty(row["Country Code"])) {
            countryData[row["Country Code"]] = {};
          }

          const population = parseFloat(row["2018"]);

          countryData[row["Country Code"]].population = population;
          countryData[row["Country Code"]].populationLevel = Math.round(
            Math.log10(population)
          );
        });
      const gdps = [];
      const populations = [];
      Object.keys(countryData).forEach(key => {
        if (countryData[key].gdpLevel) {
          gdps.push(countryData[key].gdpLevel);
        }

        if (countryData[key].populationLevel) {
          populations.push(countryData[key].populationLevel);
        }
      });
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

        if (countryData[countryCode]) {
          if (countryData[countryCode].gdpLevel) {
            feature.GDPLevel = countryData[countryCode].gdpLevel;
            feature.GDP = countryData[countryCode].gdp;
          } else {
            feature.GDPLevel = minGdpScale;
            feature.GDP = 0;
          }

          if (countryData[countryCode].populationLevel) {
            feature.populationLevel = countryData[countryCode].populationLevel;
            feature.population = countryData[countryCode].population;
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

      function onEachFeature(feature, layer) {
        layer.bindTooltip(feature.properties.NAME, {
          direction: "top",
          sticky: true
        });
        layer.on({
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
        if (currentLayer === "gdp") {
          gdpLayer.resetStyle(e.target);
        } else {
          popLayer.resetStyle(e.target);
        }
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

      gdpLayer = L.geoJSON(features, {
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

      popLayer = L.geoJSON(features, {
        onEachFeature,
        attribution:
          "Data source <a href='https://github.com/nvkelso/' target='_blank'>@nvkelso</a>",
        style: function(feature) {
          return {
            color: popColor(feature.GDPLevel),
            fillOpacity: 0.8
          };
        }
      });
    })();
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
      <div
        className="map-toggle"
        onClick={() => {
          if (currentLayer === "gdp") {
            map.addLayer(popLayer);
            map.removeLayer(gdpLayer);
            setCurrentLayer("pop");
          } else {
            map.addLayer(gdpLayer);
            map.removeLayer(popLayer);
            setCurrentLayer("gdp");
          }
        }}
      >
        Toggle
      </div>
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
