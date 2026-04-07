# Critical Minerals for Energy Transition Dashboard

An interactive dashboard exploring global trade flows of critical minerals essential to the clean energy transition, built with UN Comtrade bilateral trade data (2010–2024).

**Live dashboard:** [rubilamb.github.io/criticalminerals](https://rubilamb.github.io/criticalminerals/)

## Minerals covered

This dashboard focuses on seven minerals that are fundamental to renewable energy technologies and the global energy transition:

| Mineral | HS Codes | Role in the Energy Transition |
|---------|----------|-------------------------------|
| **Lithium** | 283691, 282520, 282739 | Rechargeable batteries for electric vehicles and grid-scale energy storage |
| **Cobalt** | 260500, 810520, 810590, 282200 | Cathode material in lithium-ion batteries, enabling higher energy density |
| **Copper** | 260300, 740311 | Essential conductor in solar panels, wind turbines, EVs, and grid infrastructure |
| **Nickel** | 260400, 750210 | High-performance battery cathodes (NMC, NCA) and stainless steel for wind turbines |
| **Rare earths** | 284610, 284690, 280530 | Permanent magnets in wind turbine generators and EV motors (Nd, Pr, Dy) |
| **Silicon metal** | 280469 | Primary material in photovoltaic solar cells |
| **Manganese** | 260200, 811100 | Battery cathodes and high-strength steel for wind tower construction |

These minerals face supply concentration risks, rapidly growing demand driven by decarbonisation policies, and geopolitical significance that makes understanding their trade patterns essential for energy security planning.

## Data source

Trade data is sourced from the [UN Comtrade](https://comtradeplus.un.org/) database via the Comtrade Plus API, covering bilateral merchandise trade reported by countries worldwide at the 6-digit HS code level. The dataset spans 2010–2024 with 16 HS codes across the 7 minerals of interest.

## Trade data discrepancies and methodological choices

### The reporting problem in international trade data

In principle, every bilateral trade flow is recorded twice: once by the exporting country and once by the importing country. In practice, these records frequently disagree. Bustos, Jackson, Torun et al. (2026) document the nature and severity of these discrepancies across six decades of UN Comtrade data and propose a comprehensive methodology for reconciling them.

**Reference:** Bustos, S., Jackson, E., Torun, D., Leonard, B., Tuzcu, N., Lukaszuk, P., White, A., Hausmann, R., & Yildirim, M. A. (2026). Tackling Discrepancies in Trade Data: The Harvard Growth Lab International Trade Datasets. *Scientific Data*, 13:170. https://doi.org/10.1038/s41597-025-06488-2

### What the paper finds

The paper identifies two structural problems in raw UN Comtrade data:

1. **Reporting discrepancies**: Exporter-reported and importer-reported values for the same shipment often diverge substantially. In 2010, approximately 50% of all possible bilateral country pairs had neither partner reporting any trade. Of the roughly 31% where both partners reported, nearly two-thirds exhibited discrepancies exceeding 25%. These gaps arise from differences in CIF/FOB valuation, incomplete reporting, re-exports through intermediaries, time lags, and genuine reporting errors.

2. **Product classification changes**: The Harmonized System (HS) is revised approximately every five years (HS1992, HS1996, HS2002, HS2007, HS2012, HS2017, HS2022). Products are frequently split, merged, or reassigned, complicating time-series analysis. However, the paper finds that the **minerals and stones sector is the least affected** — only 0.2% of trade in that chapter involves revised HS codes.

### The paper's solution: a 5-step reconciliation pipeline

The paper proposes a comprehensive methodology to address these issues:

1. **Pre-processing and trade aggregation** — standardise codes, filter data quality, subtract trade with "Areas Not Specified" (ANS) when it exceeds 25% of a country's total.
2. **CIF-to-FOB adjustment** — estimate transport costs using a gravity regression on distance and contiguity, converting CIF import values to FOB-equivalent for comparability.
3. **Country reliability scores** — decompose bilateral discrepancies into country-specific accuracy parameters using OLS regression (D_{j,k} = α_j + α_k + ε), identifying which countries are systematically unreliable reporters.
4. **Weighted country-pair reconciliation** — combine exporter and importer reports using softmax-transformed reliability scores, producing a single best-estimate trade value per bilateral pair.
5. **Product-level trade reconciliation** — disaggregate reconciled country-pair totals back to 6-digit HS product level using hierarchical allocation rules.

The resulting mirrored dataset recovers approximately 9 million bilateral trade flows per year, a 50% increase over raw Comtrade data (~6 million). The reconciled data is publicly available at [Harvard Dataverse](https://doi.org/10.7910/DVN/5NGVOB).

### Our diagnostic analysis

We applied the paper's diagnostic framework (Steps 1–2) to our critical minerals dataset to assess data quality:

- **Coverage**: 38.3% of bilateral product-level pairs have both sides reporting, 37.6% are importer-only, and 24.0% are exporter-only. Import-reported data covers 75.9% of all pairs, versus 62.3% for export-reported data.
- **Discrepancy severity**: Of jointly-reported pairs, 82.5% exhibit discrepancies exceeding 25% (measured as |log(V_exporter / V_importer)| > 0.223). This is substantially worse than the paper's global average (~66%), driven by opaque supply chains (cobalt via DRC/Switzerland), strategic trade policies (rare earths export restrictions), and re-export hub activity (UAE, Singapore).
- **CIF/FOB ratio**: The median ratio of import (CIF) to export (FOB) values is 1.069, meaning CIF values are approximately 6.9% higher than FOB — within the expected 5–15% range for freight and insurance costs. Ores show higher ratios (~1.12–1.22) than refined metals (~1.02–1.06), consistent with bulk shipping dynamics.
- **Worsening trend**: High-discrepancy pairs increased from 75.4% (2005) to 86.9% (2024), mirroring the paper's finding that bilateral disagreements are growing despite improved reporting coverage.
- **ANS-flagged countries**: 5 countries exceed the 25% threshold for trade to unspecified partners (Uruguay, UAE, Andorra, Austria, Slovakia).

### Why we did not apply the full reconciliation pipeline

We use **import-reported (CIF) data** rather than applying the paper's full 5-step mirroring methodology for the following reasons:

1. **Scope**: This dashboard is a visualisation and exploratory tool for critical minerals trade patterns, not a reconciled trade database. The diagnostic analysis above demonstrates awareness of data limitations.
2. **Mineral classification stability**: The paper confirms that minerals and stones are the least affected by HS concordance changes (0.2% of sector trade), eliminating the need for product harmonisation.
3. **Coverage adequacy**: Import-reported data captures 75.9% of bilateral pairs for our minerals. The 24.0% exporter-only pairs we miss are predominantly flows reported by smaller economies where the trading partner did not file import records.
4. **Standard practice**: Using import-reported CIF data is the conventional approach in empirical trade research when full mirroring is not applied, as import records are more consistently filed due to customs duty incentives.

A more rigorous approach would follow the full Bustos et al. (2026) methodology or utilise their publicly available mirrored dataset from [Harvard Dataverse](https://doi.org/10.7910/DVN/5NGVOB) to recover missing trade flows and reconcile bilateral discrepancies.

## License

Data: UN Comtrade terms of use. Code: MIT.
