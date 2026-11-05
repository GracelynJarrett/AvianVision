"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation links shown in the header on every page
const navLinks = [
    { href: "/", label: "Home" },
    { href: "/predict", label: "Prediction" },
    { href: "/species", label: "Species" },
    { href: "/bird", label: "Bird" },
    { href: "/stats", label: "Stats" },
];

// Maps each route to the page title shown in the center of the header
const pageTitles: { [key: string]: string } = {
    "/": "Home",
    "/predict": "Prediction",
    "/species": "Species",
    "/bird": "Bird",
    "/stats": "Statistics",
};

export default function Header() {

    const pathname = usePathname();
    const pageTitle = pageTitles[pathname] || "AvianVision";

    return (
        // Single horizontal bar: logo left | page title center | nav right
        <header className="py-3 font-serif bg-[#C9C9C9] text-[#3F4850] border-b border-[#3F4850]/20">
            <div className="relative flex items-center justify-between px-6">

                {/* Logo and brand name — left side */}
                <div className="flex items-center gap-8">
                    <span className="text-lg text-[#3F4850]/50">[Logo]</span>
                    <span className="text-2xl font-bold font-serif tracking-tight">AvianVision</span>
                </div>

                {/* Current page title — pinned to the center of the full header width */}
                <div className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl font-semibold pointer-events-none">
                    {pageTitle}
                </div>

                {/* Navigation links — right side */}
                <nav className="flex gap-5" aria-label="Main navigation">
                    {navLinks.map(({ href, label }) => {
                        // Highlight the button for whichever page the user is currently on
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`px-4 py-2 rounded text-lg font-medium transition-colors duration-200 ${isActive
                                    ? "bg-[#3F4850] text-white"
                                    : "bg-white text-[#3F4850] hover:bg-[#3F4850] hover:text-white"
                                    }`}
                                aria-current={isActive ? "page" : undefined}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>

            </div>
        </header>
    );
}
