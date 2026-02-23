import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CreateNHC.css";

/* ===========================
   Fix Leaflet Marker Icons
=========================== */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* ===========================
   Click to Draw Polygon
=========================== */
const ClickableMap = ({ markers, setMarkers }) => {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setMarkers((prev) => [...prev, { lat, lng }]);
    },
  });
  return null;
};

/* ===========================
   Move Map Controller
=========================== */
const MapController = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, 16);
    }
  }, [center, map]);

  return null;
};

/* ===========================
   MAIN COMPONENT
=========================== */
const CreateNHC = ({ onCreateNHC, onBack }) => {
  const [nhcName, setNhcName] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [markers, setMarkers] = useState([]);
  const [center, setCenter] = useState([33.5651, 73.0169]); // Default (Islamabad)

  /* ===========================
     SEARCH ADDRESS + ADD MARKER
  =========================== */
  const handleSearchAddress = async () => {
    if (!searchAddress) {
      alert("Please enter an address");
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${searchAddress}`
      );
      const data = await res.json();

      if (data.length === 0) {
        alert("Address not found");
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      // Move map
      setCenter([lat, lng]);

      // ✅ ADD FIRST MARKER AUTOMATICALLY
      setMarkers([{ lat, lng }]);
    } catch (error) {
      alert("Error searching address");
    }
  };

  /* ===========================
     CREATE NHC
  =========================== */
  const handleCreate = () => {
    if (!nhcName || markers.length < 3) {
      alert("Enter NHC name and draw at least 3 points");
      return;
    }

    onCreateNHC({
      name: nhcName,
      points: markers,
    });
  };

  const handleReset = () => {
    setNhcName("");
    setSearchAddress("");
    setMarkers([]);
  };

  return (
    <div className="create-nhc-container">
      {/* Header */}
      <div className="simple-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>CREATE NHC</h2>
      </div>

      {/* NHC Name */}
      <input
        className="nhc-input"
        placeholder="Enter NHC Name (e.g. 6th Road RWP)"
        value={nhcName}
        onChange={(e) => setNhcName(e.target.value)}
      />

      {/* Optional Address */}
      <input
        className="nhc-input"
        placeholder="Optional: Enter area/address"
        value={searchAddress}
        onChange={(e) => setSearchAddress(e.target.value)}
      />
      <button className="reset-btn" onClick={handleSearchAddress}>
        Search Area
      </button>

      {/* MAP */}
      <MapContainer
        center={center}
        zoom={16}
        className="map-box"
        style={{ height: "400px", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MapController center={center} />
        <ClickableMap markers={markers} setMarkers={setMarkers} />

        {/* Markers */}
        {markers.map((pos, idx) => (
          <Marker key={idx} position={[pos.lat, pos.lng]}>
            <Popup>Point {idx + 1}</Popup>
          </Marker>
        ))}

        {/* Polygon */}
        {markers.length >= 3 && (
          <Polygon
            positions={markers}
            pathOptions={{
              color: "green",
              fillColor: "green",
              fillOpacity: 0.4,
            }}
          />
        )}
      </MapContainer>

      {/* Buttons */}
      <div className="btn-row">
        <button className="reset-btn" onClick={handleReset}>
          Reset Points
        </button>
        <button className="create-btn" onClick={handleCreate}>
          CREATE NHC
        </button>
      </div>

      <p className="info-text">
        Search area → marker added → click map to complete boundary.
      </p>
    </div>
  );
};

export default CreateNHC;