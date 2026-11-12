"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation links used in both the sidebar and aria labels
const navLinks = [
    { href: "/", label: "Home" },
    { href: "/predict", label: "Prediction" },
    { href: "/species", label: "Species" },
    { href: "/bird", label: "Bird" },
    { href: "/stats", label: "Stats" },
];

// Left sidebar navigation — sticky column shown on the left of every page, below the header
export function SidebarNav() {
    const pathname = usePathname();
    return (
        <nav
            className="w-[164px] flex-none bg-white border-r border-[#e3e6e8] py-6 flex flex-col gap-0.5 text-base sticky top-[50px] self-start box-border"
            style={{ minHeight: "calc(100vh - 50px)" }}
            aria-label="Main navigation"
        >
            {navLinks.map(({ href, label }) => {
                // Highlight the link for the page the user is currently on
                const isActive = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`block py-2 pl-6 pr-3 transition-colors ${isActive
                            ? "text-[#232629] bg-[#f8f9f9] border-r-[3px] border-[#ffbc88] font-semibold"
                            : "text-[#6a737c] hover:bg-[#f8f9f9]"
                            }`}
                        aria-current={isActive ? "page" : undefined}
                    >
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}

// Top header bar — slim, dark, sticky across all pages; navigation is in SidebarNav
export default function Header() {
    return (
        <header
            className="sticky top-0 z-10 bg-[#232629] h-[50px] flex items-center px-6 gap-3"
            style={{ borderTop: "3px solid #ffbc88" }}
        >
            {/* Brand name — "Vision" is tinted orange to match the brand accent */}
            <span className="font-bold text-[17px] text-white">
                Avian<span className="text-[#ffbc88]">Vision</span>
            </span>
            <span className="ml-auto text-[12px] text-[#9199a1]">Neumont University capstone</span>
        </header>
    );
}
