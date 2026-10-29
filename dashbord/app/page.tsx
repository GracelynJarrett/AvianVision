"use client";
import { useEffect, useState } from "react";
import BirdSlideshow from "@/conmponents/birdslideshow";
import Link from "next/link";


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




export default function Home() {
  const [speciesCount, setSpeciesCount] = useState<number | null>(null);
  const [observationCount, setObservationCount] = useState<number | null>(null);
  const [countryCount, setCountryCount] = useState<number | null>(null);
  const [yearRange, setYearRange] = useState<{ min: number | null; max: number | null } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [f1Score, setF1Score] = useState<number | null>(null);
  const [loss, setLoss] = useState<number | null>(null);
  const [predictionCount, setPredictionCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("http://127.0.0.1:8000/home")
      .then((response) => {
        console.log("API response status:", response.status);
        return response.json();
      })
      .then((data) => {
        console.log("Full API data:", data);
        setSpeciesCount(data.dataset.species_count);
        setObservationCount(data.dataset.observation_count);

        console.log("Coverage data:", data.coverage);
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
    <main className="p-8 bg-[#FFFFFF] ">
      <BirdSlideshow />

      {/* Welcome */}
      <section className="mt-12 py-20 ">
        <h1 className="font-serif text-4xl font-bold text-[#333333] text-center ">
          Welcome to AvianVision!
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr] md:items-stretch">
          <p className="flex items-center justify-center text-center text-[#3F4850] text-2xl">
            Discover bird species through AI-powered image identification
            and explore the data behind the project.
          </p>


          {/* Why, How, and What cards */}
          <div className="mt-2 grid grid-cols-1 gap-3">
            {projectSections.map((item) => (
              <article
                key={item.title}
                className={`${item.color} rounded-xl p-6 text-[#333333]`}
              >
                <h2 className="font-serif text-2xl font-bold">
                  {item.title}
                </h2>

                <p className="mt-3 leading-relaxed text-lg">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>




      </section>

      {/* AvianViosn ar a Glasnec */}
      <section className="mt-12 rounded-xl bg-[#333333] px-8 py-12 text-white">
        <h2 className="text-center font-serif text-3xl font-bold text-[#fff99d]">
          AvianVision at a Glance
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Dataset */}
          <div className="text-center">
            <h3 className="font-serif text-2xl font-bold text-[#fff99d]">
              Dataset
            </h3>
            <p className="mt-3 text-3xl font-bold text-white">
              {speciesCount ?? "—"}
            </p>
            <p className="mt-2 text-base text-[#C9C9C9]">
              Species and observations
            </p>
          </div>

          {/* Coverage */}
          <div className="text-center">
            <h3 className="font-serif text-2xl font-bold text-[#ffbc88]">
              Coverage
            </h3>

            <p className="mt-3 text-3xl font-bold text-white">
              {countryCount ?? "—"}
            </p>

            <p className="mt-2 text-base text-[#C9C9C9]">
              Countries represented
            </p>
          </div>


          {/* Observation Years */}
          <div className="text-center">
            <h3 className="font-serif text-2xl font-bold   text-[#fff99d] ">
              Observation Years
            </h3>

            <p className="mt-3 text-3xl font-bold text-white">
              {yearRange?.min ?? "—"} – {yearRange?.max ?? "—"}
            </p>

            <p className="mt-2 text-base text-[#C9C9C9]">
              Earliest to latest observation
            </p>
          </div>


          {/* Predictions */}
          <div className="text-center">
            <h3 className="font-serif text-2xl font-bold text-[#ffbc88]">
              Predictions
            </h3>
            <p className="mt-3 text-3xl font-bold text-white">{predictionCount ?? "—"}</p>
            <p className="mt-2 text-base text-[#C9C9C9]">
              Total predictions made
            </p>
          </div>

          {/* AI Model */}
          <div className="text-center md:col-span-4 ">
            <h3 className="font-serif text-2xl font-bold text-[#fff99d]">
              AI Model
            </h3>
            <div className="mx-auto mt-4 max-w-md space-y-4">
              <div className="flex items-center justify-center gap-6">
                <p className="text-xl font-semibold text-white">Accuracy:</p>
                <p className="text-2xl font-bold text-white">
                  {accuracy !== null ? `${(accuracy * 100).toFixed(2)}%` : "—"}
                </p>
              </div>

              <div className="flex items-center justify-center gap-6">
                <p className="text-xl font-semibold text-white">F1 Score:</p>
                <p className="text-2xl font-bold text-white">
                  {f1Score !== null ? `${(f1Score * 100).toFixed(2)}%` : "—"}
                </p>
              </div>

              <div className="flex items-center justify-center gap-6">
                <p className="text-xl font-semibold text-white">Loss:</p>
                <p className="text-2xl font-bold text-white">
                  {loss !== null ? loss.toFixed(4) : "—"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-base text-[#C9C9C9]">
              Accuracy and model performance
            </p>
          </div>

        </div>

      </section>

      {/* Explore AvianVison */}
      <section className="mt-12 py-12 ">
        <h2 className="text-center font-serif text-3xl font-bold text-[#333333]">
          Explore AvianVision
        </h2>

        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-15 md:grid-cols-2">
          {/* Prediction */}
          <div className="rounded-xl bg-[#fff99d] p-8 text-[#333333] transition hover:shadow-lg">
            <div className="text-3xl">🔍</div>
            <h3 className="mt-3 font-serif text-2xl font-bold">
              <Link href="/prediction" className="hover:underline">
                Prediction →
              </Link>
            </h3>
            <p className="mt-4">
              Identify a bird species using an AI-powered image prediction.
            </p>
          </div>

          {/* Bird */}
          <div className="rounded-xl bg-[#ffbc88] p-8 text-[#333333] transition hover:shadow-lg">
            <div className="text-3xl">🐦</div>
            <h3 className="mt-3 font-serif text-2xl font-bold">
              <Link href="/bird" className="hover:underline">
                Bird →
              </Link>
            </h3>
            <p className="mt-4">
              Look up information about an individual bird species.
            </p>
          </div>

          {/* Species */}
          <div className="rounded-xl bg-[#ffbc88] p-8 text-[#333333] transition hover:shadow-lg">
            <div className="text-3xl">🪶</div>
            <h3 className="mt-3 font-serif text-2xl font-bold">
              <Link href="/species" className="hover:underline">
                Species →
              </Link>
            </h3>
            <p className="mt-4">
              Compare different bird species side by side.
            </p>
          </div>

          {/* Model Metrics */}
          <div className="rounded-xl bg-[#fff99d] p-8 text-[#333333] transition hover:shadow-lg">
            <div className="text-3xl">📊</div>
            <h3 className="mt-3 font-serif text-2xl font-bold">
              <Link href="/stats" className="hover:underline">
                Model Metrics →
              </Link>
            </h3>
            <p className="mt-4">
              Explore the performance of the AvianVision AI model.
            </p>
          </div>
        </div>
      </section>

      {/* AI Prediction Disclaimer */}
      <section className="mx-auto mt-25 max-w-5xl rounded-xl bg-[#fff3d6] p-10 text-[#333333] mb-20">
        <div className="flex items-center gap-3">
          <span className="text-5xl">⚠️</span>
          <h2 className="font-serif text-5xl font-bold">
            AI Prediction Disclaimer
          </h2>
        </div>

        <p className="mt-7 leading-relaxed text-3xl">
          AI predictions may not always be accurate. Please verify
          results using reliable sources before making decisions.
        </p>
      </section>

    </main>
  );
}
