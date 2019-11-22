var Pool = require("../pool.js")

var pool1 = new Pool({
    itemFactory: ()=>Math.random()
})

console.log(pool1)
pool1.start()