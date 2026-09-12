/** @type {import('tailwindcss').Config} */
module.exports = {
    /**
     * WARUM MAN AUF MANCHEN HANDYS ZWEIMAL TIPPEN MUSSTE
     *
     * Im Quelltext stehen 435 `hover:`-Klassen. Ohne diesen Schalter erzeugt
     * Tailwind daraus gewoehnliche `:hover`-Regeln — auch fuer Geraete, die
     * gar nicht schweben koennen. Ein Finger kann nicht schweben, also
     * entscheidet der Browser, was ein Tipp bedeutet: Safari auf dem iPhone
     * behandelt den ERSTEN Tipp auf ein Element mit auffaelligem Hover-Stil
     * als "daraufzeigen" und erst den ZWEITEN als Klick. Genau das Verhalten,
     * das sich wie eine haengende App anfuehlt.
     *
     * `hoverOnlyWhenSupported` verpackt jede Hover-Regel in
     * `@media (hover: hover)`. Auf dem Handy gibt es dann keinen Hover-Stil
     * mehr, und der erste Tipp ist der Klick. Am Rechner aendert sich nichts.
     *
     * Das ist eine Einstellung und keine Sammlung von Einzelkorrekturen —
     * 435 Stellen von Hand zu entschaerfen waere aussichtslos, und die naechste
     * neue Klasse haette den Fehler wieder.
     */
    future: {
        hoverOnlyWhenSupported: true,
    },
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		/* Zusaetzliche Stufe fuer schmale Handys (iPhone SE ist 375px breit) */
  		screens: {
  			xs: '400px'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}