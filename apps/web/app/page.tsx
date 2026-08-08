import { redirect } from 'next/navigation';

// A raiz nao tem conteudo proprio: o middleware decide, com base na
// sessao, se o visitante vai para o dashboard ou para o login.
export default function HomePage() {
  redirect('/dashboard');
}
