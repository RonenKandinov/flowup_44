/**
 * Open Finance Provider Configuration
 * Maps provider IDs to their display names and metadata
 */

export const PROVIDERS = {
  hapoalim: {
    id: 'hapoalim',
    name: 'בנק הפועלים',
    displayName: 'בנק הפועלים',
    color: '#0047BB',
    category: 'bank',
    supported: true
  },
  leumi: {
    id: 'leumi',
    name: 'בנק לאומי',
    displayName: 'בנק לאומי',
    color: '#E31937',
    category: 'bank',
    supported: true
  },
  mizrahi: {
    id: 'mizrahi',
    name: 'מזרחי טפחות',
    displayName: 'מזרחי טפחות',
    color: '#00A6A0',
    category: 'bank',
    supported: true
  },
  discount: {
    id: 'discount',
    name: 'בנק דיסקונט',
    displayName: 'בנק דיסקונט',
    color: '#00529B',
    category: 'bank',
    supported: true
  },
  beinleumi: {
    id: 'beinleumi',
    name: 'הבינלאומי',
    displayName: 'הבינלאומי',
    color: '#ED8B00',
    category: 'bank',
    supported: true
  },
  yahavcredit: {
    id: 'yahavcredit',
    name: 'בנק יהב',
    displayName: 'בנק יהב',
    color: '#4A5D23',
    category: 'bank',
    supported: true
  }
};

export const getProviderById = (id) => PROVIDERS[id] || null;

export const getAllProviders = () => Object.values(PROVIDERS);

export const getSupportedProviders = () =>
  Object.values(PROVIDERS).filter(p => p.supported || p.comingSoon);

export const getProvidersByCategory = (category) => 
  Object.values(PROVIDERS).filter(p => p.category === category);