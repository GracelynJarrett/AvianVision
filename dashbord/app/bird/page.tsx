"use client";
import { useEffect, useState } from "react";






export default function HistoryPage() {
    const [birdNames, setBirdNames] = useState<string[]>([]);
    const defaultBird = "EUROPEAN TURTLE DOVE";

    const [selectedBird, setSelectedBird] = useState(defaultBird);
    const [birdData, setBirdData] = useState<any>(null);
    const [birdImage, setBirdImage] = useState<string | null>(null);
    {/* Load the csv of bird names*/ }
    useEffect(() => {
        fetch("/bird_name_mapping.csv")
            .then(response => response.text())
            .then(data => {
                const names = data
                    .split("\n")
                    .slice(1)
                    .map(row => row.split(",")[0].trim())
                    .filter(name => name.length > 0);

                setBirdNames(names);
            })
            .catch(error => console.error("Error loading bird names:", error));
    }, []);
    {/*Load the bird info*/ }
    useEffect(() => {
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to fetch bird information");
                }
                return response.json();
            })
            .then(data => {
                setBirdData(data.bird);
            })
            .catch(error => console.error("Error loading bird information:", error));
    }, [selectedBird]);

    {/*Load the birds image*/ }
    useEffect(() => {
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}/image`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to fetch bird image");
                }
                return response.blob();
            })
            .then(data => {
                const imageUrl = URL.createObjectURL(data);
                setBirdImage(imageUrl);
            })
            .catch(error => console.error("Error loading bird image:", error));
    }, [selectedBird]);

    return (
        <main className="bg-[#FFFFFF] text-[#3F4850] p-8">
            {/* About This Page */}
            <section>
                <h1 className="text-2xl font-serif font-bold text-center p-10">About This Page</h1>

                <p className="text-lg p-4 max-w-4xl mx-auto px-10">
                    Explore information about different bird species, including
                    their population status, family relationships, descriptions,
                    and migration patterns. Search for a specific species or use
                    the random search feature to discover something new.
                </p>

                <p className="text-lg p-4 max-w-4xl mx-auto px-10">
                    This page was developed as part of an AI-powered bird
                    identification project designed to help researchers identify
                    and explore different bird species. By combining AI image
                    classification with accessible species information, the
                    project aims to support bird research and make species data
                    easier to explore.
                </p>
            </section>
            {birdImage && (
                <img src={birdImage} alt={selectedBird} width="300" />
            )}
        </main>
    );
}