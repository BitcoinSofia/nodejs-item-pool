var Pool = require("./pool.js")

var pool1 = new Pool({
    minItemsReady: 5,
    maxItemsTotal: 3,
    maxItemAge: 10,
    refreshPeriod: 1000,
    itemFactory: ()=>Math.random(),
    logger: (str)=> console.log(new Date() + " - " + str)
})

console.log(pool1)
pool1.start()