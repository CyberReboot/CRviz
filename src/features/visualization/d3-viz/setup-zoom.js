import { zoom } from "d3-zoom";
import { event as d3Event } from "d3-selection";
import { zoomIdentity } from "d3-zoom";
import { measureText, fitText, getFont } from "./text-utils";

const setupZoom = ({
  zoomRoot,
  nodeRoot,
  nodes,
  width,
  height,
  packedData
}) => {
  const zoomBehavior = zoom();
  zoomBehavior.on("zoom", () => {
    const event = d3Event;
    zoomToTransform(event.transform)
  });
  zoomRoot.call(zoomBehavior);

  // Amount of space to leave around a node when zoomed into that node
  // (as a fraction of the node diameter)
  const viewPadding = 0.25;

  const { r: rootR, x: rootX, y: rootY } = packedData;

  const scaleExtent = [
    Math.min(width, height) / (rootR * 2),
    Math.min(width, height) / (packedData.leaves()[0].r * 2 * (1 + viewPadding))
  ];

  const translateExtent = [
    [
      rootX - width / 2 / scaleExtent[0] * 2,
      rootY - height / 2 / scaleExtent[0] * 2
    ],
    [
      rootX + width / 2 / scaleExtent[0] * 2,
      rootY + height / 2 / scaleExtent[0] * 2
    ]
  ];

  zoomBehavior.scaleExtent(scaleExtent).translateExtent(translateExtent);

  const [labelFont, labelHeight] = getLabelStyle(nodes);

  const zoomToTransform = (transform) => {
    nodeRoot.attr("transform", transform);

    const bound = viewBound(width, height, transform);

    const nodesInView = nodes.filter((d) => boundOverlap(bound, nodeBound(d)));

    nodesInView
      .call(hideSmall, transform)
      .call(fitLabels, transform, labelFont, labelHeight, bound);
  };

  const zoomTo = (datum, animate = true) => {
    const size = datum.r * 2 * (1 + viewPadding);
    const k = Math.min(width, height) / size;
    const transform = zoomIdentity
      .scale(k)
      .translate(
          - datum.x + width / 2 / k,
          - datum.y + height / 2 / k,
      );

    zoomBehavior.transform(
      !animate ? zoomRoot : zoomRoot.transition().duration(1000),
      transform
    );
  }

  return {
    zoomTo,
    zoomToTransform
  }
};

const hideSmall = (nodes, transform) => {
  nodes.attr("visibility", (d) => (d.r * transform.k < 1 ? "hidden" : "visible"));
};

const fitLabels = (nodes, transform, labelFont, labelHeight, viewBound) => {
  const fitVertically = (d) => {
    return d.labelSize * transform.k >= labelHeight;
  };

  nodes
    .select("text")
    .style("visibility", (d) => (fitVertically(d) ? "visible" : "hidden"))
    .filter(fitVertically)
    .text((datum) => {
      const { data: { fieldValue }, value: count } = datum;
      const labelText = `${fieldValue} (${count})`;
      const fittedText = fitText(
        labelFont,
        labelText,
        Math.floor(datum.labelSize * transform.k)
      );
      return fittedText;
    })
    .attr("transform", function scaleLabel(d) {
      return zoomIdentity
        .translate(0, d.labelY)
        .scale(1 / transform.k);
    })
};

/**
 * The bound of the view given the original width, height, and transform
 */
const viewBound = (width, height, transform) => {
  var size = Math.min(width, height);
  var boundWidth = size * Math.max(width / height, 1);
  var boundHeight = size * Math.max(height / width, 1);

  var bound = [
    -transform.x / transform.k,
    -transform.y / transform.k,
    (-transform.x + boundWidth) / transform.k,
    (-transform.y + boundHeight) / transform.k
  ];
  return bound;
};

const nodeBound = (datum) => [
  datum.x - datum.r,
  datum.y - datum.r,
  datum.x + datum.r,
  datum.y + datum.r
];

const boundOverlap = (bound0, bound1) => {
  return (
    bound0[0] <= bound1[2] &&
    bound0[2] >= bound1[0] &&
    bound0[1] <= bound1[3] &&
    bound0[3] >= bound1[1]
  );
};

const getLabelStyle = (nodes) => {
  const labels = nodes.select("text");
  let font = null,
    height = null;
  if (labels.size() > 0) {
    font = getFont(labels.nodes()[0]);
    height = measureText(font, "M")[1];
  }

  return [font, height];
};

export default setupZoom;
