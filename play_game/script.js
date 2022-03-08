
(async () => {
    // fetch data and render
    const resp = await fetch(
        "http://localhost:8000/boards/sample.json"
    );
    const data = await resp.json();
    console.log(data)
    const dag = d3.dagStratify()(data['formatted_edges']);

    const nodeRadius = 20;
    const layout = d3
        .sugiyama() // base layout
        .decross(d3.decrossOpt()) // minimize number of crossings
        .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeRadius, 3 * nodeRadius]); // set node size instead of constraining to fit
    const { width, height } = layout(dag);

    // --------------------------------
    // This code only handles rendering
    // --------------------------------
    const svgSelection = d3.select("svg");
    svgSelection.attr("viewBox", [0, 0, width, height].join(" "));
    const defs = svgSelection.append("defs"); // For gradients

    const steps = dag.size();
    const interp = d3.schemeCategory10;
    const colorMap = new Map();
    console.log(dag)
    for (const [key, val] of Object.entries(data['edge_lookup'])) {
        for (var i = 0; i < data['nodes'].length; i++){
            if (data['nodes'][i]['word'] == val) {
                var position = i
            }
        }
        // console.log(key, val, interp(val / steps))
        colorMap.set(val, interp[position]);
    }
    console.log(colorMap)

    // How to draw edges
    const line = d3
        .line()
        .curve(d3.curveCatmullRom)
        .x((d) => d.x)
        .y((d) => d.y);

    // Plot edges
    svgSelection
        .append("g")
        .selectAll("path")
        .data(dag.links())
        .enter()
        .append("path")
        .attr("d", ({ points }) => line(points))
        .attr("fill", "none")
        .attr("stroke-width", 3)
        .attr("stroke", ({ source, target }) => {
        // encodeURIComponents for spaces, hope id doesn't have a `--` in it
        const gradId = encodeURIComponent(`${source.data.id}--${target.data.id}`);
        const grad = defs
            .append("linearGradient")
            .attr("id", gradId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", source.x)
            .attr("x2", target.x)
            .attr("y1", source.y)
            .attr("y2", target.y);
        console.log(data['edge_lookup'][target.data.id+ '-' + source.data.id])
        grad
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", colorMap.get(data['edge_lookup'][target.data.id+ '-' + source.data.id]));
        grad
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colorMap.get(data['edge_lookup'][target.data.id+ '-' + source.data.id]));
        return `url(#${gradId})`;
        });

    // Select nodes
    const nodes = svgSelection
        .append("g")
        .selectAll("g")
        .data(dag.descendants())
        .enter()
        .append("g")
        .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);

    // Plot node circles
    nodes
        .append("circle")
        .attr("r", nodeRadius);

    // Add text to nodes
    // nodes
    //     .append('form')
    
    // nodes
    //     .selectAll('form')
    //     .append('input')
    //     .attr('type', 'text')
    //     .attr('placeholder', 'a')
    //     .attr('style', "width: 10px")
    //     .attr('size', '10px')
        // .text(() => )
    
    nodes
        .append('text')
        .text((d)=> data['node_lookup'][d.data.id]['letter'])
        // .text((d)=> {
        //     if (data['node_lookup'][d.data.id]['is_merge']){
        //         return data['node_lookup'][d.data.id]['letter']
        //     } else {
        //         return ''
        //     }
        // })
        // // .attr("oninput", "input_letter()")
        .attr("font-weight", "bold")
        .attr("font-family", "sans-serif")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("fill", "white");
    

    function input_letter(letter) {
        console.log(letter)
    }
  })();
  

