/* ===== Critical Minerals Dashboard — Main JS ===== */

(function () {
  'use strict';

  const DATA_PATH = 'data/comtrade_crm_summary.csv';
  const BILATERAL_PATH = 'data/comtrade_crm_bilateral.csv';
  const FLOWS_PATH = 'data/comtrade_crm_flows.csv';
  const COUNTRY_TS_PATH = 'data/comtrade_crm_country_ts.csv';

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
  var rawData = [];
  var bilateralData = [];
  var flowsData = [];
  var countryTsData = [];
  var minerals = [];
  var years = [];
  var fullYears = [];

  /* ---------- Helpers ---------- */
  function formatUSD(val) {
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(val).toLocaleString();
  }

  function formatVolume(val) {
    if (val >= 1e12) return (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
    return val.toFixed(0);
  }

  function pctChange(current, previous) {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
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
      parseCSV(FLOWS_PATH),
      parseCSV(COUNTRY_TS_PATH)
    ]).then(function (results) {
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

      countryTsData = results[3].map(function (r) {
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
  function renderKPIs() {
    var yr = parseInt(document.getElementById('filter-year').value, 10);
    var flow = document.getElementById('filter-flow').value;
    var prev = yr - 1;

    var yrData = rawData.filter(function (d) { return d.year === yr && d.flow === flow; });
    var prevData = rawData.filter(function (d) { return d.year === prev && d.flow === flow; });

    var totalValue = yrData.reduce(function (s, d) { return s + d.value; }, 0);
    var prevValue = prevData.reduce(function (s, d) { return s + d.value; }, 0);

    var valChange = pctChange(totalValue, prevValue);

    var label = flow === 'Import' ? 'Total Import Value' : 'Total Export Value';

    setKPI('kpi-total', label, formatUSD(totalValue), valChange);
  }

  function setKPI(id, label, value, change) {
    var card = document.getElementById(id);
    if (!card) return;
    card.querySelector('.kpi-label').textContent = label;
    card.querySelector('.kpi-value').textContent = value;
    var changeEl = card.querySelector('.kpi-change');
    if (change !== null && change !== undefined) {
      var sign = change >= 0 ? '+' : '';
      changeEl.textContent = sign + change.toFixed(1) + '% vs prior year';
      changeEl.className = 'kpi-change ' + (change >= 0 ? 'positive' : 'negative');
    } else {
      changeEl.textContent = '';
    }
  }

  /* ---------- Chart 1: Trade Overview — selected mineral vs others ---------- */
  function renderTradeOverview() {
    var flow = document.getElementById('filter-flow').value;
    var mineral = document.getElementById('filter-mineral').value;
    var flowLabel = flow === 'Import' ? 'Imports' : 'Exports';

    var selectedByYear = {};
    var othersByYear = {};
    fullYears.forEach(function (y) { selectedByYear[y] = 0; othersByYear[y] = 0; });

    rawData.forEach(function (d) {
      if (fullYears.indexOf(d.year) === -1) return;
      if (d.flow !== flow) return;
      if (d.mineral === mineral) {
        selectedByYear[d.year] += d.value;
      } else {
        othersByYear[d.year] += d.value;
      }
    });

    // Compute share %
    var shareText = fullYears.map(function (y) {
      var total = selectedByYear[y] + othersByYear[y];
      var pct = total > 0 ? (selectedByYear[y] / total * 100).toFixed(1) : '0.0';
      return pct + '% share';
    });

    var traces = [
      {
        x: fullYears,
        y: fullYears.map(function (y) { return selectedByYear[y]; }),
        name: mineral,
        type: 'scatter',
        mode: 'lines',
        stackgroup: 'one',
        line: { color: '#2563eb', width: 0 },
        fillcolor: 'rgba(37,99,235,0.6)',
        text: shareText,
        hovertemplate: mineral + ': %{y:$,.0f} (%{text})<extra></extra>'
      },
      {
        x: fullYears,
        y: fullYears.map(function (y) { return othersByYear[y]; }),
        name: 'Other minerals',
        type: 'scatter',
        mode: 'lines',
        stackgroup: 'one',
        line: { color: '#e2e4ec', width: 0 },
        fillcolor: 'rgba(203,213,225,0.5)',
        hovertemplate: 'Others: %{y:$,.0f}<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { title: 'Trade Value (USD)' }),
      hovermode: 'x unified'
    });

    document.getElementById('overview-subtitle').textContent =
      mineral + ' share of total ' + flowLabel.toLowerCase() + ' value';

    Plotly.newPlot('chart-overview', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 2: Mineral Explorer ---------- */
  function renderMineralExplorer() {
    var mineral = document.getElementById('panel-mineral-select').value;
    var flow = document.getElementById('filter-flow').value;
    var flowLabel = flow === 'Import' ? 'Import' : 'Export';

    var data = rawData.filter(function (d) {
      return d.mineral === mineral && d.flow === flow && fullYears.indexOf(d.year) !== -1;
    }).sort(function (a, b) { return a.year - b.year; });

    var traces = [
      {
        x: data.map(function (d) { return d.year; }),
        y: data.map(function (d) { return d.value; }),
        name: flowLabel + ' Value',
        type: 'bar',
        marker: { color: flow === 'Import' ? '#2563eb' : '#16a34a', opacity: 0.7 },
        hovertemplate: flowLabel + ': %{y:$,.0f}<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { title: 'Value (USD)' }),
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    document.getElementById('mineral-subtitle').textContent =
      flowLabel + ' value trends for ' + mineral;

    Plotly.newPlot('chart-mineral', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 3: Top Minerals Bar ---------- */
  function renderTopMinerals() {
    var year = parseInt(document.getElementById('filter-year').value, 10);
    var flow = document.getElementById('filter-flow').value;
    var flowLabel = flow === 'Import' ? 'Imports' : 'Exports';

    var data = rawData.filter(function (d) { return d.year === year && d.flow === flow; });
    data.sort(function (a, b) { return b.value - a.value; });

    var traces = [{
      y: data.map(function (d) { return d.mineral; }).reverse(),
      x: data.map(function (d) { return d.value; }).reverse(),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: data.map(function (_, i) { return PLOTLY_COLORS[i % PLOTLY_COLORS.length]; }).reverse()
      },
      hovertemplate: '%{y}: %{x:$,.0f}<extra></extra>'
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 130, r: 30, t: 10, b: 40 },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { title: 'Trade Value (USD)' }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true }),
      hovermode: 'closest'
    });

    document.getElementById('top-subtitle').textContent =
      flowLabel + ' ranked by value (' + year + ')';

    Plotly.newPlot('chart-top', traces, layout, PLOTLY_CONFIG);
  }

  /* ========================================================
     TRADING PARTNERS SECTION
     ======================================================== */

  function getTPFilters() {
    return {
      mineral: document.getElementById('tp-mineral-select').value,
      year: parseInt(document.getElementById('tp-year-select').value, 10),
      flow: document.getElementById('tp-flow-select').value
    };
  }

  /* ---------- Chart 4: Top Countries (horizontal bar) ---------- */
  function renderTopCountries() {
    var f = getTPFilters();
    var flowLabel = f.flow === 'Import' ? 'Importing' : 'Exporting';

    var data = bilateralData.filter(function (d) {
      return d.mineral === f.mineral && d.year === f.year && d.flow === f.flow && d.country !== 'Others';
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
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { title: f.flow + ' Value (USD)' }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true }),
      hovermode: 'closest'
    });

    document.getElementById('top-countries-title').textContent = 'Top ' + flowLabel + ' Countries';
    document.getElementById('top-countries-subtitle').textContent =
      f.mineral + ' — ' + f.year + ' — by ' + f.flow.toLowerCase() + ' value';

    Plotly.newPlot('chart-top-countries', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 5: Market Share (pie/donut) ---------- */
  function renderMarketShare() {
    var f = getTPFilters();
    var flowLabel = f.flow === 'Import' ? 'Import' : 'Export';

    var data = bilateralData.filter(function (d) {
      return d.mineral === f.mineral && d.year === f.year && d.flow === f.flow;
    });
    data.sort(function (a, b) { return b.value - a.value; });

    // Top 8 + Others
    var top = data.slice(0, 8);
    var othersVal = data.slice(8).reduce(function (s, d) { return s + d.value; }, 0);
    var labels = top.map(function (d) { return d.country; });
    var values = top.map(function (d) { return d.value; });
    if (othersVal > 0) {
      labels.push('Others');
      values.push(othersVal);
    }

    var traces = [{
      labels: labels,
      values: values,
      type: 'pie',
      hole: 0.45,
      marker: { colors: PLOTLY_COLORS },
      textinfo: 'label+percent',
      textposition: 'outside',
      hovertemplate: '%{label}: %{value:$,.0f} (%{percent})<extra></extra>',
      sort: false
    }];

    var layout = {
      font: { family: "'Inter', sans-serif", color: '#1a1a2e', size: 11 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 20, r: 20, t: 10, b: 10 },
      showlegend: false
    };

    document.getElementById('share-title').textContent = flowLabel + ' Market Share';
    document.getElementById('share-subtitle').textContent =
      f.mineral + ' — ' + f.year + ' — country concentration';

    Plotly.newPlot('chart-share', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 6: Sankey Trade Flows ---------- */
  function renderSankey() {
    var f = getTPFilters();

    var data = flowsData.filter(function (d) {
      return d.mineral === f.mineral && d.year === f.year;
    });
    data.sort(function (a, b) { return b.value - a.value; });
    var top = data.slice(0, 25);

    if (top.length === 0) {
      Plotly.purge('chart-sankey');
      document.getElementById('chart-sankey').innerHTML =
        '<p style="text-align:center;color:#8b8da3;padding:2rem">No bilateral flow data for this selection.</p>';
      return;
    }

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

    top.forEach(function (d) {
      var srcIdx = getNode(d.exporter, 'exporter');
      var tgtIdx = getNode(d.importer, 'importer');
      sources.push(srcIdx);
      targets.push(tgtIdx);
      values.push(d.value);
    });

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

  /* ---------- Chart 7: Country Time Series ---------- */
  function renderCountryTimeSeries() {
    var f = getTPFilters();
    var country = document.getElementById('country-select').value;
    var countryFlow = document.getElementById('country-flow-select').value;
    var flowLabel = countryFlow === 'Import' ? 'Imports' : 'Exports';

    var data = countryTsData.filter(function (d) {
      return d.mineral === f.mineral && d.country === country && d.flow === countryFlow;
    }).sort(function (a, b) { return a.year - b.year; });

    var traces = [
      {
        x: data.map(function (d) { return d.year; }),
        y: data.map(function (d) { return d.value; }),
        name: flowLabel + ' Value',
        type: 'bar',
        marker: { color: countryFlow === 'Import' ? '#2563eb' : '#16a34a', opacity: 0.7 },
        hovertemplate: flowLabel + ': %{y:$,.0f}<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { title: 'Value (USD)' }),
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    document.getElementById('country-ts-subtitle').textContent =
      country + ' — ' + f.mineral + ' ' + flowLabel.toLowerCase() + ' over time';

    Plotly.newPlot('chart-country-ts', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Populate country selector based on current mineral ---------- */
  function populateCountrySelect() {
    var f = getTPFilters();
    var countryFlow = document.getElementById('country-flow-select').value;

    // Get countries that have data for this mineral + flow
    var countries = {};
    countryTsData.forEach(function (d) {
      if (d.mineral === f.mineral && d.flow === countryFlow) {
        if (!countries[d.country]) countries[d.country] = 0;
        countries[d.country] += d.value;
      }
    });

    // Sort by total value descending
    var sorted = Object.keys(countries).sort(function (a, b) { return countries[b] - countries[a]; });

    var sel = document.getElementById('country-select');
    var prev = sel.value;
    sel.innerHTML = '';
    sorted.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });

    // Try to keep previous selection
    if (sorted.indexOf(prev) !== -1) {
      sel.value = prev;
    } else if (sorted.length > 0) {
      sel.value = sorted[0];
    }
  }

  /* ---------- Controls / Wiring ---------- */
  function populateFilters() {
    // Main filters
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

    // Panel mineral selector
    var panelMineral = document.getElementById('panel-mineral-select');
    minerals.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      panelMineral.appendChild(opt);
    });
    panelMineral.value = selMineral.value;

    // Trading partners filters
    var tpMineral = document.getElementById('tp-mineral-select');
    minerals.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      tpMineral.appendChild(opt);
    });
    tpMineral.value = 'Lithium';

    var tpYear = document.getElementById('tp-year-select');
    fullYears.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      tpYear.appendChild(opt);
    });
    tpYear.value = fullYears[fullYears.length - 1];

    // Populate country selector
    populateCountrySelect();
  }

  function renderTradeSection() {
    renderKPIs();
    renderTradeOverview();
    renderMineralExplorer();
    renderTopMinerals();
  }

  function renderTradingPartners() {
    renderTopCountries();
    renderMarketShare();
    renderSankey();
    populateCountrySelect();
    renderCountryTimeSeries();
  }

  function bindEvents() {
    var selMineral = document.getElementById('filter-mineral');
    var panelMineral = document.getElementById('panel-mineral-select');
    var selYear = document.getElementById('filter-year');
    var selFlow = document.getElementById('filter-flow');

    selMineral.addEventListener('change', function () {
      panelMineral.value = selMineral.value;
      renderTradeOverview();
      renderMineralExplorer();
    });

    panelMineral.addEventListener('change', function () {
      selMineral.value = panelMineral.value;
      renderTradeOverview();
      renderMineralExplorer();
    });

    selYear.addEventListener('change', function () {
      renderKPIs();
      renderTopMinerals();
    });

    selFlow.addEventListener('change', function () {
      renderTradeSection();
    });

    // Trading partners controls
    document.getElementById('tp-mineral-select').addEventListener('change', renderTradingPartners);
    document.getElementById('tp-year-select').addEventListener('change', renderTradingPartners);
    document.getElementById('tp-flow-select').addEventListener('change', renderTradingPartners);

    // Country time series controls
    document.getElementById('country-select').addEventListener('change', renderCountryTimeSeries);
    document.getElementById('country-flow-select').addEventListener('change', function () {
      populateCountrySelect();
      renderCountryTimeSeries();
    });
  }

  /* ---------- Init ---------- */
  function init() {
    loadData().then(function () {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'block';

      populateFilters();
      bindEvents();

      renderTradeSection();
      renderTradingPartners();

      document.getElementById('data-period').textContent =
        'Data: ' + years[0] + '–' + years[years.length - 1] +
        ' | ' + minerals.length + ' minerals | Source: UN Comtrade';
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
