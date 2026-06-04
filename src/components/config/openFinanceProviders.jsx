/**
 * Open Finance Provider Configuration
 * Maps provider IDs to their display names, logos, and metadata
 */

export const PROVIDERS = {
  leumi: {
    id: 'leumi',
    name: 'בנק לאומי',
    displayName: 'לאומי',
    color: '#E31937',
    logo: '🏦',
    logoUrl: 'https://logo.clearbit.com/leumi.co.il',
    category: 'bank',
    supported: true
  },
  hapoalim: {
    id: 'hapoalim',
    name: 'בנק הפועלים',
    displayName: 'הפועלים',
    color: '#0047BB',
    logo: '🏦',
    logoUrl: 'https://logo.clearbit.com/bankhapoalim.co.il',
    category: 'bank',
    supported: true
  },
  mizrahi: {
    id: 'mizrahi',
    name: 'מזרחי טפחות',
    displayName: 'מזרחי טפחות',
    color: '#00A6A0',
    logo: '🏦',
    logoUrl: 'https://logo.clearbit.com/mizrahi-tefahot.co.il',
    category: 'bank',
    supported: true
  },
  discount: {
    id: 'discount',
    name: 'בנק דיסקונט',
    displayName: 'דיסקונט',
    color: '#00529B',
    logo: '🏦',
    logoUrl: 'https://logo.clearbit.com/discountbank.co.il',
    category: 'bank',
    supported: true
  },
  beinleumi: {
    id: 'beinleumi',
    name: 'הבינלאומי',
    displayName: 'הבינלאומי',
    color: '#ED8B00',
    logo: '🏦',
    logoUrl: 'https://logo.clearbit.com/fibi.co.il',
    category: 'bank',
    supported: true
  },
  yahavcredit: {
    id: 'yahavcredit',
    name: 'יהב - אשראי',
    displayName: 'יהב',
    color: '#4A5D23',
    logo: '💳',
    logoUrl: 'https://logo.clearbit.com/bank-yahav.co.il',
    category: 'credit',
    supported: true
  }
};

export const getProviderById = (id) => PROVIDERS[id] || null;

export const getAllProviders = () => Object.values(PROVIDERS);

export const getSupportedProviders = () =>
  Object.values(PROVIDERS).filter(p => p.supported || p.comingSoon);

export const getProvidersByCategory = (category) => 
  Object.values(PROVIDERS).filter(p => p.category === category);