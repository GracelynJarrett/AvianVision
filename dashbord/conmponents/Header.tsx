"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
            className="w-[164px] flex-none bg-white dark:bg-[#232629] border-r border-[#e3e6e8] dark:border-[#3b4045] py-6 flex flex-col gap-0.5 text-base sticky top-[50px] self-start box-border"
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
                            ? "text-[#232629] dark:text-white bg-[#f8f9f9] dark:bg-[#2d3135] border-r-[3px] border-[#ffbc88] font-semibold"
                            : "text-[#6a737c] dark:text-[#9199a1] hover:bg-[#f8f9f9] dark:hover:bg-[#2d3135]"
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
// Button that switches between light and dark mode and remembers the choice
function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    // When the page loads, match the button to the saved theme
    useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
    }, []);

    // Flip the theme, update the <html> class, and save it for next visit
    function toggle() {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
    }

    return (
        <button
            onClick={toggle}
            className="text-[12px] text-[#ffbc88] border border-[#ffbc88] rounded px-2 py-1 hover:bg-[#ffbc88] hover:text-[#232629] transition-colors"
            aria-label="Toggle dark mode"
        >
            {isDark ? "Light mode" : "Dark mode"}
        </button>
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
            {/* Light / dark mode switch */}
            <ThemeToggle />
        </header>
    );
}
