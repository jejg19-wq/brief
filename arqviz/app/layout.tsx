import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ArqViz Studio — Del plano al render',
  description:
    'Sube un plano arquitectónico y genera renders fotorrealistas y videos recorrido con IA para presentar a tus clientes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
