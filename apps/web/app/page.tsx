import { redirect } from 'next/navigation';

// A raiz nao tem conteudo proprio: o proxy decide, com base na
// sessao, se o visitante vai para o dashboard ou para o login.
export default function HomePage() {
  redirect('/dashboard');
}
