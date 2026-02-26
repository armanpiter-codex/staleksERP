import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        staleks: {
          lime: "#C0DF16",
          "lime-dark": "#A8C510",
          sidebar: "#212322",
          bg: "#FAF9F5",
          muted: "#969C99",
          error: "#DF1616",
        },
        brand: {
          orange: "#C0DF16",
          "orange-dark": "#A8C510",
        },
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
