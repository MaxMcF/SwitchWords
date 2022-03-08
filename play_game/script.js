
(async () => {
    // fetch data and render
    const resp = await fetch(
        "http://localhost:8000/boards/3_5_7_0.3_28184641-f427-4345-bb23-3708509a4211.json"
    );
    const data = await resp.json();
    console.log(data)

  })();
  