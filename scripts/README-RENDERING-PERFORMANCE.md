# Playwright Rendering Performance Script

An automation script that walks every frontend tab and measures time to render completion.

## Overview

Using Playwright, this script collects the following metrics for every tab of the OpenSwarm dashboard:

- **Navigation Time**: page navigation duration
- **DOM Content Loaded**: time until DOM content is loaded
- **Load Complete**: time until all resources are loaded
- **Render Complete**: time until rendering completes (including reflow/repaint)
- **First Paint (FP)**: time to first pixel
- **First Contentful Paint (FCP)**: time to first content render
- **Largest Contentful Paint (LCP)**: time to largest content render

## Installation

```bash
npm install
```

Playwright is included in devDependencies via the `playwright` package.

## Usage

### Basic run

```bash
npm run perf:measure
```

Or run directly:

```bash
tsx scripts/playwright-rendering-performance.ts
```

### Configuration via environment variables

```bash
# Test against a specific URL
BASE_URL=http://your-server:3000 npm run perf:measure

# Change where results are written
OUTPUT_DIR=./custom-results npm run perf:measure

# Both
BASE_URL=http://localhost:8080 OUTPUT_DIR=./performance-data npm run perf:measure
```

## Measured tabs

The following 3 tabs are visited and measured:

1. **REPOS** — repository management
2. **PIPELINE** — pipeline and log viewer
3. **CHAT** — agent chat

## Output formats

### JSON (`rendering-metrics-TIMESTAMP.json`)

```json
{
  "tabs": [
    {
      "tab": "REPOS",
      "startTime": 0,
      "navigationEnd": 1234.56,
      "domContentLoaded": 2345.67,
      "loadComplete": 3456.78,
      "renderComplete": 4567.89,
      "totalRenderTime": 4567.89,
      "firstContentfulPaint": 1500.23,
      "largestContentfulPaint": 2800.45,
      "navigationTiming": {
        "navigationStart": 0,
        "domContentLoadedEventEnd": 2345.67,
        "loadEventEnd": 3456.78
      }
    }
    // ... more tab entries
  ],
  "summary": {
    "averageRenderTime": 3000.45,
    "minRenderTime": 1500.23,
    "maxRenderTime": 5000.12,
    "totalTime": 15000.00,
    "timestamp": "2026-03-07T13:25:21.303Z"
  }
}
```

### CSV (`rendering-metrics-TIMESTAMP.csv`)

| Tab | Total (ms) | Navigation (ms) | DOMContentLoaded (ms) | Load Complete (ms) | Render Complete (ms) | FCP (ms) | LCP (ms) |
|-----|-----------|-----------------|----------------------|-------------------|---------------------|---------|---------|
| REPOS | 4567.89 | 1234.56 | 2345.67 | 3456.78 | 4567.89 | 1500.23 | 2800.45 |
| PIPELINE | 3456.78 | 1100.45 | 2200.56 | 3100.67 | 3456.78 | 1400.23 | 2500.34 |
| CHAT | 5234.56 | 1400.78 | 2500.89 | 3600.90 | 5234.56 | 1600.45 | 3000.67 |

## Interpreting results

### Performance targets

- **Total Render Time**: end-to-end rendering time — lower is better
- **FCP < 2000ms**: good
- **LCP < 2500ms**: good
- **Total rendering < 3000ms**: target

### Identifying slow tabs

The script automatically flags tabs whose render time exceeds 1.5× the average:

```
⚠️  Slow tabs (≥ 1.5× the average):
  - instances: 5234.56ms
  - sessions: 4890.12ms
```

## Examples

### 1. Basic performance test (local dev server)

```bash
# 1. Start the OpenSwarm dashboard server
npm run dev

# 2. In another terminal, run the measurement (default: localhost:5173)
npm run perf:measure
```

### 2. Measuring a production environment

```bash
BASE_URL=https://your-openswarm-domain.com npm run perf:measure
```

### 3. Custom results directory

```bash
OUTPUT_DIR=./custom-results npm run perf:measure
```

## Optimization tips

Based on the measurements, consider:

### Reducing render time
- Remove unnecessary re-renders
- Implement virtualization
- Apply code splitting

### Improving FCP
- Preload critical resources
- Inline critical CSS
- Optimize fonts

### Improving LCP
- Optimize images
- Apply lazy loading
- Compress resources

## Automation (CI/CD)

Run periodically from GitHub Actions or any CI/CD pipeline:

```yaml
# .github/workflows/performance.yml
name: Performance Test
on:
  schedule:
    - cron: '0 0 * * *'  # daily at midnight

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install
      - name: Start UI server
        run: cd openclaw/ui && npm run dev &
      - name: Wait for server
        run: sleep 5
      - name: Run performance test
        run: npm run perf:measure
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/
```

## Troubleshooting

### Connection refused (net::ERR_CONNECTION_REFUSED)

**Cause**: no server running at the configured BASE_URL

**Fix**:
```bash
# 1. Make sure the UI server is running
cd openclaw/ui && npm run dev

# 2. If it runs on a different port
BASE_URL=http://localhost:3000 npm run perf:measure
```

### Timeout errors

**Cause**: the page takes too long to load

**Fix**:
- Check network connectivity
- Inspect rendering performance in browser devtools
- Consider optimizing page resources

### Playwright installation errors

**Cause**: Playwright browser binaries are missing

**Fix**:
```bash
npx playwright install chromium
```

## Further reading

- [Playwright documentation](https://playwright.dev/)
- [Web Vitals guide](https://web.dev/vitals/)
- [Performance optimization guide](https://web.dev/performance/)

## License

Same license as the OpenSwarm project.
