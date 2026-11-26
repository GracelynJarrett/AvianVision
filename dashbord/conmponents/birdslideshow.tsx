"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

// One bird returned by the /birds/random API
type Bird = {
    species_label: string;
    scientific_name: string;
    fun_fact: string | null;
};

// Home page banner: welcome text on the left, rotating featured bird photo on the right
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


    // Go back one slide, wrapping to the last bird from the first
    const showPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + birds.length) % birds.length);
    };

    // Go forward one slide, wrapping to the first bird from the last
    const showNext = () => {
        setCurrentIndex((prev) => (prev + 1) % birds.length);
    };

    // The current bird (undefined while loading or if the API returned nothing)
    const current = birds[currentIndex];

    // Use the Wikimedia plumage photo if one was found; otherwise fall back to the dataset image
    // Use the bird's main Hugging Face dataset photo (photo 0, same as the bird page)
    const imageUrl = current
        ? `${API_BASE}/bird/${encodeURIComponent(current.species_label)}/image?photo=0`
        : null;
    return (
        <section className="grid grid-cols-1 md:grid-cols-[45%_55%] h-auto md:h-[480px] w-full overflow-hidden rounded-xl bg-[#232629]">

            {/* LEFT SIDE: welcome text, buttons, and featured bird info */}
            <div className="flex flex-col p-8 text-white">

                {/* Small tags above the title */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2 py-0.5 bg-[#3b4045] text-white text-sm font-semibold rounded">AI identification</span>
                    <span className="px-2 py-0.5 bg-[#3b4045] text-white text-sm font-semibold rounded">525 species</span>
                </div>

                {/* Welcome title and tagline */}
                <h1 className="text-4xl font-bold leading-tight mb-3">Welcome to AvianVision!</h1>
                <p className="text-base text-[#d6d9dc] leading-relaxed mb-5">
                    Discover bird species through AI-powered image identification and explore the data behind the project.
                </p>

                {/* Quick-access buttons */}
                <div className="flex gap-3 flex-wrap">
                    <Link
                        href="/predict"
                        className="px-5 py-2.5 bg-[#ffbc88] text-[#232629] font-semibold text-base rounded hover:bg-[#ff9f5a] transition-colors"
                    >
                        Identify a bird
                    </Link>
                    <Link
                        href="/bird"
                        className="px-5 py-2.5 bg-[#2d3135] border border-[#6a737c] text-white font-semibold text-base rounded hover:bg-[#3b4045] transition-colors"
                    >
                        Browse species
                    </Link>
                </div>

                {/* Featured bird info, pushed to the bottom with a line above it */}
                <div className="mt-auto pt-5 border-t border-[#3b4045]">
                    <p className="text-xs uppercase tracking-widest text-[#9199a1]">Featured bird</p>
                    {loading ? (
                        <p className="mt-1 text-[#d6d9dc]">Loading birds...</p>
                    ) : !current ? (
                        <p className="mt-1 text-[#d6d9dc]">No birds available.</p>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold font-serif">{current.species_label}</h2>
                            <p className="text-xs italic text-white/70">{current.scientific_name}</p>
                            {/* Fun fact is cut off after two lines so the panel never overflows */}
                            <p className="mt-2 text-sm line-clamp-2">{current.fun_fact ?? ""}</p>
                            <Link
                                href={`/bird?species=${encodeURIComponent(current.species_label)}`}
                                className="mt-2 inline-block text-[#fff99d] underline underline-offset-4 hover:text-[#F5E400]"
                            >
                                Learn more
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: bird photo with a blurred copy behind it, plus the controls */}
            <div
                className="relative flex flex-col items-center justify-center gap-4 p-8 overflow-hidden min-h-[360px] bg-[#2d3135]"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                {imageUrl && current && (
                    <>
                        {/* Blurred, zoomed copy of the photo that fills the empty space */}
                        <img
                            src={imageUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-60"
                        />

                        {/* The real photo, shown whole at its own shape, never cropped */}
                        <img
                            src={imageUrl}
                            alt={current.species_label}
                            className="relative h-[340px] w-auto max-w-full object-contain rounded-lg shadow-2xl"
                        />
                    </>
                )}

                {/* Previous button, dots, and next button in one row under the photo */}
                {birds.length > 0 && (
                    <div className="relative flex items-center gap-3">
                        <button
                            onClick={showPrevious}
                            className="h-11 w-11 rounded-full bg-black/60 text-white hover:bg-black/80"
                            aria-label="Previous bird"
                        >
                            &#10094;
                        </button>

                        {/* One dot per bird; the white one is the bird on screen */}
                        {birds.map((bird, index) => (
                            <button
                                key={bird.species_label}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-3 w-3 rounded-full transition-colors ${currentIndex === index ? "bg-white" : "bg-white/40"}`}
                                aria-label={`Go to ${bird.species_label}`}
                                aria-current={currentIndex === index ? "true" : undefined}
                            />
                        ))}

                        <button
                            onClick={showNext}
                            className="h-11 w-11 rounded-full bg-black/60 text-white hover:bg-black/80"
                            aria-label="Next bird"
                        >
                            &#10095;
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}