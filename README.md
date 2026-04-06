# Critical Minerals Trade Dashboard

An interactive dashboard exploring global trade flows of critical minerals essential to the clean energy transition, built with UN Comtrade data.

**Live dashboard:** [rubilamb.github.io/criticalminerals](https://rubilamb.github.io/criticalminerals/)

## Why these minerals?

This dashboard focuses on seven minerals that are fundamental to renewable energy technologies and the global energy transition:

| Mineral | Role in Clean Energy |
|---------|---------------------|
| **Lithium** | The backbone of rechargeable batteries powering electric vehicles and grid-scale energy storage |
| **Cobalt** | Critical cathode material in lithium-ion batteries, enabling higher energy density |
| **Copper** | Essential conductor in solar panels, wind turbines, EVs, and electricity grid infrastructure |
| **Nickel** | Key component in high-performance battery cathodes (NMC, NCA) and stainless steel for wind turbines |
| **Rare earths** | Permanent magnets in wind turbine generators and electric vehicle motors (neodymium, praseodymium, dysprosium) |
| **Silicon metal** | Primary material in photovoltaic solar cells |
| **Manganese** | Used in battery cathodes and high-strength steel for wind tower construction |

These minerals face supply concentration risks, rapidly growing demand driven by decarbonisation policies, and geopolitical significance that makes understanding their trade patterns essential for energy security planning.

## Data source and methodology

Trade data is sourced from the [UN Comtrade](https://comtradeplus.un.org/) database, covering bilateral merchandise trade reported by countries worldwide.

**This dashboard uses import-reported data only (CIF values).** In international trade statistics, the same shipment is recorded twice — once by the exporting country (FOB) and once by the importing country (CIF). These figures often differ due to:

- **Valuation**: Imports are valued CIF (Cost, Insurance, Freight), which includes transport costs. Exports are valued FOB (Free on Board) at the port of departure. CIF values are therefore higher and more comprehensive.
- **Reporting coverage**: Not all countries report trade data consistently. Import records tend to be more complete because countries have stronger incentives to track imports for customs duties and tariff collection.
- **Re-exports and transit trade**: Goods passing through intermediary countries can create discrepancies between what is reported as exported vs imported.
- **Time lags and classification differences**: A shipment exported in December may be recorded as an import in January; countries may also classify the same product under different HS codes.

For these reasons, import-reported (CIF) data is generally considered the more reliable measure of trade activity and is used throughout this dashboard. Both importing and exporting country perspectives are derived from the same import records — the importing country is the reporter, and the exporting country is the trade partner.

## License

Data: UN Comtrade terms of use. Code: MIT.
