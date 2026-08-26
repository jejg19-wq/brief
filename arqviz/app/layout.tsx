import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'numan — estudio 3D',
  description:
    'Sube un plano arquitectónico y genera renders fotorrealistas y videos recorrido con IA para presentar a tus clientes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
