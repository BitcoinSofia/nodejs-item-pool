const uuidv4 = require('uuid/v4');

const states = {
	creating: "creating",
	preparing: "preparing",
	ready: "ready",
	updating: "updating",
	deleting: "deleting",
	invalid: "invalid"
}

class Item {
	constructor(id, type, state, owner, value) {
		this.id = id
		this.type = type
		this.state = state
		this.owner = owner
		this.value = value
		this.locked = false

		this.created = new Date()
		this.lastChange = new Date()
	}
	setState(state) {
		this.validateLock()
		this.state = state
		this.lastChange = new Date()
	}
	setOwner(owner) {
		this.validateLock()
		this.owner = owner
		this.lastChange = new Date()
	}
	setValue(value) {
		this.validateLock()
		this.value = value
		this.lastChange = new Date()
	}
	setLocked(locked) {
		this.locked = locked
		this.lastChange = new Date()
	}
	validateLock() {
		if (this.locked)
			throw new Error("Item " + id + " is locked!")
	}
}

var defaultConfig = {
	poolName: "Pool",
	itemType: "Pool-Object",
	minItemsTotal: 1,
	minItemsReady: 1,
	maxItemsTotal: 10,
	maxItemsReady: 10,
	maxItemAge: (24 * 60 * 60),
	refreshPeriod: 5,
	itemFactory: function () {
		return value
	},
	itemPreparation: function (value) {
		return value
	},
	itemDeletion: function (item) {},
	logger: function (str) {
		console.log(str)
	}
}
defaultConfig.itemFactory = undefined;

class Pool {

	constructor(config = defaultConfig) {
		this.id = uuidv4()
		this.items = {}
		this.running = false
		this.workerId = ""
		for (const key in defaultConfig)
			this[key] = config[key] !== undefined ? config[key] : defaultConfig[key]
		if (!this.itemFactory)
			throw ReferenceError(this.poolName + ".itemFactory must be set");
	}

	start() {
		this.running = true
        this.workerId = setInterval(() => {
            this.managePool()
                .catch((e) => console.error("managePool Failed. \nError:\n" + e))
        }, this.refreshPeriod)
	}

	stop() {
		this.running = false
		clearInterval(this.workerId)
	}

    managePool() {
        return new Promise(function (resolve, reject) {
		    var now = new Date().getTime();
		    var items = []
            for (const i in this.items)
                items.push(this.items[i])
		
		    //var lockedItems = items.filter(i => i.locked)
		    var nonLockedItems = items.filter(i => !i.locked)
		    var readyItems = nonLockedItems.filter(i => i.state === states.ready)
		    var updatingItems = nonLockedItems.filter(i => i.state === states.updating)
		    var preparingItems = nonLockedItems.filter(i => i.state === states.preparing)
		    var creatingItems = nonLockedItems.filter(i => i.state === states.creating)
		    //var deletingItems = poolItems.filter(i => i.state === states.deleting)
		    //var invalidItems = poolItems.filter(i => i.state === states.invalid)
            var oldItems = nonLockedItems.filter(i => now - i.created.getTime > this.maxItemAge)
		    var almostReadyItems = readyItems
			    .concat(creatingItems)
			    .concat(preparingItems.length)
			    .concat(updatingItems)

		    var itemsToCreate = this.minItemsTotal - nonLockedItems.length
		    itemsToCreate = Math.max(itemsToCreate, this.minItemsReady - almostReadyItems.length)

		    var itemsToDelete = nonLockedItems.length - this.maxItemsTotal
		    itemsToDelete = Math.max(itemsToDelete, readyItems.length - this.maxItemsReady)

		    if (itemsToCreate > 0)
				this._loop(itemsToCreate, this.createItem)
		    if (itemsToDelete > 0)
				this._loop(readyItems.slice(0, itemsToDelete.length), this.deleteItem)
		    if (oldItems.length > 0)
				this._loop(oldItems, this.deleteItem)

            this.checkForChangedItems()
            resolve()
        })
	}

	checkForChangedItems() {
		// TODO: implement callback
	}

    createItem() {
        return new Promise(function (resolve, reject) {
			var id = Math.random().toString().replace(".", "")
		    var item = new Item(id, this.itemType, states.creating, null, null)
		    this.items[item.id] = item
		    this.logger("Creating "+item.type+" item with id=" + item.id)
		    var value = await this.itemFactory()
		    this.logger("Done Creating "+item.type+" item with id=" + item.id)
		    item.setValue(value)
		    item.setState(states.preparing)
		    this.logger("Preparing "+item.type+" item with id=" + item.id)
		    value = await this.itemPreparation(value)
		    this.logger("Done Preparing "+item.type+" item with id=" + item.id)
		    item.setValue(value)
            item.setState(states.ready)
            resolve()
        })
	}

	deleteItem(item) {
		return new Promise(function (resolve, reject) { 
			var item = this.items[item.id]
			item.setState(states.deleting)
			this.logger("Deleting "+item.type+" item with id=" + item.id)
			this.itemDeletion(item.value).then(()=>{
				this.logger("Done Deleting "+item.type+" item with id=" + item.id)
				delete this.items[item.id]
				resolve()
			})
		})
	}

	_loop(countOrItems, action) {
		if (typeof (countOrItems) === "number")
			for (var i = 0; i < countOrItems; i++) {
				var result = action(i)
			}
		else if (Array.isArray(countOrItems))
			for (var i = 0; i < countOrItems.length; i++) {
				var result = action(countOrItems[i])
			}
		else
			throw new Error("Unknown Loop operation type.")
	}
}

module.exports = Pool