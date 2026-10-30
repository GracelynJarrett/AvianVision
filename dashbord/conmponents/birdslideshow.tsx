"use client";
import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

type Bird = {
    species_label: string;
    scientific_name: string;
    fun_fact: string | null;
};

export default function BirdSlideshow() {
    const [birds, setBirds] = useState<Bird[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch a fresh set of random birds from the API when the component first loads
    useEffect(() => {
        fetch(`${API_BASE}/birds/random?count=6`)
            .then((res) => res.json())
            .then((data) => {
                setBirds(data.birds ?? []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Auto-advance the slideshow every 7 seconds unless the user has paused it
    useEffect(() => {
        if (isPaused || birds.length === 0) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % birds.length);
        }, 7000);

        return () => clearInterval(timer);
    }, [isPaused, birds.length]);

    const showPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + birds.length) % birds.length);
    };

    const showNext = () => {
        setCurrentIndex((prev) => (prev + 1) % birds.length);
    };

    // Show a placeholder while the API call is in flight
    if (loading) {
        return (
            <section className="relative h-[400px] w-full overflow-hidden rounded-xl bg-[#000000] flex items-center justify-center">
                <p className="text-white">Loading birds...</p>
            </section>
        );
    }

    // Show a fallback if the API returned nothing
    if (birds.length === 0) {
        return (
            <section className="relative h-[400px] w-full overflow-hidden rounded-xl bg-[#000000] flex items-center justify-center">
                <p className="text-white">No birds available.</p>
            </section>
        );
    }

    const current = birds[currentIndex];

    // Build the image URL using the species label — the API handles the lookup
    const imageUrl = `${API_BASE}/bird/${encodeURIComponent(current.species_label)}/image`;

    return (
        <section
            className="relative h-[400px] w-full overflow-hidden rounded-xl bg-[#000000]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <img
                src={imageUrl}
                alt={current.species_label}
                className="h-full w-full object-cover"
            />

            <div className="absolute inset-y-0 left-0 w-1/4 bg-black/60 p-6 text-white">
                <h2 className="text-2xl font-bold font-serif">
                    {current.species_label}
                </h2>

                <p className="mt-1 text-xs italic text-white/70">
                    {current.scientific_name}
                </p>

                <p className="mt-4 text-sm">
                    {current.fun_fact ?? ""}
                </p>

                <a
                    href="/bird"
                    className="mt-4 inline-block text-[#fff99d] underline underline-offset-4 hover:text-[#F5E400]"
                >
                    Learn more
                </a>
            </div>

            {/* Previous button */}
            <button
                onClick={showPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-white hover:bg-black/80"
                aria-label="Previous bird"
            >
                &#10094;
            </button>

            {/* Next button */}
            <button
                onClick={showNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-white hover:bg-black/80"
                aria-label="Next bird"
            >
                &#10095;
            </button>

            {/* Navigation dots */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {birds.map((bird, index) => (
                    <button
                        key={bird.species_label}
                        onClick={() => setCurrentIndex(index)}
                        className={`h-3 w-3 rounded-full transition-colors ${
                            currentIndex === index ? "bg-white" : "bg-black/60"
                        }`}
                        aria-label={`Go to ${bird.species_label}`}
                        aria-current={currentIndex === index ? "true" : undefined}
                    />
                ))}
            </div>
        </section>
    );
}
