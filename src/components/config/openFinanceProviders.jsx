/**
 * Open Finance Provider Configuration
 * Maps provider IDs to their display names, logos, and metadata
 */

export const PROVIDERS = {
  leumi: {
    id: 'leumi',
    name: 'בנק לאומי',
    displayName: 'LEUMI',
    color: '#E31937',
    logo: '🏦',
    category: 'bank',
    supported: true
  },
  hapoalim: {
    id: 'hapoalim',
    name: 'בנק הפועלים',
    displayName: 'POALIM',
    color: '#0047BB',
    logo: '🏦',
    category: 'bank',
    supported: true
  },
  mizrahi: {
    id: 'mizrahi',
    name: 'מזרחי טפחות',
    displayName: 'MIZRAHI',
    color: '#00A6A0',
    logo: '🏦',
    category: 'bank',
    supported: true
  },
  discount: {
    id: 'discount',
    name: 'בנק דיסקונט',
    displayName: 'DISCOUNT',
    color: '#00529B',
    logo: '🏦',
    category: 'bank',
    supported: true
  },
  beinleumi: {
    id: 'beinleumi',
    name: 'הבינלאומי',
    displayName: 'BEINLEUMI',
    color: '#ED8B00',
    logo: '🏦',
    category: 'bank',
    supported: true
  },
  yahavcredit: {
    id: 'yahavcredit',
    name: 'יהב - אשראי',
    displayName: 'YAHAV',
    color: '#4A5D23',
    logo: '💳',
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