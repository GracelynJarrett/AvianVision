"use client";
import { useEffect, useState } from "react";
import BirdSlideshow from "@/conmponents/birdslideshow";
import Link from "next/link";


// The three cards that explain what AvianVision is and why it exists
const projectSections = [
  {
    title: "Why",
    description:
      "Make bird species identification more accessible through artificial intelligence.",
    color: "bg-[#fff99d]",
  },
  {
    title: "How",
    description:
      "Use a trained AI model to predict bird species from images.",
    color: "bg-[#ffd6b6]",
  },
  {
    title: "What",
    description:
      "Explore bird identification, species information, and project data.",
    color: "bg-[#fffdde]",
  },
];

// The four navigation cards that link to the main sections of the app
const exploreLinks = [
  {
    href: "/predict",
    title: "Prediction",
    description: "Identify a bird species using an AI-powered image prediction.",
    color: "bg-[#fff99d]",
  },
  {
    href: "/bird",
    title: "Bird",
    description: "Look up information about an individual bird species.",
    color: "bg-[#ffbc88]",
  },
  {
    href: "/species",
    title: "Species",
    description: "Compare different bird species side by side.",
    color: "bg-[#ffbc88]",
  },
  {
    href: "/stats",
    title: "Model Metrics",
    description: "Explore the performance of the AvianVision AI model.",
    color: "bg-[#fff99d]",
  },
];


export default function Home() {
  const [speciesCount, setSpeciesCount] = useState<number | null>(null);
  const [countryCount, setCountryCount] = useState<number | null>(null);
  const [yearRange, setYearRange] = useState<{ min: number | null; max: number | null } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [f1Score, setF1Score] = useState<number | null>(null);
  const [loss, setLoss] = useState<number | null>(null);
  const [predictionCount, setPredictionCount] = useState<number | null>(null);

  // Fetch dashboard statistics from the API when the page first loads
  useEffect(() => {
    fetch("http://127.0.0.1:8000/home")
      .then((response) => response.json())
      .then((data) => {
        setSpeciesCount(data.dataset.species_count);
        setCountryCount(data.coverage.country_count);
        setYearRange(data.coverage.year_range);
        setAccuracy(data.model.accuracy);
        setF1Score(data.model.f1_score);
        setLoss(data.model.loss);
        setPredictionCount(data.predictions.total_predictions);
      })
      .catch((error) => {
        console.error("Error fetching home statistics:", error);
      });
  }, []);


  return (
    // No horizontal padding on <main> so the slideshow and dark stats band can span the full width
    <main className="bg-[#FFFFFF]">
      <BirdSlideshow />

      {/* Welcome section — project tagline and Why/How/What cards */}
      <section className="mt-12 py-16 px-8">
        <h1 className="font-serif text-4xl font-bold text-[#333333] text-center underline text">
          Welcome to AvianVision!
        </h1>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr] md:items-stretch">
          <p className="flex items-center justify-center text-center text-[#3F4850] text-2xl">
            Discover bird species through AI-powered image identification
            and explore the data behind the project.
          </p>

          {/* Why, How, and What cards */}
          <div className="grid grid-cols-1 gap-8 px-25">
            {projectSections.map((item) => (
              <article
                key={item.title}
                className={`${item.color} rounded-xl p-8 text-[#333333] `}
              >
                <h2 className="font-serif text-2xl font-bold">{item.title}</h2>
                <p className="mt-2 leading-relaxed text-xl">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AvianVision at a Glance — live stats from the API */}
      <section className="bg-[#333333] px-8 py-14 text-white">
        <h2 className="text-center font-serif text-3xl font-bold text-[#fff99d]">
          AvianVision at a Glance
        </h2>

        {/* Top four stat cards */}
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-6 text-center">
            <h3 className="font-serif text-2xl font-bold text-[#fff99d]">Dataset</h3>
            <p className="mt-3 text-3xl font-bold">{speciesCount ?? "—"}</p>
            <p className="mt-2 text-lg text-[#C9C9C9]">Species</p>
          </div>

          <div className="rounded-xl bg-white/10 p-6 text-center">
            <h3 className="font-serif text-2xl font-bold text-[#ffbc88]">Coverage</h3>
            <p className="mt-3 text-3xl font-bold">{countryCount ?? "—"}</p>
            <p className="mt-2 text-lg text-[#C9C9C9]">Countries represented</p>
          </div>

          <div className="rounded-xl bg-white/10 p-6 text-center">
            <h3 className="font-serif text-2xl font-bold text-[#fff99d]">Observations</h3>
            <p className="mt-3 text-3xl font-bold">
              {yearRange?.min ?? "—"} – {yearRange?.max ?? "—"}
            </p>
            <p className="mt-2 text-lg text-[#C9C9C9]">Year range</p>
          </div>

          <div className="rounded-xl bg-white/10 p-6 text-center">
            <h3 className="font-serif text-2xl font-bold text-[#ffbc88]">Predictions</h3>
            <p className="mt-3 text-3xl font-bold">{predictionCount ?? "—"}</p>
            <p className="mt-2 text-lg text-[#C9C9C9]">Total predictions made</p>
          </div>
        </div>

        {/* AI model metrics card — spans the full width below the four cards */}
        <div className="mt-6 rounded-xl bg-white/10 p-8 text-center">
          <h3 className="font-serif text-2xl font-bold text-[#fff99d]">AI Model Performance</h3>
          <div className="mt-6 flex flex-wrap justify-center gap-12">
            <div>
              <p className="text-lg text-[#C9C9C9]">Accuracy</p>
              <p className="mt-1 text-3xl font-bold">
                {accuracy !== null ? `${(accuracy * 100).toFixed(2)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-lg text-[#C9C9C9]">F1 Score</p>
              <p className="mt-1 text-3xl font-bold">
                {f1Score !== null ? `${(f1Score * 100).toFixed(2)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-lg text-[#C9C9C9]">Loss</p>
              <p className="mt-1 text-3xl font-bold">
                {loss !== null ? loss.toFixed(4) : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore AvianVision — navigation cards linking to the four main pages */}
      <section className="px-8 py-20">
        <h2 className="text-center font-serif text-3xl font-bold text-[#333333]">
          Explore AvianVision
        </h2>

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-8 md:grid-cols-2">
          {exploreLinks.map(({ href, title, description, color }) => (
            <div
              key={href}
              className={`${color} rounded-xl p-10 text-[#333333] transition hover:shadow-lg`}
            >
              <h3 className="font-serif text-2xl font-bold">
                <Link href={href} className="hover:underline">
                  {title} →
                </Link>
              </h3>
              <p className="mt-4 text-lg">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Prediction Disclaimer */}
      <section className="mx-30 mb-20 rounded-xl bg-[#fff3d6] p-15 text-[#333333]">
        <div className="flex items-center gap-5">
          <span className="text-5xl">⚠️</span>
          <h2 className="font-serif text-4xl font-bold">AI Prediction Disclaimer</h2>
        </div>
        <p className="mt-5 text-2xl leading-relaxed">
          AI predictions may not always be accurate. Please verify
          results using reliable sources before making decisions.
        </p>
      </section>

    </main>
  );
}
