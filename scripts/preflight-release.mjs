const env = process.env
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_AI_GATEWAY_ORIGIN',
]
const errors = []
for (const key of required) if (!env[key]?.trim()) errors.push(`Missing production build variable: ${key}`)
if ((env.VITE_FIREBASE_USE_EMULATORS ?? 'false').toLowerCase() !== 'false') errors.push('Production build cannot use Firebase emulators.')
if ((env.VITE_FIREBASE_ALLOW_REGISTRATION ?? '').toLowerCase() !== 'false') errors.push('Production build must set VITE_FIREBASE_ALLOW_REGISTRATION=false.')
if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_AUTH_DOMAIN !== `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`) errors.push('Firebase AUTH_DOMAIN and PROJECT_ID do not match.')
try {
  const url = new URL(env.VITE_AI_GATEWAY_ORIGIN ?? '')
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.pathname !== '/') throw new Error('invalid')
} catch { errors.push('VITE_AI_GATEWAY_ORIGIN must be one exact HTTPS *.workers.dev origin without a path.') }
if (errors.length) { for (const error of errors) console.error('- '+error); process.exitCode=1 }
else console.log('Production build preflight passed.')
