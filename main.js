import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const svg = d3.select("#chart");

const cfg = {
  margin:{top:18,right:18,bottom:44,left:52},
  nBars:12,
  nLine:12,
  valueRange:[80,120],
  baselinePad:10
};

let state={
  mode:"bars",
  dataBars:makeBarsData(),
  dataLine:makeLineData(),
  baseline:0
};

const btnRandom=document.querySelector("#btnRandom");
const btnBars=document.querySelector("#btnBars");
const btnLines=document.querySelector("#btnLines");
const btnReset=document.querySelector("#btnReset");
const baselineInput=document.querySelector("#baseline");
const baselineValue=document.querySelector("#baselineValue");
const hint=document.querySelector("#hint");
const explainTitle=document.querySelector("#explainTitle");
const explainText=document.querySelector("#explainText");

setupSvg();
setupControls();
syncBaseline(true);
render();

function getData(){return state.mode==="bars"?state.dataBars:state.dataLine;}

function setupSvg(){
  svg.attr("viewBox","0 0 960 420");
  svg.append("g").attr("class","grid");
  svg.append("g").attr("class","x-axis");
  svg.append("g").attr("class","y-axis");
  svg.append("g").attr("class","marks");
}

function setupControls(){
  btnRandom.onclick=()=>{
    state.dataBars=makeBarsData();
    state.dataLine=makeLineData();
    syncBaseline(true);render();
  };
  btnBars.onclick=()=>{state.mode="bars";btnBars.classList.add("active");btnLines.classList.remove("active");syncBaseline(true);render();};
  btnLines.onclick=()=>{state.mode="lines";btnLines.classList.add("active");btnBars.classList.remove("active");syncBaseline(true);render();};
  btnReset.onclick=()=>{state.baseline=0;baselineInput.value=0;render();};
  baselineInput.oninput=e=>{state.baseline=+e.target.value;render();};
}

function makeBarsData(){
  return d3.range(cfg.nBars).map(i=>({x:String.fromCharCode(65+i),y:80+Math.round(Math.random()*40)}));
}

function makeLineData(){
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Choose a pattern so the line is sometimes flat, sometimes trending, sometimes volatile/seasonal.
  // This avoids always producing near-flat lines.
  const patterns=["flat","trendUp","trendDown","volatile","seasonal"];
  const pattern=patterns[Math.floor(Math.random()*patterns.length)];

  const lo=cfg.valueRange[0], hi=cfg.valueRange[1];
  const mid=lo+(hi-lo)*0.5;

  // Base level
  let v = mid + (Math.random()*10 - 5);

  // Parameters per pattern
  const slope = (hi-lo) * (0.03 + Math.random()*0.05); // per step, small but noticeable
  const noiseSmall = (hi-lo) * 0.02;
  const noiseMed   = (hi-lo) * 0.05;
  const noiseLarge = (hi-lo) * 0.09;

  return months.map((m,i)=>{
    if(pattern==="flat"){
      v += (Math.random()*2 - 1) * noiseSmall;
    } else if(pattern==="trendUp"){
      v += slope + (Math.random()*2 - 1) * noiseMed;
    } else if(pattern==="trendDown"){
      v += -slope + (Math.random()*2 - 1) * noiseMed;
    } else if(pattern==="volatile"){
      v += (Math.random()*2 - 1) * noiseLarge;
    } else if(pattern==="seasonal"){
      // Sinusoidal seasonality + some noise
      const amp = (hi-lo) * (0.12 + Math.random()*0.10);
      const phase = Math.random()*Math.PI*2;
      const seasonal = amp * Math.sin((i/11)*Math.PI*2 + phase);
      // Keep a mild baseline drift so it's not perfectly symmetric
      const drift = (Math.random()*2 - 1) * (hi-lo) * 0.01;
      v = mid + seasonal + drift*i + (Math.random()*2 - 1) * noiseMed;
    }

    // Clamp to range
    v = Math.max(lo, Math.min(hi, v));
    return {x:m, y:Math.round(v)};
  });
}

function syncBaseline(clamp){
  const d=getData();
  const min=d3.min(d,e=>e.y),max=d3.max(d,e=>e.y);
  const maxB=Math.max(0,Math.floor(min-cfg.baselinePad));
  baselineInput.max=maxB;
  if(clamp) state.baseline=Math.min(state.baseline,maxB);
  baselineInput.value=state.baseline;
  baselineValue.textContent=state.baseline;
  hint.textContent=`This dataset ranges from ${min} to ${max}. Raising the y-axis minimum truncates the scale and can visually amplify differences.`;
}

function render(){
  syncBaseline(false);
  const d=getData();
  const {top,right,bottom,left}=cfg.margin;
  const w=960-left-right,h=420-top-bottom;
  const min=d3.min(d,e=>e.y),max=d3.max(d,e=>e.y);
  const y0=state.baseline;
  const y=d3.scaleLinear().domain([y0,Math.max(max,y0)]).nice().range([h,0]);
  const x=state.mode==="bars"
    ?d3.scaleBand().domain(d.map(e=>e.x)).range([0,w]).padding(0.18)
    :d3.scalePoint().domain(d.map(e=>e.x)).range([0,w]).padding(0.5);

  svg.select(".grid").attr("transform",`translate(${left},${top})`)
    .selectAll("line").data(y.ticks(5)).join("line")
    .attr("x1",0).attr("x2",w).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","#e5e7eb");

  svg.select(".x-axis").attr("transform",`translate(${left},${top+h})`)
    .call(d3.axisBottom(x));
  svg.select(".y-axis").attr("transform",`translate(${left},${top})`)
    .call(d3.axisLeft(y));

  const marks=svg.select(".marks").attr("transform",`translate(${left},${top})`);
  marks.selectAll("*").remove();

  if(state.mode==="bars"){
    marks.selectAll("rect").data(d).join("rect")
      .attr("x",e=>x(e.x)).attr("width",x.bandwidth())
      .attr("y",e=>y(Math.max(e.y,y0)))
      .attr("height",e=>Math.max(0,y(y0)-y(e.y)))
      .attr("fill","#93c5fd").attr("stroke","#1d4ed8");
  }else{
    const line=d3.line().x(e=>x(e.x)).y(e=>y(e.y));
    marks.append("path").datum(d).attr("d",line).attr("fill","none").attr("stroke","#1d4ed8").attr("stroke-width",2);
    marks.selectAll("circle").data(d).join("circle")
      .attr("cx",e=>x(e.x)).attr("cy",e=>y(e.y)).attr("r",4).attr("fill","#2563eb");
  }

  explainTitle.textContent=state.mode==="bars"?"Why it matters (bars)":"Why it matters (lines)";
  explainText.textContent=state.mode==="bars"
    ?"Bar charts encode magnitude from the baseline. Truncating the axis can exaggerate differences."
    :"Line charts emphasize variation. A non-zero baseline can be acceptable depending on context.";
}
