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
        statusBarStyle: "default",
        title: "Master",
    },
    icons: {
        apple: [
            { url: "/icon.png", sizes: "1024x1024", type: "image/jpeg" },
        ],
    },
};

import AuthProvider from "@/components/AuthProvider";
import MainLayout from "@/components/MainLayout";
import SWRConfigContext from "@/components/SWRConfigContext";
import { Toaster } from "sonner";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <AuthProvider>
                    <SWRConfigContext>
                        <MainLayout>
                            {children}
                            <Toaster position="top-right" richColors closeButton />
                        </MainLayout>
                    </SWRConfigContext>
                </AuthProvider>
            </body>
        </html>
    );
}
