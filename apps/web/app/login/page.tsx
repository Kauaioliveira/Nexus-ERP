import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-bold">N</span>
          <span className="text-lg font-semibold">Nexus ERP</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Vendas, estoque, compras e financeiro da sua loja num só lugar.
          </h2>
          <ul className="space-y-2 text-sm text-white/70">
            <li>PDV com leitor de código de barras e venda a prazo</li>
            <li>Contas a pagar e a receber com fluxo de caixa</li>
            <li>Pedidos de compra com custo médio automático</li>
            <li>Emissão de NF-e integrada</li>
          </ul>
        </div>
        <p className="text-xs text-white/50">Nexus ERP · projeto open source (MIT)</p>
      </div>
      <div className="flex items-center justify-center bg-slate-50 px-4">
        <div className="card w-full max-w-sm p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Entrar</h1>
          <p className="mt-1 text-sm text-slate-500">Use a conta criada pelo administrador da loja.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
