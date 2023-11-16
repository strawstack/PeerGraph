function NodeGraph() {

    // Constants
    const NODE_RADIUS = 40;
    const NODE_FILL = "lightgrey";
    const NODE_STROKE = "grey";
    const NODE_STROKE_WIDTH = "4";
    const NODE_CLASS = "node";

    // Default Options 
    const node_default_opts = {
        r: NODE_RADIUS,
        fill: NODE_FILL,
        "stroke-width": NODE_STROKE_WIDTH,
        stroke: NODE_STROKE,
        class: NODE_CLASS
    };

    // Node Lookup
    const node_lookup = {};
    const line_lookup = {};

    // Variables
    let moveNode = false;
    let srcNode = null;
    let clickDelta = null;
    let lineNode = null;

    // Helpers
    const qs = sel => document.querySelector(sel);
    const qsa = sel => document.querySelectorAll(sel);
    const uid = (() => {
        let id = -1;
        return () => {
            id += 1;
            return id;
        };
    })();

    function vAdd(a, b) {
        return {
            x: a.x + b.x,
            y: a.y + b.y
        };
    }

    function vSub(a, b) {
        return {
            x: a.x - b.x,
            y: a.y - b.y
        };
    }

    function add(svg, elem) {
        svg.appendChild(elem);
    }

    function preAdd(svg, elem) {
        svg.prepend(elem);
    }

    function getCenter(shape) {
        return {
            x: shape.getAttribute("cx"),
            y: shape.getAttribute("cy")
        };
    }

    // create, connect, remove
    function sendEvent(svg, eventName, detail) {
        const evt = new CustomEvent(`nodegraph_${eventName}`, { detail });
        svg.dispatchEvent(evt);
    }

    function createConection(from_nid, to_nid) {
        const from_node = node_lookup[from_nid];
        const to_node = node_lookup[to_nid];
        const from_center = getCenter(from_node);
        const to_center = getCenter(to_node);
        const { shape: line } = create(svg, "line", {
            class: "line",
            "data-src_nid": from_nid,
            "data-dest_nid": to_nid,
            x1: from_center.x,
            y1: from_center.y,
            x2: to_center.x,
            y2: to_center.y
        });
        preAdd(svg, line);
    }

    function removeConnection(from_nid, to_nid) {
        for (let line_nid in line_lookup) {
            const line = line_lookup[line_nid];
            const { src_nid, dest_nid } = line.dataset;
            if (src_nid == from_nid && dest_nid == to_nid) {
                delete line_lookup[line_nid];
                line.remove();
            }
        }
    }

    function create(svg, shapeName, optsGiven) {
        const nid = uid(); 
        const opts = { ...node_default_opts, ...optsGiven, "data-nid": nid };
        const shape = document.createElementNS("http://www.w3.org/2000/svg", shapeName);
        for(let prop in opts) {
            shape.setAttribute(prop, opts[prop]);
        }
        if (shapeName === "circle") {
            shape.addEventListener("mousedown", e => {
                e.stopPropagation(); // mousedown on node will not bubble to mousedown svg
                if (e.ctrlKey) {
                    const node = node_lookup[nid];
                    delete node_lookup[nid];
                    node.remove();
                    sendEvent(svg, "remove", { nid });
                    // Delete lines
                    for (let line_nid in line_lookup) {
                        const line = line_lookup[line_nid];
                        const { src_nid, dest_nid } = line.dataset;
                        if (src_nid == nid || dest_nid == nid) {
                            delete line_lookup[line_nid];
                            line.remove();
                        }
                    }
                } else if (e.shiftKey) {
                    clickDelta = vSub(getCenter(shape), {x: e.offsetX, y: e.offsetY});
                    srcNode = nid;
                    moveNode = true;
                } else {
                    const center = getCenter(shape);
                    const mpos = {x: e.offsetX, y: e.offsetY};
                    const {nid: line_nid, shape: line} = create(svg, "line", {
                        class: "line",
                        "data-src_nid": nid,
                        "data-dest_nid": null,
                        x1: center.x,
                        y1: center.y,
                        x2: mpos.x,
                        y2: mpos.y
                    });
                    lineNode = line_nid;
                    preAdd(svg, line);
                }
            });
            shape.addEventListener("mouseup", e => {
                e.stopPropagation(); // mousedown on node will not bubble to mousedown svg
                if (moveNode) {
                    srcNode = null;
                    clickDelta = null;
                    moveNode = false;
                } else if (lineNode !== null) {
                    const line = line_lookup[lineNode];
                    line.dataset.dest_nid = nid;
                    lineNode = null;
                    sendEvent(svg, "connect", { from: line.dataset.src_nid, to: nid, ref: line });
                }
            });
            node_lookup[nid] = shape;
            sendEvent(svg, "create", { nid, ref: shape });
        } else if (shapeName === "line") {
            line_lookup[nid] = shape;

        }
        return { nid, shape };
    }

    function updateLines(e) {
        const mpos = {x: e.offsetX, y: e.offsetY};
        for (let nid in line_lookup) {
            const line = line_lookup[nid];
            const node = node_lookup[line.dataset.src_nid];
            const { dest_nid } = line.dataset;
            line.setAttribute("x1", node.getAttribute("cx"));
            line.setAttribute("y1", node.getAttribute("cy"));
            if (dest_nid === "null") {
                line.setAttribute("x2", mpos.x);
                    line.setAttribute("y2", mpos.y);
            } else {
                const dest_node = node_lookup[dest_nid];
                line.setAttribute("x2", dest_node.getAttribute("cx"));
                line.setAttribute("y2", dest_node.getAttribute("cy"));
            }
        }
    }

    function addListeners(svg) {

        svg.addEventListener("mousedown", e => {
            const mpos = {x: e.offsetX, y: e.offsetY};
            const {shape: circle} = create(svg, 'circle', {
                cx: mpos.x,
                cy: mpos.y,
            });
            add(svg, circle);            
        });

        svg.addEventListener("mousemove", e => {
            if (moveNode) {
                const pos = vAdd({x: e.offsetX, y: e.offsetY}, clickDelta);
                const node = node_lookup[srcNode];
                node.setAttribute("cx", pos.x);
                node.setAttribute("cy", pos.y);
            }
            updateLines(e);
        });

        svg.addEventListener("mouseup", e => {
            if (lineNode) {
                const line = line_lookup[lineNode];
                line.remove();
                delete line_lookup[lineNode];
                lineNode = null;
            }
        });
    }

    function nodeGraph(svg) {
        addListeners(svg);
    }

    return { nodeGraph, createConection, removeConnection };
}