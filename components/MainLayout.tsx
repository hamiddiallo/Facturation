'use client';

import { usePathname } from 'next/navigation';
import Sidebar from "@/components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isNoSidebar = pathname === '/login' || pathname === '/preview';

    return (
        <div className="mainLayout">
            <Sidebar />
            <main className={`contentWrapper ${isNoSidebar ? 'noSidebar' : ''}`}>
                {children}
            </main>
        </div>
    );
}
