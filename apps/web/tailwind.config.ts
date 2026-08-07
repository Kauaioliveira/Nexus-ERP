import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          500: '#3762e4',
          600: '#2c4fc0',
          700: '#243f99',
        },
      },
    },
  },
  plugins: [],
};

export default config;
