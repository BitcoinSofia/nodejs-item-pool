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

test('Check if pool will give an item for usage', done => {
    var pool = createPool({})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(1)
        var item = pool.useItem()
        expect(item).not.toBe(null)
        expect(item.state).toBe(Pool.states.inUse)
        expect(item.value).toBe("item")
        done()
    }, 500);
})

test('Check if pool will create another ready item after putting one inUse', done => {
    var pool = createPool({})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(1)
        var item = pool.useItem()
        setTimeout(()=>{
            expect(pool.getItems().length).toBe(2)
            done()
        }, 600);
    }, 500);
})