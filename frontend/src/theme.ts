/**
 * Maa Ilay - Traditional Milk Delivery Theme
 *
 * Authentic farmer/village aesthetic with earthy, natural colors
 * representing organic farming and traditional milk delivery
 */

export const theme = {
  // Primary Brand Colors (matching logo)
  colors: {
    // Main brand color - Rich Forest Green (logo green)
    primary: '#1B5E20',
    primaryHover: '#2E7D32',
    primaryLight: '#4CAF50', // Bright accent green

    // Success/Positive actions
    success: '#4CAF50',

    // Warm Neutrals - Minimal use
    brown: '#8D6E63',
    brownDark: '#3E2723',

    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#FAFAF9', // Very light warm gray
    bgCream: '#FFFBF5',
    bgCard: '#FAFAFA',

    // Text colors
    textPrimary: '#2E3440',
    textSecondary: '#757575',

    // Borders & dividers
    border: '#F5F5F5',

    // Status colors
    error: '#DC3545',
    warning: '#FFC107',
    info: '#17A2B8',
  },

  // Typography
  typography: {
    fontFamily: {
      heading: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
  },

  // Spacing scale (8px base)
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },

  // Border radius
  borderRadius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(45, 80, 22, 0.05)',
    md: '0 4px 6px -1px rgba(45, 80, 22, 0.1)',
    lg: '0 10px 15px -3px rgba(45, 80, 22, 0.1)',
    xl: '0 20px 25px -5px rgba(45, 80, 22, 0.1)',
  },
};

// Component-specific styles
export const components = {
  // Button styles
  button: {
    primary: 'bg-brand hover:bg-brand-hover text-white font-medium rounded-lg transition-all duration-200 shadow-soft hover:shadow-card',
    secondary: 'bg-brown hover:bg-brown-dark text-white font-medium rounded-lg transition-all duration-200',
    success: 'bg-success hover:bg-success-600 text-white font-medium rounded-lg transition-all duration-200',
    outline: 'border-2 border-brand text-brand hover:bg-brand hover:text-white font-medium rounded-lg transition-all duration-200',
  },

  // Card styles
  card: {
    default: 'bg-white rounded-xl shadow-card p-6 border border-neutral-100',
    hover: 'bg-white rounded-xl shadow-card hover:shadow-hover p-6 border border-neutral-100 transition-all duration-200',
    cream: 'bg-cream-100 rounded-xl p-6 border border-brown-100',
  },

  // Input styles
  input: {
    default: 'w-full px-4 py-2.5 border border-neutral-100 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand transition-all duration-200',
  },

  // Badge styles
  badge: {
    success: 'bg-success-100 text-success-700 px-3 py-1 rounded-full text-sm font-medium',
    warning: 'bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium',
    error: 'bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium',
    info: 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium',
  },
};

export default theme;
