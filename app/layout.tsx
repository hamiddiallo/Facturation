import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Générateur de Factures - Master",
    description: "Créez vos factures professionnelles en quelques clics.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Master",
    },
    icons: {
        apple: [
            { url: "/icon.png", sizes: "180x180", type: "image/png" },
            { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
        ],
    },
    other: {
        // Désactiver la détection automatique de numéros de téléphone sur iOS
        'format-detection': 'telephone=no',
    },
};

import AuthProvider from "@/components/AuthProvider";
import MainLayout from "@/components/MainLayout";
import SWRConfigContext from "@/components/SWRConfigContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "sonner";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr">
            <head>
                {/* viewport-fit=cover : permet d'utiliser toute la surface de l'écran
                    y compris derrière l'encoche et la barre du bas sur iPhone */}
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                {/* Empêche iOS de détecter et de styliser les numéros de téléphone */}
                <meta name="format-detection" content="telephone=no" />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <ErrorBoundary>
                    <AuthProvider>
                        <SWRConfigContext>
                            <MainLayout>
                                {children}
                                <Toaster position="top-right" richColors closeButton />
                            </MainLayout>
                        </SWRConfigContext>
                    </AuthProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
