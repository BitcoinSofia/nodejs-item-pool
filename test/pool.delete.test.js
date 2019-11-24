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

test('Check if pool will delete item', done => {
    var pool = createPool({})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(1)
        pool.deleteItem(items[0])
        setTimeout(()=>{
            expect(pool.getItems().length).toBe(0)
            done()
        }, 500);
    }, 500);
})

test('Check if pool will AUTO delete OVERFLOWING items', done => {
    var pool = createPool({maxItemsTotal: 2})
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(1)
        pool.createItem()
        pool.createItem()
        pool.createItem()
        setTimeout(()=>{
            expect(pool.getItems().length).toBe(2)
            done()
        }, 1000);
    }, 500);
})

test('Check if pool the delete CALLBACK is called', done => {
    var deletedItems = []

    var pool = createPool({ 
        minItemsReady:3, 
        itemDeletion: (i) => { deletedItems.push(i) }
    })
    pool.start()
    setTimeout(()=>{
        var items = pool.getItems()
        expect(items.length).toBe(3)
        expect(deletedItems.length).toBe(0)
        var id = items[0].id
        pool.deleteItem({id:id})
        setTimeout(() => {
            expect(pool.getItems().length).toBe(3)
            expect(deletedItems.length).toBe(1)
            done()
        }, 600);
    }, 500);
})