const Pool = require('../pool');

function createPool(config) {
    if (!config.logger)
        config.logger = str=>{}
    if (!config.itemFactory)
        config.itemFactory = ()=>"item"
    if(!config.refreshPeriod)
        config.refreshPeriod = 500
    return new Pool(config)
}

test('Check if pool prepares newly created items', done => {
    var preparedItems = []

    var pool = createPool({ 
        minItemsReady:3, 
        itemPreparation: (i) => { preparedItems.push(i); return "changed"; }
    })
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(3)
        expect(preparedItems.length).toBe(3)
        for (let i = 0; i < items.length; i++)
            expect(items[i].value).toBe("changed")
        for (let i = 0; i < preparedItems.length; i++)
            expect(preparedItems[i]).toBe("item")
        done()
    }, 500);
})