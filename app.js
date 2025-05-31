// app.js — Weekly stacked bar chart (open / closed / merged)
//             + date‑range filter + legend + tooltips
// ------------------------------------------------------------------
// Requires in index.html:
//   <svg id="chart" width="960" height="540"></svg>
//   <div class="controls">
//     <input type="date" id="start-date"> – <input type="date" id="end-date">
//     <button id="apply" type="button">Apply</button>
//   </div>
// And raw_data.csv (number,state,created_at,closed_at,merged_at,...)
// ------------------------------------------------------------------

const margin = { top: 40, right: 120, bottom: 80, left: 60 },
      fullW  = 960,
      fullH  = 540,
      width  = fullW - margin.left - margin.right,
      height = fullH - margin.top  - margin.bottom;

// Base SVG ---------------------------------------------------------
const svgBase = d3.select("#chart").attr("viewBox", `0 0 ${fullW} ${fullH}`);
const svg = svgBase.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Groups -----------------------------------------------------------
const layersG = svg.append("g").attr("class", "layers");
const xAxisG  = svg.append("g").attr("class", "x-axis")
                   .attr("transform", `translate(0,${height})`);
const yAxisG  = svg.append("g").attr("class", "y-axis");

// Color scale ------------------------------------------------------
const color = d3.scaleOrdinal()
  .domain(["open", "closed", "merged"])
  .range(["#5b8fca", "#e9984b", "#8abf73"]);

// Tooltip ----------------------------------------------------------
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("border", "1px solid #999")
  .style("border-radius", "4px")
  .style("padding", "4px 6px")
  .style("font-size", "12px")
  .style("pointer-events", "none")
  .style("opacity", 0);

// Time helpers -----------------------------------------------------
const parseISO     = d3.utcParse("%Y-%m-%dT%H:%M:%SZ");
const fmtInputDate = d3.utcFormat("%Y-%m-%d");
const fmtWeekLabel = d3.utcFormat("%G‑W%V");     // ISO week label

// Data container ---------------------------------------------------
let ALL = [];

// ------------------------------------------------------------------
// 1) Load CSV, then initialise controls
// ------------------------------------------------------------------
d3.csv("raw_data.csv", d => {
  const created = parseISO(d.created_at);
  const merged  = d.merged_at ? parseISO(d.merged_at) : null;
  return {
    created_at : created,
    status     : merged ? "merged" : d.state.trim().toLowerCase()   // open | closed | merged
  };
}).then(data => {
  ALL = data.filter(d => d.created_at);
  if (!ALL.length) {
    console.error("No data rows parsed – check CSV path/content");
    return;
  }

  const minDate = d3.utcWeek.floor(d3.min(ALL, d => d.created_at));
  const maxDate = d3.utcWeek.ceil (d3.max(ALL, d => d.created_at));

  d3.select("#start-date").property("value", fmtInputDate(minDate));
  d3.select("#end-date")  .property("value", fmtInputDate(maxDate));

  d3.select("#apply").on("click", () => {
    const s = new Date(d3.select("#start-date").property("value"));
    const e = new Date(d3.select("#end-date").property("value"));
    draw(s, e);
  });

  // Initial render
  draw(minDate, maxDate);
});

// ------------------------------------------------------------------
// 2) Draw / update chart for a given date range
// ------------------------------------------------------------------
function draw(startDate, endDate) {
  if (!(startDate instanceof Date && endDate instanceof Date)) return;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

  // Rows inside date range (inclusive)
  const rows = ALL.filter(d => d.created_at >= startDate && d.created_at <= endDate);

  // Aggregate by ISO week (Monday 00:00 UTC)
  const grouped = d3.rollup(
    rows,
    v => ({
      open  : v.filter(d => d.status === "open").length,
      closed: v.filter(d => d.status === "closed").length,
      merged: v.filter(d => d.status === "merged").length
    }),
    d => d3.utcWeek.floor(d.created_at)
  );

  // Ensure continuous weeks
  const weeks = d3.utcWeeks(d3.utcWeek.floor(startDate), d3.utcWeek.ceil(endDate));
  const data = weeks.map(w => {
    const c = grouped.get(w) || { open: 0, closed: 0, merged: 0 };
    return { week: w, ...c };
  });

  // Scales ------------------------------------------------------
  const x = d3.scaleBand().domain(data.map(d => d.week))
      .range([0, width])
      .paddingInner(0.1);

  const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.open + d.closed + d.merged)]).nice()
      .range([height, 0]);

  // Axes --------------------------------------------------------
  const maxTicks = Math.min(12, data.length);
  const every    = Math.max(1, Math.ceil(data.length / maxTicks));

  xAxisG.call(
      d3.axisBottom(x)
        .tickValues(x.domain().filter((_, i) => !(i % every)))
        .tickFormat(fmtWeekLabel)
    )
    .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end");

  yAxisG.transition().duration(300).call(d3.axisLeft(y).ticks(8));

  // Stack layout -----------------------------------------------
  const series = d3.stack().keys(["open", "closed", "merged"])(data);

  // Layers ------------------------------------------------------
  const layer = layersG.selectAll("g.layer")
      .data(series, d => d.key);

  const layerEnter = layer.enter().append("g")
      .attr("class", "layer")
      .attr("fill", d => color(d.key));

  layer.exit().remove();

  // Bars --------------------------------------------------------
  layerEnter.merge(layer).each(function(seriesPart) {
    const sel = d3.select(this).selectAll("rect")
      .data(seriesPart.map(r => ({ key: seriesPart.key, week: r.data.week, y0: r[0], y1: r[1] })), d => d.key + +d.week);

    // ENTER -------------------------
    sel.enter().append("rect")
        .attr("x", d => x(d.week))
        .attr("width", x.bandwidth())
        .attr("y", height)
        .attr("height", 0)
      .call(enter => enter.transition().duration(300)
        .attr("y", d => y(d.y1))
        .attr("height", d => y(d.y0) - y(d.y1))
      );

    // UPDATE ------------------------
    sel.transition().duration(300)
        .attr("x", d => x(d.week))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.y1))
        .attr("height", d => y(d.y0) - y(d.y1));

    // EXIT --------------------------
    sel.exit().transition().duration(300)
      .attr("y", height)
      .attr("height", 0)
      .remove();

    // Tooltip handlers --------------
    d3.select(this).selectAll("rect")
      .on("mousemove", (event, d) => {
        tooltip.style("opacity", 1)
          .html(`<strong>${d.key}</strong>: ${d.y1 - d.y0}`)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  });

  // Legend ------------------------------------------------------
  const legend = svg.selectAll("g.legend")
      .data(color.domain(), d => d);

  const lgEnter = legend.enter().append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(${width + 20},${i * 22})`);

  lgEnter.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", color);

  lgEnter.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("font-size", "13px")
      .text(d => d);

  legend.select("rect").attr("fill", color);  // update colors on resize/date change
}
