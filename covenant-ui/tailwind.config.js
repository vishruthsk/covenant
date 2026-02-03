/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0B0E14', // Deep void
                surface: '#151921',    // Panel background
                border: '#2A2F3A',     // Subtle separation
                primary: {
                    DEFAULT: '#7C3AED',  // Violet 600
                    hover: '#8B5CF6',    // Violet 500
                    glow: 'rgba(124, 58, 237, 0.5)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}
