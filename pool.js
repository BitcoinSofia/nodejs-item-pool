const states = {
	creating: "creating",
	preparing: "preparing",
	ready: "ready",
	inUse: "inUse",
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
	maxItemAge: (30 * 24 * 60 * 60 * 1000), // 30 days
	refreshPeriod: 5000,
	creationWaitPeriod: 100,
	deletionWaitPeriod: 100,
	itemFactory: function () { return value },
	itemDeletion: function (item) { },
	itemPreparation: function (value) { return value },
	logger: function (str) { console.log(str) },
	updateChangedItemStates: function (items) { },
}
defaultConfig.itemFactory = undefined

class Pool {

	constructor(config = defaultConfig) {
		this.items = {} // { ID: item }
		this.itemsToDelete = [] // list of IDs
		this.itemsToCreate = 0 // count
		this.running = false
		this.manageWorkerId = "<not started>"
		this.createWorkerId = "<not started>"
		this.deleteWorkerId = "<not started>"
		for (const key in defaultConfig)
			this[key] = config[key] !== undefined ? config[key] : defaultConfig[key]
		if (!this.itemFactory)
			throw ReferenceError(this.poolName + ".itemFactory must be set")
	}

	start() {
		this.running = true
		_managePool(this)
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

	serve(port = 3000) {
		const express = require('express')
		const app = express()

		var logger = this.logger;
		function actOnServe(req, res, action, op, state) {
			try {
				logger(req.method + " " + req.url + " from " + req.ip + "")
				var result = action();
				res.status(200).json({ op: op, state: state, result: result })
			} catch (error) {
				res.status(500).json({ op: op, state: "failed", message: error.message })
			}
		}

		app.post('/start', (req, res) => actOnServe(req, res, this.start.bind(this), "start", "done"))
		app.post('/stop', (req, res) => actOnServe(req, res, this.stop.bind(this), "stop", "done"))
		app.post('/useItem', (req, res) => actOnServe(req, res, this.useItem.bind(this), "useItem", "done"))
		app.get('/getItems', (req, res) => actOnServe(req, res, this.getItems.bind(this), "getItems", "done"))
		app.post('/createItem', (req, res) => actOnServe(req, res, this.createItem.bind(this), "createItem", "started"))
		app.post('/deleteItem', (req, res) => actOnServe(req, res, () => this.deleteItem.bind(this)({id: req.params.id}), "deleteItem", "started"))

		app.listen(port, () => console.log(`Pool Service listening on port ${port}!`))
	}

	stop() {
		this.running = false
		clearInterval(this.manageWorkerId)
		clearInterval(this.createWorkerId)
		clearInterval(this.deleteWorkerId)
	}

	useItem() {
		for (const i in this.items) {
			var item = this.items[i]
			if (item.state !== states.ready)
				continue
			item.setState(states.inUse)
			return item
		}
		this.createItem() // create item if no items present
		return null;
	}

	getItems() {
		var items = []
		for (const i in this.items)
			items.push(this.items[i])
		return items
	}

	createItem(){
		this.itemsToCreate++
	}

	deleteItem(item){
		this.itemsToDelete.push(item)
	}
}

function _managePool(pool) {
	var now = new Date().getTime()
	var items = pool.getItems()

	//var lockedItems = items.filter(i => i.locked)
	var nonLockedItems = items.filter(i => !i.locked)
	var readyItems = nonLockedItems.filter(i => i.state === states.ready)
	var updatingItems = nonLockedItems.filter(i => i.state === states.updating)
	var preparingItems = nonLockedItems.filter(i => i.state === states.preparing)
	var creatingItems = nonLockedItems.filter(i => i.state === states.creating)
	//var deletingItems = poolItems.filter(i => i.state === states.deleting)
	//var invalidItems = poolItems.filter(i => i.state === states.invalid)
	var oldItems = readyItems.filter(i => now - i.created.getTime() > pool.maxItemAge)
	var almostReadyItemsCount = readyItems.length
		+ creatingItems.length
		+ preparingItems.length

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
	pool.itemsToCreate--
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

Pool.states = states
module.exports = Pool