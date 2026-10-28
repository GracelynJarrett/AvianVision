import Link from "next/link";

export default function Header() {
    return (
        <header className="py-6 font-serif bg-[#C9C9C9] text-[#3F4850]">
            <div className="header flex justify-between items-center">

                <div className="logosection flex">
                    <p className="flex px-8">[Logo]</p>
                    <p className="text-lg font-serif font-normal">AvianVision</p>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl">
                    Page Title
                </div>

                <nav className="hyperlinks flex gap-6 px-6" >
                    <Link href="/" className="bg-white px-4 py-2 rounded text-[#3F4850]"> Home </Link>
                    <Link href="/predict" className="bg-white px-4 py-2 rounded text-[#3F4850]"> Prediction </Link>
                    <Link href="/species" className="bg-white px-4 py-2 rounded text-[#3F4850]"> Species </Link>
                    <Link href="/bird" className="bg-white px-4 py-2 rounded text-[#3F4850]"> Bird </Link>
                    <Link href="/stats" className="bg-white px-4 py-2 rounded text-[#3F4850]"> Stats </Link>
                </nav>

            </div>
        </header>
    );
}