import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "SJ-FACT Next", description: "Facturación y compras" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>        
        <div className="grid grid-cols-[240px_1fr] min-h-screen">
          <aside className="bg-gray-100 border-r border-gray-200 p-4">
            <h1 className="text-xl font-semibold mb-4">SJ-Facturación</h1>
            <nav className="space-y-2">
              <Link href="/facturas" className="block px-3 py-2 rounded hover:bg-gray-200">Facturas</Link>
              <Link href="/compras" className="block px-3 py-2 rounded hover:bg-gray-200">Compras</Link>
              <Link href="/productos" className="block px-3 py-2 rounded hover:bg-gray-200">Productos</Link>
              <Link href="/listas" className="block px-3 py-2 rounded hover:bg-gray-200">Listas</Link>
            </nav>
          </aside>
          <main className="p-6 overflow-y-auto bg-white">{children}</main>
        </div>
      </body>
    </html>
  );
}
