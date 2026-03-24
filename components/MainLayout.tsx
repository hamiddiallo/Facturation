'use client';

import { usePathname } from 'next/navigation';
import Sidebar from "@/components/Sidebar";
import WeeklyCelebration from "./WeeklyCelebration";
import PullToRefreshStandalone from "./PullToRefreshStandalone";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isNoSidebar = pathname === '/login' || pathname === '/preview';

    return (
        <div className="mainLayout">
            <PullToRefreshStandalone />
            <Sidebar />
            {!isNoSidebar && <WeeklyCelebration />}
            <main className={`contentWrapper ${isNoSidebar ? 'noSidebar' : ''}`}>
                {children}
            </main>
        </div>
    );
}
