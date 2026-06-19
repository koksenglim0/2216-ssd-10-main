export const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'D' },
  { to: '/send-money', label: 'Send Money', icon: 'S' },
  { to: '/exchange', label: 'Exchange', icon: 'X' },
  { to: '/history', label: 'History', icon: 'H' },
]

export const utilityNav = [
  { to: '/add-funds', label: 'Add Funds', icon: '+' },
  { to: '/admin', label: 'Admin Portal', icon: 'A', roles: ['admin', 'support'] },
]

export const defaultCurrencies = ['SGD', 'USD', 'EUR', 'GBP', 'JPY', 'MYR', 'AUD', 'CAD', 'INR']
