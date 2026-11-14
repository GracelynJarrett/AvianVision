// Footer shown on every page — three columns: project info, author, and sources
// Uses div/span instead of h3/p to avoid the global CSS rules in globals.css
export default function Footer() {
    return (
        <footer className="bg-[#232629] text-[#9199a1]" style={{ borderTop: "3px solid #ffbc88" }}>
            <div className="max-w-[1264px] mx-auto py-14 px-8 grid grid-cols-1 md:grid-cols-3 gap-12 text-sm leading-relaxed">

                {/* Column 1: About the project */}
                <div className="flex flex-col gap-3">
                    <div className="font-semibold text-white text-sm">About the Project</div>
                    <div>
                        AvianVision is a computer science capstone project that uses a trained
                        AI model (EfficientNetB0) to identify 525 bird species from uploaded images.
                    </div>
                    <div>
                        Each prediction is enriched with real-world data including conservation
                        status, migration patterns, and diet information.
                    </div>
                </div>

                {/* Column 2: About the author */}
                <div className="flex flex-col gap-3">
                    <div className="font-semibold text-white text-sm">About the Author</div>
                    <div>
                        Gracelyn Jarrett is a computer science student at Neumont University.
                        This project was built as her senior capstone.
                    </div>
                    <div>
                        Contact:{" "}
                        <a
                            href="mailto:gjarrett@student.neumont.edu"
                            className="text-blue-300 hover:text-blue-200 transition-colors"
                        >
                            gjarrett@student.neumont.edu
                        </a>
                    </div>
                </div>

                {/* Column 3: Data sources used in the project */}
                <div className="flex flex-col gap-3">
                    <div className="font-semibold text-white text-sm">Sources</div>
                    <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                        <li>GBIF — Global Biodiversity Information Facility (bird observation data)</li>
                        <li>IUCN Red List — conservation status</li>
                        <li>Avian Diet Database — diet and prey data</li>
                        <li>HuggingFace: yashikota/birds-525-species-image-classification</li>
                        <li>Wikipedia — species descriptions and plumage information</li>
                    </ul>
                </div>

            </div>
        </footer>
    );
}
