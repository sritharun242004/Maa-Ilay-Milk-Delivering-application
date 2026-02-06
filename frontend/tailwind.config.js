/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand Green - Primary color matching logo
        brand: {
          DEFAULT: '#1B5E20', // Rich Forest Green (logo "maa" color)
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#4CAF50', // Bright accent green (logo "ilay" color)
          600: '#43A047',
          700: '#388E3C',
          800: '#2E7D32',
          900: '#1B5E20',
          hover: '#2E7D32', // Darker green for hover states
          light: '#4CAF50', // Bright green for accents
        },

        // Success Green - For positive actions and confirmations
        success: {
          DEFAULT: '#28A745',
          50: '#E7F7EC',
          100: '#CFEFD9',
          200: '#9FDFB3',
          300: '#6FCF8D',
          400: '#3FBF67',
          500: '#28A745', // Success/Shop Now CTAs
          600: '#208637',
          700: '#186429',
          800: '#10431C',
          900: '#08210E',
        },

        // Warm Neutrals - Subtle backgrounds
        brown: {
          DEFAULT: '#8D6E63', // Warm neutral brown (minimal use)
          50: '#FAFAF9', // Almost white - page backgrounds
          100: '#F5F3F0', // Very light warm gray
          200: '#E8E4DF',
          300: '#D4CEC7',
          400: '#B8AFA5',
          500: '#9C8D82',
          600: '#8D6E63',
          700: '#6D4C41',
          800: '#5D4037',
          900: '#4E342E',
          dark: '#3E2723', // Dark warm brown - footer only
        },

        // Neutral Colors - Text and backgrounds
        neutral: {
          DEFAULT: '#2E3440', // Dark charcoal - primary text
          50: '#FAFAFA', // Almost white - card backgrounds
          100: '#F5F5F5', // Very light gray - borders, dividers
          200: '#E0E0E0',
          300: '#BDBDBD',
          400: '#9E9E9E',
          500: '#757575', // Medium Gray - secondary text
          600: '#616161',
          700: '#424242', // Primary text color
          800: '#2E3440',
          900: '#1A1D23',
        },

        // Cream - Soft warm backgrounds
        cream: {
          DEFAULT: '#FFFBF5',
          50: '#FFFFFF', // Pure white
          100: '#FFFBF5', // Very subtle cream - highlight sections
          200: '#FFF8F0',
          300: '#FFF3E5',
          400: '#FFEFD9',
          500: '#FFE8CC',
        },
      },

      // Custom shadows for depth
      boxShadow: {
        'soft': '0 2px 8px rgba(45, 80, 22, 0.08)',
        'card': '0 4px 12px rgba(45, 80, 22, 0.1)',
        'hover': '0 8px 24px rgba(45, 80, 22, 0.15)',
      },
    },
  },
  plugins: [],
};
