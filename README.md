# BREG Personal — Financial Operating System

## 🧠 Descripción
PWA fintech para economía informal. Captura trabajo real, impone disciplina financiera automatica, construye capital.

## 🚀 Instalación rápida

```bash
# Servidor local (cualquiera de estos):
python3 -m http.server 8080
npx serve .
npx http-server . -p 8080
```

Luego abre http://localhost:8080 en tu navegador y agrega a pantalla de inicio.

## 📁 Estructura

```
breg-personal/
├── index.html       # Shell PWA + todas las vistas
├── styles.css       # Design system completo (dark/light/zen)
├── app.js           # Core orquestador
├── db.js            # Persistencia + seguridad + sanitización
├── finance.js       # Motor financiero (BREG 15%, deuda SOFR)
├── ui.js            # Render del DOM (sin innerHTML inseguro)
├── charts.js        # Gráficos canvas nativos (sin librerías)
├── theme.js         # Gestión de temas
├── sw.js            # Service Worker (offline real)
├── manifest.json    # PWA manifest
└── icons/           # App icons
    └── icon.svg     # Ícono B con patrón andino
```

## 🔐 Seguridad por diseño

- **CSP** (Content Security Policy) en el HTML: bloquea XSS, inline eval, iframes
- **Sanitización** en db.js: todos los inputs pasan por sanitizeString/sanitizeNumber antes de guardarse
- **escapeHTML** en ui.js y app.js: nunca innerHTML sin escapar
- **X-Content-Type-Options** y **X-Frame-Options** en meta tags
- **Sin eval()**, sin Function(), sin innerHTML de datos del usuario
- **HTTPS requerido** para SW en producción

## 💰 Motor financiero

| Concepto | Fórmula |
|---|---|
| Capital semilla | `neto × 0.15` |
| Deuda base | `abs(neto_negativo) × 1.04` |
| Interés diario | `deuda × ((SOFR 5.4% + 4%) / 365)` |
| CLP/hora | `neto / horas_trabajadas` |

## 🎨 Paleta de marca

| Token | Color | Uso |
|---|---|---|
| `--breg-purple` | `#8B2FC9` | Inicio del gradiente |
| `--breg-blue` | `#3B4FE8` | Gradiente medio |
| `--breg-cyan` | `#00C8F8` | Acento / fin gradiente |
| `--success` | `#00E5A0` | Neto positivo |
| `--danger` | `#FF4747` | Deuda / negativo |

## 🔄 Roadmap

- **Fase 1** (actual): localStorage, lógica local, disciplina básica
- **Fase 2**: IndexedDB, multiusuario local
- **Fase 3**: Firebase/Supabase sync, auth, backup cloud
- **Fase 4 (ZivaPay)**: wallet, créditos, sistema financiero propio

## 📦 Exportación (protocolo BREG–Ziva v2)

```json
{
  "version": "2.0",
  "protocolo": "BREG-Ziva-v2",
  "registros": [...],
  "deuda": { "activa": false, "monto": 0 },
  "config": { "sofrSpread": 0.04 }
}
```

Compatible con futura API Ziva para migración sin pérdida de datos.
