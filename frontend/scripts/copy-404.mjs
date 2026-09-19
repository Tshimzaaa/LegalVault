import { copyFileSync } from 'node:fs'

// Static hosts serve 404.html for paths that are not real files. Serving the app shell there
// lets React Router handle deep links (/staff/dashboard, /login) on reload.
copyFileSync('dist/index.html', 'dist/404.html')
