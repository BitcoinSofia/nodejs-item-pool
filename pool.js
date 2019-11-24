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
	refreshPeriod: 5000,
	creationWaitPeriod: 100,
	deletionWaitPeriod: 100,
	itemFactory: function () { return value },
	itemDeletion: function (item) { },
	itemPreparation: function (value) { return value },
	logger: function (str) { console.log(str) },
	updateChangedItemStates: function (items) { },
}
defaultConfig.itemFactory = undefined;

class Pool {

	constructor(config = defaultConfig) {
		this.items = {} // { ID: item }
		this.itemsToDelete = [] // list of IDs
		this.itemsToCreate = 0 // count
		this.running = false
		this.workerId = ""
		for (const key in defaultConfig)
			this[key] = config[key] !== undefined ? config[key] : defaultConfig[key]
		if (!this.itemFactory)
			throw ReferenceError(this.poolName + ".itemFactory must be set");
	}

	start() {
		this.running = true
		this.manageWorkerId = setInterval(() => {
			_managePool(this)
		}, this.refreshPeriod)
		this.createWorkerId = setInterval(() => {
			_createQueuedItem(this)
		}, this.creationWaitPeriod)
		this.deleteWorkerId = setInterval(() => {
			_deleteQueuedItem(this)
		}, this.deletionWaitPeriod)
	}

	stop() {
		this.running = false
		clearInterval(this.manageWorkerId)
		clearInterval(this.createWorkerId)
		clearInterval(this.deleteWorkerId)
	}
}

function _managePool(pool) {
	var now = new Date().getTime();
	var items = []
	for (const i in pool.items)
		items.push(pool.items[i])

	//var lockedItems = items.filter(i => i.locked)
	var nonLockedItems = items.filter(i => !i.locked)
	var readyItems = nonLockedItems.filter(i => i.state === states.ready)
	var updatingItems = nonLockedItems.filter(i => i.state === states.updating)
	var preparingItems = nonLockedItems.filter(i => i.state === states.preparing)
	var creatingItems = nonLockedItems.filter(i => i.state === states.creating)
	//var deletingItems = poolItems.filter(i => i.state === states.deleting)
	//var invalidItems = poolItems.filter(i => i.state === states.invalid)
	var oldItems = nonLockedItems.filter(i => now - i.created.getTime > pool.maxItemAge)
	var almostReadyItemsCount = readyItems.length
		+ creatingItems.length
		+ preparingItems.length
		+ updatingItems.length

	var itemsToCreateCount = pool.minItemsTotal - nonLockedItems.length
	itemsToCreateCount = Math.max(itemsToCreateCount, pool.minItemsReady - almostReadyItemsCount)
	itemsToCreateCount -= pool.itemsToCreate

	var itemsToDeleteCount = nonLockedItems.length - pool.maxItemsTotal
	itemsToDeleteCount = Math.max(itemsToDeleteCount, readyItems.length - pool.maxItemsReady)

	if (itemsToCreateCount > 0)
		pool.itemsToCreate += itemsToCreateCount
	if (itemsToDeleteCount > 0) {
		var itemsToDelete = readyItems.slice(0, itemsToDeleteCount)
		for (const i in itemsToDelete)
			pool.itemsToDelete.push(itemsToDelete[i])
	}
	if (oldItems.length > 0)
		for (const i in oldItems)
			pool.itemsToDelete.push(oldItems[i])

	pool.updateChangedItemStates(pool.items)
}


function _createQueuedItem(pool) {
	if (pool.itemsToCreate <= 0)
		return
	var id = new Date().getTime() + Math.random().toString().replace(".", "")
	var item = new Item(id, pool.itemType, states.creating, null, null)
	pool.items[item.id] = item
	pool.itemsToCreate--;
	pool.logger("Creating " + item.type + " item with id=" + item.id)
	var value = pool.itemFactory()
	pool.logger("Done Creating " + item.type + " item with id=" + item.id)
	item.setValue(value)
	item.setState(states.preparing)
	pool.logger("Preparing " + item.type + " item with id=" + item.id)
	value = pool.itemPreparation(value)
	pool.logger("Done Preparing " + item.type + " item with id=" + item.id)
	item.setValue(value)
	item.setState(states.ready)
}

function _deleteQueuedItem(pool) {
	if (pool.itemsToDelete.length <= 0)
		return
	var id = pool.itemsToDelete.shift().id
	var item = pool.items[id]
	if (!item)
		return
	item.setState(states.deleting)
	pool.logger("Deleting " + item.type + " item with id=" + item.id)
	pool.itemDeletion(item.value)
	pool.logger("Done Deleting " + item.type + " item with id=" + item.id)
	delete pool.items[item.id]
}

module.exports = Pool