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

test('Check if pool will create items', done => {
    var pool = createPool({})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(1)
        expect(items[0].state).toBe(Pool.states.ready)
        expect(items[0].value).toBe("item")
        done()
    }, 500);
})

test('Check if pool will create ENOUGH items', done => {
    var pool = createPool({minItemsTotal:3})
    pool.start()
    setTimeout(()=>{
        expect(pool.getItems().length).toBe(3)
        done()
    }, 500);
})

test('Check if pool will create enough READY items', done => {
    var pool = createPool({minItemsReady:3})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(3)
        items[0].setState(Pool.states.updating);
        setTimeout(() => {
            expect(pool.getItems().length).toBe(4)
            done()
        }, 600);
    }, 500);
})

test('Check pool manual item creation', done => {
    var pool = createPool({minItemsReady:3})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(3)
        pool.createItem()
        setTimeout(() => {
            expect(pool.getItems().length).toBe(4)
            done()
        }, 600);
    }, 500);
})

test('Check pool doesnt create items if config says min is 0', done => {
    var pool = createPool({minItemsReady:0, minItemsTotal:0})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(0)
        pool.createItem()
        setTimeout(() => {
            expect(pool.getItems().length).toBe(1)
            done()
        }, 600);
    }, 500);
})