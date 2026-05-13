export type DealStatus = 'Compliant' | 'Monitoring' | 'Breach Risk'

export interface PortfolioDeal {
  dealId: string
  borrower: string
  sector: string
  stage: string
  principal: number
  outstanding: number
  interestRate: number
  estimatedEir: number
  maturityLabel: string
  tenorMonths: number
  status: DealStatus
}

export interface CovenantAlert {
  dealId: string
  borrower: string
  covenant: string
  threshold: string
  currentValue: string
  status: DealStatus
}

export interface YoyAumPoint {
  year: string
  amount: number
}

export interface GrowthMetric {
  label: string
  value: string
  subLabel: string
  tone: 'positive' | 'warning' | 'neutral'
}

export interface PortfolioDataset {
  asOf: string
  lender: string
  annualFeeIncome: number
  weightedAvgIrrPct: number
  portfolioMoicAvg: number
  yoyAum: YoyAumPoint[]
  deals: PortfolioDeal[]
  covenantAlerts: CovenantAlert[]
  growthMetrics: GrowthMetric[]
}

export const portfolioDataset: PortfolioDataset = {
  asOf: 'May 04, 2026',
  lender: 'Nexus Venture Debt Fund I, LP',
  annualFeeIncome: 1767500,
  weightedAvgIrrPct: 16.8,
  portfolioMoicAvg: 1.41,
  yoyAum: [
    { year: '2022', amount: 9_000_000 },
    { year: '2023', amount: 16_000_000 },
    { year: '2024', amount: 30_500_000 },
    { year: '2025', amount: 50_500_000 },
  ],
  deals: [
    {
      dealId: 'VD-2023-0101',
      borrower: 'Axon Therapeutics',
      sector: 'Biotech',
      stage: 'Series C',
      principal: 3_000_000,
      outstanding: 1_356_000,
      interestRate: 12.15,
      estimatedEir: 14.8,
      maturityLabel: 'Mar 2026',
      tenorMonths: 36,
      status: 'Breach Risk',
    },
    {
      dealId: 'VD-2023-0103',
      borrower: 'Meridian SaaS',
      sector: 'SaaS / AI',
      stage: 'Series B',
      principal: 5_000_000,
      outstanding: 2_592_000,
      interestRate: 14.0,
      estimatedEir: 16.9,
      maturityLabel: 'Jun 2025',
      tenorMonths: 24,
      status: 'Compliant',
    },
    {
      dealId: 'VD-2023-0104',
      borrower: 'Crestline Robotics',
      sector: 'CleanTech',
      stage: 'Series B',
      principal: 8_000_000,
      outstanding: 9_800_000,
      interestRate: 11.0,
      estimatedEir: 14.2,
      maturityLabel: 'Sep 2026',
      tenorMonths: 36,
      status: 'Compliant',
    },
    {
      dealId: 'VD-2024-0111',
      borrower: 'Titan Semiconductors',
      sector: 'HealthTech',
      stage: 'Series C',
      principal: 12_000_000,
      outstanding: 12_000_000,
      interestRate: 13.5,
      estimatedEir: 16.2,
      maturityLabel: 'Jan 2027',
      tenorMonths: 36,
      status: 'Monitoring',
    },
    {
      dealId: 'VD-2024-0112',
      borrower: 'ClearPath Analytics',
      sector: 'Mobility / SaaS',
      stage: 'Series A',
      principal: 2_500_000,
      outstanding: 5_000_000,
      interestRate: 16.0,
      estimatedEir: 19.1,
      maturityLabel: 'Nov 2025',
      tenorMonths: 18,
      status: 'Breach Risk',
    },
    {
      dealId: 'VD-2024-0110',
      borrower: 'Nimbus Cloud',
      sector: 'PropTech',
      stage: 'Series C',
      principal: 20_000_000,
      outstanding: 20_000_000,
      interestRate: 12.5,
      estimatedEir: 15.1,
      maturityLabel: 'Sep 2027',
      tenorMonths: 36,
      status: 'Compliant',
    },
  ],
  covenantAlerts: [
    {
      dealId: 'VD-2023-0101',
      borrower: 'Axon Therapeutics',
      covenant: 'Min. Cash Runway',
      threshold: '>= 6 months',
      currentValue: '4.2 months',
      status: 'Breach Risk',
    },
    {
      dealId: 'VD-2023-0101',
      borrower: 'Axon Therapeutics',
      covenant: 'Revenue Coverage',
      threshold: '>= 1.10x',
      currentValue: '1.05x',
      status: 'Breach Risk',
    },
    {
      dealId: 'VD-2024-0112',
      borrower: 'ClearPath Analytics',
      covenant: 'Min. Cash',
      threshold: '>= $1.0M',
      currentValue: '$0.6M',
      status: 'Breach Risk',
    },
    {
      dealId: 'VD-2024-0112',
      borrower: 'ClearPath Analytics',
      covenant: 'GMV Growth QoQ',
      threshold: '>= 20%',
      currentValue: '11.4%',
      status: 'Breach Risk',
    },
    {
      dealId: 'VD-2024-0111',
      borrower: 'Titan Semiconductors',
      covenant: 'Gross Margin',
      threshold: '>= 55%',
      currentValue: '53.2%',
      status: 'Monitoring',
    },
  ],
  growthMetrics: [
    { label: 'Avg Deal Size', value: '$8.4M', subLabel: 'Up vs prior vintages', tone: 'positive' },
    { label: 'Wtd Avg Rate', value: '13.2%', subLabel: 'Coupon drift improved', tone: 'positive' },
    { label: 'Total Fee Income', value: '$1.77M', subLabel: 'From origination + EOT fees', tone: 'positive' },
    { label: 'PIK Exposure', value: '$400K', subLabel: '2 deals carrying PIK', tone: 'warning' },
    { label: 'Warrant Coverage', value: '2.46%', subLabel: 'Average across portfolio', tone: 'neutral' },
    { label: 'Compliance Rate', value: '67%', subLabel: '4/6 deals compliant', tone: 'warning' },
  ],
}
