/* ===== Critical Minerals Dashboard — Main JS ===== */

(function () {
  'use strict';

  const DATA_PATH = 'data/comtrade_crm_summary.csv';
  const BILATERAL_PATH = 'data/comtrade_crm_bilateral.csv';
  const FLOWS_PATH = 'data/comtrade_crm_flows.csv';
  const COUNTRY_TS_PATH = 'data/comtrade_crm_country_ts.csv';
  const GPR_PATH = 'data/gpr_annual.csv';

  /* Color palette inspired by academic chart style */
  const MINERAL_COLORS = {
    'Lithium':       '#2ca02c',
    'Cobalt':        '#e67e22',
    'Copper':        '#1f77b4',
    'Nickel':        '#9467bd',
    'Rare earths':   '#d62728',
    'Silicon metal': '#17becf',
    'Manganese':     '#8c564b'
  };
  const MINERAL_ORDER = ['Lithium', 'Cobalt', 'Copper', 'Nickel', 'Rare earths', 'Silicon metal', 'Manganese'];
  const GPR_COLOR = 'rgba(220,80,80,0.35)';
  const GPR_LINE_COLOR = '#d62728';

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
  var gprData = [];
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

  function getGPRTrace(yrs, yaxisName) {
    var gprByYear = {};
    gprData.forEach(function (d) { gprByYear[d.year] = d.gpr; });

    var filteredYrs = yrs.filter(function (y) { return gprByYear[y] !== undefined; });
    return {
      x: filteredYrs,
      y: filteredYrs.map(function (y) { return gprByYear[y]; }),
      name: 'GPR Index',
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      fillcolor: GPR_COLOR,
      line: { color: GPR_LINE_COLOR, width: 1, dash: 'dot' },
      yaxis: yaxisName || 'y3',
      hovertemplate: 'GPR: %{y:.1f}<extra></extra>',
      showlegend: true
    };
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
      parseCSV(GPR_PATH)
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

      gprData = results[4].map(function (r) {
        return { year: parseInt(r.year, 10), gpr: parseFloat(r.gpr) };
      }).filter(function (d) { return !isNaN(d.year) && !isNaN(d.gpr); });

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

  /* ---------- Chart 1: Trade Overview — all minerals + GPR ---------- */
  function renderTradeOverview() {
    var flow = document.getElementById('filter-flow').value;
    var flowLabel = flow === 'Import' ? 'Imports' : 'Exports';

    // Compute per-mineral and total by year
    var byMineralYear = {};
    var totalByYear = {};
    fullYears.forEach(function (y) { totalByYear[y] = 0; });
    minerals.forEach(function (m) {
      byMineralYear[m] = {};
      fullYears.forEach(function (y) { byMineralYear[m][y] = 0; });
    });

    rawData.forEach(function (d) {
      if (fullYears.indexOf(d.year) === -1 || d.flow !== flow) return;
      if (byMineralYear[d.mineral]) {
        byMineralYear[d.mineral][d.year] += d.value;
        totalByYear[d.year] += d.value;
      }
    });

    // Line trace per mineral (left axis = value)
    var traces = minerals.map(function (m) {
      return {
        x: fullYears,
        y: fullYears.map(function (y) { return byMineralYear[m][y]; }),
        name: m,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: MINERAL_COLORS[m], width: 2 },
        marker: { size: 4 },
        yaxis: 'y',
        hovertemplate: m + ': %{y:$,.0f}<extra></extra>'
      };
    });

    // Share traces per mineral (right axis = %)
    minerals.forEach(function (m) {
      traces.push({
        x: fullYears,
        y: fullYears.map(function (y) {
          return totalByYear[y] > 0 ? (byMineralYear[m][y] / totalByYear[y] * 100) : 0;
        }),
        name: m + ' share',
        type: 'scatter',
        mode: 'lines',
        line: { color: MINERAL_COLORS[m], width: 1, dash: 'dash' },
        yaxis: 'y2',
        showlegend: false,
        hovertemplate: m + ' share: %{y:.1f}%<extra></extra>'
      });
    });

    // GPR overlay
    traces.push(getGPRTrace(fullYears, 'y3'));

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, {
        title: { text: 'Trade Value (USD)', font: { size: 11 } },
        side: 'left'
      }),
      yaxis2: {
        title: { text: 'Share (%)', font: { size: 11 } },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)',
        linecolor: '#ccc',
        rangemode: 'tozero'
      },
      yaxis3: {
        overlaying: 'y',
        side: 'right',
        position: 1,
        showgrid: false,
        showticklabels: false,
        rangemode: 'tozero',
        visible: false
      },
      legend: { orientation: 'h', y: -0.28, x: 0.5, xanchor: 'center', font: { size: 10 } }
    });

    document.getElementById('overview-subtitle').textContent =
      'All minerals ' + flowLabel.toLowerCase() + ' value (solid) and share % (dashed) with Geopolitical Risk Index';

    Plotly.newPlot('chart-overview', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 2: Mineral Explorer — value + quantity ---------- */
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
      mineral + ' — ' + flowLabel.toLowerCase() + ' value and quantity';

    Plotly.newPlot('chart-mineral', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 3: Minerals by Value or Quantity ---------- */
  function renderTopMinerals() {
    var year = parseInt(document.getElementById('filter-year').value, 10);
    var flow = document.getElementById('filter-flow').value;
    var metric = document.getElementById('metric-select').value;
    var flowLabel = flow === 'Import' ? 'Imports' : 'Exports';
    var isValue = metric === 'value';

    var data = rawData.filter(function (d) { return d.year === year && d.flow === flow; });
    data.sort(function (a, b) { return (isValue ? b.value - a.value : b.weight - a.weight); });

    var traces = [{
      y: data.map(function (d) { return d.mineral; }).reverse(),
      x: data.map(function (d) { return isValue ? d.value : d.weight; }).reverse(),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: data.map(function (d) { return MINERAL_COLORS[d.mineral] || '#999'; }).reverse()
      },
      hovertemplate: isValue
        ? '%{y}: %{x:$,.0f}<extra></extra>'
        : '%{y}: %{x:,.0f} kg<extra></extra>'
    }];

    var layout = Object.assign({}, PLOTLY_LAYOUT_BASE, {
      margin: { l: 130, r: 30, t: 10, b: 40 },
      xaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.xaxis, {
        title: isValue ? 'Trade Value (USD)' : 'Quantity (kg)',
        dtick: undefined
      }),
      yaxis: Object.assign({}, PLOTLY_LAYOUT_BASE.yaxis, { automargin: true }),
      hovermode: 'closest'
    });

    document.getElementById('top-subtitle').textContent =
      flowLabel + ' ranked by ' + (isValue ? 'value' : 'quantity') + ' (' + year + ')';

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

  /* ---------- Chart 4: Market Share (pie/donut) ---------- */
  function renderMarketShare() {
    var f = getTPFilters();
    var flowLabel = f.flow === 'Import' ? 'Import' : 'Export';

    var data = bilateralData.filter(function (d) {
      return d.mineral === f.mineral && d.year === f.year && d.flow === f.flow;
    });
    data.sort(function (a, b) { return b.value - a.value; });

    var total = data.reduce(function (s, d) { return s + d.value; }, 0);

    // Top 8 + Others
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
      margin: { l: 20, r: 20, t: 10, b: 10 },
      showlegend: false
    };

    document.getElementById('share-title').textContent = flowLabel + ' Market Share';
    document.getElementById('share-subtitle').textContent =
      f.mineral + ' — ' + f.year + ' — country concentration';

    Plotly.newPlot('chart-share', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Chart 5: Sankey Trade Flows ---------- */
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
        '<p style="text-align:center;color:#999;padding:2rem">No bilateral flow data for this selection.</p>';
      return;
    }

    // Compute total for share %
    var totalVal = top.reduce(function (s, d) { return s + d.value; }, 0);

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
    var linkLabels = [];

    top.forEach(function (d) {
      var srcIdx = getNode(d.exporter, 'exporter');
      var tgtIdx = getNode(d.importer, 'importer');
      sources.push(srcIdx);
      targets.push(tgtIdx);
      values.push(d.value);
      var share = totalVal > 0 ? (d.value / totalVal * 100).toFixed(1) : '0.0';
      var qty = formatQty(d.weight);
      linkLabels.push(formatUSD(d.value) + ' | ' + share + '% | ' + qty);
    });

    var linkRGBA = top.map(function (_, i) {
      var hex = PIE_COLORS[i % PIE_COLORS.length];
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',0.4)';
    });

    var nodeColors = nodes.map(function (n) {
      return n.side === 'exporter' ? '#1f77b4' : '#d62728';
    });

    var traces = [{
      type: 'sankey',
      orientation: 'h',
      node: {
        pad: 12,
        thickness: 18,
        line: { color: '#ddd', width: 0.5 },
        label: nodes.map(function (n) { return n.label; }),
        color: nodeColors,
        hovertemplate: '%{label}: %{value:$,.0f}<extra></extra>'
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

  /* ---------- Chart 6: Country Time Series + GPR ---------- */
  function renderCountryTimeSeries() {
    var f = getTPFilters();
    var country = document.getElementById('country-select').value;
    var countryFlow = document.getElementById('country-flow-select').value;
    var flowLabel = countryFlow === 'Import' ? 'Imports' : 'Exports';

    var data = countryTsData.filter(function (d) {
      return d.mineral === f.mineral && d.country === country && d.flow === countryFlow;
    }).sort(function (a, b) { return a.year - b.year; });

    var dataYears = data.map(function (d) { return d.year; });

    var traces = [
      {
        x: dataYears,
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
        x: dataYears,
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

    // GPR overlay
    traces.push(getGPRTrace(dataYears, 'y3'));

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
      yaxis3: {
        overlaying: 'y',
        side: 'right',
        position: 1,
        showgrid: false,
        showticklabels: false,
        rangemode: 'tozero',
        visible: false
      },
      legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
    });

    document.getElementById('country-ts-subtitle').textContent =
      country + ' — ' + f.mineral + ' ' + flowLabel.toLowerCase() + ' with GPR Index';

    Plotly.newPlot('chart-country-ts', traces, layout, PLOTLY_CONFIG);
  }

  /* ---------- Populate country selector ---------- */
  function populateCountrySelect() {
    var f = getTPFilters();
    var countryFlow = document.getElementById('country-flow-select').value;

    var countries = {};
    countryTsData.forEach(function (d) {
      if (d.mineral === f.mineral && d.flow === countryFlow) {
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

    populateCountrySelect();
  }

  function renderTradeSection() {
    renderKPIs();
    renderTradeOverview();
    renderMineralExplorer();
    renderTopMinerals();
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
    var metricSel = document.getElementById('metric-select');

    selMineral.addEventListener('change', function () {
      panelMineral.value = selMineral.value;
      renderMineralExplorer();
    });

    panelMineral.addEventListener('change', function () {
      selMineral.value = panelMineral.value;
      renderMineralExplorer();
    });

    selYear.addEventListener('change', function () {
      renderKPIs();
      renderTopMinerals();
    });

    selFlow.addEventListener('change', renderTradeSection);

    metricSel.addEventListener('change', renderTopMinerals);

    // Trading partners
    document.getElementById('tp-mineral-select').addEventListener('change', renderTradingPartners);
    document.getElementById('tp-year-select').addEventListener('change', renderTradingPartners);
    document.getElementById('tp-flow-select').addEventListener('change', renderTradingPartners);

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
        'Data: ' + years[0] + '\u2013' + years[years.length - 1] +
        ' | ' + minerals.length + ' minerals | Source: UN Comtrade | GPR: Caldara & Iacoviello';
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
