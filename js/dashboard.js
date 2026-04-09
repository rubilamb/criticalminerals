/* ===== Critical Minerals Dashboard — Main JS ===== */

(function () {
  'use strict';

  const DATA_PATH = 'data/comtrade_crm_summary.csv';
  const BILATERAL_PATH = 'data/comtrade_crm_bilateral.csv';
  const FLOWS_PATH = 'data/comtrade_crm_flows.csv';
  const COUNTRY_TS_PATH = 'data/comtrade_crm_country_ts.csv';
  const PRICES_MONTHLY_PATH = 'data/imf_crm_prices_monthly.csv';
  const PRICES_ANNUAL_PATH = 'data/imf_crm_prices_annual.csv';

  const MINERAL_COLORS = {
    'Lithium':       '#2ca02c',
    'Cobalt':        '#e67e22',
    'Copper':        '#1f77b4',
    'Nickel':        '#9467bd',
    'Rare earths':   '#d62728',
    'Manganese':     '#8c564b'
  };
  const MINERAL_ORDER = ['Lithium', 'Cobalt', 'Copper', 'Nickel', 'Rare earths', 'Manganese'];

  const PIE_COLORS = [
    '#1f77b4', '#d62728', '#2ca02c', '#e67e22', '#9467bd',
    '#17becf', '#8c564b', '#bcbd22', '#7f7f7f', '#ff7f0e'
  ];

  const FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  const PLOTLY_LAYOUT_BASE = {
    font: { family: FONT_FAMILY, color: '#333', size: 12 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 70, r: 70, t: 10, b: 50 },
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center', font: { size: 11 } },
    xaxis: { gridcolor: '#e5e5e5', linecolor: '#ccc', dtick: 2 },
    yaxis: { gridcolor: '#e5e5e5', linecolor: '#ccc' }
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
  var pricesMonthly = [];
  var pricesAnnual = [];
  var minerals = [];
  var years = [];
  var fullYears = [];
  var priceMinerals = [];

  /* ---------- Helpers ---------- */
  function formatUSD(val) {
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(val).toLocaleString();
  }

  function formatQty(val) {
    if (val >= 1e12) return (val / 1e12).toFixed(1) + 'T kg';
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B kg';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M kg';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K kg';
    return val.toFixed(0) + ' kg';
  }

  function pctChange(current, previous) {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  }

  function hexToRGBA(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
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
      parseCSV(COUNTRY_TS_PATH),
      parseCSV(PRICES_MONTHLY_PATH),
      parseCSV(PRICES_ANNUAL_PATH)
    ]).then(function (results) {
      rawData = results[0].map(function (r) {
        return {
          mineral: r.mineral,
          year: parseInt(r.year, 10),
          reporters: parseInt(r.n_reporters, 10),
          value: parseFloat(r.total_value_usd),
          weight: parseFloat(r.total_weight_kg)
        };
      }).filter(function (d) { return !isNaN(d.year) && d.value > 0; });

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
      }).filter(function (d) { return !isNaN(d.year) && d.value > 0; });

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
      }).filter(function (d) { return !isNaN(d.year) && d.value > 0; });

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
      }).filter(function (d) { return !isNaN(d.year) && d.value > 0; });

      pricesMonthly = results[4].map(function (r) {
        return {
          mineral: r.mineral,
          date: r.date,
          transformation: r.data_transformation,
          value: parseFloat(r.obs_value)
        };
      }).filter(function (d) { return !isNaN(d.value); });

      pricesAnnual = results[5].map(function (r) {
        return {
          mineral: r.mineral,
          year: parseInt(r.year, 10),
          tradeValue: parseFloat(r.total_value_usd),
          avgPrice: parseFloat(r.avg_price_usd)
        };
      }).filter(function (d) { return !isNaN(d.year) && !isNaN(d.avgPrice); });

      priceMinerals = Array.from(new Set(pricesMonthly.map(function (d) { return d.mineral; }))).sort();

      minerals = MINERAL_ORDER.filter(function (m) {
        return rawData.some(function (d) { return d.mineral === m; });
      });
      years = Array.from(new Set(rawData.map(function (d) { return d.year; }))).sort();

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
    var mineral = document.getElementById('filter-mineral').value;
    var prev = yr - 1;

    var yrData = rawData.filter(function (d) { return d.year === yr && d.mineral === mineral; });
    var prevData = rawData.filter(function (d) { return d.year === prev && d.mineral === mineral; });

    var totalVal = yrData.reduce(function (s, d) { return s + d.value; }, 0);
    var totalQty = yrData.reduce(function (s, d) { return s + d.weight; }, 0);
    var prevVal = prevData.reduce(function (s, d) { return s + d.value; }, 0);
    var prevQty = prevData.reduce(function (s, d) { return s + d.weight; }, 0);

    setKPI('kpi-value', 'Total ' + mineral + ' Value Traded', formatUSD(totalVal), pctChange(totalVal, prevVal));
    setKPI('kpi-quantity', 'Total ' + mineral + ' Quantity Traded', formatQty(totalQty), pctChange(totalQty, prevQty));
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

  /* ---------- Chart 1: Trade Overview — stacked area ---------- */
  function renderTradeOverview() {
    var metric = document.getElementById('overview-metric').value;
    var isValue = metric === 'value';
    var field = isValue ? 'value' : 'weight';

    var byMineralYear = {};
    minerals.forEach(function (m) {
      byMineralYear[m] = {};
      fullYears.forEach(function (y) { byMineralYear[m][y] = 0; });
    });

    rawData.forEach(function (d) {
      if (fullYears.indexOf(d.year) === -1) return;
      if (byMineralYear[d.mineral]) {
        byMineralYear[d.mineral][d.year] += d[field];
      }
    });

    // Sort minerals by total (largest first = bottom of stack)
    var mineralTotals = minerals.map(function (m) {
      var total = fullYears.reduce(function (s, y) { return s + byMineralYear[m][y]; }, 0);
      return { mineral: m, total: total };
    });
    mineralTotals.sort(function (a, b) { return b.total - a.total; });

    var traces = mineralTotals.map(function (item) {
      var m = item.mineral;
      return {
        x: fullYears,
        y: fullYears.map(function (y) { return byMineralYear[m][y]; }),
        name: m,
        type: 'scatter',
        mode: 'none',
        stackgroup: 'one',
        fillcolor: hexToRGBA(MINERAL_COLORS[m], 0.3),
        line: { width: 0, color: MINERAL_COLORS[m] },
        hoveron: 'points+fills',
        hovertemplate: isValue
          ? m + ': %{y:$,.0f}<extra></extra>'
          : m + ': %{y:,.0f} kg<extra></extra>'
      };
    });

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: isValue ? 'Trade Value (USD)' : 'Quantity (kg)', font: { size: 11 } }
      }),
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center', font: { size: 10 } },
      hovermode: 'x unified'
    });

    document.getElementById('overview-subtitle').textContent =
      'Total ' + (isValue ? 'value' : 'quantity') + ' traded by mineral (CIF import-reported)';

    Plotly.newPlot('chart-overview', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 2: Mineral Explorer — value + quantity lines ---------- */
  function renderMineralExplorer() {
    var mineral = document.getElementById('panel-mineral-select').value;

    var data = rawData.filter(function (d) {
      return d.mineral === mineral && fullYears.indexOf(d.year) !== -1;
    }).sort(function (a, b) { return a.year - b.year; });

    var traces = [
      {
        x: data.map(function (d) { return d.year; }),
        y: data.map(function (d) { return d.value; }),
        name: 'Value (USD)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: MINERAL_COLORS[mineral] || '#1f77b4', width: 2.5 },
        marker: { size: 5 },
        yaxis: 'y',
        hovertemplate: 'Value: %{y:$,.0f}<extra></extra>'
      },
      {
        x: data.map(function (d) { return d.year; }),
        y: data.map(function (d) { return d.weight; }),
        name: 'Quantity (kg)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#999', width: 1.5, dash: 'dot' },
        marker: { size: 4 },
        yaxis: 'y2',
        hovertemplate: 'Quantity: %{y:,.0f} kg<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: 'Value (USD)', font: { size: 11 } }
      }),
      yaxis2: {
        title: { text: 'Quantity (kg)', font: { size: 11 } },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)',
        linecolor: '#ccc'
      },
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    document.getElementById('mineral-subtitle').textContent =
      mineral + ' — value and quantity traded';

    Plotly.newPlot('chart-mineral', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 3: Minerals Ranked — horizontal bar ---------- */
  function renderTopMinerals() {
    var year = parseInt(document.getElementById('filter-year').value, 10);
    var metric = document.getElementById('ranked-metric').value;
    var isValue = metric === 'value';

    var data = rawData.filter(function (d) { return d.year === year && d.value > 0; });
    data.sort(function (a, b) { return isValue ? a.value - b.value : a.weight - b.weight; });

    var traces = [{
      y: data.map(function (d) { return d.mineral; }),
      x: data.map(function (d) { return isValue ? d.value : d.weight; }),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: data.map(function (d) { return MINERAL_COLORS[d.mineral] || '#999'; })
      },
      hovertemplate: isValue
        ? '%{y}: %{x:$,.0f}<extra></extra>'
        : '%{y}: %{x:,.0f} kg<extra></extra>'
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 130, r: 30, t: 10, b: 50 },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, {
        title: { text: isValue ? 'Value (USD)' : 'Quantity (kg)', font: { size: 11 } },
        dtick: undefined
      }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true }),
      hovermode: 'closest'
    });

    document.getElementById('top-subtitle').textContent =
      'Ranked by ' + (isValue ? 'value' : 'quantity') + ' traded (' + year + ')';

    Plotly.newPlot('chart-top', traces, layout, PLOTLY_CONFIG);
  }

  /* ========================================================
     TRADING PARTNERS SECTION
     ======================================================== */

  function getTPFilters() {
    return {
      mineral: document.getElementById('filter-mineral').value,
      year: parseInt(document.getElementById('filter-year').value, 10),
      flow: document.getElementById('filter-flow').value
    };
  }

  /* ---------- Chart 4: Market Share (pie/donut) ---------- */
  function renderMarketShare() {
    var f = getTPFilters();
    var flowLabel = f.flow === 'Import' ? 'Import' : 'Export';

    var data = bilateralData.filter(function (d) {
      return d.mineral === f.mineral && d.year === f.year && d.flow === f.flow && d.value > 0;
    });
    data.sort(function (a, b) { return b.value - a.value; });

    var total = data.reduce(function (s, d) { return s + d.value; }, 0);

    var top = data.slice(0, 8);
    var othersVal = data.slice(8).reduce(function (s, d) { return s + d.value; }, 0);
    var labels = top.map(function (d) { return d.country; });
    var values = top.map(function (d) { return d.value; });
    if (othersVal > 0) {
      labels.push('Others');
      values.push(othersVal);
    }

    var customText = values.map(function (v) {
      var pct = total > 0 ? (v / total * 100).toFixed(1) : '0.0';
      return formatUSD(v) + ' (' + pct + '%)';
    });

    var traces = [{
      labels: labels,
      values: values,
      type: 'pie',
      hole: 0.4,
      marker: { colors: PIE_COLORS },
      textinfo: 'label+percent',
      textposition: 'outside',
      text: customText,
      hovertemplate: '%{label}: %{text}<extra></extra>',
      sort: false
    }];

    var layout = {
      font: { family: FONT_FAMILY, color: '#333', size: 11 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 40, r: 40, t: 30, b: 30 },
      showlegend: false
    };

    document.getElementById('share-title').textContent = flowLabel + ' Market Share';
    document.getElementById('share-subtitle').textContent =
      f.mineral + ' — ' + f.year + ' — country concentration';

    Plotly.newPlot('chart-share', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 5: Sankey Trade Flows with per-country share ---------- */
  function renderSankey() {
    var f = getTPFilters();

    var data = flowsData.filter(function (d) {
      return d.mineral === f.mineral && d.year === f.year && d.value > 0;
    });
    data.sort(function (a, b) { return b.value - a.value; });
    var top = data.slice(0, 25);

    if (top.length === 0) {
      Plotly.purge('chart-sankey');
      document.getElementById('chart-sankey').innerHTML =
        '<p style="text-align:center;color:#999;padding:2rem">No bilateral flow data for this selection.</p>';
      return;
    }

    // Compute per-country totals for share %
    var exporterTotals = {};
    var importerTotals = {};
    top.forEach(function (d) {
      exporterTotals[d.exporter] = (exporterTotals[d.exporter] || 0) + d.value;
      importerTotals[d.importer] = (importerTotals[d.importer] || 0) + d.value;
    });
    var grandTotal = top.reduce(function (s, d) { return s + d.value; }, 0);

    var nodeMap = {};
    var nodes = [];
    function getNode(name, side) {
      var key = side + ':' + name;
      if (nodeMap[key] === undefined) {
        nodeMap[key] = nodes.length;
        var countryTotal = side === 'exporter' ? exporterTotals[name] : importerTotals[name];
        var share = grandTotal > 0 ? (countryTotal / grandTotal * 100).toFixed(1) : '0.0';
        nodes.push({ label: name, side: side, share: share, total: countryTotal });
      }
      return nodeMap[key];
    }

    var sources = [];
    var targets = [];
    var values = [];
    var linkLabels = [];

    top.forEach(function (d) {
      var srcIdx = getNode(d.exporter, 'exporter');
      var tgtIdx = getNode(d.importer, 'importer');
      sources.push(srcIdx);
      targets.push(tgtIdx);
      values.push(d.value);
      var qty = formatQty(d.weight);
      var flowShare = grandTotal > 0 ? (d.value / grandTotal * 100).toFixed(1) : '0.0';
      linkLabels.push(formatUSD(d.value) + ' | ' + flowShare + '% | ' + qty);
    });

    var linkRGBA = top.map(function (_, i) {
      return hexToRGBA(PIE_COLORS[i % PIE_COLORS.length], 0.4);
    });

    var nodeColors = nodes.map(function (n) {
      return n.side === 'exporter' ? '#1f77b4' : '#d62728';
    });

    var nodeLabels = nodes.map(function (n) {
      return n.side === 'importer'
        ? n.label + ' (' + n.share + '%)'
        : n.label;
    });

    var nodeHover = nodes.map(function (n) {
      return n.side === 'importer'
        ? n.label + ': ' + formatUSD(n.total) + ' (' + n.share + '% of imports)'
        : n.label + ': ' + formatUSD(n.total);
    });

    var traces = [{
      type: 'sankey',
      orientation: 'h',
      node: {
        pad: 12,
        thickness: 18,
        line: { color: '#ddd', width: 0.5 },
        label: nodeLabels,
        color: nodeColors,
        customdata: nodeHover,
        hovertemplate: '%{customdata}<extra></extra>'
      },
      link: {
        source: sources,
        target: targets,
        value: values,
        color: linkRGBA,
        customdata: linkLabels,
        hovertemplate: '%{source.label} → %{target.label}<br>%{customdata}<extra></extra>'
      }
    }];

    var layout = {
      font: { family: FONT_FAMILY, color: '#333', size: 11 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 10, r: 10, t: 10, b: 10 }
    };

    Plotly.newPlot('chart-sankey', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 6: Country Time Series — line, value + quantity ---------- */
  function renderCountryTimeSeries() {
    var f = getTPFilters();
    var country = document.getElementById('country-select').value;
    var countryFlow = document.getElementById('country-flow-select').value;
    var flowLabel = countryFlow === 'Import' ? 'Imports' : 'Exports';

    var data = countryTsData.filter(function (d) {
      return d.mineral === f.mineral && d.country === country && d.flow === countryFlow && d.value > 0;
    }).sort(function (a, b) { return a.year - b.year; });

    var traces = [
      {
        x: data.map(function (d) { return d.year; }),
        y: data.map(function (d) { return d.value; }),
        name: 'Value (USD)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: MINERAL_COLORS[f.mineral] || '#1f77b4', width: 2.5 },
        marker: { size: 5 },
        yaxis: 'y',
        hovertemplate: 'Value: %{y:$,.0f}<extra></extra>'
      },
      {
        x: data.map(function (d) { return d.year; }),
        y: data.map(function (d) { return d.weight; }),
        name: 'Quantity (kg)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#999', width: 1.5, dash: 'dot' },
        marker: { size: 4 },
        yaxis: 'y2',
        hovertemplate: 'Quantity: %{y:,.0f} kg<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: 'Value (USD)', font: { size: 11 } }
      }),
      yaxis2: {
        title: { text: 'Quantity (kg)', font: { size: 11 } },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)',
        linecolor: '#ccc'
      },
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    document.getElementById('country-ts-subtitle').textContent =
      country + ' — ' + f.mineral + ' ' + flowLabel.toLowerCase() + ' (total per year)';

    Plotly.newPlot('chart-country-ts', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Populate country selector ---------- */
  function populateCountrySelect() {
    var f = getTPFilters();
    var countryFlow = document.getElementById('country-flow-select').value;

    var countries = {};
    countryTsData.forEach(function (d) {
      if (d.mineral === f.mineral && d.flow === countryFlow && d.value > 0) {
        if (!countries[d.country]) countries[d.country] = 0;
        countries[d.country] += d.value;
      }
    });

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

    if (sorted.indexOf(prev) !== -1) {
      sel.value = prev;
    } else if (sorted.length > 0) {
      sel.value = sorted[0];
    }
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

    var panelMineral = document.getElementById('panel-mineral-select');
    minerals.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      panelMineral.appendChild(opt);
    });
    panelMineral.value = selMineral.value;

    populateCountrySelect();
  }

  function renderTradeSection() {
    renderKPIs();
    renderTradeOverview();
    renderMineralExplorer();
    renderTopMinerals();
  }

  function renderAll() {
    renderTradeSection();
    renderTradingPartners();
  }

  function renderTradingPartners() {
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
      renderAll();
    });

    panelMineral.addEventListener('change', function () {
      selMineral.value = panelMineral.value;
      renderAll();
    });

    selYear.addEventListener('change', renderAll);
    selFlow.addEventListener('change', renderTradingPartners);

    document.getElementById('overview-metric').addEventListener('change', renderTradeOverview);
    document.getElementById('ranked-metric').addEventListener('change', renderTopMinerals);

    document.getElementById('country-select').addEventListener('change', renderCountryTimeSeries);
    document.getElementById('country-flow-select').addEventListener('change', function () {
      populateCountrySelect();
      renderCountryTimeSeries();
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    // Prices tab controls
    document.getElementById('price-mineral-select').addEventListener('change', function () {
      populatePriceCountrySelect();
      renderPriceVsTrade();
    });
    document.getElementById('price-flow-select').addEventListener('change', function () {
      populatePriceCountrySelect();
      renderPriceVsTrade();
    });
    document.getElementById('price-country-select').addEventListener('change', renderPriceVsTrade);
  }

  /* ========================================================
     PRICES TAB
     ======================================================== */

  /* ---------- Chart P1: Price Index — all minerals ---------- */
  function renderPriceIndex() {
    var indexData = pricesMonthly.filter(function (d) { return d.transformation === 'INDEX'; });

    var traces = priceMinerals.map(function (m) {
      var mData = indexData.filter(function (d) { return d.mineral === m; });
      mData.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      return {
        x: mData.map(function (d) { return d.date; }),
        y: mData.map(function (d) { return d.value; }),
        name: m,
        type: 'scatter',
        mode: 'lines',
        line: { color: MINERAL_COLORS[m] || '#999', width: 1.5 },
        hovertemplate: m + ': %{y:.1f}<extra></extra>'
      };
    });

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: 'Index (2016 = 100)', font: { size: 11 } }
      }),
      legend: { orientation: 'h', y: -0.18, x: 0.5, xanchor: 'center', font: { size: 10 } },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { dtick: undefined }),
      hovermode: 'x unified'
    });

    Plotly.newPlot('chart-price-index', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart P2: USD Prices — all minerals ---------- */
  function renderPriceUSD() {
    var usdData = pricesMonthly.filter(function (d) { return d.transformation === 'USD'; });

    var traces = priceMinerals.map(function (m) {
      var mData = usdData.filter(function (d) { return d.mineral === m; });
      mData.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      return {
        x: mData.map(function (d) { return d.date; }),
        y: mData.map(function (d) { return d.value; }),
        name: m,
        type: 'scatter',
        mode: 'lines',
        line: { color: MINERAL_COLORS[m] || '#999', width: 1.5 },
        hovertemplate: m + ': $%{y:,.0f}<extra></extra>'
      };
    });

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: 'Price (USD per metric ton)', font: { size: 11 } }
      }),
      legend: { orientation: 'h', y: -0.18, x: 0.5, xanchor: 'center', font: { size: 10 } },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, { dtick: undefined }),
      hovermode: 'x unified'
    });

    Plotly.newPlot('chart-price-usd', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart P3: Price vs Trade Value — per mineral/flow/country ---------- */
  function renderPriceVsTrade() {
    var mineral = document.getElementById('price-mineral-select').value;
    var flow = document.getElementById('price-flow-select').value;
    var country = document.getElementById('price-country-select').value;
    var color = MINERAL_COLORS[mineral] || '#1f77b4';
    var flowLabel = flow === 'Import' ? 'Imports' : 'Exports';

    // Get annual average prices for this mineral
    var priceByYear = {};
    pricesAnnual.forEach(function (d) {
      if (d.mineral === mineral) priceByYear[d.year] = d.avgPrice;
    });

    // Get trade values — either total (all countries) or specific country
    var tradeByYear = {};
    if (country === '__ALL__') {
      // Sum all countries for this mineral/flow from countryTsData
      countryTsData.forEach(function (d) {
        if (d.mineral === mineral && d.flow === flow) {
          tradeByYear[d.year] = (tradeByYear[d.year] || 0) + d.value;
        }
      });
    } else {
      countryTsData.forEach(function (d) {
        if (d.mineral === mineral && d.flow === flow && d.country === country) {
          tradeByYear[d.year] = (tradeByYear[d.year] || 0) + d.value;
        }
      });
    }

    // Build aligned arrays for years that have both price and trade data
    var commonYears = Object.keys(priceByYear).map(Number).filter(function (y) {
      return tradeByYear[y] !== undefined;
    }).sort();

    var traces = [
      {
        x: commonYears,
        y: commonYears.map(function (y) { return priceByYear[y]; }),
        name: 'Avg Price (USD)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: color, width: 2.5 },
        marker: { size: 5 },
        yaxis: 'y',
        hovertemplate: 'Price: $%{y:,.0f}<extra></extra>'
      },
      {
        x: commonYears,
        y: commonYears.map(function (y) { return tradeByYear[y]; }),
        name: 'Trade Value (USD)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#888', width: 1.8, dash: 'dash' },
        marker: { size: 4, symbol: 'square' },
        yaxis: 'y2',
        hovertemplate: 'Trade: %{y:$,.0f}<extra></extra>'
      }
    ];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: 'Avg Price (USD)', font: { size: 11, color: color } },
        tickfont: { color: color }
      }),
      yaxis2: {
        title: { text: 'Trade Value (USD)', font: { size: 11, color: '#888' } },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)',
        linecolor: '#ccc',
        tickfont: { color: '#888' }
      },
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    var countryLabel = country === '__ALL__' ? 'All Countries' : country;
    document.getElementById('price-vs-trade-title').textContent =
      mineral + ' \u2014 Price vs Trade Value';
    document.getElementById('price-vs-trade-subtitle').textContent =
      countryLabel + ' ' + flowLabel.toLowerCase() + ' \u2014 annual average price and trade value';

    Plotly.newPlot('chart-price-vs-trade', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Populate price country selector ---------- */
  function populatePriceCountrySelect() {
    var mineral = document.getElementById('price-mineral-select').value;
    var flow = document.getElementById('price-flow-select').value;

    var countries = {};
    countryTsData.forEach(function (d) {
      if (d.mineral === mineral && d.flow === flow && d.value > 0) {
        if (!countries[d.country]) countries[d.country] = 0;
        countries[d.country] += d.value;
      }
    });

    var sorted = Object.keys(countries).sort(function (a, b) {
      return countries[b] - countries[a];
    });

    var sel = document.getElementById('price-country-select');
    var prev = sel.value;
    sel.innerHTML = '';

    // "All Countries" option first
    var allOpt = document.createElement('option');
    allOpt.value = '__ALL__';
    allOpt.textContent = 'All Countries (Total)';
    sel.appendChild(allOpt);

    sorted.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });

    if (prev && (prev === '__ALL__' || sorted.indexOf(prev) !== -1)) {
      sel.value = prev;
    } else {
      sel.value = '__ALL__';
    }
  }

  function renderPricesTab() {
    renderPriceIndex();
    renderPriceUSD();
    populatePriceCountrySelect();
    renderPriceVsTrade();
  }

  function populatePriceMineralSelect() {
    var sel = document.getElementById('price-mineral-select');
    sel.innerHTML = '';
    priceMinerals.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
    sel.value = priceMinerals.indexOf('Copper') !== -1 ? 'Copper' : priceMinerals[0];
  }

  /* ---------- Tab Switching ---------- */
  function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(function (section) {
      section.classList.toggle('active', section.getAttribute('data-tab') === tabName);
    });

    // Render prices on first visit; re-render to fix Plotly sizing in hidden containers
    if (tabName === 'prices') {
      // Use setTimeout to let the DOM show the tab before Plotly measures container size
      setTimeout(function () {
        renderPricesTab();
      }, 50);
    }
  }

  /* ---------- Init ---------- */
  function init() {
    loadData().then(function () {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'block';

      populateFilters();
      populatePriceMineralSelect();
      bindEvents();

      renderTradeSection();
      renderTradingPartners();

      document.getElementById('data-period').textContent =
        'Data: ' + fullYears[0] + '\u2013' + fullYears[fullYears.length - 1] +
        ' | ' + minerals.length + ' minerals | Source: UN Comtrade';
    }).catch(function (err) {
      document.getElementById('loading').innerHTML =
        '<p style="color:#d62728">Failed to load data. Check console.</p>';
      console.error(err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
