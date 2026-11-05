// Footer shown on every page — three columns: project info, author, and sources
export default function Footer() {
    return (
        <footer className="bg-[#3F4850] text-[#FFFFFF]">

            {/* Thin yellow accent line at the top to tie into the site color palette */}
            <div className="h-1 bg-[#fff99d]" />

            <div className="grid grid-cols-3 py-10 px-4">

                {/* Column 1: About the project */}
                <div className="px-8 footer-divider">
                    <h3 className="footer-heading text-[#fff99d]">About the Project</h3>
                    <p>
                        AvianVision is a computer science capstone project that uses a trained
                        AI model (EfficientNetB0) to identify 525 bird species from uploaded images.
                    </p>
                    <p>
                        Each prediction is enriched with real-world data including conservation
                        status, migration patterns, and diet information.
                    </p>
                </div>

                {/* Column 2: About the author */}
                <div className="px-8 footer-divider">
                    <h3 className="footer-heading text-center text-[#fff99d]">About the Author</h3>
                    <p>
                        Gracelyn Jarrett is a computer science student at Neumont University.
                        This project was built as her senior capstone.
                    </p>
                    <p>
                        Contact:{" "}
                        <a
                            href="mailto:gjarrett@student.neumont.edu"
                            className="underline underline-offset-4 hover:text-[#fff99d] transition-colors"
                        >
                            gjarrett@student.neumont.edu
                        </a>
                    </p>
                </div>

                {/* Column 3: Data sources used in the project */}
                <div className="px-8">
                    <h3 className="footer-heading text-[#fff99d]">Sources</h3>
                    <p>GBIF — Global Biodiversity Information Facility (bird observation data)</p>
                    <p>IUCN Red List — conservation status</p>
                    <p>Avian Diet Database — diet and prey data</p>
                    <p>HuggingFace: yashikota/birds-525-species-image-classification</p>
                    <p>Wikipedia — species descriptions and plumage information</p>
                </div>

            </div>
        </footer>
    );
}
