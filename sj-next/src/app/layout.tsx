"use client"
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { useState } from "react";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "SJ-FACT Next", description: "Facturación y compras" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>        
        <div className="grid md:grid-cols-[240px_1fr] grid-cols-1 min-h-screen">
          <aside className="hidden md:block bg-gray-100 border-r border-gray-200 p-4">
            <h1 className="text-xl font-semibold mb-4">SJ-Facturación</h1>
            <nav className="space-y-2">
              <Link href="/facturas" className="block px-3 py-2 rounded hover:bg-gray-200">Facturas</Link>
              <Link href="/compras" className="block px-3 py-2 rounded hover:bg-gray-200">Compras</Link>
              <Link href="/productos" className="block px-3 py-2 rounded hover:bg-gray-200">Productos</Link>
              <Link href="/listas" className="block px-3 py-2 rounded hover:bg-gray-200">Listas</Link>
            </nav>
          </aside>
          {menuOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)}>
              <div className="absolute left-0 top-0 h-full w-64 bg-gray-100 border-r border-gray-200 p-4" onClick={e => e.stopPropagation()}>
                <h1 className="text-xl font-semibold mb-4">SJ-Facturación</h1>
                <nav className="space-y-2">
                  <Link href="/facturas" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-200">Facturas</Link>
                  <Link href="/compras" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-200">Compras</Link>
                  <Link href="/productos" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-200">Productos</Link>
                  <Link href="/listas" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-200">Listas</Link>
                </nav>
              </div>
            </div>
          )}
          <main className="p-4 md:p-6 overflow-y-auto bg-white">
            <div className="md:hidden flex items-center justify-between mb-3 mt-1">
              <button className="px-3 py-2 rounded-md border" onClick={() => setMenuOpen(true)}>Menú</button>
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
