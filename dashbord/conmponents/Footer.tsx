export default function Footer() {
    return (
        <footer className="border-t p-6 mt-8 bg-[#3F4850] text-[#FFFFFF]">
            <div className="grid grid-cols-3">

                <div className="px-8 footer-divider">
                    <h3 className="footer-heading">About the Project</h3>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Testing to see what would happen to text that is really long? whould it wrap around?</p>
                </div>

                <div className="px-8 footer-divider">
                    <h3 className="footer-heading text-center">About the Author</h3>
                    <p>Author information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                </div>

                <div className="px-8">
                    <h3 className="footer-heading">Sources</h3>
                    <p>References and resources go here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                    <p>Project information goes here.</p>
                </div>

            </div>
        </footer>
    );
}