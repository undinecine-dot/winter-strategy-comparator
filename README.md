# Winter Strategy Comparator

A browser-only decision tool for Pork & Garlic Ice Cream Co. Year 2 winter.

## Run locally

Serve the `dist` directory with any static web server. For example:

```bash
python3 -m http.server 8765 --directory dist
```

Then open `http://localhost:8765`.

The application stores entries in the current browser's local storage. It has no account, database, or external API. Clearing browser site data removes the saved entries.

## Use

1. If only Year 1 Winter is complete, choose **Use known Winter as illustration**. This skips the intervening seasons and must not be treated as the real Year 2 opening position. Replace it with actual balances after Year 1 autumn when available.
2. Replace the draft plans with two proposed Year 2 winter decisions.
3. Enter possible trainer sales allocations for low, expected, and high scenarios.
4. Compare profit, cash, warnings, and the lower-sales outcome.
5. Update the Year 1 price estimates when the professor supplies Year 2 rules.

The built-in historical Year 1 winter calculation must show Sh 80,000 revenue, Sh 35,200 gross profit, Sh 1,440 profit before tax, Sh 144 tax, Sh 1,296 net profit, and Sh 76,796 closing cash.

## Publish

Put this project in a GitHub repository and import the repository into Vercel. `vercel.json` sets `dist` as the output directory. Open the live site and repeat the historical check and one plan comparison before submitting the links.
