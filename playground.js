var Pool = require("./pool.js")

var pool1 = new Pool({
    minItemsReady: 1,
    maxItemsTotal: 20,
    maxItemAge: 100000,
    refreshPeriod: 1000,
    itemFactory: () => Math.random(),
    itemDeletion: (i) => { },
    itemPreparation: (v) => { },
    logger: (str)=> console.log(new Date().getTime() + " - " + str),
})

console.log(pool1)
pool1.serve()