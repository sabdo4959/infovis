//1. stacked bar
//initialize 
const barSvg  = d3.select("#stacked-bar");
const COLOR = { open: "#1f77b4", closed: "#ff7f0e", merged: "#2ca02c" };
const barMargin  = {top:40,right:140,bottom:70,left:60},
      barW = barSvg.attr("width")  - barMargin.left - barMargin.right,
      barH = barSvg.attr("height") - barMargin.top  - barMargin.bottom,
      gBar = barSvg.append("g").attr("transform",`translate(${barMargin.left},${barMargin.top})`);

const xBar = d3.scaleBand().padding(0.1).range([0, barW]);
const yBar = d3.scaleLinear().range([barH, 0]);
const xBarAxisG = gBar.append("g")
      .attr("transform",`translate(0,${barH})`);
const yBarAxisG = gBar.append("g");
const legendG   = gBar.append("g").attr("transform",`translate(${barW+20},0)`);


// update
function updateBar(){
  const sDate = new Date(d3.select("#start-date").property("value"));
  const eDate = new Date(d3.select("#end-date").property("value")); eDate.setUTCHours(23,59,59,999);

  const weeklyAgg = aggregateWeekly(
    prData.filter(d=>{
      const c = parseDate(d.created_at);
      return c>=sDate && c<=eDate;
    })
  );
  const keys = ["open","closed","merged"];
  const series = d3.stack().keys(keys)(weeklyAgg);

  xBar.domain(weeklyAgg.map(d=>d.weekStr));
  yBar.domain([0, d3.max(series.at(-1), d=>d[1])||1]).nice();

  const layers = gBar.selectAll("g.layer").data(series, d=>d.key);
  layers.exit().remove();
  const layersMerge = layers.enter().append("g")
      .attr("class","layer").attr("fill",d=>COLOR[d.key])
    .merge(layers);

  layersMerge.selectAll("rect").data(d=>d, d=>d.data.weekStr).join(
    enter=>enter.append("rect")
      .attr("x",d=>xBar(d.data.weekStr))
      .attr("width",xBar.bandwidth())
      .attr("y",yBar(0)).attr("height",0)
      .on("mousemove",(e,d)=>{
        const k = e.currentTarget.parentNode.__data__.key;
        const total = d3.sum(keys.map(key => d.data[key]));
        const value = d[1] - d[0];
        const percent = total ? ((value / total) * 100).toFixed(1) : "0.0";
        tooltip.html(`${k}: <b>${value}(${percent}%)</b>`)
               .style("left",(e.pageX+10)+"px")
               .style("top",(e.pageY+10)+"px")
               .style("opacity",1);
      })
      .on("mouseleave",()=>tooltip.style("opacity",0))
      .transition().duration(400)
      .attr("y",d=>yBar(d[1]))
      .attr("height",d=>yBar(d[0]) - yBar(d[1])),
    update=>update.transition().duration(400)
      .attr("x",d=>xBar(d.data.weekStr))
      .attr("width",xBar.bandwidth())
      .attr("y",d=>yBar(d[1]))
      .attr("height",d=>yBar(d[0]) - yBar(d[1]))
  );

  const tickVals=xBar.domain().filter((_,i)=>!(i%Math.ceil(xBar.domain().length/12)));
  xBarAxisG.call(d3.axisBottom(xBar).tickValues(tickVals));
  yBarAxisG.call(d3.axisLeft(yBar));

  // Legend
  const lg=legendG.selectAll("g.leg").data(keys);
  const lgE=lg.enter().append("g").attr("class","leg");
  lgE.append("rect").attr("width",14).attr("height",14);
  lgE.append("text").attr("x",20).attr("y",12);
  lgE.merge(lg)
     .attr("transform",(d,i)=>`translate(0,${i*22})`)
     .select("rect").attr("fill",d=>COLOR[d]);
  legendG.selectAll("text").text(d=>d.charAt(0).toUpperCase()+d.slice(1));
}


// 2. scatterplot
//initialize
const scatSvg = d3.select("#scatter");
const scatMargin = {top:40,right:20,bottom:60,left:30},
      scatW = scatSvg.attr("width")  - scatMargin.left - scatMargin.right,
      scatH = scatSvg.attr("height") - scatMargin.top  - scatMargin.bottom,
      gScat = scatSvg.append("g").attr("transform",`translate(${scatMargin.left},${scatMargin.top})`);
const xScat = d3.scaleBand().domain([0,1,2,3,4,5,6]).range([0, scatW]).padding(0.5);
const yScat = d3.scaleLinear().range([scatH, 0]);
const xScatAxisG = gScat.append("g").attr("transform",`translate(0,${scatH})`);
const yScatAxisG = gScat.append("g");

// Update function for scatterplot

// Scatter 
function updateScatter(){
  const pts=openWeekData.get(currentWeek)||[];
  yScat.domain([0,d3.max(pts,d=>d.delay)||1]).nice();

  xScatAxisG.call(d3.axisBottom(xScat)
                    .tickFormat(d=>["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][d]));
  yScatAxisG.call(d3.axisLeft(yScat));

  gScat.selectAll("circle.dot").data(pts,d=>d.number).join(
    enter=>enter.append("circle")
        .attr("class","dot").attr("r",4).attr("fill",COLOR.open)
        .on("mouseenter",(e,d)=>{
          tooltip.html(`#${d.number}<br>${d.delay.toFixed(1)} d`)
                 .style("left",(e.pageX+12)+"px")
                 .style("top",(e.pageY+12)+"px")
                 .style("opacity",1);
        })
        .on("mouseleave",()=>tooltip.style("opacity",0))
      .merge(gScat.selectAll("circle.dot"))
        .attr("cx",d=>xScat(d.weekday) + xScat.bandwidth()/2)  // ← 수정
        .attr("cy",d=>yScat(d.delay))
  );
}

//3. pie chart
//initialize
const pieSvg  = d3.select("#pie");
const pieMargin = {top:30,right:20,bottom:20,left:20},
      pieW = pieSvg.attr("width")  - pieMargin.left - pieMargin.right,
      pieH = pieSvg.attr("height") - pieMargin.top  - pieMargin.bottom,
      radius = Math.min(pieW,pieH)/2 - 10,
      gPie = pieSvg.append("g")
        .attr("transform",`translate(${pieMargin.left+pieW/2},${pieMargin.top+pieH/2})`);
const pieLegendDiv = d3.select("#pie-legend");
const pieColor = d3.scaleOrdinal(d3.schemeTableau10);
// update
function updatePie(){
  // 현재 week 에 속한 모든 PR
  const rowsWeek = prData.filter(d=>fmtWeek(d3.utcWeek.floor(parseDate(d.created_at)))===currentWeek);
  // label 카운트
  const counts = {};
  rowsWeek.forEach(row=>{
    const labs = row.labels ? row.labels.split(";").map(s=>s.trim()).filter(Boolean) : ["(no label)"];
    (labs.length?labs:["(no label)"]).forEach(l=>counts[l]=(counts[l]||0)+1);
  });
  const data = Object.entries(counts).sort((a,b)=>b[1]-a[1]); // [label,n]

  const pie = d3.pie().value(d=>d[1]).sort(null)(data);
  const arc = d3.arc().outerRadius(radius).innerRadius(0);

  gPie.selectAll("path.slice").data(pie,d=>d.data[0]).join(
    enter=>enter.append("path").attr("class","slice")
        .attr("stroke","#fff").attr("stroke-width",1)
      .on("mouseenter", (e, d) => {
        const total = d3.sum(pie, p => p.data[1]);
        const percent = total ? ((d.data[1] / total) * 100).toFixed(1) : "0.0";
        tooltip.html(`${d.data[0]}: <b>${d.data[1]}(${percent}%)</b>`)
          .style("left", (e.pageX + 10) + "px")
          .style("top", (e.pageY + 10) + "px")
          .style("opacity", 1);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0))
      .merge(gPie.selectAll("path.slice"))
        .attr("fill",d=>pieColor(d.data[0]))
        .transition().duration(400)
        .attrTween("d",function(d){
          const i=d3.interpolate(this._current||d,d);
          this._current=i(1); return t=>arc(i(t));
        })
  );

  // PieLegend
  pieLegendDiv.html("");
  pieLegendDiv.selectAll("div.item").data(data)
      .enter().append("div").attr("class","item")
      .style("display","flex").style("align-items","center").style("margin","4px 0")
      .html(d=>`
        <span style="width:12px;height:12px;background:${pieColor(d[0])};display:inline-block;margin-right:6px"></span>
        ${d[0]} (${d[1]})
      `);
}


//4. 기타 
// Data Format
const parseDate = d3.utcParse("%Y-%m-%dT%H:%M:%SZ");
const fmtWeek   = d3.utcFormat("%G-W%V");     // ISO-year-week, e.g. 2025-W22
const todayUTC  = new Date();        

//tootltip
const tooltip = d3.select(".tooltip");
tooltip.style("position","absolute").style("opacity",0);

// Data Storage 
let prData = [];                   // raw parsed rows
const openWeekData = new Map();    // isoWeek -> points[] (scatter)
let currentWeek = "";              // isoWeek selected for scatter & pie

// Utility
const delayDays = d => (todayUTC - parseDate(d)) / 86_400_000;

// Aggregate weekly counts for bar chart
function aggregateWeekly(arr){
  const rolled = d3.rollups(
    arr,
    v => ({
      open   : v.filter(d=>d.state==="open").length,
      closed : v.filter(d=>d.state==="closed" && !d.merged_at).length,
      merged : v.filter(d=>d.state==="merged").length,
    }),
    d => +d3.utcWeek.floor(parseDate(d.created_at))
  );
  return rolled.map(([ts,c])=>({
    week   : new Date(+ts),
    weekStr: fmtWeek(new Date(+ts)),
    ...c
  })).sort((a,b)=>a.week-b.week);
}


// 전체 초기화
function initialize(){

  d3.csv("raw_data.csv").then(raw=>{
    prData = raw.map(d=>({
      number     : +d.number,
      merged_at  : d.merged_at||"",
      state      : d.merged_at ? "merged" : d.state,
      created_at : d.created_at,
      labels     : d.labels||""
    })).filter(d=>d.created_at);

    // open PR points for scatter
    prData.filter(d=>d.state==="open").forEach(row=>{
      const created=parseDate(row.created_at);
      const iso=fmtWeek(d3.utcWeek.floor(created));
      const pt={number:row.number,weekday:created.getUTCDay(),
                delay:delayDays(row.created_at),isoWeek:iso};
      if(!openWeekData.has(iso)) openWeekData.set(iso,[]);
      openWeekData.get(iso).push(pt);
    });

    //stacked bar 초기화
    d3.select("#start-date").property("value","2025-04-01");
    d3.select("#end-date").property("value","2025-05-31");
    d3.select("#apply").on("click",updateBar);


    // week-input 범위 & 기본 값
    const weekInput = d3.select("#week-select");
    const weeks = Array.from(openWeekData.keys()).sort();
    currentWeek = weeks.at(-1);
    weekInput.attr("min", weeks[0]).attr("max", weeks.at(-1))
             .property("value", currentWeek);

    d3.select("#week-apply").on("click", function() {
      currentWeek = weekInput.property("value");
      updateScatter();
      updatePie();
    });

    updateBar();
    updateScatter();
    updatePie();
  });
}

initialize();