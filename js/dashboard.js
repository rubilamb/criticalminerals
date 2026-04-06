/* ===== Critical Minerals Dashboard — Main JS ===== */

(function () {
  'use strict';

  const DATA_PATH = 'data/comtrade_crm_summary.csv';
  const BILATERAL_PATH = 'data/comtrade_crm_bilateral.csv';
  const FLOWS_PATH = 'data/comtrade_crm_flows.csv';
  const RE_MINERALS = ['Lithium', 'Cobalt', 'Copper', 'Nickel', 'Rare earths', 'Silicon metal', 'Manganese'];

  const PLOTLY_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7', '#ef4444', '#0ea5e9', '#d97706'
  ];
  const PLOTLY_LAYOUT_BASE = {
    font: { family: "'Inter', sans-serif", color: '#1a1a2e' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 60, r: 30, t: 10, b: 50 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
    xaxis: { gridcolor: '#e2e4ec', linecolor: '#e2e4ec' },
    yaxis: { gridcolor: '#e2e4ec', linecolor: '#e2e4ec' }
  };
  const PLOTLY_CONFIG = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  };

  /* ---------- State ---------- */
  let rawData = [];
  let bilateralData = [];
  let flowsData = [];
  let minerals = [];
  let years = [];
  let fullYears = [];

  /* ---------- Helpers ---------- */
  function formatUSD(val) {
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    return '$' + val.toLocaleString();
  }

  function formatWeight(val) {
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B kg';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M kg';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K kg';
    return val.toFixed(0) + ' kg';
  }

  function pctChange(current, previous) {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  }

  function filterData(opts) {
    return rawData.filter(function (d) {
      if (opts.mineral && d.mineral !== opts.mineral) return false;
      if (opts.flow && d.flow !== opts.flow) return false;
      if (opts.year && d.year !== opts.year) return false;
      if (opts.yearMin && d.year < opts.yearMin) return false;
      if (opts.yearMax && d.year > opts.yearMax) return false;
      return true;
    });
  }

  /* ---------- Data Loading ---------- */
  function parseCSV(path) {
    return new Promise(function (resolve, reject) {
      Papa.parse(path, {
        download: true,
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: function (results) { resolve(results.data); },
        error: function (err) { reject(err); }
      });
    });
  }

  function loadData() {
    return Promise.all([
      parseCSV(DATA_PATH),
      parseCSV(BILATERAL_PATH),
      parseCSV(FLOWS_PATH)
    ]).then(function (results) {
      // Summary data
      rawData = results[0].map(function (r) {
        return {
          mineral: r.mineral,
          year: parseInt(r.year, 10),
          flow: r.flow,
          reporters: parseInt(r.n_reporters, 10),
          value: parseFloat(r.total_value_usd),
          weight: parseFloat(r.total_weight_kg)
        };
      }).filter(function (d) { return !isNaN(d.year) && !isNaN(d.value); });

      // Bilateral partner data
      bilateralData = results[1].map(function (r) {
        return {
          mineral: r.mineral,
          year: parseInt(r.year, 10),
          flow: r.flow,
          countryIso: r.country_iso,
          country: r.country,
          value: parseFloat(r.trade_value_usd),
          weight: parseFloat(r.net_weight_kg)
        };
      }).filter(function (d) { return !isNaN(d.year) && !isNaN(d.value); });

      // Bilateral flows (importer → exporter)
      flowsData = results[2].map(function (r) {
        return {
          mineral: r.mineral,
          year: parseInt(r.year, 10),
          importerIso: r.importer_iso,
          importer: r.importer,
          exporterIso: r.exporter_iso,
          exporter: r.exporter,
          value: parseFloat(r.trade_value_usd),
          weight: parseFloat(r.net_weight_kg)
        };
      }).filter(function (d) { return !isNaN(d.year) && !isNaN(d.value); });

      minerals = Array.from(new Set(rawData.map(function (d) { return d.mineral; }))).sort();
      years = Array.from(new Set(rawData.map(function (d) { return d.year; }))).sort();

      // Detect partial years
      var maxReporters = 0;
      rawData.forEach(function (d) { if (d.reporters > maxReporters) maxReporters = d.reporters; });
      var latestYear = years[years.length - 1];
      var latestReporters = rawData.filter(function (d) { return d.year === latestYear; });
      var avgLatest = latestReporters.reduce(function (s, d) { return s + d.reporters; }, 0) / (latestReporters.length || 1);
      fullYears = avgLatest < maxReporters * 0.5 ? years.slice(0, -1) : years.slice();
    });
  }

  /* ---------- KPI Cards ---------- */
  function renderKPIs(selectedYear) {
    var yr = selectedYear || fullYears[fullYears.length - 1];
    var prev = yr - 1;

    var yrData = filterData({ yearMin: yr, yearMax: yr });
    var prevData = filterData({ yearMin: prev, yearMax: prev });

    var totalImport = yrData.filter(function (d) { return d.flow === 'Import'; }).reduce(function (s, d) { return s + d.value; }, 0);
    var totalExport = yrData.filter(function (d) { return d.flow === 'Export'; }).reduce(function (s, d) { return s + d.value; }, 0);
    var deficit = totalImport - totalExport;
    var mineralCount = new Set(yrData.map(function (d) { return d.mineral; })).size;

    var prevImport = prevData.filter(function (d) { return d.flow === 'Import'; }).reduce(function (s, d) { return s + d.value; }, 0);
    var prevExport = prevData.filter(function (d) { return d.flow === 'Export'; }).reduce(function (s, d) { return s + d.value; }, 0);
    var prevDeficit = prevImport - prevExport;

    var impChange = pctChange(totalImport, prevImport);
    var expChange = pctChange(totalExport, prevExport);
    var defChange = pctChange(deficit, prevDeficit);

    setKPI('kpi-imports', formatUSD(totalImport), impChange);
    setKPI('kpi-exports', formatUSD(totalExport), expChange);
    setKPI('kpi-deficit', formatUSD(Math.abs(deficit)), defChange, deficit >= 0 ? 'Deficit' : 'Surplus');
    setKPI('kpi-minerals', mineralCount, null);
  }

  function setKPI(id, value, change, overrideLabel) {
    var card = document.getElementById(id);
    if (!card) return;
    card.querySelector('.kpi-value').textContent = value;
    if (overrideLabel) card.querySelector('.kpi-label').textContent = overrideLabel;
    var changeEl = card.querySelector('.kpi-change');
    if (change !== null && change !== undefined) {
      var sign = change >= 0 ? '+' : '';
      changeEl.textContent = sign + change.toFixed(1) + '% vs prior year';
      changeEl.className = 'kpi-change ' + (change >= 0 ? 'positive' : 'negative');
    } else {
      changeEl.textContent = '';
    }
  }

  /* ---------- Chart 1: Trade Overview (line) ---------- */
  function renderTradeOverview() {
    var importByYear = {};
    var exportByYear = {};
    fullYears.forEach(function (y) { importByYear[y] = 0; exportByYear[y] = 0; });

    rawData.forEach(function (d) {
      if (fullYears.indexOf(d.year) === -1) return;
      if (d.flow === 'Import') importByYear[d.year] += d.value;
      else exportByYear[d.year] += d.value;
    });

    var traces = [
      {
        x: fullYears,
        y: fullYears.map(function (y) { return importByYear[y]; }),
        name: 'Imports',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#2563eb', width: 2.5 },
        marker: { size: 5 },
        hovertemplate: 'Imports: %{y:$,.0f}<extra></extra>'
      },
      {
        x: fullYears,
        y: fullYears.map(function (y) { return exportByYear[y]; }),
        name: 'Exports',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#16a34a', width: 2.5 },
        marker: { size: 5 },
        hovertemplate: 'Exports: %{y:$,.0f}<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { title: 'Trade Value (USD)' })
    });

    Plotly.newPlot('chart-overview', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 2: Mineral Explorer ---------- */
  function renderMineralExplorer(mineral) {
    var data = filterData({ mineral: mineral }).filter(function (d) {
      return fullYears.indexOf(d.year) !== -1;
    });

    var importData = data.filter(function (d) { return d.flow === 'Import'; }).sort(function (a, b) { return a.year - b.year; });
    var exportData = data.filter(function (d) { return d.flow === 'Export'; }).sort(function (a, b) { return a.year - b.year; });

    var traces = [
      {
        x: importData.map(function (d) { return d.year; }),
        y: importData.map(function (d) { return d.value; }),
        name: 'Import Value',
        type: 'bar',
        marker: { color: '#2563eb', opacity: 0.7 },
        hovertemplate: 'Import: %{y:$,.0f}<extra></extra>'
      },
      {
        x: exportData.map(function (d) { return d.year; }),
        y: exportData.map(function (d) { return d.value; }),
        name: 'Export Value',
        type: 'bar',
        marker: { color: '#16a34a', opacity: 0.7 },
        hovertemplate: 'Export: %{y:$,.0f}<extra></extra>'
      },
      {
        x: importData.map(function (d) { return d.year; }),
        y: importData.map(function (d) { return d.weight; }),
        name: 'Import Weight',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2',
        line: { color: '#f59e0b', width: 2, dash: 'dot' },
        marker: { size: 4 },
        hovertemplate: 'Weight: %{y:,.0f} kg<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      barmode: 'group',
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { title: 'Value (USD)' }),
      yaxis2: {
        title: 'Weight (kg)',
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)',
        linecolor: '#e2e4ec'
      },
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    Plotly.newPlot('chart-mineral', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 3: Top Minerals Bar ---------- */
  function renderTopMinerals(year, flow) {
    var data = filterData({ year: year, flow: flow });
    data.sort(function (a, b) { return b.value - a.value; });
    var top = data.slice(0, 12);

    var traces = [{
      y: top.map(function (d) { return d.mineral; }).reverse(),
      x: top.map(function (d) { return d.value; }).reverse(),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: top.map(function (_, i) { return PLOTLY_COLORS[i % PLOTLY_COLORS.length]; }).reverse()
      },
      hovertemplate: '%{y}: %{x:$,.0f}<extra></extra>'
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 130, r: 30, t: 10, b: 40 },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { title: 'Trade Value (USD)' }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true })
    });

    Plotly.newPlot('chart-top', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 4: Trade Balance Heatmap ---------- */
  function renderHeatmap() {
    var balanceMap = {};
    rawData.forEach(function (d) {
      if (fullYears.indexOf(d.year) === -1) return;
      var key = d.mineral + '|' + d.year;
      if (!balanceMap[key]) balanceMap[key] = { mineral: d.mineral, year: d.year, imp: 0, exp: 0 };
      if (d.flow === 'Import') balanceMap[key].imp += d.value;
      else balanceMap[key].exp += d.value;
    });

    var entries = Object.values(balanceMap);
    entries.forEach(function (e) { e.balance = e.exp - e.imp; });

    var mineralAvg = {};
    minerals.forEach(function (m) { mineralAvg[m] = 0; });
    entries.forEach(function (e) {
      mineralAvg[e.mineral] = (mineralAvg[e.mineral] || 0) + e.balance;
    });
    var sortedMinerals = minerals.slice().sort(function (a, b) { return mineralAvg[a] - mineralAvg[b]; });

    var zData = [];
    var hoverText = [];
    sortedMinerals.forEach(function (m) {
      var row = [];
      var hoverRow = [];
      fullYears.forEach(function (y) {
        var entry = entries.find(function (e) { return e.mineral === m && e.year === y; });
        var val = entry ? entry.balance : 0;
        row.push(val);
        hoverRow.push(m + ' (' + y + '): ' + formatUSD(Math.abs(val)) + (val >= 0 ? ' surplus' : ' deficit'));
      });
      zData.push(row);
      hoverText.push(hoverRow);
    });

    var traces = [{
      z: zData,
      x: fullYears,
      y: sortedMinerals,
      type: 'heatmap',
      colorscale: [
        [0, '#dc2626'],
        [0.5, '#fef9c3'],
        [1, '#16a34a']
      ],
      zmid: 0,
      text: hoverText,
      hoverinfo: 'text',
      colorbar: {
        title: { text: 'Balance (USD)', side: 'right' },
        thickness: 12,
        len: 0.8
      }
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 130, r: 80, t: 10, b: 50 },
      yaxis: { automargin: true, dtick: 1, tickfont: { size: 10 } }
    });

    Plotly.newPlot('chart-heatmap', traces, layout, PLOTLY_CONFIG);
  }

  /* ========================================================
     RENEWABLE ENERGY MINERALS — Trading Partners Section
     ======================================================== */

  /* ---------- Chart 5: Top Exporters (horizontal bar) ---------- */
  function renderTopExporters(mineral, year) {
    var data = bilateralData.filter(function (d) {
      return d.mineral === mineral && d.year === year && d.flow === 'Export' && d.country !== 'Others';
    });
    data.sort(function (a, b) { return b.value - a.value; });
    var top = data.slice(0, 10);

    var traces = [{
      y: top.map(function (d) { return d.country; }).reverse(),
      x: top.map(function (d) { return d.value; }).reverse(),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: top.map(function (_, i) { return PLOTLY_COLORS[i % PLOTLY_COLORS.length]; }).reverse()
      },
      hovertemplate: '%{y}: %{x:$,.0f}<extra></extra>'
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 140, r: 30, t: 10, b: 40 },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { title: 'Export Value (USD)' }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true }),
      hovermode: 'closest'
    });

    Plotly.newPlot('chart-top-exporters', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 6: Top Importers (horizontal bar) ---------- */
  function renderTopImporters(mineral, year) {
    var data = bilateralData.filter(function (d) {
      return d.mineral === mineral && d.year === year && d.flow === 'Import' && d.country !== 'Others';
    });
    data.sort(function (a, b) { return b.value - a.value; });
    var top = data.slice(0, 10);

    var traces = [{
      y: top.map(function (d) { return d.country; }).reverse(),
      x: top.map(function (d) { return d.value; }).reverse(),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: top.map(function (_, i) { return PLOTLY_COLORS[i % PLOTLY_COLORS.length]; }).reverse()
      },
      hovertemplate: '%{y}: %{x:$,.0f}<extra></extra>'
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 140, r: 30, t: 10, b: 40 },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { title: 'Import Value (USD)' }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true }),
      hovermode: 'closest'
    });

    Plotly.newPlot('chart-top-importers', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 7: Trade Flow Sankey (exporter → importer) ---------- */
  function renderSankey(mineral, year) {
    var data = flowsData.filter(function (d) {
      return d.mineral === mineral && d.year === year;
    });
    data.sort(function (a, b) { return b.value - a.value; });
    var top = data.slice(0, 25);

    if (top.length === 0) {
      Plotly.purge('chart-sankey');
      document.getElementById('chart-sankey').innerHTML =
        '<p style="text-align:center;color:#8b8da3;padding:2rem">No bilateral flow data for this selection.</p>';
      return;
    }

    // Build node list: exporters on left, importers on right
    var nodeMap = {};
    var nodes = [];
    function getNode(name, side) {
      var key = side + ':' + name;
      if (nodeMap[key] === undefined) {
        nodeMap[key] = nodes.length;
        nodes.push({ label: name, side: side });
      }
      return nodeMap[key];
    }

    var sources = [];
    var targets = [];
    var values = [];
    var linkColors = [];

    top.forEach(function (d, i) {
      var srcIdx = getNode(d.exporter, 'exporter');
      var tgtIdx = getNode(d.importer, 'importer');
      sources.push(srcIdx);
      targets.push(tgtIdx);
      values.push(d.value);
      var c = PLOTLY_COLORS[i % PLOTLY_COLORS.length];
      linkColors.push(c.replace(')', ',0.35)').replace('rgb', 'rgba').replace('#', ''));
    });

    // Convert hex colors to rgba for links
    var linkRGBA = top.map(function (_, i) {
      var hex = PLOTLY_COLORS[i % PLOTLY_COLORS.length];
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',0.4)';
    });

    var nodeColors = nodes.map(function (n) {
      return n.side === 'exporter' ? '#2563eb' : '#dc2626';
    });

    var traces = [{
      type: 'sankey',
      orientation: 'h',
      node: {
        pad: 12,
        thickness: 18,
        line: { color: '#e2e4ec', width: 0.5 },
        label: nodes.map(function (n) { return n.label; }),
        color: nodeColors,
        hovertemplate: '%{label}: %{value:$,.0f}<extra></extra>'
      },
      link: {
        source: sources,
        target: targets,
        value: values,
        color: linkRGBA,
        hovertemplate: '%{source.label} → %{target.label}: %{value:$,.0f}<extra></extra>'
      }
    }];

    var layout = {
      font: { family: "'Inter', sans-serif", color: '#1a1a2e', size: 11 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 10, r: 10, t: 10, b: 10 }
    };

    Plotly.newPlot('chart-sankey', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Controls / Wiring ---------- */
  function populateFilters() {
    var selMineral = document.getElementById('filter-mineral');
    minerals.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      selMineral.appendChild(opt);
    });
    selMineral.value = minerals.indexOf('Lithium') !== -1 ? 'Lithium' : minerals[0];

    var selYear = document.getElementById('filter-year');
    fullYears.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      selYear.appendChild(opt);
    });
    selYear.value = fullYears[fullYears.length - 1];

    var selFlow = document.getElementById('filter-flow');
    selFlow.value = 'Import';

    // Panel-level mineral selector
    var panelMineral = document.getElementById('panel-mineral-select');
    minerals.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      panelMineral.appendChild(opt);
    });
    panelMineral.value = selMineral.value;

    // RE mineral selector for trading partners section
    var reMineral = document.getElementById('re-mineral-select');
    RE_MINERALS.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      reMineral.appendChild(opt);
    });
    reMineral.value = 'Lithium';

    var reYear = document.getElementById('re-year-select');
    fullYears.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      reYear.appendChild(opt);
    });
    reYear.value = fullYears[fullYears.length - 1];
  }

  function renderTradingPartners() {
    var mineral = document.getElementById('re-mineral-select').value;
    var year = parseInt(document.getElementById('re-year-select').value, 10);
    renderTopExporters(mineral, year);
    renderTopImporters(mineral, year);
    renderSankey(mineral, year);
  }

  function bindEvents() {
    var selMineral = document.getElementById('filter-mineral');
    var panelMineral = document.getElementById('panel-mineral-select');
    var selYear = document.getElementById('filter-year');
    var selFlow = document.getElementById('filter-flow');

    selMineral.addEventListener('change', function () {
      panelMineral.value = selMineral.value;
      renderMineralExplorer(selMineral.value);
    });

    panelMineral.addEventListener('change', function () {
      selMineral.value = panelMineral.value;
      renderMineralExplorer(panelMineral.value);
    });

    selYear.addEventListener('change', function () {
      var yr = parseInt(selYear.value, 10);
      renderKPIs(yr);
      renderTopMinerals(yr, selFlow.value);
    });

    selFlow.addEventListener('change', function () {
      renderTopMinerals(parseInt(selYear.value, 10), selFlow.value);
    });

    // RE trading partners controls
    document.getElementById('re-mineral-select').addEventListener('change', renderTradingPartners);
    document.getElementById('re-year-select').addEventListener('change', renderTradingPartners);
  }

  /* ---------- Init ---------- */
  function init() {
    loadData().then(function () {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'block';

      populateFilters();
      bindEvents();

      var latestFull = fullYears[fullYears.length - 1];
      renderKPIs(latestFull);
      renderTradeOverview();
      renderMineralExplorer(document.getElementById('filter-mineral').value);
      renderTopMinerals(latestFull, 'Import');
      renderHeatmap();
      renderTradingPartners();

      // Update header meta
      document.getElementById('data-period').textContent =
        'Data: ' + years[0] + '–' + years[years.length - 1] +
        ' | ' + minerals.length + ' minerals | Last updated: ' + new Date().toLocaleDateString();
    }).catch(function (err) {
      document.getElementById('loading').innerHTML =
        '<p style="color:#dc2626">Failed to load data. Check console.</p>';
      console.error(err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
