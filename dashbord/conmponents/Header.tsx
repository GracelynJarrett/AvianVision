"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";



export default function Header() {

    const pathname = usePathname();

    const pageTitles: { [key: string]: string } = {
        "/": "Home",
        "/predict": "Prediction",
        "/species": "Species",
        "/bird": "Bird",
        "/stats": "Statistics",
    };

    const pageTitle = pageTitles[pathname] || "AvianVision";


    return (
        <header className="py-4 font-serif bg-[#C9C9C9] text-[#3F4850]">


            <div className="header flex justify-between items-center">

                <div className="logosection flex">
                    <p className="flex px-8">[Logo]</p>
                    <p className="text-lg font-serif font-normal">AvianVision</p>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl">
                    {pageTitle}
                </div>

                <nav className="hyperlinks flex gap-6 px-6" >
                    <Link href="/" className="bg-white px-4 py-2 rounded text-[#3F4850] hover:bg-[#3F4850] hover:text-white transition-colors duration-200"> Home </Link>
                    <Link href="/predict" className="bg-white px-4 py-2 rounded text-[#3F4850] hover:bg-[#3F4850] hover:text-white transition-colors duration-200"> Prediction </Link>
                    <Link href="/species" className="bg-white px-4 py-2 rounded text-[#3F4850] hover:bg-[#3F4850] hover:text-white transition-colors duration-200"> Species </Link>
                    <Link href="/bird" className="bg-white px-4 py-2 rounded text-[#3F4850] hover:bg-[#3F4850] hover:text-white transition-colors duration-200"> Bird </Link>
                    <Link href="/stats" className="bg-white px-4 py-2 rounded text-[#3F4850] hover:bg-[#3F4850] hover:text-white transition-colors duration-200"> Stats </Link>
                </nav>

            </div>
            <div className="flex justify-left mt-2 px-5">
                <div className="flex items-center w-1/4 min-w-64 bg-white border border-[#3F4850]/30 rounded-lg px-3 py-2 gap-2">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3F4850"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>

                    <input
                        type="search"
                        placeholder="Search birds..."
                        aria-label="Search birds"
                        className="w-full bg-transparent outline-none text-[#3F4850] placeholder:text-gray-500"
                    />
                </div>
            </div>


        </header>
    );
}