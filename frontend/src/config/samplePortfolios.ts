/** One-click sample portfolios served from `frontend/public/samples/`. */
export const SAMPLE_PORTFOLIOS = [
  {
    id: 'sample-1',
    label: 'Sample 1',
    shortLabel: 'Sample 1',
    file: '/samples/nexus-fund-ii.xlsx',
    filename: 'nexus-fund-ii.xlsx',
  },
  {
    id: 'sample-2',
    label: 'Sample 2',
    shortLabel: 'Sample 2',
    file: '/samples/nexus-fund-iii.xlsx',
    filename: 'nexus-fund-iii.xlsx',
  },
  {
    id: 'sample-3',
    label: 'Sample 3',
    shortLabel: 'Sample 3',
    file: '/samples/nexus-fund-iv.xlsx',
    filename: 'nexus-fund-iv.xlsx',
  },
  {
    id: 'sample-4',
    label: 'Sample 4',
    shortLabel: 'Sample 4',
    file: '/samples/nexus-portfolio-4.xlsx',
    filename: 'nexus-portfolio-4.xlsx',
  },
  {
    id: 'sample-5',
    label: 'Sample 5',
    shortLabel: 'Sample 5',
    file: '/samples/sample-portfolio.xlsx',
    filename: 'sample-portfolio.xlsx',
  },
] as const

export type SamplePortfolioId = (typeof SAMPLE_PORTFOLIOS)[number]['id']
