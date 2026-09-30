// ESLint 9 (flat config). O Next 16 removeu o `next lint`; o lint roda
// direto pelo CLI do ESLint com a config oficial do Next.
import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [...nextVitals, { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] }];

export default config;
