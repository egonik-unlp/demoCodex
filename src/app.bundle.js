// src/app.ts
var chart = mustElement("chart");
var datasetSelect = mustElement("datasetSelect");
var csvInput = mustElement("csvInput");
var csvStatus = mustElement("csvStatus");
var loadDummyButton = mustElement("loadDummyButton");
var loadCsvButton = mustElement("loadCsvButton");
var autoBalanceButton = mustElement("autoBalanceButton");
var downloadSvgButton = mustElement("downloadSvgButton");
var downloadCsvButton = mustElement("downloadCsvButton");
var downloadJsonButton = mustElement("downloadJsonButton");
var downloadReportButton = mustElement("downloadReportButton");
var additionTime = mustElement("additionTime");
var preEnd = mustElement("preEnd");
var postStart = mustElement("postStart");
var correctedTime = mustElement("correctedTime");
var readouts = {
  additionValue: mustElement("additionValue"),
  preEndValue: mustElement("preEndValue"),
  postStartValue: mustElement("postStartValue"),
  correctedTimeValue: mustElement("correctedTimeValue"),
  delta: mustElement("deltaReadout"),
  leftArea: mustElement("leftAreaReadout"),
  rightArea: mustElement("rightAreaReadout"),
  areaDiff: mustElement("areaDiffReadout"),
  preFit: mustElement("preFitReadout"),
  postFit: mustElement("postFitReadout"),
  initialTemp: mustElement("initialTempReadout"),
  finalTemp: mustElement("finalTempReadout"),
  balanceStatus: mustElement("balanceStatus")
};
var datasets = createDatasets();
var currentDataset = datasets[0];
var points = currentDataset.points;
var dragMode = null;
setup();
render();
function setup() {
  for (const dataset of datasets) {
    const option = document.createElement("option");
    option.value = dataset.id;
    option.textContent = dataset.name;
    datasetSelect.append(option);
  }
  datasetSelect.value = currentDataset.id;
  csvInput.value = toCsv(points);
  configureRanges(currentDataset);
  datasetSelect.addEventListener("change", () => {
    const selected = datasets.find((dataset) => dataset.id === datasetSelect.value);
    if (!selected)
      return;
    currentDataset = selected;
    points = selected.points;
    csvInput.value = toCsv(points);
    csvStatus.textContent = selected.description;
    configureRanges(selected);
    render();
  });
  loadDummyButton.addEventListener("click", () => {
    points = currentDataset.points;
    csvInput.value = toCsv(points);
    csvStatus.textContent = currentDataset.description;
    configureRanges(currentDataset);
    render();
  });
  loadCsvButton.addEventListener("click", () => {
    const parsed = parseCsv(csvInput.value);
    if (parsed.length < 8) {
      csvStatus.textContent = "Se necesitan al menos 8 puntos validos.";
      return;
    }
    points = parsed;
    csvStatus.textContent = `${parsed.length} puntos cargados.`;
    configureRanges({
      ...currentDataset,
      points: parsed,
      additionTime: medianTime(parsed),
      preEnd: medianTime(parsed) - span(parsed) * 0.18,
      postStart: medianTime(parsed) + span(parsed) * 0.18,
      correctedTime: medianTime(parsed)
    });
    render();
  });
  autoBalanceButton.addEventListener("click", () => {
    const preFit = fitForRange(points, minT(points), Number(preEnd.value));
    const postFit = fitForRange(points, Number(postStart.value), maxT(points));
    const balanced = findBalancedTime(points, preFit, postFit, Number(preEnd.value), Number(postStart.value));
    correctedTime.value = String(roundToStep(balanced, 0.5));
    render();
  });
  downloadSvgButton.addEventListener("click", downloadSvg);
  downloadCsvButton.addEventListener("click", downloadCsv);
  downloadJsonButton.addEventListener("click", downloadJson);
  downloadReportButton.addEventListener("click", downloadReport);
  for (const input of [additionTime, preEnd, postStart, correctedTime]) {
    input.addEventListener("input", () => {
      normalizeRanges(input);
      render();
    });
  }
  chart.addEventListener("pointerdown", (event) => {
    const scale = makeScale(points);
    const t = invertX(event.offsetX, scale);
    const addDistance = Math.abs(t - Number(additionTime.value));
    const correctedDistance = Math.abs(t - Number(correctedTime.value));
    dragMode = addDistance < correctedDistance ? "addition" : "corrected";
    chart.setPointerCapture(event.pointerId);
  });
  chart.addEventListener("pointermove", (event) => {
    if (!dragMode)
      return;
    const scale = makeScale(points);
    const t = clamp(roundToStep(invertX(event.offsetX, scale), 0.5), minT(points), maxT(points));
    if (dragMode === "addition") {
      additionTime.value = String(t);
    } else {
      correctedTime.value = String(t);
    }
    normalizeRanges(dragMode === "addition" ? additionTime : correctedTime);
    render();
  });
  chart.addEventListener("pointerup", (event) => {
    dragMode = null;
    chart.releasePointerCapture(event.pointerId);
  });
  window.addEventListener("resize", render);
}
function configureRanges(dataset) {
  const min = minT(dataset.points);
  const max = maxT(dataset.points);
  for (const input of [additionTime, preEnd, postStart, correctedTime]) {
    input.min = String(min);
    input.max = String(max);
  }
  additionTime.value = String(dataset.additionTime);
  preEnd.value = String(dataset.preEnd);
  postStart.value = String(dataset.postStart);
  correctedTime.value = String(dataset.correctedTime);
  normalizeRanges(additionTime);
}
function normalizeRanges(changed) {
  const min = minT(points);
  const max = maxT(points);
  let add = Number(additionTime.value);
  let pre = Number(preEnd.value);
  let post = Number(postStart.value);
  let corrected = Number(correctedTime.value);
  const gap = Math.max(span(points) * 0.04, 1);
  if (changed === preEnd)
    pre = Math.min(pre, add - gap);
  if (changed === postStart)
    post = Math.max(post, add + gap);
  add = clamp(add, min + gap, max - gap);
  pre = clamp(pre, min, add - gap);
  post = clamp(post, add + gap, max);
  corrected = clamp(corrected, pre, post);
  additionTime.value = String(roundToStep(add, 0.5));
  preEnd.value = String(roundToStep(pre, 0.5));
  postStart.value = String(roundToStep(post, 0.5));
  correctedTime.value = String(roundToStep(corrected, 0.5));
}
function render() {
  if (points.length < 2)
    return;
  const minTime = minT(points);
  const maxTime = maxT(points);
  const preFit = fitForRange(points, minTime, Number(preEnd.value));
  const postFit = fitForRange(points, Number(postStart.value), maxTime);
  const corrected = Number(correctedTime.value);
  const areas = calculateAreas(points, preFit, postFit, Number(preEnd.value), Number(postStart.value), corrected);
  const initialTemp = evaluate(preFit, corrected);
  const finalTemp = evaluate(postFit, corrected);
  const delta = finalTemp - initialTemp;
  renderChart(preFit, postFit, areas);
  renderReadouts(preFit, postFit, initialTemp, finalTemp, delta, areas);
}
function renderChart(preFit, postFit, _areas) {
  const scale = makeScale(points);
  const minTime = minT(points);
  const maxTime = maxT(points);
  const minTemp = minY(points, preFit, postFit);
  const maxTemp = maxY(points, preFit, postFit);
  const corrected = Number(correctedTime.value);
  const add = Number(additionTime.value);
  const pre = Number(preEnd.value);
  const post = Number(postStart.value);
  chart.setAttribute("viewBox", `0 0 ${scale.width} ${scale.height}`);
  chart.innerHTML = "";
  addGrid(scale, minTime, maxTime, minTemp, maxTemp);
  addRect(scale.x(minTime), scale.margin.top, scale.x(pre) - scale.x(minTime), innerHeight(scale), "ghost-region");
  addRect(scale.x(post), scale.margin.top, scale.x(maxTime) - scale.x(post), innerHeight(scale), "ghost-region");
  addAreaPath("area-left", buildAreaPath(points, preFit, postFit, pre, corrected, scale, "left"));
  addAreaPath("area-right", buildAreaPath(points, preFit, postFit, corrected, post, scale, "right"));
  addPath(linePath(points, scale), "data-line");
  addPoints(points, scale);
  addLine(scale.x(minTime), scale.y(evaluate(preFit, minTime)), scale.x(maxTime), scale.y(evaluate(preFit, maxTime)), "fit-pre");
  addLine(scale.x(minTime), scale.y(evaluate(postFit, minTime)), scale.x(maxTime), scale.y(evaluate(postFit, maxTime)), "fit-post");
  addLine(scale.x(add), scale.margin.top, scale.x(add), scale.height - scale.margin.bottom, "marker-addition");
  addLine(scale.x(corrected), scale.margin.top, scale.x(corrected), scale.height - scale.margin.bottom, "marker-corrected");
  const addLabel = scale.mobile ? "agregado" : "t adicion";
  const correctedLabel = scale.mobile ? "t*" : "t corregido";
  addText(clamp(scale.x(add) + 5, scale.margin.left + 4, scale.width - scale.margin.right - 54), scale.margin.top + 16, addLabel, "chart-label marker-label");
  addText(clamp(scale.x(corrected) + 5, scale.margin.left + 4, scale.width - scale.margin.right - 54), scale.margin.top + (scale.mobile ? 32 : 36), correctedLabel, "chart-label marker-label");
  addText(scale.margin.left, scale.mobile ? 18 : 24, scale.mobile ? "T (°C)" : "Temperatura (°C)", "chart-label");
  addText(scale.width - scale.margin.right - (scale.mobile ? 36 : 86), scale.height - 12, scale.mobile ? "t (s)" : "Tiempo (s)", "chart-label");
}
function renderReadouts(preFit, postFit, initialTemp, finalTemp, delta, areas) {
  readouts.additionValue.value = `${formatNumber(Number(additionTime.value), 1)} s`;
  readouts.preEndValue.value = `${formatNumber(Number(preEnd.value), 1)} s`;
  readouts.postStartValue.value = `${formatNumber(Number(postStart.value), 1)} s`;
  readouts.correctedTimeValue.value = `${formatNumber(Number(correctedTime.value), 1)} s`;
  readouts.delta.textContent = `${formatNumber(delta, 3)} °C`;
  readouts.leftArea.textContent = `${formatNumber(areas.left, 2)} °C s`;
  readouts.rightArea.textContent = `${formatNumber(areas.right, 2)} °C s`;
  readouts.areaDiff.textContent = `${formatNumber(areas.diff, 2)} °C s`;
  readouts.preFit.textContent = `T = ${formatNumber(preFit.slope, 5)} t + ${formatNumber(preFit.intercept, 3)}`;
  readouts.postFit.textContent = `T = ${formatNumber(postFit.slope, 5)} t + ${formatNumber(postFit.intercept, 3)}`;
  readouts.initialTemp.textContent = `${formatNumber(initialTemp, 3)} °C`;
  readouts.finalTemp.textContent = `${formatNumber(finalTemp, 3)} °C`;
  const tolerance = Math.max(0.5, (areas.left + areas.right) * 0.04);
  readouts.balanceStatus.textContent = Math.abs(areas.diff) <= tolerance ? "Areas casi iguales" : areas.diff > 0 ? "Mover t corregido a la derecha" : "Mover t corregido a la izquierda";
}
function downloadSvg() {
  const clone = chart.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.insertBefore(svgStyleElement(), clone.firstChild);
  const source = `<?xml version="1.0" encoding="UTF-8"?>
${new XMLSerializer().serializeToString(clone)}
`;
  downloadText(source, `${fileBaseName()}-grafico.svg`, "image/svg+xml;charset=utf-8");
}
function downloadCsv() {
  const header = "tiempo_s,temperatura_C";
  const rows = points.map((point) => `${point.t},${point.temp}`);
  downloadText([header, ...rows].join(`
`), `${fileBaseName()}-datos.csv`, "text/csv;charset=utf-8");
}
function downloadJson() {
  const analysis = currentAnalysis();
  downloadText(JSON.stringify(analysis, null, 2), `${fileBaseName()}-analisis.json`, "application/json;charset=utf-8");
}
function downloadReport() {
  const analysis = currentAnalysis();
  const lines = [
    "Calorimetria: correccion grafica de Delta T",
    `Medicion: ${analysis.dataset.name}`,
    `Puntos: ${analysis.data.length}`,
    "",
    `t adicion: ${formatNumber(analysis.controls.additionTime, 2)} s`,
    `Fin tramo inicial: ${formatNumber(analysis.controls.preEnd, 2)} s`,
    `Inicio tramo final: ${formatNumber(analysis.controls.postStart, 2)} s`,
    `Tiempo corregido: ${formatNumber(analysis.controls.correctedTime, 2)} s`,
    "",
    `Recta inicial: T = ${formatNumber(analysis.fits.pre.slope, 6)} t + ${formatNumber(analysis.fits.pre.intercept, 4)}`,
    `Recta final: T = ${formatNumber(analysis.fits.post.slope, 6)} t + ${formatNumber(analysis.fits.post.intercept, 4)}`,
    `T inicial corregida: ${formatNumber(analysis.results.initialTemp, 4)} C`,
    `T final corregida: ${formatNumber(analysis.results.finalTemp, 4)} C`,
    `Delta T corregido: ${formatNumber(analysis.results.deltaTemp, 4)} C`,
    "",
    `Area inicial: ${formatNumber(analysis.areas.left, 4)} C s`,
    `Area final: ${formatNumber(analysis.areas.right, 4)} C s`,
    `Diferencia de areas: ${formatNumber(analysis.areas.diff, 4)} C s`
  ];
  downloadText(lines.join(`
`), `${fileBaseName()}-resumen.txt`, "text/plain;charset=utf-8");
}
function currentAnalysis() {
  const preFit = fitForRange(points, minT(points), Number(preEnd.value));
  const postFit = fitForRange(points, Number(postStart.value), maxT(points));
  const corrected = Number(correctedTime.value);
  const areas = calculateAreas(points, preFit, postFit, Number(preEnd.value), Number(postStart.value), corrected);
  const initialTemp = evaluate(preFit, corrected);
  const finalTemp = evaluate(postFit, corrected);
  return {
    dataset: {
      id: currentDataset.id,
      name: currentDataset.name,
      description: currentDataset.description
    },
    controls: {
      additionTime: Number(additionTime.value),
      preEnd: Number(preEnd.value),
      postStart: Number(postStart.value),
      correctedTime: corrected
    },
    fits: {
      pre: preFit,
      post: postFit
    },
    results: {
      initialTemp,
      finalTemp,
      deltaTemp: finalTemp - initialTemp
    },
    areas,
    data: points,
    exportedAt: new Date().toISOString()
  };
}
function downloadText(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function fileBaseName() {
  return `calorimetria-${currentDataset.id}`;
}
function svgStyleElement() {
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .axis text,.chart-label{fill:#475467;font-size:12px;font-family:Arial,sans-serif}
    .grid-line{stroke:#e7ebf0;stroke-width:1}
    .axis-line{stroke:#98a2b3;stroke-width:1}
    .data-line{fill:none;stroke:#1f6f8b;stroke-width:2.5}
    .data-point{fill:#247c9f}
    .fit-pre{stroke:#7a5af8;stroke-width:2;stroke-dasharray:7 5}
    .fit-post{stroke:#d94b2b;stroke-width:2;stroke-dasharray:7 5}
    .marker-addition{stroke:#344054;stroke-width:2}
    .marker-corrected{stroke:#1a7f37;stroke-width:2.5}
    .area-left{fill:rgba(122,90,248,.24)}
    .area-right{fill:rgba(217,75,43,.24)}
    .ghost-region{fill:rgba(36,124,159,.06)}
  `;
  return style;
}
function createDatasets() {
  return [
    {
      id: "water",
      name: "Agua fria + agua hirviendo",
      description: "Curva modelo para determinar el equivalente energetico del calorimetro.",
      additionTime: 60,
      preEnd: 46,
      postStart: 92,
      correctedTime: 71,
      points: syntheticCurve({ base: 20.1, drift: -0.001, jump: 16.8, tauRise: 12, tauCool: 0.0045, tAdd: 60 })
    },
    {
      id: "dilution",
      name: "Acido sobre agua",
      description: "Curva modelo para estimar solo el calor de dilucion.",
      additionTime: 55,
      preEnd: 42,
      postStart: 88,
      correctedTime: 65,
      points: syntheticCurve({ base: 20.2, drift: -0.0005, jump: 2.7, tauRise: 10, tauCool: 0.0038, tAdd: 55 })
    },
    {
      id: "neutralization",
      name: "Base + acido",
      description: "Curva modelo con dilucion y neutralizacion.",
      additionTime: 58,
      preEnd: 44,
      postStart: 94,
      correctedTime: 70,
      points: syntheticCurve({ base: 20, drift: -0.0007, jump: 7.9, tauRise: 13, tauCool: 0.0042, tAdd: 58 })
    }
  ];
}
function syntheticCurve(options) {
  const result = [];
  for (let t = 0;t <= 180; t += 4) {
    const before = options.base + options.drift * t;
    const elapsed = Math.max(0, t - options.tAdd);
    const rise = options.jump * (1 - Math.exp(-elapsed / options.tauRise));
    const cooling = Math.exp(-elapsed * options.tauCool);
    const deterministicNoise = Math.sin(t * 0.27) * 0.035 + Math.cos(t * 0.11) * 0.025;
    const temp = t < options.tAdd ? before + deterministicNoise : before + rise * cooling + deterministicNoise;
    result.push({ t, temp: round(temp, 3) });
  }
  return result;
}
function parseCsv(input) {
  const parsed = [];
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed)
      continue;
    const values = trimmed.split(/[;,\t ]+/).map((part) => Number(part.replace(",", ".")));
    const t = values[0];
    const temp = values[1];
    if (typeof t === "number" && typeof temp === "number" && Number.isFinite(t) && Number.isFinite(temp)) {
      parsed.push({ t, temp });
    }
  }
  return parsed.sort((a, b) => a.t - b.t);
}
function toCsv(data) {
  return data.map((point) => `${point.t}, ${point.temp}`).join(`
`);
}
function fitForRange(data, from, to) {
  const selected = data.filter((point) => point.t >= from && point.t <= to);
  const sample = selected.length >= 2 ? selected : data.slice(0, 2);
  const n = sample.length;
  const sumX = sample.reduce((sum, point) => sum + point.t, 0);
  const sumY = sample.reduce((sum, point) => sum + point.temp, 0);
  const sumXY = sample.reduce((sum, point) => sum + point.t * point.temp, 0);
  const sumXX = sample.reduce((sum, point) => sum + point.t * point.t, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  return { slope, intercept: sumY / n - slope * (sumX / n) };
}
function calculateAreas(data, preFit, postFit, preLimit, postLimit, corrected) {
  const left = integrateDifference(data, preFit, postFit, preLimit, corrected, "left");
  const right = integrateDifference(data, preFit, postFit, corrected, postLimit, "right");
  return { left, right, diff: left - right };
}
function integrateDifference(data, preFit, postFit, from, to, side) {
  if (to <= from)
    return 0;
  const samples = sampleData(data, from, to);
  let area = 0;
  for (let index = 1;index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const previousBase = side === "left" ? evaluate(preFit, previous.t) : evaluate(postFit, previous.t);
    const currentBase = side === "left" ? evaluate(preFit, current.t) : evaluate(postFit, current.t);
    const previousDiff = Math.abs(previous.temp - previousBase);
    const currentDiff = Math.abs(current.temp - currentBase);
    area += (previousDiff + currentDiff) / 2 * (current.t - previous.t);
  }
  return area;
}
function findBalancedTime(data, preFit, postFit, preLimit, postLimit) {
  let best = preLimit;
  let bestDiff = Number.POSITIVE_INFINITY;
  const steps = 240;
  for (let index = 0;index <= steps; index += 1) {
    const t = preLimit + (postLimit - preLimit) * index / steps;
    const diff = Math.abs(calculateAreas(data, preFit, postFit, preLimit, postLimit, t).diff);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t;
    }
  }
  return best;
}
function sampleData(data, from, to) {
  const clipped = data.filter((point) => point.t > from && point.t < to);
  return [interpolate(data, from), ...clipped, interpolate(data, to)];
}
function interpolate(data, t) {
  const first = data[0];
  const last = data[data.length - 1];
  if (t <= first.t)
    return { t, temp: first.temp };
  if (t >= last.t)
    return { t, temp: last.temp };
  for (let index = 1;index < data.length; index += 1) {
    const previous = data[index - 1];
    const current = data[index];
    if (t <= current.t) {
      const ratio = (t - previous.t) / (current.t - previous.t);
      return { t, temp: previous.temp + (current.temp - previous.temp) * ratio };
    }
  }
  return { t, temp: last.temp };
}
function makeScale(data) {
  const rect = chart.getBoundingClientRect();
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  const width = mobile ? Math.max(320, Math.round(rect.width || window.innerWidth || 360)) : Math.max(640, Math.round(rect.width || 760));
  const height = mobile ? 310 : Math.max(420, Math.round(rect.height || 520));
  const margin = mobile ? { top: 34, right: 14, bottom: 38, left: 44 } : { top: 42, right: 28, bottom: 46, left: 58 };
  const preFit = fitForRange(data, minT(data), Number(preEnd.value || minT(data)));
  const postFit = fitForRange(data, Number(postStart.value || maxT(data)), maxT(data));
  const minTime = minT(data);
  const maxTime = maxT(data);
  const minTemp = minY(data, preFit, postFit);
  const maxTemp = maxY(data, preFit, postFit);
  return {
    width,
    height,
    mobile,
    margin,
    x: (value) => margin.left + (value - minTime) / (maxTime - minTime) * (width - margin.left - margin.right),
    y: (value) => margin.top + (maxTemp - value) / (maxTemp - minTemp) * (height - margin.top - margin.bottom)
  };
}
function minY(data, preFit, postFit) {
  const values = data.flatMap((point) => [point.temp, evaluate(preFit, point.t), evaluate(postFit, point.t)]);
  return Math.min(...values) - 0.8;
}
function maxY(data, preFit, postFit) {
  const values = data.flatMap((point) => [point.temp, evaluate(preFit, point.t), evaluate(postFit, point.t)]);
  return Math.max(...values) + 0.8;
}
function linePath(data, scale) {
  return data.map((point, index) => `${index === 0 ? "M" : "L"} ${scale.x(point.t)} ${scale.y(point.temp)}`).join(" ");
}
function buildAreaPath(data, preFit, postFit, from, to, scale, side) {
  if (to <= from)
    return "";
  const samples = sampleData(data, from, to);
  const top = samples.map((point, index) => `${index === 0 ? "M" : "L"} ${scale.x(point.t)} ${scale.y(point.temp)}`).join(" ");
  const base = [...samples].reverse().map((point) => {
    const fit = side === "left" ? preFit : postFit;
    return `L ${scale.x(point.t)} ${scale.y(evaluate(fit, point.t))}`;
  }).join(" ");
  return `${top} ${base} Z`;
}
function addGrid(scale, minTime, maxTime, minTemp, maxTemp) {
  const xTicks = ticks(minTime, maxTime, scale.mobile ? 3 : 6);
  const yTicks = ticks(minTemp, maxTemp, scale.mobile ? 4 : 6);
  for (const tick of xTicks) {
    const x = scale.x(tick);
    addLine(x, scale.margin.top, x, scale.height - scale.margin.bottom, "grid-line");
    addText(x, scale.height - scale.margin.bottom + 24, formatNumber(tick, 0), "chart-label tick-label", "middle");
  }
  for (const tick of yTicks) {
    const y = scale.y(tick);
    addLine(scale.margin.left, y, scale.width - scale.margin.right, y, "grid-line");
    addText(scale.margin.left - 8, y + 4, formatNumber(tick, 1), "chart-label tick-label", "end");
  }
  addLine(scale.margin.left, scale.margin.top, scale.margin.left, scale.height - scale.margin.bottom, "axis-line");
  addLine(scale.margin.left, scale.height - scale.margin.bottom, scale.width - scale.margin.right, scale.height - scale.margin.bottom, "axis-line");
}
function addPath(d, className) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("class", className);
  chart.append(path);
}
function addAreaPath(className, d) {
  if (!d)
    return;
  addPath(d, className);
}
function addPoints(data, scale) {
  for (const point of data) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(scale.x(point.t)));
    circle.setAttribute("cy", String(scale.y(point.temp)));
    circle.setAttribute("r", "2.4");
    circle.setAttribute("class", "data-point");
    chart.append(circle);
  }
}
function addLine(x1, y1, x2, y2, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.setAttribute("class", className);
  chart.append(line);
}
function addRect(x, y, width, height, className) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(Math.max(0, width)));
  rect.setAttribute("height", String(Math.max(0, height)));
  rect.setAttribute("class", className);
  chart.append(rect);
}
function addText(x, y, value, className, anchor = "start") {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(x));
  text.setAttribute("y", String(y));
  text.setAttribute("text-anchor", anchor);
  text.setAttribute("class", className);
  text.textContent = value;
  chart.append(text);
}
function ticks(min, max, count) {
  const result = [];
  for (let index = 0;index <= count; index += 1) {
    result.push(min + (max - min) * index / count);
  }
  return result;
}
function evaluate(fit, t) {
  return fit.slope * t + fit.intercept;
}
function minT(data) {
  return Math.min(...data.map((point) => point.t));
}
function maxT(data) {
  return Math.max(...data.map((point) => point.t));
}
function span(data) {
  return maxT(data) - minT(data);
}
function medianTime(data) {
  return minT(data) + span(data) / 2;
}
function innerHeight(scale) {
  return scale.height - scale.margin.top - scale.margin.bottom;
}
function invertX(x, scale) {
  const domainMin = minT(points);
  const domainMax = maxT(points);
  const ratio = (x - scale.margin.left) / (scale.width - scale.margin.left - scale.margin.right);
  return domainMin + ratio * (domainMax - domainMin);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function roundToStep(value, step) {
  return Math.round(value / step) * step;
}
function formatNumber(value, digits) {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
function mustElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Falta el elemento #${id}`);
  }
  return element;
}
