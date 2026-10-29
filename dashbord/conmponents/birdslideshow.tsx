"use client";
import { useState, useEffect } from "react";

type Bird = {
    name: string;
    description: string;
    image: string;
    link: string;
};

const sampleBirds: Bird[] = [
    {
        name: "Bald Eagle",
        description:
            "A large bird of prey known for its white head and powerful beak.",
        image:
            "https://images.unsplash.com/photo-1611689342806-0863700ce1e4",
        link: "/bird",
    },
    {
        name: "Blue Jay",
        description:
            "An intelligent songbird recognized by its blue feathers and crest.",
        image:
            "https://images.unsplash.com/photo-1552728089-57bdde30beb3",
        link: "/bird",
    },
    {
        name: "Owl",
        description:
            "A bird with forward-facing eyes and adaptations for hunting.",
        image:
            "https://images.unsplash.com/photo-1579019163248-e7761241d5a5",
        link: "/bird",
    },
];



export default function BirdSlideshow() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;

        const timer = setInterval(() => {
            setCurrentIndex((previousIndex) =>
                (previousIndex + 1) % sampleBirds.length
            );
        }, 7000);

        return () => clearInterval(timer);
    }, [isPaused]
    );

    const showPrevious = () => {
        setCurrentIndex((previousIndex) =>
            (previousIndex - 1 + sampleBirds.length) % sampleBirds.length
        );
    };

    const showNext = () => {
        setCurrentIndex((previousIndex) =>
            (previousIndex + 1) % sampleBirds.length
        );
    };







    return (
        <section
            className="relative h-[400px] w-full overflow-hidden rounded-xl bg-[#000000]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <img
                src={sampleBirds[currentIndex].image}
                alt={sampleBirds[currentIndex].name}
                className="h-full w-full object-cover"
            />
            <div className="absolute inset-y-0 left-0 w-1/4 bg-black/60 p-6 text-white">
                <h2 className="text-2xl font-bold font-serif">
                    {sampleBirds[currentIndex].name}
                </h2>

                <p className="mt-4 text-sm">
                    {sampleBirds[currentIndex].description}
                </p>

                <a
                    href={sampleBirds[currentIndex].link}
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
                {sampleBirds.map((bird, index) => (
                    <button
                        key={bird.name}
                        onClick={() => setCurrentIndex(index)}
                        className={`h-3 w-3 rounded-full transition-colors ${currentIndex === index
                            ? "bg-white"
                            : "bg-black/60"
                            }`}
                        aria-label={`Go to ${bird.name}`}
                        aria-current={currentIndex === index ? "true" : undefined}
                    />
                ))}
            </div>



        </section>
    )
}