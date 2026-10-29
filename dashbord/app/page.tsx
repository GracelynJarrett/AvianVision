import BirdSlideshow from "@/conmponents/birdslideshow";


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
  return (
    <main className="p-8 bg-[#FFFFFF] ">
      <BirdSlideshow />

      <section className="mt-12 py-20 ">
        <h1 className="font-serif text-4xl font-bold text-[#333333] text-center ">
          Welcome to AvianVision!
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr] md:items-stretch">
          <p className="flex items-center justify-center text-center text-[#3F4850]">
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

      <section className="bg-[#C9C9C9]">
        <h3>section2</h3>
      </section>

      <section >
        <h3>section3</h3>
      </section>

      <section className="bg-[#C9C9C9]">
        <h3>section4</h3>
      </section>

    </main>
  );
}
