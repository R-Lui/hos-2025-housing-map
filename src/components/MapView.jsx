import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapIcon } from "./Icons";

function createPin(estate, selected) {
  const hasLarge = estate.units.some((unit) => unit.area > 40);
  const isNewSale = estate.saleType === "new";
  return L.divIcon({
    className: "estate-marker-wrap",
    html: `
      <div class="estate-marker ${hasLarge ? "has-large" : "standard"} ${selected ? "is-selected" : ""}">
        <span class="marker-char">${estate.meta.short}</span>
        ${isNewSale ? '<span class="marker-type">新</span>' : ""}
        ${hasLarge ? '<span class="marker-badge">40+</span>' : ""}
      </div>
    `,
    iconSize: [54, 68],
    iconAnchor: [27, 62],
  });
}

export default function MapView({ estates, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerRef = useRef(new Map());
  const onSelectRef = useRef(onSelect);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 9,
      maxZoom: 18,
      zoomSnap: 0.25,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
        maxNativeZoom: 19,
        maxZoom: 20,
      },
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }

    markerRef.current.clear();
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 52,
      iconCreateFunction(clusterGroup) {
        const count = clusterGroup.getChildCount();
        return L.divIcon({
          className: "estate-cluster-wrap",
          html: `<div class="estate-cluster"><span>${count}</span><small>個屋苑</small></div>`,
          iconSize: [58, 58],
          iconAnchor: [29, 29],
        });
      },
    });

    estates.forEach((estate) => {
      const marker = L.marker([estate.meta.lat, estate.meta.lng], {
        icon: createPin(estate, estate.id === selectedId),
        riseOnHover: true,
        keyboard: true,
        title: `${estate.id}，${estate.units.length} 個${estate.saleType === "new" ? "待售" : "貨尾"}單位`,
        alt: `查看${estate.id}`,
      });

      marker.bindTooltip(
        `<div class="map-tooltip-court">${estate.id}</div>
         <div class="map-tooltip-stats">${estate.saleType === "new" ? "新推售" : "重售"} · ${estate.units.length} 個未售 · 最大 ${estate.maxArea.toFixed(1)}㎡</div>`,
        {
          direction: "top",
          offset: [0, -52],
          opacity: 1,
          className: "estate-tooltip",
        },
      );

      marker.on("click", () => onSelectRef.current(estate.id));
      markerRef.current.set(estate.id, marker);
      cluster.addLayer(marker);
    });

    cluster.addTo(map);
    markersLayerRef.current = cluster;

    if (estates.length) {
      const bounds = L.latLngBounds(
        estates.map((estate) => [estate.meta.lat, estate.meta.lng]),
      );
      map.fitBounds(bounds, {
        paddingTopLeft: [100, 100],
        paddingBottomRight: [100, 140],
        maxZoom: 12,
      });
    }
  }, [estates, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markerRef.current.get(selectedId);
    const estate = estates.find((item) => item.id === selectedId);
    if (!marker || !estate) return;

    if (map.getZoom() < 14) {
      map.flyTo([estate.meta.lat, estate.meta.lng], 15, { duration: 0.8 });
    } else {
      map.panTo([estate.meta.lat, estate.meta.lng], { animate: true });
    }

    marker.openTooltip();
    const timer = window.setTimeout(() => marker.closeTooltip(), 2600);
    return () => window.clearTimeout(timer);
  }, [selectedId, estates]);

  return (
    <section className="map-shell" aria-label="2025 居屋互動地圖">
      <div ref={containerRef} className="map" />

      <div className="map-heading">
        <div className="map-heading-icon">
          <MapIcon />
        </div>
        <div>
          <p>香港 · 出售居屋 2025</p>
          <strong>重售及新推售分布</strong>
        </div>
      </div>

      <div className="map-legend" aria-label="地圖圖例">
        <span>
          <i className="legend-dot legend-dot-large" /> 有 &gt;40㎡ 未售
        </span>
        <span>
          <i className="legend-dot legend-dot-standard" /> 全屬 ≤40㎡
        </span>
      </div>

      <div className="map-footnote">
        面積為單位實用面積（包括露台、工作平台及陽台，如有）
      </div>
    </section>
  );
}
