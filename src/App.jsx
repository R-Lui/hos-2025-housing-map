import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "./components/MapView";
import {
  ChevronIcon,
  CloseIcon,
  ExternalIcon,
  SearchIcon,
} from "./components/Icons";
import statusSnapshot from "./status.json";
import newStatusSnapshot from "./new-status.json";
import { estateMeta, soldOutCourts } from "./estate-meta";

const FILTERS = [
  { id: "all", label: "全部屋苑" },
  { id: "large", label: "有 >40㎡" },
  { id: "standard", label: "≤40㎡" },
];

const UNIT_PREVIEW_LIMIT = 18;
const LARGE_UNIT_PREVIEW_LIMIT = 8;

function formatFloor(floor) {
  return `${floor} 樓`;
}

function formatUnit(unit) {
  return `單位 ${unit.unit}`;
}

function groupUnits(units) {
  return units.reduce((groups, unit) => {
    const blockKey = `${unit.block} 座`;
    if (!groups[blockKey]) groups[blockKey] = [];
    groups[blockKey].push(unit);
    return groups;
  }, {});
}

function EstateCard({
  estate,
  expanded,
  onToggle,
  onShowOnMap,
}) {
  const hasLarge = estate.units.some((unit) => unit.area > 40);
  const largeUnits = estate.units.filter((unit) => unit.area > 40);
  const isNewSale = estate.saleType === "new";
  const grouped = groupUnits(
    [...estate.units].sort(
      (a, b) =>
        a.block.localeCompare(b.block) ||
        a.floor - b.floor ||
        a.unit - b.unit,
    ),
  );

  return (
    <article
      className={`estate-card ${expanded ? "is-expanded" : ""}`}
      id={`estate-${estate.meta.slug}`}
    >
      <button
        type="button"
        className="estate-card-main"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span
          className={`estate-swatch ${hasLarge ? "has-large" : "standard"}`}
          aria-hidden="true"
        >
          {estate.meta.short}
        </span>
        <span className="estate-title">
          <span className="estate-name-line">
            <strong>{estate.id}</strong>
            {hasLarge && <em className="large-tag">40+</em>}
            {isNewSale && <em className="sale-tag">新推售</em>}
          </span>
          <span>{estate.meta.district} · {estate.meta.address}</span>
        </span>
        <span className="estate-numbers">
          <strong>{estate.units.length}</strong>
          <small>{isNewSale ? "個待售" : "個貨尾"}</small>
        </span>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded && (
        <div className="estate-detail">
          <div className="estate-summary">
            <div>
              <span>最大實用面積</span>
              <strong>{estate.maxArea.toFixed(1)}㎡</strong>
            </div>
            <div>
              <span>&gt;40㎡ 未售</span>
              <strong>{largeUnits.length} 個</strong>
            </div>
            <button type="button" onClick={onShowOnMap}>
              在地圖定位
            </button>
          </div>

          {largeUnits.length > 0 && (
            <div className="large-unit-callout">
              <span>超過 40㎡ 的選擇</span>
              <p>
                {largeUnits.slice(0, LARGE_UNIT_PREVIEW_LIMIT).map((unit) => (
                  <b key={`${unit.block}-${unit.floor}-${unit.unit}`}>
                    {unit.block}座 {unit.floor}樓 {unit.unit}室
                    <small>{unit.area.toFixed(1)}㎡</small>
                  </b>
                ))}
                {largeUnits.length > LARGE_UNIT_PREVIEW_LIMIT && (
                  <b className="more-units">
                    另有 {largeUnits.length - LARGE_UNIT_PREVIEW_LIMIT} 個
                  </b>
                )}
              </p>
            </div>
          )}

          <a
            className="official-unit-link"
            href={
              estate.meta.officialUrl ??
              "https://hos.housingauthority.gov.hk/mini-site/hos2025/tc/resale.html"
            }
            target="_blank"
            rel="noreferrer"
          >
            查看官方完整單位清單
            <ExternalIcon />
          </a>

          <div className="unit-list">
            {Object.entries(grouped).map(([block, units]) => (
              <div className="unit-block" key={block}>
                <h4>
                  {block}
                  <span>{units.length} 個</span>
                </h4>
                <div className="unit-grid">
                  {units.slice(0, UNIT_PREVIEW_LIMIT).map((unit) => (
                    <div
                      className={`unit-chip ${unit.area > 40 ? "is-large" : ""}`}
                      key={`${unit.block}-${unit.floor}-${unit.unit}`}
                    >
                      <span>{formatFloor(unit.floor)} · {formatUnit(unit)}</span>
                      <strong>{unit.area.toFixed(1)}㎡</strong>
                    </div>
                  ))}
                </div>
                {units.length > UNIT_PREVIEW_LIMIT && (
                  <p className="unit-overflow">
                    {block}另有 {units.length - UNIT_PREVIEW_LIMIT} 個未售單位，已計入屋苑總數。
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const estates = useMemo(
    () =>
      [
        ...statusSnapshot.result.map((estate) => ({
          ...estate,
          saleType: "resale",
        })),
        ...newStatusSnapshot.result.map((estate) => ({
          ...estate,
          saleType: "new",
        })),
      ]
        .filter((estate) => estate.units.length > 0)
        .map((estate, index) => ({
          ...estate,
          id: estate.court,
          meta: estateMeta[estate.court],
          index,
        }))
        .sort((a, b) => b.units.length - a.units.length),
    [],
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const cardRefs = useRef(new Map());

  const totalUnits = estates.reduce((sum, estate) => sum + estate.units.length, 0);
  const largeEstates = estates.filter((estate) =>
    estate.units.some((unit) => unit.area > 40),
  );
  const largeUnits = estates.reduce(
    (sum, estate) =>
      sum + estate.units.filter((unit) => unit.area > 40).length,
    0,
  );
  const maxArea = Math.max(...estates.map((estate) => estate.maxArea));

  const filteredEstates = estates.filter((estate) => {
    const haystack =
      `${estate.id} ${estate.meta.english} ${estate.meta.district} ${estate.meta.address} ${estate.saleType === "new" ? "新推售" : "重售"}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const hasLarge = estate.units.some((unit) => unit.area > 40);
    const matchesFilter =
      filter === "all" ||
      (filter === "large" && hasLarge) ||
      (filter === "standard" && !hasLarge);
    return matchesQuery && matchesFilter;
  });

  useEffect(() => {
    if (selectedId && !filteredEstates.some((estate) => estate.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredEstates, selectedId]);

  function handleMarkerSelect(id) {
    setSelectedId(id);
    setExpandedId(id);
    window.setTimeout(() => {
      cardRefs.current.get(id)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 80);
  }

  function showOnMap(id) {
    setSelectedId(id);
    if (window.innerWidth <= 900) {
      document.querySelector(".map-shell")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>HOS</span>
            <strong>25</strong>
          </div>
          <div>
            <p>出售居者有其屋計劃</p>
            <span>重售及新推售 · 2025</span>
          </div>
          <span className="live-tag">
            <i />
            已核對
          </span>
        </header>

        <section className="intro">
          <p className="eyebrow">RESALE + NEW SALE / 屋苑地圖</p>
          <h1>邊度仲有<br />單位未賣？</h1>
          <p className="intro-copy">
            一次睇清 2025 居屋重售及本年度新推售屋苑，以及邊度仲有超過 40 平方米嘅選擇。
          </p>
          <div className="updated">
            <span>官方資料更新</span>
            <strong>2026.11.02 · 20:22</strong>
          </div>
        </section>

        <section className="stats" aria-label="貨尾概況">
          <div>
            <span>仍有單位</span>
            <strong>{estates.length}<small>個屋苑</small></strong>
          </div>
          <div>
            <span>待售單位</span>
            <strong>{totalUnits}<small>個</small></strong>
          </div>
          <div>
            <span>&gt;40㎡ 屋苑</span>
            <strong>{largeEstates.length}<small>個</small></strong>
          </div>
        </section>

        <section className="insight">
          <span className="insight-kicker">重點</span>
          <p>
            <strong>{largeEstates.map((estate) => estate.id).join("、")}</strong>
            {" "}仍有超過 40㎡ 的未售單位，合共 {largeUnits} 個；全港最大待售單位為 {maxArea.toFixed(1)}㎡。
          </p>
        </section>

        <section className="directory">
          <div className="directory-head">
            <div>
              <p className="eyebrow">ESTATES / 屋苑</p>
              <h2>屋苑清單</h2>
            </div>
            <span>{filteredEstates.length} / {estates.length}</span>
          </div>

          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋屋苑或地區⋯"
              aria-label="搜尋屋苑或地區"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">
                <CloseIcon />
              </button>
            )}
          </label>

          <div className="filter-tabs" role="group" aria-label="按面積篩選">
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={filter === item.id ? "is-active" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span>
                  {item.id === "all"
                    ? estates.length
                    : item.id === "large"
                      ? largeEstates.length
                      : estates.length - largeEstates.length}
                </span>
              </button>
            ))}
          </div>

          <div className="estate-list">
            {filteredEstates.map((estate) => (
              <div
                key={estate.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(estate.id, node);
                  else cardRefs.current.delete(estate.id);
                }}
              >
                <EstateCard
                  estate={estate}
                  expanded={expandedId === estate.id}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === estate.id ? null : estate.id,
                    )
                  }
                  onShowOnMap={() => showOnMap(estate.id)}
                />
              </div>
            ))}

            {filteredEstates.length === 0 && (
              <div className="empty-state">
                <p>搵唔到符合條件嘅屋苑。</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  清除篩選
                </button>
              </div>
            )}
          </div>

          <div className="sold-out">
            <span>重售已售罄</span>
            <p>{soldOutCourts.join(" · ")}</p>
          </div>
        </section>

        <footer className="sidebar-footer">
          <p>
            資料來源：香港房屋委員會「重售單位」銷售情況及
            2025 新推售屋苑銷售情況與價單。檔案並非實時更新。
          </p>
          <a
            href="https://hos.housingauthority.gov.hk/mini-site/hos2025/tc/index.html"
            target="_blank"
            rel="noreferrer"
          >
            查看官方資料
            <ExternalIcon />
          </a>
        </footer>
      </aside>

      <MapView
        estates={filteredEstates}
        selectedId={selectedId}
        onSelect={handleMarkerSelect}
      />
    </main>
  );
}
