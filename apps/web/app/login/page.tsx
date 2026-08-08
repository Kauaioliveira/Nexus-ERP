import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Entrar | Nexus ERP',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Nexus ERP</h1>
        <p className="mt-1 text-sm text-slate-500">Entre com sua conta para continuar.</p>
        <LoginForm />
      </div>
    </main>
  );
}
