import SimilarityMap from "./SimilarityMap";
// import ProjectionBands from "./ProjectionBands";

export default function ResearchDashboard() {
  return (
    <div className="grid grid-cols-1 gap-10">
      <SimilarityMap />
      {/* <ProjectionBands /> */}
    </div>
  );
}