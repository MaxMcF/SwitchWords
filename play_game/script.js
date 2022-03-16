const nodeRadius = 20;
const med_rad = nodeRadius + 2
const larger_rad = med_rad + 3;
const eventListenerObj = Object();
(async () => {
    // fetch data and render
    const resp = await fetch(
        "http://localhost:8000/boards/sample.json"
    );
    const json_data = await resp.json();
    const dag = d3.dagStratify()(json_data['formatted_edges']);

    // const nodeRadius = 20;
    const layout = d3
        .sugiyama() // base layout
        .decross(d3.decrossOpt()) // minimize number of crossings
        .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeRadius, 3 * nodeRadius]); // set node size instead of constraining to fit
    var { width, height } = layout(dag);
    // --------------------------------
    // This code only handles rendering
    // --------------------------------
    const svgSelection = d3.select("svg");
    svgSelection.attr("viewBox", [0, 0, width, height].join(" "));
    const defs = svgSelection.append("defs"); // For gradients

    const steps = dag.size();
    const interp = d3.schemeCategory10;
    const colorMap = new Map();
    for (const [key, val] of Object.entries(json_data['edge_lookup'])) {
        for (var i = 0; i < json_data['nodes'].length; i++){
            if (json_data['nodes'][i]['word'] == val) {
                var position = i
            }
        }
        colorMap.set(val, interp[position]);
    }

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
        .attr("letter_id", ({data}) => data.id)
        .attr("letter_type", (d) => {
            if (json_data['node_lookup'][d.data.id]['is_merge']){
                return "rigid-letter"
            } else {
                return 'editable-letter'
            }
        })

    // Plot node circles
    nodes
        .append("circle")
        .attr('r', nodeRadius)
    
    nodes
        .append('text')
        .text((d)=> {
            if (json_data['node_lookup'][d.data.id]['is_merge']){
                return json_data['node_lookup'][d.data.id]['letter']
            } else {
                return ''
            }
        })
        .attr("font-weight", "bold")
        .attr("font-family", "sans-serif")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("fill", "white");

    svgSelection       
        .selectAll('g[letter_type="rigid-letter"]')
        .append('circle')
        .attr('class', 'rigid-highlight')
        .attr('r', med_rad)
        .attr("stroke", "white")
        .attr("fill", "white")
        .lower()
    
    svgSelection       
        .selectAll('g[letter_type="rigid-letter"]')
        .append('circle')
        .attr('class', 'rigid-highlight')
        .attr('r', Number(med_rad) + 2)
        .lower()

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

        if ((next) && (letter_ind < json_data['nodes'][word_ind]['letters'].length)) {
            letter_ind = Number(letter_ind) + 1
            var next_letter = json_data['nodes'][word_ind]['letters'][letter_ind]
        } else if ((!next) && (letter_ind > 0)) {
            letter_ind = Number(letter_ind) - 1
            var next_letter = json_data['nodes'][word_ind]['letters'][letter_ind]
        } else {
            var next_letter = null
        }
        if (next_letter && !next_letter['empty']){
            if (next_letter['is_merge']){
                return find_next_letter(word_id, next_letter['id'], next)
            } else {
                return next_letter['id']
            }
        } else {
            return null
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
        if ((data.key == 'Backspace') && (text_elm.html() != '')){
            text_elm.text('')
        } else if (data.key == 'ArrowUp' || data.key == 'Backspace'){
            next_id = find_next_letter(word_id, letter_id, next=false)
        } else if (data.key == 'Enter' || data.key == 'ArrowDown'){
            next_id = find_next_letter(word_id, letter_id, next=true)
        } else if (data.key.charCodeAt(0) >= 97 && data.key.charCodeAt(0) <= 122) {
            text_elm.html(data.key)
            if (check_word_complete(word_id)){
                return true
            }
            next_id = find_next_letter(word_id, letter_id, next=true)
        }
        if (next_id){
            highlight_letter(next_id, word_id)
        } else {
            highlight_letter(letter_id, word_id)
        }
        return false

    }


    function check_win(){
        const remaining_letters = [...svgSelection.selectAll('[letter_type="editable-letter"]')].length
        if (remaining_letters < 1){
            return true
        }
        return false
    }

    function game_over(){
        window.alert("You Win!")
    }

    function word_complete(word_id){
        svgSelection.selectAll('.highlight').remove()
        for (const [i, word] of Object.entries(json_data['nodes'])){
            if (word['word_id'] == word_id){
                for (const [j, letter] of Object.entries(json_data['nodes'][i]['letters'])){
                    const curText = svgSelection
                        .select(`g[letter_id='${letter.id}']`)
                    
                    curText
                        .attr('letter_type', 'rigid-letter')

                    curText.append('circle')
                        .attr('class', 'rigid-highlight')
                        .attr('r', med_rad)
                        .attr("stroke", "white")
                        .attr("fill", "white")
                        .lower()

                    curText.append('circle')
                        .attr('class', 'rigid-highlight')
                        .attr('r', Number(med_rad) + 2)
                        .lower()
                }
            }
        }
        svgSelection.selectAll('[letter_type="rigid-letter"]').on('click', null)
        if (check_win()){
            game_over()
        } 
    }

    function check_word_complete(word_id){
        for (const [i, word] of Object.entries(json_data['nodes'])){
            if (word['word_id'] == word_id){
                var letters_correct = 0
                for (const [j, letter] of Object.entries(json_data['nodes'][i]['letters'])){
                    if (!letter.empty){
                        const curText = svgSelection
                            .select(`g[letter_id='${letter.id}']`)
                            .select('text')
                        if (curText.html() == letter.letter){
                            letters_correct += 1
                            if (letters_correct >= word['length']){
                                return true
                            }
                        }
                    }
                }
            }
        }
        return false
    }

    function highlight_letter(letter_id, word_id){
        svgSelection.selectAll('#letter_highlight').remove()
        document.removeEventListener('keyup', eventListenerObj.fun, false);
        d3.select(`[letter_id='${letter_id}']`)
                .append('circle')
                .attr('class', 'highlight')
                .attr('id', 'letter_highlight')
                .attr('r', larger_rad + 2)
                .lower()

        document.addEventListener('keyup', eventListenerObj.fun=function _listener(event) {
            complete = input_letter(event, letter_id, word_id);
            if (complete){
                word_complete(word_id);
            }
        }, false)
    }

    function show_clue(clue, color){
        document.getElementById('clue-box').setAttribute('style', `width: auto;
            float: left;
            margin: 12.5%;
            padding: 12px;
            border: 15px solid ${color};`)
        document.getElementById('clue-text').innerHTML = clue
    }

    function highlight_word(data) {
        document.removeEventListener('keyup', eventListenerObj.fun, false);
        svgSelection.selectAll('.highlight').remove()
        const letter_id = data.srcElement.parentNode.attributes.letter_id.nodeValue
        const word_ids = [...svgSelection.selectAll(`g[letter_id='${letter_id}']`).selectAll('div')]
        if (word_ids.length == 1){
            for (const [i, word_obj] of Object.entries(json_data['nodes'])){
                if (word_obj['word_id'] == word_ids[0].attributes.word_id.nodeValue){
                    var word = word_obj[`word`]
                    var clue = word_obj['clue']
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
            show_clue(clue, colorMap.get(word))
        
        }
    }
    svgSelection.selectAll('.letter_node').filter('[letter_type="editable-letter"').on('click', highlight_word)
        
  })();
