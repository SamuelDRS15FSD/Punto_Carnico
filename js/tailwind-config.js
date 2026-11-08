// Configuración de Tailwind: los colores apuntan a variables CSS para poder
// cambiar la paleta completa al alternar entre carne bovina y porcina.
if (window.tailwind) {
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          bg: 'var(--bg)', surface: 'var(--surface)', ink: 'var(--ink)',
          muted: 'var(--muted)', line: 'var(--line)',
          accent: 'var(--accent)', 'accent-ink': 'var(--accent-ink)',
          'accent-soft': 'var(--accent-soft)', gold: 'var(--gold)'
        },
        fontFamily: {
          display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
          sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif']
        }
      }
    }
  };
}
