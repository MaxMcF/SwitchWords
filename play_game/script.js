const nodeRadius = 20;
const larger_rad = nodeRadius + 5;
(async () => {
    // fetch data and render
    const resp = await fetch(
        "http://localhost:8000/boards/sample.json"
    );
    const json_data = await resp.json();
    // console.log(data)
    const dag = d3.dagStratify()(json_data['formatted_edges']);

    // const nodeRadius = 20;
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
    // console.log(dag)
    for (const [key, val] of Object.entries(json_data['edge_lookup'])) {
        for (var i = 0; i < json_data['nodes'].length; i++){
            if (json_data['nodes'][i]['word'] == val) {
                var position = i
            }
        }
        // console.log(key, val, interp(val / steps))
        colorMap.set(val, interp[position]);
    }
    // console.log(colorMap)

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
        .attr("source_id", ({source, target}) => {
            return source.data.id})
        .attr("target_id", ({source, target}) => {
            return target.data.id})
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
        grad
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", colorMap.get(json_data['edge_lookup'][target.data.id+ '-' + source.data.id]));
        grad
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colorMap.get(json_data['edge_lookup'][target.data.id+ '-' + source.data.id]));
        return `url(#${gradId})`;
        });


    // Select nodes
    const nodes = svgSelection
        .append("g")
        .selectAll("g")
        .data(dag.descendants())
        .enter()
        .append("g")
        .attr("transform", ({ x, y }) => `translate(${x}, ${y})`)
        .attr("class", "letter_node")
        .attr("letter_id", ({data}) => data.id);

    // Plot node circles
    nodes
        .append("circle")
        .attr('r', nodeRadius)
    
    nodes
        .append('text')
        .text((d)=> json_data['node_lookup'][d.data.id]['letter'])
        // .text((d)=> {
        //     if (data['node_lookup'][d.data.id]['is_merge']){
        //         return data['node_lookup'][d.data.id]['letter']
        //     } else {
        //         return ''
        //     }
        // })
        // .attr("oninput", "input_letter()")
        .attr("font-weight", "bold")
        .attr("font-family", "sans-serif")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("fill", "white");
    

    for (const [i, word] of Object.entries(json_data['nodes'])){
        for (const [i, letter] of Object.entries(word['letters'])){
            const l_node = svgSelection.selectAll(`g[letter_id='${letter.id}']`)
            l_node.append('div').attr('word_id', word.word_id)
        }
    }
    

    function find_next_letter(word_id, letter_id, next){


            for (const [i, word] of Object.entries(json_data['nodes'])){
                if (word['word_id'] == word_id){
                    for (const [j, letter] of Object.entries(json_data['nodes'][i]['letters'])){
                        if (letter['id'] == letter_id){
                            var letter_ind = j
                            var word_ind = i
                        }
                    }
                }
            }
            console.log(letter_ind, word_ind, letter_id)
            if ((letter_ind > 0) && (letter_ind < json_data['nodes'][word_ind]['letters'].length)){
                if (next) {
                    letter_ind = Number(letter_ind) + 1
                    var next_letter = json_data['nodes'][word_ind]['letters'][letter_ind]
                } else {
                    letter_ind = Number(letter_ind) - 1
                    var next_letter = json_data['nodes'][word_ind]['letters'][letter_ind]
                }
                console.log(next_letter)
                if (!next_letter['empty']){
                    return next_letter['id']
                }
            }
    }

    // JSON Format
/**
    // word_id: {1:
        {
            "empty": false,
            "end": true,
            "id": "ef32170c-9f02-4e1e-970e-c5f604729718",
            "is_merge": false,
            "letter": "e",
            "start": false
        },
        ...
        word: MyWord,

    }
 */


    function input_letter(data, letter_id, word_id){
        const text_elm = d3.select(`g[letter_id='${letter_id}']`).select('text')
        if (data.key == 'Backspace'){
            text_elm.text('')
            next_id = find_next_letter(word_id, letter_id, next=false)
        } else {
            text_elm.text(data.key)
            next_id = find_next_letter(word_id, letter_id, next=true)
        }
        highlight_letter(next_id, word_id)

    }


    function highlight_letter(letter_id, word_id){
        svgSelection.selectAll('#letter_highlight').remove()
        d3.select(`[letter_id='${letter_id}']`)
                .append('circle')
                .attr('class', 'highlight')
                .attr('id', 'letter_highlight')
                .attr('r', larger_rad + 2)
                .lower()

        document.addEventListener('keyup', function _listener(event) {
            counter = input_letter(event, letter_id, word_id);
            document.removeEventListener('keyup', _listener, false);
        }, false)
    }

    function highlight_word(data) {

        svgSelection.selectAll('.highlight').remove()
        const letter_id = data.srcElement.parentNode.attributes.letter_id.nodeValue
        const word_ids = [...svgSelection.selectAll(`g[letter_id='${letter_id}']`).selectAll('div')]
        if (word_ids.length == 1){
            for (const [i, word_obj] of Object.entries(json_data['nodes'])){
                if (word_obj['word_id'] == word_ids[0].attributes.word_id.nodeValue){
                    var word = word_obj[`word`]
                    break
                }

            }
            
            var word_id =  word_ids[0].attributes.word_id.nodeValue
            const div_nodes = svgSelection.selectAll(`div[word_id='${word_id}']`)
            div_nodes.each((node) => {
                d3.select(`[letter_id='${node.data.id}']`)
                    .append('circle')
                    .attr('class', 'highlight')
                    .attr('r', larger_rad)
                    .style('stroke', colorMap.get(word))
                    .style('fill', colorMap.get(word))
                    .lower()
                })
            highlight_letter(letter_id, word_id)
        
        }
    }

    
    svgSelection.selectAll('.letter_node').on('click', highlight_word)
        
  })();


  



