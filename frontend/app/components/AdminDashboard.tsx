import OpportunityQuadrant from "./OpportunityQuadrant";
// import UnderTargetedTreemap from "./UnderTargetedTreemap";
// import FunderSankey from "./FunderSankey";


export default function AdminDashboard() {
  return (
    <div className="grid grid-cols-1 gap-10">
      <OpportunityQuadrant />
      {/* <UnderTargetedTreemap />
      <FunderSankey /> */}
    </div>
  );
}