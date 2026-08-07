import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus ERP | Controle de Estoque',
  description: 'Controle de estoque multiusuario com dashboards, leitura de codigo de barras e emissao fiscal integrada.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
